export type ConfidenceLevel = 'High' | 'Medium' | 'Low' | 'Insufficient data';
export type DemandLabel = 'Insufficient data' | 'Low' | 'Moderate' | 'High';

export interface LocalMarketSalesStats {
  salesLast30Days: number;
  salesLast60Days: number;
  salesLast90Days: number;
  currentActiveStockCount: number;
  avgSalePrice: number | null;
  medianSalePrice: number | null;
  minSalePrice: number | null;
  maxSalePrice: number | null;
  medianDaysToSell: number | null;
  sellThroughRate: number | null;
}

export interface DemandSignal {
  label: DemandLabel;
  score: number; // 0 to 100
  localStats: LocalMarketSalesStats;
  explanation: string;
}

export interface PricingEstimate {
  suggestedRetailLow: number | null;
  suggestedRetailHigh: number | null;
  suggestedRetailTarget: number | null;
  suggestedBuyLow: number | null;
  suggestedBuyHigh: number | null;
  refurbishmentReserve: number;
  riskAllowance: number;
  targetMarginPercentage: number;
  explanation: string;
}

export interface MarketObservation {
  sourceType: 'upcitemdb' | 'internal_sales' | 'cached_snapshot' | 'marketplace_asking';
  sourceName: string;
  sourceUrl?: string;
  productName: string;
  brand?: string;
  model?: string;
  category?: string;
  barcode?: string;
  referencePrice: number | null; // Current new / reference MSRP
  usedLow: number | null; // Lower bound used
  usedHigh: number | null; // Upper bound used
  medianPrice: number | null;
  rawSummary?: Record<string, any>;
  observedAt: string;
}

export interface MarketCheckResult {
  queryKey: string;
  barcode?: string;
  normalizedProductName: string;
  brand?: string;
  model?: string;
  category?: string;
  condition?: string;
  
  referencePrice: number | null; // New / Reference
  usedMarketLow: number | null;
  usedMarketHigh: number | null;
  
  demand: DemandSignal;
  pricing: PricingEstimate;
  confidence: ConfidenceLevel;
  
  onlineReferencesCount: number;
  localSalesCount: number;
  summaryExplanation: string;
  cached: boolean;
  observedAt: string;
}

export interface MarketCheckRequest {
  barcode?: string;
  title?: string;
  category?: string;
  condition?: string;
  itemId?: string;
  forceRefresh?: boolean;
}

export interface MarketDataProvider {
  name: string;
  lookup(query: { barcode?: string; title?: string; category?: string; condition?: string; shopId: string }): Promise<MarketObservation | null>;
}
