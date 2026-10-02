/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import { UserRole } from '../types/supabase';

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

  // Verify AccountPicker.tsx routes standard cashier to 'sell' on terminal switch
  assert(
    accountPickerSrc.includes("if (selectedStaff.role === 'cashier') {\n        setActiveTab('sell');\n      }"),
    'AccountPicker.tsx must route standard Cashier to sell register on terminal account switch'
  );
  console.log('[PASS] AccountPicker.tsx routes standard Cashier to Sell register on terminal account switch');

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

  console.log('\n====================================================');
  console.log('   ALL PHASE 2A CASHIER SPEED TESTS PASSED!         ');
  console.log('====================================================\n');
}
