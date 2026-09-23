import { db } from '../db';
import { SyncLog } from '../types';
import { 
  isSupabaseConfigured 
} from './supabase';
import { 
  shopItemsApi, 
  customersApi, 
  sellersApi, 
  sellerTransactionsApi, 
  pawnLoansApi, 
  salesApi, 
  sapsApi, 
  logsApi 
} from './supabaseApi';

/**
 * SyncService
 * Orchestrates offline-first data replication between local Dexie (IndexedDB)
 * and Supabase PostgreSQL.
 * 
 * Rules:
 * - True offline-first: local DB is source of immediate truth.
 * - Idempotent upserts: local UUID is never re-generated during retries.
 * - Never fake sync: if offline or Supabase isn't reachable, items remain in 'pending'.
 * - Trickle Sync rate limiting to protect Supabase free-tier limits.
 */
export const SyncService = {
  /**
   * Sync a single SyncLog entry to Supabase
   */
  async syncEntity(log: SyncLog, shopId?: string): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured()) {
      return { success: false, error: 'Supabase is not configured' };
    }

    try {
      switch (log.entityType) {
        case 'inventory': {
          const row = shopItemsApi.mapInventoryItemToRow(log.payload, shopId);
          if (log.action === 'delete') {
            await shopItemsApi.deleteItem(log.entityId);
          } else {
            await shopItemsApi.upsertItem(row);
          }
          break;
        }

        case 'customers': {
          const row = customersApi.mapCustomerToRow(log.payload, shopId);
          await customersApi.upsertCustomer(row);
          break;
        }

        case 'sellers': {
          const row = sellersApi.mapSellerToRow(log.payload, shopId);
          await sellersApi.upsertSeller(row);
          break;
        }

        case 'sellerTransactions': {
          const row = sellerTransactionsApi.mapTransactionToRow(log.payload, shopId);
          await sellerTransactionsApi.upsertTransaction(row);
          break;
        }

        case 'loans': {
          const row = pawnLoansApi.mapLoanToRow(log.payload, shopId);
          await pawnLoansApi.upsertLoan(row);
          break;
        }

        case 'sales': {
          const row = salesApi.mapSaleToRow(log.payload, shopId);
          await salesApi.upsertSale(row);
          break;
        }

        case 'saps': {
          const row = sapsApi.mapEntryToRow(log.payload, shopId);
          await sapsApi.upsertEntry(row);
          break;
        }

        case 'rules': {
          // System rules sync audit log
          await logsApi.createLog(
            'BUSINESS_RULES_SYNCED',
            'Sync Engine',
            { updatedFields: Object.keys(log.payload || {}) },
            'audit',
            undefined,
            shopId
          );
          break;
        }

        default:
          console.warn(`Unrecognized entityType in sync log: ${(log as any).entityType}`);
          break;
      }

      // Mark as completed in Dexie
      if (log.id) {
        await db.syncLogs.update(log.id, {
          status: 'completed',
          syncedAt: new Date().toISOString(),
          error: undefined
        });
      }

      return { success: true };
    } catch (err: any) {
      const errorMessage = err?.message || 'Unknown network or synchronization error';
      console.error(`Failed to sync ${log.entityType} [${log.entityId}]:`, errorMessage);

      if (log.id) {
        await db.syncLogs.update(log.id, {
          status: 'failed',
          retryCount: (log.retryCount || 0) + 1,
          error: errorMessage
        });
      }

      return { success: false, error: errorMessage };
    }
  },

  /**
   * Process all pending or failed sync logs in batches with slow trickle rate limiting
   */
  async processAllPendingSync(
    shopId?: string,
    onProgress?: (current: number, total: number, entity: string) => void
  ): Promise<{ processed: number; successful: number; failed: number }> {
    if (!isSupabaseConfigured() || !navigator.onLine) {
      return { processed: 0, successful: 0, failed: 0 };
    }

    const pendingLogs = await db.syncLogs
      .where('status')
      .anyOf('pending', 'failed')
      .sortBy('createdAt');

    const total = pendingLogs.length;
    if (total === 0) return { processed: 0, successful: 0, failed: 0 };

    let successful = 0;
    let failed = 0;

    for (let i = 0; i < total; i++) {
      const log = pendingLogs[i];
      if (onProgress) {
        onProgress(i + 1, total, `${log.entityType} (${log.entityId.slice(0, 8)})`);
      }

      // Mark as syncing
      if (log.id) {
        await db.syncLogs.update(log.id, { status: 'syncing' });
      }

      const res = await this.syncEntity(log, shopId);
      if (res.success) {
        successful++;
      } else {
        failed++;
      }

      // Trickle delay: 120ms between sync actions to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 120));
    }

    return { processed: total, successful, failed };
  }
};
