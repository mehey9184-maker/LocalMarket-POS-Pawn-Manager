import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
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
import { useInventory } from './InventoryContext';
import { useLoans } from './LoanContext';
import { useCustomers } from './CustomerContext';
import { useSales } from './SalesContext';
import { useSaps } from './SapsContext';

export type NavTab = 'landing' | 'auth' | 'home' | 'sell' | 'buy-pawn' | 'inventory' | 'customers' | 'profile';

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
  const [activeTab, setActiveTab] = useState<NavTab>('landing');
  const [cart, setCart] = useState<CartItem[]>([]);
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

  // Shop Profile State
  const [shopProfile, setShopProfile] = useState<ShopProfile>(() => {
    const saved = localStorage.getItem('lm_shop_profile');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return INITIAL_SHOP_PROFILE;
  });

  // Business Rules State
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

  // Consume Domain Contexts
  const { inventory } = useInventory();
  const { loans: pawnLoans } = useLoans();
  const { customers } = useCustomers();
  const { salesHistory, recordSale } = useSales();
  const { sapsEntries: sapsRegister, exportSapsCsv } = useSaps();

  const total = useMemo(() => {
    return cart.reduce((sum, ci) => sum + (ci.overridePrice ?? ci.item.retailPrice) * ci.quantity, 0);
  }, [cart]);

  const updateBusinessRules = useCallback((updates: Partial<BusinessRules>) => {
    setBusinessRules(prev => {
      const next = { ...prev, ...updates };
      localStorage.setItem('lm_business_rules', JSON.stringify(next));
      setShopProfile(sp => {
        const updated = { ...sp, businessRules: next };
        localStorage.setItem('lm_shop_profile', JSON.stringify(updated));
        return updated;
      });
      return next;
    });
    showToast('Rules & Margins Updated', 'Custom interest, retail margins, and terms saved locally', 'success');
  }, [showToast]);

  const updateShopProfile = useCallback((updates: Partial<ShopProfile>) => {
    setShopProfile(prev => {
      const next = { ...prev, ...updates };
      localStorage.setItem('lm_shop_profile', JSON.stringify(next));
      return next;
    });
    showToast('Store Profile Updated', 'Changes saved locally on device', 'success');
  }, [showToast]);

  // Auth Effects
  useEffect(() => {
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

      return () => {
        authListener?.unsubscribe();
      };
    }
  }, []);

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

  return (
    <AppContext.Provider
      value={{
        activeTab,
        setActiveTab,
        cart,
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
        logSystemEvent,
        addToCart,
        removeFromCart,
        updateCartQuantity,
        updateCartItemPrice,
        clearCart,
        // Specialized domain data aggregated into AppContext for backward compatibility
        inventory,
        customers,
        pawnLoans,
        sapsRegister,
        salesHistory,
        syncShopItemsWithSupabase: async () => {},
        fetchSupabaseLogs: async () => {},
        completeCheckout: useCallback((tenderMethod: PaymentMethod, amountTendered: number, receiptType: ReceiptDelivery, customerMobile?: string) => {
          const subtotal = total;
          const vatAmount = total * 0.15;
          const sale: Omit<SaleTransaction, 'id'> = {
            receiptNumber: `RCPT-${Math.floor(Math.random() * 90000 + 10000)}`,
            timestamp: new Date().toISOString(),
            items: [...cart],
            subtotal,
            vatAmount,
            total,
            tenderMethod,
            amountTendered,
            change: Math.max(0, amountTendered - total),
            receiptType,
            customerMobile,
            cashier: currentUserProfile?.full_name || 'System Operator'
          };
          recordSale(sale);
          const finalSale = { ...sale, id: crypto.randomUUID() };
          setActiveReceiptModal(finalSale as any);
          setCart([]);
          showToast('Sale Complete', `Receipt ${finalSale.receiptNumber} generated`, 'success');
          return finalSale as any;
        }, [cart, total, recordSale, currentUserProfile, showToast]),
        createIntakeTransaction: () => ({} as any),
        redeemLoan: () => ({} as any),
        extendLoan: () => ({} as any),
        transferOverdueToFloor: () => ({} as any),
        batchTransferOverdue: () => ({} as any),
        archiveLoan: () => {},
        exportSapsCsv: () => {},
        resetToDefaultData: () => {},
        isOnline: true,
        isSlowSyncing: false,
        pendingSyncCount: 0,
        slowSyncProgress: null,
        triggerManualSlowSync: async () => {},
        exportDeviceBackup: async () => {},
        restoreDeviceBackup: async () => ({ success: false, message: '' }),
        deviceStorageStats: { totalItems: 0, totalSales: 0, pendingOfflineItems: 0, lastBackupTime: null, estimatedLocalSizeKb: 0 }
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
