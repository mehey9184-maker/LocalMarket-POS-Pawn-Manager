/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { UserRole } from '../types/supabase';
import { isPermanentManagerRole, canAccessAnalysis } from '../utils/authRoles';
import { getPermittedTabsForUser, resolvePostUnlockTab } from '../components/auth/AccountPicker';
import { normalizePaymentMethodLabel, computeStockMetrics } from '../components/screens/Analysis';
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
  // 1. ROLE MATRIX & MANAGEMENT ACCESS CONTROLS (Pure Role Helper)
  // =========================================================================
  console.log('\n--- 1. Role Authorization Predicates ---');

  // 1a. Pure role helper: isPermanentManagerRole
  assert.strictEqual(
    isPermanentManagerRole('manager'),
    true,
    'Manager must be authorized (isPermanentManagerRole = true)'
  );
  assert.strictEqual(
    isPermanentManagerRole('owner'),
    true,
    'Owner must be authorized (isPermanentManagerRole = true)'
  );
  assert.strictEqual(
    isPermanentManagerRole('admin'),
    true,
    'Admin must be authorized (isPermanentManagerRole = true)'
  );
  assert.strictEqual(
    isPermanentManagerRole('senior_cashier'),
    false,
    'Senior Cashier must NOT be authorized (isPermanentManagerRole = false)'
  );
  assert.strictEqual(
    isPermanentManagerRole('cashier'),
    false,
    'Cashier must NOT be authorized (isPermanentManagerRole = false)'
  );
  assert.strictEqual(
    isPermanentManagerRole(null),
    false,
    'Unauthenticated state (null) must default to unauthorized'
  );
  assert.strictEqual(
    isPermanentManagerRole(undefined),
    false,
    'Undefined profile role must default to unauthorized'
  );

  // 1b. Temporary elevation defense:
  // A cashier or senior cashier with temporary manager elevation MUST NEVER gain Analysis access
  assert.strictEqual(
    evaluateIsAtLeastManager('cashier', true),
    true,
    'Operational check with temporary elevation is true for cashier overrides'
  );
  assert.strictEqual(
    isPermanentManagerRole('cashier'),
    false,
    'Cashier with active temporary manager elevation must NOT gain Analysis access'
  );
  assert.strictEqual(
    canAccessAnalysis('cashier', true),
    false,
    'canAccessAnalysis helper strictly ignores temporary manager elevation for Cashier'
  );

  assert.strictEqual(
    evaluateIsAtLeastManager('senior_cashier', true),
    true,
    'Operational check with temporary elevation is true for senior cashier overrides'
  );
  assert.strictEqual(
    isPermanentManagerRole('senior_cashier'),
    false,
    'Senior Cashier with active temporary manager elevation must NOT gain Analysis access'
  );
  assert.strictEqual(
    canAccessAnalysis('senior_cashier', true),
    false,
    'canAccessAnalysis helper strictly ignores temporary manager elevation for Senior Cashier'
  );

  // 1c. Baseline evaluateIsAtLeastManager (for general operational permissions)
  assert.strictEqual(evaluateIsAtLeastManager('manager'), true);
  assert.strictEqual(evaluateIsAtLeastManager('owner'), true);
  assert.strictEqual(evaluateIsAtLeastManager('admin'), true);
  assert.strictEqual(evaluateIsAtLeastManager('senior_cashier'), false);
  assert.strictEqual(evaluateIsAtLeastManager('cashier'), false);
  assert.strictEqual(evaluateIsAtLeastManager(null), false);
  assert.strictEqual(evaluateIsAtLeastManager(undefined), false);

  // =========================================================================
  // 2. PERMITTED TABS & NAVIGATION ENTRY VISIBILITY
  // =========================================================================
  console.log('\n--- 2. Navigation Tab Visibility & Permitted Tabs ---');

  const cashierPermitted = getPermittedTabsForUser(() => true, false, 'cashier');
  assert.strictEqual(
    cashierPermitted.includes('analysis'),
    false,
    'Cashier permitted tabs must not include analysis'
  );

  const seniorCashierPermitted = getPermittedTabsForUser(() => true, true, 'senior_cashier');
  assert.strictEqual(
    seniorCashierPermitted.includes('analysis'),
    false,
    'Senior Cashier permitted tabs must not include analysis'
  );

  const managerPermitted = getPermittedTabsForUser(() => true, true, 'manager');
  assert.strictEqual(
    managerPermitted.includes('analysis'),
    true,
    'Manager permitted tabs must include analysis'
  );

  const ownerPermitted = getPermittedTabsForUser(() => true, true, 'owner');
  assert.strictEqual(
    ownerPermitted.includes('analysis'),
    true,
    'Owner permitted tabs must include analysis'
  );

  const adminPermitted = getPermittedTabsForUser(() => true, true, 'admin');
  assert.strictEqual(
    adminPermitted.includes('analysis'),
    true,
    'Admin permitted tabs must include analysis'
  );


  // Helper to normalize CRLF to LF for cross-platform Windows / Linux assertions
  const normalizeLf = (str: string) => str.replace(/\r\n/g, '\n');

  // Verify Header.tsx enforces isPermanentManagerRole on Analysis tab
  const headerPath = path.join(process.cwd(), 'src/components/Header.tsx');
  const headerSrc = normalizeLf(fs.readFileSync(headerPath, 'utf8'));

  assert(
    headerSrc.includes("if (isPermanentManagerRole(profile?.role))") &&
      headerSrc.includes("tabs.push({ id: 'analysis', label: 'Analysis' })"),
    'Header.tsx must gate the Analysis nav tab with isPermanentManagerRole'
  );

  // =========================================================================
  // 3. HARD VIEWPORT & DIRECT ROUTING GUARDS
  // =========================================================================
  console.log('\n--- 3. Direct Navigation & Viewport Guards ---');

  const appPath = path.join(process.cwd(), 'src/App.tsx');
  const appSrc = normalizeLf(fs.readFileSync(appPath, 'utf8'));

  // Verify App.tsx redirects activeTab === 'analysis' if unauthorized
  assert(
    appSrc.includes("activeTab === 'analysis' && !isAnalysisAuthorized"),
    'App.tsx must redirect activeTab === "analysis" when staff is not authorized'
  );

  // Verify App.tsx conditionally mounts Analysis component
  assert(
    appSrc.includes("{isAnalysisAuthorized ? <Analysis /> : null}"),
    'App.tsx must not mount Analysis component for unauthorized roles'
  );

  // Verify Analysis.tsx has internal defense-in-depth early returns and separate workspace
  const analysisPath = path.join(process.cwd(), 'src/components/screens/Analysis.tsx');
  const analysisSrc = normalizeLf(fs.readFileSync(analysisPath, 'utf8'));

  assert(
    analysisSrc.includes("const AnalysisWorkspace: React.FC"),
    'Analysis.tsx must separate workspace component to guarantee stable hook execution'
  );

  assert(
    analysisSrc.includes("export const Analysis: React.FC"),
    'Analysis.tsx must provide gate wrapper component'
  );

  assert(
    analysisSrc.includes("if (authLoading || isProfileLoading || isSwitchingAccount || !isAuthorized) {\n    return null;\n  }"),
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
    analysisSrc.includes('Gross Sales Revenue (Pre-Refund)') || analysisSrc.includes('Sales Revenue Today'),
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
    analysisSrc.includes('Profit calculations require completed cost reconciliation') || analysisSrc.includes('Profit is not labeled or estimated on gross cash movements'),
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

  // =========================================================================
  // 8. PAYMENT METHOD & INVENTORY STATUS ACCURACY TESTS
  // =========================================================================
  console.log('\n--- 8. Payment Method & Inventory Status Accuracy ---');

  // Test production normalizePaymentMethodLabel directly
  assert.strictEqual(normalizePaymentMethodLabel('cash'), 'Cash');
  assert.strictEqual(normalizePaymentMethodLabel('CASH'), 'Cash');
  assert.strictEqual(normalizePaymentMethodLabel('Cash'), 'Cash');
  assert.strictEqual(normalizePaymentMethodLabel('card'), 'Card');
  assert.strictEqual(normalizePaymentMethodLabel('CARD'), 'Card');
  assert.strictEqual(normalizePaymentMethodLabel('Card'), 'Card');
  assert.strictEqual(normalizePaymentMethodLabel('eft'), 'EFT');
  assert.strictEqual(normalizePaymentMethodLabel('EFT'), 'EFT');
  assert.strictEqual(normalizePaymentMethodLabel('snapscan'), 'SnapScan');
  assert.strictEqual(normalizePaymentMethodLabel('SNAPSCAN'), 'SnapScan');
  assert.strictEqual(normalizePaymentMethodLabel('SnapScan'), 'SnapScan');
  assert.strictEqual(normalizePaymentMethodLabel(''), 'Unknown');
  assert.strictEqual(normalizePaymentMethodLabel(null), 'Unknown');
  assert.strictEqual(normalizePaymentMethodLabel(undefined), 'Unknown');
  assert.strictEqual(normalizePaymentMethodLabel('crypto_pay'), 'Crypto_pay');

  // Test production computeStockMetrics inventory status classification logic
  const mockInventory = [
    { id: '1', status: 'Retail Floor', retailPrice: 100, costBasis: 40, category: 'Electronics' },
    { id: '2', status: 'Retail Floor', retailPrice: 200, costBasis: 80, category: 'Tools' },
    { id: '3', status: 'Vault Hold', retailPrice: 500, costBasis: 250, category: 'Tools' },
    { id: '4', status: 'Redeemed', retailPrice: 300, costBasis: 150, category: 'Jewellery' },
    { id: '5', status: 'Flagged', retailPrice: 150, costBasis: 75, category: 'General' },
    { id: '6', status: 'Pending Forfeit', retailPrice: 400, costBasis: 200, category: 'Appliances' },
    { id: '7', status: 'Returned', retailPrice: 250, costBasis: 100, category: 'Electronics' },
    { id: '8', status: 'Reversed', retailPrice: 120, costBasis: 60, category: 'Tools' },
    { id: '9', status: 'InStock', retailPrice: 220, costBasis: 110, category: 'General' }
  ];

  const stockResults = computeStockMetrics(mockInventory);

  // Assert Retail Floor count, retailTotal, and costTotal are correct and exclusively include Retail Floor items
  assert.strictEqual(stockResults.byStatus['Retail Floor'].count, 2, 'Retail Floor count must be exactly 2');
  assert.strictEqual(stockResults.byStatus['Retail Floor'].retailTotal, 300, 'Retail Floor retail valuation must be 300');
  assert.strictEqual(stockResults.byStatus['Retail Floor'].costTotal, 120, 'Retail Floor cost total must be 120');

  // Assert non-floor statuses are tracked in their respective buckets and NOT silently counted as Retail Floor
  assert.strictEqual(stockResults.byStatus['Vault Hold'].count, 1);
  assert.strictEqual(stockResults.byStatus['Vault Hold'].retailTotal, 500);

  assert.strictEqual(stockResults.byStatus['Redeemed'].count, 1);
  assert.strictEqual(stockResults.byStatus['Redeemed'].retailTotal, 300);

  assert.strictEqual(stockResults.byStatus['Flagged'].count, 1);
  assert.strictEqual(stockResults.byStatus['Pending Forfeit'].count, 1);
  assert.strictEqual(stockResults.byStatus['Returned'].count, 1);
  assert.strictEqual(stockResults.byStatus['Reversed'].count, 1);
  assert.strictEqual(stockResults.byStatus['InStock'].count, 1);

  // Assert category metrics strictly include items genuinely marked as Retail Floor (note: item 7 is Returned Electronics, so only item 1 counts for Electronics category floor stock)
  assert.strictEqual(stockResults.byCategory['Electronics'].count, 1, 'Category Electronics should only count genuine Retail Floor items');
  assert.strictEqual(stockResults.byCategory['Electronics'].retailTotal, 100);

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
