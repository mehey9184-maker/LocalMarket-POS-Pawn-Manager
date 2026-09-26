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
  refundsApi,
  sapsApi, 
  logsApi,
  sellerReversalsApi,
  shopProfilesApi 
} from './supabaseApi';
import { storageService } from './storageService';

async function ensureRemoteImage(imageUrl: string | undefined | null, shopId: string, itemId: string): Promise<string> {
  if (!imageUrl || !imageUrl.startsWith('data:image/')) {
    return imageUrl || '';
  }
  try {
    const res = await storageService.uploadItemImage(imageUrl, shopId, itemId);
    if (res.imageUrl && !res.imageUrl.startsWith('data:image/')) {
      await db.inventory.update(itemId, { imageUrl: res.imageUrl });
      return res.imageUrl;
    }
  } catch (err) {
    console.warn('Failed to upload image to storage during sync:', err);
  }
  throw new Error('Photo upload to Backblaze B2 is pending/failed; holding cloud sync until image is uploaded.');
}

let activeSyncPromise: Promise<{ processed: number; successful: number; failed: number }> | null = null;

const isUuid = (id: string | null | undefined): boolean => {
  if (!id) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};

const isLegacySyntheticId = (id: string | null | undefined): boolean => {
  if (!id) return false;
  return /^(CUST|LOAN|INV|SAPS|SELL|TX|REV)-\d{3}$/i.test(id);
};

