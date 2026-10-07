import React from 'react';
import { motion } from 'motion/react';
import { Scale, TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { MarketCheckCard } from '../../common/MarketCheckCard';
import { MarketCheckResult } from '../../../types/marketIntelligence';
import { roundRetailPrice } from '../../../utils/pricingRules';
import { TxType, ItemDraft, PawnCalculations } from './buyPawnTypes';
import { useAuth } from '../../../context/AuthContext';
import { shouldRecalculateShelfPrice } from './useBuyPawnWorkflow';

interface BuyPawnValuationStepProps {
  txType: TxType;
  itemData: ItemDraft;
  retailPriceInput: string;
  setRetailPriceInput: (val: string) => void;
  isRetailPriceFromMarketCheck?: boolean;
  setIsRetailPriceFromMarketCheck?: (val: boolean) => void;
  costBasisInput: string;
  setCostBasisInput: (val: string) => void;
  agreedOffer: number;
  setAgreedOffer: (val: number) => void;
  isAgreedOfferFromMarketCheck?: boolean;
  setIsAgreedOfferFromMarketCheck?: (val: boolean) => void;
  suggestedRetail: number;
  setSuggestedRetail: (val: number) => void;
  isShelfPriceEdited?: boolean;
  setIsShelfPriceEdited?: (val: boolean) => void;
  pawnCalculations?: PawnCalculations | null;
  businessRules: any;
  marketCheckData: MarketCheckResult | null;
  isMarketLoading: boolean;
  marketError: string | null;
  onRunMarketCheck: () => void;
  onBack: () => void;
  onNext: () => void;
  onAbandon?: () => void;
}

export const BuyPawnValuationStep: React.FC<BuyPawnValuationStepProps> = ({
  txType,
  itemData,
  retailPriceInput,
  setRetailPriceInput,
  isRetailPriceFromMarketCheck = false,
  setIsRetailPriceFromMarketCheck,
  costBasisInput,
  setCostBasisInput,
  agreedOffer,
  setAgreedOffer,
  isAgreedOfferFromMarketCheck = false,
  setIsAgreedOfferFromMarketCheck,
  suggestedRetail,
  setSuggestedRetail,
  isShelfPriceEdited = false,
  setIsShelfPriceEdited,
  pawnCalculations,
  businessRules,
  marketCheckData,
  isMarketLoading,
  marketError,
  onRunMarketCheck,
  onBack,
  onNext,
  onAbandon,
}) => {
  const { isOwner, isManager, isAtLeastSeniorCashier, hasPermission } = useAuth();
  const canViewCostBasis = isOwner || isManager || isAtLeastSeniorCashier || hasPermission('reports') || hasPermission('pricing');

  return (
    <motion.div
      initial={{ opacity: 0, x: 15 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -15 }}
      className="space-y-6"
    >
      <div className="flex items-center gap-3.5 mb-2">
        <div className="w-10 h-10 rounded-xl bg-[#FDF0EA] text-[#C85A32] flex items-center justify-center font-bold">
          <Scale className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900">
            {txType === 'existing' ? 'Shelf price & what it cost you' : 'Fair Market Valuation'}
          </h3>
          <p className="text-xs text-gray-500">
            {txType === 'existing'
              ? 'Define shelf retail selling price and optional historical cost'
              : `Determining ${txType === 'buy' ? 'cash payout' : 'pawn loan principal'}`}
          </p>
        </div>
      </div>

      {/* Market Intelligence Guidance Card */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-700">LocalMarket Valuation Intelligence</span>
          <button
            type="button"
            onClick={onRunMarketCheck}
            className="px-3 py-1 bg-[#C85A32] text-white hover:bg-[#A94725] rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>{marketCheckData ? 'Refresh Market Check' : 'Run Market Check'}</span>
          </button>
        </div>

        {(marketCheckData || isMarketLoading || marketError) && (
          <MarketCheckCard
            data={marketCheckData}
            loading={isMarketLoading}
            error={marketError}
            onRefresh={onRunMarketCheck}
            onApplySuggestedRetail={(retailVal) => {
              setRetailPriceInput(String(retailVal));
              setIsRetailPriceFromMarketCheck?.(true);
            }}
            onApplySuggestedBuy={(buyLow, buyHigh) => {
              const midBuy = Math.round((buyLow + buyHigh) / 2);
              setAgreedOffer(midBuy);
              setIsAgreedOfferFromMarketCheck?.(true);
              if (txType === 'buy' && shouldRecalculateShelfPrice(Boolean(isShelfPriceEdited))) {
                setSuggestedRetail(
                  roundRetailPrice(
                    midBuy * businessRules.defaultRetailMarkupMultiplier,
                    businessRules.retailRoundingMode
                  )
                );
              }
            }}
          />
        )}
      </div>

      {/* 3A. VALUATION FOR EXISTING STOCK */}
      {txType === 'existing' ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-7 shadow-xs space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* RETAIL PRICE */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Shelf price (ZAR) *
                </label>
                {isRetailPriceFromMarketCheck && parseFloat(retailPriceInput) > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[11px] font-semibold border border-emerald-200">
                    <TrendingUp className="w-3 h-3" />
                    <span>From Market Check</span>
                  </span>
                )}
              </div>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-[#C85A32]">
                  R
                </span>
                <input
                  id="valuation-retail-price-input"
                  type="number"
                  value={retailPriceInput}
                  onChange={(e) => {
                    setIsRetailPriceFromMarketCheck?.(false);
                    setRetailPriceInput(e.target.value);
                  }}
                  className="w-full bg-[#F8F9FA] border-2 border-gray-200 focus:border-[#C85A32] focus:bg-white rounded-xl pl-9 pr-4 py-3 text-2xl font-bold text-gray-900 font-mono outline-none transition"
                  placeholder="0.00"
                  autoFocus
                />
              </div>
              <p className="text-xs text-gray-500">The customer price that will appear in Front POS.</p>
            </div>

            {/* OPTIONAL COST BASIS */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                What it cost you (optional)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-gray-400">
                  R
                </span>
                <input
                  type="number"
                  value={costBasisInput}
                  onChange={(e) => setCostBasisInput(e.target.value)}
                  className="w-full bg-[#F8F9FA] border-2 border-gray-200 focus:border-gray-400 focus:bg-white rounded-xl pl-9 pr-4 py-3 text-2xl font-bold text-gray-800 font-mono outline-none transition"
                  placeholder="0.00"
                />
              </div>
              <p className="text-xs text-gray-500">Historical acquisition or purchase cost if known (leave blank if unknown).</p>
            </div>
          </div>

          {/* MARGIN CALCULATION BANNER */}
          {canViewCostBasis && parseFloat(retailPriceInput) > 0 && parseFloat(costBasisInput) > 0 && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
                <div>
                  <p className="text-xs font-bold text-emerald-800">Estimated Gross Margin</p>
                  <p className="text-xs text-emerald-600">
                    Spread: R{' '}
                    {(parseFloat(retailPriceInput) - parseFloat(costBasisInput)).toLocaleString()}
                  </p>
                </div>
              </div>
              <span className="text-base font-bold text-emerald-700 font-mono">
                {(
                  ((parseFloat(retailPriceInput) - parseFloat(costBasisInput)) /
                    parseFloat(retailPriceInput)) *
                  100
                ).toFixed(1)}
                %
              </span>
            </div>
          )}
        </div>
      ) : (
        /* 3B. VALUATION FOR BUY OR PAWN */
        <div className="bg-white border border-gray-200 rounded-2xl p-7 shadow-xs space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="p-5 rounded-xl bg-gray-50 border border-gray-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-500">
                    {marketCheckData?.pricing?.suggestedBuyLow != null && marketCheckData?.pricing?.suggestedBuyHigh != null
                      ? 'Market Valuation Guidance'
                      : 'Transaction Value'}
                  </span>
                  {agreedOffer > 0 && isAgreedOfferFromMarketCheck ? (
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[11px] font-semibold border border-emerald-200">
                      <TrendingUp className="w-3 h-3" />
                      <span>From Market Check</span>
                    </div>
                  ) : agreedOffer > 0 ? (
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[11px] font-semibold border border-blue-200">
                      <span>Cashier Entered</span>
                    </div>
                  ) : marketCheckData?.pricing?.suggestedBuyLow != null && marketCheckData?.pricing?.suggestedBuyHigh != null ? (
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[11px] font-semibold border border-emerald-200">
                      <TrendingUp className="w-3 h-3" />
                      <span>Market Check</span>
                    </div>
                  ) : null}
                </div>

                {marketCheckData?.pricing?.suggestedBuyLow != null && marketCheckData?.pricing?.suggestedBuyHigh != null ? (
                  <>
                    <p className="text-2xl font-bold text-gray-900 font-mono">
                      R {marketCheckData.pricing.suggestedBuyLow.toLocaleString()} – R {marketCheckData.pricing.suggestedBuyHigh.toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500 border-t border-gray-200 pt-2">
                      Suggested range based on recent market pricing for {itemData.title || itemData.category}.
                    </p>
                  </>
                ) : agreedOffer > 0 ? (
                  <>
                    <p className="text-3xl font-bold text-gray-900 font-mono">
                      R {agreedOffer.toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500 border-t border-gray-200 pt-2">
                      {txType === 'buy' ? 'Cash payout' : 'Loan principal'} negotiated at the counter.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-gray-500 italic">
                      No amount entered yet. Enter the negotiated {txType === 'buy' ? 'payout' : 'loan principal'} below, or run a Market Check.
                    </p>
                    <p className="text-xs text-gray-400 border-t border-gray-200 pt-2">
                      LocalMarket does not invent starting figures.
                    </p>
                  </>
                )}
              </div>

              {txType === 'buy' && (
                <div className="p-4 rounded-xl bg-[#FDF0EA] border border-[#C85A32]/20 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-gray-700">Suggested shelf price</span>
                    <p className="text-xs text-gray-500">
                      {isShelfPriceEdited
                        ? 'set by you'
                        : agreedOffer > 0
                        ? `Calculated with standard ${(businessRules.defaultRetailMarkupMultiplier * 100 - 100).toFixed(0)}% markup (suggestion)`
                        : 'Calculates automatically from negotiated payout'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-base font-bold text-[#C85A32] font-mono">R</span>
                    <input
                      type="number"
                      value={suggestedRetail === 0 ? '' : suggestedRetail}
                      onChange={(e) => {
                        setIsShelfPriceEdited?.(true);
                        const raw = e.target.value;
                        const val = raw === '' ? 0 : Math.max(0, Number(raw));
                        setSuggestedRetail(val);
                      }}
                      placeholder="0.00"
                      className="w-28 bg-white border border-stone-300 focus:border-[#C85A32] rounded-lg px-2 py-1 text-base font-bold text-[#C85A32] font-mono outline-none text-right"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  {txType === 'buy' ? 'Negotiated Payout (ZAR) *' : 'Agreed Loan Principal (ZAR) *'}
                </label>
                {isAgreedOfferFromMarketCheck && agreedOffer > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[11px] font-semibold border border-emerald-200">
                    <TrendingUp className="w-3 h-3" />
                    <span>From Market Check</span>
                  </span>
                )}
              </div>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-[#C85A32]">
                  R
                </span>
                <input
                  id="valuation-agreed-offer-input"
                  type="number"
                  value={agreedOffer === 0 ? '' : agreedOffer}
                  onChange={(e) => {
                    setIsAgreedOfferFromMarketCheck?.(false);
                    const raw = e.target.value;
                    const val = raw === '' ? 0 : Math.max(0, Number(raw));
                    setAgreedOffer(val);
                    if (txType === 'buy' && shouldRecalculateShelfPrice(Boolean(isShelfPriceEdited))) {
                      setSuggestedRetail(
                        val > 0
                          ? roundRetailPrice(
                              val * businessRules.defaultRetailMarkupMultiplier,
                              businessRules.retailRoundingMode
                            )
                          : 0
                      );
                    }
                  }}
                  placeholder="0.00"
                  className={`w-full bg-white border-2 ${
                    txType === 'pawn' && businessRules.maxLoanPrincipal && businessRules.maxLoanPrincipal > 0 && agreedOffer > businessRules.maxLoanPrincipal
                      ? 'border-red-500 text-red-900'
                      : 'border-[#C85A32] text-gray-900'
                  } rounded-xl pl-10 pr-4 py-3.5 text-3xl font-bold font-mono outline-none shadow-xs`}
                  autoFocus
                />
              </div>

              {txType === 'pawn' && businessRules.maxLoanPrincipal && businessRules.maxLoanPrincipal > 0 && agreedOffer > businessRules.maxLoanPrincipal && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs space-y-0.5">
                  <p className="font-bold text-red-700">Above this shop’s pawn limit</p>
                  <p className="text-red-600 font-mono">Maximum pawn amount: R {businessRules.maxLoanPrincipal.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</p>
                </div>
              )}

              {txType === 'pawn' && agreedOffer > 0 && agreedOffer < (businessRules.minLoanPrincipal || 100) && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-0.5">
                  <p className="font-bold">Below shop minimum loan amount</p>
                  <p className="font-mono">Minimum pawn amount: R {(businessRules.minLoanPrincipal || 100).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</p>
                </div>
              )}

              {/* LIVE PAWN TERMS READ-ONLY PANEL (Calculated from agreed principal) */}
              {txType === 'pawn' && agreedOffer > 0 && pawnCalculations && (
                <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200/80 space-y-2 text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-blue-100">
                    <span className="font-bold text-blue-900">Live Pawn Terms</span>
                    <span className="text-[10px] font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                      Calculated from your amount
                    </span>
                  </div>
                  <div className="space-y-1.5 pt-0.5">
                    <div className="flex justify-between text-stone-600">
                      <span>Monthly interest ({Math.round((businessRules?.pawnMonthlyInterestRate ?? 0) * 100)}%)</span>
                      <span className="font-mono font-medium text-stone-900">R {pawnCalculations.interest.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-stone-600">
                      <span>Storage fee ({Math.round((businessRules?.pawnStorageAdminFeeRate ?? 0) * 100)}%)</span>
                      <span className="font-mono font-medium text-stone-900">R {pawnCalculations.adminFee.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-blue-800 pt-1 border-t border-blue-100/80">
                      <span>Total to redeem</span>
                      <span className="font-mono text-sm">R {pawnCalculations.totalRedemption.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-stone-500 text-[11px]">
                      <span>Last day to redeem</span>
                      <span className="font-mono">{pawnCalculations.expiryDate}</span>
                    </div>
                  </div>
                </div>
              )}

              <p className="text-xs text-gray-500 italic">
                {txType === 'buy'
                  ? 'Confirm agreed payout before reviewing deal terms.'
                  : `Confirm loan principal before reviewing pledge terms.${
                      businessRules.maxLoanPrincipal && businessRules.maxLoanPrincipal > 0
                        ? ` (Shop policy limit: R ${businessRules.maxLoanPrincipal.toLocaleString('en-ZA', { minimumFractionDigits: 2 })})`
                        : ''
                    }`}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-5 py-3 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-100 transition text-xs font-semibold cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back</span>
        </button>
        <button
          onClick={onNext}
          className="flex-1 py-3 px-6 bg-[#C85A32] text-white rounded-xl font-semibold text-xs flex items-center justify-center gap-2 shadow-xs hover:bg-[#A94725] transition cursor-pointer"
        >
          <span>
            {txType === 'existing'
              ? 'Choose Stock Location'
              : txType === 'buy'
              ? 'Purchase This Item (Seller Details)'
              : 'Review Pledge Terms'}
          </span>
          <ChevronRight className="w-4 h-4" />
        </button>
        {txType === 'buy' && onAbandon && (
          <button
            type="button"
            onClick={onAbandon}
            className="px-4 py-3 rounded-xl border border-stone-300 text-stone-700 hover:text-rose-700 hover:bg-rose-50 hover:border-rose-200 transition text-xs font-semibold cursor-pointer"
          >
            Not Worth Buying
          </button>
        )}
      </div>
    </motion.div>
  );
};
