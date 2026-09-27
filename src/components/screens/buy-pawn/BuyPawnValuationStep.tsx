import React from 'react';
import { motion } from 'motion/react';
import { Scale, TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { MarketCheckCard } from '../../common/MarketCheckCard';
import { MarketCheckResult } from '../../../types/marketIntelligence';
import { roundRetailPrice } from '../../../utils/pricingRules';
import { TxType, ItemDraft } from './buyPawnTypes';

interface BuyPawnValuationStepProps {
  txType: TxType;
  itemData: ItemDraft;
  retailPriceInput: string;
  setRetailPriceInput: (val: string) => void;
  costBasisInput: string;
  setCostBasisInput: (val: string) => void;
  agreedOffer: number;
  setAgreedOffer: (val: number) => void;
  suggestedRetail: number;
  setSuggestedRetail: (val: number) => void;
  businessRules: any;
  marketCheckData: MarketCheckResult | null;
  isMarketLoading: boolean;
  marketError: string | null;
  onRunMarketCheck: () => void;
  onBack: () => void;
  onNext: () => void;
}

export const BuyPawnValuationStep: React.FC<BuyPawnValuationStepProps> = ({
  txType,
  itemData,
  retailPriceInput,
  setRetailPriceInput,
  costBasisInput,
  setCostBasisInput,
  agreedOffer,
  setAgreedOffer,
  suggestedRetail,
  setSuggestedRetail,
  businessRules,
  marketCheckData,
  isMarketLoading,
  marketError,
  onRunMarketCheck,
  onBack,
  onNext,
}) => {
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
            {txType === 'existing' ? 'Retail Price & Cost Basis' : 'Fair Market Valuation'}
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
            }}
            onApplySuggestedBuy={(buyLow, buyHigh) => {
              const midBuy = Math.round((buyLow + buyHigh) / 2);
              setAgreedOffer(midBuy);
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
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                Retail Floor Price (ZAR) *
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-[#C85A32]">
                  R
                </span>
                <input
                  id="valuation-retail-price-input"
                  type="number"
                  value={retailPriceInput}
                  onChange={(e) => setRetailPriceInput(e.target.value)}
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
                Cost Basis (ZAR, Optional)
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
              <p className="text-xs text-gray-500">Historical acquisition cost if known, or leave 0.</p>
            </div>
          </div>

          {/* MARGIN CALCULATION BANNER */}
          {parseFloat(retailPriceInput) > 0 && parseFloat(costBasisInput) > 0 && (
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
                  <span className="text-xs font-semibold text-gray-500">Recommended Payout</span>
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[11px] font-semibold border border-emerald-200">
                    <TrendingUp className="w-3 h-3" />
                    <span>Fair Estimate</span>
                  </div>
                </div>
                <p className="text-3xl font-bold text-gray-900 font-mono">
                  R {agreedOffer.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500 border-t border-gray-200 pt-2">
                  Based on {itemData.condition} condition for {itemData.category}
                </p>
              </div>

              {txType === 'buy' && (
                <div className="p-4 rounded-xl bg-[#FDF0EA] border border-[#C85A32]/20 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-gray-700">Projected Retail Selling Price</span>
                    <p className="text-xs text-gray-500">Calculated with standard markup</p>
                  </div>
                  <span className="text-lg font-bold text-[#C85A32] font-mono">
                    R {suggestedRetail.toLocaleString()}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                Negotiated Final Amount (ZAR)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-[#C85A32]">
                  R
                </span>
                <input
                  id="valuation-agreed-offer-input"
                  type="number"
                  value={agreedOffer}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setAgreedOffer(val);
                    if (txType === 'buy') {
                      setSuggestedRetail(
                        roundRetailPrice(
                          val * businessRules.defaultRetailMarkupMultiplier,
                          businessRules.retailRoundingMode
                        )
                      );
                    }
                  }}
                  className="w-full bg-white border-2 border-[#C85A32] rounded-xl pl-10 pr-4 py-3.5 text-3xl font-bold text-gray-900 font-mono outline-none shadow-xs"
                />
              </div>
              <p className="text-xs text-gray-500 italic">
                Confirm serial and asset state before proceeding to deal terms.
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
          <span>{txType === 'existing' ? 'Choose Stock Location' : 'Review Deal Terms'}</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
};
