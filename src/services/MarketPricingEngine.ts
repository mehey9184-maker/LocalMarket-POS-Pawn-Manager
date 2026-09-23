import { ConfidenceLevel, DemandSignal, LocalMarketSalesStats, MarketObservation, PricingEstimate } from '../types/marketIntelligence';

export interface BusinessRulesPricingConfig {
  targetMarginPercent: number; // default e.g. 35%
  minMarginPercent: number; // default e.g. 25%
  riskAllowancePercent: number; // default e.g. 5%
  refurbishmentReservePercent: Record<string, number>;
}

export const DEFAULT_PRICING_CONFIG: BusinessRulesPricingConfig = {
  targetMarginPercent: 35,
  minMarginPercent: 25,
  riskAllowancePercent: 5,
  refurbishmentReservePercent: {
    Mint: 0,
    Excellent: 5,
    Good: 10,
    Fair: 20,
    Damaged: 35
  }
};

export class MarketPricingEngine {
  /**
   * Calculates suggested retail price range and acquisition (buy) price range
   * based on observed reference prices, local sales history, item condition, and shop rules.
   */
  public static calculateEstimate(params: {
    observation: MarketObservation | null;
    localStats: LocalMarketSalesStats;
    condition?: string;
    config?: Partial<BusinessRulesPricingConfig>;
  }): { pricing: PricingEstimate; confidence: ConfidenceLevel; explanation: string } {
    const { observation, localStats, condition = 'Good', config: userConfig } = params;
    const cfg: BusinessRulesPricingConfig = {
      ...DEFAULT_PRICING_CONFIG,
      ...userConfig,
      refurbishmentReservePercent: {
        ...DEFAULT_PRICING_CONFIG.refurbishmentReservePercent,
        ...(userConfig?.refurbishmentReservePercent || {})
      }
    };

    const normCondition = (condition.charAt(0).toUpperCase() + condition.slice(1).toLowerCase()) as string;
    const refurbReservePct = cfg.refurbishmentReservePercent[normCondition] ?? 10;
    const riskPct = cfg.riskAllowancePercent;
    const targetMarginPct = cfg.targetMarginPercent;

    // Determine baseline estimated retail target
    let baselineRetailTarget: number | null = null;
    let retailLow: number | null = null;
    let retailHigh: number | null = null;
    let confidence: ConfidenceLevel = 'Insufficient data';
    const explanationParts: string[] = [];

    const localSalesCount = localStats.salesLast90Days;
    const localMedian = localStats.medianSalePrice;
    const externalMedian = observation?.medianPrice ?? null;
    const externalRef = observation?.referencePrice ?? null;

    // 1. Prioritize Local Market Sales if enough history exists
    if (localSalesCount >= 3 && localMedian && localMedian > 0) {
      baselineRetailTarget = localMedian;
      retailLow = localStats.minSalePrice ? Math.min(localStats.minSalePrice, localMedian * 0.9) : localMedian * 0.9;
      retailHigh = localStats.maxSalePrice ? Math.max(localStats.maxSalePrice, localMedian * 1.1) : localMedian * 1.1;

      if (localSalesCount >= 6) {
        confidence = 'High';
        explanationParts.push(`Solid local demand based on ${localSalesCount} LocalMarket sales in 90 days`);
      } else {
        confidence = 'Medium';
        explanationParts.push(`Based on ${localSalesCount} local sales history`);
      }
    } else if (observation && (externalMedian || externalRef)) {
      // 2. Fall back to external observations
      const extBaseline = externalMedian || (externalRef ? externalRef * 0.75 : null);
      if (extBaseline && extBaseline > 0) {
        baselineRetailTarget = extBaseline;
        retailLow = observation.usedLow || extBaseline * 0.85;
        retailHigh = observation.usedHigh || extBaseline * 1.15;

        if (localSalesCount > 0) {
          confidence = 'Medium';
          explanationParts.push(`1 external reference + ${localSalesCount} local sales`);
        } else {
          confidence = 'Low';
          explanationParts.push(`External reference price (no local sales recorded)`);
        }
      }
    }

    // Handle Insufficient Data Case
    if (!baselineRetailTarget || baselineRetailTarget <= 0) {
      return {
        pricing: {
          suggestedRetailLow: null,
          suggestedRetailHigh: null,
          suggestedRetailTarget: null,
          suggestedBuyLow: null,
          suggestedBuyHigh: null,
          refurbishmentReserve: refurbReservePct,
          riskAllowance: riskPct,
          targetMarginPercentage: targetMarginPct,
          explanation: 'Insufficient market or historical sales data to formulate valuation.'
        },
        confidence: 'Insufficient data',
        explanation: 'Insufficient market data'
      };
    }

    // Condition penalty on retail target (if condition is below Mint)
    let conditionFactor = 1.0;
    if (normCondition === 'Excellent') conditionFactor = 0.95;
    else if (normCondition === 'Good') conditionFactor = 0.88;
    else if (normCondition === 'Fair') conditionFactor = 0.75;
    else if (normCondition === 'Damaged') conditionFactor = 0.55;

    const adjustedRetailTarget = Math.round(baselineRetailTarget * conditionFactor);
    const roundedRetailLow = Math.round((retailLow ?? adjustedRetailTarget * 0.9) * conditionFactor);
    const roundedRetailHigh = Math.round((retailHigh ?? adjustedRetailTarget * 1.1) * conditionFactor);

    // Calculate Safe Acquisition (Buy) Range
    // Formula: Expected Resale - Refurbishment Reserve - Risk Allowance - Profit Margin Target
    const refurbDeduction = (adjustedRetailTarget * refurbReservePct) / 100;
    const riskDeduction = (adjustedRetailTarget * riskPct) / 100;
    const netResaleBase = Math.max(0, adjustedRetailTarget - refurbDeduction - riskDeduction);

    // Calculate buy range based on target margin (e.g. 35%) and min margin (e.g. 25%)
    const maxBuyTarget = netResaleBase * (1 - targetMarginPct / 100);
    const minBuyTarget = maxBuyTarget * 0.85;

    // Round values neatly (e.g., to nearest R10 or R50)
    const roundToNearest = (num: number) => {
      if (num > 1000) return Math.round(num / 100) * 100;
      if (num > 100) return Math.round(num / 10) * 10;
      return Math.round(num);
    };

    const finalBuyLow = roundToNearest(minBuyTarget);
    const finalBuyHigh = roundToNearest(maxBuyTarget);
    const finalRetailLow = roundToNearest(roundedRetailLow);
    const finalRetailHigh = roundToNearest(roundedRetailHigh);
    const finalRetailTarget = roundToNearest(adjustedRetailTarget);

    if (normCondition !== 'Mint') {
      explanationParts.push(`${normCondition} condition (${refurbReservePct}% reserve applied)`);
    } else {
      explanationParts.push(`Mint condition (no repair reserve applied)`);
    }

    return {
      pricing: {
        suggestedRetailLow: finalRetailLow,
        suggestedRetailHigh: finalRetailHigh,
        suggestedRetailTarget: finalRetailTarget,
        suggestedBuyLow: finalBuyLow,
        suggestedBuyHigh: finalBuyHigh,
        refurbishmentReserve: refurbReservePct,
        riskAllowance: riskPct,
        targetMarginPercentage: targetMarginPct,
        explanation: explanationParts.join(' • ')
      },
      confidence,
      explanation: explanationParts.join(' • ')
    };
  }

  /**
   * Transparent Local Demand Calculator
   */
  public static calculateDemand(localStats: LocalMarketSalesStats): DemandSignal {
    const count30 = localStats.salesLast30Days;
    const count90 = localStats.salesLast90Days;

    if (count90 <= 2) {
      return {
        label: 'Insufficient data',
        score: 10,
        localStats,
        explanation: `${count90} LocalMarket sales in the last 90 days`
      };
    }

    if (count90 >= 3 && count90 <= 5) {
      return {
        label: 'Low',
        score: 35,
        localStats,
        explanation: `${count90} LocalMarket sales in the last 90 days`
      };
    }

    // 6+ sales
    if (count30 >= 4) {
      return {
        label: 'High',
        score: 85,
        localStats,
        explanation: `${count30} LocalMarket sales in the last 30 days`
      };
    }

    return {
      label: 'Moderate',
      score: 60,
      localStats,
      explanation: `${count90} LocalMarket sales in the last 90 days`
    };
  }
}
