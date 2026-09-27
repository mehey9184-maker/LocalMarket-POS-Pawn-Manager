import { db } from '../db';

/**
 * LocalMarket Device Backup & Safe Restore Business Logic (Pure Functions)
 * This separates the core safety, authorization, and validation logic from UI-specific code
 * to allow direct, identical execution in both AppContext and the test suite.
 */

export interface BackupPayload {
  version: number;
  exportedAt: string;
  shopProfile: any;
  businessRules: any;
  inventory?: any[];
  customers?: any[];
  sellers?: any[];
  sellerTransactions?: any[];
  loans?: any[];
  saps?: any[];
  sales?: any[];
  refundRequests?: any[];
}

/**
 * Validates Owner authority and exports device data for the authenticated shop.
 */
export async function exportDeviceBackupData(
  currentUserProfile: any,
  shopProfile: any,
  businessRules: any
): Promise<BackupPayload> {
  const isOwner = currentUserProfile?.role === 'owner' || currentUserProfile?.role === 'admin';
  if (!isOwner) {
    throw new Error('Unauthorized: Owner authority required to export device backup.');
  }

  const currentShopId = currentUserProfile?.shop_id;
  if (!currentShopId) {
    throw new Error('No authenticated shop context found to perform backup.');
  }

  return {
    version: 5,
    exportedAt: new Date().toISOString(),
    shopProfile,
    businessRules,
    inventory: await db.inventory.where('shopId').equals(currentShopId).toArray(),
    customers: await db.customers.where('shopId').equals(currentShopId).toArray(),
    sellers: await db.sellers.where('shopId').equals(currentShopId).toArray(),
    sellerTransactions: await db.sellerTransactions.where('shopId').equals(currentShopId).toArray(),
    loans: await db.loans.where('shopId').equals(currentShopId).toArray(),
    saps: await db.saps.where('shopId').equals(currentShopId).toArray(),
    sales: await db.sales.where('shopId').equals(currentShopId).toArray(),
    refundRequests: await db.refundRequests.where('shopId').equals(currentShopId).toArray()
  };
}

/**
 * Preflight checks, parses, and restores database state from a backup file content string.
 * Completely rejects unauthorized actions, mismatched shops, or contaminated records BEFORE any writes.
 */
export async function validateAndRestoreBackup(
  fileContent: string,
  currentUserProfile: any
): Promise<BackupPayload> {
  const isOwner = currentUserProfile?.role === 'owner' || currentUserProfile?.role === 'admin';
  if (!isOwner) {
    throw new Error('Unauthorized: Owner authority required to restore device backup.');
  }

  // A. Parse JSON safely
  let data: BackupPayload;
  try {
    data = JSON.parse(fileContent);
  } catch (parseErr) {
    throw new Error('Invalid LocalMarket backup file.');
  }

  // B. Confirm this is a supported LocalMarket backup format
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid LocalMarket backup file.');
  }

  // C. Require a valid shop identity in the backup
  if (!data.shopProfile || !data.shopProfile.id) {
    throw new Error('Invalid LocalMarket backup file.');
  }

  const currentShopId = currentUserProfile?.shop_id;
  if (!currentShopId) {
    throw new Error('No active shop context identified.');
  }

  const backupShopId = data.shopProfile.id;

  // D. Compare the backup shop identity against the CURRENT authenticated shop
  if (backupShopId !== currentShopId) {
    throw new Error('This backup belongs to another shop. Restore cancelled.');
  }

  // E. Validate EVERY record in EVERY backup table that contains shopId
  const tablesToValidate = [
    'inventory',
    'customers',
    'sellers',
    'sellerTransactions',
    'loans',
    'saps',
    'sales',
    'refundRequests'
  ];

  for (const table of tablesToValidate) {
    const records = (data as any)[table];
    if (records !== undefined) {
      if (!Array.isArray(records)) {
        throw new Error('Invalid LocalMarket backup file.');
      }
      for (const record of records) {
        if (!record || record.shopId !== currentShopId) {
          throw new Error('This backup contains records from another shop. Restore cancelled.');
        }
      }
    }
  }

  // F. ZERO WRITES BEFORE VALIDATION PASSES
  // Wrap the local Dexie table restoration in ONE Dexie transaction
  try {
    await db.transaction('rw', [
      db.inventory,
      db.customers,
      db.sellers,
      db.sellerTransactions,
      db.loans,
      db.saps,
      db.sales,
      db.refundRequests
    ], async () => {
      if (Array.isArray(data.inventory)) {
        await db.inventory.bulkPut(data.inventory);
      }
      if (Array.isArray(data.customers)) {
        await db.customers.bulkPut(data.customers);
      }
      if (Array.isArray(data.sellers)) {
        await db.sellers.bulkPut(data.sellers);
      }
      if (Array.isArray(data.sellerTransactions)) {
        await db.sellerTransactions.bulkPut(data.sellerTransactions);
      }
      if (Array.isArray(data.loans)) {
        await db.loans.bulkPut(data.loans);
      }
      if (Array.isArray(data.saps)) {
        await db.saps.bulkPut(data.saps);
      }
      if (Array.isArray(data.sales)) {
        await db.sales.bulkPut(data.sales);
      }
      if (Array.isArray(data.refundRequests)) {
        await db.refundRequests.bulkPut(data.refundRequests);
      }
    });
  } catch (writeErr: any) {
    console.error('Dexie transaction failed:', writeErr);
    throw new Error('Restore could not be completed. No partial restore should remain.');
  }

  return data;
}
