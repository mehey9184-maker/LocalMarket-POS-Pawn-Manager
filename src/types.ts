export type AcquisitionType = 'Existing Stock' | 'Buy' | 'Pawn' | 'Forfeited' | 'Forfeit';
export type SourceType = 'existing_stock' | 'seller' | 'pawn' | 'forfeiture' | 'supplier' | 'unknown';
export type SourceStatus = 'verified' | 'unknown' | 'pending';
export type ItemCondition = 'Mint' | 'Excellent' | 'Good' | 'Fair' | 'Damaged';
export type ItemStatus = 'Vault Hold' | 'Retail Floor' | 'Sold' | 'Redeemed' | 'Reserved' | 'Flagged' | 'InStock' | 'Forfeited' | 'Pending Forfeit' | 'Returned' | 'Reversed';
export type LoanStatus = 'Active' | 'Extended' | 'Redeemed' | 'Forfeited' | 'Archived' | 'Pending Forfeit';
export type PaymentMethod = 'cash' | 'card' | 'eft' | 'snapscan';
export type ReceiptDelivery = 'thermal' | 'whatsapp' | 'sms';

export interface RsaIdScanResult {
  idNumber: string;
  dob?: string;
  gender?: 'Male' | 'Female';
  citizenship?: 'SA Citizen' | 'Permanent Resident';
  rawText: string;
  source: 'rsa_id_barcode';
  capturedAt: string;
}

export interface Customer {
  id: string;
  shopId?: string;
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
  shopId?: string;
  fullName: string;
  idNumber: string;
  idType: 'RSA Smart ID' | 'Green ID Book' | 'Passport';
  mobile: string;
  address: string;
  createdAt: string;
  verified: boolean;
}

export interface SellerTransaction {
  id: string; // UUID
  transactionNumber: string; // ST-000123
  shopId: string;
  sellerId: string;
  cashierId?: string;
  totalProposedPayout: number;
  totalApprovedPayout: number;
  paymentMethod?: PaymentMethod | string;
  paymentStatus: SellerPaymentStatus;
  status: SellerTransactionStatus;
  complianceStatus: 'VERIFIED' | 'PENDING' | 'FLAGGED';
  timestamp: string;
  sapsRef?: string;
  items?: SellerTransactionItem[];
}

export interface SellerTransactionItem {
  id: string;
  sellerTransactionId: string;
  shopId: string;
  itemId: string;
  itemSku: string;
  itemTitle: string;
  amountPaid: number;
  retailPrice: number;
  serialOrImei?: string;
  condition?: ItemCondition | string;
  createdAt: string;
}

export type ItemCategory = 
  | 'Phones & Tech'
  | 'Computing & Laptops'
  | 'Power Tools'
  | 'Audio & Visual'
  | 'Musical Instruments & Gear'
  | 'Generators & Power Systems'
  | 'Fine Jewelry & Gold'
  | 'Watches & Luxury Goods'
  | 'Gaming Consoles'
  | 'Appliances'
  | 'Sporting Goods & Bicycles'
  | 'General Goods';

export interface InventoryItem {
  id: string;
  shopId?: string;
  sku: string;
  title: string;
  category: ItemCategory | string;
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
  shopId?: string;
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
  shopId?: string;
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
  shopId?: string;
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

  // Market Intelligence & Valuation Rules
  targetMarginPercent?: number; // e.g. 35% target margin
  minMarginPercent?: number; // e.g. 25% minimum margin
  riskAllowancePercent?: number; // e.g. 5% risk allowance

  // Workflow & Hardware preferences
  defaultIntakeType: 'prompt' | 'pawn' | 'buy';
  defaultVaultShelf: string;
  defaultCashierName: string;
  defaultCategory: string;
  autoPrintTag: boolean;
}

export interface SyncLog {
  id?: number;
  shopId?: string;
  entityType: 'inventory' | 'loans' | 'customers' | 'saps' | 'sales' | 'rules' | 'sellers' | 'sellerTransactions' | 'sellerReversals' | 'refunds' | 'refund_approval' | 'shopProfile' | 'buyAcquisition' | 'pawnIntake';
  entityId: string;
  action: 'create' | 'update' | 'delete' | 'approve' | 'reject';
  payload: any;
  status: 'pending' | 'syncing' | 'failed' | 'completed';
  error?: string;
  createdAt: string;
  syncedAt?: string;
  retryCount: number;
}

export interface BusinessRuleAuditLog {
  id: string;
  shopId: string;
  actorId: string;
  actorName: string;
  timestamp: string;
  eventType: string;
  oldValues: BusinessRules;
  newValues: BusinessRules;
  reason?: string;
  createdAt: string;
}

export type SellerTransactionStatus = 'Draft' | 'Proposed' | 'Approved' | 'Paid' | 'Acquired' | 'Rejected' | 'Cancelled';
export type SellerPaymentStatus = 'Pending' | 'Paid';

export type SellerReversalStatus = 'Under Review' | 'Returned' | 'Reversed';

export interface SellerReversalRecord {
  id: string;
  shopId: string;
  sellerTransactionId: string;
  itemId: string;
  sellerId: string;
  originalPayout: number;
  reversalAmount: number;
  reason: string;
  actorId: string;
  actorName: string;
  approvedBy?: string;
  timestamp: string;
  resultingInventoryStatus: 'Returned' | 'Reversed' | 'Under Review';
  resultingPaymentStatus: string;
}

export interface TerminalSession {
  id: string;
  shopId: string;
  userId: string;
  userName: string;
  deviceId: string;
  activatedAt: string;
  lastHeartbeatAt: string;
  status: 'active' | 'invalidated' | 'expired';
  invalidatedAt?: string;
}

export type RefundStatus = 'Pending Approval' | 'Approved' | 'Rejected';

export interface RefundRequest {
  id: string;
  shopId: string;
  saleId?: string;
  receiptNumber: string;
  itemId: string;
  itemSku: string;
  itemTitle: string;
  quantity: number;
  refundAmount: number;
  reason: string;
  status: RefundStatus;
  requestedBy?: string;
  requestedByName: string;
  approvedBy?: string;
  approvedByName?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  failedCount: number;
  hasDeterministicError: boolean;
  hasTransientError: boolean;
  lastSyncTime: string | null;
}

export interface WorkflowDraft {
  id: string;
  userId: string;
  shopId: string;
  workflowType: 'buy' | 'pawn' | 'existing';
  step: string;
  payload: any;
  updatedAt: string;
  createdAt: string;
  status: 'active' | 'completed' | 'discarded';
}

export interface Permissions {
  sales: boolean;
  inventory: boolean;
  pawn: boolean;
  sellerAcquisitions: boolean;
  refunds: boolean;
  pricing: boolean;
  reports: boolean;
  staff: boolean;
}
