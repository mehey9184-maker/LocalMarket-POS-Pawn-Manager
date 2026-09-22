import Dexie, { Table } from 'dexie';
import { 
  Customer, 
  InventoryItem, 
  PawnLoan, 
  SapsEntry, 
  SaleTransaction,
  BusinessRules
} from '../types';

export interface SyncLog {
  id?: number;
  entityType: 'inventory' | 'loans' | 'customers' | 'saps' | 'sales' | 'rules';
  entityId: string;
  action: 'create' | 'update' | 'delete';
  payload: any;
  status: 'pending' | 'syncing' | 'failed' | 'completed';
  error?: string;
  createdAt: string;
  syncedAt?: string;
  retryCount: number;
}

export class LocalDatabase extends Dexie {
  inventory!: Table<InventoryItem>;
  customers!: Table<Customer>;
  loans!: Table<PawnLoan>;
  saps!: Table<SapsEntry>;
  sales!: Table<SaleTransaction>;
  syncLogs!: Table<SyncLog>;
  counters!: Table<{ id: string; value: number }>;

  constructor() {
    super('LocalMarketDB');
    this.version(2).stores({
      inventory: 'id, sku, status, pawnTicketId, addedAt',
      customers: 'id, fullName, idNumber, mobile',
      loans: 'id, ticketNumber, customerId, status, expiryDate',
      saps: 'id, entryNumber, timestamp, customerId',
      sales: 'id, receiptNumber, timestamp',
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
