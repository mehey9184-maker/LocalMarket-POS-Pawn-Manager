/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { UserRole } from '../types/supabase';
import { getPermittedTabsForUser, resolvePostUnlockTab } from '../components/auth/AccountPicker';
import {
  getShopTodayDateString,
  normalizeDateToShopYmd,
  getShopRelativeDayThreshold,
  DEFAULT_SHOP_TIMEZONE
} from '../utils/shopDate';

// Emulate AuthContext isAtLeastManager logic
function evaluateIsAtLeastManager(role: UserRole | null | undefined, managerElevation = false): boolean {
  const rawRole = (role || 'cashier') as UserRole;
  const isOwner = rawRole === 'owner' || rawRole === 'admin';
  const isManager = rawRole === 'manager' || managerElevation;
  return isOwner || isManager;
}

export async function runAnalysisAccessAndTabsTests() {
  console.log('\n====================================================');
  console.log('   RUNNING ANALYSIS ACCESS & TAB STRIP TEST SUITE   ');
  console.log('====================================================');

  // =========================================================================
  // 1. ROLE MATRIX & MANAGEMENT ACCESS CONTROLS
  // =========================================================================
  console.log('\n--- 1. Role Authorization Predicates ---');

  // Manager: Authorized
  assert.strictEqual(
    evaluateIsAtLeastManager('manager'),
    true,
    'Manager must be authorized (isAtLeastManager = true)'
  );

  // Owner: Authorized
  assert.strictEqual(
    evaluateIsAtLeastManager('owner'),
    true,
    'Owner must be authorized (isAtLeastManager = true)'
  );

  // Admin: Authorized
  assert.strictEqual(
    evaluateIsAtLeastManager('admin'),
    true,
    'Admin must be authorized (isAtLeastManager = true)'
  );

  // Senior Cashier: Unauthorized
  assert.strictEqual(
    evaluateIsAtLeastManager('senior_cashier'),
    false,
    'Senior Cashier must NOT be authorized (isAtLeastManager = false)'
  );

  // Standard Cashier: Unauthorized
  assert.strictEqual(
    evaluateIsAtLeastManager('cashier'),
    false,
    'Cashier must NOT be authorized (isAtLeastManager = false)'
  );

  // Unauthenticated / Loading (role is null or undefined): Unauthorized
  assert.strictEqual(
    evaluateIsAtLeastManager(null),
    false,
    'Unauthenticated state must default to unauthorized'
  );
  assert.strictEqual(
    evaluateIsAtLeastManager(undefined),
    false,
    'Undefined profile role must default to unauthorized'
  );

  // =========================================================================
  // 2. PERMITTED TABS & NAVIGATION ENTRY VISIBILITY
  // =========================================================================
  console.log('\n--- 2. Navigation Tab Visibility & Permitted Tabs ---');

  const cashierPermitted = getPermittedTabsForUser(() => true, false, false);
  assert.strictEqual(
    cashierPermitted.includes('analysis'),
    false,
    'Cashier permitted tabs must not include analysis'
  );

  const seniorCashierPermitted = getPermittedTabsForUser(() => true, true, false);
  assert.strictEqual(
    seniorCashierPermitted.includes('analysis'),
    false,
    'Senior Cashier permitted tabs must not include analysis'
  );

  const managerPermitted = getPermittedTabsForUser(() => true, true, true);
  assert.strictEqual(
    managerPermitted.includes('analysis'),
    true,
    'Manager permitted tabs must include analysis'
  );

  // Verify Header.tsx enforces isAtLeastManager on Analysis tab
  const headerPath = path.join(process.cwd(), 'src/components/Header.tsx');
  const headerSrc = fs.readFileSync(headerPath, 'utf8');

  assert(
    headerSrc.includes("if (isAtLeastManager)") && headerSrc.includes("tabs.push({ id: 'analysis', label: 'Analysis' })"),
    'Header.tsx must gate the Analysis nav tab with isAtLeastManager'
  );

  // =========================================================================
  // 3. HARD VIEWPORT & DIRECT ROUTING GUARDS
  // =========================================================================
  console.log('\n--- 3. Direct Navigation & Viewport Guards ---');

  const appPath = path.join(process.cwd(), 'src/App.tsx');
  const appSrc = fs.readFileSync(appPath, 'utf8');

  // Verify App.tsx redirects activeTab === 'analysis' if unauthorized
  assert(
    appSrc.includes("activeTab === 'analysis' && !isAtLeastManager"),
    'App.tsx must redirect activeTab === "analysis" when staff is not authorized'
  );

  // Verify App.tsx conditionally mounts Analysis component
  assert(
    appSrc.includes("{isAtLeastManager ? <Analysis /> : null}"),
    'App.tsx must not mount Analysis component for unauthorized roles'
  );

  // Verify Analysis.tsx has internal defense-in-depth early returns
  const analysisPath = path.join(process.cwd(), 'src/components/screens/Analysis.tsx');
  const analysisSrc = fs.readFileSync(analysisPath, 'utf8');

  assert(
    analysisSrc.includes("if (authLoading || isProfileLoading || isSwitchingAccount || !isAtLeastManager) {\n    return null;\n  }"),
    'Analysis.tsx must return null immediately when unauthorized or loading'
  );

  // =========================================================================
  // 4. ACCOUNT SWITCHING & LEAKAGE DEFENSE
  // =========================================================================
  console.log('\n--- 4. Account Switching & Stale Route Clearance ---');

  // Scenario: Manager was viewing 'analysis'. Device switches to Cashier.
  const switchedToCashierTab = resolvePostUnlockTab({
    lockedProfileId: 'manager-123',
    unlockedProfileId: 'cashier-456',
    unlockedRole: 'cashier',
    currentTab: 'analysis',
    permittedTabs: cashierPermitted
  });

  assert.strictEqual(
    switchedToCashierTab,
    'sell',
    'Switching from Manager on Analysis tab to Cashier must safely route to sell POS'
  );

  // Scenario: Manager was viewing 'analysis'. Device switches to Senior Cashier.
  const switchedToSeniorTab = resolvePostUnlockTab({
    lockedProfileId: 'manager-123',
    unlockedProfileId: 'senior-789',
    unlockedRole: 'senior_cashier',
    currentTab: 'analysis',
    permittedTabs: seniorCashierPermitted
  });

  assert.strictEqual(
    switchedToSeniorTab,
    'home',
    'Switching from Manager on Analysis tab to Senior Cashier must safely route to home'
  );

  // =========================================================================
  // 5. FOUR SUB-TABS & DATA INTEGRITY
  // =========================================================================
  console.log('\n--- 5. Four Sub-Tabs & Sections Integrity ---');

  assert(analysisSrc.includes("id: 'overview'"), 'Analysis must have Overview tab');
  assert(analysisSrc.includes("id: 'sales'"), 'Analysis must have Sales tab');
  assert(analysisSrc.includes("id: 'stock'"), 'Analysis must have Stock tab');
  assert(analysisSrc.includes("id: 'loans'"), 'Analysis must have Pawn & Loans tab');

  // Verify financial distinctions
  assert(
    analysisSrc.includes('Sales Revenue Today'),
    'Analysis must label sales revenue clearly'
  );
  assert(
    analysisSrc.includes('Stock Purchase Spend'),
    'Analysis must separate stock purchase outlay'
  );
  assert(
    analysisSrc.includes('Pawn Principal Advanced'),
    'Analysis must separate pawn principal advanced'
  );
  assert(
    analysisSrc.includes('Profit is not labeled or estimated on gross cash movements'),
    'Analysis must explicitly document the revenue vs profit distinction'
  );

  // =========================================================================
  // 6. SOUTH AFRICAN SHOP-LOCAL DATE HANDLING
  // =========================================================================
  console.log('\n--- 6. South African Shop-Local Date Safety ---');

  const todayStr = getShopTodayDateString('Africa/Johannesburg');
  assert(/^\d{4}-\d{2}-\d{2}$/.test(todayStr), 'Today string must be YYYY-MM-DD');

  // Test UTC midnight boundary crossing into Johannesburg (UTC+2)
  // E.g., 2026-10-16T23:30:00.000Z is 2026-10-17 01:30 in Johannesburg
  const lateUtcIso = '2026-10-16T23:30:00.000Z';
  const joburgDate = normalizeDateToShopYmd(lateUtcIso, 'Africa/Johannesburg');
  assert.strictEqual(
    joburgDate,
    '2026-10-17',
    '23:30 UTC must map to the next local day (01:30 SAST) in Johannesburg'
  );

  // Test already-formatted YYYY-MM-DD string passthrough
  assert.strictEqual(
    normalizeDateToShopYmd('2026-11-20'),
    '2026-11-20',
    'Calendar YYYY-MM-DD string must be preserved cleanly'
  );

  // =========================================================================
  // 7. HORIZONTAL TAB SCROLL CONTROLS & OVERFLOW LOGIC
  // =========================================================================
  console.log('\n--- 7. Horizontal Tab Strip Scroll Behavior ---');

  // Verify Analysis.tsx implements scroll container with ref, overflow detection and arrow buttons
  assert(
    analysisSrc.includes('scrollContainerRef'),
    'Analysis.tsx must use a ref for the horizontal scroll container'
  );
  assert(
    analysisSrc.includes('hasOverflow'),
    'Analysis.tsx must track hasOverflow state'
  );
  assert(
    analysisSrc.includes('canScrollLeft'),
    'Analysis.tsx must track canScrollLeft'
  );
  assert(
    analysisSrc.includes('canScrollRight'),
    'Analysis.tsx must track canScrollRight'
  );
  assert(
    analysisSrc.includes('aria-label="Scroll tabs left"'),
    'Analysis.tsx must provide accessible left scroll arrow'
  );
  assert(
    analysisSrc.includes('aria-label="Scroll tabs right"'),
    'Analysis.tsx must provide accessible right scroll arrow'
  );
  assert(
    analysisSrc.includes('e.stopPropagation()'),
    'Scroll arrows must prevent event propagation to avoid triggering tab clicks'
  );
  assert(
    analysisSrc.includes("role=\"tablist\""),
    'Tab container must have role="tablist"'
  );
  assert(
    analysisSrc.includes("role=\"tab\""),
    'Tab elements must have role="tab"'
  );
  assert(
    analysisSrc.includes("aria-selected={isActive}"),
    'Active tab must have aria-selected={isActive}'
  );

  // Pure logic simulation for scroll overflow and arrow visibility
  function simulateTabStripOverflow(scrollWidth: number, clientWidth: number, scrollLeft: number) {
    const tolerance = 2;
    const hasOverflow = scrollWidth > clientWidth + tolerance;
    const canScrollLeft = hasOverflow && scrollLeft > tolerance;
    const canScrollRight = hasOverflow && scrollLeft + clientWidth < scrollWidth - tolerance;
    return { hasOverflow, canScrollLeft, canScrollRight };
  }

  // Case A: Tabs fit comfortably (e.g. 360px content in 500px container)
  const fitState = simulateTabStripOverflow(360, 500, 0);
  assert.strictEqual(fitState.hasOverflow, false, 'When tabs fit, hasOverflow must be false');
  assert.strictEqual(fitState.canScrollLeft, false, 'When tabs fit, canScrollLeft must be false');
  assert.strictEqual(fitState.canScrollRight, false, 'When tabs fit, canScrollRight must be false');

  // Case B: Tabs overflow, at start (scrollLeft = 0)
  const overflowStart = simulateTabStripOverflow(500, 300, 0);
  assert.strictEqual(overflowStart.hasOverflow, true, 'When tabs exceed width, hasOverflow must be true');
  assert.strictEqual(overflowStart.canScrollLeft, false, 'At start of overflow, left arrow must be disabled/hidden');
  assert.strictEqual(overflowStart.canScrollRight, true, 'At start of overflow, right arrow must be enabled');

  // Case C: Tabs overflow, scrolled to middle (scrollLeft = 100)
  const overflowMiddle = simulateTabStripOverflow(500, 300, 100);
  assert.strictEqual(overflowMiddle.hasOverflow, true);
  assert.strictEqual(overflowMiddle.canScrollLeft, true, 'In middle of overflow, left arrow must be enabled');
  assert.strictEqual(overflowMiddle.canScrollRight, true, 'In middle of overflow, right arrow must be enabled');

  // Case D: Tabs overflow, scrolled to end (scrollLeft = 200, 200 + 300 = 500)
  const overflowEnd = simulateTabStripOverflow(500, 300, 200);
  assert.strictEqual(overflowEnd.hasOverflow, true);
  assert.strictEqual(overflowEnd.canScrollLeft, true, 'At end of overflow, left arrow must be enabled');
  assert.strictEqual(overflowEnd.canScrollRight, false, 'At end of overflow, right arrow must be disabled/hidden');

  console.log('\n====================================================');
  console.log('   ALL ANALYSIS ACCESS & TAB STRIP TESTS PASSED!    ');
  console.log('====================================================\n');
}

// Auto-run when executed directly via tsx/node
if (typeof process !== 'undefined' && process.argv && process.argv[1] && process.argv[1].includes('analysisAccessAndTabs')) {
  runAnalysisAccessAndTabsTests().catch((err) => {
    console.error('Analysis Access & Tab Strip Tests Failed:', err);
    process.exit(1);
  });
}
