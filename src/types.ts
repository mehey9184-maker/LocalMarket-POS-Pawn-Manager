export type AcquisitionType = 'Buy' | 'Pawn' | 'Forfeited' | 'Forfeit';
export type ItemCondition = 'Mint' | 'Excellent' | 'Good' | 'Fair' | 'Damaged';
export type ItemStatus = 'Vault Hold' | 'Retail Floor' | 'Sold' | 'Redeemed' | 'Reserved' | 'Flagged';
export type LoanStatus = 'Active' | 'Extended' | 'Redeemed' | 'Forfeited' | 'Archived';
export type PaymentMethod = 'cash' | 'card' | 'eft' | 'snapscan';
export type ReceiptDelivery = 'thermal' | 'whatsapp' | 'sms';

export interface Customer {
  id: string;
  fullName: string;
  idNumber: string;
  idType: 'RSA Smart ID' | 'Green ID Book' | 'Passport';
  mobile: string;
  address: string;
  dob: string;
  gender: string;
  verified: boolean;
  createdAt: string;
  lastCommunicationAt?: string;
  isFlagged?: boolean;
}

export interface InventoryItem {
  id: string;
  sku: string;
  title: string;
  category: 'Phones & Tech' | 'Power Tools' | 'Audio & Visual' | 'Fine Jewelry & Gold' | 'Gaming Consoles' | 'Appliances';
  serialOrImei: string;
  condition: ItemCondition;
  acquisitionType: AcquisitionType;
  costBasis: number;
  retailPrice: number;
  vaultLocation?: string;
  status: ItemStatus;
  daysInVault?: number;
  imageUrl: string;
  specs?: string;
  pawnTicketId?: string;
  addedAt: string;
}

export interface LoanHistoryEntry {
  date: string;
  action: 'Created' | 'Interest Paid & Extended' | 'Full Redemption' | 'Forfeited to Floor';
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
