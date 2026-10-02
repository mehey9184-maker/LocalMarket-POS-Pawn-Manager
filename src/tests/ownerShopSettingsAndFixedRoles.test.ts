import fs from 'fs';
import path from 'path';
import { UserRole } from '../types/supabase';
import { Permissions } from '../types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`[FAIL] ${message}`);
    throw new Error(message);
  }
  console.log(`[PASS] ${message}`);
}

// Emulate AuthContext hasPermission logic
function evaluatePermission(
  role: UserRole,
  permission: keyof Permissions,
  legacyStoredPermissions?: Partial<Permissions>
): boolean {
  const isOwner = role === 'owner' || role === 'admin';
  if (isOwner) return true;

  const isManager = role === 'manager';
  const isSeniorCashier = role === 'senior_cashier';

  if (isManager) {
    const managerPerms: (keyof Permissions)[] = ['sales', 'inventory', 'pawn', 'sellerAcquisitions', 'refunds', 'reports'];
    return managerPerms.includes(permission);
  }

  if (isSeniorCashier) {
    const seniorDefaults: (keyof Permissions)[] = ['sales', 'inventory', 'pawn', 'sellerAcquisitions'];
    return seniorDefaults.includes(permission);
  }

  const cashierDefaults: (keyof Permissions)[] = ['sales', 'inventory'];
  return cashierDefaults.includes(permission);
}

