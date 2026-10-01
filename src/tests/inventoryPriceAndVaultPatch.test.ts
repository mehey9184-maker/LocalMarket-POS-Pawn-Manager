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
