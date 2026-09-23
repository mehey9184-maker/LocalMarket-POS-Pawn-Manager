import React, { createContext, useContext, useMemo, useState, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { SaleTransaction, CartItem, RefundRequest, RefundStatus, PaymentMethod, ReceiptDelivery } from '../types';
import Fuse from 'fuse.js';
import { useSync } from './SyncContext';
import { useAuth } from './AuthContext';
import { salesApi, refundsApi, isSupabaseConfigured } from '../services/supabaseApi';

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

const SalesContext = createContext<SalesContextType | undefined>(undefined);

export const SalesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { queueSyncAction, isOnline } = useSync();
  const { shopId, user, profile, isManager } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');

  // Live queries from Dexie
  const salesHistory = useLiveQuery(() => db.sales.orderBy('timestamp').reverse().toArray()) || [];
  const localRefunds = useLiveQuery(() => db.refundRequests.orderBy('createdAt').reverse().toArray()) || [];
  const [remoteRefunds, setRemoteRefunds] = useState<RefundRequest[]>([]);

  // Fetch remote refund requests when online
  const refreshRemoteRefunds = useCallback(async () => {
    if (isOnline && isSupabaseConfigured()) {
      try {
        const fetched = await refundsApi.getRefundRequests(shopId || undefined);
        setRemoteRefunds(fetched);
        // Upsert into local Dexie for offline cache
        for (const req of fetched) {
          await db.refundRequests.put(req);
        }
      } catch (err) {
        console.warn('Could not refresh remote refund requests:', err);
      }
    }
  }, [isOnline, shopId]);

  useEffect(() => {
    refreshRemoteRefunds();
  }, [refreshRemoteRefunds]);

  // Combine and deduplicate refund requests
  const refundRequests = useMemo(() => {
    const map = new Map<string, RefundRequest>();
    for (const r of localRefunds) map.set(r.id, r);
    for (const r of remoteRefunds) map.set(r.id, r);
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [localRefunds, remoteRefunds]);

  const fuse = useMemo(() => new Fuse(salesHistory, {
    keys: ['receiptNumber', 'customerMobile', 'items.item.title', 'items.item.sku'],
    threshold: 0.3
  }), [salesHistory]);

  const filteredSales = useMemo(() => {
    if (!searchQuery.trim()) return salesHistory;
    return fuse.search(searchQuery.trim()).map(result => result.item);
  }, [searchQuery, salesHistory, fuse]);

  const getSaleByReceipt = async (receiptNumber: string): Promise<SaleTransaction | null> => {
    // Check local Dexie first
    const local = await db.sales.where('receiptNumber').equals(receiptNumber).first();
    if (local) return local;

    // If online, check Supabase
    if (isOnline && isSupabaseConfigured()) {
      const remote = await salesApi.getSaleByReceiptNumber(receiptNumber);
      if (remote) {
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
   * 5. Queues idempotent sync if offline or fallback
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
    if (!params.cart || params.cart.length === 0) {
      return { success: false, error: 'Cart is empty.' };
    }

    if (params.tenderMethod === 'cash' && params.amountTendered < params.total) {
      return { success: false, error: `Amount tendered (R${params.amountTendered}) is less than total R${params.total}.` };
    }

    // Stable identifiers generated ONCE per checkout attempt
    const saleId = crypto.randomUUID();
    const receiptNumber = `REC-${Math.floor(100000 + Math.random() * 900000)}`;
    const timestamp = new Date().toISOString();
    const cashier = params.cashierName || profile?.full_name || 'Cashier';
    const effectiveShopId = shopId || '00000000-0000-0000-0000-000000000001';

    const saleRecord: SaleTransaction = {
      id: saleId,
      receiptNumber,
      timestamp,
      items: params.cart,
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
      // 1. First execute local Dexie transaction to ensure immediate local state
      await db.transaction('rw', db.sales, db.inventory, db.syncLogs, async () => {
        // Save sale record
        await db.sales.put(saleRecord);

        // Update inventory items to 'Sold'
        for (const ci of params.cart) {
          const item = ci.item;
          await db.inventory.update(item.id, {
            status: 'Sold'
          });
        }
      });

      // 2. If online and Supabase is configured, call atomic RPC
      if (isOnline && isSupabaseConfigured() && user) {
        const rpcPayload = {
          saleId,
          receiptNumber,
          shopId: effectiveShopId,
          items: params.cart.map(ci => ({
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

        if (rpcResult.success) {
          // Sync succeeded immediately
          await queueSyncAction('sales', saleId, 'create', saleRecord);
          // Mark the newly queued log as completed
          const lastLog = await db.syncLogs.where('entityId').equals(saleId).first();
          if (lastLog?.id) {
            await db.syncLogs.update(lastLog.id, {
              status: 'completed',
              syncedAt: new Date().toISOString()
            });
          }
          return { success: true, sale: saleRecord };
        } else {
          // RPC reported business rule or network error
          console.warn('Supabase complete_retail_sale RPC failed, queuing for sync:', rpcResult.error);
          await queueSyncAction('sales', saleId, 'create', saleRecord);
          return { success: true, sale: saleRecord };
        }
      } else {
        // Offline mode: queue operation with stable UUID
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
   * Validates receipt, item, sold status, and creates a Pending Approval request.
   */
  const requestRefund = async (params: {
    receiptNumber: string;
    itemId: string;
    quantity: number;
    refundAmount: number;
    reason: string;
  }): Promise<{ success: boolean; refundId?: string; error?: string }> => {
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

    // Check existing pending refund for this item
    const existingPending = await db.refundRequests
      .where('receiptNumber')
      .equals(params.receiptNumber)
      .and(r => r.itemId === params.itemId && r.status === 'Pending Approval')
      .first();

    if (existingPending) {
      return { success: false, error: 'A pending refund request already exists for this item on this receipt.' };
    }

    const refundId = crypto.randomUUID();
    const effectiveShopId = shopId || '00000000-0000-0000-0000-000000000001';
    const refundRecord: RefundRequest = {
      id: refundId,
      shopId: effectiveShopId,
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

    // Save in Dexie
    await db.refundRequests.put(refundRecord);

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
        console.warn('Refund request RPC failed, queuing:', res.error);
        await queueSyncAction('refunds', refundId, 'create', refundRecord);
      }
    } else {
      await queueSyncAction('refunds', refundId, 'create', refundRecord);
    }

    await refreshRemoteRefunds();
    return { success: true, refundId };
  };

  /**
   * APPROVE / REJECT REFUND (Manager / Owner only)
   * Restores item to 'Retail Floor' upon approval. Never deletes the original sale!
   */
  const approveRefund = async (params: {
    refundId: string;
    approved: boolean;
    note?: string;
  }): Promise<{ success: boolean; error?: string }> => {
    if (!isManager) {
      return { success: false, error: 'Unauthorized: Manager or Owner authority required to approve refunds.' };
    }

    const req = await db.refundRequests.get(params.refundId);
    if (!req) {
      return { success: false, error: 'Refund request record not found.' };
    }

    const approverName = profile?.full_name || 'Manager';
    const newStatus: RefundStatus = params.approved ? 'Approved' : 'Rejected';

    // Update local Dexie
    await db.transaction('rw', db.refundRequests, db.inventory, async () => {
      await db.refundRequests.update(req.id, {
        status: newStatus,
        approvedBy: user?.id,
        approvedByName: approverName,
        rejectionReason: !params.approved ? params.note : undefined,
        updatedAt: new Date().toISOString()
      });

      if (params.approved) {
        // Restore item back to Retail Floor
        await db.inventory.update(req.itemId, {
          status: 'Retail Floor'
        });
      }
    });

    // Call Supabase RPC
    if (isOnline && isSupabaseConfigured() && user) {
      const res = await refundsApi.approveRefund({
        refundId: params.refundId,
        approved: params.approved,
        note: params.note
      });

      if (!res.success) {
        return { success: false, error: res.error };
      }
    }

    await refreshRemoteRefunds();
    return { success: true };
  };

  const recordSale = async (saleData: Omit<SaleTransaction, 'id'>) => {
    const id = crypto.randomUUID();
    const newSale = { ...saleData, id };
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