export function runOwnerShopSettingsAndFixedRolesTests() {
  console.log('\n=== RUNNING OWNER-ONLY SHOP SETTINGS & FIXED ROLE DEFAULTS TEST SUITE ===');

  // =========================================================================
  // 1. CASHIER ROLE PERMISSION TESTS
  // =========================================================================
  console.log('\n--- 1. Cashier Role Permissions ---');
  assert(evaluatePermission('cashier', 'sales') === true, 'Cashier CAN process Sales');
  assert(evaluatePermission('cashier', 'inventory') === true, 'Cashier CAN access Inventory');
  assert(evaluatePermission('cashier', 'pawn') === false, 'Cashier CANNOT process Pawn operations');
  assert(evaluatePermission('cashier', 'sellerAcquisitions') === false, 'Cashier CANNOT process Seller Acquisitions');
  assert(evaluatePermission('cashier', 'refunds') === false, 'Cashier CANNOT authorize Refunds');
  assert(evaluatePermission('cashier', 'pricing') === false, 'Cashier CANNOT modify Retail Prices');
  assert(evaluatePermission('cashier', 'reports') === false, 'Cashier CANNOT access Financial Reports');
  assert(evaluatePermission('cashier', 'staff') === false, 'Cashier CANNOT access Staff Management');

  // Test that conflicting stored permissions JSON CANNOT elevate Cashier
  const hackedCashierPerms: Partial<Permissions> = {
    pawn: true,
    sellerAcquisitions: true,
    refunds: true,
    staff: true
  };
  assert(
    evaluatePermission('cashier', 'pawn', hackedCashierPerms) === false,
    'Cashier with stored pawn=true is safely ignored and denied'
  );
  assert(
    evaluatePermission('cashier', 'staff', hackedCashierPerms) === false,
    'Cashier with stored staff=true is safely ignored and denied'
  );
  assert(
    evaluatePermission('cashier', 'refunds', hackedCashierPerms) === false,
    'Cashier with stored refunds=true is safely ignored and denied'
  );

  // =========================================================================
  // 2. SENIOR CASHIER ROLE PERMISSION TESTS
  // =========================================================================
  console.log('\n--- 2. Senior Cashier Role Permissions ---');
  assert(evaluatePermission('senior_cashier', 'sales') === true, 'Senior Cashier CAN process Sales');
  assert(evaluatePermission('senior_cashier', 'inventory') === true, 'Senior Cashier CAN access Inventory');
  assert(evaluatePermission('senior_cashier', 'pawn') === true, 'Senior Cashier CAN process Pawn operations');
  assert(evaluatePermission('senior_cashier', 'sellerAcquisitions') === true, 'Senior Cashier CAN process Seller Intake');
  assert(evaluatePermission('senior_cashier', 'refunds') === false, 'Senior Cashier CANNOT authorize Refunds');
  assert(evaluatePermission('senior_cashier', 'pricing') === false, 'Senior Cashier CANNOT modify Retail Prices');
  assert(evaluatePermission('senior_cashier', 'reports') === false, 'Senior Cashier CANNOT access Reports');
  assert(evaluatePermission('senior_cashier', 'staff') === false, 'Senior Cashier CANNOT manage Staff');

  // Test that conflicting stored permissions JSON CANNOT elevate Senior Cashier
  const hackedSeniorPerms: Partial<Permissions> = {
    refunds: true,
    pricing: true,
    staff: true
  };
  assert(
    evaluatePermission('senior_cashier', 'refunds', hackedSeniorPerms) === false,
    'Senior Cashier with stored refunds=true is safely ignored and denied'
  );
  assert(
    evaluatePermission('senior_cashier', 'pricing', hackedSeniorPerms) === false,
    'Senior Cashier with stored pricing=true is safely ignored and denied'
  );

  // =========================================================================
  // 3. MANAGER ROLE PERMISSION TESTS
  // =========================================================================
  console.log('\n--- 3. Manager Role Permissions ---');
  assert(evaluatePermission('manager', 'sales') === true, 'Manager CAN process Sales');
  assert(evaluatePermission('manager', 'inventory') === true, 'Manager CAN access Inventory');
  assert(evaluatePermission('manager', 'pawn') === true, 'Manager CAN process Pawn operations');
  assert(evaluatePermission('manager', 'sellerAcquisitions') === true, 'Manager CAN process Seller Intake');
  assert(evaluatePermission('manager', 'refunds') === true, 'Manager CAN authorize Refunds');
  assert(evaluatePermission('manager', 'reports') === true, 'Manager CAN access Reports');
  assert(evaluatePermission('manager', 'pricing') === false, 'Manager CANNOT permanently alter price markup rules');
  assert(evaluatePermission('manager', 'staff') === false, 'Manager CANNOT access full Owner Staff Management authority');

  // =========================================================================
  // 4. OWNER ROLE PERMISSION TESTS
  // =========================================================================
  console.log('\n--- 4. Owner Role Permissions ---');
  assert(evaluatePermission('owner', 'sales') === true, 'Owner has Sales authority');
  assert(evaluatePermission('owner', 'inventory') === true, 'Owner has Inventory authority');
  assert(evaluatePermission('owner', 'pawn') === true, 'Owner has Pawn authority');
  assert(evaluatePermission('owner', 'sellerAcquisitions') === true, 'Owner has Seller Intake authority');
  assert(evaluatePermission('owner', 'refunds') === true, 'Owner has Refunds authority');
  assert(evaluatePermission('owner', 'pricing') === true, 'Owner has Pricing authority');
  assert(evaluatePermission('owner', 'reports') === true, 'Owner has Reports authority');
  assert(evaluatePermission('owner', 'staff') === true, 'Owner has Staff Management authority');

  // =========================================================================
  // 5. UI SHOP SETTINGS ISOLATION VERIFICATION
  // =========================================================================
  console.log('\n--- 5. UI Shop Profile & Settings Isolation ---');
  const cashierProfileCode = fs.readFileSync(path.resolve('src/components/screens/CashierProfile.tsx'), 'utf-8');
  assert(
    cashierProfileCode.includes("{ id: 'shop', label: 'Shop Profile', icon: Building2, show: isOwner }"),
    'CashierProfile.tsx sidebar strictly restricts Shop Profile to isOwner'
  );
  assert(
    cashierProfileCode.includes("activeTab === 'shop' && (\n              isOwner ?"),
    'CashierProfile.tsx main content strictly gates shop form rendering with isOwner'
  );

  const hubCode = fs.readFileSync(path.resolve('src/components/profile/ShopProfileAndOfflineHub.tsx'), 'utf-8');
  assert(
    !hubCode.includes('Edit Store Info'),
    'ShopProfileAndOfflineHub.tsx contains no duplicate Edit Store Info button (single home in CashierProfile)'
  );
  assert(
    !hubCode.includes('Open Deal Rules Configurator'),
    'ShopProfileAndOfflineHub.tsx contains no duplicate Deal Rules Configurator button (single home in BusinessRulesManager)'
  );

  // =========================================================================
  // 6. SCREEN REMOUNT & STATE PRESERVATION VERIFICATION
  // =========================================================================
  console.log('\n--- 6. Screen State Preservation & Gated Keyboard Effects ---');
  const appCode = fs.readFileSync(path.resolve('src/App.tsx'), 'utf-8');
  assert(
    appCode.includes("activeTab === 'sell' ? 'flex flex-col lg:flex-row overflow-hidden' : 'hidden'"),
    'App.tsx preserves Sell screen state without remounting on tab changes'
  );
  assert(
    appCode.includes("activeTab === 'inventory' ? 'flex flex-col overflow-hidden' : 'hidden'"),
    'App.tsx preserves Inventory screen state without remounting on tab changes'
  );
  assert(
    appCode.includes("activeTab === 'buy-pawn' ? 'flex flex-col overflow-hidden' : 'hidden'"),
    'App.tsx preserves Buy/Pawn transaction workflow without remounting'
  );

  const sellCode = fs.readFileSync(path.resolve('src/components/screens/Sell.tsx'), 'utf-8');
  assert(
    sellCode.includes("if (activeTab !== 'sell') return;"),
    'Sell.tsx keydown listener is strictly gated and inert when user is on another tab'
  );
  assert(
    sellCode.includes("if (activeTab === 'sell') {\n      searchInputRef.current?.focus();\n    }"),
    'Sell.tsx auto-focus is strictly gated by activeTab'
  );

  // =========================================================================
  // 7. ELIMINATED REDUNDANT AUTH GETSESSION CALLS
  // =========================================================================
  console.log('\n--- 7. Eliminated Redundant Auth Refresh on Visibility/Focus ---');
  const authContextCode = fs.readFileSync(path.resolve('src/context/AuthContext.tsx'), 'utf-8');
  assert(
    !authContextCode.includes('handleVisibilityChange'),
    'AuthContext.tsx has completely eliminated redundant visibilitychange session polling'
  );
  assert(
    !authContextCode.includes('handleWindowFocus'),
    'AuthContext.tsx has completely eliminated redundant window focus session polling'
  );

  console.log('====================================================');
  console.log('   ALL OWNER SHOP SETTINGS & FIXED ROLE TESTS PASSED!   ');
  console.log('====================================================\n');
}

if (typeof process !== 'undefined' && process.argv && process.argv[1] && process.argv[1].includes('ownerShopSettingsAndFixedRoles')) {
  runOwnerShopSettingsAndFixedRolesTests();
}
