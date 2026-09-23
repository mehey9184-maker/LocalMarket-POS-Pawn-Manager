import React, { useState } from 'react';
import { MarketCheckResult } from '../../types/marketIntelligence';
import { TrendingUp, ShieldCheck, Info, ChevronDown, ChevronUp, Sparkles, AlertCircle, RefreshCw, Check } from 'lucide-react';

interface MarketCheckCardProps {
  data: MarketCheckResult | null;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onApplySuggestedRetail?: (price: number) => void;
  onApplySuggestedBuy?: (priceLow: number, priceHigh: number) => void;
}

export const MarketCheckCard: React.FC<MarketCheckCardProps> = ({
  data,
  loading = false,
  error = null,
  onRefresh,
  onApplySuggestedRetail,
  onApplySuggestedBuy
}) => {
  const [showWhy, setShowWhy] = useState(false);
  const [retailApplied, setRetailApplied] = useState(false);
  const [buyApplied, setBuyApplied] = useState(false);

  const formatCurrency = (val: number | null | undefined) => {
    if (val === null || val === undefined || isNaN(val)) return 'N/A';
    return `R${val.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}`;
  };

  const getConfidenceBadgeClass = (conf: string) => {
    switch (conf) {
      case 'High':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'Medium':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      case 'Low':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      default:
        return 'bg-gray-500/10 text-gray-400 border-gray-500/30';
    }
  };

  const getDemandBadgeClass = (lbl: string) => {
    switch (lbl) {
      case 'High':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'Moderate':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      case 'Low':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      default:
        return 'bg-gray-500/10 text-gray-400 border-gray-500/30';
    }
  };

  if (loading) {
    return (
      <div className="bg-[#181818] border border-[#2A2A2A] rounded-2xl p-4 shadow-sm animate-pulse">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#E87A5D] animate-spin" />
            <span className="font-bold text-xs text-gray-300 font-headline">MARKET CHECK</span>
          </div>
          <span className="text-[11px] text-gray-500 font-mono">Analyzing internal &amp; reference data...</span>
        </div>
        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className="h-10 bg-[#222] rounded-xl"></div>
          <div className="h-10 bg-[#222] rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#181818] border border-[#2A2A2A] rounded-2xl p-4 text-xs text-gray-400 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
          <span>{error === 'Market Check unavailable offline' ? 'Market Check unavailable offline' : 'Insufficient market data'}</span>
        </div>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            className="p-1.5 hover:bg-[#2A2A2A] rounded-lg text-gray-300 transition"
            title="Retry Market Check"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  }

  if (!data) return null;

  const {
    referencePrice,
    usedMarketLow,
    usedMarketHigh,
    demand,
    pricing,
    confidence,
    summaryExplanation
  } = data;

  const usedRangeStr = (usedMarketLow && usedMarketHigh)
    ? `${formatCurrency(usedMarketLow)} – ${formatCurrency(usedMarketHigh)}`
    : 'N/A';

  const suggestedBuyStr = (pricing.suggestedBuyLow && pricing.suggestedBuyHigh)
    ? `${formatCurrency(pricing.suggestedBuyLow)} – ${formatCurrency(pricing.suggestedBuyHigh)}`
    : 'N/A';

  return (
    <div className="bg-[#181818] border border-[#2E2E2E] rounded-2xl p-4 shadow-md text-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#2A2A2A] pb-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#C85A32]/10 border border-[#C85A32]/30 text-[#E87A5D]">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-bold text-xs uppercase text-white tracking-wider font-headline flex items-center gap-2">
              Market Check
            </h4>
            <p className="text-[11px] text-gray-400">{summaryExplanation}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase font-mono ${getConfidenceBadgeClass(confidence)}`}>
            {confidence === 'Insufficient data' ? 'Low Data' : `${confidence} Confidence`}
          </span>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="p-1 hover:bg-[#282828] rounded-lg text-gray-400 hover:text-white transition"
              title="Refresh Market Intelligence"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-3">
        <div className="bg-[#121212] p-2.5 rounded-xl border border-[#252525]">
          <span className="text-[10px] uppercase text-gray-400 font-semibold block mb-0.5">New / Reference</span>
          <span className="font-bold text-white font-mono">{formatCurrency(referencePrice)}</span>
        </div>

        <div className="bg-[#121212] p-2.5 rounded-xl border border-[#252525]">
          <span className="text-[10px] uppercase text-gray-400 font-semibold block mb-0.5">Used Market</span>
          <span className="font-bold text-white font-mono">{usedRangeStr}</span>
        </div>

        <div className="bg-[#121212] p-2.5 rounded-xl border border-[#252525]">
          <span className="text-[10px] uppercase text-gray-400 font-semibold block mb-0.5">Local Demand</span>
          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold border ${getDemandBadgeClass(demand.label)}`}>
            {demand.label}
          </span>
        </div>

        <div className="bg-[#121212] p-2.5 rounded-xl border border-[#252525]">
          <span className="text-[10px] uppercase text-gray-400 font-semibold block mb-0.5">Suggested Retail</span>
          <div className="flex items-center justify-between">
            <span className="font-bold text-emerald-400 font-mono">
              {formatCurrency(pricing.suggestedRetailTarget || pricing.suggestedRetailLow)}
            </span>
            {onApplySuggestedRetail && pricing.suggestedRetailTarget && (
              <button
                type="button"
                onClick={() => {
                  onApplySuggestedRetail(pricing.suggestedRetailTarget!);
                  setRetailApplied(true);
                  setTimeout(() => setRetailApplied(false), 2000);
                }}
                className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 font-semibold transition"
              >
                {retailApplied ? <Check className="w-3 h-3 text-emerald-400 inline" /> : 'Use'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Suggested Buy Range Bar */}
      <div className="bg-[#141414] p-3 rounded-xl border border-[#2A2A2A] flex items-center justify-between text-xs">
        <div>
          <span className="text-[10px] uppercase text-gray-400 font-semibold block">Suggested Buy / Acquisition Range</span>
          <span className="font-bold text-[#E87A5D] font-mono text-sm">{suggestedBuyStr}</span>
        </div>

        {onApplySuggestedBuy && pricing.suggestedBuyLow && pricing.suggestedBuyHigh && (
          <button
            type="button"
            onClick={() => {
              onApplySuggestedBuy(pricing.suggestedBuyLow!, pricing.suggestedBuyHigh!);
              setBuyApplied(true);
              setTimeout(() => setBuyApplied(false), 2000);
            }}
            className="px-3 py-1.5 rounded-lg bg-[#C85A32] hover:bg-[#b04a25] text-white font-semibold text-xs transition flex items-center gap-1 shadow-xs"
          >
            {buyApplied ? <Check className="w-3.5 h-3.5" /> : null}
            <span>{buyApplied ? 'Applied' : 'Apply Range'}</span>
          </button>
        )}
      </div>

      {/* Collapsible Why Section */}
      <div className="mt-3 pt-2 border-t border-[#242424]">
        <button
          type="button"
          onClick={() => setShowWhy(!showWhy)}
          className="text-[11px] text-gray-400 hover:text-white flex items-center gap-1 transition"
        >
          <Info className="w-3.5 h-3.5 text-[#E87A5D]" />
          <span>Why this recommendation?</span>
          {showWhy ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>

        {showWhy && (
          <div className="mt-2.5 p-3 rounded-xl bg-[#111] border border-[#222] text-[11px] text-gray-300 space-y-1.5 font-sans">
            <p className="font-semibold text-white">{pricing.explanation}</p>
            <p className="text-gray-400">{demand.explanation}</p>
            <div className="pt-1 border-t border-[#222] text-[10px] text-gray-500 font-mono flex items-center justify-between">
              <span>Target Margin: {pricing.targetMarginPercentage}%</span>
              <span>Refurb Reserve: {pricing.refurbishmentReserve}%</span>
              <span>Risk Allowance: {pricing.riskAllowance}%</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
