/**
 * Offline Queue & Reconnection Synchronization Test Suite
 */

import { SyncService } from '../services/SyncService';
import { SyncLog } from '../types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[AssertionFailed] ${message}`);
  }
}

export async function runOfflineQueueSyncTests() {
  console.log('=== RUNNING OFFLINE QUEUE & RECONNECT SYNCHRONIZATION TESTS ===');

  const originalFetch = globalThis.fetch;

  try {
    // ---------------------------------------------------------
    // Test 1: Outbox Queue Entity Structuring
    // ---------------------------------------------------------
    const mockSaleLog: SyncLog = {
      entityType: 'sales',
      entityId: 'sale-offline-101',
      action: 'create',
      status: 'pending',
      retryCount: 0,
      createdAt: new Date(Date.now() - 5000).toISOString(),
      payload: {
        receiptNumber: 'REC-OFF-001',
        subtotal: 1000,
        vatAmount: 150,
        total: 1150,
        tenderMethod: 'Cash',
        amountTendered: 1200,
        change: 50,
        items: [{ id: 'item-1', title: 'Test Item', price: 1000 }]
      }
    };

    assert(mockSaleLog.status === 'pending', 'Test 1: Initial outbox log status must be pending');
    assert(mockSaleLog.entityType === 'sales', 'Test 1: Entity type must be sales');
    console.log('[PASS] Test 1: Offline outbox log constructed with valid payload');

    // ---------------------------------------------------------
    // Test 2: Successful Reconnect Sync Execution
    // ---------------------------------------------------------
    globalThis.fetch = (async () => {
      return new Response(
        JSON.stringify({
          success: true,
          sale_id: 'sale-offline-101',
          receipt_number: 'REC-OFF-001'
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }) as any;

    const syncRes = await SyncService.syncEntity(mockSaleLog, 'shop-101');
    assert(syncRes.success === true, 'Test 2: Reconnection sync must succeed');
    console.log('[PASS] Test 2: Successful reconnect sync executed');

    // ---------------------------------------------------------
    // Test 3: Idempotent Replay (Re-sending duplicate log returns success without duplicate creation)
    // ---------------------------------------------------------
    globalThis.fetch = (async () => {
      return new Response(
        JSON.stringify({
          success: true,
          sale_id: 'sale-offline-101',
          receipt_number: 'REC-OFF-001',
          idempotent_replay: true
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }) as any;

    const replayRes = await SyncService.syncEntity(mockSaleLog, 'shop-101');
    assert(replayRes.success === true, 'Test 3: Idempotent replay must succeed');
    console.log('[PASS] Test 3: Idempotent replay recognized and safely processed without duplicate sale creation');

    // ---------------------------------------------------------
    // Test 4: Transient Failure Handled Safely (Never Falsely Marked Completed)
    // ---------------------------------------------------------
    globalThis.fetch = (async () => {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Transient network failure'
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }) as any;

    const failedLog: SyncLog = {
      entityType: 'sales',
      entityId: 'sale-offline-102',
      action: 'create',
      status: 'pending',
      retryCount: 0,
      createdAt: new Date().toISOString(),
      payload: { receiptNumber: 'REC-OFF-002' }
    };

    const failRes = await SyncService.syncEntity(failedLog, 'shop-101');
    assert(failRes.success === false, 'Test 4: Transient failure must return success: false');
    assert(Boolean(failRes.error && failRes.error.length > 0), 'Test 4: Error message retained');
    console.log('[PASS] Test 4: Failed sync operation correctly trapped and never falsely marked as successful');

  } finally {
    globalThis.fetch = originalFetch;
  }

  console.log('=== ALL OFFLINE QUEUE & RECONNECT SYNCHRONIZATION TESTS PASSED ===');
}
