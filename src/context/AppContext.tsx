import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  Customer,
  RsaIdScanResult,
  InventoryItem,
  PawnLoan,
  SapsEntry,
  CartItem,
  SaleTransaction,
  PaymentMethod,
  ReceiptDelivery,
  ItemCondition,
  BusinessRules
} from '../types';
import { isSupabaseConfigured } from '../services/supabase';
import { authApi, shopItemsApi, logsApi, shopProfilesApi } from '../services/supabaseApi';
import { ProfileRow, SystemLogRow } from '../types/supabase';
import { DEFAULT_BUSINESS_RULES } from '../utils/pricingRules';
import { useInventory } from './InventoryContext';
import { useLoans } from './LoanContext';
import { useCustomers } from './CustomerContext';
import { useSales } from './SalesContext';
import { useSaps } from './SapsContext';
import { useSync } from './SyncContext';
import { useAuth } from './AuthContext';
import { db } from '../db';
import { runMigration } from '../db/migration';

export type NavTab = 'landing' | 'auth' | 'shop-setup' | 'home' | 'sell' | 'buy-pawn' | 'inventory' | 'customers' | 'profile' | 'vault' | 'saps';

export interface ShopProfile {
  id?: string;
  shop_code: string;
  shop_name: string;
  trading_name: string;
  registration_number: string;
  vat_number: string;
  saps_dealer_license: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  province: string;
  postal_code: string;
  currency: string;
  receipt_header?: string;
  receipt_footer?: string;
  businessRules?: BusinessRules;
}

/**
 * SOURCE OF TRUTH ARCHITECTURE (Business Rules & Shop Profile):
 * 1. Cloud-Authoritative: When authenticated and cloud data exists in Supabase (public.shop_profiles),
 *    the server record is the sole authoritative source of truth.
 * 2. Local Fallback/Offline Cache: 'lm_shop_profile' and 'lm_business_rules' in localStorage act
 *    strictly as an offline cache to ensure uninterrupted offline operation.
 * 3. Precedence & Anti-Stale Guarantee: When server data loads via auth, it unconditionally refreshes
 *    both in-memory state and localStorage cache. Stale local settings can NEVER overwrite newer server settings.
 * 4. Audited Modifications: Owners modifying business rules persist via the audited RPC path
 *    (update_shop_business_rules) which logs directly to public.business_rule_audit_logs.
 */

// Shop Profile Initial State
export const INITIAL_SHOP_PROFILE: ShopProfile = {
  shop_code: '',
  shop_name: 'LocalMarket Store',
  trading_name: '',
  registration_number: '',
  vat_number: '',
  saps_dealer_license: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  province: '',
  postal_code: '',
  currency: 'ZAR',
  receipt_header: 'LOCALMARKET POS & PAWN BROKERS',
  receipt_footer: 'THANK YOU FOR YOUR BUSINESS\nGoods sold as second-hand under SHG Act 06 of 2009'
};

export interface ToastInfo {
  title: string;
  desc: string;
  type?: 'success' | 'amber' | 'info' | 'error';
}

interface AppContextType {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  cart: CartItem[];
  selectedLoanForSettlement: PawnLoan | null;
  setSelectedLoanForSettlement: (loan: PawnLoan | null) => void;
  isScannerModalOpen: boolean;
  setIsScannerModalOpen: (val: boolean) => void;
  activeReceiptModal: SaleTransaction | null;
  setActiveReceiptModal: (sale: SaleTransaction | null) => void;
  activeContractModal: PawnLoan | null;
  setActiveContractModal: (loan: PawnLoan | null) => void;
  toastMessage: ToastInfo | null;
  showToast: (title: string, desc: string, type?: 'success' | 'amber' | 'info' | 'error') => void;
  isPoliceInspectionMode: boolean;
  setIsPoliceInspectionMode: (val: boolean) => void;
  activeCustomer: Customer | null;
  setActiveCustomer: (customer: Customer | null) => void;
  capturedRsaIdScan: RsaIdScanResult | null;
  setCapturedRsaIdScan: (scan: RsaIdScanResult | null) => void;
  zenMode: boolean;
  setZenMode: React.Dispatch<React.SetStateAction<boolean>>;
  
