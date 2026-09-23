import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../../context/AppContext';
import { BusinessRules, RetailRoundingMode } from '../../types';
import {
  PRESET_BUSINESS_STRATEGIES,
  calculatePawnFees,
  calculateBuyMargin,
  roundRetailPrice
} from '../../utils/pricingRules';
import {
  Sliders,
  ShieldCheck,
  ShoppingBag,
  History,
  TrendingUp,
  Percent,
  Calendar,
  Layers,
  Sparkles,
  HelpCircle,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Save,
  X,
  ArrowRight,
  Printer,
  Scale,
  DollarSign,
  Tag
} from 'lucide-react';

export const DealRulesModal: React.FC = () => {
  const { businessRules, updateBusinessRules, isRulesModalOpen, setIsRulesModalOpen, showToast } = useApp();

  const [activeTab, setActiveTab] = useState<'pawn' | 'buy' | 'workflow' | 'guide'>('pawn');
  const [formRules, setFormRules] = useState<BusinessRules>(businessRules);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('standard_ncr');

  // Live Simulator States
  const [samplePawnAmount, setSamplePawnAmount] = useState<number>(1000);
  const [sampleBuyAmount, setSampleBuyAmount] = useState<number>(1000);

  if (!isRulesModalOpen) return null;

  const handleApplyPreset = (presetId: string) => {
    const preset = PRESET_BUSINESS_STRATEGIES.find(p => p.id === presetId);
    if (!preset) return;

    setSelectedPresetId(presetId);
    setFormRules(prev => ({
      ...prev,
      ...preset.rules
    }));
    showToast('Preset Applied', `Loaded "${preset.name}" profile into editor`, 'info');
  };

  const handleSaveAll = () => {
    updateBusinessRules(formRules);
    setIsRulesModalOpen(false);
  };

  // Calculations for Live Simulators
  const pawnSim = calculatePawnFees(samplePawnAmount, formRules);
  const buySim = calculateBuyMargin(sampleBuyAmount, formRules);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 15 }}
        className="w-full max-w-4xl bg-[#181818] border border-[#2E2E2E] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* ============================================================
            HEADER
           ============================================================ */}
        <div className="px-6 py-4 bg-[#1F1F1F] border-b border-[#2E2E2E] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#C85A32]/20 border border-[#C85A32]/40 flex items-center justify-center text-[#E87A5D]">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-white font-headline tracking-tight">
                  Deal Rules &amp; Margins Configurator
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Customizable Engine
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Tailor 30-day pawn loan statutory rates, retail markup margins, and pricing formulas.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsRulesModalOpen(false)}
            className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-[#2A2A2A] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ============================================================
            1-CLICK STRATEGY PRESETS
           ============================================================ */}
        <div className="px-6 py-3 bg-[#141414] border-b border-[#282828] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-[11px] font-bold text-gray-300 uppercase tracking-wider">
              Quick Strategy Presets:
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {PRESET_BUSINESS_STRATEGIES.map(preset => (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleApplyPreset(preset.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition flex items-center gap-1.5 ${
                  selectedPresetId === preset.id
                    ? 'bg-[#C85A32]/20 border-[#C85A32] text-[#E87A5D]'
                    : 'bg-[#1C1C1C] border-[#2A2A2A] text-gray-400 hover:text-gray-200 hover:bg-[#252525]'
                }`}
              >
                <span>{preset.name}</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-black/40 text-gray-300 font-mono">
                  {preset.badge}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* ============================================================
            TABS
           ============================================================ */}
        <div className="px-6 pt-3 bg-[#181818] border-b border-[#282828] flex items-center gap-4 overflow-x-auto no-scrollbar shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('pawn')}
            className={`pb-3 border-b-2 text-xs font-bold uppercase tracking-wider transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'pawn'
                ? 'border-[#C85A32] text-[#E87A5D]'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <History className="w-4 h-4" />
            <span>30-Day Pawn Loans (NCR)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('buy')}
            className={`pb-3 border-b-2 text-xs font-bold uppercase tracking-wider transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'buy'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Outright Buys (Retail Margin)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('workflow')}
            className={`pb-3 border-b-2 text-xs font-bold uppercase tracking-wider transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'workflow'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Intake &amp; Hardware Defaults</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('guide')}
            className={`pb-3 border-b-2 text-xs font-bold uppercase tracking-wider transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'guide'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            <span>Simple Guide: Pawn vs Buy</span>
          </button>
        </div>

        {/* ============================================================
            CONTENT BODY (SCROLLABLE)
           ============================================================ */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* ------------------------------------------------------------
              TAB 1: 30-DAY PAWN LOANS (NCR)
             ------------------------------------------------------------ */}
          {activeTab === 'pawn' && (
            <div className="space-y-6">
              {/* Plain English Banner */}
              <div className="p-4 rounded-2xl bg-[#231713] border border-[#C85A32]/40 text-xs space-y-1.5">
                <div className="flex items-center gap-2 text-amber-400 font-bold">
                  <ShieldCheck className="w-4 h-4" />
                  <span>National Credit Act 34 of 2005 (NCR) Framework</span>
                </div>
                <p className="text-gray-300 leading-relaxed">
                  In a pawn loan, the customer remains the legal owner of the item. You lend immediate cash in exchange for holding the collateral in your secure vault. Under South African law, monthly interest is strictly capped at <strong>5.00%</strong>. An administration and insured storage fee (typically 5%–10%) can be legally added for vault custody.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Setting 1: Monthly Interest Rate */}
                <div className="p-4 rounded-2xl bg-[#1E1E1E] border border-[#2E2E2E] space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-white block">
                      Monthly Interest Rate (%)
                    </label>
                    <span className="text-xs font-mono font-bold text-[#E87A5D]">
                      {(formRules.pawnMonthlyInterestRate * 100).toFixed(1)}% / mo
                    </span>
                  </div>

                  <p className="text-[11px] text-gray-400">
                    Statutory maximum permitted by South African NCR is 5.0%.
                  </p>

                  <div className="flex items-center gap-2">
                    {[0.03, 0.04, 0.05].map(rate => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => setFormRules(prev => ({ ...prev, pawnMonthlyInterestRate: rate }))}
                        className={`flex-1 py-2 rounded-xl text-xs font-mono font-bold border transition ${
                          formRules.pawnMonthlyInterestRate === rate
                            ? 'bg-[#C85A32]/25 border-[#C85A32] text-white'
                            : 'bg-[#141414] border-[#2A2A2A] text-gray-400 hover:text-white'
                        }`}
                      >
                        {(rate * 100).toFixed(0)}%{rate === 0.05 && ' (NCR MAX)'}
                      </button>
                    ))}
                  </div>

                  <input
                    type="range"
                    min="0.01"
                    max="0.05"
                    step="0.005"
                    value={formRules.pawnMonthlyInterestRate}
                    onChange={(e) => setFormRules(prev => ({ ...prev, pawnMonthlyInterestRate: Number(e.target.value) }))}
                    className="w-full accent-[#C85A32]"
                  />
                </div>

                {/* Setting 2: Monthly Storage & Admin Fee */}
                <div className="p-4 rounded-2xl bg-[#1E1E1E] border border-[#2E2E2E] space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-white block">
                      Storage &amp; Vault Admin Fee (%)
                    </label>
                    <span className="text-xs font-mono font-bold text-amber-400">
                      {(formRules.pawnStorageAdminFeeRate * 100).toFixed(1)}% / mo
                    </span>
                  </div>

                  <p className="text-[11px] text-gray-400">
                    Covers insured vault custody, fire/theft risk, and bin tag overhead.
                  </p>

                  <div className="flex items-center gap-2">
                    {[0.05, 0.08, 0.10, 0.12].map(rate => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => setFormRules(prev => ({ ...prev, pawnStorageAdminFeeRate: rate }))}
                        className={`flex-1 py-2 rounded-xl text-xs font-mono font-bold border transition ${
                          formRules.pawnStorageAdminFeeRate === rate
                            ? 'bg-amber-500/25 border-amber-500 text-white'
                            : 'bg-[#141414] border-[#2A2A2A] text-gray-400 hover:text-white'
                        }`}
                      >
                        {(rate * 100).toFixed(0)}%{rate === 0.08 && ' (Std)'}
                      </button>
                    ))}
                  </div>

                  <input
                    type="range"
                    min="0.03"
                    max="0.15"
                    step="0.01"
                    value={formRules.pawnStorageAdminFeeRate}
                    onChange={(e) => setFormRules(prev => ({ ...prev, pawnStorageAdminFeeRate: Number(e.target.value) }))}
                    className="w-full accent-amber-500"
                  />
                </div>

                {/* Setting 3: Default Loan Term (Days) */}
                <div className="p-4 rounded-2xl bg-[#1E1E1E] border border-[#2E2E2E] space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-white block">
                      Default Loan Agreement Term
                    </label>
                    <span className="text-xs font-mono font-bold text-blue-400">
                      {formRules.defaultLoanTermDays} Days
                    </span>
                  </div>

                  <p className="text-[11px] text-gray-400">
                    Calendar duration before loan matures and interest/settlement is required.
                  </p>

                  <div className="grid grid-cols-4 gap-2">
                    {[14, 30, 60, 90].map(days => (
                      <button
                        key={days}
                        type="button"
                        onClick={() => setFormRules(prev => ({ ...prev, defaultLoanTermDays: days }))}
                        className={`py-2 rounded-xl text-xs font-mono font-bold border transition ${
                          formRules.defaultLoanTermDays === days
                            ? 'bg-blue-500/25 border-blue-500 text-white'
                            : 'bg-[#141414] border-[#2A2A2A] text-gray-400 hover:text-white'
                        }`}
                      >
                        {days}d{days === 30 && ' (Std)'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Setting 4: Grace Period Before Forfeiture */}
                <div className="p-4 rounded-2xl bg-[#1E1E1E] border border-[#2E2E2E] space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-white block">
                      Post-Maturity Grace Period
                    </label>
                    <span className="text-xs font-mono font-bold text-purple-400">
                      {formRules.gracePeriodDays} Days
                    </span>
                  </div>

                  <p className="text-[11px] text-gray-400">
                    Days given to customer after maturity before item is defaulted to retail floor.
                  </p>

                  <div className="grid grid-cols-4 gap-2">
                    {[3, 7, 14, 30].map(days => (
                      <button
                        key={days}
                        type="button"
                        onClick={() => setFormRules(prev => ({ ...prev, gracePeriodDays: days }))}
                        className={`py-2 rounded-xl text-xs font-mono font-bold border transition ${
                          formRules.gracePeriodDays === days
                            ? 'bg-purple-500/25 border-purple-500 text-white'
                            : 'bg-[#141414] border-[#2A2A2A] text-gray-400 hover:text-white'
                        }`}
                      >
                        {days}d{days === 7 && ' (Std)'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* LIVE INTERACTIVE PAWN SANDBOX */}
              <div className="p-5 rounded-2xl bg-[#141414] border border-[#2E2E2E] space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[#282828] pb-3">
                  <div>
                    <span className="text-[10px] text-amber-400 uppercase font-mono font-bold block">
                      Live Simulation Sandbox
                    </span>
                    <h4 className="text-xs font-bold text-white">
                      Test Sample Pawn Loan Calculation
                    </h4>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">Loan Principal:</span>
                    <div className="relative w-28">
                      <span className="absolute left-2.5 top-2 text-xs text-gray-500 font-mono">R</span>
                      <input
                        type="number"
                        value={samplePawnAmount}
                        onChange={(e) => setSamplePawnAmount(Math.max(100, Number(e.target.value)))}
                        className="w-full bg-[#1E1E1E] border border-[#2A2A2A] rounded-lg pl-6 pr-2 py-1.5 text-xs font-mono font-bold text-white text-right focus:outline-none focus:border-[#C85A32]"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl bg-[#1C1C1C] border border-[#282828]">
                    <span className="text-[10px] text-gray-400 font-mono block">Cash Handed to Client</span>
                    <span className="text-sm font-mono font-bold text-white">R {samplePawnAmount.toFixed(2)}</span>
                  </div>

                  <div className="p-3 rounded-xl bg-[#1C1C1C] border border-[#282828]">
                    <span className="text-[10px] text-gray-400 font-mono block">
                      Monthly Interest ({(formRules.pawnMonthlyInterestRate * 100).toFixed(1)}%)
                    </span>
                    <span className="text-sm font-mono font-bold text-amber-400">R {pawnSim.interest.toFixed(2)}</span>
                  </div>

                  <div className="p-3 rounded-xl bg-[#1C1C1C] border border-[#282828]">
                    <span className="text-[10px] text-gray-400 font-mono block">
                      Storage &amp; Vault ({(formRules.pawnStorageAdminFeeRate * 100).toFixed(1)}%)
                    </span>
                    <span className="text-sm font-mono font-bold text-amber-400">R {pawnSim.storage.toFixed(2)}</span>
                  </div>

                  <div className="p-3 rounded-xl bg-[#291813] border border-[#C85A32]/50">
                    <span className="text-[10px] text-gray-300 font-mono block">Client Redemption Due</span>
                    <span className="text-base font-mono font-bold text-[#E87A5D]">R {pawnSim.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ------------------------------------------------------------
              TAB 2: OUTRIGHT BUYS (RETAIL MARGIN)
             ------------------------------------------------------------ */}
          {activeTab === 'buy' && (
            <div className="space-y-6">
              {/* Plain English Banner */}
              <div className="p-4 rounded-2xl bg-[#142319] border border-emerald-500/40 text-xs space-y-1.5">
                <div className="flex items-center gap-2 text-emerald-400 font-bold">
                  <Scale className="w-4 h-4" />
                  <span>SAPS Second-Hand Goods Act 06 of 2009 (SHG) Framework</span>
                </div>
                <p className="text-gray-300 leading-relaxed">
                  In an outright purchase, the customer permanently sells the item to your store. You log their ID and serial number into SAPS Form 21, pay them cash, and the item becomes your retail inventory immediately. Your profit comes from the <strong>resale margin</strong> on the showroom floor.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Setting 1: Default Retail Markup Multiplier */}
                <div className="p-4 rounded-2xl bg-[#1E1E1E] border border-[#2E2E2E] space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-white block">
                      Target Retail Floor Markup
                    </label>
                    <span className="text-xs font-mono font-bold text-emerald-400">
                      {formRules.defaultRetailMarkupMultiplier}x (+{Math.round((formRules.defaultRetailMarkupMultiplier - 1) * 100)}%)
                    </span>
                  </div>

                  <p className="text-[11px] text-gray-400">
                    Multiplier applied to your cash purchase offer to generate the retail shelf sticker price.
                  </p>

                  <div className="grid grid-cols-5 gap-1.5">
                    {[
                      { mult: 1.5, label: '+50%' },
                      { mult: 1.75, label: '+75%' },
                      { mult: 1.8, label: '+80%' },
                      { mult: 2.0, label: '2.0x' },
                      { mult: 2.5, label: '2.5x' }
                    ].map(p => (
                      <button
                        key={p.mult}
                        type="button"
                        onClick={() => setFormRules(prev => ({ ...prev, defaultRetailMarkupMultiplier: p.mult }))}
                        className={`py-2 rounded-xl text-[11px] font-mono font-bold border transition ${
                          formRules.defaultRetailMarkupMultiplier === p.mult
                            ? 'bg-emerald-500/25 border-emerald-500 text-white'
                            : 'bg-[#141414] border-[#2A2A2A] text-gray-400 hover:text-white'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  <input
                    type="range"
                    min="1.2"
                    max="3.0"
                    step="0.05"
                    value={formRules.defaultRetailMarkupMultiplier}
                    onChange={(e) => setFormRules(prev => ({ ...prev, defaultRetailMarkupMultiplier: Number(e.target.value) }))}
                    className="w-full accent-emerald-500"
                  />
                </div>

                {/* Setting 2: Price Rounding Formula */}
                <div className="p-4 rounded-2xl bg-[#1E1E1E] border border-[#2E2E2E] space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-white block">
                      Price Tag Rounding Rule
                    </label>
                    <span className="text-xs font-mono font-bold text-cyan-400">
                      {formRules.retailRoundingMode}
                    </span>
                  </div>

                  <p className="text-[11px] text-gray-400">
                    Prevents awkward odd cents on display stickers.
                  </p>

                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { mode: 'nearest10', name: 'Nearest R10', eg: 'R1,800' },
                      { mode: 'charm99', name: 'Charm R99', eg: 'R1,799' },
                      { mode: 'charm9', name: 'Charm R9', eg: 'R1,829' },
                      { mode: 'exact', name: 'Exact (Cents)', eg: 'R1,824.50' }
                    ].map(r => (
                      <button
                        key={r.mode}
                        type="button"
                        onClick={() => setFormRules(prev => ({ ...prev, retailRoundingMode: r.mode as RetailRoundingMode }))}
                        className={`p-2.5 rounded-xl text-left border transition ${
                          formRules.retailRoundingMode === r.mode
                            ? 'bg-cyan-500/20 border-cyan-500 text-white'
                            : 'bg-[#141414] border-[#2A2A2A] text-gray-400 hover:text-white'
                        }`}
                      >
                        <div className="text-xs font-bold">{r.name}</div>
                        <div className="text-[10px] text-gray-400 font-mono">e.g. {r.eg}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Setting 3: Store Warranty Period */}
                <div className="p-4 rounded-2xl bg-[#1E1E1E] border border-[#2E2E2E] space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-white block">
                      Second-Hand Store Test Warranty
                    </label>
                    <span className="text-xs font-mono font-bold text-emerald-400">
                      {formRules.storeWarrantyDays} Days
                    </span>
                  </div>

                  <p className="text-[11px] text-gray-400">
                    Printed on the buyer's receipt and thermal price sticker.
                  </p>

                  <div className="grid grid-cols-4 gap-2">
                    {[7, 14, 30, 60].map(days => (
                      <button
                        key={days}
                        type="button"
                        onClick={() => setFormRules(prev => ({
                          ...prev,
                          storeWarrantyDays: days,
                          warrantyDescription: `${days}-Day Store Test Warranty`
                        }))}
                        className={`py-2 rounded-xl text-xs font-mono font-bold border transition ${
                          formRules.storeWarrantyDays === days
                            ? 'bg-emerald-500/25 border-emerald-500 text-white'
                            : 'bg-[#141414] border-[#2A2A2A] text-gray-400 hover:text-white'
                        }`}
                      >
                        {days} Days
                      </button>
                    ))}
                  </div>
                </div>

                {/* Setting 4: Warranty Label Custom Text */}
                <div className="p-4 rounded-2xl bg-[#1E1E1E] border border-[#2E2E2E] space-y-3">
                  <label className="text-xs font-bold text-white block">
                    Tag Warranty Description Line
                  </label>

                  <input
                    type="text"
                    value={formRules.warrantyDescription}
                    onChange={(e) => setFormRules(prev => ({ ...prev, warrantyDescription: e.target.value }))}
                    className="w-full bg-[#141414] border border-[#2A2A2A] rounded-xl px-3 py-2 text-xs font-medium text-white focus:outline-none focus:border-emerald-500"
                    placeholder="e.g. 7-Day Store Test Warranty"
                  />
                  <p className="text-[10px] text-gray-500">
                    Appears directly on Zebra Direct Thermal barcodes.
                  </p>
                </div>

                {/* Setting 5: Market Intelligence Acquisition Target Margin */}
                <div className="p-4 rounded-2xl bg-[#1E1E1E] border border-[#2E2E2E] space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-white block">
                      Market Intelligence Acquisition Target Margin
                    </label>
                    <span className="text-xs font-mono font-bold text-[#E87A5D]">
                      {formRules.targetMarginPercent || 35}% Target Margin
                    </span>
                  </div>

                  <p className="text-[11px] text-gray-400">
                    Owner pricing rule for calculating suggested buy acquisition range.
                  </p>

                  <div className="grid grid-cols-3 gap-2">
                    {[25, 35, 45].map(pct => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => setFormRules(prev => ({ ...prev, targetMarginPercent: pct }))}
                        className={`py-2 rounded-xl text-xs font-mono font-bold border transition ${
                          (formRules.targetMarginPercent || 35) === pct
                            ? 'bg-[#C85A32]/25 border-[#C85A32] text-white'
                            : 'bg-[#141414] border-[#2A2A2A] text-gray-400 hover:text-white'
                        }`}
                      >
                        {pct}% Target
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* LIVE INTERACTIVE BUY SANDBOX */}
              <div className="p-5 rounded-2xl bg-[#141414] border border-[#2E2E2E] space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[#282828] pb-3">
                  <div>
                    <span className="text-[10px] text-emerald-400 uppercase font-mono font-bold block">
                      Live Simulation Sandbox
                    </span>
                    <h4 className="text-xs font-bold text-white">
                      Test Sample Outright Buy Resale Yield
                    </h4>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">Purchase Payout:</span>
                    <div className="relative w-28">
                      <span className="absolute left-2.5 top-2 text-xs text-gray-500 font-mono">R</span>
                      <input
                        type="number"
                        value={sampleBuyAmount}
                        onChange={(e) => setSampleBuyAmount(Math.max(100, Number(e.target.value)))}
                        className="w-full bg-[#1E1E1E] border border-[#2A2A2A] rounded-lg pl-6 pr-2 py-1.5 text-xs font-mono font-bold text-white text-right focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl bg-[#1C1C1C] border border-[#282828]">
                    <span className="text-[10px] text-gray-400 font-mono block">Cost of Goods (Paid)</span>
                    <span className="text-sm font-mono font-bold text-white">R {sampleBuyAmount.toFixed(2)}</span>
                  </div>

                  <div className="p-3 rounded-xl bg-[#142319] border border-emerald-500/40">
                    <span className="text-[10px] text-emerald-400 font-mono block">Floor Retail Price</span>
                    <span className="text-base font-mono font-bold text-emerald-400">R {buySim.retailPrice.toFixed(2)}</span>
                  </div>

                  <div className="p-3 rounded-xl bg-[#1C1C1C] border border-[#282828]">
                    <span className="text-[10px] text-gray-400 font-mono block">Projected Cash Profit</span>
                    <span className="text-sm font-mono font-bold text-emerald-400">+R {buySim.profit.toFixed(2)}</span>
                  </div>

                  <div className="p-3 rounded-xl bg-[#1C1C1C] border border-[#282828]">
                    <span className="text-[10px] text-gray-400 font-mono block">Gross Margin Yield</span>
                    <span className="text-sm font-mono font-bold text-cyan-400">+{buySim.marginPct}%</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ------------------------------------------------------------
              TAB 3: INTAKE & HARDWARE DEFAULTS
             ------------------------------------------------------------ */}
          {activeTab === 'workflow' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Default Intake Mode */}
                <div className="p-4 rounded-2xl bg-[#1E1E1E] border border-[#2E2E2E] space-y-3">
                  <label className="text-xs font-bold text-white block">
                    Default Desk Intake Workflow
                  </label>
                  <p className="text-[11px] text-gray-400">
                    Which transaction model opens automatically at the intake counter.
                  </p>

                  <div className="space-y-2">
                    {[
                      { id: 'prompt', label: 'Prompt Cashier Every Time', desc: 'Forces deliberate selection of Pawn vs Buy' },
                      { id: 'pawn', label: 'Default to 30-Day Pawn', desc: 'Pre-selects NCR loan flow for rapid ticket generation' },
                      { id: 'buy', label: 'Default to Outright Buy', desc: 'Pre-selects inventory acquisition flow' }
                    ].map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setFormRules(prev => ({ ...prev, defaultIntakeType: opt.id as any }))}
                        className={`w-full p-3 rounded-xl text-left border transition flex items-start gap-3 ${
                          formRules.defaultIntakeType === opt.id
                            ? 'bg-[#C85A32]/20 border-[#C85A32] text-white'
                            : 'bg-[#141414] border-[#2A2A2A] text-gray-400 hover:text-white'
                        }`}
                      >
                        <div className="mt-0.5">
                          {formRules.defaultIntakeType === opt.id ? (
                            <CheckCircle2 className="w-4 h-4 text-[#E87A5D]" />
                          ) : (
                            <div className="w-4 h-4 rounded-full border border-gray-600" />
                          )}
                        </div>
                        <div>
                          <div className="text-xs font-bold">{opt.label}</div>
                          <div className="text-[10px] text-gray-400 mt-0.5">{opt.desc}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Hardware & Vault defaults */}
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-[#1E1E1E] border border-[#2E2E2E] space-y-3">
                    <label className="text-xs font-bold text-white block">
                      Default Vault Holding Bin
                    </label>
                    <input
                      type="text"
                      value={formRules.defaultVaultShelf}
                      onChange={(e) => setFormRules(prev => ({ ...prev, defaultVaultShelf: e.target.value }))}
                      className="w-full bg-[#141414] border border-[#2A2A2A] rounded-xl px-3 py-2 text-xs font-medium text-white focus:outline-none focus:border-[#C85A32]"
                      placeholder="e.g. Shelf A-04"
                    />
                    <p className="text-[10px] text-gray-500">
                      Pre-fills collateral physical location in the secure vault.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#1E1E1E] border border-[#2E2E2E] space-y-3">
                    <label className="text-xs font-bold text-white block">
                      Default Attending Officer Name
                    </label>
                    <input
                      type="text"
                      value={formRules.defaultCashierName}
                      onChange={(e) => setFormRules(prev => ({ ...prev, defaultCashierName: e.target.value }))}
                      className="w-full bg-[#141414] border border-[#2A2A2A] rounded-xl px-3 py-2 text-xs font-medium text-white focus:outline-none focus:border-[#C85A32]"
                      placeholder="e.g. Officer Thabo Sithole"
                    />
                    <p className="text-[10px] text-gray-500">
                      Logged automatically into SAPS Form 21 inspector audit trail.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ------------------------------------------------------------
              TAB 4: SIMPLE GUIDE: PAWN VS BUY
             ------------------------------------------------------------ */}
          {activeTab === 'guide' && (
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-[#1E1E1E] border border-[#2E2E2E]">
                <h3 className="text-sm font-bold text-white mb-2">
                  At-A-Glance Guide for Cashiers &amp; Shop Managers
                </h3>
                <p className="text-xs text-gray-400">
                  Keep this cheat-sheet handy to explain the transaction difference to customers clearly over the counter.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Pawn Card */}
                <div className="p-5 rounded-2xl bg-[#231713] border border-[#C85A32]/40 space-y-3">
                  <div className="flex items-center gap-2 text-[#E87A5D] font-bold">
                    <History className="w-5 h-5" />
                    <span className="text-sm">30-Day Pawn Loan</span>
                  </div>

                  <ul className="space-y-2 text-gray-300">
                    <li className="flex items-start gap-2">
                      <span className="text-[#C85A32] font-bold">•</span>
                      <span><strong>Ownership:</strong> Remains with customer (pledgor). You hold it as security.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[#C85A32] font-bold">•</span>
                      <span><strong>What they get:</strong> Cash loan based on asset resale liquidation value.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[#C85A32] font-bold">•</span>
                      <span><strong>What they pay back:</strong> Principal + 5% Interest + 8% Insured Storage.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[#C85A32] font-bold">•</span>
                      <span><strong>Maturity:</strong> 30 calendar days (renewable by paying interest fee).</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[#C85A32] font-bold">•</span>
                      <span><strong>If unpaid:</strong> Defaults after grace period into store retail inventory.</span>
                    </li>
                  </ul>
                </div>

                {/* Buy Card */}
                <div className="p-5 rounded-2xl bg-[#142319] border border-emerald-500/40 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold">
                    <ShoppingBag className="w-5 h-5" />
                    <span className="text-sm">Outright Store Buy</span>
                  </div>

                  <ul className="space-y-2 text-gray-300">
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-400 font-bold">•</span>
                      <span><strong>Ownership:</strong> Transferred permanently to your shop immediately.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-400 font-bold">•</span>
                      <span><strong>What they get:</strong> Immediate purchase cash payout (higher than loan).</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-400 font-bold">•</span>
                      <span><strong>What they pay back:</strong> Nothing. The deal is complete upon signature.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-400 font-bold">•</span>
                      <span><strong>Where it goes:</strong> Tagged with Zebra barcode and placed on sales floor.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-400 font-bold">•</span>
                      <span><strong>Store Profit:</strong> Full markup margin (typically +50% to +100%).</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ============================================================
            FOOTER ACTIONS
           ============================================================ */}
        <div className="px-6 py-4 bg-[#1F1F1F] border-t border-[#2E2E2E] flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={() => {
              setFormRules(businessRules);
              showToast('Reset Changes', 'Restored currently saved store rules', 'info');
            }}
            className="px-4 py-2 rounded-xl bg-[#141414] hover:bg-[#2A2A2A] border border-[#2A2A2A] text-gray-400 hover:text-white text-xs font-medium transition flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset to Current</span>
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsRulesModalOpen(false)}
              className="px-5 py-2.5 rounded-xl bg-[#252525] hover:bg-[#303030] text-gray-300 hover:text-white text-xs font-semibold transition"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSaveAll}
              className="px-6 py-2.5 rounded-xl bg-[#C85A32] hover:bg-[#B34D28] text-white text-xs font-bold transition shadow-lg shadow-[#C85A32]/20 flex items-center gap-2 active:scale-[0.98]"
            >
              <Save className="w-4 h-4" />
              <span>Save &amp; Apply Rules</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
