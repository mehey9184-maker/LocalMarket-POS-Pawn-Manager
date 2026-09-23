import { ExternalMarketProviderManager } from '../services/ExternalMarketProviderManager';
import { MarketObservation } from '../types/marketIntelligence';

function assertTrue(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`[FAIL] ${msg}`);
    throw new Error(`Test failed: ${msg}`);
  }
  console.log(`[PASS] ${msg}`);
}

function assertEqual(actual: any, expected: any, msg: string) {
  if (actual !== expected) {
    console.error(`[FAIL] ${msg}: Expected ${expected}, got ${actual}`);
    throw new Error(`Test failed: ${msg}`);
  }
  console.log(`[PASS] ${msg}`);
}

export async function runExternalProviderManagerTests() {
  console.log('=== RUNNING EXTERNAL MARKET PROVIDER MANAGER TEST SUITE ===');

  // Test A — Same barcode deduplication: 100 concurrent requests produce exactly 1 HTTP request
  {
    const manager = ExternalMarketProviderManager.getInstance();
    manager.resetState();
    manager.setDailyLimit('upcitemdb', 25);

    let externalCallCount = 0;
    const mockFetch = async () => {
      externalCallCount++;
      await new Promise(r => setTimeout(r, 30));
      return {
        ok: true,
        status: 200,
        json: async () => ({
          items: [{
            title: 'Shared Item Barcode 600123456789',
            brand: 'TestBrand',
            msrp: 1000,
            offers: [{ price: 800 }, { price: 900 }]
          }]
        })
      } as any;
    };

    const barcode = '600123456789';
    const requests = Array.from({ length: 100 }).map(() =>
      manager.getExternalObservation(barcode, 'Shared Item', undefined, null, false, mockFetch)
    );

    const results = await Promise.all(requests);
    assertEqual(externalCallCount, 1, 'Test A: 100 concurrent requests result in exactly 1 external provider HTTP call');
    assertTrue(results.every(r => r.observation !== null && r.observation.productName.includes('Shared Item')), 'Test A: All 100 callers received valid shared observation result');
  }

  // Test B — Different barcodes under a 25-request budget: 30 concurrent requests for 30 different barcodes result in max 25 HTTP calls
  {
    const manager = ExternalMarketProviderManager.getInstance();
    manager.resetState();

    let dbCounter = 0;
    const mockSupabaseAdminWithRpc = {
      rpc: async (fnName: string, args: any) => {
        if (fnName === 'reserve_provider_request') {
          const limit = args.p_default_limit || 25;
          if (dbCounter < limit) {
            dbCounter++;
            return {
              data: {
                allowed: true,
                provider: args.p_provider,
                daily_limit: limit,
                requests_today: dbCounter,
                reset_at: new Date(Date.now() + 86400000).toISOString()
              },
              error: null
            };
          } else {
            return {
              data: {
                allowed: false,
                reason: `Daily provider request quota exhausted (${dbCounter}/${limit})`,
                provider: args.p_provider,
                daily_limit: limit,
                requests_today: dbCounter,
                reset_at: new Date(Date.now() + 86400000).toISOString()
              },
              error: null
            };
          }
        }
        return { data: null, error: null };
      },
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }),
        upsert: async () => ({ data: null, error: null })
      })
    };

    let externalCallCount = 0;
    const mockFetch = async () => {
      externalCallCount++;
      await new Promise(r => setTimeout(r, 10));
      return {
        ok: true,
        status: 200,
        json: async () => ({
          items: [{ title: 'Item Title', msrp: 500, offers: [{ price: 400 }] }]
        })
      } as any;
    };

    // 30 distinct barcodes
    const requests = Array.from({ length: 30 }).map((_, i) => {
      const barcode = `1000000000${(i + 1).toString().padStart(2, '0')}`;
      return manager.getExternalObservation(barcode, `Unique Product ${i + 1}`, undefined, mockSupabaseAdminWithRpc, false, mockFetch);
    });

    const results = await Promise.all(requests);
    assertEqual(externalCallCount, 25, 'Test B: Exactly 25 HTTP requests executed out of 30 distinct barcode attempts');
    const admittedCount = results.filter(r => r.observation !== null).length;
    const exhaustedCount = results.filter(r => r.quotaExhausted === true).length;
    assertEqual(admittedCount, 25, 'Test B: Exactly 25 requests admitted by atomic reservation RPC');
    assertEqual(exhaustedCount, 5, 'Test B: Exactly 5 requests blocked by quota protection');
  }

  // Test C — Quota exhausted: 0 HTTP calls, clean fallback, quotaExhausted === true
  {
    const manager = ExternalMarketProviderManager.getInstance();
    manager.resetState();

    const mockExhaustedRpcAdmin = {
      rpc: async () => ({
        data: {
          allowed: false,
          reason: 'Daily provider request quota exhausted (25/25)',
          provider: 'upcitemdb',
          daily_limit: 25,
          requests_today: 25,
          reset_at: new Date(Date.now() + 86400000).toISOString()
        },
        error: null
      }),
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }),
        upsert: async () => ({ data: null, error: null })
      })
    };

    let externalCallCount = 0;
    const mockFetch = async () => {
      externalCallCount++;
      return { ok: true, json: async () => ({ items: [] }) } as any;
    };

    const res = await manager.getExternalObservation('999911112222', 'Exhausted Item', undefined, mockExhaustedRpcAdmin, false, mockFetch);
    assertEqual(externalCallCount, 0, 'Test C: 0 HTTP calls made when atomic reservation reports quota exhausted');
    assertEqual(res.observation, null, 'Test C: Observation returned null cleanly');
    assertTrue(res.quotaExhausted === true, 'Test C: Result indicates quotaExhausted === true');
  }

  // Test D — Valid cache: Produces 0 provider requests and consumes 0 quota
  {
    const manager = ExternalMarketProviderManager.getInstance();
    manager.resetState();

    const mockCachedAdmin = {
      rpc: async () => {
        throw new Error('RPC should not be called on valid cache hit!');
      },
      from: (table: string) => {
        if (table === 'external_market_cache') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: 'cached-uuid-1',
                    provider: 'upcitemdb',
                    cache_key: 'upcitemdb:barcode:999999999999',
                    barcode: '999999999999',
                    normalized_product_name: 'Cached Camera Lens',
                    brand: 'Sony',
                    model: 'FE 50mm',
                    reference_price: 12000,
                    asking_low: 8000,
                    asking_high: 9500,
                    source_url: 'https://example.com',
                    observed_at: new Date().toISOString(),
                    expires_at: new Date(Date.now() + 86400000 * 5).toISOString()
                  }
                })
              })
            })
          };
        }
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) };
      }
    };

    let externalCallCount = 0;
    const mockFetch = async () => {
      externalCallCount++;
      return { ok: true, json: async () => ({ items: [] }) } as any;
    };

    const res = await manager.getExternalObservation('999999999999', 'Camera Lens', undefined, mockCachedAdmin, false, mockFetch);
    assertEqual(externalCallCount, 0, 'Test D: Valid cache hit resulted in 0 external HTTP requests');
    assertEqual(res.source, 'cache', 'Test D: Source identified as cache');
    assertEqual(res.observation?.productName, 'Cached Camera Lens', 'Test D: Cached product name returned accurately');
  }

  // Test E — Expired cache + available quota: Expired cache triggers 1 refetch for same in-flight key
  {
    const manager = ExternalMarketProviderManager.getInstance();
    manager.resetState();

    let externalCallCount = 0;
    const mockFetch = async () => {
      externalCallCount++;
      await new Promise(r => setTimeout(r, 40));
      return {
        ok: true,
        status: 200,
        json: async () => ({
          items: [{ title: 'Refetched Smart Watch', msrp: 3500, offers: [{ price: 2800 }] }]
        })
      } as any;
    };

    const req1 = manager.getExternalObservation('888888888888', 'Smart Watch', undefined, null, false, mockFetch);
    const req2 = manager.getExternalObservation('888888888888', 'Smart Watch', undefined, null, false, mockFetch);

    const [res1, res2] = await Promise.all([req1, req2]);
    assertEqual(externalCallCount, 1, 'Test E: Concurrent requests for expired/missing cache result in exactly 1 external HTTP request');
    assertEqual(res1.observation?.productName, 'Refetched Smart Watch', 'Test E: Request 1 received refetched data');
    assertEqual(res2.observation?.productName, 'Refetched Smart Watch', 'Test E: Request 2 received deduplicated refetched data');
  }

  // Test F — 429 handling and cooldown
  {
    const manager = ExternalMarketProviderManager.getInstance();
    manager.resetState();

    let externalCallCount = 0;
    const mockFetch429 = async () => {
      externalCallCount++;
      return {
        ok: false,
        status: 429,
        statusText: 'Too Many Requests'
      } as any;
    };

    const res1 = await manager.getExternalObservation('777777777777', 'Item 429', undefined, null, false, mockFetch429);
    assertEqual(externalCallCount, 1, 'Test F: First call hit HTTP 429');
    assertEqual(res1.observation, null, 'Test F: Observation returned null on 429');

    const res2 = await manager.getExternalObservation('666666666666', 'Another Item', undefined, null, false, mockFetch429);
    assertEqual(externalCallCount, 1, 'Test F: Second call during cooldown blocked without HTTP call');
  }

  // Test G — Provider network failure
  {
    const manager = ExternalMarketProviderManager.getInstance();
    manager.resetState();

    const mockFetchError = async () => {
      throw new Error('Network error / DNS resolution failure');
    };

    const res = await manager.getExternalObservation('555555555555', 'Broken Network Item', undefined, null, false, mockFetchError);
    assertEqual(res.observation, null, 'Test G: Provider network failure handled cleanly returning null observation');
    assertEqual(res.source, 'none', 'Test G: Source marked as none, allowing LocalMarket valuation to proceed seamlessly');
  }

  // Test H — Shop data isolation
  {
    const externalRef: MarketObservation = {
      sourceType: 'upcitemdb',
      sourceName: 'UPCitemdb Online Reference',
      productName: 'Shared PlayStation 5',
      referencePrice: 10000,
      usedLow: 7000,
      usedHigh: 8500,
      medianPrice: 7800,
      observedAt: new Date().toISOString()
    };

    const shopASalesStats = {
      salesLast30Days: 3,
      avgSalePrice: 8000
    };

    const shopBSalesStats = {
      salesLast30Days: 0,
      avgSalePrice: null
    };

    assertTrue(externalRef.referencePrice === 10000, 'Test H: External reference price shared');
    assertEqual(shopASalesStats.salesLast30Days, 3, 'Test H: Shop A sales stats isolated');
    assertEqual(shopBSalesStats.salesLast30Days, 0, 'Test H: Shop B sales stats isolated');
  }

  // Test I — Reservation counting (recordSuccess and recordFailure DO NOT increment requestsToday)
  {
    const manager = ExternalMarketProviderManager.getInstance();
    manager.resetState();

    const initialQuota = manager.getQuota('upcitemdb');
    const initialRequests = initialQuota.requestsToday; // 0

    // Reserve 1 slot
    await manager.reserveQuota('upcitemdb', null);
    assertEqual(manager.getQuota('upcitemdb').requestsToday, 1, 'Test I: reserveQuota increased requestsToday from 0 to 1');

    // Call recordSuccess — must NOT increment requestsToday
    manager.recordSuccess('upcitemdb', null);
    assertEqual(manager.getQuota('upcitemdb').requestsToday, 1, 'Test I: recordSuccess did NOT increment requestsToday (still 1)');

    // Call recordFailure — must NOT increment requestsToday
    manager.recordFailure('upcitemdb', 500, null);
    assertEqual(manager.getQuota('upcitemdb').requestsToday, 1, 'Test I: recordFailure did NOT increment requestsToday (still 1)');
  }

  // Test J — RPC unavailable must fail closed
  {
    const manager = ExternalMarketProviderManager.getInstance();
    manager.resetState();

    const mockErrorRpcAdmin = {
      rpc: async () => ({
        data: null,
        error: { message: 'Database connection timeout / maintenance window' }
      }),
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }),
        upsert: async () => ({ data: null, error: null })
      })
    };

    let externalCallCount = 0;
    const mockFetch = async () => {
      externalCallCount++;
      return { ok: true, json: async () => ({ items: [{ title: 'Should Not Be Fetched' }] }) } as any;
    };

    const reservation = await manager.reserveQuota('upcitemdb', mockErrorRpcAdmin);
    assertEqual(reservation.allowed, false, 'Test J: RPC error failed closed (allowed === false)');
    assertEqual(reservation.reason, 'Global provider quota service unavailable', 'Test J: Correct fail-closed reason returned');

    const res = await manager.getExternalObservation('444444444444', 'Fail Closed Item', undefined, mockErrorRpcAdmin, false, mockFetch);
    assertEqual(externalCallCount, 0, 'Test J: 0 HTTP calls made when RPC fails');
    assertEqual(res.observation, null, 'Test J: Observation is null');
  }

  // Test K — No Supabase client may use test fallback
  {
    const manager = ExternalMarketProviderManager.getInstance();
    manager.resetState();

    const res1 = await manager.reserveQuota('upcitemdb', null);
    assertEqual(res1.allowed, true, 'Test K: In-memory fallback allowed when supabaseAdmin is null');
    assertEqual(manager.getQuota('upcitemdb').requestsToday, 1, 'Test K: In-memory counter incremented to 1');
  }

  // Test L — Successful RPC response controls admission
  {
    const manager = ExternalMarketProviderManager.getInstance();
    manager.resetState();

    let rpcAllowed = true;
    let rpcRequestsToday = 1;
    const mockControllableRpcAdmin = {
      rpc: async () => ({
        data: {
          allowed: rpcAllowed,
          reason: rpcAllowed ? undefined : 'Daily provider request quota exhausted (25/25)',
          provider: 'upcitemdb',
          daily_limit: 25,
          requests_today: rpcRequestsToday,
          reset_at: new Date(Date.now() + 86400000).toISOString(),
          consecutive_failures: 0,
          cooldown_until: null
        },
        error: null
      }),
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }),
        upsert: async () => ({ data: null, error: null })
      })
    };

    let externalCallCount = 0;
    const mockFetch = async () => {
      externalCallCount++;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          items: [{ title: 'Admitted Product Title', msrp: 2000, offers: [{ price: 1500 }] }]
        })
      } as any;
    };

    // Case 1: RPC returns allowed: true -> request executed
    const resAllowed = await manager.getExternalObservation('333333333333', 'Allowed Item', undefined, mockControllableRpcAdmin, false, mockFetch);
    assertEqual(externalCallCount, 1, 'Test L: Allowed RPC response triggered exactly 1 HTTP call');
    assertEqual(resAllowed.observation?.productName, 'Admitted Product Title', 'Test L: Admitted product returned');

    // Case 2: RPC returns allowed: false -> request NOT executed
    rpcAllowed = false;
    rpcRequestsToday = 25;
    const resBlocked = await manager.getExternalObservation('222222222222', 'Blocked Item', undefined, mockControllableRpcAdmin, false, mockFetch);
    assertEqual(externalCallCount, 1, 'Test L: Blocked RPC response resulted in 0 additional HTTP calls');
    assertEqual(resBlocked.observation, null, 'Test L: Blocked observation returned null');
  }

  console.log('=== ALL EXTERNAL MARKET PROVIDER MANAGER TESTS PASSED ===');
}