  // Shop Profile (Branch & Second Hand Dealer License)
  shopProfile: ShopProfile;
  updateShopProfile: (updates: Partial<ShopProfile>) => Promise<void> | void;

  // WhatsApp-Style Local Device Persistence & Trickle Sync
  isOnline: boolean;
  isSlowSyncing: boolean;
  pendingSyncCount: number;
  failedSyncCount?: number;
  hasDeterministicError?: boolean;
  hasTransientError?: boolean;
  slowSyncProgress: { current: number; total: number; entityName: string } | null;
  triggerManualSlowSync: () => Promise<void>;
  exportDeviceBackup: () => Promise<void>;
  restoreDeviceBackup: (fileContent: string) => Promise<{ success: boolean; message: string }>;
  deviceStorageStats: {
    totalItems: number;
    totalSales: number;
    pendingOfflineItems: number;
    lastBackupTime: string | null;
    estimatedLocalSizeKb: number;
  };
  
  // Supabase API Integration (Authentication, Database: shop items, profiles, logs)
  supabaseStatus: {
    isConfigured: boolean;
    isConnected: boolean;
    isSyncing: boolean;
    lastSyncTime: string | null;
  };
  supabaseUser: any | null;
  currentUserProfile: ProfileRow | null;
  supabaseLogs: SystemLogRow[];
  syncShopItemsWithSupabase: (forceFull?: boolean) => Promise<void>;
  fetchSupabaseLogs: () => Promise<void>;
  logSystemEvent: (eventType: string, details?: any, severity?: 'info' | 'warning' | 'audit' | 'critical', sapsRef?: string) => Promise<void>;
  
  // Cart Actions
  addToCart: (item: InventoryItem) => void;
  removeFromCart: (itemId: string) => void;
  updateCartQuantity: (itemId: string, qty: number) => void;
  updateCartItemPrice: (itemId: string, newPrice: number) => void;
  clearCart: () => void;
  completeCheckout: (tenderMethod: PaymentMethod, amountTendered: number, receiptType: ReceiptDelivery, customerMobile?: string) => Promise<SaleTransaction>;
  processRefund: (receiptNumber: string, itemId: string, reason: string) => Promise<boolean>;

  // Loan Actions
  redeemLoan: (ticketNumber: string, amountPaid: number) => Promise<{ success: boolean; error?: string }>;
  extendLoan: (ticketNumber: string, feePaid: number) => Promise<{ success: boolean; error?: string }>;
  archiveLoan: (loanId: string) => Promise<void>;

  // Vault Actions
  transferOverdueToFloor: (ticketNumber: string, retailPrice: number) => Promise<{ success: boolean; error?: string }>;
  batchTransferOverdue: () => Promise<{ success: boolean; count: number; error?: string }>;

  // SAPS Actions
  exportSapsCsv: () => void;

  // Business & Deal Rules Customization
  businessRules: BusinessRules;
  updateBusinessRules: (rules: Partial<BusinessRules>, reason?: string) => Promise<void>;
  isRulesModalOpen: boolean;
  setIsRulesModalOpen: (open: boolean) => void;

  // Domain state
  inventory: InventoryItem[];
  customers: Customer[];
  pawnLoans: PawnLoan[];
  sapsRegister: SapsEntry[];
  salesHistory: SaleTransaction[];

  // General
  resetToDefaultData: () => void;
}

