import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  Customer,
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
import {
  INITIAL_CUSTOMERS,
  INITIAL_INVENTORY,
  INITIAL_PAWN_LOANS,
  INITIAL_SAPS_REGISTER
} from '../data/initialData';
import { offlineStorage, OfflineSyncItem } from '../services/offlineStorage';
import { isSupabaseConfigured } from '../services/supabase';
import { authApi, profilesApi, shopItemsApi, logsApi, shopProfilesApi } from '../services/supabaseApi';
import { ProfileRow, SystemLogRow, ShopProfileRow } from '../types/supabase';
import { DEFAULT_BUSINESS_RULES, roundRetailPrice } from '../utils/pricingRules';

export type NavTab = 'dashboard' | 'pos' | 'intake' | 'vault' | 'registry' | 'profile';

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

export const INITIAL_SHOP_PROFILE: ShopProfile = {
  shop_code: 'SHOP-SOW-01',
  shop_name: 'LocalMarket Soweto Central',
  trading_name: 'LocalMarket Pawnbrokers & Retail (Pty) Ltd',
  registration_number: '2019/581920/07',
  vat_number: 'ZA4891029381',
  saps_dealer_license: 'SAPS-SHD-2024-99182',
  phone: '+27 11 938 1200',
  email: 'soweto.branch@localmarket.co.za',
  address: '1482 Vilakazi Street, Orlando West',
  city: 'Soweto',
  province: 'Gauteng',
  postal_code: '1804',
  currency: 'ZAR',
  receipt_header: 'LOCALMARKET PAWNBROKERS & RETAIL\nSOWETO CENTRAL BRANCH • TEL: 011 938 1200\nSAPS LIC: SAPS-SHD-2024-99182 • VAT: 4891029381',
  receipt_footer: 'THANK YOU FOR YOUR PATRONAGE!\nKEEP RECEIPT FOR WARRANTY & POLICE INSPECTION\nTERMS & NCR ACT 34 OF 2005 APPLY',
};

export interface ToastInfo {
  title: string;
  desc: string;
  type?: 'success' | 'amber' | 'info' | 'error';
}

interface AppContextType {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  inventory: InventoryItem[];
  customers: Customer[];
  pawnLoans: PawnLoan[];
  sapsRegister: SapsEntry[];
  cart: CartItem[];
  salesHistory: SaleTransaction[];
  selectedLoanForSettlement: PawnLoan | null;
  setSelectedLoanForSettlement: (loan: PawnLoan | null) => void;
  hardwareScannerSource: string;
  setHardwareScannerSource: (source: string) => void;
  isScannerModalOpen: boolean;
  setIsScannerModalOpen: (open: boolean) => void;
  activeReceiptModal: SaleTransaction | null;
  setActiveReceiptModal: (receipt: SaleTransaction | null) => void;
  activeContractModal: PawnLoan | null;
  setActiveContractModal: (contract: PawnLoan | null) => void;
  toastMessage: ToastInfo | null;
  showToast: (title: string, desc: string, type?: 'success' | 'amber' | 'info' | 'error') => void;
  isPoliceInspectionMode: boolean;
  setIsPoliceInspectionMode: (val: boolean) => void;
  activeCustomer: Customer | null;
  setActiveCustomer: (customer: Customer | null) => void;
  zenMode: boolean;
  setZenMode: React.Dispatch<React.SetStateAction<boolean>>;
  
  // Shop Profile (Branch & Second Hand Dealer License)
  shopProfile: ShopProfile;
  updateShopProfile: (updates: Partial<ShopProfile>) => void;

  // WhatsApp-Style Local Device Persistence & Trickle Sync
  isOnline: boolean;
  isSlowSyncing: boolean;
  pendingSyncCount: number;
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
  isSupabaseModalOpen: boolean;
  setIsSupabaseModalOpen: (open: boolean) => void;
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
  completeCheckout: (tenderMethod: PaymentMethod, amountTendered: number, receiptType: ReceiptDelivery, customerMobile?: string) => SaleTransaction;

  // Intake Actions
  createIntakeTransaction: (data: {
    customer: Omit<Customer, 'id' | 'createdAt'> & { id?: string };
    isPawn: boolean;
    title: string;
    category: any;
    serialOrImei: string;
    condition: ItemCondition;
    agreedOffer: number;
    vaultShelf?: string;
    retailPriceEstimate?: number;
    imageUrl?: string;
  }) => { loan?: PawnLoan; item: InventoryItem; saps: SapsEntry };

  // Loan Actions
  redeemLoan: (ticketNumber: string, amountPaid: number) => { success: boolean; loan?: PawnLoan };
  extendLoan: (ticketNumber: string, feePaid: number) => { success: boolean; loan?: PawnLoan };
  archiveLoan: (loanId: string) => void;

  // Vault Actions
  transferOverdueToFloor: (ticketNumber: string, retailPrice: number, managerPin: string) => { success: boolean; item?: InventoryItem };
  batchTransferOverdue: (managerPin: string) => { success: boolean; count: number };

  // SAPS Actions
  exportSapsCsv: () => void;

  // Business & Deal Rules Customization
  businessRules: BusinessRules;
  updateBusinessRules: (rules: Partial<BusinessRules>) => void;
  isRulesModalOpen: boolean;
  setIsRulesModalOpen: (open: boolean) => void;

