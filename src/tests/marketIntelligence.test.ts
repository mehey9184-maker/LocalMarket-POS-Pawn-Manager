import { MarketPricingEngine } from '../services/MarketPricingEngine';
import { LocalMarketSalesStats, MarketObservation } from '../types/marketIntelligence';

// Simple lightweight assertion runner for LocalMarket test suite
function assertEqual(actual: any, expected: any, testName: string) {
  if (actual === expected) {
    console.log(`[PASS] ${testName}`);
  } else {
    console.error(`[FAIL] ${testName}: expected ${expected}, got ${actual}`);
    throw new Error(`Test failed: ${testName}`);
  }
}

function assertTrue(condition: boolean, testName: string) {
  if (condition) {
    console.log(`[PASS] ${testName}`);
  } else {
    console.error(`[FAIL] ${testName}`);
    throw new Error(`Test failed: ${testName}`);
  }
}

export function runMarketIntelligenceTests() {
  console.log('=== RUNNING LOCALMARKET MARKET INTELLIGENCE TEST SUITE ===');

  // Case 1: Known product + external reference + LocalMarket history
  {
    const observation: MarketObservation = {
      sourceType: 'upcitemdb',
      sourceName: 'UPCitemdb',
      productName: 'iPhone 13 128GB',
      referencePrice: 15000,
      usedLow: 11000,
      usedHigh: 13500,
      medianPrice: 12500,
      observedAt: new Date().toISOString()
    };
    const localStats: LocalMarketSalesStats = {
      salesLast30Days: 3,
      salesLast60Days: 5,
      salesLast90Days: 8,
      currentActiveStockCount: 2,
      avgSalePrice: 12000,
      medianSalePrice: 12000,
      minSalePrice: 11500,
      maxSalePrice: 12800,
      medianDaysToSell: 5,
      sellThroughRate: 0.8
    };

    const { pricing, confidence } = MarketPricingEngine.calculateEstimate({
      observation,
      localStats,
      condition: 'Good'
    });

    assertEqual(confidence, 'High', 'Case 1: High confidence when local history >= 6');
    assertTrue(pricing.suggestedRetailTarget !== null && pricing.suggestedRetailTarget > 0, 'Case 1: Valid retail price generated');
    assertTrue(pricing.suggestedBuyLow !== null && pricing.suggestedBuyHigh !== null, 'Case 1: Valid buy range generated');
  }

  // Case 2: Known product + no local history
  {
    const observation: MarketObservation = {
      sourceType: 'upcitemdb',
      sourceName: 'UPCitemdb',
      productName: 'Specialized Road Bike',
      referencePrice: 25000,
      usedLow: 16000,
      usedHigh: 19000,
      medianPrice: 17500,
      observedAt: new Date().toISOString()
    };
    const localStats: LocalMarketSalesStats = {
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

    const { pricing, confidence } = MarketPricingEngine.calculateEstimate({
      observation,
      localStats,
      condition: 'Good'
    });

    assertEqual(confidence, 'Low', 'Case 2: Low confidence without local sales history');
    assertTrue(pricing.suggestedRetailTarget !== null, 'Case 2: External reference used');
  }

  // Case 3: Unknown barcode / no data
  {
    const localStats: LocalMarketSalesStats = {
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

    const { pricing, confidence } = MarketPricingEngine.calculateEstimate({
      observation: null,
      localStats,
      condition: 'Good'
    });

    assertEqual(confidence, 'Insufficient data', 'Case 3: Insufficient data badge returned');
    assertEqual(pricing.suggestedRetailTarget, null, 'Case 3: No fabricated retail price');
    assertEqual(pricing.suggestedBuyLow, null, 'Case 3: No fabricated buy range');
  }

  // Case 4: Demand calculation thresholds
  {
    const demandLow = MarketPricingEngine.calculateDemand({
      salesLast30Days: 1,
      salesLast60Days: 2,
      salesLast90Days: 2,
      currentActiveStockCount: 1,
      avgSalePrice: 1000,
      medianSalePrice: 1000,
      minSalePrice: 1000,
      maxSalePrice: 1000,
      medianDaysToSell: 20,
      sellThroughRate: 0.5
    });
    assertEqual(demandLow.label, 'Insufficient data', 'Case 4a: <= 2 sales is Insufficient data');

    const demandHigh = MarketPricingEngine.calculateDemand({
      salesLast30Days: 5,
      salesLast60Days: 8,
      salesLast90Days: 12,
      currentActiveStockCount: 1,
      avgSalePrice: 1000,
      medianSalePrice: 1000,
      minSalePrice: 1000,
      maxSalePrice: 1000,
      medianDaysToSell: 4,
      sellThroughRate: 0.9
    });
    assertEqual(demandHigh.label, 'High', 'Case 4b: High demand for fast selling items');
  }

  console.log('=== ALL MARKET INTELLIGENCE TESTS PASSED SUCCESSFULLY ===');
}
