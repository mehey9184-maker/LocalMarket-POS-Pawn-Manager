import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Database,
  Shield,
  Key,
  Users,
  Package,
  FileText,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Send,
  Radio,
  ExternalLink,
  Lock,
  LogIn,
  LogOut,
  UserPlus,
  Server,
  CloudLightning,
  Activity,
  Layers,
  Sparkles,
  ArrowRight,
  Download,
  Trash2,
  CheckCheck
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { authApi, profilesApi, shopItemsApi, logsApi } from '../../services/supabaseApi';
import { ProfileRow, ShopItemRow, SystemLogRow, UserRole } from '../../types/supabase';
import { 
  isSupabaseConfigured, 
  getSupabaseConfig,
  getActiveSupabaseUrl,
  getActiveSupabaseAnonKey,
  saveSupabaseCredentials,
  clearSupabaseCredentials,
  testSupabaseConnection,
  ConnectionTestResult
} from '../../services/supabase';

type Tab = 'setup' | 'auth' | 'shop_items' | 'profiles' | 'logs';

export const SupabaseApiModal: React.FC = () => {
  const {
    isSupabaseModalOpen,
    setIsSupabaseModalOpen,
    supabaseStatus,
    supabaseUser,
    currentUserProfile,
    supabaseLogs,
    syncShopItemsWithSupabase,
    fetchSupabaseLogs,
    logSystemEvent,
    inventory,
    showToast
  } = useApp();

  // Tab State - Default to 'setup' if Supabase is not configured yet
  const [activeTab, setActiveTab] = useState<Tab>(isSupabaseConfigured() ? 'setup' : 'setup');
  const [copiedSql, setCopiedSql] = useState(false);
  const [copiedEnv, setCopiedEnv] = useState(false);
  
  // Credentials Input State
  const [inputUrl, setInputUrl] = useState(getActiveSupabaseUrl());
  const [inputKey, setInputKey] = useState(getActiveSupabaseAnonKey());
  const [isSavingCreds, setIsSavingCreds] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);

  // Auth Form State
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authFullName, setAuthFullName] = useState('');
  const [authRole, setAuthRole] = useState<UserRole>('cashier');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Shop Items State
  const [cloudItems, setCloudItems] = useState<ShopItemRow[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemSku, setNewItemSku] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('2499');
  const [newItemCategory, setNewItemCategory] = useState('Phones & Tech');
  const [isAddingItem, setIsAddingItem] = useState(false);

  // Profiles State
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);

  // Log filter
  const [logFilter, setLogFilter] = useState<string>('ALL');

  const config = getSupabaseConfig();

  // Load cloud data and test connection when modal opens
  useEffect(() => {
    if (isSupabaseModalOpen) {
      setInputUrl(getActiveSupabaseUrl());
      setInputKey(getActiveSupabaseAnonKey());
      if (isSupabaseConfigured()) {
        handleRunTest();
        loadCloudItems();
        loadProfiles();
        fetchSupabaseLogs();
      }
    }
  }, [isSupabaseModalOpen]);

  const handleRunTest = async () => {
    setIsTesting(true);
    try {
      const result = await testSupabaseConnection();
      setTestResult(result);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Connection test failed',
        hasShopItemsTable: false,
        hasProfilesTable: false,
        hasSystemLogsTable: false,
        itemCount: 0
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl.startsWith('https://')) {
      showToast('Invalid URL', 'Supabase URL must start with https:// (e.g. https://xxx.supabase.co)', 'error');
      return;
    }
    if (inputKey.length < 20) {
      showToast('Invalid Key', 'Please paste your valid Supabase anon public key', 'error');
      return;
    }

    setIsSavingCreds(true);
    saveSupabaseCredentials(inputUrl, inputKey);
    showToast('Credentials Saved', 'Supabase URL and API Key stored successfully', 'success');

    // Run connection test immediately
    await handleRunTest();
    await syncShopItemsWithSupabase();
    await fetchSupabaseLogs();
    setIsSavingCreds(false);
  };

  const handleClearCredentials = () => {
    clearSupabaseCredentials();
    setInputUrl('');
    setInputKey('');
    setTestResult(null);
    setCloudItems([]);
    setProfiles([]);
    showToast('Credentials Cleared', 'Reverted to local offline mode', 'info');
  };

  // Seed sample data into empty Supabase tables
  const handleSeedDatabase = async () => {
    setIsSeeding(true);
    try {
      const sampleItems = [
        {
          sku: 'SKU-IPH15-01',
          title: 'Apple iPhone 15 Pro 128GB Titanium',
          category: 'Phones & Tech',
          serial_or_imei: '359281092837192',
          condition: 'Mint' as const,
          acquisition_type: 'Buy',
          cost_basis: 12500,
          retail_price: 18999,
          status: 'Retail Floor' as const,
          image_url: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=600&q=80',
          specs: 'Natural Titanium, Battery 98%, USB-C, Original Box'
        },
        {
          sku: 'SKU-MAK-501',
          title: 'Makita 18V LXT Brushless Cordless Drill Kit',
          category: 'Power Tools',
          serial_or_imei: 'MK-9821734-LXT',
          condition: 'Excellent' as const,
          acquisition_type: 'Buy',
          cost_basis: 1600,
          retail_price: 2750,
          status: 'Retail Floor' as const,
          image_url: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=600&q=80',
          specs: 'Includes 2x 4.0Ah Li-ion batteries and rapid charger'
        },
        {
          sku: 'SKU-PS5-009',
          title: 'Sony PlayStation 5 Disc Edition 825GB',
          category: 'Gaming Consoles',
          serial_or_imei: 'PS5-839210-SA',
          condition: 'Excellent' as const,
          acquisition_type: 'Buy',
          cost_basis: 5200,
          retail_price: 7999,
          status: 'Retail Floor' as const,
          image_url: 'https://images.unsplash.com/photo-1606813907291-d86efa9b94db?w=600&q=80',
          specs: 'White DualSense controller, HDMI 2.1 cable, power cord'
        },
        {
          sku: 'SKU-JBL-442',
          title: 'JBL Boombox 3 Portable Bluetooth Speaker',
          category: 'Audio & Visual',
          serial_or_imei: 'JBL-BB3-88219',
          condition: 'Good' as const,
          acquisition_type: 'Buy',
          cost_basis: 3200,
          retail_price: 4899,
          status: 'Retail Floor' as const,
          image_url: 'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=600&q=80',
          specs: 'Squad Camo, IP67 waterproof, 24hr battery'
        },
        {
          sku: 'SKU-GLD-991',
          title: '9ct Yellow Gold Curb Link Chain 22g',
          category: 'Fine Jewelry & Gold',
          serial_or_imei: 'CERT-GLD-9912',
          condition: 'Excellent' as const,
          acquisition_type: 'Buy',
          cost_basis: 9500,
          retail_price: 14500,
          status: 'Retail Floor' as const,
          image_url: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=600&q=80',
          specs: 'Hallmarked 375, 55cm length, lobster clasp'
        }
      ];

      let insertedCount = 0;
      for (const item of sampleItems) {
        try {
          await shopItemsApi.createItem(item);
          insertedCount++;
        } catch (e) {
          // May already exist
        }
      }

      await logSystemEvent('DATABASE_SEEDED', {
        source: 'Supabase Setup Center',
        itemsCount: insertedCount,
        timestamp: new Date().toISOString()
      }, 'audit');

      showToast('Database Seeded!', `Successfully inserted ${insertedCount} inventory items & audit log`, 'success');
      await handleRunTest();
      await loadCloudItems();
      await syncShopItemsWithSupabase();
      await fetchSupabaseLogs();
    } catch (err: any) {
      showToast('Seed Failed', err.message || 'Make sure schema.sql has been run first', 'error');
    } finally {
      setIsSeeding(false);
    }
  };

  const loadCloudItems = async () => {
    setLoadingItems(true);
    try {
      const items = await shopItemsApi.getItems({ limit: 50 });
      setCloudItems(items);
    } catch (err: any) {
      console.warn('Could not load shop items from Supabase:', err.message);
    } finally {
      setLoadingItems(false);
    }
  };

  const loadProfiles = async () => {
    setLoadingProfiles(true);
    try {
      const data = await profilesApi.getProfiles();
      setProfiles(data);
    } catch (err: any) {
      console.warn('Could not load profiles:', err.message);
    } finally {
      setLoadingProfiles(false);
    }
  };

  // Auth Handlers
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);

    try {
      if (authMode === 'signin') {
        await authApi.signIn(authEmail, authPassword);
        showToast('Signed In', `Welcome back, ${authEmail}!`, 'success');
      } else {
        await authApi.signUp(authEmail, authPassword, authFullName, authRole);
        showToast('Account Created', 'Registration successful! Profile auto-created in Supabase.', 'success');
      }
      setAuthPassword('');
      loadProfiles();
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed');
      showToast('Auth Error', err.message || 'Operation failed', 'error');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    setAuthLoading(true);
    try {
      await authApi.signOut();
      showToast('Signed Out', 'Supabase session terminated', 'info');
    } catch (err: any) {
      showToast('Error', err.message, 'error');
    } finally {
      setAuthLoading(false);
    }
  };

  // Full PostgreSQL Schema for Supabase SQL Editor
  const FULL_SCHEMA_SQL = `-- ==============================================================================
-- SUPABASE FREE TIER COMPLETE DATABASE SETUP (LOCALMARKET POS & PAWN HUB)
-- Run this in Supabase Dashboard -> SQL Editor -> + New Query -> Run
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. ENUMS
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('cashier', 'senior_cashier', 'manager', 'admin');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE item_condition AS ENUM ('Mint', 'Excellent', 'Good', 'Fair', 'Damaged');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE item_status AS ENUM ('Vault Hold', 'Retail Floor', 'Sold', 'Redeemed', 'Reserved', 'Flagged');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 3. PROFILES TABLE (Linked with Supabase Auth: auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE,
    full_name TEXT NOT NULL,
    cashier_code TEXT UNIQUE NOT NULL,
    role user_role DEFAULT 'cashier'::user_role NOT NULL,
    phone TEXT,
    avatar_url TEXT,
    pin_code TEXT DEFAULT '1234',
    digital_signature TEXT,
    is_active BOOLEAN DEFAULT true,
    last_sign_in_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. SHOP ITEMS TABLE (Retail Inventory & Second-Hand Goods)
CREATE TABLE IF NOT EXISTS public.shop_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    serial_or_imei TEXT,
    condition item_condition DEFAULT 'Good'::item_condition NOT NULL,
    acquisition_type TEXT DEFAULT 'Buy' NOT NULL,
    cost_basis NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    retail_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    vault_location TEXT,
    status item_status DEFAULT 'Retail Floor'::item_status NOT NULL,
    days_in_vault INT DEFAULT 0,
    image_url TEXT,
    specs TEXT,
    pawn_ticket_id TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    added_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. SYSTEM & AUDIT LOGS TABLE (Cashier Actions, POS Sales, SAPS Form 21)
CREATE TABLE IF NOT EXISTS public.system_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type TEXT NOT NULL,
    severity TEXT DEFAULT 'info' NOT NULL,
    actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    actor_name TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    saps_reference TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. INDEXES
CREATE INDEX IF NOT EXISTS idx_shop_items_sku ON public.shop_items(sku);
CREATE INDEX IF NOT EXISTS idx_shop_items_status ON public.shop_items(status);
CREATE INDEX IF NOT EXISTS idx_shop_items_category ON public.shop_items(category);
CREATE INDEX IF NOT EXISTS idx_system_logs_event_type ON public.system_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON public.system_logs(created_at DESC);

-- 7. AUTO-PROFILE CREATION ON USER SIGNUP TRIGGER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_cashier_code TEXT;
BEGIN
    new_cashier_code := 'CSH-' || LPAD(FLOOR(RANDOM() * 9000 + 1000)::TEXT, 4, '0');
    INSERT INTO public.profiles (
        id, email, full_name, cashier_code, role, avatar_url, digital_signature
    ) VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
        new_cashier_code,
        COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'cashier'::user_role),
        NEW.raw_user_meta_data->>'avatar_url',
        'Verified: ' || COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1))
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 8. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Allow authenticated read profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow public read shop items" ON public.shop_items FOR SELECT USING (true);
CREATE POLICY "Allow authenticated insert shop items" ON public.shop_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update shop items" ON public.shop_items FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow public read system logs" ON public.system_logs FOR SELECT USING (true);
CREATE POLICY "Allow authenticated insert system logs" ON public.system_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow anon insert system logs" ON public.system_logs FOR INSERT TO anon WITH CHECK (true);

-- 9. REALTIME PUBLICATION (Websocket Subscriptions)
ALTER PUBLICATION supabase_realtime ADD TABLE public.shop_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.system_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;

-- 10. INITIAL SEED INVENTORY (Sample Store Data)
INSERT INTO public.shop_items (sku, title, category, serial_or_imei, condition, acquisition_type, cost_basis, retail_price, status, image_url, specs)
VALUES
('SKU-IPH15-01', 'Apple iPhone 15 Pro 128GB Titanium', 'Phones & Tech', '359281092837192', 'Mint', 'Buy', 12500.00, 18999.00, 'Retail Floor', 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=600&q=80', 'Natural Titanium, Battery 98%, USB-C, Original Box'),
('SKU-MAK-501', 'Makita 18V LXT Brushless Cordless Drill Kit', 'Power Tools', 'MK-9821734-LXT', 'Excellent', 'Buy', 1600.00, 2750.00, 'Retail Floor', 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=600&q=80', 'Includes 2x 4.0Ah Li-ion batteries and rapid charger'),
('SKU-PS5-009', 'Sony PlayStation 5 Disc Edition 825GB', 'Gaming Consoles', 'PS5-839210-SA', 'Excellent', 'Buy', 5200.00, 7999.00, 'Retail Floor', 'https://images.unsplash.com/photo-1606813907291-d86efa9b94db?w=600&q=80', 'White DualSense controller, HDMI 2.1 cable, power cord'),
('SKU-JBL-442', 'JBL Boombox 3 Portable Bluetooth Speaker', 'Audio & Visual', 'JBL-BB3-88219', 'Good', 'Buy', 3200.00, 4899.00, 'Retail Floor', 'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=600&q=80', 'Squad Camo, IP67 waterproof, 24hr battery'),
('SKU-GLD-991', '9ct Yellow Gold Curb Link Chain 22g', 'Fine Jewelry & Gold', 'CERT-GLD-9912', 'Excellent', 'Buy', 9500.00, 14500.00, 'Retail Floor', 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=600&q=80', 'Hallmarked 375, 55cm length, lobster clasp')
ON CONFLICT (sku) DO NOTHING;`;

  const copySqlToClipboard = () => {
    navigator.clipboard.writeText(FULL_SCHEMA_SQL);
    setCopiedSql(true);
    showToast('SQL Copied to Clipboard!', 'Go to Supabase Dashboard -> SQL Editor -> Paste and Run', 'success');
    setTimeout(() => setCopiedSql(false), 3000);
  };

  const downloadSqlFile = () => {
    const blob = new Blob([FULL_SCHEMA_SQL], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'supabase_localmarket_schema.sql';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Downloaded schema.sql', 'File saved. Open it in Supabase SQL Editor.', 'info');
  };

  const copyEnvToClipboard = () => {
    const envText = `VITE_SUPABASE_URL=${inputUrl || 'https://your-project-id.supabase.co'}\nVITE_SUPABASE_ANON_KEY=${inputKey || 'your-anon-public-key'}`;
    navigator.clipboard.writeText(envText);
    setCopiedEnv(true);
    showToast('Copied .env Template', 'Saved to clipboard', 'info');
    setTimeout(() => setCopiedEnv(false), 3000);
  };

  if (!isSupabaseModalOpen) return null;

  const filteredLogs = logFilter === 'ALL' 
    ? supabaseLogs 
    : supabaseLogs.filter(l => l.event_type === logFilter || l.severity === logFilter.toLowerCase());

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 15 }}
        className="w-full max-w-5xl bg-[#141414] border border-[#2A2A2A] rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
      >
        {/* MODAL HEADER */}
        <div className="p-6 border-b border-[#2A2A2A] flex items-center justify-between gap-4 bg-[#181818]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <CloudLightning className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-black text-white font-headline tracking-tight">Supabase API & Database Hub</h2>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Free Tier
                </span>
                {config.isConfigured ? (
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-amber-400 bg-amber-950/40 border border-amber-800/40 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    Setup Required
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Connect your Supabase project, execute schema SQL, and sync Authentication, Shop Items, Profiles, and Logs.
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsSupabaseModalOpen(false)}
            className="p-2 rounded-xl bg-[#222222] text-gray-400 hover:text-white hover:bg-[#2A2A2A] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* NAVIGATION TABS */}
        <div className="flex border-b border-[#2A2A2A] bg-[#121212] px-6 overflow-x-auto gap-2">
          <button
            onClick={() => setActiveTab('setup')}
            className={`py-3.5 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition whitespace-nowrap ${
              activeTab === 'setup'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Key className="w-4 h-4" />
            1. Connect & SQL Setup
            {!config.isConfigured && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('auth')}
            className={`py-3.5 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition whitespace-nowrap ${
              activeTab === 'auth'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Shield className="w-4 h-4" />
            2. Authentication & Staff
          </button>

          <button
            onClick={() => setActiveTab('shop_items')}
            className={`py-3.5 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition whitespace-nowrap ${
              activeTab === 'shop_items'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Package className="w-4 h-4" />
            3. Database: Shop Items
            {cloudItems.length > 0 && (
              <span className="px-1.5 py-0.2 bg-[#2A2A2A] text-gray-300 rounded text-[10px]">
                {cloudItems.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('profiles')}
            className={`py-3.5 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition whitespace-nowrap ${
              activeTab === 'profiles'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Users className="w-4 h-4" />
            4. Database: Profiles & PINs
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`py-3.5 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition whitespace-nowrap ${
              activeTab === 'logs'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Activity className="w-4 h-4" />
            5. Database: System & Audit Logs
            {supabaseLogs.length > 0 && (
              <span className="px-1.5 py-0.2 bg-[#2A2A2A] text-gray-300 rounded text-[10px]">
                {supabaseLogs.length}
              </span>
            )}
          </button>
        </div>

        {/* TAB CONTENTS */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-[#0E0E0E]">
          
          {/* TAB 1: CONNECT & SQL SETUP (PLACE TO PUT THE KEY & SQL) */}
          {activeTab === 'setup' && (
            <div className="space-y-6">
              
              {/* STEP 1: API KEYS INPUT CARD */}
              <div className="p-6 bg-[#161616] border border-[#2A2A2A] rounded-2xl space-y-5">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5" /> Step A: Paste Your Supabase Credentials
                    </span>
                    <h3 className="text-base font-bold text-white mt-0.5">Project URL & Anon Public Key</h3>
                    <p className="text-xs text-gray-400">
                      Find these in your Supabase Dashboard under <strong>Project Settings → API</strong>.
                    </p>
                  </div>

                  {config.isConfigured && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleRunTest}
                        disabled={isTesting}
                        className="px-3 py-1.5 bg-[#222222] hover:bg-[#2A2A2A] text-gray-200 border border-[#333333] rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                        Test Connection
                      </button>
                      <button
                        type="button"
                        onClick={handleClearCredentials}
                        className="p-1.5 bg-red-950/30 hover:bg-red-950/60 text-red-400 border border-red-900/40 rounded-xl transition"
                        title="Clear Saved Credentials"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                <form onSubmit={handleSaveCredentials} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] font-bold text-gray-300 uppercase tracking-wider block mb-1">
                        1. Supabase Project URL
                      </label>
                      <input
                        type="url"
                        required
                        value={inputUrl}
                        onChange={(e) => setInputUrl(e.target.value)}
                        placeholder="https://your-project-id.supabase.co"
                        className="w-full bg-[#0E0E0E] border border-[#2A2A2A] focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono placeholder:text-gray-600 focus:outline-none"
                      />
                      <span className="text-[10px] text-gray-500 mt-1 block">
                        Example: <code className="text-gray-400">https://abcxyzabcdef.supabase.co</code>
                      </span>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-gray-300 uppercase tracking-wider block mb-1">
                        2. Supabase Anon Public Key (API Key)
                      </label>
                      <input
                        type="password"
                        required
                        value={inputKey}
                        onChange={(e) => setInputKey(e.target.value)}
                        placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                        className="w-full bg-[#0E0E0E] border border-[#2A2A2A] focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono placeholder:text-gray-600 focus:outline-none"
                      />
                      <span className="text-[10px] text-gray-500 mt-1 block">
                        Your project&apos;s public anon JWT key from Project Settings → API.
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <div className="text-[11px] text-gray-400 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Stored safely in browser local state & applies immediately to all shop actions.</span>
                    </div>

                    <button
                      type="submit"
                      disabled={isSavingCreds}
                      className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-emerald-900/30"
                    >
                      {isSavingCreds ? <RefreshCw className="w-4 h-4 animate-spin" /> : <SaveIcon className="w-4 h-4" />}
                      Save & Connect to Supabase
                    </button>
                  </div>
                </form>

                {/* CONNECTION & TABLE HEALTH BADGE */}
                {testResult && (
                  <div className={`p-4 rounded-xl border text-xs space-y-2.5 ${
                    testResult.hasShopItemsTable && testResult.hasProfilesTable && testResult.hasSystemLogsTable
                      ? 'bg-emerald-950/30 border-emerald-800/40 text-emerald-300'
                      : 'bg-amber-950/30 border-amber-800/40 text-amber-300'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-bold">
                        {testResult.success ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-amber-400" />
                        )}
                        <span>{testResult.message}</span>
                      </div>
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-black/40">
                        {testResult.success ? 'Connected' : 'Action Required'}
                      </span>
                    </div>

                    {/* Table checklist */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-white/10 text-[11px]">
                      <div className="flex items-center gap-2">
                        {testResult.hasShopItemsTable ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <X className="w-3.5 h-3.5 text-red-400" />
                        )}
                        <span>Table: <strong>public.shop_items</strong> ({testResult.itemCount} rows)</span>
                      </div>

                      <div className="flex items-center gap-2">
                        {testResult.hasProfilesTable ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <X className="w-3.5 h-3.5 text-red-400" />
                        )}
                        <span>Table: <strong>public.profiles</strong> (Staff)</span>
                      </div>

                      <div className="flex items-center gap-2">
                        {testResult.hasSystemLogsTable ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <X className="w-3.5 h-3.5 text-red-400" />
                        )}
                        <span>Table: <strong>public.system_logs</strong> (Audit)</span>
                      </div>
                    </div>

                    {/* SEED BUTTON IF EMPTY */}
                    {testResult.hasShopItemsTable && testResult.itemCount === 0 && (
                      <div className="pt-2 flex items-center justify-between border-t border-white/10">
                        <span className="text-xs">Your <code className="text-emerald-200">shop_items</code> table is empty! Click here to populate it:</span>
                        <button
                          type="button"
                          onClick={handleSeedDatabase}
                          disabled={isSeeding}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition"
                        >
                          {isSeeding ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                          Seed Initial Store Inventory
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* STEP 2: COMPLETE SQL SCRIPT & RUNNER GUIDE */}
              <div className="p-6 bg-[#161616] border border-[#2A2A2A] rounded-2xl space-y-4">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                      <Database className="w-3.5 h-3.5" /> Step B: Initialize Your Empty Supabase Database
                    </span>
                    <h3 className="text-base font-bold text-white mt-0.5">Execute Database Schema in Supabase</h3>
                    <p className="text-xs text-gray-400">
                      Creates the 3 tables, automated auth trigger, RLS policies, and realtime websocket subscriptions.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      onClick={copySqlToClipboard}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition shadow-lg shadow-emerald-900/30"
                    >
                      {copiedSql ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copiedSql ? 'Copied to Clipboard!' : 'Copy Complete SQL Script'}
                    </button>
                    <button
                      onClick={downloadSqlFile}
                      className="px-3.5 py-2 bg-[#222222] hover:bg-[#2A2A2A] text-gray-300 border border-[#333333] rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download .sql
                    </button>
                  </div>
                </div>

                {/* 4-STEP VISUAL INSTRUCTIONS */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 py-2">
                  <div className="p-3 bg-[#0E0E0E] border border-[#242424] rounded-xl space-y-1">
                    <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px] font-black">1</div>
                    <p className="text-xs font-bold text-white">Open Supabase</p>
                    <p className="text-[11px] text-gray-400">Go to your project dashboard on <strong>supabase.com</strong></p>
                  </div>

                  <div className="p-3 bg-[#0E0E0E] border border-[#242424] rounded-xl space-y-1">
                    <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px] font-black">2</div>
                    <p className="text-xs font-bold text-white">Click SQL Editor</p>
                    <p className="text-[11px] text-gray-400">Select <strong>SQL Editor</strong> on the left sidebar (<code className="text-emerald-400">&gt;_</code> icon)</p>
                  </div>

                  <div className="p-3 bg-[#0E0E0E] border border-[#242424] rounded-xl space-y-1">
                    <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px] font-black">3</div>
                    <p className="text-xs font-bold text-white">Paste SQL Script</p>
                    <p className="text-[11px] text-gray-400">Click <strong>+ New Query</strong> and paste the copied SQL below</p>
                  </div>

                  <div className="p-3 bg-[#0E0E0E] border border-[#242424] rounded-xl space-y-1">
                    <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px] font-black">4</div>
                    <p className="text-xs font-bold text-white">Click Run</p>
                    <p className="text-[11px] text-gray-400">Press <strong>Run</strong> (or Cmd+Enter). Ready in 2 seconds!</p>
                  </div>
                </div>

                {/* SQL CODE VIEWER */}
                <div className="relative bg-[#0A0A0A] border border-[#242424] rounded-2xl p-4 font-mono text-xs text-gray-300 max-h-[300px] overflow-y-auto custom-scrollbar">
                  <div className="flex items-center justify-between pb-2 border-b border-[#202020] mb-3">
                    <span className="text-emerald-400 font-bold">-- Complete Supabase Schema (Ready to Execute)</span>
                    <button
                      onClick={copySqlToClipboard}
                      className="text-[11px] text-gray-400 hover:text-white flex items-center gap-1"
                    >
                      {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      Copy All
                    </button>
                  </div>
                  <pre className="text-[11px] leading-relaxed text-gray-400 select-all whitespace-pre-wrap">
                    {FULL_SCHEMA_SQL}
                  </pre>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: AUTHENTICATION */}
          {activeTab === 'auth' && (
            <div className="space-y-6">
              {/* CURRENT AUTH STATUS CARD */}
              <div className="p-6 bg-[#161616] border border-[#2A2A2A] rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <Shield className="w-7 h-7" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">Current Session State</span>
                    <h3 className="text-lg font-bold text-white">
                      {supabaseUser ? supabaseUser.email : 'Local Cashier Session (Thabo Molefe)'}
                    </h3>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                      <span>Role: <strong className="text-emerald-400">{currentUserProfile?.role || 'Senior Cashier'}</strong></span>
                      <span>•</span>
                      <span>Code: <code className="text-gray-300">{currentUserProfile?.cashier_code || 'CSH-01-SOW'}</code></span>
                      <span>•</span>
                      <span>Provider: <strong className="text-gray-300">{supabaseUser?.app_metadata?.provider || 'Supabase Free Tier'}</strong></span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto">
                  {supabaseUser ? (
                    <button
                      onClick={handleSignOut}
                      disabled={authLoading}
                      className="px-4 py-2 bg-[#222222] hover:bg-red-950/40 text-red-400 border border-[#333333] hover:border-red-800/40 rounded-xl text-xs font-bold flex items-center gap-2 transition"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  ) : (
                    <div className="text-xs text-amber-400 bg-amber-950/30 border border-amber-900/30 px-3 py-2 rounded-xl">
                      Standard local workstation active. Authenticate with Supabase to link cloud profile.
                    </div>
                  )}
                </div>
              </div>

              {/* AUTH FORM: SIGN IN / SIGN UP */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 bg-[#161616] border border-[#2A2A2A] rounded-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <LogIn className="w-4 h-4 text-emerald-400" />
                      Supabase Free Tier Auth Controller
                    </h4>
                    <div className="flex bg-[#0A0A0A] p-0.5 rounded-lg border border-[#2A2A2A]">
                      <button
                        onClick={() => { setAuthMode('signin'); setAuthError(null); }}
                        className={`px-3 py-1 text-xs font-bold rounded-md transition ${authMode === 'signin' ? 'bg-[#2A2A2A] text-white' : 'text-gray-400'}`}
                      >
                        Sign In
                      </button>
                      <button
                        onClick={() => { setAuthMode('signup'); setAuthError(null); }}
                        className={`px-3 py-1 text-xs font-bold rounded-md transition ${authMode === 'signup' ? 'bg-[#2A2A2A] text-white' : 'text-gray-400'}`}
                      >
                        Register
                      </button>
                    </div>
                  </div>

                  {authError && (
                    <div className="p-3 bg-red-950/40 border border-red-800/40 rounded-xl text-xs text-red-300 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                      <span>{authError}</span>
                    </div>
                  )}

                  <form onSubmit={handleAuthSubmit} className="space-y-3.5">
                    {authMode === 'signup' && (
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Staff Full Name</label>
                        <input
                          type="text"
                          required
                          value={authFullName}
                          onChange={(e) => setAuthFullName(e.target.value)}
                          placeholder="e.g. Sipho Ndlovu"
                          className="w-full mt-1 bg-[#0E0E0E] border border-[#2A2A2A] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    )}

                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase">Email Address</label>
                      <input
                        type="email"
                        required
                        value={authEmail}
                        onChange={(e) => setAuthEmail(e.target.value)}
                        placeholder="cashier@localmarket.co.za"
                        className="w-full mt-1 bg-[#0E0E0E] border border-[#2A2A2A] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase">Password</label>
                      <input
                        type="password"
                        required
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full mt-1 bg-[#0E0E0E] border border-[#2A2A2A] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    {authMode === 'signup' && (
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Assigned Staff Role</label>
                        <select
                          value={authRole}
                          onChange={(e) => setAuthRole(e.target.value as UserRole)}
                          className="w-full mt-1 bg-[#0E0E0E] border border-[#2A2A2A] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                        >
                          <option value="cashier">Cashier</option>
                          <option value="senior_cashier">Senior Cashier</option>
                          <option value="manager">Branch Manager</option>
                          <option value="admin">System Administrator</option>
                        </select>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={authLoading}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30 disabled:opacity-50"
                    >
                      {authLoading ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : authMode === 'signin' ? (
                        <>
                          <LogIn className="w-4 h-4" />
                          Sign In via Supabase Auth
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-4 h-4" />
                          Create Staff User & Auto-Profile
                        </>
                      )}
                    </button>
                  </form>
                </div>

                {/* AUTH ARCHITECTURE NOTICE */}
                <div className="p-6 bg-[#161616] border border-[#2A2A2A] rounded-2xl space-y-4 flex flex-col justify-between">
                  <div className="space-y-3">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <Key className="w-4 h-4 text-emerald-400" />
                      Supabase Security & RLS Specs
                    </h4>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      Our Supabase Free Tier implementation is wired directly to PostgreSQL Row-Level Security (RLS) and triggers:
                    </p>
                    <ul className="text-xs text-gray-300 space-y-2">
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <span><strong>Trigger on_auth_user_created:</strong> Whenever a user is registered via Auth, an entry in <code className="text-emerald-300">public.profiles</code> is automatically generated with a unique Cashier Code.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <span><strong>Auto-Sign Token:</strong> JWT access token with auto-refresh is held in safe client-side persistent storage.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <span><strong>Audit-Ready:</strong> Every authentication event emits an audit log record into <code className="text-emerald-300">public.system_logs</code>.</span>
                      </li>
                    </ul>
                  </div>

                  <div className="p-3 bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl text-[11px] text-gray-400">
                    💡 <em>Tip: You can use your Supabase Dashboard to view active sessions or enable Social OAuth / Magic Links anytime without code changes.</em>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SHOP ITEMS (DATABASE) */}
          {activeTab === 'shop_items' && (
            <div className="space-y-6">
              {/* ACTIONS BAR */}
              <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-[#161616] border border-[#2A2A2A] rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <Package className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Table: public.shop_items</h3>
                    <p className="text-[11px] text-gray-400">Retail Inventory & Forfeited Collateral records</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={loadCloudItems}
                    disabled={loadingItems}
                    className="px-3 py-1.5 bg-[#222222] hover:bg-[#2A2A2A] text-gray-200 border border-[#333333] rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingItems ? 'animate-spin' : ''}`} />
                    Refresh Cloud
                  </button>
                  <button
                    onClick={handleSeedDatabase}
                    disabled={isSeeding}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-lg shadow-emerald-900/30"
                  >
                    <CloudLightning className="w-3.5 h-3.5" />
                    Seed Cloud Inventory
                  </button>
                </div>
              </div>

              {/* QUICK INSERT FORM */}
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (!newItemTitle) return;
                setIsAddingItem(true);
                try {
                  const sku = newItemSku || `SKU-SB-${Math.floor(1000 + Math.random() * 9000)}`;
                  await shopItemsApi.createItem({
                    sku,
                    title: newItemTitle,
                    category: newItemCategory,
                    retail_price: parseFloat(newItemPrice) || 0,
                    cost_basis: Math.round((parseFloat(newItemPrice) || 0) * 0.6),
                    status: 'Retail Floor',
                    condition: 'Mint',
                    acquisition_type: 'Buy',
                    image_url: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600&q=80',
                    specs: 'Created via Supabase Free Tier Cloud API'
                  });
                  showToast('Item Created', `${newItemTitle} [${sku}] stored in Supabase shop_items`, 'success');
                  setNewItemTitle('');
                  setNewItemSku('');
                  await loadCloudItems();
                  await syncShopItemsWithSupabase();
                } catch (err: any) {
                  showToast('Creation Failed', err.message, 'error');
                } finally {
                  setIsAddingItem(false);
                }
              }} className="p-4 bg-[#161616] border border-[#2A2A2A] rounded-2xl grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
                <div className="sm:col-span-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Item Title</label>
                  <input
                    type="text"
                    required
                    value={newItemTitle}
                    onChange={(e) => setNewItemTitle(e.target.value)}
                    placeholder="e.g. Samsung Galaxy S24 Ultra"
                    className="w-full mt-1 bg-[#0E0E0E] border border-[#2A2A2A] rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Category</label>
                  <select
                    value={newItemCategory}
                    onChange={(e) => setNewItemCategory(e.target.value)}
                    className="w-full mt-1 bg-[#0E0E0E] border border-[#2A2A2A] rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Phones & Tech">Phones & Tech</option>
                    <option value="Power Tools">Power Tools</option>
                    <option value="Audio & Visual">Audio & Visual</option>
                    <option value="Fine Jewelry & Gold">Fine Jewelry</option>
                    <option value="Gaming Consoles">Gaming</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Retail Price (ZAR)</label>
                  <input
                    type="number"
                    value={newItemPrice}
                    onChange={(e) => setNewItemPrice(e.target.value)}
                    className="w-full mt-1 bg-[#0E0E0E] border border-[#2A2A2A] rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <button
                    type="submit"
                    disabled={isAddingItem}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow"
                  >
                    {isAddingItem ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    Add to Cloud
                  </button>
                </div>
              </form>

              {/* ITEMS LIST TABLE */}
              <div className="bg-[#161616] border border-[#2A2A2A] rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#1D1D1D] text-gray-400 font-bold uppercase text-[10px] tracking-wider border-b border-[#2A2A2A]">
                      <tr>
                        <th className="py-3 px-4">SKU / ID</th>
                        <th className="py-3 px-4">Item Title</th>
                        <th className="py-3 px-4">Category</th>
                        <th className="py-3 px-4">Condition</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Retail Price</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#242424] text-gray-300">
                      {cloudItems.length > 0 ? (
                        cloudItems.map(item => (
                          <tr key={item.id} className="hover:bg-[#1C1C1C] transition">
                            <td className="py-3 px-4 font-mono text-emerald-400 font-bold">{item.sku}</td>
                            <td className="py-3 px-4 font-medium text-white">{item.title}</td>
                            <td className="py-3 px-4 text-gray-400">{item.category}</td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded text-[10px] bg-[#242424] text-gray-300">
                                {item.condition}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                                {item.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right font-bold text-white font-mono">
                              R {Number(item.retail_price).toFixed(2)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-gray-500">
                            No items found in Supabase. Click <strong>&quot;Seed Cloud Inventory&quot;</strong> above or add a product.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: PROFILES (DATABASE) */}
          {activeTab === 'profiles' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-[#161616] border border-[#2A2A2A] rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Table: public.profiles</h3>
                    <p className="text-[11px] text-gray-400">Staff records, Cashier assignments & security PINs</p>
                  </div>
                </div>

                <button
                  onClick={loadProfiles}
                  disabled={loadingProfiles}
                  className="px-3 py-1.5 bg-[#222222] hover:bg-[#2A2A2A] text-gray-200 border border-[#333333] rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingProfiles ? 'animate-spin' : ''}`} />
                  Refresh Profiles
                </button>
              </div>

              {/* PROFILES GRID */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {profiles.length > 0 ? (
                  profiles.map(profile => (
                    <div key={profile.id} className="p-5 bg-[#161616] border border-[#2A2A2A] rounded-2xl space-y-3 relative group">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded-full font-bold">
                          {profile.cashier_code}
                        </span>
                        <span className="text-[10px] uppercase font-bold text-gray-400 px-2 py-0.5 bg-[#222222] rounded">
                          {profile.role}
                        </span>
                      </div>

                      <div>
                        <h4 className="font-bold text-white text-sm">{profile.full_name}</h4>
                        <p className="text-xs text-gray-400">{profile.email || 'No email attached'}</p>
                      </div>

                      <div className="pt-2 border-t border-[#242424] flex items-center justify-between text-[11px] text-gray-400">
                        <span>Digital Signature:</span>
                        <span className="text-emerald-400 font-mono text-[10px] truncate max-w-[140px]">
                          {profile.digital_signature || 'Verified'}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-full p-8 text-center text-gray-500 bg-[#161616] border border-[#2A2A2A] rounded-2xl">
                    <p className="text-xs">No staff profiles registered yet. Create a user via <strong>2. Authentication & Staff</strong> to automatically create a profile in Supabase.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: SYSTEM & AUDIT LOGS (DATABASE) */}
          {activeTab === 'logs' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-[#161616] border border-[#2A2A2A] rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <Activity className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Table: public.system_logs</h3>
                    <p className="text-[11px] text-gray-400">SAPS compliance, financial audit, and cashier action trail</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      await logSystemEvent(
                        'API_TEST_PING',
                        {
                          timestamp: new Date().toISOString(),
                          client: 'LocalMarket Web UI',
                          tier: 'Supabase Free Tier',
                          status: 'Operational'
                        },
                        'audit'
                      );
                      showToast('Audit Log Dispatched', 'Inserted into Supabase public.system_logs', 'success');
                      await fetchSupabaseLogs();
                    }}
                    className="px-3 py-1.5 bg-[#222222] hover:bg-[#2A2A2A] text-gray-200 border border-[#333333] rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
                  >
                    <Send className="w-3.5 h-3.5 text-emerald-400" />
                    Dispatch Test Event
                  </button>
                  <button
                    onClick={fetchSupabaseLogs}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Poll Logs
                  </button>
                </div>
              </div>

              {/* LOG FILTER PILLS */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
                {['ALL', 'SALE_COMPLETED', 'INTAKE_CREATED', 'AUTH_SIGN_IN', 'VAULT_FORFEIT_TRANSFER', 'DATABASE_SEEDED', 'audit', 'warning'].map(f => (
                  <button
                    key={f}
                    onClick={() => setLogFilter(f)}
                    className={`px-3 py-1 rounded-lg font-bold transition whitespace-nowrap ${
                      logFilter === f
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-[#181818] text-gray-400 hover:text-white border border-[#2A2A2A]'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>

              {/* LOGS STREAM */}
              <div className="bg-[#161616] border border-[#2A2A2A] rounded-2xl divide-y divide-[#242424] max-h-[420px] overflow-y-auto custom-scrollbar">
                {filteredLogs.length > 0 ? (
                  filteredLogs.map(log => (
                    <div key={log.id} className="p-4 hover:bg-[#1A1A1A] transition space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                            log.severity === 'critical' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                            log.severity === 'audit' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                            log.severity === 'warning' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                            'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}>
                            {log.event_type}
                          </span>
                          <span className="text-xs font-bold text-white">{log.actor_name}</span>
                          {log.saps_reference && (
                            <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/40 border border-cyan-800/40 px-2 py-0.5 rounded">
                              Ref: {log.saps_reference}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] font-mono text-gray-500">
                          {new Date(log.created_at).toLocaleTimeString()}
                        </span>
                      </div>

                      {log.details && (
                        <div className="p-2.5 bg-[#0D0D0D] border border-[#222222] rounded-xl font-mono text-[11px] text-gray-400 overflow-x-auto">
                          {typeof log.details === 'object' ? JSON.stringify(log.details, null, 2) : String(log.details)}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="p-12 text-center text-gray-500 space-y-2">
                    <Activity className="w-8 h-8 mx-auto opacity-30" />
                    <p className="text-xs">No matching system logs recorded in Supabase yet.</p>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* MODAL FOOTER */}
        <div className="p-4 border-t border-[#2A2A2A] bg-[#161616] flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-4 text-gray-400">
            <span className="flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-emerald-400" />
              API: <strong>@supabase/supabase-js v2</strong>
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-blue-400" />
              PostgreSQL (RLS & Realtime)
            </span>
          </div>

          <button
            onClick={() => setIsSupabaseModalOpen(false)}
            className="px-5 py-2 bg-[#262626] hover:bg-[#333333] text-white rounded-xl font-bold transition ml-auto"
          >
            Close Center
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// Save Icon helper
const SaveIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
    <polyline points="17 21 17 13 7 13 7 21"></polyline>
    <polyline points="7 3 7 8 15 8"></polyline>
  </svg>
);