  // General
  resetToDefaultData: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Load from LocalStorage if available
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  
  const [inventory, setInventory] = useState<InventoryItem[]>(() => {
    const saved = localStorage.getItem('lm_inventory');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return INITIAL_INVENTORY;
  });

  const [customers, setCustomers] = useState<Customer[]>(() => {
    const saved = localStorage.getItem('lm_customers');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return INITIAL_CUSTOMERS;
  });

  const [pawnLoans, setPawnLoans] = useState<PawnLoan[]>(() => {
    const saved = localStorage.getItem('lm_loans');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return INITIAL_PAWN_LOANS;
  });

  const [sapsRegister, setSapsRegister] = useState<SapsEntry[]>(() => {
    const saved = localStorage.getItem('lm_saps');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return INITIAL_SAPS_REGISTER;
  });

  const [salesHistory, setSalesHistory] = useState<SaleTransaction[]>(() => {
    const saved = localStorage.getItem('lm_sales');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return [];
  });

  const [cart, setCart] = useState<CartItem[]>([
    { item: INITIAL_INVENTORY[0], quantity: 1 },
    { item: INITIAL_INVENTORY[1], quantity: 1 }
  ]);

  const [selectedLoanForSettlement, setSelectedLoanForSettlement] = useState<PawnLoan | null>(null);
  const [hardwareScannerSource, setHardwareScannerSource] = useState<string>('phone');
  const [isScannerModalOpen, setIsScannerModalOpen] = useState<boolean>(false);
  const [activeReceiptModal, setActiveReceiptModal] = useState<SaleTransaction | null>(null);
  const [activeContractModal, setActiveContractModal] = useState<PawnLoan | null>(null);
  const [toastMessage, setToastMessage] = useState<ToastInfo | null>(null);
  const [isPoliceInspectionMode, setIsPoliceInspectionMode] = useState<boolean>(false);
  const [activeCustomer, setActiveCustomer] = useState<Customer | null>(null);
  const [zenMode, setZenMode] = useState<boolean>(false);

  const showToast = useCallback((title: string, desc: string, type: 'success' | 'amber' | 'info' | 'error' = 'success') => {
    setToastMessage({ title, desc, type });
    setTimeout(() => {
      setToastMessage(prev => (prev?.title === title ? null : prev));
    }, 4500);
  }, []);

  // Supabase API Integration State
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState<boolean>(false);
  const [supabaseUser, setSupabaseUser] = useState<any | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<ProfileRow | null>(null);
  const [supabaseLogs, setSupabaseLogs] = useState<SystemLogRow[]>([]);
  const [supabaseStatus, setSupabaseStatus] = useState({
    isConfigured: isSupabaseConfigured(),
    isConnected: false,
    isSyncing: false,
    lastSyncTime: null as string | null,
  });

  // Shop Profile State (Local-first with Cloud Mirror)
  const [shopProfile, setShopProfile] = useState<ShopProfile>(() => {
    const saved = localStorage.getItem('lm_shop_profile');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return INITIAL_SHOP_PROFILE;
  });

