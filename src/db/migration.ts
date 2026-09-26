import { db } from './index';
import { 
  Customer, 
  InventoryItem, 
  PawnLoan, 
  SapsEntry, 
  SaleTransaction 
} from '../types';

export async function cleanupSyntheticSyncLogs() {
  try {
    const syntheticLogs = await db.syncLogs
      .filter(log => {
        const entityId = String(log.entityId || '');
        const custId = String(log.payload?.customerId || log.payload?.customer_id || '');
        return entityId.startsWith('CUST-') || custId.startsWith('CUST-');
      })
      .toArray();

    for (const log of syntheticLogs) {
      if (log.id) {
        await db.syncLogs.update(log.id, {
          status: 'completed',
          syncedAt: new Date().toISOString(),
          error: 'Quarantined synthetic demo fixture log'
        });
      }
    }
  } catch (err) {
    console.error('Failed to cleanup synthetic sync logs:', err);
  }
}

export async function runMigration(_shopId?: string) {
  await cleanupSyntheticSyncLogs();
  const isMigrated = localStorage.getItem('lm_dexie_migration_complete');
  if (isMigrated === 'true') return;

  console.log('Starting data migration from localStorage to Dexie (Quarantine: legacy-unassigned)...');

  try {
    const getLocal = (key: string) => {
      const data = localStorage.getItem(key);
      try {
        return data ? JSON.parse(data) : null;
      } catch (e) {
        console.error(`Failed to parse localStorage key: ${key}`, e);
        return null;
      }
    };

    const inventory = getLocal('lm_inventory') as InventoryItem[] | null;
    const customers = getLocal('lm_customers') as Customer[] | null;
    const loans = getLocal('lm_loans') as PawnLoan[] | null;
    const saps = getLocal('lm_saps') as SapsEntry[] | null;
    const sales = getLocal('lm_sales') as SaleTransaction[] | null;

    const QUARANTINE_SCOPE = 'legacy-unassigned';

    if (inventory && inventory.length > 0) {
      await db.inventory.bulkPut(inventory.map(item => ({ ...item, shopId: item.shopId || QUARANTINE_SCOPE })));
    }
    if (customers && customers.length > 0) {
      await db.customers.bulkPut(customers.map(item => ({ ...item, shopId: item.shopId || QUARANTINE_SCOPE })));
    }
    if (loans && loans.length > 0) {
      await db.loans.bulkPut(loans.map(item => ({ ...item, shopId: item.shopId || QUARANTINE_SCOPE })));
    }
    if (saps && saps.length > 0) {
      await db.saps.bulkPut(saps.map(item => ({ ...item, shopId: item.shopId || QUARANTINE_SCOPE })));
    }
    if (sales && sales.length > 0) {
      await db.sales.bulkPut(sales.map(item => ({ ...item, shopId: item.shopId || QUARANTINE_SCOPE })));
    }

    localStorage.setItem('lm_dexie_migration_complete', 'true');
    console.log('Migration to Dexie completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
  }
}
