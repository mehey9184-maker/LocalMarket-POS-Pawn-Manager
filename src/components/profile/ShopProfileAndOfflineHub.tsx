import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Building2, 
  HardDrive, 
  Download, 
  Upload, 
  RefreshCw, 
  FileCode2, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  Copy, 
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
  ShoppingBag
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
  const [profileForm, setProfileForm] = useState<ShopProfile>(shopProfile);
  const [rulesForm, setRulesForm] = useState<BusinessRules>(businessRules);
  const [isSqlModalOpen, setIsSqlModalOpen] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateShopProfile(profileForm);
    setIsEditingProfile(false);
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

  const sqlScript = `-- ==============================================================================
-- SHOP PROFILES & LOCAL-FIRST COMPLIANCE MIGRATION
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql/new
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.shop_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_code TEXT UNIQUE NOT NULL,
    shop_name TEXT NOT NULL,
    trading_name TEXT,
    registration_number TEXT,
    vat_number TEXT,
    saps_dealer_license TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    city TEXT,
    province TEXT,
    postal_code TEXT,
    currency TEXT DEFAULT 'ZAR',
    receipt_header TEXT,
    receipt_footer TEXT,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Link shop items & profiles to shop_profiles
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'shop_id') THEN
        ALTER TABLE public.profiles ADD COLUMN shop_id UUID REFERENCES public.shop_profiles(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shop_items' AND column_name = 'shop_id') THEN
        ALTER TABLE public.shop_items ADD COLUMN shop_id UUID REFERENCES public.shop_profiles(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Enable Row Level Security (RLS)
ALTER TABLE public.shop_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read active shop profiles" ON public.shop_profiles FOR SELECT TO public USING (is_active = true);
CREATE POLICY "Allow authenticated manage shop profiles" ON public.shop_profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon read shop profiles" ON public.shop_profiles FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon update shop profiles" ON public.shop_profiles FOR UPDATE TO anon USING (true);
CREATE POLICY "Allow anon insert shop profiles" ON public.shop_profiles FOR INSERT TO anon WITH CHECK (true);

-- Seed Initial Store Profile
INSERT INTO public.shop_profiles (
    shop_code, shop_name, trading_name, registration_number, vat_number,
    saps_dealer_license, phone, email, address, city, province, postal_code, currency
) VALUES (
    '${shopProfile.shop_code}',
    '${shopProfile.shop_name}',
    '${shopProfile.trading_name}',
    '${shopProfile.registration_number}',
    '${shopProfile.vat_number}',
    '${shopProfile.saps_dealer_license}',
    '${shopProfile.phone}',
    '${shopProfile.email}',
    '${shopProfile.address}',
    '${shopProfile.city}',
    '${shopProfile.province}',
    '${shopProfile.postal_code}',
    '${shopProfile.currency}'
) ON CONFLICT (shop_code) DO NOTHING;`;

  const handleCopySql = () => {
    navigator.clipboard.writeText(sqlScript);
    setCopiedSql(true);
    showToast('SQL Copied', 'Paste into your Supabase SQL editor to run migration', 'success');
    setTimeout(() => setCopiedSql(false), 2500);
  };

  return (
    <div className="space-y-8">
      {/* 1. STORE PROFILE & STATUTORY COMPLIANCE CARD */}
      <div className="bg-[#121212] border border-[#2A2A2A] rounded-[2.5rem] p-8 lg:p-10 space-y-6 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-[#2A2A2A]">
          <div className="flex items-center gap-4">
            <div className="p-3.5 bg-[#C85A32]/10 rounded-2xl border border-[#C85A32]/20">
              <Building2 className="w-6 h-6 text-[#E87A5D]" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-black text-white font-headline tracking-tight">
                  {shopProfile.shop_name}
                </h2>
                <span className="text-[10px] font-mono font-black uppercase px-2.5 py-0.5 rounded-lg bg-[#C85A32]/15 text-[#E87A5D] border border-[#C85A32]/30">
                  {shopProfile.shop_code}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">{shopProfile.trading_name}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => setIsSqlModalOpen(true)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1A1A1A] hover:bg-[#222] text-gray-300 hover:text-white rounded-xl text-xs font-bold border border-[#2A2A2A] transition"
              title="View SQL query to add shop_profiles to Supabase"
            >
              <FileCode2 className="w-4 h-4 text-emerald-400" />
              <span>Supabase SQL</span>
            </button>
            <button
              onClick={() => {
                setProfileForm(shopProfile);
                setIsEditingProfile(true);
              }}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-[#C85A32] hover:bg-[#B34D28] text-white rounded-xl text-xs font-bold transition shadow-lg shadow-[#C85A32]/20"
            >
              <Edit3 className="w-4 h-4" />
              <span>Edit Store Info</span>
            </button>
          </div>
        </div>

        {/* COMPLIANCE & LEGAL DETAILS GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-[#1A1A1A] border border-[#2A2A2A]">
            <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">SAPS Dealer License</p>
            <p className="text-xs font-mono font-bold text-emerald-400 mt-1">{shopProfile.saps_dealer_license}</p>
            <p className="text-[9px] text-gray-500 mt-0.5">Second-Hand Goods Act 06 of 2009</p>
          </div>

          <div className="p-4 rounded-2xl bg-[#1A1A1A] border border-[#2A2A2A]">
            <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">SARS VAT Number</p>
            <p className="text-xs font-mono font-bold text-gray-200 mt-1">{shopProfile.vat_number}</p>
            <p className="text-[9px] text-gray-500 mt-0.5">15% Standard Rate Applied</p>
          </div>

          <div className="p-4 rounded-2xl bg-[#1A1A1A] border border-[#2A2A2A]">
            <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">CIPC Registration</p>
            <p className="text-xs font-mono font-bold text-gray-200 mt-1">{shopProfile.registration_number}</p>
            <p className="text-[9px] text-gray-500 mt-0.5">Enterprise Registry Verified</p>
          </div>

          <div className="p-4 rounded-2xl bg-[#1A1A1A] border border-[#2A2A2A] sm:col-span-2">
            <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">Physical Branch Address</p>
            <p className="text-xs font-medium text-gray-300 mt-1">{shopProfile.address}, {shopProfile.city}, {shopProfile.province} {shopProfile.postal_code}</p>
          </div>

          <div className="p-4 rounded-2xl bg-[#1A1A1A] border border-[#2A2A2A]">
            <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">Direct Branch Line</p>
            <p className="text-xs font-mono font-bold text-gray-200 mt-1">{shopProfile.phone}</p>
            <p className="text-[9px] text-gray-500 mt-0.5">{shopProfile.email}</p>
          </div>
        </div>
      </div>

      {/* 2. CUSTOMIZABLE DEAL RULES & PRICING CONFIGURATION CARD */}
      <div className="bg-[#121212] border border-[#2A2A2A] rounded-[2.5rem] p-8 lg:p-10 space-y-6 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-[#2A2A2A]">
          <div className="flex items-center gap-4">
            <div className="p-3.5 bg-[#C85A32]/15 rounded-2xl border border-[#C85A32]/30 text-[#E87A5D]">
              <Sliders className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-black text-white font-headline tracking-tight">
                  Store Deal Rules &amp; Margins Configurator
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Customizable
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Regulate statutory NCR 30-day pawn caps, outright retail markup multipliers, and rounding modes.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsRulesModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#C85A32] hover:bg-[#B34D28] text-white text-xs font-bold transition shadow-lg shadow-[#C85A32]/20 active:scale-[0.98]"
          >
            <Sliders className="w-4 h-4" />
            <span>Open Deal Rules Configurator</span>
          </button>
        </div>

        {/* Live Active Rules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Pawn Rules Summary */}
          <div className="p-5 rounded-2xl bg-[#1A1513] border border-[#C85A32]/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#E87A5D] font-bold text-xs">
                <History className="w-4 h-4" />
                <span>30-Day Pawn Loans (NCR Act 34 of 2005)</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">
                Regulated
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-[#141414] border border-[#282828]">
                <span className="text-[10px] text-gray-400 uppercase font-mono block">Monthly Interest</span>
                <span className="font-mono font-bold text-white text-sm">
                  {(businessRules.pawnMonthlyInterestRate * 100).toFixed(1)}%
                </span>
                <span className="text-[9px] text-gray-500 block">NCR Legal Cap: 5.0%</span>
              </div>

              <div className="p-3 rounded-xl bg-[#141414] border border-[#282828]">
                <span className="text-[10px] text-gray-400 uppercase font-mono block">Vault Storage Fee</span>
                <span className="font-mono font-bold text-amber-400 text-sm">
                  {(businessRules.pawnStorageAdminFeeRate * 100).toFixed(1)}%
                </span>
                <span className="text-[9px] text-gray-500 block">Insured Vault Custody</span>
              </div>

              <div className="p-3 rounded-xl bg-[#141414] border border-[#282828]">
                <span className="text-[10px] text-gray-400 uppercase font-mono block">Agreement Term</span>
                <span className="font-mono font-bold text-white text-sm">
                  {businessRules.defaultLoanTermDays} Days
                </span>
                <span className="text-[9px] text-gray-500 block">Maturity Window</span>
              </div>

              <div className="p-3 rounded-xl bg-[#141414] border border-[#282828]">
                <span className="text-[10px] text-gray-400 uppercase font-mono block">Grace Period</span>
                <span className="font-mono font-bold text-purple-400 text-sm">
                  {businessRules.gracePeriodDays} Days
                </span>
                <span className="text-[9px] text-gray-500 block">Before Retail Default</span>
              </div>
            </div>
          </div>

          {/* Outright Buy Rules Summary */}
          <div className="p-5 rounded-2xl bg-[#121A15] border border-emerald-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                <ShoppingBag className="w-4 h-4" />
                <span>Outright Buys (SAPS Second-Hand Goods)</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                Commercial Retail
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-[#141414] border border-[#282828]">
                <span className="text-[10px] text-gray-400 uppercase font-mono block">Floor Markup</span>
                <span className="font-mono font-bold text-emerald-400 text-sm">
                  {businessRules.defaultRetailMarkupMultiplier}x
                </span>
                <span className="text-[9px] text-gray-500 block">
                  +{Math.round((businessRules.defaultRetailMarkupMultiplier - 1) * 100)}% Resale Margin
                </span>
              </div>

              <div className="p-3 rounded-xl bg-[#141414] border border-[#282828]">
                <span className="text-[10px] text-gray-400 uppercase font-mono block">Price Tag Rounding</span>
                <span className="font-mono font-bold text-cyan-400 text-sm">
                  {businessRules.retailRoundingMode}
                </span>
                <span className="text-[9px] text-gray-500 block">Sticker Cash Formatting</span>
              </div>

              <div className="p-3 rounded-xl bg-[#141414] border border-[#282828]">
                <span className="text-[10px] text-gray-400 uppercase font-mono block">Store Test Warranty</span>
                <span className="font-mono font-bold text-white text-sm">
                  {businessRules.storeWarrantyDays} Days
                </span>
                <span className="text-[9px] text-gray-500 block">{businessRules.warrantyDescription}</span>
              </div>

              <div className="p-3 rounded-xl bg-[#141414] border border-[#282828]">
                <span className="text-[10px] text-gray-400 uppercase font-mono block">Default Holding Bin</span>
                <span className="font-mono font-bold text-white text-sm">
                  {businessRules.defaultVaultShelf}
                </span>
                <span className="text-[9px] text-gray-500 block">Intake Location</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. WHATSAPP-STYLE LOCAL DEVICE PERSISTENCE & TRICKLE SYNC CARD */}
      <div className="bg-[#121212] border border-[#2A2A2A] rounded-[2.5rem] p-8 lg:p-10 space-y-6 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-[#2A2A2A]">
          <div className="flex items-center gap-4">
            <div className="p-3.5 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
              <HardDrive className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-black text-white font-headline tracking-tight">
                  WhatsApp-Style Local Device Storage
                </h2>
                {isOnline ? (
                  <span className="flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <Wifi className="w-3 h-3" /> Online
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <WifiOff className="w-3 h-3" /> Offline Mode
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                All data is stored permanently on this device. Syncing never deletes or purges your local database.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={triggerManualSlowSync}
              disabled={isSlowSyncing}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border transition ${
                isSlowSyncing 
                  ? 'bg-blue-500/20 text-blue-300 border-blue-500/30 animate-pulse' 
                  : 'bg-[#1A1A1A] hover:bg-[#222] text-gray-200 border-[#2A2A2A]'
              }`}
              title="Trickles pending offline records slowly to Supabase (1 item/sec) to save bandwidth egress"
            >
              <RefreshCw className={`w-4 h-4 text-cyan-400 ${isSlowSyncing ? 'animate-spin' : ''}`} />
              <span>{isSlowSyncing ? 'Slow Syncing...' : 'Trickle Sync Now'}</span>
            </button>
          </div>
        </div>

        {/* SLOW SYNC ACTIVE PROGRESS BANNER */}
        {isSlowSyncing && slowSyncProgress && (
          <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-300 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold">
              <span>Trickle Syncing ({slowSyncProgress.current} of {slowSyncProgress.total})</span>
              <span className="font-mono">{slowSyncProgress.entityName}</span>
            </div>
            <div className="w-full h-1.5 bg-blue-950 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-400 transition-all duration-300"
                style={{ width: `${Math.round((slowSyncProgress.current / slowSyncProgress.total) * 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-blue-400/80">
              Pacing requests at 1.2s intervals to preserve Supabase Free Tier egress and prevent network timeouts.
            </p>
          </div>
        )}

        {/* DEVICE STORAGE METRICS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-[#1A1A1A] border border-[#2A2A2A]">
            <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">Local Inventory</p>
            <p className="text-2xl font-black text-white font-headline mt-1">{deviceStorageStats.totalItems}</p>
            <p className="text-[9px] text-emerald-400 mt-1">Permanent on disk</p>
          </div>

          <div className="p-4 rounded-2xl bg-[#1A1A1A] border border-[#2A2A2A]">
            <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">Local Receipts</p>
            <p className="text-2xl font-black text-white font-headline mt-1">{deviceStorageStats.totalSales}</p>
            <p className="text-[9px] text-emerald-400 mt-1">Stored offline</p>
          </div>

          <div className="p-4 rounded-2xl bg-[#1A1A1A] border border-[#2A2A2A]">
            <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">Device Quota Used</p>
            <p className="text-2xl font-black text-white font-headline mt-1">~{deviceStorageStats.estimatedLocalSizeKb} KB</p>
            <p className="text-[9px] text-gray-400 mt-1">IndexedDB + Cache</p>
          </div>

          <div className="p-4 rounded-2xl bg-[#1A1A1A] border border-[#2A2A2A]">
            <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">Sync Status</p>
            <div className="flex flex-col gap-1 mt-1.5">
              <div className="flex items-baseline gap-2">
                <p className="text-xl font-black text-white font-headline">
                  {pendingSyncCount > 0 ? `${pendingSyncCount} Pending` : failedSyncCount > 0 ? `${failedSyncCount} Blocked` : 'Synced'}
                </p>
                {isSlowSyncing ? (
                  <span className="text-[9px] text-cyan-400 font-bold px-1.5 py-0.5 rounded bg-cyan-400/10 border border-cyan-400/20">Syncing</span>
                ) : pendingSyncCount > 0 ? (
                  <span className="text-[9px] text-amber-400 font-bold px-1.5 py-0.5 rounded bg-amber-400/10 border border-amber-400/20">Waiting</span>
                ) : failedSyncCount === 0 ? (
                  <span className="text-[9px] text-emerald-400 font-bold px-1.5 py-0.5 rounded bg-emerald-400/10 border border-emerald-400/20">Synced</span>
                ) : null}
              </div>
              
              {hasDeterministicError && (
                <p className="text-[10px] text-rose-400 font-medium leading-tight mt-0.5">⚠️ Needs attention / blocked (Invalid ID/Data)</p>
              )}
              {hasTransientError && (
                <p className="text-[10px] text-amber-400 font-medium leading-tight mt-0.5">🔄 Retryable network failure</p>
              )}
              {!hasDeterministicError && !hasTransientError && pendingSyncCount === 0 && failedSyncCount === 0 && (
                <p className="text-[10px] text-emerald-400 font-medium mt-0.5">All records synced to cloud</p>
              )}
            </div>
          </div>
        </div>

        {/* WHATSAPP-STYLE BACKUP FILE ACTIONS */}
        <div className="pt-4 border-t border-[#2A2A2A] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-bold text-gray-300">WhatsApp-Style Physical File Backup</p>
            <p className="text-[11px] text-gray-500">
              Generates a standalone portable <code className="text-gray-400">.json</code> file on your computer/phone disk, completely independent of cloud or WiFi.
            </p>
          </div>

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
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1A1A1A] hover:bg-[#252525] text-gray-300 hover:text-white rounded-xl text-xs font-bold border border-[#2A2A2A] transition"
              title="Restore local database from a WhatsApp-style backup file"
            >
              <Upload className="w-4 h-4 text-blue-400" />
              <span>{isRestoring ? 'Restoring...' : 'Restore from File'}</span>
            </button>

            <button
              onClick={exportDeviceBackup}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-emerald-600/20"
              title="Download full point-in-time database snapshot directly to device storage"
            >
              <Download className="w-4 h-4" />
              <span>Download Device Backup File</span>
            </button>
          </div>
        </div>
      </div>

      {/* MODAL: DEAL RULES & PRICING CONFIGURATION */}
      <AnimatePresence>
        {isRulesModalOpen && (
          <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl bg-[#121212] border border-[#2A2A2A] rounded-3xl p-8 space-y-6 shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <div className="flex items-center justify-between pb-4 border-b border-[#2A2A2A]">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-[#C85A32]/15 rounded-xl border border-[#C85A32]/30 text-[#E87A5D]">
                    <Sliders className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white font-headline">Deal Rules & Margins</h3>
                    <p className="text-xs text-gray-400">Configure interest rates, retail markups, and statutory terms</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsRulesModalOpen(false)}
                  className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-[#1E1E1E] transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveRules} className="space-y-6">
                {/* Pawn Rules Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-[#E87A5D] font-bold text-xs uppercase tracking-widest px-1">
                    <History className="w-4 h-4" />
                    <span>Pawn Loan Rules (NCR Regulated)</span>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-[#181818] border border-[#2A2A2A] space-y-3">
                      <label className="text-[10px] font-bold text-gray-400 uppercase block">Monthly Interest Rate (%)</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          step="0.1"
                          value={rulesForm.pawnMonthlyInterestRate * 100}
                          onChange={e => setRulesForm({ ...rulesForm, pawnMonthlyInterestRate: parseFloat(e.target.value) / 100 })}
                          className="w-full bg-transparent border-b border-[#333] py-1 text-white font-mono text-sm focus:border-[#C85A32] outline-none"
                        />
                        <span className="text-xs text-gray-500">%</span>
                      </div>
                      <p className="text-[9px] text-gray-500 italic">NCR statutory cap is 5.0% for first loans</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-[#181818] border border-[#2A2A2A] space-y-3">
                      <label className="text-[10px] font-bold text-gray-400 uppercase block">Vault Storage Fee (%)</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          step="0.1"
                          value={rulesForm.pawnStorageAdminFeeRate * 100}
                          onChange={e => setRulesForm({ ...rulesForm, pawnStorageAdminFeeRate: parseFloat(e.target.value) / 100 })}
                          className="w-full bg-transparent border-b border-[#333] py-1 text-white font-mono text-sm focus:border-[#C85A32] outline-none"
                        />
                        <span className="text-xs text-gray-500">%</span>
                      </div>
                      <p className="text-[9px] text-gray-500 italic">Covers insurance and high-security vaulting</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-[#181818] border border-[#2A2A2A] space-y-3">
                      <label className="text-[10px] font-bold text-gray-400 uppercase block">Loan Duration (Days)</label>
                      <input
                        type="number"
                        value={rulesForm.defaultLoanTermDays}
                        onChange={e => setRulesForm({ ...rulesForm, defaultLoanTermDays: parseInt(e.target.value) })}
                        className="w-full bg-transparent border-b border-[#333] py-1 text-white font-mono text-sm focus:border-[#C85A32] outline-none"
                      />
                    </div>

                    <div className="p-4 rounded-2xl bg-[#181818] border border-[#2A2A2A] space-y-3">
                      <label className="text-[10px] font-bold text-gray-400 uppercase block">Grace Period (Days)</label>
                      <input
                        type="number"
                        value={rulesForm.gracePeriodDays}
                        onChange={e => setRulesForm({ ...rulesForm, gracePeriodDays: parseInt(e.target.value) })}
                        className="w-full bg-transparent border-b border-[#333] py-1 text-white font-mono text-sm focus:border-[#C85A32] outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Retail POS Rules Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-widest px-1">
                    <ShoppingBag className="w-4 h-4" />
                    <span>Retail Pricing & Margins</span>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-[#181818] border border-[#2A2A2A] space-y-3">
                      <label className="text-[10px] font-bold text-gray-400 uppercase block">Retail Markup (x)</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          step="0.05"
                          value={rulesForm.defaultRetailMarkupMultiplier}
                          onChange={e => setRulesForm({ ...rulesForm, defaultRetailMarkupMultiplier: parseFloat(e.target.value) })}
                          className="w-full bg-transparent border-b border-[#333] py-1 text-white font-mono text-sm focus:border-[#C85A32] outline-none"
                        />
                        <span className="text-xs text-gray-500">x</span>
                      </div>
                      <p className="text-[9px] text-gray-500 italic">1.8x multiplier = 80% resale margin</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-[#181818] border border-[#2A2A2A] space-y-3">
                      <label className="text-[10px] font-bold text-gray-400 uppercase block">Rounding Mode</label>
                      <select
                        value={rulesForm.retailRoundingMode}
                        onChange={e => setRulesForm({ ...rulesForm, retailRoundingMode: e.target.value as any })}
                        className="w-full bg-transparent border-b border-[#333] py-1 text-white text-xs focus:border-[#C85A32] outline-none appearance-none"
                      >
                        <option value="exact" className="bg-[#121212]">Exact Amount</option>
                        <option value="nearest10" className="bg-[#121212]">Nearest R10</option>
                        <option value="charm9" className="bg-[#121212]">Psychological (Ends in 9)</option>
                        <option value="charm99" className="bg-[#121212]">Psychological (Ends in 99)</option>
                      </select>
                    </div>

                    <div className="p-4 rounded-2xl bg-[#181818] border border-[#2A2A2A] space-y-3">
                      <label className="text-[10px] font-bold text-gray-400 uppercase block">Store Warranty (Days)</label>
                      <input
                        type="number"
                        value={rulesForm.storeWarrantyDays}
                        onChange={e => setRulesForm({ ...rulesForm, storeWarrantyDays: parseInt(e.target.value) })}
                        className="w-full bg-transparent border-b border-[#333] py-1 text-white font-mono text-sm focus:border-[#C85A32] outline-none"
                      />
                    </div>

                    <div className="p-4 rounded-2xl bg-[#181818] border border-[#2A2A2A] space-y-3">
                      <label className="text-[10px] font-bold text-gray-400 uppercase block">Vault Intake Shelf</label>
                      <input
                        type="text"
                        value={rulesForm.defaultVaultShelf}
                        onChange={e => setRulesForm({ ...rulesForm, defaultVaultShelf: e.target.value })}
                        className="w-full bg-transparent border-b border-[#333] py-1 text-white font-mono text-sm focus:border-[#C85A32] outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#2A2A2A]">
                  <button
                    type="button"
                    onClick={() => setIsRulesModalOpen(false)}
                    className="px-5 py-2.5 bg-[#1E1E1E] hover:bg-[#252525] text-gray-300 rounded-xl text-xs font-bold transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-2 px-6 py-2.5 bg-[#C85A32] hover:bg-[#B34D28] text-white rounded-xl text-xs font-bold transition shadow-lg shadow-[#C85A32]/20"
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
          <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl bg-[#121212] border border-[#2A2A2A] rounded-3xl p-8 space-y-6 shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <div className="flex items-center justify-between pb-4 border-b border-[#2A2A2A]">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-[#C85A32]/15 rounded-xl border border-[#C85A32]/30 text-[#E87A5D]">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white font-headline">Edit Shop Profile</h3>
                    <p className="text-xs text-gray-400">Updates branch metadata on device and queues for cloud sync</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsEditingProfile(false)}
                  className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-[#1E1E1E] transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Shop Name</label>
                    <input
                      type="text"
                      value={profileForm.shop_name}
                      onChange={e => setProfileForm({ ...profileForm, shop_name: e.target.value })}
                      className="w-full px-4 py-2.5 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl text-xs text-white focus:border-[#C85A32] outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Branch Code</label>
                    <input
                      type="text"
                      value={profileForm.shop_code}
                      onChange={e => setProfileForm({ ...profileForm, shop_code: e.target.value })}
                      className="w-full px-4 py-2.5 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl text-xs text-white focus:border-[#C85A32] outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Trading Name (Legal)</label>
                    <input
                      type="text"
                      value={profileForm.trading_name}
                      onChange={e => setProfileForm({ ...profileForm, trading_name: e.target.value })}
                      className="w-full px-4 py-2.5 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl text-xs text-white focus:border-[#C85A32] outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">SAPS Dealer License</label>
                    <input
                      type="text"
                      value={profileForm.saps_dealer_license}
                      onChange={e => setProfileForm({ ...profileForm, saps_dealer_license: e.target.value })}
                      className="w-full px-4 py-2.5 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl text-xs text-emerald-400 font-mono focus:border-[#C85A32] outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">SARS VAT Number</label>
                    <input
                      type="text"
                      value={profileForm.vat_number}
                      onChange={e => setProfileForm({ ...profileForm, vat_number: e.target.value })}
                      className="w-full px-4 py-2.5 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl text-xs text-white focus:border-[#C85A32] outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">CIPC Registration</label>
                    <input
                      type="text"
                      value={profileForm.registration_number}
                      onChange={e => setProfileForm({ ...profileForm, registration_number: e.target.value })}
                      className="w-full px-4 py-2.5 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl text-xs text-white focus:border-[#C85A32] outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Telephone</label>
                    <input
                      type="text"
                      value={profileForm.phone}
                      onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })}
                      className="w-full px-4 py-2.5 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl text-xs text-white focus:border-[#C85A32] outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Branch Email</label>
                    <input
                      type="email"
                      value={profileForm.email}
                      onChange={e => setProfileForm({ ...profileForm, email: e.target.value })}
                      className="w-full px-4 py-2.5 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl text-xs text-white focus:border-[#C85A32] outline-none"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Street Address</label>
                    <input
                      type="text"
                      value={profileForm.address}
                      onChange={e => setProfileForm({ ...profileForm, address: e.target.value })}
                      className="w-full px-4 py-2.5 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl text-xs text-white focus:border-[#C85A32] outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#2A2A2A]">
                  <button
                    type="button"
                    onClick={() => setIsEditingProfile(false)}
                    className="px-5 py-2.5 bg-[#1E1E1E] hover:bg-[#252525] text-gray-300 rounded-xl text-xs font-bold transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-2 px-6 py-2.5 bg-[#C85A32] hover:bg-[#B34D28] text-white rounded-xl text-xs font-bold transition shadow-lg shadow-[#C85A32]/20"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save Store Profile</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: SUPABASE SQL VIEWER */}
      <AnimatePresence>
        {isSqlModalOpen && (
          <div className="fixed inset-0 z-[170] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-3xl bg-[#121212] border border-[#2A2A2A] rounded-3xl p-8 space-y-6 shadow-2xl relative max-h-[90vh] flex flex-col"
            >
              <div className="flex items-center justify-between pb-4 border-b border-[#2A2A2A] shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-400">
                    <FileCode2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white font-headline">Supabase SQL: shop_profiles Migration</h3>
                    <p className="text-xs text-gray-400">Creates the branch profiles table and sets up safe RLS policies</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsSqlModalOpen(false)}
                  className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-[#1E1E1E] transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#181818] border border-[#2A2A2A] flex items-center gap-3 shrink-0">
                <Info className="w-5 h-5 text-emerald-400 shrink-0" />
                <p className="text-xs text-gray-300">
                  Open your Supabase project dashboard → <strong className="text-white">SQL Editor</strong> → Paste this script and click <strong className="text-emerald-400">Run</strong>.
                </p>
              </div>

              <div className="flex-1 min-h-0 bg-[#0A0A0A] border border-[#2A2A2A] rounded-2xl p-4 overflow-y-auto font-mono text-[11px] text-gray-300 leading-relaxed custom-scrollbar selection:bg-emerald-500/30">
                <pre>{sqlScript}</pre>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-[#2A2A2A] shrink-0">
                <span className="text-[11px] text-gray-500 font-mono">File: /supabase/shop_profiles.sql</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsSqlModalOpen(false)}
                    className="px-5 py-2.5 bg-[#1E1E1E] hover:bg-[#252525] text-gray-300 rounded-xl text-xs font-bold transition"
                  >
                    Close
                  </button>
                  <button
                    onClick={handleCopySql}
                    className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-emerald-600/20"
                  >
                    {copiedSql ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedSql ? 'Copied to Clipboard!' : 'Copy SQL Script'}</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
