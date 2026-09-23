import Dexie, { Table } from 'dexie';
import { 
  Customer, 
  InventoryItem, 
  PawnLoan, 
  SapsEntry, 
  SaleTransaction,
  BusinessRules,
  Seller,
  SellerTransaction,
  SellerReversalRecord,
  TerminalSession,
  RefundRequest,
  SyncLog
} from '../types';

export type { SyncLog };

export class LocalDatabase extends Dexie {
  inventory!: Table<InventoryItem>;
  customers!: Table<Customer>;
  sellers!: Table<Seller>;
  sellerTransactions!: Table<SellerTransaction>;
  sellerReversals!: Table<SellerReversalRecord>;
  terminalSessions!: Table<TerminalSession>;
  loans!: Table<PawnLoan>;
  saps!: Table<SapsEntry>;
  sales!: Table<SaleTransaction>;
  refundRequests!: Table<RefundRequest>;
  syncLogs!: Table<SyncLog>;
  counters!: Table<{ id: string; value: number }>;

  constructor() {
    super('LocalMarketDB');

    // Initial Schema (Version 1)
    this.version(1).stores({
      inventory: 'id, sku, status, pawnTicketId, addedAt',
      customers: 'id, fullName, idNumber, mobile',
      loans: 'id, ticketNumber, customerId, status, expiryDate',
      saps: 'id, entryNumber, timestamp, customerId',
      sales: 'id, receiptNumber, timestamp',
      syncLogs: '++id, entityType, entityId, status, createdAt',
      counters: 'id'
    });

    // Version 2: Added inventory categories and search indexes
    this.version(2).stores({
      inventory: 'id, sku, status, category, pawnTicketId, addedAt',
      customers: 'id, fullName, idNumber, mobile',
      loans: 'id, ticketNumber, customerId, status, expiryDate',
      saps: 'id, entryNumber, timestamp, customerId',
      sales: 'id, receiptNumber, timestamp',
      syncLogs: '++id, entityType, entityId, status, createdAt',
      counters: 'id'
    });

    // Version 3: Added dedicated Sellers and SellerTransactions tables
    this.version(3).stores({
      inventory: 'id, sku, status, category, pawnTicketId, addedAt',
      customers: 'id, fullName, idNumber, mobile',
      sellers: 'id, fullName, idNumber, mobile',
      sellerTransactions: 'id, sellerId, itemId, timestamp',
      loans: 'id, ticketNumber, customerId, status, expiryDate',
      saps: 'id, entryNumber, timestamp, customerId',
      sales: 'id, receiptNumber, timestamp',
      syncLogs: '++id, entityType, entityId, status, createdAt',
      counters: 'id'
    });

    // Version 4: Added acquisitionType index for inventory
    this.version(4).stores({
      inventory: 'id, sku, status, category, acquisitionType, pawnTicketId, addedAt',
      customers: 'id, fullName, idNumber, mobile',
      sellers: 'id, fullName, idNumber, mobile',
      sellerTransactions: 'id, sellerId, itemId, timestamp',
      loans: 'id, ticketNumber, customerId, status, expiryDate',
      saps: 'id, entryNumber, timestamp, customerId',
      sales: 'id, receiptNumber, timestamp',
      syncLogs: '++id, entityType, entityId, status, createdAt',
      counters: 'id'
    });

    // Version 5: Added refundRequests table
    this.version(5).stores({
      inventory: 'id, sku, status, category, acquisitionType, pawnTicketId, addedAt',
      customers: 'id, fullName, idNumber, mobile',
      sellers: 'id, fullName, idNumber, mobile',
      sellerTransactions: 'id, sellerId, itemId, timestamp',
      loans: 'id, ticketNumber, customerId, status, expiryDate',
      saps: 'id, entryNumber, timestamp, customerId',
      sales: 'id, receiptNumber, timestamp',
      refundRequests: 'id, receiptNumber, itemId, status, createdAt',
      syncLogs: '++id, entityType, entityId, status, createdAt',
      counters: 'id'
    });

    // Version 6: Added sellerReversals and terminalSessions tables
    this.version(6).stores({
      inventory: 'id, sku, status, category, acquisitionType, pawnTicketId, addedAt',
      customers: 'id, fullName, idNumber, mobile',
      sellers: 'id, fullName, idNumber, mobile',
      sellerTransactions: 'id, sellerId, timestamp',
      sellerReversals: 'id, sellerTransactionId, itemId, sellerId, timestamp',
      terminalSessions: 'id, userId, shopId, deviceId, status',
      loans: 'id, ticketNumber, customerId, status, expiryDate',
      saps: 'id, entryNumber, timestamp, customerId',
      sales: 'id, receiptNumber, timestamp',
      refundRequests: 'id, receiptNumber, itemId, status, createdAt',
      syncLogs: '++id, entityType, entityId, status, createdAt',
      counters: 'id'
    });
  }
}

export const db = new LocalDatabase();

export async function seedDatabase(
  inventory: InventoryItem[],
  customers: Customer[],
  loans: PawnLoan[],
  saps: SapsEntry[]
) {
  const inventoryCount = await db.inventory.count();
  if (inventoryCount === 0) {
    console.log('Seeding LocalDatabase with initial data...');
    await db.inventory.bulkAdd(inventory);
    await db.customers.bulkAdd(customers);
    await db.loans.bulkAdd(loans);
    await db.saps.bulkAdd(saps);
  }
}
