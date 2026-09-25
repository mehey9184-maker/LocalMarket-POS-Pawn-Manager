/**
 * Offline Queue & Reconnection Synchronization Test Suite
 */

import 'fake-indexeddb/auto';
import { db } from '../db';
import { SyncService } from '../services/SyncService';
import { saveSupabaseCredentials, getSupabase } from '../services/supabase';
import { SyncLog } from '../types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[AssertionFailed] ${message}`);
  }
}

// Valid base64url JWT for Supabase auth client
const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
const payload = Buffer.from(JSON.stringify({ sub: 'mock-user-123', exp: Math.floor(Date.now() / 1000) + 36000, role: 'authenticated' })).toString('base64url');
const MOCK_JWT = `${header}.${payload}.dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk`;

export async function runOfflineQueueSyncTests() {
  console.log('=== RUNNING OFFLINE QUEUE & RECONNECT SYNCHRONIZATION TESTS ===');

  const originalFetch = globalThis.fetch;
  saveSupabaseCredentials('https://mock.supabase.co', 'mock-anon-key-12345678901234567890');

  // Helper to attach mock fetch and ensure Supabase session is active
  async function attachMockFetchAndSession(
    handler: (urlStr: string, reqIndex: number) => Response | Promise<Response>
  ) {
    let reqCount = 0;
    globalThis.fetch = (async (url: string | URL | Request) => {
      const urlStr = url.toString();
      reqCount++;

      if (urlStr.includes('/auth/v1/user')) {
        return new Response(JSON.stringify({
          id: 'mock-user-123',
          email: 'test@localmarket.co.za',
          role: 'authenticated',
          app_metadata: { provider: 'email' },
          user_metadata: { full_name: 'Test Operator' }
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      if (urlStr.includes('/auth/v1/')) {
        return new Response(JSON.stringify({
          access_token: MOCK_JWT,
          refresh_token: 'mock-refresh-token',
          expires_at: Math.floor(Date.now() / 1000) + 36000,
          expires_in: 36000,
          user: { id: 'mock-user-123', email: 'test@localmarket.co.za' }
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return handler(urlStr, reqCount);
    }) as any;

    const sbClient = getSupabase();
    if (sbClient) {
      await sbClient.auth.setSession({
        access_token: MOCK_JWT,
        refresh_token: 'mock-refresh-token'
      });
    }
  }

  try {
    // Initial mock setup
    await attachMockFetchAndSession(() => new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    // Clean database before test run
    await db.syncLogs.clear();
    await db.sales.clear();
    await db.inventory.clear();
    await db.customers.clear();
    await db.sellers.clear();

    // ---------------------------------------------------------
    // Test A — Offline mutation survives in the durable outbox
    // ---------------------------------------------------------
    console.log('[Test A] Creating realistic offline sale mutation...');
    const saleId = 'sale-offline-durable-A';
    const localSalePayload = {
      id: saleId,
      receiptNumber: 'REC-OFF-A01',
      timestamp: new Date().toISOString(),
      subtotal: 1000,
      vatAmount: 150,
      total: 1150,
      tenderMethod: 'Cash',
      amountTendered: 1200,
      change: 50,
      items: [{ id: 'item-A1', title: 'Power Drill 18V', quantity: 1, retailPrice: 1150 }]
    };

    // Write to Dexie local operational store AND durable outbox
    await db.sales.put(localSalePayload as any);
    await db.syncLogs.add({
      entityType: 'sales',
      entityId: saleId,
      action: 'create',
      status: 'pending',
      createdAt: new Date().toISOString(),
      retryCount: 0,
      payload: localSalePayload
    });

    // Verify local operational store state
    const savedSale = await db.sales.get(saleId);
    assert(Boolean(savedSale), 'Test A: Local sale record must exist in db.sales');
    assert(savedSale?.receiptNumber === 'REC-OFF-A01', 'Test A: Local sale record fields preserved');

    // Verify durable outbox state
    const outboxLog = await db.syncLogs.where('entityId').equals(saleId).first();
    assert(Boolean(outboxLog), 'Test A: Corresponding syncLog record exists in db.syncLogs');
    assert(outboxLog?.status === 'pending', 'Test A: Initial outbox log status must be pending');
    assert(outboxLog?.entityId === saleId, 'Test A: Outbox entity ID is stable');
    assert(outboxLog?.payload?.receiptNumber === 'REC-OFF-A01', 'Test A: Outbox payload preserved exactly');
    console.log('[PASS] Test A: Offline mutation survives in durable outbox with stable entity ID');

    // ---------------------------------------------------------
    // Test B — Large offline workload (250 pending sync actions)
    // ---------------------------------------------------------
    console.log('[Test B] Generating large offline workload (250 pending sync actions)...');
    await db.syncLogs.clear();
    const TOTAL_WORKLOAD = 250;
    const entityTypes = ['inventory', 'customers', 'sellers', 'sales'] as const;
    const baseTime = Date.now();

    for (let i = 0; i < TOTAL_WORKLOAD; i++) {
      const entityType = entityTypes[i % entityTypes.length];
      const entityId = `entity-b-${i}`;
      const createdAt = new Date(baseTime + i * 10).toISOString();

      await db.syncLogs.add({
        entityType,
        entityId,
        action: 'create',
        status: 'pending',
        createdAt,
        retryCount: 0,
        payload: { id: entityId, index: i, title: `Workload Item ${i}` }
      });
    }

    const pendingCount = await db.syncLogs.where('status').equals('pending').count();
    assert(pendingCount === 250, `Test B: Must have 250 pending sync actions in Dexie outbox (got ${pendingCount})`);

    const orderedLogs = await db.syncLogs.where('status').equals('pending').sortBy('createdAt');
    assert(orderedLogs.length === 250, 'Test B: All 250 logs retrieved from Dexie');
    assert(orderedLogs[0].entityId === 'entity-b-0', 'Test B: Ordering follows queue creation order (earliest first)');
    assert(orderedLogs[249].entityId === 'entity-b-249', 'Test B: Ordering follows queue creation order (latest last)');
    console.log('[PASS] Test B: Large offline workload (250 entries) remains durable and properly ordered in Dexie outbox');

    // ---------------------------------------------------------
    // Test C — Reconnect drains the complete queue
    // ---------------------------------------------------------
    console.log('[Test C] Simulating reconnect and queue drain for 250 items...');

    await attachMockFetchAndSession(() => new Response(JSON.stringify({
      success: true,
      status: 'synced',
      updated_at: new Date().toISOString()
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const drainResult = await SyncService.processAllPendingSync('shop-101', undefined, 0);

    assert(drainResult.processed === 250, `Test C: Expected 250 processed logs, got ${drainResult.processed}`);
    assert(drainResult.successful === 250, `Test C: Expected 250 successful logs, got ${drainResult.successful}`);
    assert(drainResult.failed === 0, `Test C: Expected 0 failed logs, got ${drainResult.failed}`);

    const remainingPending = await db.syncLogs.where('status').equals('pending').count();
    assert(remainingPending === 0, `Test C: Zero pending logs remaining after queue drain (got ${remainingPending})`);

    const completedCount = await db.syncLogs.where('status').equals('completed').count();
    assert(completedCount === 250, `Test C: All 250 logs updated to completed status (got ${completedCount})`);
    console.log('[PASS] Test C: Reconnect drains complete queue cleanly (250/250 succeeded, 0 pending)');

    // ---------------------------------------------------------
    // Test D — Idempotent replay
    // ---------------------------------------------------------
    console.log('[Test D] Verifying idempotent replay for retail sale, buy acquisition, and pawn intake...');

    await attachMockFetchAndSession(() => new Response(JSON.stringify({
      success: true,
      idempotent_replay: true,
      message: 'Operation already processed by server'
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const replaySaleLog: SyncLog = {
      id: 9991,
      entityType: 'sales',
      entityId: 'sale-replay-1',
      action: 'create',
      status: 'pending',
      retryCount: 0,
      createdAt: new Date().toISOString(),
      payload: {
        id: 'sale-replay-1',
        receiptNumber: 'REC-REP-001',
        subtotal: 500,
        vatAmount: 0,
        total: 500,
        items: [{ id: 'item-r1', retailPrice: 500 }]
      }
    };

    const replayBuyLog: SyncLog = {
      id: 9992,
      entityType: 'buyAcquisition',
      entityId: 'buy-replay-1',
      action: 'create',
      status: 'pending',
      retryCount: 0,
      createdAt: new Date().toISOString(),
      payload: {
        transactionId: 'buy-replay-1',
        transactionNumber: 'BUY-REP-001',
        sellerId: 'seller-1',
        items: [{ title: 'Gold Chain', costBasis: 1000 }],
        totalAmount: 1000
      }
    };

    const replayPawnLog: SyncLog = {
      id: 9993,
      entityType: 'pawnIntake',
      entityId: 'pawn-replay-1',
      action: 'create',
      status: 'pending',
      retryCount: 0,
      createdAt: new Date().toISOString(),
      payload: {
        loanId: 'pawn-replay-1',
        ticketNumber: 'PWN-REP-001',
        customerId: 'cust-1',
        principal: 2000
      }
    };

    const saleReplayRes = await SyncService.syncEntity(replaySaleLog, 'shop-101');
    assert(saleReplayRes.success === true, `Test D: Retail sale idempotent replay succeeded (error: ${saleReplayRes.error})`);

    const buyReplayRes = await SyncService.syncEntity(replayBuyLog, 'shop-101');
    assert(buyReplayRes.success === true, `Test D: Buy acquisition idempotent replay succeeded (error: ${buyReplayRes.error})`);

    const pawnReplayRes = await SyncService.syncEntity(replayPawnLog, 'shop-101');
    assert(pawnReplayRes.success === true, `Test D: Pawn intake idempotent replay succeeded (error: ${pawnReplayRes.error})`);

    console.log('[PASS] Test D: Idempotent replay recognized and safely processed across all transactional operations');

    // ---------------------------------------------------------
    // Test E — Mid-queue network failure / Partial progress
    // ---------------------------------------------------------
    console.log('[Test E] Simulating mid-queue network failure (partial progress)...');
    await db.syncLogs.clear();

    for (let i = 0; i < 20; i++) {
      await db.syncLogs.add({
        entityType: 'sales',
        entityId: `sale-partial-${i}`,
        action: 'create',
        status: 'pending',
        createdAt: new Date(baseTime + i * 100).toISOString(),
        retryCount: 0,
        payload: {
          id: `sale-partial-${i}`,
          receiptNumber: `REC-PARTIAL-${i}`,
          subtotal: 100,
          vatAmount: 0,
          total: 100,
          items: [{ id: `item-p-${i}`, retailPrice: 100 }]
        }
      });
    }

    let rpcCount = 0;
    await attachMockFetchAndSession((urlStr) => {
      rpcCount++;
      // First 10 RPC/API calls succeed, call 11 fails due to network drop
      if (rpcCount <= 10) {
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      } else {
        return new Response(JSON.stringify({ success: false, error: 'Network connection lost mid-queue' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    });

    const partialResult = await SyncService.processAllPendingSync('shop-101', undefined, 0);

    assert(partialResult.processed === 20, 'Test E: Attempted all 20 logs');
    assert(partialResult.successful === 10, `Test E: First 10 logs succeeded (got ${partialResult.successful})`);
    assert(partialResult.failed === 10, `Test E: Remaining 10 logs marked failed (got ${partialResult.failed})`);

    const completedPartialCount = await db.syncLogs.where('status').equals('completed').count();
    assert(completedPartialCount === 10, `Test E: Exactly 10 logs remain marked completed (got ${completedPartialCount})`);

    const failedPartialCount = await db.syncLogs.where('status').equals('failed').count();
    assert(failedPartialCount === 10, `Test E: Exactly 10 logs marked failed for retry (got ${failedPartialCount})`);

    // Network restores! Subsequent retry drains remaining 10 failed logs.
    console.log('[Test E] Network restored! Retrying processAllPendingSync...');
    await attachMockFetchAndSession(() => new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const retryResult = await SyncService.processAllPendingSync('shop-101', undefined, 0);

    assert(retryResult.successful === 10, `Test E: Retry successfully processed remaining 10 failed logs (got ${retryResult.successful})`);

    const finalCompletedCount = await db.syncLogs.where('status').equals('completed').count();
    assert(finalCompletedCount === 20, `Test E: All 20 logs now reach completed status after network recovery (got ${finalCompletedCount})`);

    const finalFailedCount = await db.syncLogs.where('status').equals('failed').count();
    assert(finalFailedCount === 0, 'Test E: Zero failed logs remaining');

    console.log('[PASS] Test E: Mid-queue network failure handled gracefully with partial progress preserved and clean recovery on reconnect');

    // ---------------------------------------------------------
    // Test F — Failed entries automatic retry eligibility on reconnect
    // ---------------------------------------------------------
    console.log('[Test F] Verifying failed sync entries are retried when reconnected...');
    await db.syncLogs.clear();
    await db.syncLogs.add({
      entityType: 'sales',
      entityId: 'sale-failed-1',
      action: 'create',
      status: 'failed',
      createdAt: new Date().toISOString(),
      retryCount: 1,
      error: 'Previous network timeout',
      payload: { id: 'sale-failed-1', receiptNumber: 'REC-FAIL-1', subtotal: 100, vatAmount: 0, total: 100, items: [] }
    });

    await attachMockFetchAndSession(() => new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    // Failed entries must be queried and retried by processAllPendingSync
    const retryFailedResult = await SyncService.processAllPendingSync('shop-101', undefined, 0);
    assert(retryFailedResult.processed === 1, `Test F: 1 failed log processed (got ${retryFailedResult.processed})`);
    assert(retryFailedResult.successful === 1, `Test F: Failed log successfully retried (got ${retryFailedResult.successful})`);

    const finalLog = await db.syncLogs.where('entityId').equals('sale-failed-1').first();
    assert(finalLog?.status === 'completed', 'Test F: Status updated from failed to completed upon retry');
    console.log('[PASS] Test F: Failed sync entries are eligible and successfully retried on reconnect');

    // ---------------------------------------------------------
    // Test G — Durable restart / reinitialization
    // ---------------------------------------------------------
    console.log('[Test G] Verifying durable restart with partially finished queue...');
    await db.syncLogs.clear();
    for (let i = 0; i < 10; i++) {
      await db.syncLogs.add({
        entityType: 'customers',
        entityId: `cust-restart-${i}`,
        action: 'create',
        status: i < 5 ? 'completed' : 'pending',
        createdAt: new Date(baseTime + i * 100).toISOString(),
        retryCount: 0,
        payload: { id: `cust-restart-${i}`, name: `Customer ${i}` }
      });
    }

    // Process queue (only 5 pending items should be processed)
    await attachMockFetchAndSession(() => new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const restartResult = await SyncService.processAllPendingSync('shop-101', undefined, 0);
    assert(restartResult.processed === 5, `Test G: Only 5 pending entries processed (got ${restartResult.processed})`);
    assert(restartResult.successful === 5, 'Test G: 5 pending entries succeeded');

    const totalCompleted = await db.syncLogs.where('status').equals('completed').count();
    assert(totalCompleted === 10, `Test G: All 10 entries now completed (got ${totalCompleted})`);
    console.log('[PASS] Test G: Unfinished work resumes cleanly and completed work is preserved across restarts');

    // ---------------------------------------------------------
    // Test H — Single-flight protection within active application runtime
    // ---------------------------------------------------------
    console.log('[Test H] Verifying single-flight protection for concurrent SyncService.processAllPendingSync calls...');
    await db.syncLogs.clear();
    await db.syncLogs.add({
      entityType: 'sales',
      entityId: 'sale-concurrent-1',
      action: 'create',
      status: 'pending',
      createdAt: new Date().toISOString(),
      retryCount: 0,
      payload: { id: 'sale-concurrent-1', receiptNumber: 'REC-CONC-1', subtotal: 100, vatAmount: 0, total: 100, items: [] }
    });

    let backendCallCount = 0;
    await attachMockFetchAndSession(async () => {
      backendCallCount++;
      await new Promise(r => setTimeout(r, 20));
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });

    // Invoke processAllPendingSync twice simultaneously
    const p1 = SyncService.processAllPendingSync('shop-101', undefined, 10);
    const p2 = SyncService.processAllPendingSync('shop-101', undefined, 10);

    const [r1, r2] = await Promise.all([p1, p2]);

    assert(r1 === r2, 'Test H: Both callers must receive the exact same active sync promise instance');
    assert(r1.processed === 1, `Test H: Only 1 log was processed (got ${r1.processed})`);
    assert(backendCallCount === 1, `Test H: Backend was called exactly once (got ${backendCallCount})`);
    console.log('[PASS] Test H: Single-flight concurrency guard within active JS runtime verified');

    // ---------------------------------------------------------
    // Test I — Network flapping resilience
    // ---------------------------------------------------------
    console.log('[Test I] Verifying network flapping resilience...');
    await db.syncLogs.clear();
    await db.syncLogs.add({
      entityType: 'sellers',
      entityId: 'seller-flap-1',
      action: 'create',
      status: 'pending',
      createdAt: new Date().toISOString(),
      retryCount: 0,
      payload: { id: 'seller-flap-1', name: 'Flapping Seller' }
    });

    // Flap 1: Network drop failure
    await attachMockFetchAndSession(() => new Response(JSON.stringify({ error: 'Offline' }), { status: 503, headers: { 'Content-Type': 'application/json' } }));
    const flap1 = await SyncService.processAllPendingSync('shop-101', undefined, 0);
    assert(flap1.failed === 1, 'Test I: Flap 1 failed as expected');

    // Flap 2: Network restored
    await attachMockFetchAndSession(() => new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const flap2 = await SyncService.processAllPendingSync('shop-101', undefined, 0);
    assert(flap2.successful === 1, 'Test I: Flap 2 succeeded upon recovery');

    const flapFinalLog = await db.syncLogs.where('entityId').equals('seller-flap-1').first();
    assert(flapFinalLog?.status === 'completed', 'Test I: Final state is completed with zero data loss');
    console.log('[PASS] Test I: Network flapping handled without data loss or stuck entries');

    // ---------------------------------------------------------
    // Regression Test 1 — Synthetic/legacy CUST-005 validation
    // ---------------------------------------------------------
    console.log('[Test 1] Verifying synthetic legacy customer CUST-005 is validated and quarantined...');
    await db.syncLogs.clear();
    const fakePawnLog: SyncLog = {
      entityType: 'pawnIntake',
      entityId: crypto.randomUUID(),
      action: 'create',
      status: 'pending',
      createdAt: new Date().toISOString(),
      retryCount: 0,
      payload: {
        loanId: crypto.randomUUID(),
        ticketNumber: 'TKT-FAKE-123',
        customerId: 'CUST-005', // Synthetic!
        itemId: crypto.randomUUID(),
        principal: 500
      }
    };
    
    let backendCalled = false;
    await attachMockFetchAndSession(() => {
      backendCalled = true;
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });

    const res1 = await SyncService.syncEntity(fakePawnLog, crypto.randomUUID());
    assert(res1.success === false, 'Test 1: Sync must fail for synthetic CUST-005 customerId');
    assert(res1.error?.includes('DETERMINISTIC_PERMANENT') === true, 'Test 1: Error must be marked as DETERMINISTIC_PERMANENT');
    assert(backendCalled === false, 'Test 1: Backend must not be invoked for synthetic inputs');
    console.log('[PASS] Regression Test 1: Synthetic CUST-005 blocked and quarantined cleanly');

    // ---------------------------------------------------------
    // Regression Test 2 — Valid UUID customer sync succeeds
    // ---------------------------------------------------------
    console.log('[Test 2] Verifying valid UUID customer sync remains valid...');
    await db.syncLogs.clear();
    const validCustId = crypto.randomUUID();
    const validCustomerLog: SyncLog = {
      entityType: 'customers',
      entityId: validCustId,
      action: 'create',
      status: 'pending',
      createdAt: new Date().toISOString(),
      retryCount: 0,
      payload: {
        id: validCustId,
        fullName: 'Valid Customer Name',
        idNumber: '910203 5012 08 3',
        mobile: '+27 82 000 0000'
      }
    };

    const custBackendState = { called: false };
    await attachMockFetchAndSession(() => {
      custBackendState.called = true;
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });

    const res2 = await SyncService.syncEntity(validCustomerLog, crypto.randomUUID());
    assert(res2.success === true, `Test 2: Valid customer sync should succeed, got error: ${res2.error}`);
    assert(custBackendState.called === true, 'Test 2: Backend must be invoked for valid customer IDs');
    console.log('[PASS] Regression Test 2: Valid UUID customer sync verified');

    // ---------------------------------------------------------
    // Regression Test 3 — Pawn loan with valid customer UUID syncs
    // ---------------------------------------------------------
    console.log('[Test 3] Verifying pawn loan with valid customer UUID syncs successfully...');
    const validPawnLog: SyncLog = {
      entityType: 'pawnIntake',
      entityId: crypto.randomUUID(),
      action: 'create',
      status: 'pending',
      createdAt: new Date().toISOString(),
      retryCount: 0,
      payload: {
        loanId: crypto.randomUUID(),
        ticketNumber: 'TKT-VALID-999',
        customerId: crypto.randomUUID(), // Valid UUID!
        itemId: crypto.randomUUID(),
        principal: 1000
      }
    };

    const pawnBackendState = { called: false };
    await attachMockFetchAndSession(() => {
      pawnBackendState.called = true;
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });

    const res3 = await SyncService.syncEntity(validPawnLog, crypto.randomUUID());
    assert(res3.success === true, `Test 3: Valid pawn loan sync should succeed, got error: ${res3.error}`);
    assert(pawnBackendState.called === true, 'Test 3: Backend must be invoked for valid pawn loans');
    console.log('[PASS] Regression Test 3: Pawn loan with valid customer UUID synced successfully');

    // ---------------------------------------------------------
    // Regression Test 4 — Missing shop context blocks sync
    // ---------------------------------------------------------
    console.log('[Test 4] Verifying missing shop context blocks sync without RLS violation...');
    await db.syncLogs.clear();
    const sellerId = crypto.randomUUID();
    const sellerLog: SyncLog = {
      entityType: 'sellers',
      entityId: sellerId,
      action: 'create',
      status: 'pending',
      createdAt: new Date().toISOString(),
      retryCount: 0,
      payload: {
        id: sellerId,
        fullName: 'Sellers RLS Test',
        idNumber: '861010 5112 08 2',
        mobile: '+27 83 999 8888'
      }
    };

    let sellerBackendCalled = false;
    await attachMockFetchAndSession(() => {
      sellerBackendCalled = true;
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });

    const res4 = await SyncService.syncEntity(sellerLog, undefined); // Missing shopId context!
    assert(res4.success === false, 'Test 4: Sync must fail when shop context is missing');
    assert(res4.error?.includes('DETERMINISTIC_RECOVERABLE') === true, 'Test 4: Error must be marked as DETERMINISTIC_RECOVERABLE');
    assert(sellerBackendCalled === false, 'Test 4: Backend must not be invoked for missing shop contexts');
    console.log('[PASS] Regression Test 4: Missing shop context blocked safely');

    // ---------------------------------------------------------
    // Regression Test 5 — Correct shop context inserts row
    // ---------------------------------------------------------
    console.log('[Test 5] Verifying correct shop context successfully inserts row...');
    await attachMockFetchAndSession(() => {
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });

    const res5 = await SyncService.syncEntity(sellerLog, crypto.randomUUID());
    assert(res5.success === true, `Test 5: Sync must succeed with correct shop context, got error: ${res5.error}`);
    console.log('[PASS] Regression Test 5: Correct shop context inserts row safely');

    // ---------------------------------------------------------
    // Regression Test 6 — SAPS sync preserves correct shopId
    // ---------------------------------------------------------
    console.log('[Test 6] Verifying SAPS sync preserves correct authoritative shop scope...');
    await db.syncLogs.clear();
    const sapsId = crypto.randomUUID();
    const sapsLog: SyncLog = {
      entityType: 'saps',
      entityId: sapsId,
      action: 'create',
      status: 'pending',
      createdAt: new Date().toISOString(),
      retryCount: 0,
      payload: {
        id: sapsId,
        entryNumber: 'SAPS-99120',
        customerName: 'Saps Officer Test',
        itemDescription: '18ct Gold Ring',
        considerationPaid: 2500
      }
    };

    const sapsShopId = crypto.randomUUID();
    const res6 = await SyncService.syncEntity(sapsLog, sapsShopId);
    assert(res6.success === true, `Test 6: SAPS sync must succeed with correct shopId, got error: ${res6.error}`);
    console.log('[PASS] Regression Test 6: SAPS sync preserves authoritative shop scope');

    // ---------------------------------------------------------
    // Regression Test 7 — No infinite automatic retry loop
    // ---------------------------------------------------------
    console.log('[Test 7] Verifying failed deterministic records are excluded from auto-sync...');
    await db.syncLogs.clear();
    // Add a log with permanent deterministic failure
    await db.syncLogs.add({
      id: 7771,
      entityType: 'customers',
      entityId: 'CUST-005', // Synthetic!
      action: 'create',
      status: 'failed',
      error: 'DETERMINISTIC_PERMANENT: Synthetic record',
      createdAt: new Date().toISOString(),
      retryCount: 1,
      payload: {}
    });

    // Add another log with recoverable deterministic failure
    await db.syncLogs.add({
      id: 7772,
      entityType: 'sellers',
      entityId: crypto.randomUUID(),
      action: 'create',
      status: 'failed',
      error: 'DETERMINISTIC_RECOVERABLE: Waiting for shopId context',
      createdAt: new Date().toISOString(),
      retryCount: 1,
      payload: {}
    });

    const autoSyncRes = await SyncService.processAllPendingSync(undefined, undefined, 0); // Missing shop context
    assert(autoSyncRes.processed === 0, `Test 7: No logs should be processed in background auto-sync, got ${autoSyncRes.processed}`);
    assert(autoSyncRes.successful === 0, 'Test 7: Zero successes');
    assert(autoSyncRes.failed === 0, 'Test 7: Zero attempts/failures');
    console.log('[PASS] Regression Test 7: Permanent and recoverable deterministic records skipped in auto-sync');

    // ---------------------------------------------------------
    // Regression Test 8 — Transient failures remain retryable
    // ---------------------------------------------------------
    console.log('[Test 8] Verifying transient network failures are retried and successfully recover...');
    await db.syncLogs.clear();
    const transientLogId = crypto.randomUUID();
    await db.syncLogs.add({
      id: 8881,
      entityType: 'customers',
      entityId: transientLogId,
      action: 'create',
      status: 'failed',
      error: '503 Service Unavailable (Transient)',
      createdAt: new Date().toISOString(),
      retryCount: 1,
      payload: { id: transientLogId, fullName: 'Transient Retry Test', idNumber: '951010 5012 08 3', mobile: '+27 82 111 2222' }
    });

    // Network is now restored and available!
    await attachMockFetchAndSession(() => new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const transientSyncRes = await SyncService.processAllPendingSync(crypto.randomUUID(), undefined, 0);
    
    assert(transientSyncRes.processed === 1, `Test 8: 1 transient failed log should be processed upon reconnect, got ${transientSyncRes.processed}`);
    assert(transientSyncRes.successful === 1, 'Test 8: Succeeded after reconnect');
    
    const updatedTransientLog = await db.syncLogs.get(8881);
    assert(updatedTransientLog?.status === 'completed', 'Test 8: Status updated to completed');
    console.log('[PASS] Regression Test 8: Transient failures recovered cleanly after reconnect');

    // ---------------------------------------------------------
    // Regression Test 9 — Manual retry of failed record
    // ---------------------------------------------------------
    console.log('[Test 9] Verifying a corrected failed record can be manually retried...');
    await db.syncLogs.clear();
    const manualRetryId = crypto.randomUUID();
    await db.syncLogs.add({
      id: 9991,
      entityType: 'sellers',
      entityId: manualRetryId,
      action: 'create',
      status: 'failed',
      error: 'DETERMINISTIC_RECOVERABLE: Waiting for valid shop context',
      createdAt: new Date().toISOString(),
      retryCount: 1,
      payload: { id: manualRetryId, fullName: 'Manual Retry Test', idNumber: '920202 5012 08 4', mobile: '+27 83 444 5555' }
    });

    // Manual retry is invoked with correct shopId context!
    const retryShopId = crypto.randomUUID();
    await attachMockFetchAndSession(() => new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    
    // Mimic manual retry: SyncService.syncEntity is called directly by retryFailedSync
    const manualRes = await SyncService.syncEntity(await db.syncLogs.get(9991) as SyncLog, retryShopId);
    assert(manualRes.success === true, `Test 9: Manual retry should succeed, got error: ${manualRes.error}`);
    console.log('[PASS] Regression Test 9: Manual retry on corrected record successfully executed');

    // ---------------------------------------------------------
    // Regression Test 10 — No duplicate SyncLog operations
    // ---------------------------------------------------------
    console.log('[Test 10] Verifying the queue contains no duplicate SyncLog operations after retry...');
    const allLogsCount = await db.syncLogs.count();
    assert(allLogsCount === 1, `Test 10: Total log count should remain exactly 1, got ${allLogsCount}`);
    console.log('[PASS] Regression Test 10: Duplicate SyncLog operations prevention verified');

    // ---------------------------------------------------------
    // Regression State-Machine Test A — Synthetic entity ID status transition
    // ---------------------------------------------------------
    console.log('[StateMachine Test A] Verifying synthetic entity ID does not remain stuck in syncing...');
    await db.syncLogs.clear();
    await db.syncLogs.add({
      id: 11111,
      entityType: 'customers',
      entityId: 'CUST-005', // Synthetic!
      action: 'create',
      status: 'pending',
      createdAt: new Date().toISOString(),
      retryCount: 0,
      payload: {}
    });

    await SyncService.processAllPendingSync(crypto.randomUUID(), undefined, 0);
    const logA = await db.syncLogs.get(11111);
    assert(logA?.status === 'failed', `Test A: Expected status 'failed', got '${logA?.status}'`);
    assert(logA?.error?.includes('DETERMINISTIC_PERMANENT') === true, 'Test A: Expected DETERMINISTIC_PERMANENT error');
    console.log('[PASS] StateMachine Test A: Synthetic entity ID successfully failed and not stuck in syncing');

    // ---------------------------------------------------------
    // Regression State-Machine Test B — Nested synthetic customer ID
    // ---------------------------------------------------------
    console.log('[StateMachine Test B] Verifying nested synthetic customer ID is failed and not stuck in syncing...');
    await db.syncLogs.clear();
    await db.syncLogs.add({
      id: 22222,
      entityType: 'pawnIntake',
      entityId: crypto.randomUUID(),
      action: 'create',
      status: 'pending',
      createdAt: new Date().toISOString(),
      retryCount: 0,
      payload: {
        loanId: crypto.randomUUID(),
        ticketNumber: 'TKT-TEST-99',
        customerId: 'CUST-005', // Synthetic nested customer ID!
        principal: 500
      }
    });

    await SyncService.processAllPendingSync(crypto.randomUUID(), undefined, 0);
    const logB = await db.syncLogs.get(22222);
    assert(logB?.status === 'failed', `Test B: Expected status 'failed', got '${logB?.status}'`);
    assert(logB?.error?.includes('DETERMINISTIC_PERMANENT') === true, 'Test B: Expected DETERMINISTIC_PERMANENT error');
    console.log('[PASS] StateMachine Test B: Nested synthetic ID correctly failed and not stuck in syncing');

    // ---------------------------------------------------------
    // Regression State-Machine Test C — Missing shop context
    // ---------------------------------------------------------
    console.log('[StateMachine Test C] Verifying missing shop context is failed and not stuck in syncing...');
    await db.syncLogs.clear();
    const sellerUuid = crypto.randomUUID();
    await db.syncLogs.add({
      id: 33333,
      entityType: 'sellers',
      entityId: sellerUuid,
      action: 'create',
      status: 'pending',
      createdAt: new Date().toISOString(),
      retryCount: 0,
      payload: { id: sellerUuid, fullName: 'Seller Test No Shop', idNumber: '950202 5012 08 5', mobile: '+27 72 999 0000' }
    });

    await SyncService.processAllPendingSync(undefined, undefined, 0);
    const logC = await db.syncLogs.get(33333);
    assert(logC?.status === 'failed', `Test C: Expected status 'failed', got '${logC?.status}'`);
    assert(logC?.error?.includes('DETERMINISTIC_RECOVERABLE') === true, 'Test C: Expected DETERMINISTIC_RECOVERABLE error');
    console.log('[PASS] StateMachine Test C: Missing shop context successfully failed and not stuck in syncing');

    // ---------------------------------------------------------
    // Regression State-Machine Test D — Transient failure retryability
    // ---------------------------------------------------------
    console.log('[StateMachine Test D] Verifying transient failure remains retryable and can later complete...');
    await db.syncLogs.clear();
    const transCustId = crypto.randomUUID();
    await db.syncLogs.add({
      id: 44444,
      entityType: 'customers',
      entityId: transCustId,
      action: 'create',
      status: 'failed',
      error: '503 Service Unavailable (Transient Error)',
      createdAt: new Date().toISOString(),
      retryCount: 1,
      payload: { id: transCustId, fullName: 'Transient Retry SM Test', idNumber: '890203 5012 08 3', mobile: '+27 82 222 3333' }
    });

    await attachMockFetchAndSession(() => new Response(JSON.stringify({ error: 'Still failing' }), { status: 500 }));
    await SyncService.processAllPendingSync(crypto.randomUUID(), undefined, 0);
    const logD1 = await db.syncLogs.get(44444);
    assert(logD1?.status === 'failed', `Test D: Expected status 'failed' after second fail, got '${logD1?.status}'`);
    assert(logD1?.retryCount === 2, `Test D: Expected retryCount 2, got ${logD1?.retryCount}`);

    await attachMockFetchAndSession(() => new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    await SyncService.processAllPendingSync(crypto.randomUUID(), undefined, 0);
    const logD2 = await db.syncLogs.get(44444);
    assert(logD2?.status === 'completed', `Test D: Expected status 'completed', got '${logD2?.status}'`);
    console.log('[PASS] StateMachine Test D: Transient failure successfully retried and completed');

    // ---------------------------------------------------------
    // Regression State-Machine Test E — Standard success completion
    // ---------------------------------------------------------
    console.log('[StateMachine Test E] Verifying successful sync becomes completed...');
    await db.syncLogs.clear();
    const successCustId = crypto.randomUUID();
    await db.syncLogs.add({
      id: 55555,
      entityType: 'customers',
      entityId: successCustId,
      action: 'create',
      status: 'pending',
      createdAt: new Date().toISOString(),
      retryCount: 0,
      payload: { id: successCustId, fullName: 'Success Test', idNumber: '910303 5012 08 2', mobile: '+27 83 222 4444' }
    });

    await attachMockFetchAndSession(() => new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    await SyncService.processAllPendingSync(crypto.randomUUID(), undefined, 0);
    const logE = await db.syncLogs.get(55555);
    assert(logE?.status === 'completed', `Test E: Expected status 'completed', got '${logE?.status}'`);
    console.log('[PASS] StateMachine Test E: Standard success correctly transitioned to completed');

  } finally {
    globalThis.fetch = originalFetch;
  }

  console.log('=== ALL OFFLINE QUEUE & RECONNECT SYNCHRONIZATION TESTS PASSED ===');
}
