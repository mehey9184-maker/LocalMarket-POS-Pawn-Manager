export type AcquisitionType = 'Existing Stock' | 'Buy' | 'Pawn' | 'Forfeited' | 'Forfeit';
export type SourceType = 'existing_stock' | 'seller' | 'pawn' | 'forfeiture' | 'supplier' | 'unknown';
export type SourceStatus = 'verified' | 'unknown' | 'pending';
export type ItemCondition = 'Mint' | 'Excellent' | 'Good' | 'Fair' | 'Damaged';
export type ItemStatus = 'Vault Hold' | 'Retail Floor' | 'Sold' | 'Redeemed' | 'Reserved' | 'Flagged' | 'InStock' | 'Forfeited' | 'Pending Forfeit';
export type LoanStatus = 'Active' | 'Extended' | 'Redeemed' | 'Forfeited' | 'Archived' | 'Pending Forfeit';
export type PaymentMethod = 'cash' | 'card' | 'eft' | 'snapscan';
export type ReceiptDelivery = 'thermal' | 'whatsapp' | 'sms';

export interface Customer {
  id: string;
  fullName: string;
  idNumber: string;
  idType: 'RSA Smart ID' | 'Green ID Book' | 'Passport';
  mobile: string;
  address: string;
  dob?: string;
  gender?: string;
  verified: boolean;
  createdAt: string;
  lastCommunicationAt?: string;
  isFlagged?: boolean;
}

export interface Seller {
  id: string;
  fullName: string;
  idNumber: string;
  idType: 'RSA Smart ID' | 'Green ID Book' | 'Passport';
  mobile: string;
  address: string;
  createdAt: string;
  verified: boolean;
}

export interface SellerTransaction {
  id: string;
  sellerId: string;
  itemId: string;
  itemSku: string;
  itemTitle: string;
  amountPaid: number;
  timestamp: string;
  sapsRef: string;
}

export interface InventoryItem {
  id: string;
  sku: string;
  title: string;
  category: 'Phones & Tech' | 'Power Tools' | 'Audio & Visual' | 'Fine Jewelry & Gold' | 'Gaming Consoles' | 'Appliances';
  brand?: string;
  model?: string;
  serialOrImei: string;
  condition: ItemCondition;
  acquisitionType: AcquisitionType;
  costBasis: number;
  retailPrice: number;
  vaultLocation?: string;
  stockLocation?: string;
  status: ItemStatus;
  daysInVault?: number;
  imageUrl: string;
  specs?: string;
  pawnTicketId?: string;
  addedAt: string;
  // Provenance / source metadata for existing stock & compliance
  sourceType?: SourceType;
  sourceStatus?: SourceStatus;
  sourceNote?: string;
  internalNote?: string;
}

export interface LoanHistoryEntry {
  date: string;
  action: 'Created' | 'Interest Paid & Extended' | 'Full Redemption' | 'Forfeited to Floor' | 'Extension';
  amount: number;
  note: string;
  receiptNumber?: string;
}

export interface PawnLoan {
  id: string;
  ticketNumber: string; // e.g. #PWN-8829
  customerId: string;
  customerName: string;
  customerIdNumber: string;
  customerMobile: string;
  customerAddress: string;
  itemId: string;
  itemTitle: string;
  itemCategory: string;
  serialOrImei: string;
  condition: ItemCondition;
  itemImageUrl: string;
  principal: number;
  ncrMonthlyRate: number; // 0.05 (5.0% cap)
  monthlyInterest: number;
  monthlyStorageAdminFee: number;
  totalRedemptionAmount: number;
  extensionFee: number;
  startDate: string;
  expiryDate: string;
  daysRemaining: number;
  daysElapsed: number;
  vaultShelf: string;
  status: LoanStatus;
  qrToken: string;
  history: LoanHistoryEntry[];
}

export interface SapsEntry {
  id: string;
  entryNumber: string; // SAPS-2026-0842
  timestamp: string;
  customerId: string;
  customerName: string;
  customerIdNumber: string;
  customerAddress: string;
  customerPhone: string;
  itemDescription: string;
  category: string;
  serialOrImei: string;
  condition: ItemCondition;
  acquisitionType: AcquisitionType;
  considerationPaid: number;
  officerName: string;
  policeStationRef: string;
  verificationStatus: 'VERIFIED' | 'PENDING';
  barcodeRef: string;
  isCancelled?: boolean;
  cancelledAt?: string;
  cancelReason?: string;
}

export interface CartItem {
  item: InventoryItem;
  quantity: number;
  overridePrice?: number;
}

export interface SaleTransaction {
  id: string;
  receiptNumber: string;
  timestamp: string;
  items: CartItem[];
  subtotal: number;
  vatAmount: number;
  total: number;
  tenderMethod: PaymentMethod;
  amountTendered: number;
  change: number;
  receiptType: ReceiptDelivery;
  customerMobile?: string;
  cashier: string;
}

export type RetailRoundingMode = 'exact' | 'nearest10' | 'charm9' | 'charm99';

export interface BusinessRules {
  // 30-Day Pawn (NCR Act 34 of 2005)
  pawnMonthlyInterestRate: number; // e.g. 0.05 (5% legal cap)
  pawnStorageAdminFeeRate: number; // e.g. 0.08 (8% standard)
  defaultLoanTermDays: number; // e.g. 30
  gracePeriodDays: number; // e.g. 7
  minLoanPrincipal: number; // e.g. 100

  // Outright Buys (Second-Hand Goods Act 06 of 2009)
  defaultRetailMarkupMultiplier: number; // e.g. 1.8 (1.8x = +80% markup)
  retailRoundingMode: RetailRoundingMode;
  storeWarrantyDays: number; // e.g. 7
  warrantyDescription: string; // e.g. "7-Day Store Test Warranty"

  // Workflow & Hardware preferences
  defaultIntakeType: 'prompt' | 'pawn' | 'buy';
  defaultVaultShelf: string;
  defaultCashierName: string;
  defaultCategory: string;
  autoPrintTag: boolean;
}

export interface SyncLog {
  id?: number;
  entityType: 'inventory' | 'loans' | 'customers' | 'saps' | 'sales' | 'rules' | 'sellers' | 'sellerTransactions';
  entityId: string;
  action: 'create' | 'update' | 'delete';
  payload: any;
  status: 'pending' | 'syncing' | 'failed' | 'completed';
  error?: string;
  createdAt: string;
  syncedAt?: string;
  retryCount: number;
}

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncTime: string | null;
}
