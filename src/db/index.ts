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
  SellerTransactionItem,
  SellerReversalRecord,
  TerminalSession,
  RefundRequest,
  SyncLog,
  WorkflowDraft
} from '../types';

export type { SyncLog };

export class LocalDatabase extends Dexie {
  inventory!: Table<InventoryItem>;
  customers!: Table<Customer>;
  sellers!: Table<Seller>;
  sellerTransactions!: Table<SellerTransaction>;
  sellerReversals!: Table<SellerReversalRecord>;
  terminalSessions!: Table<TerminalSession>;
  workflowDrafts!: Table<WorkflowDraft>;
  sellerTransactionItems!: Table<SellerTransactionItem>;
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

    // Version 7: Relational Seller Transaction Items
    this.version(7).stores({
      inventory: 'id, sku, status, category, acquisitionType, pawnTicketId, addedAt',
      customers: 'id, fullName, idNumber, mobile',
      sellers: 'id, fullName, idNumber, mobile',
      sellerTransactions: 'id, sellerId, transactionNumber, timestamp',
      sellerTransactionItems: 'id, sellerTransactionId, itemId, itemSku',
      sellerReversals: 'id, sellerTransactionId, itemId, sellerId, timestamp',
      terminalSessions: 'id, userId, shopId, deviceId, status',
      loans: 'id, ticketNumber, customerId, status, expiryDate',
      saps: 'id, entryNumber, timestamp, customerId',
      sales: 'id, receiptNumber, timestamp',
      refundRequests: 'id, receiptNumber, itemId, status, createdAt',
      syncLogs: '++id, entityType, entityId, status, createdAt',
      counters: 'id'
    });

    // Version 9: Multi-shop data isolation
    this.version(9).stores({
      inventory: 'id, shopId, sku, status, category, acquisitionType, pawnTicketId, addedAt',
      customers: 'id, shopId, fullName, idNumber, mobile',
      sellers: 'id, shopId, fullName, idNumber, mobile',
      sellerTransactions: 'id, shopId, sellerId, transactionNumber, timestamp',
      sellerTransactionItems: 'id, shopId, sellerTransactionId, itemId, itemSku',
      sellerReversals: 'id, shopId, sellerTransactionId, itemId, sellerId, timestamp',
      terminalSessions: 'id, userId, shopId, deviceId, status',
      workflowDrafts: 'id, shopId, userId, workflowType, status, updatedAt',
      loans: 'id, shopId, ticketNumber, customerId, status, expiryDate',
      saps: 'id, shopId, entryNumber, timestamp, customerId',
      sales: 'id, shopId, receiptNumber, timestamp',
      refundRequests: 'id, shopId, receiptNumber, itemId, status, createdAt',
      syncLogs: '++id, shopId, entityType, entityId, status, createdAt',
      counters: 'id'
    }).upgrade(async tx => {
      const QUARANTINE = 'legacy-unassigned';
      await Promise.all([
        tx.table('inventory').toCollection().modify(i => { if (!i.shopId) i.shopId = QUARANTINE; }),
        tx.table('customers').toCollection().modify(c => { if (!c.shopId) c.shopId = QUARANTINE; }),
        tx.table('sellers').toCollection().modify(s => { if (!s.shopId) s.shopId = QUARANTINE; }),
        tx.table('sellerTransactions').toCollection().modify(t => { if (!t.shopId) t.shopId = QUARANTINE; }),
        tx.table('sellerTransactionItems').toCollection().modify(ti => { if (!ti.shopId) ti.shopId = QUARANTINE; }),
        tx.table('sellerReversals').toCollection().modify(sr => { if (!sr.shopId) sr.shopId = QUARANTINE; }),
        tx.table('loans').toCollection().modify(l => { if (!l.shopId) l.shopId = QUARANTINE; }),
        tx.table('saps').toCollection().modify(s => { if (!s.shopId) s.shopId = QUARANTINE; }),
        tx.table('sales').toCollection().modify(s => { if (!s.shopId) s.shopId = QUARANTINE; }),
        tx.table('refundRequests').toCollection().modify(rr => { if (!rr.shopId) rr.shopId = QUARANTINE; }),
        tx.table('syncLogs').toCollection().modify(sl => { if (!sl.shopId) sl.shopId = QUARANTINE; }),
        tx.table('workflowDrafts').toCollection().modify(wd => { if (!wd.shopId) wd.shopId = QUARANTINE; })
      ]);
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
    console.log('Seeding LocalDatabase with isolated demo data...');
    const DEMO_SCOPE = 'demo-data';
    
    await db.inventory.bulkAdd(inventory.map(i => ({ ...i, shopId: DEMO_SCOPE })));
    await db.customers.bulkAdd(customers.map(c => ({ ...c, shopId: DEMO_SCOPE })));
    await db.loans.bulkAdd(loans.map(l => ({ ...l, shopId: DEMO_SCOPE })));
    await db.saps.bulkAdd(saps.map(s => ({ ...s, shopId: DEMO_SCOPE })));
  }
}
