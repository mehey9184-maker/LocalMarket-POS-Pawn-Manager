import assert from 'node:assert';
import { calculatePawnFees, DEFAULT_BUSINESS_RULES } from '../utils/pricingRules';
import { DEFAULT_IDLE_LOCK_TIMEOUT_MS, MAX_IDLE_LOCK_DEFERRAL_MS, evaluateIdleLockDecision } from '../hooks/useIdleLock';
import { getSyncChipState } from '../components/Header';
import { canDismissAccountPicker, resolvePostUnlockTab, getPermittedTabsForUser } from '../components/auth/AccountPicker';

export async function runWorkerFrictionPassTests() {
  console.log('\n====================================================');
  console.log('   RUNNING WORKER-FRICTION PASS 1 TEST SUITE       ');
  console.log('====================================================');

  // =========================================================================
  // 1. BEHAVIOR TEST: SYNC STATUS CHIP STATE LOGIC
  // =========================================================================
  console.log('[Test 1] Executing behavioural tests for Header sync status chip state logic...');

  // 1.1 Failed items present (highest priority: attention color, badge text, pulsing indicator)
  const failedChip = getSyncChipState(true, 5, 2);
  assert.strictEqual(failedChip.text, '2 failed — tap to review', 'Failed items must display explicit review prompt');
  assert(failedChip.badgeClass.includes('rose'), 'Failed items must use attention rose styling');
  assert.strictEqual(failedChip.dotPulse, true, 'Failed chip dot must pulse');

  // 1.2 Offline with queued changes
  const offlineWithQueueChip = getSyncChipState(false, 4, 0);
  assert.strictEqual(offlineWithQueueChip.text, 'Offline (4 queued)', 'Offline with queue must show Offline and total queued count');
  assert(offlineWithQueueChip.badgeClass.includes('amber'), 'Offline chip must use amber styling');
  assert.strictEqual(offlineWithQueueChip.dotPulse, false, 'Offline chip dot should not pulse');

  // 1.3 Offline with zero queued changes
  const offlineCleanChip = getSyncChipState(false, 0, 0);
  assert.strictEqual(offlineCleanChip.text, 'Offline', 'Offline with 0 queue must show simple Offline label');

  // 1.4 Online with pending sync changes
  const pendingChip = getSyncChipState(true, 3, 0);
  assert.strictEqual(pendingChip.text, '3 waiting to sync', 'Pending items online must show count waiting to sync');
  assert(pendingChip.badgeClass.includes('sky'), 'Pending chip must use sky styling');
  assert.strictEqual(pendingChip.dotPulse, true, 'Pending chip dot must pulse');

  // 1.5 Online completely clean (0 pending, 0 failed)
  const cleanChip = getSyncChipState(true, 0, 0);
  assert.strictEqual(cleanChip.text, 'All saved', 'Zero pending/failed online must show All saved');
  assert(cleanChip.badgeClass.includes('emerald'), 'All saved must use emerald styling');
  assert.strictEqual(cleanChip.dotPulse, false, 'All saved chip must not pulse');

  // 1.6 Invariant assertion: Never show "All saved" when pending or failed count > 0
  assert.notStrictEqual(getSyncChipState(true, 1, 0).text, 'All saved', 'Must not show All saved if pending > 0');
  assert.notStrictEqual(getSyncChipState(true, 0, 1).text, 'All saved', 'Must not show All saved if failed > 0');
  assert.notStrictEqual(getSyncChipState(false, 0, 0).text, 'All saved', 'Must not show All saved if offline');
  console.log('[PASS] Test 1: Header sync status chip behavioural state machine fully verified');

  // =========================================================================
  // 2. BEHAVIOR TEST: IDLE LOCK DECISION PURE FUNCTION
  // =========================================================================
  console.log('[Test 2] Executing behavioural tests for evaluateIdleLockDecision pure function...');
  assert.strictEqual(DEFAULT_IDLE_LOCK_TIMEOUT_MS, 300000, 'Default idle lock timeout must be 5 minutes (300,000 ms)');
  assert.strictEqual(MAX_IDLE_LOCK_DEFERRAL_MS, 600000, 'Maximum bounded deferral must be 10 minutes (600,000 ms)');

  // 2.1 Standard operational idle lock (no active modals or operation)
  const normalLock = evaluateIdleLockDecision({
    user: { id: 'u1' },
    profile: { id: 'p1' },
    activeTab: 'sell',
    isAccountPickerOpen: false,
    isSwitchingAccount: false,
    isBusy: false,
    isScannerModalOpen: false,
    activeReceiptModal: null,
    activeContractModal: null,
    elapsedIdleMs: 300000,
    maxDeferralMs: 600000,
  });
  assert.strictEqual(normalLock, 'lock', 'Normal till operation must lock upon timeout');

  // 2.2 Active modal deferral within 10-minute window (e.g. 7 minutes idle with open receipt)
  const receiptDeferred = evaluateIdleLockDecision({
    user: { id: 'u1' },
    profile: { id: 'p1' },
    activeTab: 'sell',
    isAccountPickerOpen: false,
    isSwitchingAccount: false,
    isBusy: false,
    isScannerModalOpen: false,
    activeReceiptModal: { id: 'rec-1' },
    activeContractModal: null,
    elapsedIdleMs: 420000, // 7 mins
    maxDeferralMs: 600000,
  });
  assert.strictEqual(receiptDeferred, 'defer', 'Open modal must defer lock when under 10 minutes');

  // 2.3 Active busy operation deferral (e.g. isBusy: true during checkout or intake finalization)
  const busyDeferred = evaluateIdleLockDecision({
    user: { id: 'u1' },
    profile: { id: 'p1' },
    activeTab: 'sell',
    isAccountPickerOpen: false,
    isSwitchingAccount: false,
    isBusy: true,
    isScannerModalOpen: false,
    activeReceiptModal: null,
    activeContractModal: null,
    elapsedIdleMs: 400000,
    maxDeferralMs: 600000,
  });
  assert.strictEqual(busyDeferred, 'defer', 'isBusy operation must defer lock when under 10 minutes');

  // 2.4 Bounded deferral cap exceeded (e.g. 10 minutes idle with open modal)
  const maxDeferralReached = evaluateIdleLockDecision({
    user: { id: 'u1' },
    profile: { id: 'p1' },
    activeTab: 'sell',
    isAccountPickerOpen: false,
    isSwitchingAccount: false,
    isBusy: true,
    isScannerModalOpen: false,
    activeReceiptModal: null,
    activeContractModal: null,
    elapsedIdleMs: 600000, // 10 mins
    maxDeferralMs: 600000,
  });
  assert.strictEqual(maxDeferralReached, 'lock', 'Must force lock when max bounded deferral (10 mins) is reached');

  // 2.5 Unauthenticated / setup screen noop
  const setupNoop = evaluateIdleLockDecision({
    user: { id: 'u1' },
    profile: { id: 'p1' },
    activeTab: 'shop-setup',
    isAccountPickerOpen: false,
    isSwitchingAccount: false,
    isBusy: false,
    isScannerModalOpen: false,
    activeReceiptModal: null,
    activeContractModal: null,
    elapsedIdleMs: 500000,
    maxDeferralMs: 600000,
  });
  assert.strictEqual(setupNoop, 'noop', 'Setup screens must return noop');

  console.log('[PASS] Test 2: evaluateIdleLockDecision pure function fully verified');

  // =========================================================================
  // 3. BEHAVIOR TEST: ACCOUNT PICKER DISMISS & TAB RESOLUTION PURE FUNCTIONS
  // =========================================================================
  console.log('[Test 3] Executing behavioural tests for AccountPicker pure functions...');

  // 3.1 canDismissAccountPicker rules
  assert.strictEqual(
    canDismissAccountPicker({ isIdleLocked: true, isSwitchingAccount: false }),
    false,
    'Cannot dismiss picker when idle-locked'
  );
  assert.strictEqual(
    canDismissAccountPicker({ isIdleLocked: false, isSwitchingAccount: true }),
    false,
    'Cannot dismiss picker while account switch is in progress'
  );
  assert.strictEqual(
    canDismissAccountPicker({ isIdleLocked: false, isSwitchingAccount: false }),
    true,
    'Can dismiss picker during normal voluntary account switch'
  );

  // 3.2 resolvePostUnlockTab rules
  const cashierPermittedTabs = getPermittedTabsForUser((p) => p === 'sales' || p === 'inventory', false);
  const managerPermittedTabs = getPermittedTabsForUser(() => true, true);

  // 3.2a Same user unlocks on permitted tab -> preserves tab
  const sameUserPreservesTab = resolvePostUnlockTab({
    lockedProfileId: 'user-cashier-1',
    unlockedProfileId: 'user-cashier-1',
    unlockedRole: 'cashier',
    currentTab: 'inventory',
    permittedTabs: cashierPermittedTabs,
  });
  assert.strictEqual(sameUserPreservesTab, 'inventory', 'Same user unlocking on permitted tab preserves active screen');

  // 3.2b Different user unlocks (cashier) -> routes to cashier default ('sell')
  const diffUserCashier = resolvePostUnlockTab({
    lockedProfileId: 'user-manager-1',
    unlockedProfileId: 'user-cashier-2',
    unlockedRole: 'cashier',
    currentTab: 'inventory',
    permittedTabs: cashierPermittedTabs,
  });
  assert.strictEqual(diffUserCashier, 'sell', 'Different cashier unlocking routes to sell default');

  // 3.2c Different user unlocks (manager) -> routes to manager default ('home')
  const diffUserManager = resolvePostUnlockTab({
    lockedProfileId: 'user-cashier-1',
    unlockedProfileId: 'user-manager-1',
    unlockedRole: 'manager',
    currentTab: 'sell',
    permittedTabs: managerPermittedTabs,
  });
  assert.strictEqual(diffUserManager, 'home', 'Different manager unlocking routes to home default');

  // 3.2d Same user unlocks on unpermitted tab -> routes to role default
  const unpermittedTabReset = resolvePostUnlockTab({
    lockedProfileId: 'user-cashier-1',
    unlockedProfileId: 'user-cashier-1',
    unlockedRole: 'cashier',
    currentTab: 'saps', // Not in cashierPermittedTabs
    permittedTabs: cashierPermittedTabs,
  });
  assert.strictEqual(unpermittedTabReset, 'sell', 'Unlocking on unpermitted tab resets to role default');

  console.log('[PASS] Test 3: AccountPicker pure decision functions fully verified');

  // =========================================================================
  // 4. BEHAVIOR TEST: LIVE PAWN TERMS FINANCIAL CALCULATION PARITY
  // =========================================================================
  console.log('[Test 4] Executing calculation parity tests for Live Pawn Terms...');
  const testRules = {
    ...DEFAULT_BUSINESS_RULES,
    pawnMonthlyInterestRate: 0.15,
    pawnStorageAdminFeeRate: 0.05,
    defaultLoanTermDays: 30,
  };

  const calcPrincipal1000 = calculatePawnFees(1000, testRules);
  assert.strictEqual(calcPrincipal1000.interest, 150, 'Interest on R1000 @ 15% must be R150.00');
  assert.strictEqual(calcPrincipal1000.storage, 50, 'Storage fee on R1000 @ 5% must be R50.00');
  assert.strictEqual(calcPrincipal1000.total, 1200, 'Total redemption on R1000 must be R1200.00');

  const calcPrincipal2500 = calculatePawnFees(2500, testRules);
  assert.strictEqual(calcPrincipal2500.interest, 375, 'Interest on R2500 @ 15% must be R375.00');
  assert.strictEqual(calcPrincipal2500.storage, 125, 'Storage fee on R2500 @ 5% must be R125.00');
  assert.strictEqual(calcPrincipal2500.total, 3000, 'Total redemption on R2500 must be R3000.00');

  console.log('[PASS] Test 4: Live Pawn Terms calculations verified across multiple price brackets');

  console.log('====================================================');
  console.log('   ALL WORKER-FRICTION PASS 1 TESTS PASSED!        ');
  console.log('====================================================');
}