export const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<NavTab>('landing');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedLoanForSettlement, setSelectedLoanForSettlement] = useState<PawnLoan | null>(null);
  const [isScannerModalOpen, setIsScannerModalOpen] = useState<boolean>(false);
  const [activeReceiptModal, setActiveReceiptModal] = useState<SaleTransaction | null>(null);
  const [activeContractModal, setActiveContractModal] = useState<PawnLoan | null>(null);
  const [toastMessage, setToastMessage] = useState<ToastInfo | null>(null);
  const [isPoliceInspectionMode, setIsPoliceInspectionMode] = useState<boolean>(false);
  const [activeCustomer, setActiveCustomer] = useState<Customer | null>(null);
  const [capturedRsaIdScan, setCapturedRsaIdScan] = useState<RsaIdScanResult | null>(null);
  const [zenMode, setZenMode] = useState<boolean>(false);

  const showToast = useCallback((title: string, desc: string, type: 'success' | 'amber' | 'info' | 'error' = 'success') => {
    setToastMessage({ title, desc, type });
    setTimeout(() => {
      setToastMessage(prev => (prev?.title === title ? null : prev));
    }, 4500);
  }, []);

  // Consume Auth Context (Single Source of Truth)
  const { user: supabaseUser, profile: currentUserProfile } = useAuth();

  // Supabase API Integration State
  const [supabaseLogs, setSupabaseLogs] = useState<SystemLogRow[]>([]);
  const [supabaseStatus, setSupabaseStatus] = useState({
    isConfigured: isSupabaseConfigured(),
    isConnected: false,
    isSyncing: false,
    lastSyncTime: null as string | null,
  });

  // Shop Profile State
  const [shopProfile, setShopProfile] = useState<ShopProfile>(() => {
    if (currentUserProfile?.shop_id) {
      const saved = localStorage.getItem(`lm_shop_profile_${currentUserProfile.shop_id}`);
      if (saved) {
        try { return JSON.parse(saved); } catch (e) { console.error(e); }
      }
    }
    return INITIAL_SHOP_PROFILE;
  });

  // Business Rules State
  const [businessRules, setBusinessRules] = useState<BusinessRules>(() => {
    if (currentUserProfile?.shop_id) {
      const savedRules = localStorage.getItem(`lm_business_rules_${currentUserProfile.shop_id}`);
      if (savedRules) {
        try {
          return { ...DEFAULT_BUSINESS_RULES, ...JSON.parse(savedRules) };
        } catch (e) {
          console.error(e);
        }
      }
    }
    return shopProfile.businessRules
      ? { ...DEFAULT_BUSINESS_RULES, ...shopProfile.businessRules }
      : DEFAULT_BUSINESS_RULES;
  });

  // Effect to reset/re-hydrate state when shop context changes
  useEffect(() => {
    if (!currentUserProfile?.shop_id) {
      setShopProfile(INITIAL_SHOP_PROFILE);
      setBusinessRules(DEFAULT_BUSINESS_RULES);
      return;
    }

    // Trigger legacy migration if not already completed, claiming data for this shopId
    runMigration(currentUserProfile.shop_id).catch(err => {
      console.error('[AppContext] Legacy migration failed:', err);
    });

    const sKey = `lm_shop_profile_${currentUserProfile.shop_id}`;
    const rKey = `lm_business_rules_${currentUserProfile.shop_id}`;
    
    const savedS = localStorage.getItem(sKey);
    const savedR = localStorage.getItem(rKey);

    if (savedS) {
      try { setShopProfile(JSON.parse(savedS)); } catch {}
    }
    if (savedR) {
      try { setBusinessRules({ ...DEFAULT_BUSINESS_RULES, ...JSON.parse(savedR) }); } catch {}
    }
  }, [currentUserProfile?.shop_id]);

  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);

  // Consume Domain Contexts
  const { inventory, updateItem } = useInventory();
  const { 
    loans: pawnLoans, 
    redeemLoan, 
    extendLoan, 
    transferOverdueToFloor, 
    batchTransferOverdue, 
    archiveLoan 
  } = useLoans();
  const { customers } = useCustomers();
  const { salesHistory, completeAtomicCheckout, requestRefund, approveRefund } = useSales();
  const { sapsEntries: sapsRegister, exportSapsCsv } = useSaps();
  const { syncStatus, triggerSync, queueSyncAction } = useSync();

  const total = useMemo(() => {
    return cart.reduce((sum, ci) => sum + (ci.overridePrice ?? ci.item.retailPrice) * ci.quantity, 0);
  }, [cart]);

  const updateBusinessRules = useCallback(async (updates: Partial<BusinessRules>, reason?: string) => {
    const nextRules = { ...businessRules, ...updates };
    const targetShopId = currentUserProfile?.shop_id;
    if (!targetShopId) return;

    const isOwner = currentUserProfile?.role === 'owner';

    // 1. Online: when authenticated as owner, attempt server persistence first
    if (navigator.onLine && isOwner) {
      try {
        const res = await shopProfilesApi.updateShopBusinessRulesRpc(nextRules, reason);
        if (res.success) {
          // Server update confirmed authoritative: persist to state and local cache
          setBusinessRules(nextRules);
          localStorage.setItem(`lm_business_rules_${targetShopId}`, JSON.stringify(nextRules));
          
          setShopProfile(sp => {
            const updated = { ...sp, businessRules: nextRules };
            localStorage.setItem(`lm_shop_profile_${targetShopId}`, JSON.stringify(updated));
            return updated;
          });

          showToast('Settings Persisted', 'Business rules updated and audited on server.', 'success');
          return;
        } else {
          console.warn('Server rejected business rules update, queueing offline outbox sync:', res.error);
        }
      } catch (err) {
        console.warn('Network error updating business rules, queueing offline outbox sync:', err);
      }
    }

    // 2. Offline / Fallback:
    // Update local state/cache for offline operational continuity
    setBusinessRules(nextRules);
    localStorage.setItem(`lm_business_rules_${targetShopId}`, JSON.stringify(nextRules));
    
    setShopProfile(sp => {
      const updated = { ...sp, businessRules: nextRules };
      localStorage.setItem(`lm_shop_profile_${targetShopId}`, JSON.stringify(updated));
      return updated;
    });

    // 3. Durable pending sync record created in Dexie syncLogs outbox
    await queueSyncAction('rules', targetShopId, 'update', {
      rules: nextRules,
      reason: reason || 'Offline business rules mutation'
    });

    showToast('Offline Mode', 'Business rules saved locally and queued for cloud sync.', 'amber');
  }, [businessRules, currentUserProfile, queueSyncAction, showToast]);

  const updateShopProfile = useCallback(async (updates: Partial<ShopProfile>) => {
    const next = { ...shopProfile, ...updates };
    const targetShopId = currentUserProfile?.shop_id;
    if (!targetShopId) return;

    const canManage = currentUserProfile?.role === 'owner' || currentUserProfile?.role === 'manager';

    // 1. Online: when authenticated with management privileges, attempt server persistence first
    if (navigator.onLine && canManage) {
      try {
        const payload: any = {};
        if (updates.shop_name !== undefined) payload.shop_name = updates.shop_name;
        if (updates.trading_name !== undefined) payload.trading_name = updates.trading_name;
        if (updates.registration_number !== undefined) payload.registration_number = updates.registration_number;
        if (updates.vat_number !== undefined) payload.vat_number = updates.vat_number;
        if (updates.saps_dealer_license !== undefined) payload.saps_dealer_license = updates.saps_dealer_license;
        if (updates.phone !== undefined) payload.phone = updates.phone;
        if (updates.email !== undefined) payload.email = updates.email;
        if (updates.address !== undefined) payload.address = updates.address;
        if (updates.city !== undefined) payload.city = updates.city;
        if (updates.province !== undefined) payload.province = updates.province;
        if (updates.postal_code !== undefined) payload.postal_code = updates.postal_code;
        if (updates.currency !== undefined) payload.currency = updates.currency;
        if (updates.receipt_header !== undefined) payload.receipt_header = updates.receipt_header;
        if (updates.receipt_footer !== undefined) payload.receipt_footer = updates.receipt_footer;

        const updated = await shopProfilesApi.updateShopProfile(targetShopId, payload);
        if (updated) {
          // Server update confirmed authoritative: persist to state and local cache
          setShopProfile(next);
          localStorage.setItem(`lm_shop_profile_${targetShopId}`, JSON.stringify(next));
          showToast('Store Profile Updated', 'Persisted to server database.', 'success');
          return;
        } else {
          console.warn('Server rejected shop profile update, queueing offline outbox sync');
        }
      } catch (err) {
        console.warn('Server shop profile update failed, queueing offline outbox sync:', err);
      }
    }

    // 2. Offline / Fallback:
    // Update local state/cache for offline operational continuity
    setShopProfile(next);
    localStorage.setItem(`lm_shop_profile_${targetShopId}`, JSON.stringify(next));

    // 3. Durable pending sync record created in Dexie syncLogs outbox
    await queueSyncAction('shopProfile', targetShopId, 'update', updates);

    showToast('Offline Mode', 'Store profile saved locally and queued for server sync.', 'amber');
  }, [shopProfile, currentUserProfile, queueSyncAction, showToast]);

  // Auth Effects: Server profile & business rules are authoritative when available
  // Conflict Safety:
  // - During startup/auth, server data is authoritative IF there is no unsynced local mutation.
  // - A pending offline mutation in db.syncLogs will NOT be overwritten by server hydration before replay.
  // - When sync triggers and completes, lastSyncTime updates, allowing authoritative server hydration.
  // - Conflict resolution model: Terminal offline changes queue in the outbox and replay upon reconnect
  //   (last-write-wins at commit time via audited RPC). When no pending mutations exist, fresh server state rules.
  useEffect(() => {
    if (currentUserProfile?.shop_id) {
      shopProfilesApi.getShopById(currentUserProfile.shop_id).then(async (shop) => {
        if (shop) {
          const shopId = currentUserProfile.shop_id!;
          // Check for pending/syncing/failed outbox records
          const pendingLogs = await db.syncLogs
            .where('status')
            .anyOf('pending', 'syncing', 'failed')
            .and(l => l.shopId === shopId)
            .toArray();

          const hasPendingRules = pendingLogs.some(l => l.entityType === 'rules');
          const hasPendingProfile = pendingLogs.some(l => l.entityType === 'shopProfile');

          const serverRules = (shop as any).business_rules as BusinessRules;
          const mappedShop: ShopProfile = {
            id: shop.id,
            shop_code: shop.shop_code,
            shop_name: shop.shop_name,
            trading_name: shop.trading_name || '',
            registration_number: shop.registration_number || '',
            vat_number: shop.vat_number || '',
            saps_dealer_license: shop.saps_dealer_license || '',
            phone: shop.phone || '',
            email: shop.email || '',
            address: shop.address || '',
            city: shop.city || '',
            province: shop.province || '',
            postal_code: shop.postal_code || '',
            currency: shop.currency || 'ZAR',
            receipt_header: shop.receipt_header || '',
            receipt_footer: shop.receipt_footer || '',
            businessRules: serverRules
          };

          // Only hydrate store profile from server if no pending local mutations are waiting to replay
          if (!hasPendingProfile) {
            setShopProfile(mappedShop);
            localStorage.setItem(`lm_shop_profile_${shopId}`, JSON.stringify(mappedShop));
          } else {
            console.log('[AppContext] Preserving pending local shopProfile mutation during server hydration');
          }
          
          // Only hydrate business rules from server if no pending local mutations are waiting to replay
          if (serverRules && !hasPendingRules) {
            const authoritativeRules: BusinessRules = {
              ...DEFAULT_BUSINESS_RULES,
              ...serverRules
            };
            setBusinessRules(authoritativeRules);
            localStorage.setItem(`lm_business_rules_${shopId}`, JSON.stringify(authoritativeRules));
          } else if (hasPendingRules) {
            console.log('[AppContext] Preserving pending local businessRules mutation during server hydration');
          }
        }
      });
    }
  }, [currentUserProfile, syncStatus.lastSyncTime]);

  const logSystemEvent = useCallback(async (
    eventType: string,
    details: any = {},
    severity: 'info' | 'warning' | 'audit' | 'critical' = 'info',
    sapsRef?: string
  ) => {
    try {
      const actorName = currentUserProfile?.full_name || 'System';
      await logsApi.createLog(eventType, actorName, details, severity, sapsRef);
    } catch (err) {
      console.warn('Logging error:', err);
    }
  }, [currentUserProfile]);

  const addToCart = (item: InventoryItem) => {
    setCart(prev => {
      const existing = prev.find(ci => ci.item.id === item.id);
      if (existing) {
        showToast('Item Already in Cart', `${item.title} quantity is set to 1`, 'info');
        return prev;
      }
      showToast('Added to Cart', `${item.title} ready for checkout`, 'success');
      return [...prev, { item, quantity: 1 }];
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => prev.filter(ci => ci.item.id !== itemId));
  };

  const updateCartQuantity = (itemId: string, qty: number) => {
    setCart(prev => prev.map(ci => ci.item.id === itemId ? { ...ci, quantity: Math.max(1, qty) } : ci));
  };

  const updateCartItemPrice = (itemId: string, newPrice: number) => {
    setCart(prev => prev.map(ci => ci.item.id === itemId ? { ...ci, overridePrice: newPrice } : ci));
  };

  const clearCart = () => setCart([]);

  const completeCheckout = useCallback(async (
    tenderMethod: PaymentMethod,
    amountTendered: number,
    receiptType: ReceiptDelivery,
    customerMobile?: string
  ): Promise<SaleTransaction> => {
    const isVatRegistered = Boolean(shopProfile?.vat_number && shopProfile.vat_number.trim().length > 0);
    const vatRate = isVatRegistered ? 0.15 : 0;
    const vatAmount = isVatRegistered ? (total - (total / (1 + vatRate))) : 0;
    const subtotal = total - vatAmount;

    const res = await completeAtomicCheckout({
      cart: [...cart],
      subtotal,
      vatAmount,
      total,
      tenderMethod,
      amountTendered,
      change: Math.max(0, amountTendered - total),
      receiptType,
      customerMobile,
      cashierName: currentUserProfile?.full_name || 'Cashier'
    });

    if (res.success && res.sale) {
      setActiveReceiptModal(res.sale);
      setCart([]);
      showToast('Sale Complete', `Receipt ${res.sale.receiptNumber} generated`, 'success');
      return res.sale;
    } else {
      showToast('Checkout Failed', res.error || 'Could not process retail sale', 'error');
      throw new Error(res.error || 'Checkout failed');
    }
  }, [cart, total, completeAtomicCheckout, currentUserProfile, showToast]);

  const processRefund = useCallback(async (receiptNumber: string, itemId: string, reason: string): Promise<boolean> => {
    try {
      // Find sale to get the price
      const sale = salesHistory.find(s => s.receiptNumber === receiptNumber);
      const saleItem = sale?.items.find(ci => ci.item.id === itemId);
      const refundAmount = saleItem ? (saleItem.overridePrice ?? saleItem.item.retailPrice) : 0;

      const reqRes = await requestRefund({
        receiptNumber,
        itemId,
        quantity: 1,
        refundAmount,
        reason
      });

      if (!reqRes.success) {
        showToast('Refund Request Failed', reqRes.error || 'Failed to request refund', 'error');
        return false;
      }

      showToast('Refund Requested', 'Submitted for manager approval', 'info');
      return true;
    } catch (err: any) {
      showToast('Refund Failed', err?.message || 'Error processing refund', 'error');
      return false;
    }
  }, [salesHistory, requestRefund, showToast]);

  return (
    <AppContext.Provider
      value={{
        activeTab,
        setActiveTab,
        cart,
        selectedLoanForSettlement,
        setSelectedLoanForSettlement,
        isScannerModalOpen,
        setIsScannerModalOpen,
        activeReceiptModal,
        setActiveReceiptModal,
        activeContractModal,
        setActiveContractModal,
        toastMessage,
        showToast,
        isPoliceInspectionMode,
        setIsPoliceInspectionMode,
        activeCustomer,
        setActiveCustomer,
        capturedRsaIdScan,
        setCapturedRsaIdScan,
        zenMode,
        setZenMode,
        shopProfile,
        updateShopProfile,
        businessRules,
        updateBusinessRules,
        isRulesModalOpen,
        setIsRulesModalOpen,
        supabaseStatus,
        supabaseUser,
        currentUserProfile,
        supabaseLogs,
        logSystemEvent,
        addToCart,
        removeFromCart,
        updateCartQuantity,
        updateCartItemPrice,
        clearCart,
        inventory,
        customers,
        pawnLoans,
        sapsRegister,
        salesHistory,
        syncShopItemsWithSupabase: async () => {
          try {
            if (!isSupabaseConfigured()) {
              showToast('Supabase Offline', 'Cloud database connection is not configured.', 'info');
              return;
            }
            const items = await shopItemsApi.getItems({ shopId: shopProfile.id });
            if (items && items.length > 0) {
              const mapped = items.map(shopItemsApi.mapRowToInventoryItem);
              await db.inventory.bulkPut(mapped);
              showToast('Inventory Synced', `Synchronized ${mapped.length} catalog items from Supabase.`, 'success');
            } else {
              showToast('Inventory Synced', 'Store catalog is up to date.', 'info');
            }
          } catch (err: any) {
            showToast('Sync Error', err?.message || 'Failed to pull inventory from cloud.', 'error');
          }
        },
        fetchSupabaseLogs: async () => {
          try {
            if (!isSupabaseConfigured()) return;
            const logs = await logsApi.getLogs(100);
            setSupabaseLogs(logs);
          } catch (err: any) {
            console.warn('Failed to fetch system logs from Supabase:', err);
          }
        },
        completeCheckout,
        processRefund,
        redeemLoan,
        extendLoan,
        transferOverdueToFloor,
        batchTransferOverdue,
        archiveLoan,
        exportSapsCsv,
        resetToDefaultData: async () => {
          try {
            await Promise.all([
              db.inventory.clear(),
              db.customers.clear(),
              db.sellers.clear(),
              db.sellerTransactions.clear(),
              db.loans.clear(),
              db.sales.clear(),
              db.saps.clear(),
              db.refundRequests.clear(),
              db.syncLogs.clear()
            ]);
            showToast('Reset Complete', 'Local database tables reset.', 'info');
          } catch (err: any) {
            showToast('Reset Failed', err?.message || 'Could not reset local tables.', 'error');
          }
        },
        isOnline: syncStatus.isOnline,
        isSlowSyncing: syncStatus.isSyncing,
        pendingSyncCount: syncStatus.pendingCount,
        failedSyncCount: syncStatus.failedCount,
        hasDeterministicError: syncStatus.hasDeterministicError,
        hasTransientError: syncStatus.hasTransientError,
        slowSyncProgress: null,
        triggerManualSlowSync: async () => {
          await triggerSync();
          showToast('Sync Triggered', 'Replicating pending items to Supabase', 'info');
        },
        exportDeviceBackup: async () => {
          try {
            const backup = {
              version: 5,
              exportedAt: new Date().toISOString(),
              shopProfile,
              businessRules,
              inventory: await db.inventory.toArray(),
              customers: await db.customers.toArray(),
              sellers: await db.sellers.toArray(),
              sellerTransactions: await db.sellerTransactions.toArray(),
              loans: await db.loans.toArray(),
              saps: await db.saps.toArray(),
              sales: await db.sales.toArray(),
              refundRequests: await db.refundRequests.toArray()
            };
            const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `localmarket-backup-${shopProfile.shop_code}-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
            localStorage.setItem('last_backup_time', new Date().toISOString());
            showToast('Backup Exported', 'Local store snapshot downloaded to disk', 'success');
          } catch (err: any) {
            showToast('Backup Error', err?.message || 'Failed to export backup', 'error');
          }
        },
        restoreDeviceBackup: async (fileContent: string) => {
          try {
            const data = JSON.parse(fileContent);
            if (!data.inventory && !data.sales) {
              throw new Error('Invalid LocalMarket backup file format');
            }
            if (data.shopProfile) setShopProfile(data.shopProfile);
            if (data.businessRules) updateBusinessRules(data.businessRules);
            if (Array.isArray(data.inventory)) await db.inventory.bulkPut(data.inventory);
            if (Array.isArray(data.customers)) await db.customers.bulkPut(data.customers);
            if (Array.isArray(data.sellers)) await db.sellers.bulkPut(data.sellers);
            if (Array.isArray(data.sellerTransactions)) await db.sellerTransactions.bulkPut(data.sellerTransactions);
            if (Array.isArray(data.loans)) await db.loans.bulkPut(data.loans);
            if (Array.isArray(data.saps)) await db.saps.bulkPut(data.saps);
            if (Array.isArray(data.sales)) await db.sales.bulkPut(data.sales);
            if (Array.isArray(data.refundRequests)) await db.refundRequests.bulkPut(data.refundRequests);
            showToast('Restore Complete', 'Local database restored successfully', 'success');
            return { success: true, message: 'Restored successfully' };
          } catch (err: any) {
            showToast('Restore Failed', err.message || 'Invalid backup', 'error');
            return { success: false, message: err.message };
          }
        },
        deviceStorageStats: {
          totalItems: inventory.length,
          totalSales: salesHistory.length,
          pendingOfflineItems: syncStatus.pendingCount,
          lastBackupTime: localStorage.getItem('last_backup_time'),
          estimatedLocalSizeKb: Math.round((inventory.length * 1.5) + (salesHistory.length * 0.8))
        }
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
