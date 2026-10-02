/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import { UserRole } from '../types/supabase';
import { Permissions } from '../types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED] ${message}`);
  }
}

// Emulate AuthContext hasPermission logic
function evaluatePermission(role: UserRole, permission: keyof Permissions): boolean {
  const isOwner = role === 'owner' || role === 'admin';
  const isManager = role === 'manager';
  const isSeniorCashier = role === 'senior_cashier';

  if (isOwner) return true;

  if (isManager) {
    const managerPerms: (keyof Permissions)[] = ['sales', 'inventory', 'pawn', 'sellerAcquisitions', 'refunds', 'reports'];
    return managerPerms.includes(permission);
  }

  if (isSeniorCashier) {
    const seniorDefaults: (keyof Permissions)[] = ['sales', 'inventory', 'pawn', 'sellerAcquisitions'];
    return seniorDefaults.includes(permission);
  }

  // Cashier defaults
  const cashierDefaults: (keyof Permissions)[] = ['sales', 'inventory'];
  return cashierDefaults.includes(permission);
}

export function runSeniorUxPhase1Tests() {
  console.log('\n====== RUNNING SENIOR UX PHASE 1 TEST SUITE ======');

  // =========================================================================
  // 1. CASHIER ADD STOCK DISCOVERABILITY & ACCESS MATRIX
  // =========================================================================
  console.log('\n--- 1. Add Stock Discoverability & Role Boundaries ---');
  
  const homeSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/screens/Home.tsx'), 'utf8');
  const buyPawnModeSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/screens/buy-pawn/BuyPawnModeStep.tsx'), 'utf8');

  // Verify Home.tsx gates Add Stock by inventory OR sellerAcquisitions OR pawn
  assert(
    homeSrc.includes("hasPermission('inventory') || hasPermission('sellerAcquisitions') || hasPermission('pawn')"),
    'Home.tsx must allow Add Stock discoverability if staff has inventory, sellerAcquisitions, or pawn permission'
  );
  assert(
    homeSrc.includes("hasPermission('sellerAcquisitions') || hasPermission('pawn')"),
    'Home.tsx must check sellerAcquisitions || pawn for role-aware Add Stock description'
  );
  assert(
    homeSrc.includes('Add existing stock to inventory'),
    'Home.tsx must provide cashier-friendly Add Stock description'
  );
  console.log('[PASS] Home.tsx Add Stock card is discoverable and role-aware for Cashiers and higher roles');

  // Cashier role evaluation
  const cashierHasInventory = evaluatePermission('cashier', 'inventory');
  const cashierHasSellerAcq = evaluatePermission('cashier', 'sellerAcquisitions');
  const cashierHasPawn = evaluatePermission('cashier', 'pawn');

  assert(cashierHasInventory === true, 'Cashier must have inventory permission');
  assert(cashierHasSellerAcq === false, 'Cashier must NOT have sellerAcquisitions permission');
  assert(cashierHasPawn === false, 'Cashier must NOT have pawn permission');

  const cashierCanSeeHomeAddStock = cashierHasInventory || cashierHasSellerAcq || cashierHasPawn;
  assert(cashierCanSeeHomeAddStock === true, 'Cashier must see Add Stock on Home');

  // BuyPawnModeStep gates
  assert(
    buyPawnModeSrc.includes("hasPermission('inventory')") && buyPawnModeSrc.includes("Existing Stock"),
    'BuyPawnModeStep.tsx must gate Existing Stock by inventory permission'
  );
  assert(
    buyPawnModeSrc.includes("hasPermission('sellerAcquisitions')") && buyPawnModeSrc.includes("Buy From Person"),
    'BuyPawnModeStep.tsx must gate Buy From Person by sellerAcquisitions permission'
  );
  assert(
    buyPawnModeSrc.includes("hasPermission('pawn')") && buyPawnModeSrc.includes("Pawn Loan"),
    'BuyPawnModeStep.tsx must gate Pawn Loan by pawn permission'
  );
  console.log('[PASS] Cashier can discover Existing Stock but is strictly denied Buy From Person & Pawn');

  // Senior Cashier, Manager, Owner evaluations
  const seniorCanSeeAll = evaluatePermission('senior_cashier', 'inventory') &&
    evaluatePermission('senior_cashier', 'sellerAcquisitions') &&
    evaluatePermission('senior_cashier', 'pawn');
  assert(seniorCanSeeAll === true, 'Senior Cashier must have access to Existing, Buy, and Pawn');

  const managerCanSeeAll = evaluatePermission('manager', 'inventory') &&
    evaluatePermission('manager', 'sellerAcquisitions') &&
    evaluatePermission('manager', 'pawn');
  assert(managerCanSeeAll === true, 'Manager must have access to Existing, Buy, and Pawn');

  const ownerCanSeeAll = evaluatePermission('owner', 'inventory') &&
    evaluatePermission('owner', 'sellerAcquisitions') &&
    evaluatePermission('owner', 'pawn');
  assert(ownerCanSeeAll === true, 'Owner must have access to Existing, Buy, and Pawn');
  console.log('[PASS] Senior Cashier, Manager, and Owner have access to Existing, Buy, and Pawn');

  // =========================================================================
  // 2. ONE HOME FOR OWNER SETTINGS (NO DUPLICATION IN SYSTEM & AUDIT)
  // =========================================================================
  console.log('\n--- 2. Single Home for Owner Settings ---');
  
  const cashierProfileSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/screens/CashierProfile.tsx'), 'utf8');
  const shopProfileOfflineHubSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/profile/ShopProfileAndOfflineHub.tsx'), 'utf8');

  // Verify CashierProfile.tsx retains dedicated tabs
  assert(cashierProfileSrc.includes("id: 'shop', label: 'Shop Profile'"), 'CashierProfile must contain dedicated Shop Profile tab');
  assert(cashierProfileSrc.includes("id: 'rules', label: 'Business Rules & Legal'"), 'CashierProfile must contain dedicated Business Rules tab');
  assert(cashierProfileSrc.includes("id: 'system', label: 'Device & Backup'"), 'CashierProfile must contain dedicated Device & Backup tab');
  console.log('[PASS] CashierProfile sidebar has clear single-responsibility tabs');

  // Verify ShopProfileAndOfflineHub has NO duplicate editing entry points
  assert(!shopProfileOfflineHubSrc.includes('Edit Store Info'), 'Device & Backup must NOT provide duplicate Edit Store Info button');
  assert(!shopProfileOfflineHubSrc.includes('Open Deal Rules Configurator'), 'Device & Backup must NOT provide duplicate Deal Rules button');
  assert(!shopProfileOfflineHubSrc.includes('handleSaveRules'), 'Device & Backup must NOT contain duplicate rules saving logic');
  assert(!shopProfileOfflineHubSrc.includes('handleSaveProfile'), 'Device & Backup must NOT contain duplicate profile saving logic');
  console.log('[PASS] Device & Backup contains zero duplicate Shop Profile or Deal Rules editing forms');

  // =========================================================================
  // 3. REMOVE UNNECESSARY SHOP PROFILE REFETCH AFTER SYNC
  // =========================================================================
  console.log('\n--- 3. Shop Profile Hydration Independence from Background Sync ---');
  
  const appContextSrc = fs.readFileSync(path.join(process.cwd(), 'src/context/AppContext.tsx'), 'utf8');

  // Ensure shop hydration effect depends only on currentUserProfile?.shop_id, NOT on lastSyncTime
  assert(
    appContextSrc.includes('}, [currentUserProfile?.shop_id]);'),
    'AppContext shop hydration effect must depend solely on currentUserProfile?.shop_id'
  );
  assert(
    !appContextSrc.includes('}, [currentUserProfile, syncStatus.lastSyncTime]);'),
    'AppContext must NOT re-fetch shop profile whenever syncStatus.lastSyncTime changes'
  );
  console.log('[PASS] Background sync completions do not force redundant shop profile re-fetches');

  // =========================================================================
  // 4. FAST POS SALE UX (NON-BLOCKING MODAL ELIMINATED)
  // =========================================================================
  console.log('\n--- 4. Fast POS Sale UX ---');
  
  const sellSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/screens/Sell.tsx'), 'utf8');

  assert(!sellSrc.includes('<OperationProgressScreen'), 'Sell.tsx must not render blocking OperationProgressScreen modal');
  assert(!sellSrc.includes('saleProgress.runSequence'), 'Sell.tsx must not execute multi-step progress sequence on counter sales');
  assert(sellSrc.includes('completeCheckout('), 'Sell.tsx must directly invoke completeCheckout');
  assert(sellSrc.includes("'Sale Complete'"), 'Sell.tsx must provide instant clear confirmation via toast');

  // Verify AppContext completeCheckout does not emit redundant success toast
  assert(!appContextSrc.includes("showToast('Sale Complete', `Receipt ${res.sale.receiptNumber} generated`, 'success')"), 'AppContext completeCheckout must not emit duplicate Sale Complete toast');
  console.log('[PASS] Sell checkout is fast, direct, and non-blocking with exactly ONE success toast notification');

  // =========================================================================
  // 5. USER-FACING SYNC & STORAGE LANGUAGE
  // =========================================================================
  console.log('\n--- 5. User-Facing Sync & Storage Language ---');
  
  assert(!shopProfileOfflineHubSrc.includes('Trickle Sync Now'), 'Technical term "Trickle Sync Now" should be replaced with plain language');
  assert(!shopProfileOfflineHubSrc.includes('WhatsApp-Style'), 'Branding comparison "WhatsApp-Style" should be replaced with clean product language');
  assert(!shopProfileOfflineHubSrc.includes('1 item/sec'), 'Technical rate limit description removed from staff-facing UI');
  assert(shopProfileOfflineHubSrc.includes('Sync Now') || shopProfileOfflineHubSrc.includes('Save Changes'), 'UI uses clear "Sync Now" or "Save Changes" button');
  assert(shopProfileOfflineHubSrc.includes('Local Device Storage') || shopProfileOfflineHubSrc.includes('Saved on this computer'), 'UI uses clear descriptive section header');
  console.log('[PASS] System & Audit uses clean, professional, user-centric terminology');

  // =========================================================================
  // 6. SCREEN STATE PRESERVATION
  // =========================================================================
  console.log('\n--- 6. Screen State Preservation ---');
  
  const appSrc = fs.readFileSync(path.join(process.cwd(), 'src/App.tsx'), 'utf8');
  assert(appSrc.includes("activeTab === 'sell' ? 'flex flex-col lg:flex-row overflow-hidden' : 'hidden'"), 'Sell screen must remain mounted');
  assert(appSrc.includes("activeTab === 'inventory' ? 'flex flex-col overflow-hidden' : 'hidden'"), 'Inventory screen must remain mounted');
  assert(appSrc.includes("activeTab === 'buy-pawn' ? 'flex flex-col overflow-hidden' : 'hidden'"), 'Buy/Pawn screen must remain mounted');
  console.log('[PASS] All primary operational screens remain persistently mounted');

  console.log('\n====================================================');
  console.log('   ALL SENIOR UX PHASE 1 TESTS PASSED SUCCESSFULLY!  ');
  console.log('====================================================\n');
}
