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

  } finally {
    globalThis.fetch = originalFetch;
  }

  console.log('=== ALL OFFLINE QUEUE & RECONNECT SYNCHRONIZATION TESTS PASSED ===');
}
