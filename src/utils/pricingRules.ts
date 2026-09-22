import { BusinessRules, RetailRoundingMode } from '../types';

export const DEFAULT_BUSINESS_RULES: BusinessRules = {
  pawnMonthlyInterestRate: 0.05, // 5.0% NCR legal ceiling
  pawnStorageAdminFeeRate: 0.08, // 8.0% standard insured vault storage
  defaultLoanTermDays: 30,
  gracePeriodDays: 7,
  minLoanPrincipal: 100,

  defaultRetailMarkupMultiplier: 1.8, // 1.8x = +80% markup
  retailRoundingMode: 'nearest10',
  storeWarrantyDays: 7,
  warrantyDescription: '7-Day Store Test Warranty',

  defaultIntakeType: 'prompt',
  defaultVaultShelf: 'Shelf A-04',
  defaultCashierName: 'Officer Thabo Sithole',
  defaultCategory: 'Phones & Tech',
  autoPrintTag: true,
};

export interface StrategyPreset {
  id: string;
  name: string;
  badge: string;
  description: string;
  iconName: string;
  rules: Partial<BusinessRules>;
}

export const PRESET_BUSINESS_STRATEGIES: StrategyPreset[] = [
  {
    id: 'standard_ncr',
    name: 'Standard SA Pawnbroker',
    badge: 'NCR Compliant',
    description: 'Regulated 5% monthly interest, 8% vault storage, 1.8x retail margin, 30-day term with 7-day grace period.',
    iconName: 'ShieldCheck',
    rules: {
      pawnMonthlyInterestRate: 0.05,
      pawnStorageAdminFeeRate: 0.08,
      defaultLoanTermDays: 30,
      gracePeriodDays: 7,
      defaultRetailMarkupMultiplier: 1.8,
      retailRoundingMode: 'nearest10',
      storeWarrantyDays: 7,
      warrantyDescription: '7-Day Store Test Warranty',
    }
  },
  {
    id: 'high_turnover',
    name: 'High-Turnover Retail Reseller',
    badge: 'Fast Inventory',
    description: 'Lower 5% storage fee, competitive 1.5x retail markup for rapid stock clearance, charm R99 pricing.',
    iconName: 'TrendingUp',
    rules: {
      pawnMonthlyInterestRate: 0.05,
      pawnStorageAdminFeeRate: 0.05,
      defaultLoanTermDays: 30,
      gracePeriodDays: 5,
      defaultRetailMarkupMultiplier: 1.5,
      retailRoundingMode: 'charm99',
      storeWarrantyDays: 14,
      warrantyDescription: '14-Day Store Guarantee',
    }
  },
  {
    id: 'premium_vault',
    name: 'Premium Collateral Vault',
    badge: 'High-Value Security',
    description: 'Promotional 3.5% interest rate for high-value tech/gold, 10% insured vault fee, 60-day extended loans.',
    iconName: 'Gem',
    rules: {
      pawnMonthlyInterestRate: 0.035,
      pawnStorageAdminFeeRate: 0.10,
      defaultLoanTermDays: 60,
      gracePeriodDays: 14,
      defaultRetailMarkupMultiplier: 2.0,
      retailRoundingMode: 'charm99',
      storeWarrantyDays: 30,
      warrantyDescription: '30-Day Electrical Warranty',
    }
  }
];

/**
 * Calculates retail price according to selected rounding rules
 */
export function roundRetailPrice(price: number, mode: RetailRoundingMode): number {
  if (isNaN(price) || price <= 0) return 0;

  switch (mode) {
    case 'nearest10':
      return Math.round(price / 10) * 10;
    case 'charm99': {
      const base = Math.floor(price / 100) * 100;
      return base > 0 ? base + 99 : 99;
    }
    case 'charm9': {
      const base = Math.floor(price / 10) * 10;
      return base > 0 ? base + 9 : 9;
    }
    case 'exact':
    default:
      return Math.round(price * 100) / 100;
  }
}

/**
 * Helper to compute pawn repayment breakdown
 */
export function calculatePawnFees(principal: number, rules: BusinessRules) {
  const interest = principal * rules.pawnMonthlyInterestRate;
  const storage = principal * rules.pawnStorageAdminFeeRate;
  const total = principal + interest + storage;
  return {
    interest,
    storage,
    total,
    interestPct: Math.round(rules.pawnMonthlyInterestRate * 100),
    storagePct: Math.round(rules.pawnStorageAdminFeeRate * 100),
  };
}

/**
 * Helper to compute outright buy retail margin breakdown
 */
export function calculateBuyMargin(cost: number, rules: BusinessRules) {
  const rawPrice = cost * rules.defaultRetailMarkupMultiplier;
  const roundedPrice = roundRetailPrice(rawPrice, rules.retailRoundingMode);
  const profit = roundedPrice - cost;
  const marginPct = roundedPrice > 0 ? Math.round((profit / roundedPrice) * 100) : 0;
  const markupPct = cost > 0 ? Math.round(((roundedPrice - cost) / cost) * 100) : 0;

  return {
    rawPrice,
    retailPrice: roundedPrice,
    profit,
    marginPct,
    markupPct,
  };
}
