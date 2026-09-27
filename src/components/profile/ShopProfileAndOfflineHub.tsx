import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Building2, 
  HardDrive, 
  Download, 
  Upload, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  Check, 
  X, 
  Edit3, 
  Save, 
  Wifi, 
  WifiOff, 
  Database,
  Info,
  Sliders,
  Scale,
  History,
  ShoppingBag,
  ImageIcon,
  Loader2
} from 'lucide-react';
import { useApp, ShopProfile } from '../../context/AppContext';
import { BusinessRules } from '../../types';

export const ShopProfileAndOfflineHub: React.FC = () => {
  const {
    shopProfile,
    updateShopProfile,
    isOnline,
    isSlowSyncing,
    pendingSyncCount,
    failedSyncCount = 0,
    hasDeterministicError = false,
    hasTransientError = false,
    slowSyncProgress,
    triggerManualSlowSync,
    exportDeviceBackup,
    restoreDeviceBackup,
    deviceStorageStats,
    showToast,
    businessRules,
    updateBusinessRules,
    isRulesModalOpen,
    setIsRulesModalOpen
  } = useApp();

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState<ShopProfile>(shopProfile);
  const [rulesForm, setRulesForm] = useState<BusinessRules>(businessRules);
  const [isRestoring, setIsRestoring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    try {
      await updateShopProfile(profileForm);
      setIsEditingProfile(false);
    } catch (err: any) {
      showToast('Error', err?.message || 'Failed to save store profile', 'error');
    } finally {
      setIsSavingProfile(false);
    }
  };
  
  useEffect(() => {
    if (isRulesModalOpen) {
      setRulesForm(businessRules);
    }
  }, [isRulesModalOpen, businessRules]);

  const handleSaveRules = (e: React.FormEvent) => {
    e.preventDefault();
    updateBusinessRules(rulesForm);
    setIsRulesModalOpen(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsRestoring(true);
    try {
      const text = await file.text();
      await restoreDeviceBackup(text);
    } catch (err: any) {
      showToast('File Read Error', err?.message || 'Invalid backup file', 'error');
    } finally {
      setIsRestoring(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-8 text-stone-900">
      {/* 1. STORE PROFILE & STATUTORY COMPLIANCE CARD */}
      <div className="bg-white border border-stone-200 rounded-[2.5rem] p-8 lg:p-10 space-y-6 shadow-xs relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-stone-100">
          <div className="flex items-center gap-4">
            <div className="p-3.5 bg-[#C85A32]/10 rounded-2xl border border-[#C85A32]/20">
              <Building2 className="w-6 h-6 text-[#C85A32]" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-black text-stone-900 font-headline tracking-tight">
                  {shopProfile.shop_name}
                </h2>
                <span className="text-[10px] font-mono font-black uppercase px-2.5 py-0.5 rounded-lg bg-[#C85A32]/10 text-[#C85A32] border border-[#C85A32]/20">
                  {shopProfile.shop_code}
                </span>
              </div>
              <p className="text-xs text-stone-500 mt-0.5">{shopProfile.trading_name}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => {
                setProfileForm(shopProfile);
                setIsEditingProfile(true);
              }}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-[#C85A32] hover:bg-[#B84E27] text-white rounded-xl text-xs font-bold transition shadow-md shadow-[#C85A32]/20 cursor-pointer"
            >
              <Edit3 className="w-4 h-4" />
              <span>Edit Store Info</span>
            </button>
          </div>
        </div>

        {/* COMPLIANCE & LEGAL DETAILS GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200">
            <p className="text-[10px] font-black uppercase tracking-wider text-stone-400">SAPS Dealer License</p>
            <p className="text-xs font-mono font-bold text-emerald-600 mt-1">{shopProfile.saps_dealer_license || 'Not Configured'}</p>
            <p className="text-[9px] text-stone-400 mt-0.5">Second-Hand Goods Act 06 of 2009</p>
          </div>

          <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200">
            <p className="text-[10px] font-black uppercase tracking-wider text-stone-400">SARS VAT Number</p>
            <p className="text-xs font-mono font-bold text-stone-800 mt-1">{shopProfile.vat_number || 'Not Configured'}</p>
            <p className="text-[9px] text-stone-400 mt-0.5">15% Standard Rate Applied</p>
          </div>

          <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200">
            <p className="text-[10px] font-black uppercase tracking-wider text-stone-400">CIPC Registration</p>
            <p className="text-xs font-mono font-bold text-stone-800 mt-1">{shopProfile.registration_number || 'Not Configured'}</p>
            <p className="text-[9px] text-stone-400 mt-0.5">Enterprise Registry Verified</p>
          </div>

          <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 sm:col-span-2">
            <p className="text-[10px] font-black uppercase tracking-wider text-stone-400">Physical Branch Address</p>
            <p className="text-xs font-medium text-stone-700 mt-1">{shopProfile.address}, {shopProfile.city}, {shopProfile.province} {shopProfile.postal_code}</p>
          </div>

          <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200">
            <p className="text-[10px] font-black uppercase tracking-wider text-stone-400">Direct Branch Line</p>
            <p className="text-xs font-mono font-bold text-stone-800 mt-1">{shopProfile.phone}</p>
            <p className="text-[9px] text-stone-400 mt-0.5">{shopProfile.email}</p>
          </div>
        </div>
      </div>

      {/* 2. CUSTOMIZABLE DEAL RULES & PRICING CONFIGURATION CARD */}
      <div className="bg-white border border-stone-200 rounded-[2.5rem] p-8 lg:p-10 space-y-6 shadow-xs relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-stone-100">
          <div className="flex items-center gap-4">
            <div className="p-3.5 bg-[#C85A32]/10 rounded-2xl border border-[#C85A32]/20 text-[#C85A32]">
              <Sliders className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-black text-stone-900 font-headline tracking-tight">
                  Store Deal Rules &amp; Margins Configurator
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Customizable
                </span>
              </div>
              <p className="text-xs text-stone-500 mt-0.5">
                Regulate statutory NCR 30-day pawn caps, outright retail markup multipliers, and rounding modes.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsRulesModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#C85A32] hover:bg-[#B84E27] text-white text-xs font-bold transition shadow-md shadow-[#C85A32]/20 active:scale-[0.98] cursor-pointer"
          >
            <Sliders className="w-4 h-4" />
            <span>Open Deal Rules Configurator</span>
          </button>
        </div>

        {/* Live Active Rules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Pawn Rules Summary */}
          <div className="p-5 rounded-2xl bg-orange-50/30 border border-[#C85A32]/20 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#C85A32] font-bold text-xs">
                <History className="w-4 h-4" />
                <span>30-Day Pawn Loans (NCR Act 34 of 2005)</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-mono">
                Regulated
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-white border border-stone-200">
                <span className="text-[10px] text-stone-400 uppercase font-mono block">Monthly Interest</span>
                <span className="font-mono font-bold text-stone-800 text-sm">
                  {(businessRules.pawnMonthlyInterestRate * 100).toFixed(1)}%
                </span>
                <span className="text-[9px] text-stone-400 block">NCR Legal Cap: 5.0%</span>
              </div>

              <div className="p-3 rounded-xl bg-white border border-stone-200">
                <span className="text-[10px] text-stone-400 uppercase font-mono block">Vault Storage Fee</span>
                <span className="font-mono font-bold text-amber-600 text-sm">
                  {(businessRules.pawnStorageAdminFeeRate * 100).toFixed(1)}%
                </span>
                <span className="text-[9px] text-stone-400 block">Insured Vault Custody</span>
              </div>

              <div className="p-3 rounded-xl bg-white border border-stone-200">
                <span className="text-[10px] text-stone-400 uppercase font-mono block">Agreement Term</span>
                <span className="font-mono font-bold text-stone-800 text-sm">
                  {businessRules.defaultLoanTermDays} Days
                </span>
                <span className="text-[9px] text-stone-400 block">Maturity Window</span>
              </div>

              <div className="p-3 rounded-xl bg-white border border-stone-200">
                <span className="text-[10px] text-stone-400 uppercase font-mono block">Grace Period</span>
                <span className="font-mono font-bold text-purple-600 text-sm">
                  {businessRules.gracePeriodDays} Days
                </span>
                <span className="text-[9px] text-stone-400 block">Before Retail Default</span>
              </div>
            </div>
          </div>

          {/* Outright Buy Rules Summary */}
          <div className="p-5 rounded-2xl bg-emerald-50/20 border border-emerald-500/20 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs">
                <ShoppingBag className="w-4 h-4" />
                <span>Outright Buys (SAPS Second-Hand Goods)</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
                Commercial Retail
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-white border border-stone-200">
                <span className="text-[10px] text-stone-400 uppercase font-mono block">Floor Markup</span>
                <span className="font-mono font-bold text-emerald-600 text-sm">
                  {businessRules.defaultRetailMarkupMultiplier}x
                </span>
                <span className="text-[9px] text-stone-400 block">
                  +{Math.round((businessRules.defaultRetailMarkupMultiplier - 1) * 100)}% Resale Margin
                </span>
              </div>

              <div className="p-3 rounded-xl bg-white border border-stone-200">
                <span className="text-[10px] text-stone-400 uppercase font-mono block">Price Tag Rounding</span>
                <span className="font-mono font-bold text-cyan-600 text-sm">
                  {businessRules.retailRoundingMode}
                </span>
                <span className="text-[9px] text-stone-400 block">Sticker Cash Formatting</span>
              </div>

              <div className="p-3 rounded-xl bg-white border border-stone-200">
                <span className="text-[10px] text-stone-400 uppercase font-mono block">Store Test Warranty</span>
                <span className="font-mono font-bold text-stone-800 text-sm">
                  {businessRules.storeWarrantyDays} Days
                </span>
                <span className="text-[9px] text-stone-400 block">{businessRules.warrantyDescription}</span>
              </div>

              <div className="p-3 rounded-xl bg-white border border-stone-200">
                <span className="text-[10px] text-stone-400 uppercase font-mono block">Default Holding Bin</span>
                <span className="font-mono font-bold text-stone-800 text-sm">
                  {businessRules.defaultVaultShelf}
                </span>
                <span className="text-[9px] text-stone-400 block">Intake Location</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. WHATSAPP-STYLE LOCAL DEVICE PERSISTENCE & TRICKLE SYNC CARD */}
      <div className="bg-white border border-stone-200 rounded-[2.5rem] p-8 lg:p-10 space-y-6 shadow-xs relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-stone-100">
          <div className="flex items-center gap-4">
            <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200">
              <HardDrive className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-black text-stone-900 font-headline tracking-tight">
                  WhatsApp-Style Local Device Storage
                </h2>
                {isOnline ? (
                  <span className="flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <Wifi className="w-3 h-3" /> Online
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                    <WifiOff className="w-3 h-3" /> Offline Mode
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-500 mt-0.5">
                All data is stored permanently on this device. Syncing never deletes or purges your local database.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={triggerManualSlowSync}
              disabled={isSlowSyncing}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                isSlowSyncing 
                  ? 'bg-blue-50 text-blue-700 border-blue-200 animate-pulse' 
                  : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200'
              }`}
              title="Trickles pending offline records slowly to Supabase (1 item/sec) to save bandwidth egress"
            >
              <RefreshCw className={`w-4 h-4 text-cyan-600 ${isSlowSyncing ? 'animate-spin' : ''}`} />
              <span>{isSlowSyncing ? 'Slow Syncing...' : 'Trickle Sync Now'}</span>
            </button>
          </div>
        </div>

        {/* SLOW SYNC ACTIVE PROGRESS BANNER */}
        {isSlowSyncing && slowSyncProgress && (
          <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100 text-blue-800 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold">
              <span>Trickle Syncing ({slowSyncProgress.current} of {slowSyncProgress.total})</span>
              <span className="font-mono">{slowSyncProgress.entityName}</span>
            </div>
            <div className="w-full h-1.5 bg-blue-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-600 transition-all duration-300"
                style={{ width: `${Math.round((slowSyncProgress.current / slowSyncProgress.total) * 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-blue-500/80">
              Pacing requests at 1.2s intervals to preserve Supabase Free Tier egress and prevent network timeouts.
            </p>
          </div>
        )}

        {/* DEVICE STORAGE METRICS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200">
            <p className="text-[10px] font-black uppercase tracking-wider text-stone-400">Local Inventory</p>
            <p className="text-2xl font-black text-stone-900 font-headline mt-1">{deviceStorageStats.totalItems}</p>
            <p className="text-[9px] text-emerald-600 mt-1 font-semibold">Permanent on disk</p>
          </div>

          <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200">
            <p className="text-[10px] font-black uppercase tracking-wider text-stone-400">Local Receipts</p>
            <p className="text-2xl font-black text-stone-900 font-headline mt-1">{deviceStorageStats.totalSales}</p>
            <p className="text-[9px] text-emerald-600 mt-1 font-semibold">Stored offline</p>
          </div>

          <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200">
            <p className="text-[10px] font-black uppercase tracking-wider text-stone-400">Device Quota Used</p>
            <p className="text-2xl font-black text-stone-900 font-headline mt-1">~{deviceStorageStats.estimatedLocalSizeKb} KB</p>
            <p className="text-[9px] text-stone-400 mt-1">IndexedDB + Cache</p>
          </div>

          <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200">
            <p className="text-[10px] font-black uppercase tracking-wider text-stone-400">Sync Status</p>
            <div className="flex flex-col gap-1 mt-1.5">
              <div className="flex items-baseline gap-2">
                <p className="text-xl font-black text-stone-900 font-headline">
                  {pendingSyncCount > 0 ? `${pendingSyncCount} Pending` : failedSyncCount > 0 ? `${failedSyncCount} Blocked` : 'Synced'}
                </p>
                {isSlowSyncing ? (
                  <span className="text-[9px] text-cyan-700 font-bold px-1.5 py-0.5 rounded bg-cyan-50 border border-cyan-200">Syncing</span>
                ) : pendingSyncCount > 0 ? (
                  <span className="text-[9px] text-amber-700 font-bold px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200">Waiting</span>
                ) : failedSyncCount === 0 ? (
                  <span className="text-[9px] text-emerald-700 font-bold px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200">Synced</span>
                ) : null}
              </div>
              
              {hasDeterministicError && (
                <p className="text-[10px] text-rose-600 font-medium leading-tight mt-0.5">⚠️ Needs attention / blocked (Invalid ID/Data)</p>
              )}
              {hasTransientError && (
                <p className="text-[10px] text-amber-600 font-medium leading-tight mt-0.5">🔄 Retryable network failure</p>
              )}
              {!hasDeterministicError && !hasTransientError && pendingSyncCount === 0 && failedSyncCount === 0 && (
                <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">All records synced to cloud</p>
              )}
            </div>
          </div>
        </div>

        {/* WHATSAPP-STYLE BACKUP FILE ACTIONS */}
        <div className="pt-4 border-t border-stone-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-bold text-stone-700">WhatsApp-Style Physical File Backup</p>
            <p className="text-[11px] text-stone-500">
              Generates a standalone portable <code className="text-stone-600">.json</code> file on your computer/phone disk, completely independent of cloud or WiFi.
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-3">
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                accept=".json" 
                className="hidden" 
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isRestoring}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-stone-50 text-stone-700 rounded-xl text-xs font-bold border border-stone-200 transition cursor-pointer animate-none"
                title="Restore local database from a WhatsApp-style backup file"
              >
                {isRestoring ? (
                  <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 text-blue-600" />
                )}
                <span>{isRestoring ? 'Restoring backup…' : 'Restore from File'}</span>
              </button>

              <button
                onClick={exportDeviceBackup}
                disabled={isRestoring}
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-emerald-600/10 cursor-pointer"
                title="Download full point-in-time database snapshot directly to device storage"
              >
                <Download className="w-4 h-4" />
                <span>Download Device Backup File</span>
              </button>
            </div>
            {isRestoring && (
              <p className="text-[11px] text-blue-600 font-semibold animate-pulse">
                Restoring your local shop data… Please do not close this window.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* MODAL: DEAL RULES & PRICING CONFIGURATION */}
      <AnimatePresence>
        {isRulesModalOpen && (
          <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl bg-white border border-stone-200 rounded-3xl p-8 space-y-6 shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <div className="flex items-center justify-between pb-4 border-b border-stone-100">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-[#C85A32]/10 rounded-xl border border-[#C85A32]/20 text-[#C85A32]">
                    <Sliders className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-stone-900 font-headline">Deal Rules & Margins</h3>
                    <p className="text-xs text-stone-500">Configure interest rates, retail markups, and statutory terms</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsRulesModalOpen(false)}
                  className="p-2 text-stone-400 hover:text-stone-700 rounded-xl hover:bg-stone-50 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveRules} className="space-y-6">
                {/* Pawn Rules Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-[#C85A32] font-bold text-xs uppercase tracking-widest px-1">
                    <History className="w-4 h-4" />
                    <span>Pawn Loan Rules (NCR Regulated)</span>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-3">
                      <label className="text-[10px] font-bold text-stone-500 uppercase block">Monthly Interest Rate (%)</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          step="0.1"
                          value={rulesForm.pawnMonthlyInterestRate * 100}
                          onChange={e => setRulesForm({ ...rulesForm, pawnMonthlyInterestRate: parseFloat(e.target.value) / 100 })}
                          className="w-full bg-white border-b border-stone-200 py-1 text-stone-900 font-mono text-sm focus:border-[#C85A32] outline-none"
                        />
                        <span className="text-xs text-stone-400">%</span>
                      </div>
                      <p className="text-[9px] text-stone-400 italic">NCR statutory cap is 5.0% for first loans</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-3">
                      <label className="text-[10px] font-bold text-stone-400 uppercase block">Vault Storage Fee (%)</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          step="0.1"
                          value={rulesForm.pawnStorageAdminFeeRate * 100}
                          onChange={e => setRulesForm({ ...rulesForm, pawnStorageAdminFeeRate: parseFloat(e.target.value) / 100 })}
                          className="w-full bg-white border-b border-stone-200 py-1 text-stone-900 font-mono text-sm focus:border-[#C85A32] outline-none"
                        />
                        <span className="text-xs text-stone-400">%</span>
                      </div>
                      <p className="text-[9px] text-stone-400 italic">Covers insurance and high-security vaulting</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-3">
                      <label className="text-[10px] font-bold text-stone-400 uppercase block">Loan Duration (Days)</label>
                      <input
                        type="number"
                        value={rulesForm.defaultLoanTermDays}
                        onChange={e => setRulesForm({ ...rulesForm, defaultLoanTermDays: parseInt(e.target.value) })}
                        className="w-full bg-white border-b border-stone-200 py-1 text-stone-900 font-mono text-sm focus:border-[#C85A32] outline-none"
                      />
                    </div>

                    <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-3">
                      <label className="text-[10px] font-bold text-stone-400 uppercase block">Grace Period (Days)</label>
                      <input
                        type="number"
                        value={rulesForm.gracePeriodDays}
                        onChange={e => setRulesForm({ ...rulesForm, gracePeriodDays: parseInt(e.target.value) })}
                        className="w-full bg-white border-b border-stone-200 py-1 text-stone-900 font-mono text-sm focus:border-[#C85A32] outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Retail POS Rules Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs uppercase tracking-widest px-1">
                    <ShoppingBag className="w-4 h-4" />
                    <span>Retail Pricing & Margins</span>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-3">
                      <label className="text-[10px] font-bold text-stone-400 uppercase block">Retail Markup (x)</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          step="0.05"
                          value={rulesForm.defaultRetailMarkupMultiplier}
                          onChange={e => setRulesForm({ ...rulesForm, defaultRetailMarkupMultiplier: parseFloat(e.target.value) })}
                          className="w-full bg-white border-b border-stone-200 py-1 text-stone-900 font-mono text-sm focus:border-[#C85A32] outline-none"
                        />
                        <span className="text-xs text-stone-400">x</span>
                      </div>
                      <p className="text-[9px] text-stone-400 italic">1.8x multiplier = 80% resale margin</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-3">
                      <label className="text-[10px] font-bold text-stone-400 uppercase block">Rounding Mode</label>
                      <select
                        value={rulesForm.retailRoundingMode}
                        onChange={e => setRulesForm({ ...rulesForm, retailRoundingMode: e.target.value as any })}
                        className="w-full bg-white border-b border-stone-200 py-1 text-stone-900 text-xs focus:border-[#C85A32] outline-none appearance-none cursor-pointer"
                      >
                        <option value="exact" className="bg-white text-stone-900">Exact Amount</option>
                        <option value="nearest10" className="bg-white text-stone-900">Nearest R10</option>
                        <option value="charm9" className="bg-white text-stone-900">Psychological (Ends in 9)</option>
                        <option value="charm99" className="bg-white text-stone-900">Psychological (Ends in 99)</option>
                      </select>
                    </div>

                    <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-3">
                      <label className="text-[10px] font-bold text-stone-400 uppercase block">Store Warranty (Days)</label>
                      <input
                        type="number"
                        value={rulesForm.storeWarrantyDays}
                        onChange={e => setRulesForm({ ...rulesForm, storeWarrantyDays: parseInt(e.target.value) })}
                        className="w-full bg-white border-b border-stone-200 py-1 text-stone-900 font-mono text-sm focus:border-[#C85A32] outline-none"
                      />
                    </div>

                    <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-3">
                      <label className="text-[10px] font-bold text-stone-400 uppercase block">Vault Intake Shelf</label>
                      <input
                        type="text"
                        value={rulesForm.defaultVaultShelf}
                        onChange={e => setRulesForm({ ...rulesForm, defaultVaultShelf: e.target.value })}
                        className="w-full bg-white border-b border-stone-200 py-1 text-stone-900 font-mono text-sm focus:border-[#C85A32] outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-100">
                  <button
                    type="button"
                    onClick={() => setIsRulesModalOpen(false)}
                    className="px-5 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition cursor-pointer border border-stone-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-2 px-6 py-2.5 bg-[#C85A32] hover:bg-[#B84E27] text-white rounded-xl text-xs font-bold transition shadow-lg shadow-[#C85A32]/25 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>Apply Rules</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: EDIT SHOP PROFILE */}
      <AnimatePresence>
        {isEditingProfile && (
          <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl bg-white border border-stone-200 rounded-3xl p-8 space-y-6 shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <div className="flex items-center justify-between pb-4 border-b border-stone-100">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-[#C85A32]/10 rounded-xl border border-[#C85A32]/20 text-[#C85A32]">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-stone-900 font-headline">Edit Shop Profile</h3>
                    <p className="text-xs text-stone-500">Updates branch metadata on device and queues for cloud sync</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsEditingProfile(false)}
                  disabled={isSavingProfile}
                  className="p-2 text-stone-400 hover:text-stone-700 disabled:opacity-50 rounded-xl hover:bg-stone-50 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-4">
                <fieldset disabled={isSavingProfile} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block mb-1">Shop Name</label>
                    <input
                      type="text"
                      value={profileForm.shop_name}
                      onChange={e => setProfileForm({ ...profileForm, shop_name: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white border border-stone-200 rounded-xl text-xs text-stone-900 focus:border-[#C85A32] outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block mb-1">Branch Code</label>
                    <input
                      type="text"
                      value={profileForm.shop_code}
                      onChange={e => setProfileForm({ ...profileForm, shop_code: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white border border-stone-200 rounded-xl text-xs text-stone-900 focus:border-[#C85A32] outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block mb-1">Trading Name (Legal)</label>
                    <input
                      type="text"
                      value={profileForm.trading_name}
                      onChange={e => setProfileForm({ ...profileForm, trading_name: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white border border-stone-200 rounded-xl text-xs text-stone-900 focus:border-[#C85A32] outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block mb-1">SAPS Dealer License</label>
                    <input
                      type="text"
                      value={profileForm.saps_dealer_license}
                      onChange={e => setProfileForm({ ...profileForm, saps_dealer_license: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white border border-stone-200 rounded-xl text-xs text-emerald-700 font-mono focus:border-[#C85A32] outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block mb-1">SARS VAT Number</label>
                    <input
                      type="text"
                      value={profileForm.vat_number}
                      onChange={e => setProfileForm({ ...profileForm, vat_number: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white border border-stone-200 rounded-xl text-xs text-stone-900 focus:border-[#C85A32] outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block mb-1">CIPC Registration</label>
                    <input
                      type="text"
                      value={profileForm.registration_number}
                      onChange={e => setProfileForm({ ...profileForm, registration_number: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white border border-stone-200 rounded-xl text-xs text-stone-900 focus:border-[#C85A32] outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block mb-1">Telephone</label>
                    <input
                      type="text"
                      value={profileForm.phone}
                      onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white border border-stone-200 rounded-xl text-xs text-stone-900 focus:border-[#C85A32] outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block mb-1">Branch Email</label>
                    <input
                      type="email"
                      value={profileForm.email}
                      onChange={e => setProfileForm({ ...profileForm, email: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white border border-stone-200 rounded-xl text-xs text-stone-900 focus:border-[#C85A32] outline-none"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block mb-1">Street Address</label>
                    <input
                      type="text"
                      value={profileForm.address}
                      onChange={e => setProfileForm({ ...profileForm, address: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white border border-stone-200 rounded-xl text-xs text-stone-900 focus:border-[#C85A32] outline-none"
                    />
                  </div>
                </fieldset>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-100">
                  <button
                    type="button"
                    onClick={() => setIsEditingProfile(false)}
                    disabled={isSavingProfile}
                    className="px-5 py-2.5 bg-stone-100 hover:bg-stone-200 disabled:opacity-50 text-stone-700 rounded-xl text-xs font-bold transition cursor-pointer border border-stone-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingProfile}
                    className="flex items-center gap-2 px-6 py-2.5 bg-[#C85A32] hover:bg-[#B84E27] disabled:bg-stone-200 disabled:text-stone-400 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-[#C85A32]/25 cursor-pointer"
                  >
                    {isSavingProfile ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    <span>{isSavingProfile ? 'Saving store profile…' : 'Save Store Profile'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
