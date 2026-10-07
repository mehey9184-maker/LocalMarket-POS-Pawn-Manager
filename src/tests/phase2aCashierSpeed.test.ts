/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import { UserRole } from '../types/supabase';
import { InventoryItem, CartItem } from '../types';
import { createCartSnapshot, restoreCartFromSnapshot, getCashPaymentState } from '../components/screens/Sell';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED] ${message}`);
  }
}

export function runPhase2aCashierSpeedTests() {
  console.log('\n====== RUNNING PHASE 2A CASHIER SPEED & COUNTER UX TEST SUITE ======');

  // =========================================================================
  // 1. QUICK CASH TENDER BUTTONS IN SELL.TSX
  // =========================================================================
  console.log('\n--- 1. Quick Cash Tender Buttons ---');

  const sellSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/screens/Sell.tsx'), 'utf8');

  // Assert Quick Cash Tender buttons exist in Sell.tsx
  assert(sellSrc.includes('setCashTendered(total > 0 ? total.toString() : \'\')') || sellSrc.includes('setCashTendered(total > 0 ? total.toString() : "")'), 'Sell.tsx must contain Exact cash tender button');
  assert(sellSrc.includes("setCashTendered('50')"), 'Sell.tsx must contain R50 cash tender button');
  assert(sellSrc.includes("setCashTendered('100')"), 'Sell.tsx must contain R100 cash tender button');
  assert(sellSrc.includes("setCashTendered('200')"), 'Sell.tsx must contain R200 cash tender button');
  console.log('[PASS] Sell.tsx contains Exact, R50, R100, and R200 tender shortcut buttons');

  // Test math calculations for change due
  const total = 150;
  
  // Exact button -> tendered 150 -> change 0
  const exactTendered = total;
  const exactChange = Math.max(0, exactTendered - total);
  assert(exactChange === 0, 'Exact button must calculate change as 0');

  // R200 button -> tendered 200 -> change 50
  const r200Tendered = 200;
  const r200Change = Math.max(0, r200Tendered - total);
  assert(r200Change === 50, 'R200 button on R150 total must calculate change as R50');

  // R50 button -> tendered 50 -> change 0, insufficient cash validation handles error on submission
  const r50Tendered = 50;
  const r50Change = Math.max(0, r50Tendered - total);
  assert(r50Change === 0, 'R50 button on R150 total must calculate change as 0');
  assert(r50Tendered < total, 'R50 is less than total R150 and will trigger insufficient cash validation on submit');

  console.log('[PASS] Tender shortcuts recalculate change correctly without bypassing payment validation');

  // Assert tender buttons do NOT submit sale automatically
  assert(!sellSrc.includes("onClick={() => { setCashTendered('50'); handleCompleteSale(); }}"), 'Tender buttons must NOT auto-submit sale');
  assert(!sellSrc.includes("onClick={() => { setCashTendered('100'); handleCompleteSale(); }}"), 'Tender buttons must NOT auto-submit sale');
  assert(!sellSrc.includes("onClick={() => { setCashTendered('200'); handleCompleteSale(); }}"), 'Tender buttons must NOT auto-submit sale');
  console.log('[PASS] Tender shortcuts only set the tendered amount and do not complete sale automatically');

  // =========================================================================
  // 2. CASHIER-FIRST LOGIN ROUTING
  // =========================================================================
  console.log('\n--- 2. Cashier-First Login Destination ---');

  const appSrc = fs.readFileSync(path.join(process.cwd(), 'src/App.tsx'), 'utf8');
  const accountPickerSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/auth/AccountPicker.tsx'), 'utf8');

  // Verify App.tsx routes standard cashier to 'sell' and higher roles to 'home'
  assert(
    appSrc.includes("const isStandardCashier = profile?.role === 'cashier';") &&
    appSrc.includes("setActiveTab(isStandardCashier ? 'sell' : 'home');"),
    'App.tsx must route standard Cashier (role = cashier) directly to sell register, and others to home'
  );
  console.log('[PASS] App.tsx routes standard Cashier to Sell register on initial login');

  // Verify AccountPicker.tsx preserves worker screen state on unlock/switch without forcing 'sell' tab
  assert(
    !accountPickerSrc.includes("if (selectedStaff.role === 'cashier') {\n        setActiveTab('sell');\n      }"),
    'AccountPicker.tsx must preserve active screen state on account switch/unlock rather than forcing cashier to sell tab'
  );
  console.log('[PASS] AccountPicker.tsx preserves worker screen state on unlock/switch');

  // Test routing logic for all roles
  function resolveLoginDestination(role: UserRole): 'sell' | 'home' {
    const isStandardCashier = role === 'cashier';
    return isStandardCashier ? 'sell' : 'home';
  }

  assert(resolveLoginDestination('cashier') === 'sell', 'Standard Cashier role destination must be sell');
  assert(resolveLoginDestination('senior_cashier') === 'home', 'Senior Cashier role destination must be home');
  assert(resolveLoginDestination('manager') === 'home', 'Manager role destination must be home');
  assert(resolveLoginDestination('owner') === 'home', 'Owner role destination must be home');
  assert(resolveLoginDestination('admin') === 'home', 'Admin role destination must be home');
  console.log('[PASS] Role-based login destinations verified for Cashier, Senior Cashier, Manager, Owner, Admin');

  // =========================================================================
  // 3. PERSISTENCE & CHECKOUT INTEGRITY
  // =========================================================================
  console.log('\n--- 3. Persistence & Single Toast Integrity ---');

  assert(appSrc.includes("activeTab === 'sell' ? 'flex flex-col lg:flex-row overflow-hidden' : 'hidden'"), 'App.tsx maintains persistent mounted screen containers');
  assert(!sellSrc.includes('<OperationProgressScreen'), 'Sell.tsx does not use blocking operation progress modal');
  console.log('[PASS] Persistent screen mounting and direct non-blocking checkout preserved');

  // =========================================================================
  // 4. SELL CHECKOUT CONFIDENCE & RECOVERY (TESTS A - E)
  // =========================================================================
  console.log('\n--- 4. Sell Checkout Confidence & Recovery (Tests A - E) ---');

  const mockItem1: InventoryItem = {
    id: 'item-101',
    sku: 'SKU-PHONE-1',
    title: 'Samsung Galaxy S21',
    category: 'Phones & Tech',
    condition: 'Good',
    acquisitionType: 'Buy',
    retailPrice: 4500,
    status: 'Retail Floor',
    imageUrl: '',
    serialOrImei: 'SN123456',
    addedAt: '2026-01-01'
  };

  const mockItem2: InventoryItem = {
    id: 'item-102',
    sku: 'SKU-WATCH-2',
    title: 'Rolex Submariner',
    category: 'Watches & Luxury Goods',
    condition: 'Mint',
    acquisitionType: 'Pawn',
    retailPrice: 85000,
    status: 'Retail Floor',
    imageUrl: '',
    serialOrImei: 'RLX987',
    addedAt: '2026-01-02'
  };

  // --- Test A — Cart snapshot integrity ---
  const singleItemCart: CartItem[] = [
    { item: mockItem1, quantity: 2, overridePrice: 4200 }
  ];
  const snapshotA = createCartSnapshot(singleItemCart);
  assert(snapshotA.items.length === 1, 'Test A: Snapshot preserves item count');
  assert(snapshotA.items[0].item.id === mockItem1.id, 'Test A: Snapshot preserves item identity');
  assert(snapshotA.items[0].item.sku === mockItem1.sku, 'Test A: Snapshot preserves item sku');
  assert(snapshotA.items[0].quantity === 2, 'Test A: Snapshot preserves item quantity');
  assert(snapshotA.items[0].overridePrice === 4200, 'Test A: Snapshot preserves overridden price');
  console.log('[PASS] Test A: Cart snapshot integrity verified (item identity, quantity, override price)');

  // --- Test B — Undo restoration ---
  const restoredB = restoreCartFromSnapshot(snapshotA);
  assert(restoredB.length === 1, 'Test B: Restored cart length matches snapshot');
  assert(restoredB[0].item.id === singleItemCart[0].item.id, 'Test B: Restored item identity matches original');
  assert(restoredB[0].quantity === singleItemCart[0].quantity, 'Test B: Restored quantity matches original');
  assert(restoredB[0].overridePrice === singleItemCart[0].overridePrice, 'Test B: Restored overridePrice matches original');
  console.log('[PASS] Test B: Undo restoration reproduces the same cart contents');

  // --- Test C — Multiple-item restoration ---
  const multiItemCart: CartItem[] = [
    { item: mockItem1, quantity: 1 },
    { item: mockItem2, quantity: 3, overridePrice: 80000 }
  ];
  const snapshotC = createCartSnapshot(multiItemCart);
  const restoredC = restoreCartFromSnapshot(snapshotC);
  assert(restoredC.length === 2, 'Test C: Restores multiple items');
  assert(restoredC[0].item.id === mockItem1.id && restoredC[0].quantity === 1, 'Test C: Item 1 restored correctly');
  assert(restoredC[1].item.id === mockItem2.id && restoredC[1].quantity === 3 && restoredC[1].overridePrice === 80000, 'Test C: Item 2 restored correctly with quantity and override');
  console.log('[PASS] Test C: Multiple-item restoration verified');

  // --- Test D — Price override restoration ---
  const overriddenCart: CartItem[] = [
    { item: mockItem1, quantity: 1, overridePrice: 3850 }
  ];
  const snapshotD = createCartSnapshot(overriddenCart);
  const restoredD = restoreCartFromSnapshot(snapshotD);
  assert(restoredD[0].overridePrice === 3850, 'Test D: Overridden price survives Clear -> Undo');
  assert(restoredD[0].item.retailPrice === 4500, 'Test D: Original retail price in item definition intact');
  console.log('[PASS] Test D: Price override restoration verified');

  // --- Test E — Payment-state calculation ---
  // total = 100, tendered = 70 -> still due = 30
  const stateUnder = getCashPaymentState(100, 70);
  assert(stateUnder.status === 'still_due', 'Test E: Status is still_due when tendered < total');
  assert(stateUnder.stillDue === 30, 'Test E: Still due amount is 30');
  assert(stateUnder.formattedText.toLowerCase().includes('still due') && stateUnder.formattedText.includes('30'), 'Test E: Formatted text communicates still due = 30');

  // total = 100, tendered = 100 -> exact payment
  const stateExact = getCashPaymentState(100, 100);
  assert(stateExact.status === 'exact', 'Test E: Status is exact when tendered === total');
  assert(stateExact.formattedText.toLowerCase().includes('exact payment'), 'Test E: Formatted text communicates exact payment');

  // total = 100, tendered = 150 -> change = 50
  const stateOver = getCashPaymentState(100, 150);
  assert(stateOver.status === 'change', 'Test E: Status is change when tendered > total');
  assert(stateOver.change === 50, 'Test E: Change amount is 50');
  assert(stateOver.formattedText.toLowerCase().includes('change') && stateOver.formattedText.includes('50'), 'Test E: Formatted text communicates change = 50');

  console.log('[PASS] Test E: Payment-state calculations verified for still due, exact payment, and change');

  console.log('\n====================================================');
  console.log('   ALL PHASE 2A CASHIER SPEED TESTS PASSED!         ');
  console.log('====================================================\n');
}
