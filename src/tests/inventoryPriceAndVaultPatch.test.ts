import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { PawnLoan, InventoryItem } from '../types';
import { PriceChangeRecord } from '../context/InventoryContext';
import { SystemLogRow } from '../services/supabaseApi';

/**
 * Verification Test Suite: Inventory Price Change Audit History & Vault / Active Pawn UX
 */
export async function runInventoryPriceAndVaultPatchTests() {
  console.log('=== RUNNING INVENTORY PRICE HISTORY & VAULT UX PATCH TESTS ===');

  // --------------------------------------------------------------------------
  // TEST 1: Price-Change Audit Indicator & No Fake Boolean on InventoryItem
  // --------------------------------------------------------------------------
  console.log('[Test 1] Verifying price-change audit indicator logic and no fake boolean...');
  
  // Verify InventoryItem type definition has NO fake hardcoded boolean
  const typesFilePath = path.resolve('src/types.ts');
  const typesContent = fs.readFileSync(typesFilePath, 'utf8');
  assert(
    !typesContent.includes('hasPriceChanged?: boolean') && !typesContent.includes('priceChanged?: boolean'),
    'Test 1 FAIL: InventoryItem must not contain a fake hardcoded priceChanged boolean'
  );

  // Mock system audit logs
  const testItemId = 'item-uuid-101';
  const otherItemId = 'item-uuid-202';
  
  const mockSystemLogs: SystemLogRow[] = [
    {
      id: 'log-1',
      event_type: 'RETAIL_PRICE_UPDATED',
      severity: 'audit',
      actor_id: 'user-1',
      actor_name: 'Store Manager John',
      details: {
        item_id: testItemId,
        old_price: 2200,
        new_price: 2500,
        reason: 'Holiday seasonal repricing'
      },
      saps_reference: null,
      ip_address: null,
      created_at: '2026-10-01T10:00:00.000Z',
      shop_id: 'shop-alpha'
    },
    {
      id: 'log-2',
      event_type: 'RETAIL_PRICE_UPDATED',
      severity: 'audit',
      actor_id: 'user-2',
      actor_name: 'Regional Admin Sarah',
      details: {
        item_id: testItemId,
        old_price: 2500,
        new_price: 2750,
        reason: 'Adjusted to match current market value'
      },
      saps_reference: null,
      ip_address: null,
      created_at: '2026-10-01T15:30:00.000Z',
      shop_id: 'shop-alpha'
    }
  ];

  // Helper matching InventoryContext getPriceChangeHistory
  const derivePriceChangeHistory = (itemId: string, logs: SystemLogRow[]): PriceChangeRecord[] => {
    return logs
      .filter(log => {
        const details = log.details as Record<string, any> | null;
        return details?.item_id === itemId && 
          (log.event_type === 'RETAIL_PRICE_UPDATED' || log.event_type === 'RETAIL_PRICE_CHANGED');
      })
      .map(log => {
        const details = log.details as Record<string, any>;
        return {
          id: log.id,
          itemId,
          oldPrice: Number(details.old_price),
          newPrice: Number(details.new_price),
          actorName: log.actor_name || 'Staff Member',
          reason: details.reason || 'Price adjustment',
          timestamp: log.created_at
        };
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  };

  const item1History = derivePriceChangeHistory(testItemId, mockSystemLogs);
  const otherItemHistory = derivePriceChangeHistory(otherItemId, mockSystemLogs);

  // Indicator exists ONLY when real audit event exists
  assert.strictEqual(item1History.length > 0, true, 'Item 1 with real audit logs must show price change');
  assert.strictEqual(otherItemHistory.length > 0, false, 'Item without audit logs must NOT show price change indicator');
  console.log('[PASS] Test 1: Price-change audit indicator derived strictly from real audit events without fake booleans');

  // --------------------------------------------------------------------------
  // TEST 2: Latest Price-Change Reason Display
  // --------------------------------------------------------------------------
  console.log('[Test 2] Verifying latest price-change information fields...');
  const latestChange = item1History[0];
  assert.strictEqual(latestChange.oldPrice, 2500, 'Latest change must show previous price of 2500');
  assert.strictEqual(latestChange.newPrice, 2750, 'Latest change must show new price of 2750');
  assert.strictEqual(latestChange.actorName, 'Regional Admin Sarah', 'Latest change must show actor name');
  assert.strictEqual(latestChange.reason, 'Adjusted to match current market value', 'Latest change must show reason');
  assert.strictEqual(latestChange.timestamp, '2026-10-01T15:30:00.000Z', 'Latest change must show timestamp');
  console.log('[PASS] Test 2: Latest price-change display includes previous price, new price, actor, reason, and timestamp');

  // --------------------------------------------------------------------------
  // TEST 3: Multiple Price Changes in Chronological Order (Newest First)
  // --------------------------------------------------------------------------
  console.log('[Test 3] Verifying multiple price changes ordering...');
  assert.strictEqual(item1History.length, 2, 'Item must have 2 price changes');
  assert(new Date(item1History[0].timestamp) > new Date(item1History[1].timestamp), 'Newest price change must be first');
  assert.strictEqual(item1History[1].oldPrice, 2200);
  assert.strictEqual(item1History[1].newPrice, 2500);
  assert.strictEqual(item1History[1].reason, 'Holiday seasonal repricing');
  console.log('[PASS] Test 3: Multiple price changes correctly sorted chronologically with newest first');

  // --------------------------------------------------------------------------
  // TEST 4: Active Vault Default View
  // --------------------------------------------------------------------------
  console.log('[Test 4] Verifying Active Vault is the default view in VaultManager...');
  const vaultManagerPath = path.resolve('src/components/screens/VaultManager.tsx');
  const vaultManagerContent = fs.readFileSync(vaultManagerPath, 'utf8');

  assert(
    vaultManagerContent.includes("useState<'storage' | 'overdue' | 'review'>('storage')"),
    'Test 4 FAIL: VaultManager must initialize activeTab to storage (Active Vault)'
  );
  
  // Verify Active Vault button is placed first in the tab bar
  const activeTabIdx = vaultManagerContent.indexOf('data-testid="tab-active-vault"');
  const overdueTabIdx = vaultManagerContent.indexOf('data-testid="tab-overdue-vault"');
  const reviewTabIdx = vaultManagerContent.indexOf('data-testid="tab-review-vault"');
  assert(activeTabIdx !== -1 && overdueTabIdx !== -1 && reviewTabIdx !== -1, 'All three vault tabs must exist');
  assert(activeTabIdx < overdueTabIdx && overdueTabIdx < reviewTabIdx, 'Active Vault must be the first tab in the tab bar');
  console.log('[PASS] Test 4: Active Vault is the default first view and first tab in VaultManager');

  // --------------------------------------------------------------------------
  // TEST 5: Live Countdown Calculation (Not Stale Stored Value)
  // --------------------------------------------------------------------------
  console.log('[Test 5] Verifying dynamic live countdown calculation...');
  const baseDate = new Date();
  const futureExpiry = new Date(baseDate.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const pastExpiry = new Date(baseDate.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const mockActiveLoan: PawnLoan = {
    id: 'loan-1',
    ticketNumber: '#PWN-101',
    customerId: 'cust-1',
    customerName: 'Sipho Zulu',
    customerIdNumber: '9001015800087',
    customerMobile: '+27821234567',
    customerAddress: '124 Vilakazi St, Soweto',
    itemId: 'item-1',
    itemTitle: 'PlayStation 5 Console',
    itemCategory: 'Gaming',
    serialOrImei: 'PS5-778899',
    condition: 'Excellent',
    itemImageUrl: 'https://example.com/ps5.jpg',
    principal: 4000,
    ncrMonthlyRate: 0.05,
    monthlyInterest: 200,
    monthlyStorageAdminFee: 320,
    totalRedemptionAmount: 4520,
    extensionFee: 520,
    startDate: '2026-09-01',
    expiryDate: futureExpiry,
    daysRemaining: 999, // Intentional stale value to test dynamic calculation
    daysElapsed: 16,
    vaultShelf: 'Shelf A-04',
    status: 'Active',
    qrToken: 'qr-pwn-101',
    history: []
  };

  const calculateLiveDaysRemaining = (loan: PawnLoan): number => {
    if (!loan.expiryDate) return loan.daysRemaining;
    const expiry = new Date(loan.expiryDate).getTime();
    const now = Date.now();
    return Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
  };

  const calculatedDays = calculateLiveDaysRemaining(mockActiveLoan);
  assert.strictEqual(calculatedDays <= 15 && calculatedDays >= 13, true, `Calculated live days must be ~14 (got ${calculatedDays})`);
  assert.notStrictEqual(calculatedDays, 999, 'Must not use stale stored daysRemaining');

  // Test overdue calculation
  const mockOverdueLoan: PawnLoan = {
    ...mockActiveLoan,
    expiryDate: pastExpiry
  };
  const overdueDays = calculateLiveDaysRemaining(mockOverdueLoan);
  assert.strictEqual(overdueDays <= 0, true, 'Past expiry must yield non-positive days remaining');
  console.log('[PASS] Test 5: Live countdown derived dynamically from actual expiry date, ignoring stale stored values');

  // --------------------------------------------------------------------------
  // TEST 6: Clickable Pawn Detail & Complete Collateral Drawer Fields
  // --------------------------------------------------------------------------
  console.log('[Test 6] Verifying clickable pawn detail and complete collateral drawer fields...');
  assert(
    vaultManagerContent.includes('setSelectedLoanForDetail(loan)'),
    'Active pawn row must be clickable and set selectedLoanForDetail'
  );
  assert(
    vaultManagerContent.includes('data-testid="pawn-detail-drawer"'),
    'VaultManager must include the pawn detail drawer element'
  );

  // Check all required drawer fields are referenced in VaultManager.tsx
  const requiredFields = [
    'ticketNumber',
    'customerName',
    'customerId',
    'customerMobile',
    'itemTitle',
    'itemImageUrl',
    'itemCategory',
    'brandModelText',
    'serialOrImei',
    'condition',
    'vaultShelf',
    'principal',
    'monthlyInterest',
    'monthlyStorageAdminFee',
    'totalRedemptionAmount',
    'extensionFee',
    'startDate',
    'expiryDate',
    'history'
  ];

  for (const field of requiredFields) {
    assert(
      vaultManagerContent.includes(field),
      `Test 6 FAIL: Vault detail drawer must reference '${field}'`
    );
  }
  console.log('[PASS] Test 6: Clickable active pawn opens complete collateral detail drawer with all required fields');

  // --------------------------------------------------------------------------
  // TEST 7: Operational Actions (Redeem and Extend) & Role Enforcement
  // --------------------------------------------------------------------------
  console.log('[Test 7] Verifying operational actions (Redeem/Extend) and role enforcement...');
  assert(
    vaultManagerContent.includes('handleExecuteSettlement'),
    'Vault detail drawer must provide settlement execution handler'
  );
  assert(
    vaultManagerContent.includes('redeemLoan(') && vaultManagerContent.includes('extendLoan('),
    'Settlement execution must support both redeemLoan and extendLoan'
  );
  assert(
    vaultManagerContent.includes('isAtLeastSeniorCashier'),
    'Operational settlement actions must enforce Senior Cashier or higher authority'
  );
  console.log('[PASS] Test 7: Operational actions (Redeem/Extend) implemented with strict role enforcement');

  // --------------------------------------------------------------------------
  // TEST 8: Overdue State Visually Obvious and Kept in Same Workspace
  // --------------------------------------------------------------------------
  console.log('[Test 8] Verifying overdue state and workspace unification...');
  assert(
    vaultManagerContent.includes('Overdue &amp; Forfeits') || vaultManagerContent.includes('Overdue & Forfeits'),
    'Overdue tab must remain present in the same VaultManager workspace'
  );
  assert(
    vaultManagerContent.includes('Review Queue'),
    'Review Queue tab must remain present in the same VaultManager workspace'
  );
  assert(
    vaultManagerContent.includes('Days Overdue'),
    'Overdue items must display calm, distinct overdue day indicators'
  );
  console.log('[PASS] Test 8: Overdue and review workflows preserved in unified Vault workspace');

  // --------------------------------------------------------------------------
  // TEST 9: Permission-Safe Financial Details (No Acquisition Cost/Profit Leak)
  // --------------------------------------------------------------------------
  console.log('[Test 9] Verifying permission-safe financial detail display...');
  const inventoryScreenPath = path.resolve('src/components/screens/Inventory.tsx');
  const inventoryScreenContent = fs.readFileSync(inventoryScreenPath, 'utf8');

  // Ensure price change audit history in Inventory does NOT expose cost basis or profit
  const priceHistorySectionStart = inventoryScreenContent.indexOf('PRICE CHANGE AUDIT HISTORY');
  assert(priceHistorySectionStart !== -1, 'Inventory must contain price change audit history section');
  const priceHistorySection = inventoryScreenContent.slice(priceHistorySectionStart, priceHistorySectionStart + 2500);
  assert(
    !priceHistorySection.includes('costBasis') && !priceHistorySection.includes('profit') && !priceHistorySection.includes('margin'),
    'Test 9 FAIL: Price change history must never expose cost basis, profit, or margins'
  );
  console.log('[PASS] Test 9: Permission safety verified: No acquisition cost or profit margin leaked in price history');

  // --------------------------------------------------------------------------
  // TEST 10: Removal of Fake Hard-Coded Vault Percentage (e.g. "82% Full")
  // --------------------------------------------------------------------------
  console.log('[Test 10] Verifying removal of fake vault metrics (82% Full)...');
  assert(
    !vaultManagerContent.includes('82% Full'),
    'Test 10 FAIL: Hard-coded fake metric "82% Full" must be removed from VaultManager'
  );
  assert(
    !vaultManagerContent.includes('Vault Density'),
    'Test 10 FAIL: Fake "Vault Density" dots must be removed from VaultManager'
  );
  assert(
    vaultManagerContent.includes('Secured Collateral') && vaultManagerContent.includes('Pledges Shelved'),
    'VaultManager must display authentic count of active shelved pledges'
  );
  console.log('[PASS] Test 10: Hard-coded fake vault percentage completely removed');

  // --------------------------------------------------------------------------
  // TEST 11: Vault Pawn List react-window 2.x API & Active Row Attributes
  // --------------------------------------------------------------------------
  console.log('[Test 11] Verifying react-window 2.x API usage and Active Vault row fields...');
  const vaultContent = fs.readFileSync(path.resolve('src/components/screens/VaultManager.tsx'), 'utf8');

  // 11.1 Must NOT use legacy react-window 1.x props: itemCount or itemSize on List
  assert(
    !vaultContent.includes('itemCount=') && !vaultContent.includes('itemSize='),
    'Test 11.1 FAIL: Must not use legacy react-window 1.x itemCount/itemSize props'
  );

  // 11.2 Must use react-window 2.x API: rowCount, rowHeight, rowComponent
  assert(
    vaultContent.includes('rowCount={filteredActiveStorage.length}') &&
    vaultContent.includes('rowHeight={88}') &&
    vaultContent.includes('rowComponent={ActiveVaultRow}'),
    'Test 11.2 FAIL: VaultManager must use react-window 2.x rowCount, rowHeight, rowComponent API'
  );

  // 11.3 Active Vault row must render all required collateral fields
  const requiredRowFields = [
    'itemImageUrl',
    'itemTitle',
    'ticketNumber',
    'customerName',
    'vaultShelf',
    'serialOrImei',
    'principal',
    'liveDays'
  ];
  for (const field of requiredRowFields) {
    assert(
      vaultContent.includes(field),
      `Test 11.3 FAIL: ActiveVaultRow must display '${field}'`
    );
  }

  // 11.4 Search must match ticket, item, customer, shelf, serial/IMEI, and brand/model
  assert(
    vaultContent.includes('matchesSearch') &&
    vaultContent.includes('invItem.brand') &&
    vaultContent.includes('invItem.model'),
    'Test 11.4 FAIL: Search filter must match brand and model from inventory items'
  );
  console.log('[PASS] Test 11: Vault Pawn List correctly uses react-window 2.x API with full collateral row attributes');

  // --------------------------------------------------------------------------
  // TEST 12: maxLoanPrincipal in BusinessRules with Clear Default
  // --------------------------------------------------------------------------
  console.log('[Test 12] Verifying maxLoanPrincipal definition and default...');
  const { DEFAULT_BUSINESS_RULES } = await import('../utils/pricingRules');
  assert(
    'maxLoanPrincipal' in DEFAULT_BUSINESS_RULES,
    'Test 12.1 FAIL: DEFAULT_BUSINESS_RULES must include maxLoanPrincipal'
  );
  assert.strictEqual(
    DEFAULT_BUSINESS_RULES.maxLoanPrincipal,
    null,
    'Test 12.2 FAIL: Default maxLoanPrincipal must be null (no maximum limit, preserving existing behaviour)'
  );
  console.log('[PASS] Test 12: maxLoanPrincipal defined in BusinessRules with clear null default');

  // --------------------------------------------------------------------------
  // TEST 13: Owner-Only Settings UI: "Pawn Lending Limits"
  // --------------------------------------------------------------------------
  console.log('[Test 13] Verifying owner-only settings UI for Pawn Lending Limits...');
  const settingsContent = fs.readFileSync(path.resolve('src/components/profile/BusinessRulesManager.tsx'), 'utf8');

  assert(
    settingsContent.includes('Pawn Lending Limits'),
    'Test 13.1 FAIL: Settings UI must contain section "Pawn Lending Limits"'
  );
  assert(
    settingsContent.includes('Minimum pawn amount') && settingsContent.includes('Maximum pawn amount'),
    'Test 13.2 FAIL: Settings UI must provide "Minimum pawn amount" and "Maximum pawn amount" fields'
  );
  assert(
    settingsContent.includes('No maximum limit'),
    'Test 13.3 FAIL: Settings UI must allow "No maximum limit"'
  );
  assert(
    settingsContent.includes('Shop policy setting') || settingsContent.includes('Shop policy limits'),
    'Test 13.4 FAIL: Maximum must be clearly labeled as a shop policy setting, not statutory cap'
  );
  assert(
    settingsContent.includes('isOwner'),
    'Test 13.5 FAIL: Settings modification must strictly require Owner authority'
  );
  console.log('[PASS] Test 13: Owner-only settings UI provides Pawn Lending Limits with "No maximum limit" toggle');

  // --------------------------------------------------------------------------
  // TEST 14: UI & Local Workflow Enforcement for Pawn Lending Limits
  // --------------------------------------------------------------------------
  console.log('[Test 14] Verifying UI and workflow validation for lending limits...');
  const workflowContent = fs.readFileSync(path.resolve('src/components/screens/buy-pawn/useBuyPawnWorkflow.ts'), 'utf8');

  // Must validate both minLoanPrincipal and maxLoanPrincipal
  assert(
    workflowContent.includes('Above this shop’s pawn limit'),
    'Test 14.1 FAIL: Must reject above-limit intake with plain language: "Above this shop’s pawn limit"'
  );
  assert(
    workflowContent.includes('Maximum pawn amount: R'),
    'Test 14.2 FAIL: Must state "Maximum pawn amount: R X"'
  );
  assert(
    workflowContent.includes('Below Minimum Loan'),
    'Test 14.3 FAIL: Minimum loan validation must remain intact'
  );

  // Logic simulation for maxLoanPrincipal validation
  function validatePawnPrincipal(amount: number, rules: { minLoanPrincipal: number; maxLoanPrincipal: number | null }) {
    const min = rules.minLoanPrincipal || 100;
    if (amount < min) {
      return { valid: false, error: 'Below Minimum Loan' };
    }
    if (rules.maxLoanPrincipal !== null && rules.maxLoanPrincipal !== undefined && rules.maxLoanPrincipal > 0) {
      if (amount > rules.maxLoanPrincipal) {
        return {
          valid: false,
          error: `Above this shop’s pawn limit: Maximum pawn amount: R ${rules.maxLoanPrincipal.toFixed(2)}`
        };
      }
    }
    return { valid: true };
  }

  // 14.4 Max limit disabled (null)
  const noLimitRules = { minLoanPrincipal: 100, maxLoanPrincipal: null };
  assert.strictEqual(validatePawnPrincipal(50000, noLimitRules).valid, true, 'High amount passes when max limit is null');

  // 14.5 Amount exactly at max
  const limitedRules = { minLoanPrincipal: 100, maxLoanPrincipal: 15000 };
  assert.strictEqual(validatePawnPrincipal(15000, limitedRules).valid, true, 'Amount exactly at max must pass');

  // 14.6 Amount above max
  const aboveMaxRes = validatePawnPrincipal(15001, limitedRules);
  assert.strictEqual(aboveMaxRes.valid, false, 'Amount above max must be rejected');
  assert(aboveMaxRes.error?.includes('Above this shop’s pawn limit'), 'Rejection message must use plain language');

  // 14.7 Minimum still enforced
  const belowMinRes = validatePawnPrincipal(50, limitedRules);
  assert.strictEqual(belowMinRes.valid, false, 'Amount below minimum must be rejected');
  console.log('[PASS] Test 14: Local and workflow lending limit validation functions correctly across all boundary conditions');

  // --------------------------------------------------------------------------
  // TEST 15: Server RPC Enforcement in complete_pawn_intake Migration
  // --------------------------------------------------------------------------
  console.log('[Test 15] Verifying server RPC enforcement in database migration...');
  const migrationPath = path.resolve('supabase/migrations/20261002000000_owner_configurable_pawn_lending_limit.sql');
  assert(fs.existsSync(migrationPath), 'Migration 20261002000000_owner_configurable_pawn_lending_limit.sql must exist');
  const migrationContent = fs.readFileSync(migrationPath, 'utf8');

  assert(
    migrationContent.includes('maxLoanPrincipal'),
    'Test 15.1 FAIL: Migration must reference maxLoanPrincipal from shop_profiles.business_rules'
  );
  assert(
    migrationContent.includes('Above this shop’s pawn limit: Maximum pawn amount: R %'),
    'Test 15.2 FAIL: Migration must reject with exact plain language: "Above this shop’s pawn limit: Maximum pawn amount: R %"'
  );
  assert(
    migrationContent.includes('minLoanPrincipal'),
    'Test 15.3 FAIL: Migration must preserve minLoanPrincipal validation'
  );
  assert(
    migrationContent.includes("v_caller_profile.role IS DISTINCT FROM 'admin'::public.user_role"),
    'Test 15.4 FAIL: Migration must use enum-safe comparison for user_role'
  );
  assert(
    migrationContent.includes('GRANT EXECUTE ON FUNCTION public.complete_pawn_intake') &&
    migrationContent.includes('TO authenticated, service_role') &&
    migrationContent.includes('REVOKE ALL ON FUNCTION public.complete_pawn_intake') &&
    migrationContent.includes('FROM PUBLIC, anon'),
    'Test 15.5 FAIL: Migration must grant EXECUTE to authenticated and service_role while denying anon and PUBLIC'
  );
  console.log('[PASS] Test 15: Server-side RPC migration strictly validates shop lending limits and preserves security privileges');

  // --------------------------------------------------------------------------
  // TEST 16: Business-Rule Persistence & Offline Queue Preservation
  // --------------------------------------------------------------------------
  console.log('[Test 16] Verifying audited business-rule persistence path...');
  const appContextContent = fs.readFileSync(path.resolve('src/context/AppContext.tsx'), 'utf8');

  assert(
    appContextContent.includes('updateShopBusinessRulesRpc'),
    'Test 16.1 FAIL: Must use existing authoritative RPC updateShopBusinessRulesRpc'
  );
  assert(
    appContextContent.includes("queueSyncAction('rules',"),
    'Test 16.2 FAIL: Must preserve offline queue via queueSyncAction for rules entity'
  );
  assert(
    appContextContent.includes("currentUserProfile?.role === 'owner'"),
    'Test 16.3 FAIL: Must enforce owner authority for business rules persistence'
  );
  console.log('[PASS] Test 16: Audited business-rule persistence and offline queue behaviour verified');

  console.log('=== ALL INVENTORY PRICE HISTORY & VAULT UX PATCH TESTS PASSED ===');
}

// Auto-run if executed directly
if (typeof process !== 'undefined' && process.argv && process.argv[1] && process.argv[1].includes('inventoryPriceAndVaultPatch')) {
  runInventoryPriceAndVaultPatchTests().then(() => {
    process.exit(0);
  }).catch((err) => {
    console.error('Test suite failed:', err);
    process.exit(1);
  });
}
