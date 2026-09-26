import React, { createContext, useContext, useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { SaleTransaction, CartItem, RefundRequest, RefundStatus, PaymentMethod, ReceiptDelivery } from '../types';
import Fuse from 'fuse.js';
import { useSync } from './SyncContext';
import { useAuth } from './AuthContext';
import { salesApi, refundsApi, isSupabaseConfigured, getValidSupabaseSession, isAuthExpiryError } from '../services/supabaseApi';
import { generateUniqueReceiptNumber } from '../utils/identifierGenerator';

interface SalesContextType {
  salesHistory: SaleTransaction[];
  filteredSales: SaleTransaction[];
  refundRequests: RefundRequest[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  recordSale: (sale: Omit<SaleTransaction, 'id'>) => Promise<string>;
  completeAtomicCheckout: (params: {
    cart: CartItem[];
    subtotal: number;
    vatAmount: number;
    total: number;
    tenderMethod: PaymentMethod;
    amountTendered: number;
    change: number;
    receiptType: ReceiptDelivery;
    customerMobile?: string;
    cashierName?: string;
  }) => Promise<{ success: boolean; sale?: SaleTransaction; error?: string }>;
  requestRefund: (params: {
    receiptNumber: string;
    itemId: string;
    quantity: number;
    refundAmount: number;
    reason: string;
  }) => Promise<{ success: boolean; refundId?: string; error?: string }>;
  approveRefund: (params: {
    refundId: string;
    approved: boolean;
    note?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  getSaleByReceipt: (receiptNumber: string) => Promise<SaleTransaction | null>;
}

export const SalesContext = createContext<SalesContextType | undefined>(undefined);

export const SalesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { queueSyncAction, isOnline } = useSync();
  const { shopId, user, profile, isManager, hasPermission } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');

  // Live queries from Dexie
  const salesHistory = useLiveQuery(
    () => shopId ? db.sales.where('shopId').equals(shopId).reverse().sortBy('timestamp') : Promise.resolve([] as SaleTransaction[]),
    [shopId]
  ) || [];
  const localRefunds = useLiveQuery(
    () => shopId ? db.refundRequests.where('shopId').equals(shopId).reverse().sortBy('createdAt') : Promise.resolve([] as RefundRequest[]),
    [shopId]
  ) || [];
  const [remoteRefunds, setRemoteRefunds] = useState<RefundRequest[]>([]);

  // In-flight refresh deduplication ref
  const inFlightRefundRefreshRef = useRef<Promise<void> | null>(null);

  // Fetch remote refund requests when online and authenticated
  const refreshRemoteRefunds = useCallback(async () => {
    if (!isOnline || !isSupabaseConfigured() || !user || !shopId) {
      return;
    }

    if (inFlightRefundRefreshRef.current) {
      return inFlightRefundRefreshRef.current;
    }

    const task = (async () => {
      try {
        const session = await getValidSupabaseSession();
        if (!session) {
          return;
        }

        const fetched = await refundsApi.getRefundRequests(shopId);
        setRemoteRefunds(fetched);
        // Upsert into local Dexie for offline cache
        for (const req of fetched) {
          await db.refundRequests.put({ ...req, shopId });
        }
      } catch (err: any) {
        if (!isAuthExpiryError(err)) {
          console.warn('Remote refund refresh notice:', err?.message || err);
        }
      } finally {
        inFlightRefundRefreshRef.current = null;
      }
    })();

    inFlightRefundRefreshRef.current = task;
    return task;
  }, [isOnline, shopId, user]);

  useEffect(() => {
    if (!shopId) {
      setRemoteRefunds([]);
      return;
    }
    refreshRemoteRefunds();

    // Listen for session recovery / token refreshed event
    const handleSessionRecovered = () => {
      refreshRemoteRefunds();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('lm_session_recovered', handleSessionRecovered);
      return () => {
        window.removeEventListener('lm_session_recovered', handleSessionRecovered);
      };
    }
  }, [refreshRemoteRefunds, shopId]);

  // Combine and deduplicate refund requests
  const refundRequests = useMemo(() => {
    const map = new Map<string, RefundRequest>();
    for (const r of localRefunds) map.set(r.id, r);
    for (const r of remoteRefunds) {
      if (r.shopId === shopId) map.set(r.id, r);
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [localRefunds, remoteRefunds, shopId]);

  const fuse = useMemo(() => new Fuse(salesHistory, {
    keys: ['receiptNumber', 'customerMobile', 'items.item.title', 'items.item.sku'],
    threshold: 0.3
  }), [salesHistory]);

  const filteredSales = useMemo(() => {
    if (!searchQuery.trim()) return salesHistory;
    return fuse.search(searchQuery.trim()).map(result => result.item);
  }, [searchQuery, salesHistory, fuse]);

  const getSaleByReceipt = async (receiptNumber: string): Promise<SaleTransaction | null> => {
    if (!shopId) return null;
    // Check local Dexie first
    const local = await db.sales.where('shopId').equals(shopId).and(s => s.receiptNumber === receiptNumber).first();
    if (local) return local;

    // If online, check Supabase
    if (isOnline && isSupabaseConfigured()) {
      const remote = await salesApi.getSaleByReceiptNumber(receiptNumber);
      if (remote && remote.shop_id === shopId) {
        return salesApi.mapRowToSale(remote);
      }
    }
    return null;
  };

  /**
   * ATOMIC CHECKOUT IMPLEMENTATION
   * 1. Validates cart & payment
   * 2. Generates stable UUID & receipt number
   * 3. Calls public.complete_retail_sale RPC when online
   * 4. Updates local Dexie items to Sold & saves sale
   * 5. Queues idempotent sync if truly offline
   * 6. Real errors, atomic rollback on failure, NO fake success.
   */
  const completeAtomicCheckout = async (params: {
    cart: CartItem[];
    subtotal: number;
    vatAmount: number;
    total: number;
    tenderMethod: PaymentMethod;
    amountTendered: number;
    change: number;
    receiptType: ReceiptDelivery;
    customerMobile?: string;
    cashierName?: string;
  }): Promise<{ success: boolean; sale?: SaleTransaction; error?: string }> => {
    if (!shopId) {
      return { success: false, error: 'No active shop context.' };
    }
    if (!params.cart || params.cart.length === 0) {
      return { success: false, error: 'Cart is empty.' };
    }

    if (params.tenderMethod === 'cash' && params.amountTendered < params.total) {
      return { 
        success: false, 
        error: `Amount tendered (R${params.amountTendered.toFixed(2)}) is less than total R${params.total.toFixed(2)}.` 
      };
    }

    // Stable identifiers generated ONCE per checkout attempt
    const saleId = crypto.randomUUID();
    const receiptNumber = generateUniqueReceiptNumber(rn => salesHistory.some(s => s.receiptNumber === rn));
    const timestamp = new Date().toISOString();
    const cashier = params.cashierName || profile?.full_name || 'Cashier';

    // Normalized items structure ensuring consistent JSON representation
    const normalizedCart: CartItem[] = params.cart.map(ci => ({
      item: {
        ...ci.item,
        status: 'Sold'
      },
      quantity: ci.quantity || 1,
      overridePrice: ci.overridePrice
    }));

    const saleRecord: SaleTransaction = {
      id: saleId,
      shopId,
      receiptNumber,
      timestamp,
      items: normalizedCart,
      subtotal: params.subtotal,
      vatAmount: params.vatAmount,
      total: params.total,
      tenderMethod: params.tenderMethod,
      amountTendered: params.amountTendered,
      change: params.change,
      receiptType: params.receiptType,
      customerMobile: params.customerMobile,
      cashier
    };

    try {
      // If online and Supabase is configured, call atomic RPC first
      if (isOnline && isSupabaseConfigured() && user) {
        const rpcPayload = {
          saleId,
          receiptNumber,
          shopId,
          items: normalizedCart.map(ci => ({
            id: ci.item.id,
            sku: ci.item.sku,
            title: ci.item.title,
            quantity: ci.quantity,
            overridePrice: ci.overridePrice,
            retailPrice: ci.item.retailPrice
          })),
          subtotal: params.subtotal,
          vatAmount: params.vatAmount,
          total: params.total,
          tenderMethod: params.tenderMethod,
          amountTendered: params.amountTendered,
          change: params.change,
          receiptType: params.receiptType,
          customerMobile: params.customerMobile,
          cashier
        };

        const rpcResult = await salesApi.completeRetailSaleRpc(rpcPayload);

        if (!rpcResult.success) {
          // STRICT PRODUCTION RULE: A failed online transaction must NOT be recorded as success!
          console.error('Online checkout failed on Supabase backend:', rpcResult.error);
          return {
            success: false,
            error: rpcResult.error || 'The database rejected the sale transaction. Inventory was not modified.'
          };
        }

      // RPC succeeded: commit changes to local Dexie for instant UI sync & offline cache
      await db.transaction('rw', db.sales, db.inventory, db.syncLogs, async () => {
        await db.sales.put(saleRecord);
        for (const ci of normalizedCart) {
          const item = await db.inventory.get(ci.item.id);
          if (item && item.shopId === shopId) {
            await db.inventory.update(ci.item.id, { status: 'Sold' });
          } else if (item) {
            throw new Error(`Inventory violation: Item ${ci.item.sku} does not belong to this shop.`);
          }
        }
      });

        // Record completed sync log
        await queueSyncAction('sales', saleId, 'create', saleRecord);
        const lastLog = await db.syncLogs.where('entityId').equals(saleId).first();
        if (lastLog?.id) {
          await db.syncLogs.update(lastLog.id, {
            status: 'completed',
            syncedAt: new Date().toISOString()
          });
        }

        return { success: true, sale: saleRecord };
      } else {
        // Genuinely offline mode: save locally and queue pending sync action
        await db.transaction('rw', db.sales, db.inventory, db.syncLogs, async () => {
          await db.sales.put(saleRecord);
          for (const ci of normalizedCart) {
            const item = await db.inventory.get(ci.item.id);
            if (item && item.shopId === shopId) {
              await db.inventory.update(ci.item.id, { status: 'Sold' });
            } else if (item) {
              throw new Error(`Inventory violation: Item ${ci.item.sku} does not belong to this shop.`);
            }
          }
        });

        await queueSyncAction('sales', saleId, 'create', saleRecord);
        return { success: true, sale: saleRecord };
      }
    } catch (err: any) {
      console.error('Fatal checkout failure:', err);
      return { success: false, error: err?.message || 'Transaction could not be recorded.' };
    }
  };

  /**
   * REQUEST REFUND (Cashier / Staff)
   * Validates receipt, item, line price limit, and creates a Pending Approval request.
   */
  const requestRefund = async (params: {
    receiptNumber: string;
    itemId: string;
    quantity: number;
    refundAmount: number;
    reason: string;
  }): Promise<{ success: boolean; refundId?: string; error?: string }> => {
    if (!shopId) return { success: false, error: 'No active shop context.' };
    if (!params.reason.trim()) {
      return { success: false, error: 'A valid refund reason is strictly mandatory.' };
    }
    if (params.refundAmount <= 0) {
      return { success: false, error: 'Refund amount must be greater than zero.' };
    }

    // 1. Verify receipt and item locally
    const sale = await getSaleByReceipt(params.receiptNumber);
    if (!sale) {
      return { success: false, error: `Receipt "${params.receiptNumber}" was not found.` };
    }

    const saleItem = sale.items.find(ci => ci.item.id === params.itemId);
    if (!saleItem) {
      return { success: false, error: 'The selected item was not part of this sale receipt.' };
    }

    const maxAllowedRefund = (saleItem.overridePrice ?? saleItem.item.retailPrice) * (params.quantity || 1);
    if (params.refundAmount > maxAllowedRefund) {
      return {
        success: false,
        error: `Requested refund amount (R${params.refundAmount.toFixed(2)}) exceeds sold item total (R${maxAllowedRefund.toFixed(2)}).`
      };
    }

    // Check existing pending refund for this item
    const existingPending = await db.refundRequests
      .where('receiptNumber')
      .equals(params.receiptNumber)
      .and(r => r.itemId === params.itemId && r.status === 'Pending Approval' && r.shopId === shopId)
      .first();

    if (existingPending) {
      return { success: false, error: 'A pending refund request already exists for this item on this receipt.' };
    }

    const refundId = crypto.randomUUID();

    const refundRecord: RefundRequest = {
      id: refundId,
      shopId,
      saleId: sale.id,
      receiptNumber: params.receiptNumber,
      itemId: params.itemId,
      itemSku: saleItem.item.sku,
      itemTitle: saleItem.item.title,
      quantity: params.quantity || 1,
      refundAmount: params.refundAmount,
      reason: params.reason.trim(),
      status: 'Pending Approval',
      requestedBy: user?.id,
      requestedByName: profile?.full_name || 'Cashier',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Call Supabase RPC if online
    if (isOnline && isSupabaseConfigured() && user) {
      const res = await refundsApi.requestRefund({
        receiptNumber: params.receiptNumber,
        itemId: params.itemId,
        quantity: params.quantity || 1,
        refundAmount: params.refundAmount,
        reason: params.reason.trim()
      });

      if (!res.success) {
        return { success: false, error: res.error || 'Server rejected refund request.' };
      }

      // TASK 1: Authoritative server refund ID becomes the local record ID
      const authoritativeId = res.refundId || refundId;
      const finalRefundRecord: RefundRequest = {
        ...refundRecord,
        id: authoritativeId
      };

      await db.refundRequests.put(finalRefundRecord);
      await refreshRemoteRefunds();
      return { success: true, refundId: authoritativeId };
    } else {
      // Offline mode
      await db.refundRequests.put(refundRecord);
      await queueSyncAction('refunds', refundId, 'create', refundRecord);
      return { success: true, refundId };
    }
  };

  /**
   * APPROVE / REJECT REFUND (Manager / Owner only)
   * Restores item to 'Retail Floor' upon approval. Never deletes original sale!
   * Enforces self-approval prevention.
   */
  const approveRefund = async (params: {
    refundId: string;
    approved: boolean;
    note?: string;
  }): Promise<{ success: boolean; error?: string }> => {
    if (!shopId) return { success: false, error: 'No active shop context.' };
    if (!hasPermission('refunds')) {
      return { success: false, error: 'Unauthorized: You do not have permission to approve refunds.' };
    }

    const req = await db.refundRequests.get(params.refundId);
    if (!req || req.shopId !== shopId) {
      return { success: false, error: 'Refund request record not found.' };
    }

    // Self-approval prevention rule
    if (req.requestedBy && user?.id && req.requestedBy === user.id) {
      return {
        success: false,
        error: 'Security Policy Violation: Staff members cannot approve their own refund requests. A different Manager or Owner must review this.'
      };
    }

    const approverName = profile?.full_name || 'Manager';
    const newStatus: RefundStatus = params.approved ? 'Approved' : 'Rejected';

    // If online, execute RPC first
    if (isOnline && isSupabaseConfigured() && user) {
      const res = await refundsApi.approveRefund({
        refundId: params.refundId,
        approved: params.approved,
        note: params.note
      });

      if (!res.success) {
        return { success: false, error: res.error || 'Refund approval was rejected by backend server.' };
      }

      // Update local Dexie state on success
      await db.transaction('rw', db.refundRequests, db.inventory, async () => {
        await db.refundRequests.update(req.id, {
          status: newStatus,
          approvedBy: user?.id,
          approvedByName: approverName,
          rejectionReason: !params.approved ? params.note : undefined,
          updatedAt: new Date().toISOString()
        });

        if (params.approved) {
          const item = await db.inventory.get(req.itemId);
          if (item && item.shopId === shopId) {
            await db.inventory.update(req.itemId, {
              status: 'Retail Floor'
            });
          } else if (item) {
            throw new Error('Access Denied: Refunded item does not belong to this shop.');
          }
        }
      });

      await refreshRemoteRefunds();
      return { success: true };
    } else {
      // TASK 3: Offline mode - update local Dexie state AND queue durable sync action for approval
      await db.transaction('rw', db.refundRequests, db.inventory, async () => {
        await db.refundRequests.update(req.id, {
          status: newStatus,
          approvedBy: user?.id,
          approvedByName: approverName,
          rejectionReason: !params.approved ? params.note : undefined,
          updatedAt: new Date().toISOString()
        });

        if (params.approved) {
          const item = await db.inventory.get(req.itemId);
          if (item && item.shopId === shopId) {
            await db.inventory.update(req.itemId, {
              status: 'Retail Floor'
            });
          } else if (item) {
            throw new Error('Access Denied: Refunded item does not belong to this shop.');
          }
        }
      });

      await queueSyncAction(
        'refund_approval',
        params.refundId,
        params.approved ? 'approve' : 'reject',
        {
          refundId: params.refundId,
          approved: params.approved,
          note: params.note
        }
      );

      return { success: true };
    }
  };

  const recordSale = async (saleData: Omit<SaleTransaction, 'id'>) => {
    if (!shopId) throw new Error('No active shop context.');
    const id = crypto.randomUUID();
    const newSale = { ...saleData, id, shopId };
    await db.sales.add(newSale);
    await queueSyncAction('sales', id, 'create', newSale);
    return id;
  };

  return (
    <SalesContext.Provider value={{
      salesHistory,
      filteredSales,
      refundRequests,
      searchQuery,
      setSearchQuery,
      recordSale,
      completeAtomicCheckout,
      requestRefund,
      approveRefund,
      getSaleByReceipt
    }}>
      {children}
    </SalesContext.Provider>
  );
};

export const useSales = () => {
  const context = useContext(SalesContext);
  if (!context) throw new Error('useSales must be used within SalesProvider');
  return context;
};
