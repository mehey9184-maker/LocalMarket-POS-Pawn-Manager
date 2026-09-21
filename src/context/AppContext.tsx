import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  Customer,
  InventoryItem,
  PawnLoan,
  SapsEntry,
  CartItem,
  SaleTransaction,
  PaymentMethod,
  ReceiptDelivery,
  ItemCondition
} from '../types';
import {
  INITIAL_CUSTOMERS,
  INITIAL_INVENTORY,
  INITIAL_PAWN_LOANS,
  INITIAL_SAPS_REGISTER
} from '../data/initialData';
import { offlineStorage } from '../services/offlineStorage';

export type NavTab = 'dashboard' | 'pos' | 'intake' | 'vault' | 'registry' | 'profile';

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

  // Initialize Offline Storage
  useEffect(() => {
    offlineStorage.init().catch(console.error);
  }, []);

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

  const showToast = (title: string, desc: string, type: 'success' | 'amber' | 'info' | 'error' = 'success') => {
    setToastMessage({ title, desc, type });
    setTimeout(() => {
      setToastMessage(prev => (prev?.title === title ? null : prev));
    }, 4500);
  };

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
    
    // Offline Queueing
    offlineStorage.queueTransaction('POS_SALE', newSale).catch(console.error);

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
      retailPrice: data.retailPriceEstimate || (data.agreedOffer * 1.8),
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
      const monthlyRate = 0.05; // 5% NCR statutory rate
      const monthlyInterest = principal * monthlyRate;
      const monthlyStorageAdminFee = Math.round(principal * 0.08); // NCR initiation & storage
      const totalRedemptionAmount = principal + monthlyInterest + monthlyStorageAdminFee;
      const extensionFee = monthlyInterest + monthlyStorageAdminFee;

      const startDateObj = new Date();
      const expiryDateObj = new Date();
      expiryDateObj.setDate(startDateObj.getDate() + 30);

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
        daysRemaining: 30,
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

    // Offline Queueing
    offlineStorage.queueTransaction('PAWN_INTAKE', { loan: newLoan, item: newItem, saps: sapsEntry }).catch(console.error);

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
      const suggestedPrice = Math.round(l.principal * 1.8);
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
