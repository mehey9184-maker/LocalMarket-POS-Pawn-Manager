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
import { useSellers } from './SellerContext';
import { useSales } from './SalesContext';
import { useSaps } from './SapsContext';
import { useSync } from './SyncContext';
import { useAuth } from './AuthContext';
import { db } from '../db';

export type NavTab = 'landing' | 'auth' | 'home' | 'sell' | 'buy-pawn' | 'inventory' | 'customers' | 'profile' | 'vault';

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
  saps_dealer_license: 'SAPS-SHG-2024-8842',
  phone: '+27 (0)11 938 4100',
  email: 'soweto@localmarketpos.co.za',
  address: 'Shop 42, Vilakazi Precinct, Soweto, Johannesburg',
  city: 'Johannesburg',
  province: 'Gauteng',
  postal_code: '1804',
  currency: 'ZAR',
  receipt_header: 'LOCALMARKET POS & PAWN BROKERS\nVAT REG: ZA4891029381 | SAPS LIC: SHG-2024-8842',
  receipt_footer: 'THANK YOU FOR YOUR BUSINESS\nGoods sold as second-hand under SHG Act 06 of 2009\n7-Day Store Warranty with original slip'
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
  hardwareScannerSource: string;
  setHardwareScannerSource: (val: string) => void;
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
  completeCheckout: (tenderMethod: PaymentMethod, amountTendered: number, receiptType: ReceiptDelivery, customerMobile?: string) => Promise<SaleTransaction>;
  processRefund: (receiptNumber: string, itemId: string, reason: string) => Promise<boolean>;

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
  }) => Promise<{ loan?: PawnLoan; item: InventoryItem; saps: SapsEntry }>;

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
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState<boolean>(false);
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
  const { inventory, addItem, updateItem } = useInventory();
  const { 
    loans: pawnLoans, 
    createLoan,
    redeemLoan, 
    extendLoan, 
    transferOverdueToFloor, 
    batchTransferOverdue, 
    archiveLoan 
  } = useLoans();
  const { customers, addCustomer } = useCustomers();
  const { addSeller, addSellerTransaction } = useSellers();
  const { salesHistory, completeAtomicCheckout, requestRefund, approveRefund } = useSales();
  const { sapsEntries: sapsRegister, addSapsEntry, exportSapsCsv } = useSaps();
  const { syncStatus, triggerSync, queueSyncAction } = useSync();

  const total = useMemo(() => {
    return cart.reduce((sum, ci) => sum + (ci.overridePrice ?? ci.item.retailPrice) * ci.quantity, 0);
  }, [cart]);

  const updateBusinessRules = useCallback(async (updates: Partial<BusinessRules>, reason?: string) => {
    const nextRules = { ...businessRules, ...updates };
    setBusinessRules(nextRules);
    localStorage.setItem('lm_business_rules', JSON.stringify(nextRules));
    
    setShopProfile(sp => {
      const updated = { ...sp, businessRules: nextRules };
      localStorage.setItem('lm_shop_profile', JSON.stringify(updated));
      return updated;
    });

    if (currentUserProfile?.shop_id && currentUserProfile.role === 'owner') {
      try {
        const res = await shopProfilesApi.updateShopBusinessRulesRpc(nextRules, reason);
        if (res.success) {
          showToast('Settings Persisted', 'Business rules updated and audited on server.', 'success');
        } else {
          showToast('Sync Warning', 'Local settings saved but server update failed.', 'amber');
        }
      } catch (err) {
        console.error('Failed to sync business rules:', err);
      }
    } else {
      showToast('Settings Saved', 'Local business rules updated.', 'success');
    }
  }, [businessRules, currentUserProfile, showToast]);

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
    if (currentUserProfile?.shop_id) {
      shopProfilesApi.getShopById(currentUserProfile.shop_id).then(shop => {
        if (shop) {
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
          setShopProfile(mappedShop);
          localStorage.setItem('lm_shop_profile', JSON.stringify(mappedShop));
          
          if (serverRules) {
            setBusinessRules(prev => ({ ...prev, ...serverRules }));
            localStorage.setItem('lm_business_rules', JSON.stringify(serverRules));
          }
        }
      });
    }
  }, [currentUserProfile]);

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
    const subtotal = total;
    const vatAmount = total * 0.15;
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

  const createIntakeTransaction = useCallback(async (data: {
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
  }): Promise<{ loan?: PawnLoan; item: InventoryItem; saps: SapsEntry }> => {
    const itemId = crypto.randomUUID();
    const sku = `SKU-${Math.floor(100000 + Math.random() * 900000)}`;
    const addedAt = new Date().toISOString();

    if (data.isPawn) {
      // 1. Pawn requires a registered Customer
      let customerId = data.customer.id;
      if (!customerId) {
        customerId = await addCustomer({
          fullName: data.customer.fullName,
          idNumber: data.customer.idNumber,
          idType: data.customer.idType,
          mobile: data.customer.mobile,
          address: data.customer.address,
          dob: data.customer.dob,
          gender: data.customer.gender,
          verified: data.customer.verified ?? true
        });
      }

      const loanId = crypto.randomUUID();
      const ticketNumber = `#PWN-${Math.floor(1000 + Math.random() * 9000)}`;
      const retailPrice = data.retailPriceEstimate || Math.round(data.agreedOffer * 1.8);

      const item: InventoryItem = {
        id: itemId,
        sku,
        title: data.title,
        category: data.category,
        serialOrImei: data.serialOrImei,
        condition: data.condition,
        acquisitionType: 'Pawn',
        costBasis: data.agreedOffer,
        retailPrice,
        status: 'Vault Hold',
        vaultLocation: data.vaultShelf || 'BIN-A01',
        imageUrl: data.imageUrl || 'https://images.unsplash.com/photo-1550009158-9ebf69173e03?w=600&q=80',
        pawnTicketId: loanId,
        addedAt
      };
      await addItem(item);

      const loan: PawnLoan = {
        id: loanId,
        ticketNumber,
        customerId,
        customerName: data.customer.fullName,
        customerIdNumber: data.customer.idNumber,
        customerMobile: data.customer.mobile,
        customerAddress: data.customer.address,
        itemId,
        itemTitle: data.title,
        itemCategory: data.category,
        serialOrImei: data.serialOrImei,
        condition: data.condition,
        itemImageUrl: item.imageUrl,
        principal: data.agreedOffer,
        ncrMonthlyRate: 0.05,
        monthlyInterest: data.agreedOffer * 0.05,
        monthlyStorageAdminFee: data.agreedOffer * 0.08,
        totalRedemptionAmount: Math.round(data.agreedOffer * 1.13),
        extensionFee: Math.round(data.agreedOffer * 0.13),
        startDate: new Date().toISOString().split('T')[0],
        expiryDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
        daysRemaining: 30,
        daysElapsed: 0,
        vaultShelf: data.vaultShelf || 'BIN-A01',
        status: 'Active',
        qrToken: `TOKEN-${ticketNumber}`,
        history: [{
          date: new Date().toISOString().replace('T', ' ').slice(0, 16),
          action: 'Created',
          amount: data.agreedOffer,
          note: 'Pawn contract initiated.'
        }]
      };
      await createLoan(loan);

      const sapsId = await addSapsEntry({
        timestamp: addedAt,
        customerId,
        customerName: data.customer.fullName,
        customerIdNumber: data.customer.idNumber,
        customerAddress: data.customer.address,
        customerPhone: data.customer.mobile,
        itemDescription: data.title,
        category: data.category,
        serialOrImei: data.serialOrImei,
        condition: data.condition,
        acquisitionType: 'Pawn',
        considerationPaid: data.agreedOffer,
        officerName: currentUserProfile?.full_name || 'Intake Officer',
        policeStationRef: 'STN-JHB-01',
        verificationStatus: 'VERIFIED',
        barcodeRef: sku
      });

      const saps = await db.saps.get(sapsId);
      return { loan, item, saps: saps! };
    } else {
      // 2. Outright buy creates a registered Seller + SellerTransaction (Spec Rule 16)
      let sellerId = data.customer.id;
      if (!sellerId) {
        sellerId = await addSeller({
          fullName: data.customer.fullName,
          idNumber: data.customer.idNumber,
          idType: data.customer.idType,
          mobile: data.customer.mobile,
          address: data.customer.address,
          verified: data.customer.verified ?? true
        });
      }

      const retailPrice = data.retailPriceEstimate || Math.round(data.agreedOffer * 1.8);
      const item: InventoryItem = {
        id: itemId,
        sku,
        title: data.title,
        category: data.category,
        serialOrImei: data.serialOrImei,
        condition: data.condition,
        acquisitionType: 'Buy',
        costBasis: data.agreedOffer,
        retailPrice,
        status: 'Retail Floor',
        imageUrl: data.imageUrl || 'https://images.unsplash.com/photo-1550009158-9ebf69173e03?w=600&q=80',
        addedAt
      };
      await addItem(item);

      const sapsId = await addSapsEntry({
        timestamp: addedAt,
        customerId: sellerId,
        customerName: data.customer.fullName,
        customerIdNumber: data.customer.idNumber,
        customerAddress: data.customer.address,
        customerPhone: data.customer.mobile,
        itemDescription: data.title,
        category: data.category,
        serialOrImei: data.serialOrImei,
        condition: data.condition,
        acquisitionType: 'Buy',
        considerationPaid: data.agreedOffer,
        officerName: currentUserProfile?.full_name || 'Intake Officer',
        policeStationRef: 'STN-JHB-01',
        verificationStatus: 'VERIFIED',
        barcodeRef: sku
      });

      const saps = await db.saps.get(sapsId);

      // Record Seller Transaction
      await addSellerTransaction({
        shopId: shopProfile.id || 'default-shop',
        sellerId,
        totalProposedPayout: data.agreedOffer,
        totalApprovedPayout: data.agreedOffer,
        paymentStatus: 'Paid',
        status: 'Acquired',
        complianceStatus: 'VERIFIED',
        items: [{
          id: crypto.randomUUID(),
          sellerTransactionId: '', // Will be set by addSellerTransaction
          shopId: shopProfile.id || 'default-shop',
          itemId,
          itemSku: sku,
          itemTitle: data.title,
          amountPaid: data.agreedOffer,
          retailPrice: retailPrice,
          condition: data.condition,
          serialOrImei: data.serialOrImei,
          createdAt: addedAt
        }],
        timestamp: addedAt,
        sapsRef: saps?.entryNumber || sku
      });

      return { item, saps: saps! };
    }
  }, [addCustomer, addSeller, addSellerTransaction, addItem, createLoan, addSapsEntry, currentUserProfile]);

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
        createIntakeTransaction,
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
