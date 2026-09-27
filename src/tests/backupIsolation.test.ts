import { db } from '../db';
import { InventoryItem, Customer } from '../types';
import { exportDeviceBackupData, validateAndRestoreBackup } from '../utils/backupService';

/**
 * Verification Test Suite: Backup Isolation & Safe Restore
 * Tests the REAL implementation of the backup service to ensure zero-drift,
 * strict shop isolation, role authorization, and atomic rollback guarantees.
 */
export async function runBackupIsolationTests(): Promise<{ passed: boolean; logs: string[] }> {
  const logs: string[] = [];
  let passed = true;

  const log = (msg: string) => {
    logs.push(msg);
    console.log(msg);
  };

  try {
    log('--- STARTING REAL BACKUP ISOLATION TESTS ---');

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

    // Setup auth profiles
    const ownerProfileA = { role: 'owner', shop_id: shopAId, full_name: 'Owner A' };
    const adminProfileA = { role: 'admin', shop_id: shopAId, full_name: 'Admin A' };
    const ownerProfileB = { role: 'owner', shop_id: shopBId, full_name: 'Owner B' };
    const cashierProfileB = { role: 'cashier', shop_id: shopBId, full_name: 'Cashier B' };
    const seniorCashierProfileB = { role: 'senior_cashier', shop_id: shopBId, full_name: 'Senior Cashier B' };
    const managerProfileB = { role: 'manager', shop_id: shopBId, full_name: 'Manager B' };

    const shopAProfile = { id: shopAId, shop_code: 'SHOP-A', shop_name: 'Shop A' };
    const mockRules = {};

    // ==========================================================
    // TEST 1: Shop A Owner exports backup. Only Shop A records appear. Unsynced records remain.
    // ==========================================================
    const backupA = await exportDeviceBackupData(ownerProfileA, shopAProfile, mockRules);

    const hasShopBInventory = backupA.inventory?.some((i: any) => i.shopId === shopBId) ?? false;
    const hasShopBCustomer = backupA.customers?.some((c: any) => c.shopId === shopBId) ?? false;
    const hasUnsyncedShopAInventory = backupA.inventory?.some((i: any) => i.id === 'item-a2') ?? false;

    if (!hasShopBInventory && !hasShopBCustomer && hasUnsyncedShopAInventory && backupA.inventory?.length === 2) {
      log('✓ TEST 1 PASS: Shop A export isolates Shop A records only and includes unsynced local records.');
    } else {
      log('✗ TEST 1 FAIL: Export isolation failed.');
      passed = false;
    }

    // ==========================================================
    // TEST 2: Shop B Owner attempts to restore Shop A backup. Restore rejected. No writes occur.
    // ==========================================================
    let test2Rejected = false;
    try {
      await validateAndRestoreBackup(JSON.stringify(backupA), ownerProfileB);
    } catch (err: any) {
      if (err.message.includes('This backup belongs to another shop. Restore cancelled.')) {
        test2Rejected = true;
      } else {
        log(`Unexpected test 2 error: ${err.message}`);
      }
    }

    if (test2Rejected) {
      log('✓ TEST 2 PASS: Attempting to restore foreign backup rejected securely.');
    } else {
      log('✗ TEST 2 FAIL: Foreign restore was not rejected correctly.');
      passed = false;
    }

    // ==========================================================
    // TEST 3: Backup top-level matches Shop B, but one record has Shop A. Entire restore rejected. No writes.
    // ==========================================================
    const contaminatedBackup = {
      version: 5,
      shopProfile: { id: shopBId, shop_name: 'Shop B' },
      inventory: [
        {
          id: 'item-b2-contam',
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
        },
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
        }
      ]
    };

    let test3Rejected = false;
    try {
      await validateAndRestoreBackup(JSON.stringify(contaminatedBackup), ownerProfileB);
    } catch (err: any) {
      if (err.message.includes('This backup contains records from another shop. Restore cancelled.')) {
        test3Rejected = true;
      } else {
        log(`Unexpected test 3 error: ${err.message}`);
      }
    }

    const test3ItemExists = await db.inventory.get('item-b2-contam');
    if (test3Rejected && !test3ItemExists) {
      log('✓ TEST 3 PASS: Contaminated mixed-shop backup fully rejected. Zero writes occurred.');
    } else {
      log(`✗ TEST 3 FAIL: Contaminated backup not blocked correctly. Item-B2 exists: ${!!test3ItemExists}`);
      passed = false;
    }

    // ==========================================================
    // TEST 4: Valid Shop B backup restores successfully.
    // ==========================================================
    const mockItemB2: InventoryItem = {
      id: 'item-b2-valid',
      shopId: shopBId,
      sku: 'SKU-B2',
      title: 'Item B2 Valid',
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
      id: 'cust-b2-valid',
      shopId: shopBId,
      fullName: 'Customer B2 Valid',
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

    await validateAndRestoreBackup(JSON.stringify(validShopBBackup), ownerProfileB);
    const restoredB2Item = await db.inventory.get('item-b2-valid');
    const restoredB2Cust = await db.customers.get('cust-b2-valid');

    if (restoredB2Item && restoredB2Cust) {
      log('✓ TEST 4 PASS: Valid shop backup restored successfully.');
    } else {
      log('✗ TEST 4 FAIL: Valid backup restore failed.');
      passed = false;
    }

    // ==========================================================
    // TEST 5: Role authorization for export - Cashier, Senior Cashier, Manager fail. Owner, Admin pass.
    // ==========================================================
    let cashierExportFailed = false;
    let seniorCashierExportFailed = false;
    let managerExportFailed = false;
    let ownerExportSucceeded = false;
    let adminExportSucceeded = false;

    try {
      await exportDeviceBackupData(cashierProfileB, shopAProfile, mockRules);
    } catch {
      cashierExportFailed = true;
    }

    try {
      await exportDeviceBackupData(seniorCashierProfileB, shopAProfile, mockRules);
    } catch {
      seniorCashierExportFailed = true;
    }

    try {
      await exportDeviceBackupData(managerProfileB, shopAProfile, mockRules);
    } catch {
      managerExportFailed = true;
    }

    try {
      await exportDeviceBackupData(ownerProfileA, shopAProfile, mockRules);
      ownerExportSucceeded = true;
    } catch {}

    try {
      await exportDeviceBackupData(adminProfileA, shopAProfile, mockRules);
      adminExportSucceeded = true;
    } catch {}

    if (cashierExportFailed && seniorCashierExportFailed && managerExportFailed && ownerExportSucceeded && adminExportSucceeded) {
      log('✓ TEST 5 PASS: Role authorization correctly restricts export access to Owners and Admins only.');
    } else {
      log(`✗ TEST 5 FAIL: Role export checks failed. cashierExportFailed: ${cashierExportFailed}, seniorCashierExportFailed: ${seniorCashierExportFailed}, managerExportFailed: ${managerExportFailed}, ownerExportSucceeded: ${ownerExportSucceeded}, adminExportSucceeded: ${adminExportSucceeded}`);
      passed = false;
    }

    // ==========================================================
    // TEST 6: Role authorization for restore - Cashier, Senior Cashier, Manager fail. Owner, Admin pass.
    // ==========================================================
    let cashierRestoreFailed = false;
    let seniorCashierRestoreFailed = false;
    let managerRestoreFailed = false;
    let ownerRestoreSucceeded = false;
    let adminRestoreSucceeded = false;

    const validBackupToRestore = JSON.stringify(validShopBBackup);

    try {
      await validateAndRestoreBackup(validBackupToRestore, cashierProfileB);
    } catch {
      cashierRestoreFailed = true;
    }

    try {
      await validateAndRestoreBackup(validBackupToRestore, seniorCashierProfileB);
    } catch {
      seniorCashierRestoreFailed = true;
    }

    try {
      await validateAndRestoreBackup(validBackupToRestore, managerProfileB);
    } catch {
      managerRestoreFailed = true;
    }

    try {
      await validateAndRestoreBackup(validBackupToRestore, ownerProfileB);
      ownerRestoreSucceeded = true;
    } catch {}

    try {
      // Temporary change profile shop_id to test admin restore
      const adminProfileB = { role: 'admin', shop_id: shopBId, full_name: 'Admin B' };
      await validateAndRestoreBackup(validBackupToRestore, adminProfileB);
      adminRestoreSucceeded = true;
    } catch {}

    if (cashierRestoreFailed && seniorCashierRestoreFailed && managerRestoreFailed && ownerRestoreSucceeded && adminRestoreSucceeded) {
      log('✓ TEST 6 PASS: Role authorization correctly restricts restore access to Owners and Admins only.');
    } else {
      log(`✗ TEST 6 FAIL: Role restore checks failed. cashierRestoreFailed: ${cashierRestoreFailed}, seniorCashierRestoreFailed: ${seniorCashierRestoreFailed}, managerRestoreFailed: ${managerRestoreFailed}, ownerRestoreSucceeded: ${ownerRestoreSucceeded}, adminRestoreSucceeded: ${adminRestoreSucceeded}`);
      passed = false;
    }

  } catch (err: any) {
    log(`✗ EXCEPTION: Test suite threw exception: ${err.message}`);
    passed = false;
  }

  return { passed, logs };
}