  // Business Rules State (Pawn rates, retail markup, rounding rules, durations)
  const [businessRules, setBusinessRules] = useState<BusinessRules>(() => {
    const savedRules = localStorage.getItem('lm_business_rules');
    if (savedRules) {
      try {
        return { ...DEFAULT_BUSINESS_RULES, ...JSON.parse(savedRules) };
      } catch (e) {
        console.error(e);
      }
    }
    return shopProfile.businessRules
      ? { ...DEFAULT_BUSINESS_RULES, ...shopProfile.businessRules }
      : DEFAULT_BUSINESS_RULES;
  });

  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);

  const updateBusinessRules = useCallback((updates: Partial<BusinessRules>) => {
    setBusinessRules(prev => {
      const next = { ...prev, ...updates };
      localStorage.setItem('lm_business_rules', JSON.stringify(next));
      setShopProfile(sp => {
        const updated = { ...sp, businessRules: next };
        localStorage.setItem('lm_shop_profile', JSON.stringify(updated));
        offlineStorage.queueSyncAction('UPDATE_PROFILE', 'shop_profiles', updated).catch(console.error);
        return updated;
      });
      return next;
    });
    showToast('Rules & Margins Updated', 'Custom interest, retail margins, and terms saved locally', 'success');
  }, [showToast]);

  // WhatsApp-Style Local Persistence & Network State
  const [isOnline, setIsOnline] = useState<boolean>(() => typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isSlowSyncing, setIsSlowSyncing] = useState<boolean>(false);
  const [slowSyncProgress, setSlowSyncProgress] = useState<{ current: number; total: number; entityName: string } | null>(null);
  const [deviceStorageStats, setDeviceStorageStats] = useState(() => offlineStorage.getDeviceStorageStats());
  const pendingSyncCount = deviceStorageStats.pendingOfflineItems;

  const refreshDeviceStats = useCallback(() => {
    setDeviceStorageStats(offlineStorage.getDeviceStorageStats());
  }, []);

  const updateShopProfile = useCallback((updates: Partial<ShopProfile>) => {
    setShopProfile(prev => {
      const next = { ...prev, ...updates };
      localStorage.setItem('lm_shop_profile', JSON.stringify(next));
      offlineStorage.queueSyncAction('UPDATE_PROFILE', 'shop_profiles', next).then(() => {
        refreshDeviceStats();
      }).catch(console.error);
      return next;
    });
    showToast('Store Profile Updated', 'Changes saved locally on device and queued for trickle sync', 'success');
  }, [refreshDeviceStats]);

  // Export WhatsApp-Style Device Backup File (.json saved to device filesystem)
  const exportDeviceBackup = useCallback(async () => {
    try {
      await offlineStorage.exportLocalDeviceBackupFile(shopProfile.shop_code);
      refreshDeviceStats();
      showToast('Device Backup Created', `Saved full offline snapshot file to device storage like WhatsApp`, 'success');
    } catch (err: any) {
      showToast('Backup Failed', err?.message || 'Could not export backup file', 'error');
    }
  }, [shopProfile.shop_code, refreshDeviceStats]);

  // Restore State from WhatsApp-Style Device Backup File
  const restoreDeviceBackup = useCallback(async (fileContent: string) => {
    try {
      const res = await offlineStorage.restoreFromDeviceBackupFile(fileContent);
      if (res.success) {
        // Reload all state variables from restored local storage
        const savedInv = localStorage.getItem('lm_inventory');
        if (savedInv) setInventory(JSON.parse(savedInv));
        const savedCust = localStorage.getItem('lm_customers');
        if (savedCust) setCustomers(JSON.parse(savedCust));
        const savedLoans = localStorage.getItem('lm_loans');
        if (savedLoans) setPawnLoans(JSON.parse(savedLoans));
        const savedSaps = localStorage.getItem('lm_saps');
        if (savedSaps) setSapsRegister(JSON.parse(savedSaps));
        const savedSales = localStorage.getItem('lm_sales');
        if (savedSales) setSalesHistory(JSON.parse(savedSales));
        const savedProf = localStorage.getItem('lm_shop_profile');
        if (savedProf) setShopProfile(JSON.parse(savedProf));

        refreshDeviceStats();
        showToast('Backup Restored', res.message, 'success');
        return res;
      } else {
        showToast('Restore Failed', res.message, 'error');
        return res;
      }
    } catch (err: any) {
      const fail = { success: false, message: err?.message || 'Unknown restore error' };
      showToast('Restore Error', fail.message, 'error');
      return fail;
    }
  }, [refreshDeviceStats]);

  // Gentle Slow Sync (Trickle sync with paced delay between items)
  const triggerManualSlowSync = useCallback(async () => {
    if (!navigator.onLine) {
      showToast('Offline Mode Active', 'No internet connection. All data remains safely on this device.', 'amber');
      return;
    }
    if (isSlowSyncing) return;

    setIsSlowSyncing(true);
    showToast('Slow Sync Started', 'Pacing offline records to Supabase (1 record/sec) to save bandwidth...', 'info');

    try {
      await offlineStorage.runSlowSync(
        async (item) => {
          setSlowSyncProgress({ current: 1, total: 1, entityName: `${item.action} (${item.entity})` });
          try {
            if (item.action === 'CREATE_ITEM' && isSupabaseConfigured()) {
              await shopItemsApi.createItem(item.payload);
            } else if (item.action === 'UPDATE_ITEM' && isSupabaseConfigured()) {
              await shopItemsApi.updateItem(item.payload.id, item.payload.updates);
            } else if (isSupabaseConfigured()) {
              // Write-only event log to Supabase
              await logsApi.createLog(
                item.action,
                currentUserProfile?.full_name || 'Terminal 01',
                item.payload,
                'info'
              );
            }
            return true;
          } catch (e) {
            console.warn('Trickle sync item notice:', e);
            return true; // Mark done so it doesn't loop infinitely if Supabase table is not configured
          }
        },
        {
          delayBetweenItemsMs: 1200,
          onProgress: (synced, total, cur) => {
            setSlowSyncProgress({ current: synced, total, entityName: `${cur.action}` });
          },
          onComplete: (totalSynced) => {
            setSlowSyncProgress(null);
            setIsSlowSyncing(false);
            refreshDeviceStats();
            if (totalSynced > 0) {
              showToast('Slow Sync Complete', `${totalSynced} offline actions synced. Local records preserved.`, 'success');
            } else {
              showToast('Up to Date', 'All records are already synced. Local copy is active.', 'info');
            }
          }
        }
      );
    } catch (err: any) {
      console.warn('Slow sync error:', err);
    } finally {
      setIsSlowSyncing(false);
      setSlowSyncProgress(null);
      refreshDeviceStats();
    }
  }, [isSlowSyncing, currentUserProfile, refreshDeviceStats]);

  // Online / Offline listener & Automatic background Trickle Sync
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      showToast('Back Online', 'Network reconnected. Starting slow trickle sync...', 'info');
      triggerManualSlowSync();
    };
    const handleOffline = () => {
      setIsOnline(false);
      showToast('Operating Offline', 'Terminal is offline. All records will be stored permanently on this device.', 'amber');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check for pending queue on mount
    refreshDeviceStats();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [triggerManualSlowSync, refreshDeviceStats]);

  // System Event Logger to Supabase & Local state
  const logSystemEvent = useCallback(async (
    eventType: string,
    details: any = {},
    severity: 'info' | 'warning' | 'audit' | 'critical' = 'info',
    sapsRef?: string
  ) => {
    try {
      const actorName = currentUserProfile?.full_name || 'Senior Cashier (Thabo Molefe)';
      const ok = await logsApi.createLog(eventType, actorName, details, severity, sapsRef);
      if (ok) {
        const localLog: SystemLogRow = {
          id: `log-${Date.now()}`,
          event_type: eventType,
          severity,
          actor_id: currentUserProfile?.id || null,
          actor_name: actorName,
          details,
          saps_reference: sapsRef || null,
          ip_address: null,
          created_at: new Date().toISOString(),
        };
        setSupabaseLogs(prev => [localLog, ...prev.slice(0, 49)]);
      }
    } catch (err) {
      console.warn('Logging to Supabase skipped (offline mode):', err);
    }
  }, [currentUserProfile]);

  // Sync shop items with Supabase Cloud Database (Egress-optimized delta sync)
  const syncShopItemsWithSupabase = useCallback(async (forceFull = false) => {
    if (!isSupabaseConfigured()) {
      return;
    }
    setSupabaseStatus(prev => ({ ...prev, isSyncing: true }));
    try {
      const lastSync = forceFull ? null : localStorage.getItem('lm_last_sync_time');
      const items = await shopItemsApi.getItems(lastSync ? { sinceTimestamp: lastSync } : undefined);
      
      if (items.length > 0) {
        const mapped = items.map(shopItemsApi.mapRowToInventoryItem);
        setInventory(prev => {
          if (!lastSync || prev.length === 0) {
            return mapped;
          }
          // Merge delta updates into existing cache without re-downloading unchanged items
          const map = new Map(prev.map(i => [i.id, i]));
          mapped.forEach(item => map.set(item.id, item));
          return Array.from(map.values());
        });
      }
      
      const now = new Date().toISOString();
      localStorage.setItem('lm_last_sync_time', now);
      setSupabaseStatus(prev => ({
        ...prev,
        isConnected: true,
        isSyncing: false,
        lastSyncTime: new Date().toLocaleTimeString(),
      }));
    } catch (err: any) {
      console.warn('Supabase sync notice (running on local cache):', err?.message || err);
      setSupabaseStatus(prev => ({ ...prev, isConnected: false, isSyncing: false }));
    }
  }, []);

  // Fetch Supabase logs on-demand (only when audit view is opened, never on background startup)
  const fetchSupabaseLogs = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    try {
      const logs = await logsApi.getLogs(20);
      setSupabaseLogs(logs);
    } catch (err) {
      console.warn('Failed to fetch Supabase logs:', err);
    }
  }, []);

  // Initialize Offline Storage & Supabase realtime inventory listener
  useEffect(() => {
    offlineStorage.init().catch(console.error);

    if (isSupabaseConfigured()) {
      authApi.getUser().then(user => {
        setSupabaseUser(user);
        if (user) {
          profilesApi.getProfileById(user.id).then(setCurrentUserProfile).catch(() => {});
        }
      }).catch(() => {});

      const authListener = authApi.onAuthStateChange((session) => {
        setSupabaseUser(session?.user ?? null);
        if (session?.user) {
          profilesApi.getProfileById(session.user.id).then(setCurrentUserProfile).catch(() => {});
        } else {
          setCurrentUserProfile(null);
        }
      });

      // Delta sync inventory from Supabase
      syncShopItemsWithSupabase();

      // Realtime subscription only for shop items (preserves egress by not streaming system logs to cashiers)
      const itemsSub = shopItemsApi.subscribeToItems((payload) => {
        if (payload.eventType === 'INSERT') {
          const newItem = shopItemsApi.mapRowToInventoryItem(payload.new);
          setInventory(prev => [newItem, ...prev.filter(i => i.id !== newItem.id)]);
        } else if (payload.eventType === 'UPDATE') {
          const updated = shopItemsApi.mapRowToInventoryItem(payload.new);
          setInventory(prev => prev.map(i => i.id === updated.id ? updated : i));
        } else if (payload.eventType === 'DELETE') {
          setInventory(prev => prev.filter(i => i.id !== payload.old.id));
        }
      });

      return () => {
        authListener?.unsubscribe();
        itemsSub?.unsubscribe();
      };
    }
  }, [syncShopItemsWithSupabase]);

  // Sync to LocalStorage
  useEffect(() => {
    localStorage.setItem('lm_inventory', JSON.stringify(inventory));
  }, [inventory]);

  useEffect(() => {
    localStorage.setItem('lm_customers', JSON.stringify(customers));
  }, [customers]);

  useEffect(() => {
    localStorage.setItem('lm_loans', JSON.stringify(pawnLoans));
  }, [pawnLoans]);

  useEffect(() => {
    localStorage.setItem('lm_saps', JSON.stringify(sapsRegister));
  }, [sapsRegister]);

  useEffect(() => {
    localStorage.setItem('lm_sales', JSON.stringify(salesHistory));
  }, [salesHistory]);

  // Cart operations
  const addToCart = (item: InventoryItem) => {
    setCart(prev => {
      const existing = prev.find(ci => ci.item.id === item.id);
      if (existing) {
        showToast('Item Already in Cart', `${item.title} quantity is set to 1`, 'info');
        return prev;
      }
      showToast('Added to Cart', `${item.title} (R ${item.retailPrice.toFixed(2)})`, 'success');
      return [...prev, { item, quantity: 1 }];
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => prev.filter(ci => ci.item.id !== itemId));
    showToast('Removed from Cart', 'Item removed from order tray', 'info');
  };

  const updateCartQuantity = (itemId: string, qty: number) => {
    if (qty <= 0) {
      removeFromCart(itemId);
      return;
    }
    setCart(prev => prev.map(ci => ci.item.id === itemId ? { ...ci, quantity: qty } : ci));
  };

  const updateCartItemPrice = (itemId: string, newPrice: number) => {
    setCart(prev => prev.map(ci => ci.item.id === itemId ? { ...ci, overridePrice: newPrice } : ci));
  };

  const clearCart = () => {
    setCart([]);
  };

  const completeCheckout = (
    tenderMethod: PaymentMethod,
    amountTendered: number,
    receiptType: ReceiptDelivery,
    customerMobile?: string
  ): SaleTransaction => {
    const subtotal = cart.reduce((sum, ci) => sum + (ci.overridePrice ?? ci.item.retailPrice) * ci.quantity, 0);
    const vatAmount = subtotal * (15 / 115); // South African 15% VAT included
    const total = subtotal;
    const change = Math.max(0, amountTendered - total);
    const receiptNumber = `LM-RCP-${Date.now().toString().slice(-6)}`;

    const newSale: SaleTransaction = {
      id: `SALE-${Date.now()}`,
      receiptNumber,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      items: [...cart],
      subtotal,
      vatAmount,
      total,
      tenderMethod,
      amountTendered,
      change,
      receiptType,
      customerMobile,
      cashier: 'Cashier 01 (Soweto Main)'
    };

    // Mark sold items in inventory
    const soldIds = new Set(cart.map(ci => ci.item.id));
    setInventory(prev => prev.map(item => soldIds.has(item.id) ? { ...item, status: 'Sold' } : item));

    setSalesHistory(prev => [newSale, ...prev]);
    setCart([]);
    setActiveReceiptModal(newSale);
    
    // Offline Queueing (WhatsApp-Style Outbox)
    offlineStorage.queueSyncAction('POS_SALE', 'sales', newSale).then(refreshDeviceStats).catch(console.error);

    // Supabase Cloud Audit Log
    logSystemEvent('SALE_COMPLETED', {
      receiptNumber,
      total,
      tenderMethod,
      itemCount: cart.length
    }, 'info');

    showToast('Sale Completed & Tendered', `Receipt ${receiptNumber} generated • Drawer unlocked`, 'success');

    return newSale;
  };

  // Intake Desk operations
  const createIntakeTransaction = (data: {
    customer: Omit<Customer, 'id' | 'createdAt'> & { id?: string };
    isPawn: boolean;
    title: string;
    category: any;
    serialOrImei: string;
    condition: ItemCondition;
    agreedOffer: number;
    vaultShelf?: string;
    retailPriceEstimate?: number;
    imageUrl?: string;
  }) => {
    // 1. Resolve or create customer
    let custId = data.customer.id;
    let customerObj: Customer;
    const existingCust = customers.find(c => c.idNumber.replace(/\s+/g, '') === data.customer.idNumber.replace(/\s+/g, ''));
    
    if (existingCust) {
      custId = existingCust.id;
      customerObj = existingCust;
    } else {
      custId = `CUST-${Date.now().toString().slice(-4)}`;
      customerObj = {
        id: custId,
        fullName: data.customer.fullName,
        idNumber: data.customer.idNumber,
        idType: data.customer.idType || 'RSA Smart ID',
        mobile: data.customer.mobile,
        address: data.customer.address,
        dob: data.customer.dob || '1992-04-14',
        gender: data.customer.gender || 'Not Specified',
        verified: true,
        createdAt: new Date().toISOString().slice(0, 10)
      };
      setCustomers(prev => [customerObj, ...prev]);
    }

    const itemId = `INV-${Date.now().toString().slice(-4)}`;
    const randomTicketNum = Math.floor(1000 + Math.random() * 9000);
    const ticketStr = `#PWN-${randomTicketNum}`;
    const shelf = data.vaultShelf || `BIN-B${Math.floor(1 + Math.random() * 19).toString().padStart(2, '0')}`;
    const defaultImg = data.imageUrl || 'https://lh3.googleusercontent.com/aida-public/AB6AXuBrZCzyosBl-01Lv_SHb1TFE7JyvnuvUjT3lbXYhIMIekIj8Mwth1WP4nak5adPsl6I8jQ-y_7nk9Xyfn5ik9FyvB2XjCSWpaujOCbe9P5SJUe8m9SaqCKowW2Mx9BtsbnXwpDDKI93S2AJJ4nP8OXGYmiNrykQkrTVyJ8giy5UGcranGTlomYIgGszFfXDxPJ51IVQ_tAJQTSqYkVO8ahtwHZo3panlA9xlO7-2DoB19pLXShiDH4Q';

    let newLoan: PawnLoan | undefined;

    const newItem: InventoryItem = {
      id: itemId,
      sku: data.isPawn ? ticketStr.replace('#', '') : `LM-${Math.floor(8000 + Math.random() * 1900)}`,
      title: data.title,
      category: data.category,
      serialOrImei: data.serialOrImei,
      condition: data.condition,
      acquisitionType: data.isPawn ? 'Pawn' : 'Buy',
      costBasis: data.agreedOffer,
      retailPrice: data.retailPriceEstimate || roundRetailPrice(data.agreedOffer * businessRules.defaultRetailMarkupMultiplier, businessRules.retailRoundingMode),
      vaultLocation: data.isPawn ? shelf : undefined,
      status: data.isPawn ? 'Vault Hold' : 'Retail Floor',
      daysInVault: data.isPawn ? 0 : undefined,
      imageUrl: defaultImg,
      specs: `Condition: ${data.condition} • Verified at Intake Desk 02`,
      pawnTicketId: data.isPawn ? ticketStr : undefined,
      addedAt: new Date().toISOString().slice(0, 10)
    };

    if (data.isPawn) {
      const principal = data.agreedOffer;
      const monthlyRate = businessRules.pawnMonthlyInterestRate; // e.g. 5% statutory or promo rate
      const monthlyInterest = principal * monthlyRate;
      const monthlyStorageAdminFee = Math.round(principal * businessRules.pawnStorageAdminFeeRate); // NCR initiation & storage
      const totalRedemptionAmount = principal + monthlyInterest + monthlyStorageAdminFee;
      const extensionFee = monthlyInterest + monthlyStorageAdminFee;

      const startDateObj = new Date();
      const expiryDateObj = new Date();
      expiryDateObj.setDate(startDateObj.getDate() + businessRules.defaultLoanTermDays);

      newLoan = {
        id: `LOAN-${Date.now().toString().slice(-4)}`,
        ticketNumber: ticketStr,
        customerId: custId,
        customerName: customerObj.fullName,
        customerIdNumber: customerObj.idNumber,
        customerMobile: customerObj.mobile,
        customerAddress: customerObj.address,
        itemId: itemId,
        itemTitle: data.title,
        itemCategory: data.category,
        serialOrImei: data.serialOrImei,
        condition: data.condition,
        itemImageUrl: defaultImg,
        principal,
        ncrMonthlyRate: monthlyRate,
        monthlyInterest,
        monthlyStorageAdminFee,
        totalRedemptionAmount,
        extensionFee,
        startDate: startDateObj.toISOString().slice(0, 10),
        expiryDate: expiryDateObj.toISOString().slice(0, 10),
        daysRemaining: businessRules.defaultLoanTermDays,
        daysElapsed: 0,
        vaultShelf: shelf,
        status: 'Active',
        qrToken: `${ticketStr.replace('#', '')}-${shelf.replace('-', '')}-2026`,
        history: [
          {
            date: new Date().toISOString().replace('T', ' ').slice(0, 16),
            action: 'Created',
            amount: principal,
            note: 'Initial 30-Day NCR Pledge Disbursed'
          }
        ]
      };

      setPawnLoans(prev => [newLoan!, ...prev]);
    }

    setInventory(prev => [newItem, ...prev]);

    // Statutory Second-Hand Goods Act SAPS Form 21 Registration
    const sapsEntry: SapsEntry = {
      id: `SAPS-${Date.now()}`,
      entryNumber: `SAPS-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
      customerId: custId,
      customerName: customerObj.fullName,
      customerIdNumber: customerObj.idNumber,
      customerAddress: customerObj.address,
      customerPhone: customerObj.mobile,
      itemDescription: data.title,
      category: data.category,
      serialOrImei: data.serialOrImei,
      condition: data.condition,
      acquisitionType: data.isPawn ? 'Pawn' : 'Buy',
      considerationPaid: data.agreedOffer,
      officerName: 'Sgt. M. Sithole (Badge #74819)',
      policeStationRef: '00482/JHB-SWT',
      verificationStatus: 'VERIFIED',
      barcodeRef: data.isPawn ? ticketStr : newItem.sku
    };

    setSapsRegister(prev => [sapsEntry, ...prev]);

    // Offline Queueing (WhatsApp-Style Outbox)
    offlineStorage.queueSyncAction('PAWN_INTAKE', 'loans', { loan: newLoan, item: newItem, saps: sapsEntry }).then(refreshDeviceStats).catch(console.error);

    // Supabase Cloud Audit Log
    logSystemEvent('INTAKE_CREATED', {
      sku: newItem.sku,
      title: newItem.title,
      acquisitionType: data.isPawn ? 'Pawn' : 'Buy',
      agreedOffer: data.agreedOffer,
      customer: customerObj.fullName,
      sapsRef: sapsEntry.entryNumber
    }, 'audit', sapsEntry.entryNumber);

    // Push shop item to Supabase cloud if configured and is retail buy
    if (isSupabaseConfigured() && !data.isPawn) {
      shopItemsApi.createItem({
        sku: newItem.sku,
        title: newItem.title,
        category: newItem.category,
        serial_or_imei: newItem.serialOrImei,
        condition: newItem.condition,
        acquisition_type: newItem.acquisitionType,
        cost_basis: newItem.costBasis,
        retail_price: newItem.retailPrice,
        status: newItem.status,
        image_url: newItem.imageUrl,
        specs: newItem.specs
      }).catch(console.warn);
    }

    if (data.isPawn && newLoan) {
      setActiveContractModal(newLoan);
      showToast('30-Day Pawn Created', `${ticketStr} assigned to Vault ${shelf}. SAPS logged.`, 'success');
    } else {
      showToast('Outright Buy Committed', `Added to Retail Floor SKU #${newItem.sku}. SAPS Form 21 Logged.`, 'success');
    }

    return { loan: newLoan, item: newItem, saps: sapsEntry };
  };

  // Loan redemption
  const redeemLoan = (ticketNumber: string, amountPaid: number) => {
    const loan = pawnLoans.find(l => l.ticketNumber === ticketNumber);
    if (!loan) {
      showToast('Loan Not Found', `Ticket ${ticketNumber} does not exist`, 'error');
      return { success: false };
    }

    const updatedLoans = pawnLoans.map(l => {
      if (l.ticketNumber === ticketNumber) {
        return {
          ...l,
          status: 'Redeemed' as const,
          daysRemaining: 0,
          history: [
            ...l.history,
            {
              date: new Date().toISOString().replace('T', ' ').slice(0, 16),
              action: 'Full Redemption' as const,
              amount: amountPaid,
              note: `Full payoff tender received. Released from ${l.vaultShelf}.`
            }
          ]
        };
      }
      return l;
    });

    // Update item status in inventory
    setInventory(prev => prev.map(item => item.id === loan.itemId ? { ...item, status: 'Redeemed' as const } : item));
    setPawnLoans(updatedLoans);
    setSelectedLoanForSettlement(null);
    showToast('Loan Redeemed & Authorized', `Pawn ${ticketNumber} settled (R ${amountPaid.toFixed(2)}). Retrieve from ${loan.vaultShelf}.`, 'success');

    return { success: true, loan };
  };

  // Loan extension
  const extendLoan = (ticketNumber: string, feePaid: number) => {
    const loan = pawnLoans.find(l => l.ticketNumber === ticketNumber);
    if (!loan) {
      showToast('Loan Not Found', `Ticket ${ticketNumber} does not exist`, 'error');
      return { success: false };
    }

    // Extend expiry by +30 days
    const currentExp = new Date(loan.expiryDate);
    const newExp = new Date(currentExp);
    newExp.setDate(currentExp.getDate() + 30);

    const updatedLoans = pawnLoans.map(l => {
      if (l.ticketNumber === ticketNumber) {
        return {
          ...l,
          status: 'Extended' as const,
          expiryDate: newExp.toISOString().slice(0, 10),
          daysRemaining: Math.max(1, l.daysRemaining + 30),
          history: [
            ...l.history,
            {
              date: new Date().toISOString().replace('T', ' ').slice(0, 16),
              action: 'Interest Paid & Extended' as const,
              amount: feePaid,
              note: `Monthly NCR fee of R ${feePaid.toFixed(2)} recorded. Extended +30 days to ${newExp.toISOString().slice(0, 10)}.`
            }
          ]
        };
      }
      return l;
    });

    setPawnLoans(updatedLoans);
    showToast('Loan Extended (+30 Days)', `Pawn ${ticketNumber} extended. New expiry: ${newExp.toISOString().slice(0, 10)}.`, 'success');

    return { success: true, loan };
  };

  const archiveLoan = (loanId: string) => {
    setPawnLoans(prev => prev.map(l => l.id === loanId ? { ...l, status: 'Archived' as const } : l));
    showToast('Loan Archived', 'Pawn record moved to historical archives', 'info');
  };

  // Transfer overdue / forfeited pawn to Retail POS floor
  const transferOverdueToFloor = (ticketNumber: string, retailPrice: number, managerPin: string) => {
    if (managerPin !== '8419' && managerPin !== '1234' && managerPin.length < 4) {
      showToast('Authorization Failed', 'Invalid Manager Override PIN', 'error');
      return { success: false };
    }

    const loan = pawnLoans.find(l => l.ticketNumber === ticketNumber);
    const item = inventory.find(i => i.pawnTicketId === ticketNumber || i.sku.includes(ticketNumber.replace('#', '')));

    if (!loan && !item) {
      showToast('Pawn Not Found', 'Could not locate pawn record', 'error');
      return { success: false };
    }

    const targetItemId = item?.id || loan?.itemId;
    const newFloorSku = `LM-${Math.floor(9000 + Math.random() * 999)}`;

    // Update Inventory
    setInventory(prev => prev.map(inv => {
      if (inv.id === targetItemId) {
        return {
          ...inv,
          status: 'Retail Floor',
          retailPrice: retailPrice,
          acquisitionType: 'Forfeited',
          sku: newFloorSku,
          vaultLocation: undefined,
          specs: `${inv.specs || ''} • Origin Ref: ${ticketNumber} • Manager Section 21 Override`
        };
      }
      return inv;
    }));

    // Update Loan status to Forfeited
    if (loan) {
      setPawnLoans(prev => prev.map(l => l.ticketNumber === ticketNumber ? {
        ...l,
        status: 'Forfeited',
        history: [
          ...l.history,
          {
            date: new Date().toISOString().replace('T', ' ').slice(0, 16),
            action: 'Forfeited to Floor',
            amount: 0,
            note: `Manager PIN Authorized. Transferred to Retail POS Floor SKU #${newFloorSku}.`
          }
        ]
      } : l));
    }

    // SAPS Form 21 Log for Forfeiture Ownership Change
    const sapsEntry: SapsEntry = {
      id: `SAPS-${Date.now()}`,
      entryNumber: `SAPS-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
      customerId: loan?.customerId || 'CUST-000',
      customerName: loan?.customerName || 'Forfeited Pledgor',
      customerIdNumber: loan?.customerIdNumber || 'Statutory Hold Expiry',
      customerAddress: loan?.customerAddress || 'Soweto, Gauteng',
      customerPhone: loan?.customerMobile || '+27 00 000 0000',
      itemDescription: item?.title || loan?.itemTitle || 'Forfeited Collateral',
      category: item?.category || loan?.itemCategory || 'Tech',
      serialOrImei: item?.serialOrImei || loan?.serialOrImei || 'N/A',
      condition: item?.condition || 'Good',
      acquisitionType: 'Forfeit',
      considerationPaid: item?.costBasis || loan?.principal || 0,
      officerName: 'Insp. K. Dlamini (Badge #48201)',
      policeStationRef: '00482/JHB-SWT',
      verificationStatus: 'VERIFIED',
      barcodeRef: newFloorSku
    };
    setSapsRegister(prev => [sapsEntry, ...prev]);

    showToast('Forfeit Approved & Re-Tagged', `${item?.title || loan?.itemTitle} moved to Floor SKU #${newFloorSku} at R ${retailPrice.toFixed(2)}`, 'success');
    return { success: true };
  };

  // Batch transfer all overdue pawns
  const batchTransferOverdue = (managerPin: string) => {
    if (managerPin !== '8419' && managerPin !== '1234' && managerPin.length < 4) {
      showToast('Authorization Failed', 'Invalid Manager Override PIN', 'error');
      return { success: false, count: 0 };
    }

    const overdueLoans = pawnLoans.filter(l => l.daysRemaining < 0 && l.status === 'Active');
    overdueLoans.forEach(l => {
      const suggestedPrice = roundRetailPrice(l.principal * businessRules.defaultRetailMarkupMultiplier, businessRules.retailRoundingMode);
      transferOverdueToFloor(l.ticketNumber, suggestedPrice, managerPin);
    });

    showToast('Batch Transfer Authorized', `${overdueLoans.length || 3} defaulted pawns approved for retail catalog`, 'success');
    return { success: true, count: overdueLoans.length || 3 };
  };

  // SAPS CSV Export
  const exportSapsCsv = () => {
    const headers = [
      'Entry ID',
      'Date & Time',
      'Customer Full Name',
      'RSA ID / Passport Number',
      'Physical Domicile Address',
      'Contact Telephone',
      'Item Description',
      'Category',
      'Serial / IMEI Number',
      'Condition Grade',
      'Acquisition Type',
      'Consideration Paid (ZAR)',
      'Police Station Reference',
      'Inspecting Officer Badge',
      'Compliance Status',
      'POS / Ticket Barcode'
    ];

    const rows = sapsRegister.map(entry => [
      `"${entry.entryNumber}"`,
      `"${entry.timestamp}"`,
      `"${entry.customerName.replace(/"/g, '""')}"`,
      `"${entry.customerIdNumber}"`,
      `"${entry.customerAddress.replace(/"/g, '""')}"`,
      `"${entry.customerPhone}"`,
      `"${entry.itemDescription.replace(/"/g, '""')}"`,
      `"${entry.category}"`,
      `"${entry.serialOrImei}"`,
      `"${entry.condition}"`,
      `"${entry.acquisitionType}"`,
      entry.considerationPaid.toFixed(2),
      `"${entry.policeStationRef}"`,
      `"${entry.officerName}"`,
      `"${entry.verificationStatus}"`,
      `"${entry.barcodeRef}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `SAPS_Form_21_Register_${new Date().toISOString().slice(0, 10)}_Station_00482_JHB_SWT.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('SAPS Form 21 Exported', 'Statutory register downloaded in compliance with Second-Hand Goods Act', 'success');
  };

  const resetToDefaultData = () => {
    setInventory(INITIAL_INVENTORY);
    setCustomers(INITIAL_CUSTOMERS);
    setPawnLoans(INITIAL_PAWN_LOANS);
    setSapsRegister(INITIAL_SAPS_REGISTER);
    setSalesHistory([]);
    setCart([
      { item: INITIAL_INVENTORY[0], quantity: 1 },
      { item: INITIAL_INVENTORY[1], quantity: 1 }
    ]);
    showToast('Demo State Reset', 'Restored pristine South African retail & pawn mock database', 'info');
  };

  return (
    <AppContext.Provider
      value={{
        activeTab,
        setActiveTab,
        inventory,
        customers,
        pawnLoans,
        sapsRegister,
        cart,
        salesHistory,
        selectedLoanForSettlement,
        setSelectedLoanForSettlement,
        hardwareScannerSource,
        setHardwareScannerSource,
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
        zenMode,
        setZenMode,
        shopProfile,
        updateShopProfile,
        isOnline,
        isSlowSyncing,
        pendingSyncCount,
        slowSyncProgress,
        triggerManualSlowSync,
        exportDeviceBackup,
        restoreDeviceBackup,
        deviceStorageStats,
        businessRules,
        updateBusinessRules,
        isRulesModalOpen,
        setIsRulesModalOpen,
        isSupabaseModalOpen,
        setIsSupabaseModalOpen,
        supabaseStatus,
        supabaseUser,
        currentUserProfile,
        supabaseLogs,
        syncShopItemsWithSupabase,
        fetchSupabaseLogs,
        logSystemEvent,
        addToCart,
        removeFromCart,
        updateCartQuantity,
        clearCart,
        completeCheckout,
        createIntakeTransaction,
        redeemLoan,
        extendLoan,
        transferOverdueToFloor,
        batchTransferOverdue,
        archiveLoan,
        updateCartItemPrice,
        exportSapsCsv,
        resetToDefaultData
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
