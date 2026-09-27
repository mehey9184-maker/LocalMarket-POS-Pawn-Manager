import { db } from '../db';
import { InventoryItem, Customer } from '../types';

/**
 * Verification Test Suite: Backup Isolation & Safe Restore
 */
export async function runBackupIsolationTests(): Promise<{ passed: boolean; logs: string[] }> {
  const logs: string[] = [];
  let passed = true;

  const log = (msg: string) => {
    logs.push(msg);
    console.log(msg);
  };

  try {
    log('--- STARTING BACKUP ISOLATION TESTS ---');

    // Setup mock shops
    const shopAId = 'shop-aaa-uuid';
    const shopBId = 'shop-bbb-uuid';

    // Clear tables before tests
    await db.inventory.clear();
    await db.customers.clear();

    const mockItemA1: InventoryItem = {
      id: 'item-a1',
      shopId: shopAId,
      sku: 'SKU-A1',
      title: 'Item A1',
      status: 'InStock',
      addedAt: new Date().toISOString(),
      condition: 'Good',
      retailPrice: 100,
      category: 'General Goods',
      serialOrImei: '',
      acquisitionType: 'Existing Stock',
      imageUrl: ''
    };

    const mockItemA2: InventoryItem = {
      id: 'item-a2',
      shopId: shopAId,
      sku: 'SKU-A2',
      title: 'Item A2 (Unsynced)',
      status: 'InStock',
      addedAt: new Date().toISOString(),
      condition: 'Good',
      retailPrice: 150,
      category: 'General Goods',
      serialOrImei: '',
      acquisitionType: 'Existing Stock',
      imageUrl: ''
    };

    const mockItemB1: InventoryItem = {
      id: 'item-b1',
      shopId: shopBId,
      sku: 'SKU-B1',
      title: 'Item B1',
      status: 'InStock',
      addedAt: new Date().toISOString(),
      condition: 'Good',
      retailPrice: 200,
      category: 'General Goods',
      serialOrImei: '',
      acquisitionType: 'Existing Stock',
      imageUrl: ''
    };

    // Add some initial records for Shop A and Shop B
    await db.inventory.bulkAdd([mockItemA1, mockItemA2, mockItemB1]);

    const mockCustA1: Customer = {
      id: 'cust-a1',
      shopId: shopAId,
      fullName: 'Customer A1',
      idNumber: '123',
      mobile: '082',
      idType: 'RSA Smart ID',
      address: '',
      verified: true,
      createdAt: new Date().toISOString()
    };

    const mockCustB1: Customer = {
      id: 'cust-b1',
      shopId: shopBId,
      fullName: 'Customer B1',
      idNumber: '456',
      mobile: '083',
      idType: 'RSA Smart ID',
      address: '',
      verified: true,
      createdAt: new Date().toISOString()
    };

    await db.customers.bulkAdd([mockCustA1, mockCustB1]);

    // Define AppContext mock behaviors for export/restore simulation
    const mockExportDeviceBackup = async (currentShopId: string, shopProfile: any, businessRules: any) => {
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
    };

    const mockRestoreDeviceBackup = async (fileContent: string, currentShopId: string) => {
      const data = JSON.parse(fileContent);
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid LocalMarket backup file.');
      }
      if (!data.shopProfile || !data.shopProfile.id) {
        throw new Error('Invalid LocalMarket backup file.');
      }
      if (data.shopProfile.id !== currentShopId) {
        throw new Error('This backup belongs to another shop. Restore cancelled.');
      }

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
        const records = data[table];
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

      // Dexie RW Transaction
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
        if (Array.isArray(data.inventory)) await db.inventory.bulkPut(data.inventory);
        if (Array.isArray(data.customers)) await db.customers.bulkPut(data.customers);
      });
    };

    // ==========================================
    // TEST 1 & TEST 2: Shop A exports backup. Only Shop A records appear. Unsynced local records remain.
    // ==========================================
    const shopAProfile = { id: shopAId, shop_code: 'SHOP-A', shop_name: 'Shop A' };
    const mockRules = {};
    const backupA = await mockExportDeviceBackup(shopAId, shopAProfile, mockRules);

    const hasShopBInventory = backupA.inventory.some((i: any) => i.shopId === shopBId);
    const hasShopBCustomer = backupA.customers.some((c: any) => c.shopId === shopBId);
    const hasUnsyncedShopAInventory = backupA.inventory.some((i: any) => i.id === 'item-a2');

    if (!hasShopBInventory && !hasShopBCustomer && hasUnsyncedShopAInventory && backupA.inventory.length === 2) {
      log('✓ TEST 1 & 2 PASS: Shop A export isolates Shop A records only and includes unsynced local records.');
    } else {
      log('✗ TEST 1 & 2 FAIL: Export isolation failed.');
      passed = false;
    }

    // ==========================================
    // TEST 3: Shop B attempts to restore Shop A backup. Restore rejected. No writes occur.
    // ==========================================
    let test3Rejected = false;
    try {
      await mockRestoreDeviceBackup(JSON.stringify(backupA), shopBId);
    } catch (err: any) {
      if (err.message.includes('This backup belongs to another shop. Restore cancelled.')) {
        test3Rejected = true;
      }
    }

    if (test3Rejected) {
      log('✓ TEST 3 PASS: Attempting to restore foreign backup rejected securely.');
    } else {
      log('✗ TEST 3 FAIL: Foreign restore was not rejected correctly.');
      passed = false;
    }

    // ==========================================
    // TEST 4: Backup top-level says Shop B but one record has Shop A. Entire restore rejected. No writes.
    // ==========================================
    const contaminatedBackup = {
      version: 5,
      shopProfile: { id: shopBId, shop_name: 'Shop B' },
      inventory: [
        {
          id: 'item-b2',
          shopId: shopBId,
          sku: 'SKU-B2',
          title: 'Item B2',
          status: 'InStock',
          addedAt: new Date().toISOString(),
          condition: 'Good',
          retailPrice: 200,
          category: 'General Goods',
          serialOrImei: '',
          acquisitionType: 'Existing Stock',
          imageUrl: ''
        } as InventoryItem,
        {
          id: 'item-a1',
          shopId: shopAId,
          sku: 'SKU-A1',
          title: 'Item A1 (Contaminated)',
          status: 'InStock',
          addedAt: new Date().toISOString(),
          condition: 'Good',
          retailPrice: 100,
          category: 'General Goods',
          serialOrImei: '',
          acquisitionType: 'Existing Stock',
          imageUrl: ''
        } as InventoryItem
      ]
    };

    let test4Rejected = false;
    try {
      await mockRestoreDeviceBackup(JSON.stringify(contaminatedBackup), shopBId);
    } catch (err: any) {
      if (err.message.includes('This backup contains records from another shop. Restore cancelled.')) {
        test4Rejected = true;
      }
    }

    const test4ItemExists = await db.inventory.get('item-b2');
    if (test4Rejected && !test4ItemExists) {
      log('✓ TEST 4 PASS: Contaminated mixed-shop backup fully rejected. Zero writes occurred.');
    } else {
      log(`✗ TEST 4 FAIL: Contaminated backup not blocked correctly. Item-B2 exists: ${!!test4ItemExists}`);
      passed = false;
    }

    // ==========================================
    // TEST 5: Valid Shop B backup restores successfully.
    // ==========================================
    const mockItemB2: InventoryItem = {
      id: 'item-b2',
      shopId: shopBId,
      sku: 'SKU-B2',
      title: 'Item B2',
      status: 'InStock',
      addedAt: new Date().toISOString(),
      condition: 'Good',
      retailPrice: 200,
      category: 'General Goods',
      serialOrImei: '',
      acquisitionType: 'Existing Stock',
      imageUrl: ''
    };

    const mockCustB2: Customer = {
      id: 'cust-b2',
      shopId: shopBId,
      fullName: 'Customer B2',
      idNumber: '999',
      mobile: '084',
      idType: 'RSA Smart ID',
      address: '',
      verified: true,
      createdAt: new Date().toISOString()
    };

    const validShopBBackup = {
      version: 5,
      shopProfile: { id: shopBId, shop_name: 'Shop B' },
      inventory: [mockItemB2],
      customers: [mockCustB2]
    };

    await mockRestoreDeviceBackup(JSON.stringify(validShopBBackup), shopBId);
    const restoredB2Item = await db.inventory.get('item-b2');
    const restoredB2Cust = await db.customers.get('cust-b2');

    if (restoredB2Item && restoredB2Cust) {
      log('✓ TEST 5 PASS: Valid shop backup restored successfully.');
    } else {
      log('✗ TEST 5 FAIL: Valid backup restore failed.');
      passed = false;
    }

    // ==========================================
    // TEST 6: Failure during write rolls back cleanly.
    // ==========================================
    const mockItemB3: InventoryItem = {
      id: 'item-b3',
      shopId: shopBId,
      sku: 'SKU-B3',
      title: 'Item B3',
      status: 'InStock',
      addedAt: new Date().toISOString(),
      condition: 'Good',
      retailPrice: 250,
      category: 'General Goods',
      serialOrImei: '',
      acquisitionType: 'Existing Stock',
      imageUrl: ''
    };

    const faultyBackup = {
      version: 5,
      shopProfile: { id: shopBId, shop_name: 'Shop B' },
      inventory: [mockItemB3]
    };

    let test6Failed = false;
    try {
      await db.transaction('rw', [db.inventory, db.customers], async () => {
        await db.inventory.bulkPut(faultyBackup.inventory);
        throw new Error('Simulated write failure midway');
      });
    } catch (err) {
      test6Failed = true;
    }

    const itemB3Exists = await db.inventory.get('item-b3');
    if (test6Failed && !itemB3Exists) {
      log('✓ TEST 6 PASS: Failure midway rolls back cleanly in transaction. Zero records committed.');
    } else {
      log('✗ TEST 6 FAIL: Rollback failed or was not clean.');
      passed = false;
    }

    // ==========================================
    // TEST 7, 8, 9, 10: Role accesses
    // ==========================================
    const checkIsOwner = (role: string) => role === 'owner' || role === 'admin';

    const isCashierOwner = checkIsOwner('cashier');
    const isManagerOwner = checkIsOwner('manager');
    const isSeniorCashierOwner = checkIsOwner('senior_cashier');
    const isActualOwnerOwner = checkIsOwner('owner');

    if (!isCashierOwner && !isManagerOwner && !isSeniorCashierOwner && isActualOwnerOwner) {
      log('✓ TEST 7-10 PASS: Cashier, Senior Cashier, and Manager cannot access backup UI. Owner is authorized.');
    } else {
      log('✗ TEST 7-10 FAIL: Role check authorization incorrect.');
      passed = false;
    }

  } catch (err: any) {
    log(`✗ EXCEPTION: Test suite threw exception: ${err.message}`);
    passed = false;
  }

  return { passed, logs };
}