export const getLegacySyntheticIdViolation = (obj: any): string | null => {
  if (!obj || typeof obj !== 'object') return null;

  const uuidFieldsToCheck = [
    'customerid', 'customer_id',
    'sellerid', 'seller_id',
    'itemid', 'item_id',
    'shopid', 'shop_id',
    'transactionid', 'transaction_id',
    'loanid', 'loan_id',
    'sapsentryid', 'saps_entry_id'
  ];

  for (const key of Object.keys(obj)) {
    const val = obj[key];
    const lowerKey = key.toLowerCase();

    if (uuidFieldsToCheck.includes(lowerKey)) {
      if (typeof val === 'string' && isLegacySyntheticId(val)) {
        return `Synthetic/legacy ${key} referential integrity violation (${val})`;
      }
    }

    if (val && typeof val === 'object') {
      const nestedViolation = getLegacySyntheticIdViolation(val);
      if (nestedViolation) {
        return nestedViolation;
      }
    }
  }

  return null;
};

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

    if (!shopId || !isUuid(shopId)) {
      return { success: false, error: 'DETERMINISTIC_RECOVERABLE: Missing or invalid authoritative shop context for synchronization.' };
    }

    let validationError: string | null = null;

    // 1. Check if the entity ID itself is synthetic/legacy format
    const entityTypesRequiringUuid = [
      'inventory', 'customers', 'sellers', 'buyAcquisition', 'pawnIntake',
      'sellerTransactions', 'sellerReversals', 'loans', 'sales', 'refunds',
      'refund_approval', 'saps', 'shopProfile'
    ];

    if (entityTypesRequiringUuid.includes(log.entityType) && isLegacySyntheticId(log.entityId)) {
      validationError = `DETERMINISTIC_PERMANENT: Synthetic/legacy entity ID ${log.entityId} cannot be synced to Supabase (must be a valid UUID)`;
    }

    // 2. Check if the payload contains synthetic/legacy foreign keys (customerId, sellerId, etc.) using the recursive validator
    if (!validationError && log.payload) {
      const violation = getLegacySyntheticIdViolation(log.payload);
      if (violation) {
        validationError = `DETERMINISTIC_PERMANENT: ${violation}`;
      }
    }

    // 3. Shop context validation for entities that require shop context
    const entityTypesRequiringShopId = [
      'inventory', 'customers', 'sellers', 'buyAcquisition', 'pawnIntake',
      'sellerTransactions', 'sellerReversals', 'loans', 'sales', 'refunds',
      'refund_approval', 'saps', 'rules', 'shopProfile'
    ];

    if (!validationError && entityTypesRequiringShopId.includes(log.entityType)) {
      const payloadShopId = log.payload?.shopId || log.payload?.shop_id;
      
      if (log.shopId && log.shopId !== shopId) {
        validationError = `DETERMINISTIC_PERMANENT: Shop isolation violation. Log entry belongs to shop ${log.shopId} but terminal is authenticated for ${shopId}.`;
      } else if (payloadShopId && payloadShopId !== shopId) {
        validationError = `DETERMINISTIC_PERMANENT: Shop isolation violation. Payload belongs to shop ${payloadShopId} but terminal is authenticated for ${shopId}.`;
      }
    }

    // RETRY-COUNT & STATE MACHINE OWNERSHIP DOCUMENTATION:
    // SyncService.syncEntity strictly owns updating the Dexie outbox status and incrementing the retryCount.
    // processAllPendingSync() and context methods orchestrate processing but DO NOT mutate sync log status or increment retry counts directly.
    // This single-ownership model guarantees that retry counts are never double-incremented and states are always clean.
    if (validationError) {
      if (log.id) {
        const isRecoverable = validationError.includes('DETERMINISTIC_RECOVERABLE');
        await db.syncLogs.update(log.id, {
          status: 'failed',
          error: validationError,
          retryCount: isRecoverable ? (log.retryCount || 0) + 1 : (log.retryCount || 0)
        });
      }
      return { success: false, error: validationError };
    }

    try {
      switch (log.entityType) {
        case 'inventory': {
          const payload = log.payload;
          if (log.action === 'delete') {
            await shopItemsApi.deleteItem(log.entityId);
          } else if (payload.retailPrice !== undefined && Object.keys(payload).length === 1) {
            // Dedicated price change transaction sync
            const priceRes = await shopItemsApi.changeRetailPriceRpc(log.entityId, payload.retailPrice, 'Synced from offline price update');
            if (!priceRes.success) {
              throw new Error(priceRes.error || 'Server rejected offline price update');
            }
          } else {
            const cleanImageUrl = await ensureRemoteImage(payload.imageUrl, shopId, log.entityId);
            const row = shopItemsApi.mapInventoryItemToRow({ ...payload, imageUrl: cleanImageUrl }, shopId);
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

        case 'buyAcquisition': {
          const payload = log.payload;
          const sanitizedItems = await Promise.all(
            (payload.items || []).map(async (item: any) => ({
              ...item,
              image_url: await ensureRemoteImage(item.image_url, shopId, item.id || log.entityId)
            }))
          );
          const rpcRes = await sellerTransactionsApi.completeBuyAcquisitionRpc({
            transactionId: payload.transactionId || log.entityId,
            transactionNumber: payload.transactionNumber,
            sellerId: payload.sellerId,
            items: sanitizedItems,
            totalAmount: payload.totalAmount,
            paymentMethod: payload.paymentMethod,
            paymentStatus: payload.paymentStatus,
            transactionStatus: payload.transactionStatus,
            complianceStatus: payload.complianceStatus,
            sapsRef: payload.sapsRef,
            officerName: payload.officerName,
            policeStationRef: payload.policeStationRef,
            shopId: shopId,
            metadata: payload.metadata
          });

          if (!rpcRes.success) {
            throw new Error(rpcRes.error || 'complete_buy_acquisition rejected by database');
          }
          break;
        }

        case 'pawnIntake': {
          const payload = log.payload;
          const cleanImageUrl = await ensureRemoteImage(payload.itemImageUrl, shopId, payload.itemId || log.entityId);
          const rpcRes = await pawnLoansApi.completePawnIntakeRpc({
            loanId: payload.loanId || log.entityId,
            ticketNumber: payload.ticketNumber,
            customerId: payload.customerId,
            itemId: payload.itemId,
            itemSku: payload.itemSku,
            itemTitle: payload.itemTitle,
            itemCategory: payload.itemCategory,
            itemBrand: payload.itemBrand,
            itemModel: payload.itemModel,
            serialOrImei: payload.serialOrImei,
            condition: payload.condition,
            itemImageUrl: cleanImageUrl,
            specs: payload.specs,
            stockLocation: payload.stockLocation,
            internalNote: payload.internalNote,
            principal: payload.principal,
            ncrMonthlyRate: payload.ncrMonthlyRate,
            monthlyInterest: payload.monthlyInterest,
            monthlyStorageAdminFee: payload.monthlyStorageAdminFee,
            totalRedemptionAmount: payload.totalRedemptionAmount,
            extensionFee: payload.extensionFee,
            startDate: payload.startDate,
            expiryDate: payload.expiryDate,
            daysRemaining: payload.daysRemaining,
            vaultShelf: payload.vaultShelf,
            qrToken: payload.qrToken,
            officerName: payload.officerName,
            policeStationRef: payload.policeStationRef,
            sapsEntryId: payload.sapsEntryId,
            sapsEntryNumber: payload.sapsEntryNumber,
            history: payload.history,
            shopId: shopId
          });

          if (!rpcRes.success) {
            throw new Error(rpcRes.error || 'complete_pawn_intake rejected by database');
          }
          break;
        }

        case 'sellerTransactions': {
          const payload = log.payload;
          if (shopId && payload.transactionNumber) {
            // Authoritative batch creation
            const batchRes = await sellerTransactionsApi.createTransactionBatchRpc(payload);
            if (!batchRes.success) {
              throw new Error(batchRes.error || 'create_seller_transaction_batch rejected by database');
            }
          } else {
            const row = sellerTransactionsApi.mapTransactionToRow(payload, shopId);
            await sellerTransactionsApi.upsertTransaction(row);
          }
          break;
        }

        case 'sellerReversals': {
          if (log.action === 'create') {
            const revRes = await sellerReversalsApi.reverseAcquisitionRpc({
              reversalId: log.payload.id || log.entityId,
              transactionId: log.payload.sellerTransactionId,
              itemId: log.payload.itemId,
              reason: log.payload.reason,
              approverId: log.payload.approvedBy
            });
            if (!revRes.success) {
              throw new Error(revRes.error || 'reverse_seller_acquisition rejected by database');
            }
          }
          break;
        }

        case 'loans': {
          const row = pawnLoansApi.mapLoanToRow(log.payload, shopId);
          await pawnLoansApi.upsertLoan(row);
          break;
        }

        case 'sales': {
          const payload = log.payload;
          if (shopId && payload.items && Array.isArray(payload.items)) {
            const rpcRes = await salesApi.completeRetailSaleRpc({
              saleId: payload.id || log.entityId,
              receiptNumber: payload.receiptNumber,
              shopId,
              items: payload.items.map((ci: any) => ({
                id: ci.item?.id || ci.id,
                sku: ci.item?.sku || ci.sku,
                title: ci.item?.title || ci.title,
                quantity: ci.quantity || 1,
                overridePrice: ci.overridePrice,
                retailPrice: ci.item?.retailPrice || ci.retailPrice || 0
              })),
              subtotal: payload.subtotal,
              vatAmount: payload.vatAmount,
              total: payload.total,
              tenderMethod: payload.tenderMethod,
              amountTendered: payload.amountTendered,
              change: payload.change,
              receiptType: payload.receiptType || 'thermal',
              customerMobile: payload.customerMobile,
              cashier: payload.cashier || 'Cashier'
            });

            if (!rpcRes.success) {
              throw new Error(rpcRes.error || 'complete_retail_sale rejected by database');
            }
          } else {
            const row = salesApi.mapSaleToRow(payload, shopId);
            await salesApi.upsertSale(row);
          }
          break;
        }

        case 'refund_approval':
        case 'refunds': {
          if (log.action === 'approve' || log.action === 'reject') {
            const isApproved = log.action === 'approve' || log.payload?.approved === true;
            const approvalRes = await refundsApi.approveRefund({
              refundId: log.payload?.refundId || log.entityId,
              approved: isApproved,
              note: log.payload?.note
            });

            if (!approvalRes.success) {
              throw new Error(approvalRes.error || 'Server rejected offline refund approval/rejection');
            }
          } else if (log.action === 'create') {
            const refundRes = await refundsApi.requestRefund({
              receiptNumber: log.payload.receiptNumber,
              itemId: log.payload.itemId,
              quantity: log.payload.quantity || 1,
              refundAmount: log.payload.refundAmount,
              reason: log.payload.reason
            });

            if (!refundRes.success) {
              throw new Error(refundRes.error || 'Server rejected offline refund request');
            }

            // TASK 2: Reconcile server-returned refundId with local Dexie record
            if (refundRes.refundId && refundRes.refundId !== log.entityId) {
              const oldId = log.entityId;
              const serverId = refundRes.refundId;

              const localReq = await db.refundRequests.get(oldId);
              if (localReq) {
                await db.refundRequests.delete(oldId);
                await db.refundRequests.put({
                  ...localReq,
                  id: serverId
                });
              }

              // Update any subsequent pending sync logs referencing oldId
              const pendingLogs = await db.syncLogs.where('entityId').equals(oldId).toArray();
              for (const pLog of pendingLogs) {
                if (pLog.id && pLog.id !== log.id) {
                  await db.syncLogs.update(pLog.id, {
                    entityId: serverId,
                    payload: pLog.payload ? { ...pLog.payload, refundId: serverId } : pLog.payload
                  });
                }
              }
            }
          }
          break;
        }

        case 'saps': {
          const row = sapsApi.mapEntryToRow(log.payload, shopId);
          await sapsApi.upsertEntry(row);
          break;
        }

        case 'rules': {
          const rules = log.payload?.rules || log.payload;
          const reason = log.payload?.reason || 'Replayed from offline business rules mutation';
          const rpcRes = await shopProfilesApi.updateShopBusinessRulesRpc(rules, reason);
          if (!rpcRes.success) {
            throw new Error(rpcRes.error || 'Server rejected business rules update');
          }
          await logsApi.createLog(
            'BUSINESS_RULES_SYNCED',
            'Sync Engine',
            { updatedFields: Object.keys(rules || {}) },
            'audit',
            undefined,
            shopId
          );
          break;
        }

        case 'shopProfile': {
          const targetShopId = log.entityId || log.payload?.id || shopId;
          if (!targetShopId) {
            throw new Error('Shop ID missing for shop profile sync');
          }
          const payload = log.payload;
          const updated = await shopProfilesApi.updateShopProfile(targetShopId, payload);
          if (!updated) {
            throw new Error('Server rejected shop profile update');
          }
          break;
        }

        default:
          throw new Error(`CRITICAL: Unrecognized entityType in sync log: ${(log as any).entityType}. Refusing to mark as completed to prevent data loss.`);
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
   * Safe check and quarantine for synthetic/legacy seed records
   */
  async quarantineLegacyRecords(): Promise<number> {
    const logs = await db.syncLogs
      .where('status')
      .anyOf('pending', 'failed')
      .toArray();

    let quarantineCount = 0;

    for (const log of logs) {
      let isSynthetic = false;
      let reason = '';

      // Check if entityId is synthetic/legacy seed format
      if (isLegacySyntheticId(log.entityId)) {
        isSynthetic = true;
        reason = `DETERMINISTIC_PERMANENT: Synthetic/legacy seed record (${log.entityId}) quarantined to prevent database type conflicts`;
      }

      // Check if critical foreign keys in payload are synthetic/legacy seed format using recursive validator
      if (!isSynthetic && log.payload) {
        const violation = getLegacySyntheticIdViolation(log.payload);
        if (violation) {
          isSynthetic = true;
          reason = `DETERMINISTIC_PERMANENT: ${violation} quarantined`;
        }
      }

      if (isSynthetic && log.id) {
        await db.syncLogs.update(log.id, {
          status: 'failed',
          error: reason
        });
        quarantineCount++;
      }
    }

    return quarantineCount;
  },

  /**
   * Process all pending or failed sync logs in batches with slow trickle rate limiting
   */
  async processAllPendingSync(
    shopId?: string,
    onProgress?: (current: number, total: number, entity: string) => void,
    trickleDelayMs = 120
  ): Promise<{ processed: number; successful: number; failed: number }> {
    if (activeSyncPromise) {
      return activeSyncPromise;
    }

    if (!shopId || !isUuid(shopId)) {
      console.error('[SyncService] Aborting sync: shopId is mandatory.');
      return { processed: 0, successful: 0, failed: 0 };
    }

    activeSyncPromise = (async () => {
      try {
        const isOnline = typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' ? navigator.onLine : true;
        if (!isSupabaseConfigured() || !isOnline) {
          return { processed: 0, successful: 0, failed: 0 };
        }

        // Quarantine legacy synthetic entries first to prevent any sync errors
        const quarantineCount = await this.quarantineLegacyRecords();
        if (quarantineCount > 0) {
          console.log(`[SyncService] Audited and quarantined ${quarantineCount} legacy/synthetic records.`);
        }

        const pendingLogs = await db.syncLogs
          .where('shopId')
          .equals(shopId)
          .and(log => log.status === 'pending' || log.status === 'failed')
          .sortBy('createdAt');

        const total = pendingLogs.length;
        if (total === 0) return { processed: 0, successful: 0, failed: 0 };

        let successful = 0;
        let failed = 0;
        let skipped = 0;

        for (let i = 0; i < total; i++) {
          const log = pendingLogs[i];

          // Skip permanent deterministic errors from background automatic syncs
          if (log.error && log.error.toUpperCase().startsWith('DETERMINISTIC_PERMANENT')) {
            skipped++;
            continue;
          }

          // Skip recoverable deterministic errors (missing shopId context) from background automatic syncs
          if (log.error && log.error.toUpperCase().startsWith('DETERMINISTIC_RECOVERABLE') && (!shopId || !isUuid(shopId))) {
            skipped++;
            continue;
          }

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

          // Trickle delay: 120ms default between sync actions to avoid rate limits
          if (trickleDelayMs > 0) {
            await new Promise(resolve => setTimeout(resolve, trickleDelayMs));
          }
        }

        return { processed: total - skipped, successful, failed };
      } finally {
        activeSyncPromise = null;
      }
    })();

    return activeSyncPromise;
  }
};
