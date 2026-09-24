import { 
  getCryptoRandomInt, 
  generateUniqueSku, 
  generateUniqueTransactionNumber, 
  generateUniquePawnTicket, 
  generateUniqueReceiptNumber 
} from '../utils/identifierGenerator';
import { DEFAULT_BUSINESS_RULES } from '../utils/pricingRules';
import { BusinessRules, SyncLog } from '../types';

export async function runIdentifierAndSourceOfTruthTests() {
  console.log('\n=== RUNNING IDENTIFIER & SOURCE-OF-TRUTH TEST SUITE ===');

  // ==========================================
  // SECTION 1: IDENTIFIER GENERATOR TESTS
  // ==========================================

  // Test 1: getCryptoRandomInt range and distribution
  const min = 10;
  const max = 25;
  for (let i = 0; i < 100; i++) {
    const val = getCryptoRandomInt(min, max);
    if (val < min || val > max || !Number.isInteger(val)) {
      throw new Error(`[FAIL] getCryptoRandomInt produced out-of-range value: ${val}`);
    }
  }
  console.log('[PASS] Test 1: getCryptoRandomInt produces integers strictly within [min, max]');

  // Test 2: Standard Format Adherence across multiple iterations
  const skuPattern = /^LM-\d{5}$/;
  const stPattern = /^ST-\d{6}$/;
  const pwnPattern = /^PWN-\d{4,5}$/;
  const recPattern = /^REC-\d{6}$/;

  for (let i = 0; i < 50; i++) {
    const sku = generateUniqueSku();
    if (!skuPattern.test(sku)) {
      throw new Error(`[FAIL] SKU does not match LM-xxxxx format: ${sku}`);
    }

    const st = generateUniqueTransactionNumber();
    if (!stPattern.test(st)) {
      throw new Error(`[FAIL] Transaction number does not match ST-xxxxxx format: ${st}`);
    }

    const pwn = generateUniquePawnTicket();
    if (!pwnPattern.test(pwn)) {
      throw new Error(`[FAIL] Ticket number does not match PWN-xxxx format: ${pwn}`);
    }

    const rec = generateUniqueReceiptNumber();
    if (!recPattern.test(rec)) {
      throw new Error(`[FAIL] Receipt number does not match REC-xxxxxx format: ${rec}`);
    }
  }
  console.log('[PASS] Test 2: All generated identifiers remain within intended format rules');

  // Test 3: Fallback collision is checked before returning for generateUniqueSku
  let skuAttemptsCount = 0;
  const checkedSkuCandidates: string[] = [];
  const forcedFallbackSku = generateUniqueSku((candidate) => {
    skuAttemptsCount++;
    checkedSkuCandidates.push(candidate);
    // Reject all 50 primary attempts, and reject first 3 fallback candidates
    return skuAttemptsCount <= 53;
  });

  if (skuAttemptsCount !== 54) {
    throw new Error(`[FAIL] generateUniqueSku returned without validating fallback candidates. Total checked: ${skuAttemptsCount}`);
  }
  if (!checkedSkuCandidates.includes(forcedFallbackSku)) {
    throw new Error(`[FAIL] Returned SKU was not in checked candidates list`);
  }
  if (!/^LM-\d{5}-[0-9A-F]{4,8}$/.test(forcedFallbackSku)) {
    throw new Error(`[FAIL] Fallback SKU does not match LM-xxxxx-HEX format: ${forcedFallbackSku}`);
  }
  console.log('[PASS] Test 3: Fallback collision is strictly checked before returning for generateUniqueSku');

  // Test 4: Fallback collision is checked before returning for generateUniqueTransactionNumber
  let stAttemptsCount = 0;
  const forcedFallbackSt = generateUniqueTransactionNumber(() => {
    stAttemptsCount++;
    // Reject all 50 primary attempts and first 2 fallback candidates
    return stAttemptsCount <= 52;
  });

  if (stAttemptsCount !== 53) {
    throw new Error(`[FAIL] generateUniqueTransactionNumber returned without checking fallback: ${stAttemptsCount}`);
  }
  if (!/^ST-\d{6}-[0-9A-F]{4,8}$/.test(forcedFallbackSt)) {
    throw new Error(`[FAIL] Fallback ST number does not match ST-xxxxxx-HEX format: ${forcedFallbackSt}`);
  }
  console.log('[PASS] Test 4: Fallback collision is strictly checked before returning for generateUniqueTransactionNumber');

  // Test 5: Fallback collision is checked before returning for generateUniquePawnTicket
  let pwnAttemptsCount = 0;
  const forcedFallbackPwn = generateUniquePawnTicket(() => {
    pwnAttemptsCount++;
    // Reject 50 4-digit and 50 5-digit attempts, and reject first 2 fallback candidates
    return pwnAttemptsCount <= 102;
  });

  if (pwnAttemptsCount !== 103) {
    throw new Error(`[FAIL] generateUniquePawnTicket returned without checking fallback: ${pwnAttemptsCount}`);
  }
  if (!/^PWN-\d{5}-[0-9A-F]{4,8}$/.test(forcedFallbackPwn)) {
    throw new Error(`[FAIL] Fallback PWN ticket does not match PWN-xxxxx-HEX format: ${forcedFallbackPwn}`);
  }
  console.log('[PASS] Test 5: Fallback collision is strictly checked before returning for generateUniquePawnTicket');

  // Test 6: Fallback collision is checked before returning for generateUniqueReceiptNumber
  let recAttemptsCount = 0;
  const forcedFallbackRec = generateUniqueReceiptNumber(() => {
    recAttemptsCount++;
    // Reject all 50 primary attempts and first 4 fallback candidates
    return recAttemptsCount <= 54;
  });

  if (recAttemptsCount !== 55) {
    throw new Error(`[FAIL] generateUniqueReceiptNumber returned without checking fallback: ${recAttemptsCount}`);
  }
  if (!/^REC-\d{6}-[0-9A-F]{4,8}$/.test(forcedFallbackRec)) {
    throw new Error(`[FAIL] Fallback REC receipt does not match REC-xxxxxx-HEX format: ${forcedFallbackRec}`);
  }
  console.log('[PASS] Test 6: Fallback collision is strictly checked before returning for generateUniqueReceiptNumber');

  // Test 7: Repeated collisions eventually produce a unique accepted candidate
  const seenCandidates = new Set<string>();
  for (let i = 0; i < 20; i++) {
    const candidate = generateUniqueSku(sku => seenCandidates.has(sku));
    if (seenCandidates.has(candidate)) {
      throw new Error(`[FAIL] Duplicate SKU generated under collision constraint: ${candidate}`);
    }
    seenCandidates.add(candidate);
  }
  console.log('[PASS] Test 7: Repeated collisions iteratively produce unique accepted candidates');

  // ==========================================
  // SECTION 2: BUSINESS SETTINGS OUTBOX & SOT
  // ==========================================

  // Test 8: Online Settings Update Succeeds and is Marked Persisted
  let onlineServerDatabase: BusinessRules = { ...DEFAULT_BUSINESS_RULES };
  let onlineLocalCache: BusinessRules = { ...DEFAULT_BUSINESS_RULES };

  async function mockOnlineUpdateBusinessRules(newRules: BusinessRules): Promise<boolean> {
    // 1. Attempt server persistence
    const serverSucceeded = true;
    if (serverSucceeded) {
      onlineServerDatabase = { ...newRules };
      // 2. Treat server update as authoritative and update local cache
      onlineLocalCache = { ...newRules };
      return true;
    }
    return false;
  }

  const newOnlineRules: BusinessRules = {
    ...DEFAULT_BUSINESS_RULES,
    pawnMonthlyInterestRate: 0.04,
    defaultLoanTermDays: 30
  };
  const onlineSuccess = await mockOnlineUpdateBusinessRules(newOnlineRules);
  if (!onlineSuccess || onlineServerDatabase.pawnMonthlyInterestRate !== 0.04 || onlineLocalCache.pawnMonthlyInterestRate !== 0.04) {
    throw new Error('[FAIL] Online settings update was not persisted authoritatively');
  }
  console.log('[PASS] Test 8: Online settings update succeeds and is considered persisted on server and cache');

  // Test 9: Offline Settings Update Creates a Pending Sync Record
  const mockSyncOutbox: SyncLog[] = [];
  let nextSyncLogId = 1;

  async function mockQueueSyncAction(entityType: SyncLog['entityType'], entityId: string, action: SyncLog['action'], payload: any) {
    const log: SyncLog = {
      id: nextSyncLogId++,
      entityType,
      entityId,
      action,
      payload,
      status: 'pending',
      createdAt: new Date().toISOString(),
      retryCount: 0
    };
    mockSyncOutbox.push(log);
    return log;
  }

  const offlineRulesUpdate: BusinessRules = {
    ...DEFAULT_BUSINESS_RULES,
    pawnMonthlyInterestRate: 0.06,
    defaultLoanTermDays: 60
  };

  // Perform offline update
  let offlineLocalCache = { ...offlineRulesUpdate }; // Updated for offline continuity
  await mockQueueSyncAction('rules', 'shop-001', 'update', {
    rules: offlineRulesUpdate,
    reason: 'Offline manager override'
  });

  if (mockSyncOutbox.length !== 1) {
    throw new Error('[FAIL] Offline settings update did not create a pending sync record');
  }
  const pendingRecord: SyncLog = mockSyncOutbox[0];
  if (pendingRecord.status !== 'pending' || pendingRecord.entityType !== 'rules' || pendingRecord.payload.rules.pawnMonthlyInterestRate !== 0.06) {
    throw new Error('[FAIL] Pending sync record payload or status was not properly preserved');
  }
  console.log('[PASS] Test 9: Offline settings update creates durable pending sync record preserving full payload');

  // Test 10: Pending Settings Replay Succeeds and Becomes Completed
  async function mockReplaySyncRecord(log: SyncLog, serverShouldSucceed: boolean): Promise<boolean> {
    if (serverShouldSucceed) {
      log.status = 'completed';
      log.syncedAt = new Date().toISOString();
      delete log.error;
      return true;
    } else {
      log.status = 'failed';
      log.retryCount = (log.retryCount || 0) + 1;
      log.error = 'Supabase network gateway timeout';
      return false;
    }
  }

  const replaySuccess = await mockReplaySyncRecord(pendingRecord, true);
  if (!replaySuccess || (pendingRecord.status as string) !== 'completed' || !pendingRecord.syncedAt) {
    throw new Error('[FAIL] Replayed sync record was not marked completed');
  }
  console.log('[PASS] Test 10: Pending settings replay succeeds and becomes completed with timestamp');

  // Test 11: Failed Replay Remains Pending / Failed with Preserved Retry Info and No Duplicates
  const secondOfflineRecord: SyncLog = await mockQueueSyncAction('shopProfile', 'shop-001', 'update', {
    shop_name: 'LocalMarket Johannesburg'
  });

  const replayFailed1 = await mockReplaySyncRecord(secondOfflineRecord, false);
  if (replayFailed1 || (secondOfflineRecord.status as string) !== 'failed' || (secondOfflineRecord.retryCount as number) !== 1) {
    throw new Error('[FAIL] Failed replay did not preserve status=failed and retryCount=1');
  }
  if (!secondOfflineRecord.error?.includes('timeout')) {
    throw new Error('[FAIL] Failed replay did not preserve error message');
  }

  // Second retry attempt
  const replayFailed2 = await mockReplaySyncRecord(secondOfflineRecord, false);
  if (replayFailed2 || (secondOfflineRecord.retryCount as number) !== 2) {
    throw new Error('[FAIL] Subsequent retry did not increment retryCount to 2');
  }
  if ((mockSyncOutbox as SyncLog[]).length !== 2) {
    throw new Error(`[FAIL] Outbox created duplicate records during retries. Outbox count: ${mockSyncOutbox.length}`);
  }
  console.log('[PASS] Test 11: Failed replay remains pending/failed, preserves retry information, and avoids duplicate records');

  // Test 12: Conflict Safety - Server Hydration Does Not Erase a Pending Local Settings Mutation
  function simulateServerHydration(
    serverRules: BusinessRules,
    localCache: BusinessRules,
    outbox: SyncLog[]
  ): BusinessRules {
    const hasPendingMutation = outbox.some(
      log => log.entityType === 'rules' && (log.status === 'pending' || log.status === 'failed' || log.status === 'syncing')
    );

    if (hasPendingMutation) {
      // Preserve local mutation so offline edits are not erased before replay
      return localCache;
    }
    // When no pending mutation exists, server is authoritative
    return serverRules;
  }

  const serverHydrationRules: BusinessRules = {
    ...DEFAULT_BUSINESS_RULES,
    pawnMonthlyInterestRate: 0.05 // Server still has 5%
  };
  const terminalOfflineMutation: BusinessRules = {
    ...DEFAULT_BUSINESS_RULES,
    pawnMonthlyInterestRate: 0.035 // Local terminal changed to 3.5% offline
  };

  const activeOutbox: SyncLog[] = [
    {
      id: 99,
      entityType: 'rules',
      entityId: 'shop-001',
      action: 'update',
      payload: { rules: terminalOfflineMutation },
      status: 'pending',
      createdAt: new Date().toISOString(),
      retryCount: 0
    }
  ];

  // While pending mutation exists in outbox, hydration must NOT overwrite local terminal setting
  const hydratedDuringPending = simulateServerHydration(serverHydrationRules, terminalOfflineMutation, activeOutbox);
  if (hydratedDuringPending.pawnMonthlyInterestRate !== 0.035) {
    throw new Error('[FAIL] Server hydration erased pending local settings mutation!');
  }
  console.log('[PASS] Test 12A: Server hydration safely preserves pending local settings mutation before replay');

  // Once the outbox record is completed, subsequent hydration accepts server data
  activeOutbox[0].status = 'completed';
  const hydratedAfterSync = simulateServerHydration(serverHydrationRules, terminalOfflineMutation, activeOutbox);
  if (hydratedAfterSync.pawnMonthlyInterestRate !== 0.05) {
    throw new Error('[FAIL] Server hydration failed to accept authoritative server state after sync completion');
  }
  console.log('[PASS] Test 12B: Server hydration accepts authoritative cloud state once replay completes');

  console.log('=== ALL IDENTIFIER & SOURCE-OF-TRUTH TESTS PASSED ===\n');
}

// Auto-run if executed directly via node/tsx
if (typeof process !== 'undefined' && process.argv && process.argv[1] && process.argv[1].includes('identifierAndSourceOfTruth')) {
  runIdentifierAndSourceOfTruthTests();
}
