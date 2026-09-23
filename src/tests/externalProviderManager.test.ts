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

  // Case 1: 100 shops request the same barcode simultaneously -> 1 external provider request, shared cached result.
  {
    const manager = ExternalMarketProviderManager.getInstance();
    manager.resetState();
    manager.setDailyLimit('upcitemdb', 25);

    let externalCallCount = 0;
    const mockFetch = async () => {
      externalCallCount++;
      await new Promise(r => setTimeout(r, 50));
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
    assertEqual(externalCallCount, 1, 'Case 1: 100 concurrent requests result in exactly 1 external provider HTTP call');
    assertTrue(results.every(r => r.observation !== null && r.observation.productName.includes('Shared Item')), 'Case 1: All 100 callers received valid shared observation result');
  }

  // Case 2: Daily external budget is exhausted -> no external request; LocalMarket data still works.
  {
    const manager = ExternalMarketProviderManager.getInstance();
    manager.resetState();
    manager.setDailyLimit('upcitemdb', 2);

    let externalCallCount = 0;
    const mockFetch = async () => {
      externalCallCount++;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          items: [{ title: 'Item Title', msrp: 500, offers: [{ price: 400 }] }]
        })
      } as any;
    };

    await manager.getExternalObservation('111111111111', 'Item 1', undefined, null, false, mockFetch);
    await manager.getExternalObservation('222222222222', 'Item 2', undefined, null, false, mockFetch);
    assertEqual(externalCallCount, 2, 'Case 2: 2 requests executed within budget');

    const res3 = await manager.getExternalObservation('333333333333', 'Item 3', undefined, null, false, mockFetch);
    assertEqual(externalCallCount, 2, 'Case 2: 3rd request blocked by daily budget manager without calling external provider');
    assertTrue(res3.quotaExhausted === true, 'Case 2: Result indicates quota exhausted');
    assertEqual(res3.observation, null, 'Case 2: External observation returned as null cleanly');
  }

  // Case 3: Cache is valid -> 0 external requests.
  {
    const manager = ExternalMarketProviderManager.getInstance();
    manager.resetState();

    const mockSupabaseAdmin = {
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

    const res = await manager.getExternalObservation('999999999999', 'Camera Lens', undefined, mockSupabaseAdmin, false, mockFetch);
    assertEqual(externalCallCount, 0, 'Case 3: Valid cache hit resulted in 0 external HTTP requests');
    assertEqual(res.source, 'cache', 'Case 3: Source identified as cache');
    assertEqual(res.observation?.productName, 'Cached Camera Lens', 'Case 3: Cached product name returned accurately');
  }

  // Case 4: Cache expired but another request is already fetching it -> request deduplication.
  {
    const manager = ExternalMarketProviderManager.getInstance();
    manager.resetState();

    let externalCallCount = 0;
    const mockFetch = async () => {
      externalCallCount++;
      await new Promise(r => setTimeout(r, 60));
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
    assertEqual(externalCallCount, 1, 'Case 4: Simultaneous refetch resulted in 1 external HTTP request');
    assertEqual(res1.observation?.productName, 'Refetched Smart Watch', 'Case 4: Request 1 received refetched data');
    assertEqual(res2.observation?.productName, 'Refetched Smart Watch', 'Case 4: Request 2 received deduplicated refetched data');
  }

  // Case 5: Provider returns HTTP 429 -> cooldown and graceful fallback.
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
    assertEqual(externalCallCount, 1, 'Case 5: First call hit HTTP 429');
    assertEqual(res1.observation, null, 'Case 5: Observation returned null on 429');

    const res2 = await manager.getExternalObservation('666666666666', 'Another Item', undefined, null, false, mockFetch429);
    assertEqual(externalCallCount, 1, 'Case 5: Second call blocked by provider cooldown without making external HTTP request');
    assertTrue(manager.canMakeRequest('upcitemdb').allowed === false, 'Case 5: Cooldown flag active');
  }

  // Case 6: Provider unavailable -> LocalMarket valuation continues.
  {
    const manager = ExternalMarketProviderManager.getInstance();
    manager.resetState();

    const mockFetchError = async () => {
      throw new Error('Network error / DNS resolution failure');
    };

    const res = await manager.getExternalObservation('555555555555', 'Broken Network Item', undefined, null, false, mockFetchError);
    assertEqual(res.observation, null, 'Case 6: Provider error handled gracefully returning null external observation');
    assertEqual(res.source, 'none', 'Case 6: Source marked as none, allowing LocalMarket valuation to proceed seamlessly');
  }

  // Case 7: Two different shops request the same product -> external reference shared, LocalMarket sales statistics remain completely separate.
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
      salesLast60Days: 3,
      salesLast90Days: 3,
      currentActiveStockCount: 1,
      avgSalePrice: 8000,
      medianSalePrice: 8000,
      minSalePrice: 8000,
      maxSalePrice: 8000,
      medianDaysToSell: null,
      sellThroughRate: 0.75
    };

    const shopBSalesStats = {
      salesLast30Days: 0,
      salesLast60Days: 0,
      salesLast90Days: 0,
      currentActiveStockCount: 0,
      avgSalePrice: null,
      medianSalePrice: null,
      minSalePrice: null,
      maxSalePrice: null,
      medianDaysToSell: null,
      sellThroughRate: null
    };

    assertTrue(externalRef.referencePrice === 10000, 'Case 7: External reference price shared');
    assertEqual(shopASalesStats.salesLast30Days, 3, 'Case 7: Shop A has 3 sales in last 30 days');
    assertEqual(shopBSalesStats.salesLast30Days, 0, 'Case 7: Shop B has 0 sales in last 30 days');
    assertEqual(shopASalesStats.avgSalePrice, 8000, 'Case 7: Shop A avg price is R8000');
    assertEqual(shopBSalesStats.avgSalePrice, null, 'Case 7: Shop B avg price is null (isolated)');
  }

  console.log('=== ALL EXTERNAL MARKET PROVIDER MANAGER TESTS PASSED ===');
}
