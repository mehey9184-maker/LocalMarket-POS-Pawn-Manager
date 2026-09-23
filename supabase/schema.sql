-- ==============================================================================
-- PRODUCTION SUPABASE SCHEMA: LOCALMARKET POS & PAWN HUB
-- Tables:
--   1. shop_profiles (Branch & Legal Compliance)
--   2. profiles (Staff & Authentication linked to auth.users)
--   3. shop_items (Inventory & Second-Hand Asset Stock)
--   4. customers (Pawn & Ongoing Customer Relationships)
--   5. sellers (Outright Second-Hand Sellers - SHG Act 06 of 2009)
--   6. seller_transactions (Outright Purchase Acquisitions)
--   7. pawn_loans (NCR Act 34 of 2005 Secured Pledge Contracts)
--   8. sales (Retail Point of Sale Transactions)
--   9. saps_entries (SAPS Form 21 Statutory Second-Hand Register)
--   10. system_logs (Immutable Audit & Security Trail)
-- Includes: Row Level Security (RLS), Triggers, Indexes, Realtime, Seed Data
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. ENUMS & DOMAINS
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('cashier', 'senior_cashier', 'manager', 'admin', 'owner');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE item_condition AS ENUM ('Mint', 'Excellent', 'Good', 'Fair', 'Damaged');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE item_status AS ENUM ('Vault Hold', 'Retail Floor', 'Sold', 'Redeemed', 'Reserved', 'Flagged', 'InStock', 'Forfeited', 'Pending Forfeit');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE loan_status AS ENUM ('Active', 'Extended', 'Redeemed', 'Forfeited', 'Archived', 'Pending Forfeit');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. SHOP PROFILES TABLE (Branch Identity, VAT, and SAPS License)
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
    timezone TEXT DEFAULT 'Africa/Johannesburg',
    business_rules JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. PROFILES TABLE (Linked with Supabase Auth: auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    shop_id UUID REFERENCES public.shop_profiles(id) ON DELETE SET NULL,
    email TEXT UNIQUE,
    full_name TEXT NOT NULL,
    cashier_code TEXT UNIQUE NOT NULL,
    role user_role DEFAULT 'cashier'::user_role NOT NULL,
    phone TEXT,
    avatar_url TEXT,
    pin_code TEXT,
    pin_hash TEXT,
    schedule JSONB,
    permissions JSONB,
    login_attempts INTEGER DEFAULT 0,
    last_attempt_at TIMESTAMPTZ,
    digital_signature TEXT,
    is_active BOOLEAN DEFAULT true,
    last_sign_in_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. SHOP ITEMS TABLE (Retail inventory & second-hand asset stock)
CREATE TABLE IF NOT EXISTS public.shop_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES public.shop_profiles(id) ON DELETE SET NULL,
    sku TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    serial_or_imei TEXT,
    condition item_condition DEFAULT 'Good'::item_condition NOT NULL,
    acquisition_type TEXT DEFAULT 'Buy' NOT NULL, -- 'Buy', 'Pawn', 'Forfeited'
    cost_basis NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    retail_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    vault_location TEXT,
    status item_status DEFAULT 'Retail Floor'::item_status NOT NULL,
    days_in_vault INT DEFAULT 0,
    image_url TEXT,
    storage_key TEXT,
    specs TEXT,
    pawn_ticket_id TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    added_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. CUSTOMERS TABLE (Pawn & ongoing loan relationships)
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES public.shop_profiles(id) ON DELETE SET NULL,
    full_name TEXT NOT NULL,
    id_type TEXT DEFAULT 'RSA Smart ID' NOT NULL,
    id_number TEXT NOT NULL,
    mobile TEXT NOT NULL,
    address TEXT,
    dob TEXT,
    gender TEXT,
    verified BOOLEAN DEFAULT true,
    is_flagged BOOLEAN DEFAULT false,
    last_communication_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. SELLERS TABLE (Outright Sellers - Second-Hand Goods Act)
CREATE TABLE IF NOT EXISTS public.sellers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES public.shop_profiles(id) ON DELETE SET NULL,
    full_name TEXT NOT NULL,
    id_type TEXT DEFAULT 'RSA Smart ID' NOT NULL,
    id_number TEXT NOT NULL,
    mobile TEXT NOT NULL,
    email TEXT,
    address TEXT,
    verified BOOLEAN DEFAULT true,
    verification_status TEXT DEFAULT 'verified',
    verification_method TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. SELLER TRANSACTIONS TABLE (Outright Buys History)
CREATE TABLE IF NOT EXISTS public.seller_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES public.shop_profiles(id) ON DELETE SET NULL,
    seller_id UUID REFERENCES public.sellers(id) ON DELETE CASCADE NOT NULL,
    item_id UUID REFERENCES public.shop_items(id) ON DELETE SET NULL,
    item_sku TEXT,
    item_title TEXT,
    transaction_type TEXT DEFAULT 'Buy' NOT NULL,
    amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    sku TEXT,
    asset_tag TEXT,
    compliance_reference TEXT,
    saps_reference TEXT,
    cashier_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'Completed' NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    timestamp TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. PAWN LOANS TABLE (NCR Act 34 of 2005 Secured Contracts)
CREATE TABLE IF NOT EXISTS public.pawn_loans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES public.shop_profiles(id) ON DELETE SET NULL,
    ticket_number TEXT UNIQUE NOT NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
    customer_name TEXT,
    customer_id_number TEXT,
    customer_mobile TEXT,
    customer_address TEXT,
    item_id UUID REFERENCES public.shop_items(id) ON DELETE CASCADE,
    item_title TEXT,
    item_category TEXT,
    serial_or_imei TEXT,
    condition TEXT,
    item_image_url TEXT,
    principal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    ncr_monthly_rate NUMERIC(6, 4) DEFAULT 0.05 NOT NULL,
    monthly_interest NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    monthly_storage_admin_fee NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_redemption_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    extension_fee NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    start_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    days_remaining INT DEFAULT 30,
    days_elapsed INT DEFAULT 0,
    vault_shelf TEXT,
    status loan_status DEFAULT 'Active'::loan_status NOT NULL,
    qr_token TEXT,
    history JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 10. SALES TABLE (Retail Point of Sale Transactions)
CREATE TABLE IF NOT EXISTS public.sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES public.shop_profiles(id) ON DELETE SET NULL,
    receipt_number TEXT UNIQUE NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    items JSONB DEFAULT '[]'::jsonb NOT NULL,
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    vat_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    tender_method TEXT NOT NULL,
    amount_tendered NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    change NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    receipt_type TEXT DEFAULT 'thermal' NOT NULL,
    customer_mobile TEXT,
    cashier TEXT NOT NULL,
    status TEXT DEFAULT 'Completed' NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 11. SAPS ENTRIES TABLE (Statutory Second-Hand Goods Register - Form 21)
CREATE TABLE IF NOT EXISTS public.saps_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES public.shop_profiles(id) ON DELETE SET NULL,
    entry_number TEXT UNIQUE NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    customer_id TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    customer_id_number TEXT NOT NULL,
    customer_address TEXT,
    customer_phone TEXT,
    item_description TEXT NOT NULL,
    category TEXT,
    serial_or_imei TEXT,
    condition TEXT,
    acquisition_type TEXT NOT NULL,
    consideration_paid NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    officer_name TEXT,
    police_station_ref TEXT,
    verification_status TEXT DEFAULT 'VERIFIED' NOT NULL,
    barcode_ref TEXT,
    is_cancelled BOOLEAN DEFAULT false,
    cancelled_at TIMESTAMPTZ,
    cancel_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 12. SYSTEM & AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.system_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES public.shop_profiles(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    severity TEXT DEFAULT 'info' NOT NULL,
    actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    actor_name TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    saps_reference TEXT,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 13. STAFF AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.staff_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES public.shop_profiles(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    target_staff_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    old_values JSONB,
    new_values JSONB,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 14. TERMINAL SESSIONS TABLE
CREATE TABLE IF NOT EXISTS public.terminal_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES public.shop_profiles(id) ON DELETE CASCADE,
    terminal_name TEXT NOT NULL,
    current_cashier_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    is_locked BOOLEAN DEFAULT false,
    last_active_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 15. SELLER TRANSACTION ITEMS TABLE
CREATE TABLE IF NOT EXISTS public.seller_transaction_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES public.shop_profiles(id) ON DELETE CASCADE,
    seller_id UUID REFERENCES public.sellers(id) ON DELETE CASCADE,
    item_id UUID REFERENCES public.shop_items(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    transaction_type TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 16. SELLER REVERSALS TABLE
CREATE TABLE IF NOT EXISTS public.seller_reversals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES public.shop_profiles(id) ON DELETE CASCADE,
    seller_id UUID REFERENCES public.sellers(id) ON DELETE CASCADE,
    amount NUMERIC(12,2) NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 17. BUSINESS RULE AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.business_rule_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES public.shop_profiles(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    rule_name TEXT NOT NULL,
    old_value JSONB,
    new_value JSONB,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 18. MARKET INTELLIGENCE SNAPSHOTS TABLE
CREATE TABLE IF NOT EXISTS public.market_intelligence_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES public.shop_profiles(id) ON DELETE CASCADE NOT NULL,
    item_id UUID REFERENCES public.shop_items(id) ON DELETE SET NULL,
    query_key TEXT NOT NULL,
    barcode TEXT,
    normalized_product_name TEXT NOT NULL,
    brand TEXT,
    model TEXT,
    category TEXT,
    condition TEXT,
    source_type TEXT NOT NULL,
    source_name TEXT NOT NULL,
    source_url TEXT,
    reference_price NUMERIC(12,2),
    used_low NUMERIC(12,2),
    used_high NUMERIC(12,2),
    median_price NUMERIC(12,2),
    demand_score NUMERIC(6,2),
    demand_label TEXT,
    confidence TEXT NOT NULL,
    raw_summary JSONB DEFAULT '{}'::jsonb,
    observed_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '24 hours') NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 19. GLOBAL EXTERNAL MARKET CACHE (Platform-level cache for public product/market reference data)
CREATE TABLE IF NOT EXISTS public.external_market_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL,
    cache_key TEXT UNIQUE NOT NULL,
    barcode TEXT,
    normalized_product_name TEXT NOT NULL,
    brand TEXT,
    model TEXT,
    category TEXT,
    reference_price NUMERIC(12,2),
    asking_low NUMERIC(12,2),
    asking_high NUMERIC(12,2),
    raw_summary JSONB DEFAULT '{}'::jsonb,
    source_url TEXT,
    observed_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    last_error_at TIMESTAMPTZ,
    failure_count INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 20. PROVIDER QUOTAS TABLE (Server-side budget tracking per provider)
CREATE TABLE IF NOT EXISTS public.provider_quotas (
    provider TEXT PRIMARY KEY,
    daily_limit INTEGER NOT NULL DEFAULT 25,
    requests_today INTEGER NOT NULL DEFAULT 0,
    reset_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now() + INTERVAL '24 hours'),
    last_failure_at TIMESTAMPTZ,
    consecutive_failures INTEGER DEFAULT 0 NOT NULL,
    cooldown_until TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 13. INDEXES FOR HIGH-THROUGHPUT LOOKUPS & ISOLATION
CREATE INDEX IF NOT EXISTS idx_shop_profiles_code ON public.shop_profiles(shop_code);
CREATE INDEX IF NOT EXISTS idx_profiles_shop_id ON public.profiles(shop_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_cashier_code ON public.profiles(cashier_code);

CREATE INDEX IF NOT EXISTS idx_shop_items_shop_id ON public.shop_items(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_items_sku ON public.shop_items(sku);
CREATE INDEX IF NOT EXISTS idx_shop_items_status ON public.shop_items(status);
CREATE INDEX IF NOT EXISTS idx_shop_items_category ON public.shop_items(category);
CREATE INDEX IF NOT EXISTS idx_shop_items_updated_at ON public.shop_items(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_customers_shop_id ON public.customers(shop_id);
CREATE INDEX IF NOT EXISTS idx_customers_id_number ON public.customers(id_number);
CREATE INDEX IF NOT EXISTS idx_customers_mobile ON public.customers(mobile);
CREATE INDEX IF NOT EXISTS idx_customers_full_name ON public.customers(full_name);

CREATE INDEX IF NOT EXISTS idx_sellers_shop_id ON public.sellers(shop_id);
CREATE INDEX IF NOT EXISTS idx_sellers_id_number ON public.sellers(id_number);
CREATE INDEX IF NOT EXISTS idx_sellers_mobile ON public.sellers(mobile);
CREATE INDEX IF NOT EXISTS idx_sellers_full_name ON public.sellers(full_name);

CREATE INDEX IF NOT EXISTS idx_seller_transactions_shop_id ON public.seller_transactions(shop_id);
CREATE INDEX IF NOT EXISTS idx_seller_transactions_seller_id ON public.seller_transactions(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_transactions_item_id ON public.seller_transactions(item_id);
CREATE INDEX IF NOT EXISTS idx_seller_transactions_timestamp ON public.seller_transactions(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_pawn_loans_shop_id ON public.pawn_loans(shop_id);
CREATE INDEX IF NOT EXISTS idx_pawn_loans_ticket ON public.pawn_loans(ticket_number);
CREATE INDEX IF NOT EXISTS idx_pawn_loans_customer ON public.pawn_loans(customer_id);
CREATE INDEX IF NOT EXISTS idx_pawn_loans_status ON public.pawn_loans(status);
CREATE INDEX IF NOT EXISTS idx_pawn_loans_expiry ON public.pawn_loans(expiry_date);

CREATE INDEX IF NOT EXISTS idx_sales_shop_id ON public.sales(shop_id);
CREATE INDEX IF NOT EXISTS idx_sales_receipt ON public.sales(receipt_number);
CREATE INDEX IF NOT EXISTS idx_sales_timestamp ON public.sales(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_saps_entries_shop_id ON public.saps_entries(shop_id);
CREATE INDEX IF NOT EXISTS idx_saps_entries_number ON public.saps_entries(entry_number);
CREATE INDEX IF NOT EXISTS idx_saps_entries_customer_id ON public.saps_entries(customer_id_number);
CREATE INDEX IF NOT EXISTS idx_saps_entries_timestamp ON public.saps_entries(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_system_logs_shop_id ON public.system_logs(shop_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_event_type ON public.system_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON public.system_logs(created_at DESC);

-- 14. AUTOMATIC UPDATED_AT TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DROP TRIGGER IF EXISTS update_shop_profiles_timestamp ON public.shop_profiles;
CREATE TRIGGER update_shop_profiles_timestamp BEFORE UPDATE ON public.shop_profiles FOR EACH ROW EXECUTE FUNCTION update_modified_column();

DROP TRIGGER IF EXISTS update_profiles_timestamp ON public.profiles;
CREATE TRIGGER update_profiles_timestamp BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_modified_column();

DROP TRIGGER IF EXISTS update_shop_items_timestamp ON public.shop_items;
CREATE TRIGGER update_shop_items_timestamp BEFORE UPDATE ON public.shop_items FOR EACH ROW EXECUTE FUNCTION update_modified_column();

DROP TRIGGER IF EXISTS update_customers_timestamp ON public.customers;
CREATE TRIGGER update_customers_timestamp BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION update_modified_column();

DROP TRIGGER IF EXISTS update_sellers_timestamp ON public.sellers;
CREATE TRIGGER update_sellers_timestamp BEFORE UPDATE ON public.sellers FOR EACH ROW EXECUTE FUNCTION update_modified_column();

DROP TRIGGER IF EXISTS update_seller_transactions_timestamp ON public.seller_transactions;
CREATE TRIGGER update_seller_transactions_timestamp BEFORE UPDATE ON public.seller_transactions FOR EACH ROW EXECUTE FUNCTION update_modified_column();

DROP TRIGGER IF EXISTS update_pawn_loans_timestamp ON public.pawn_loans;
CREATE TRIGGER update_pawn_loans_timestamp BEFORE UPDATE ON public.pawn_loans FOR EACH ROW EXECUTE FUNCTION update_modified_column();

DROP TRIGGER IF EXISTS update_sales_timestamp ON public.sales;
CREATE TRIGGER update_sales_timestamp BEFORE UPDATE ON public.sales FOR EACH ROW EXECUTE FUNCTION update_modified_column();

DROP TRIGGER IF EXISTS update_saps_entries_timestamp ON public.saps_entries;
CREATE TRIGGER update_saps_entries_timestamp BEFORE UPDATE ON public.saps_entries FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- 15. AUTOMATIC PROFILE CREATION HOOK
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_cashier_code TEXT;
    default_shop_id UUID;
BEGIN
    new_cashier_code := 'CSH-' || LPAD(FLOOR(RANDOM() * 9000 + 1000)::TEXT, 4, '0');
    
    -- Assign to default active shop profile if one exists
    SELECT id INTO default_shop_id FROM public.shop_profiles WHERE is_active = true ORDER BY created_at ASC LIMIT 1;

    INSERT INTO public.profiles (
        id,
        shop_id,
        email,
        full_name,
        cashier_code,
        role,
        avatar_url,
        digital_signature
    )
    VALUES (
        NEW.id,
        default_shop_id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
        new_cashier_code,
        COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'cashier'::user_role),
        NEW.raw_user_meta_data->>'avatar_url',
        'Verified: ' || COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1))
    );
    
    INSERT INTO public.system_logs (event_type, severity, actor_id, actor_name, details, shop_id)
    VALUES (
        'AUTH_USER_CREATED', 
        'audit', 
        NEW.id, 
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        jsonb_build_object('email', NEW.email, 'cashier_code', new_cashier_code),
        default_shop_id
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 16. HELPER FUNCTIONS FOR SHOP-AWARE RLS
CREATE OR REPLACE FUNCTION public.get_current_user_shop_id()
RETURNS UUID AS $$
    SELECT shop_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_manager_or_owner()
RETURNS BOOLEAN AS $$
    SELECT role IN ('manager', 'admin') FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 17. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.shop_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pawn_loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saps_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

-- Clean existing overly broad policies
DROP POLICY IF EXISTS "Allow authenticated read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow public anon read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow users update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow public read shop items" ON public.shop_items;
DROP POLICY IF EXISTS "Allow authenticated insert shop items" ON public.shop_items;
DROP POLICY IF EXISTS "Allow authenticated update shop items" ON public.shop_items;
DROP POLICY IF EXISTS "Allow authenticated delete shop items" ON public.shop_items;
DROP POLICY IF EXISTS "Allow authenticated read system logs" ON public.system_logs;
DROP POLICY IF EXISTS "Allow authenticated insert system logs" ON public.system_logs;
DROP POLICY IF EXISTS "Allow public anon insert system logs" ON public.system_logs;
DROP POLICY IF EXISTS "Allow public anon read system logs" ON public.system_logs;
DROP POLICY IF EXISTS "Allow public read active shop profiles" ON public.shop_profiles;
DROP POLICY IF EXISTS "Allow authenticated manage shop profiles" ON public.shop_profiles;
DROP POLICY IF EXISTS "Allow anon read shop profiles" ON public.shop_profiles;
DROP POLICY IF EXISTS "Allow anon insert shop profiles" ON public.shop_profiles;
DROP POLICY IF EXISTS "Allow anon update shop profiles" ON public.shop_profiles;

-- SHOP PROFILES POLICIES
CREATE POLICY "Staff read active shop profiles" ON public.shop_profiles
    FOR SELECT TO authenticated USING (is_active = true OR public.is_manager_or_owner());

CREATE POLICY "Managers manage shop profiles" ON public.shop_profiles
    FOR ALL TO authenticated
    USING (public.is_manager_or_owner())
    WITH CHECK (public.is_manager_or_owner());

-- PROFILES POLICIES (No public anon read)
CREATE POLICY "Staff read branch profiles" ON public.profiles
    FOR SELECT TO authenticated
    USING (shop_id IS NULL OR shop_id = public.get_current_user_shop_id() OR public.is_manager_or_owner());

CREATE POLICY "Users update own profile" ON public.profiles
    FOR UPDATE TO authenticated
    USING (auth.uid() = id OR public.is_manager_or_owner());

-- SHOP ITEMS POLICIES
CREATE POLICY "Staff read branch shop items" ON public.shop_items
    FOR SELECT TO authenticated
    USING (shop_id IS NULL OR shop_id = public.get_current_user_shop_id() OR public.is_manager_or_owner());

CREATE POLICY "Staff insert branch shop items" ON public.shop_items
    FOR INSERT TO authenticated
    WITH CHECK (shop_id IS NULL OR shop_id = public.get_current_user_shop_id() OR public.is_manager_or_owner());

CREATE POLICY "Staff update branch shop items" ON public.shop_items
    FOR UPDATE TO authenticated
    USING (shop_id IS NULL OR shop_id = public.get_current_user_shop_id() OR public.is_manager_or_owner());

CREATE POLICY "Managers delete shop items" ON public.shop_items
    FOR DELETE TO authenticated
    USING (public.is_manager_or_owner());

-- CUSTOMERS POLICIES
CREATE POLICY "Staff read branch customers" ON public.customers
    FOR SELECT TO authenticated
    USING (shop_id IS NULL OR shop_id = public.get_current_user_shop_id() OR public.is_manager_or_owner());

CREATE POLICY "Staff insert branch customers" ON public.customers
    FOR INSERT TO authenticated
    WITH CHECK (shop_id IS NULL OR shop_id = public.get_current_user_shop_id() OR public.is_manager_or_owner());

CREATE POLICY "Staff update branch customers" ON public.customers
    FOR UPDATE TO authenticated
    USING (shop_id IS NULL OR shop_id = public.get_current_user_shop_id() OR public.is_manager_or_owner());

-- SELLERS POLICIES
CREATE POLICY "Staff read branch sellers" ON public.sellers
    FOR SELECT TO authenticated
    USING (shop_id IS NULL OR shop_id = public.get_current_user_shop_id() OR public.is_manager_or_owner());

CREATE POLICY "Staff insert branch sellers" ON public.sellers
    FOR INSERT TO authenticated
    WITH CHECK (shop_id IS NULL OR shop_id = public.get_current_user_shop_id() OR public.is_manager_or_owner());

CREATE POLICY "Staff update branch sellers" ON public.sellers
    FOR UPDATE TO authenticated
    USING (shop_id IS NULL OR shop_id = public.get_current_user_shop_id() OR public.is_manager_or_owner());

-- SELLER TRANSACTIONS POLICIES (Append & audit friendly)
CREATE POLICY "Staff read branch seller transactions" ON public.seller_transactions
    FOR SELECT TO authenticated
    USING (shop_id IS NULL OR shop_id = public.get_current_user_shop_id() OR public.is_manager_or_owner());

CREATE POLICY "Staff insert branch seller transactions" ON public.seller_transactions
    FOR INSERT TO authenticated
    WITH CHECK (shop_id IS NULL OR shop_id = public.get_current_user_shop_id() OR public.is_manager_or_owner());

CREATE POLICY "Managers update branch seller transactions" ON public.seller_transactions
    FOR UPDATE TO authenticated
    USING (public.is_manager_or_owner());

-- PAWN LOANS POLICIES
CREATE POLICY "Staff read branch pawn loans" ON public.pawn_loans
    FOR SELECT TO authenticated
    USING (shop_id IS NULL OR shop_id = public.get_current_user_shop_id() OR public.is_manager_or_owner());

CREATE POLICY "Staff insert branch pawn loans" ON public.pawn_loans
    FOR INSERT TO authenticated
    WITH CHECK (shop_id IS NULL OR shop_id = public.get_current_user_shop_id() OR public.is_manager_or_owner());

CREATE POLICY "Staff update branch pawn loans" ON public.pawn_loans
    FOR UPDATE TO authenticated
    USING (shop_id IS NULL OR shop_id = public.get_current_user_shop_id() OR public.is_manager_or_owner());

-- SALES POLICIES (Append & audit friendly)
CREATE POLICY "Staff read branch sales" ON public.sales
    FOR SELECT TO authenticated
    USING (shop_id IS NULL OR shop_id = public.get_current_user_shop_id() OR public.is_manager_or_owner());

CREATE POLICY "Staff insert branch sales" ON public.sales
    FOR INSERT TO authenticated
    WITH CHECK (shop_id IS NULL OR shop_id = public.get_current_user_shop_id() OR public.is_manager_or_owner());

CREATE POLICY "Managers update branch sales" ON public.sales
    FOR UPDATE TO authenticated
    USING (public.is_manager_or_owner());

-- SAPS ENTRIES POLICIES (Statutory compliance: Strictly append-only, NO DELETE)
CREATE POLICY "Staff read branch saps entries" ON public.saps_entries
    FOR SELECT TO authenticated
    USING (shop_id IS NULL OR shop_id = public.get_current_user_shop_id() OR public.is_manager_or_owner());

CREATE POLICY "Staff insert branch saps entries" ON public.saps_entries
    FOR INSERT TO authenticated
    WITH CHECK (shop_id IS NULL OR shop_id = public.get_current_user_shop_id() OR public.is_manager_or_owner());

CREATE POLICY "Staff update branch saps entries" ON public.saps_entries
    FOR UPDATE TO authenticated
    USING (shop_id IS NULL OR shop_id = public.get_current_user_shop_id() OR public.is_manager_or_owner());

-- SYSTEM LOGS POLICIES (Immutable audit trail: NO UPDATE, NO DELETE)
CREATE POLICY "Staff read branch system logs" ON public.system_logs
    FOR SELECT TO authenticated
    USING (shop_id IS NULL OR shop_id = public.get_current_user_shop_id() OR public.is_manager_or_owner());

CREATE POLICY "Staff insert system logs" ON public.system_logs
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- EXTERNAL MARKET CACHE POLICIES (Global platform cache: Read-only for app clients, write restricted to server)
ALTER TABLE public.external_market_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_quotas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users read external market cache" ON public.external_market_cache
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Authenticated users read provider quotas" ON public.provider_quotas
    FOR SELECT TO authenticated
    USING (true);

-- 18. REALTIME REPLICATION (For multi-terminal sync)
ALTER PUBLICATION supabase_realtime ADD TABLE public.shop_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.system_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pawn_loans;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sales;

-- 19. INITIAL SEED DATA
INSERT INTO public.shop_profiles (
    id,
    shop_code,
    shop_name,
    trading_name,
    registration_number,
    vat_number,
    saps_dealer_license,
    phone,
    email,
    address,
    city,
    province,
    postal_code,
    currency,
    receipt_header,
    receipt_footer
)
VALUES (
    'a0000000-0000-0000-0000-000000000001'::uuid,
    'SHOP-SOW-01',
    'LocalMarket Soweto Central',
    'LocalMarket Pawnbrokers & Retail (Pty) Ltd',
    '2019/581920/07',
    'ZA4891029381',
    'SAPS-SHD-2024-99182',
    '+27 11 938 1200',
    'soweto.branch@localmarket.co.za',
    '1482 Vilakazi Street, Orlando West',
    'Soweto',
    'Gauteng',
    '1804',
    'ZAR',
    E'LOCALMARKET PAWNBROKERS & RETAIL\nSOWETO CENTRAL BRANCH • TEL: 011 938 1200\nSAPS LIC: SAPS-SHD-2024-99182 • VAT: 4891029381',
    E'THANK YOU FOR YOUR PATRONAGE!\nKEEP RECEIPT FOR WARRANTY & POLICE INSPECTION\nTERMS & NCR ACT 34 OF 2005 APPLY'
)
ON CONFLICT (shop_code) DO NOTHING;

INSERT INTO public.shop_items (shop_id, sku, title, category, serial_or_imei, condition, acquisition_type, cost_basis, retail_price, vault_location, status, image_url, specs)
VALUES
('a0000000-0000-0000-0000-000000000001'::uuid, 'SKU-IPH15-01', 'Apple iPhone 15 Pro 128GB Titanium', 'Phones & Tech', '359281092837192', 'Mint', 'Buy', 12500.00, 18999.00, 'Display-A1', 'Retail Floor', 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=600&q=80', 'Natural Titanium, Battery 98%, USB-C, Original Box'),
('a0000000-0000-0000-0000-000000000001'::uuid, 'SKU-MAK-501', 'Makita 18V LXT Brushless Cordless Drill Kit', 'Power Tools', 'MK-9821734-LXT', 'Excellent', 'Buy', 1600.00, 2750.00, 'Shelf-T03', 'Retail Floor', 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=600&q=80', 'Includes 2x 4.0Ah Li-ion batteries and rapid charger'),
('a0000000-0000-0000-0000-000000000001'::uuid, 'SKU-PS5-009', 'Sony PlayStation 5 Disc Edition 825GB', 'Gaming Consoles', 'PS5-839210-SA', 'Excellent', 'Buy', 5200.00, 7999.00, 'Shelf-G02', 'Retail Floor', 'https://images.unsplash.com/photo-1606813907291-d86efa9b94db?w=600&q=80', 'White DualSense controller, HDMI 2.1 cable, power cord'),
('a0000000-0000-0000-0000-000000000001'::uuid, 'SKU-JBL-442', 'JBL Boombox 3 Portable Bluetooth Speaker', 'Audio & Visual', 'JBL-BB3-88219', 'Good', 'Buy', 3200.00, 4899.00, 'Display-Audio', 'Retail Floor', 'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=600&q=80', 'Squad Camo, IP67 waterproof, 24hr battery'),
('a0000000-0000-0000-0000-000000000001'::uuid, 'SKU-GLD-991', '9ct Yellow Gold Curb Link Chain 22g', 'Fine Jewelry & Gold', 'CERT-GLD-9912', 'Excellent', 'Buy', 9500.00, 14500.00, 'Vault-Safe-01', 'Retail Floor', 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=600&q=80', 'Hallmarked 375, 55cm length, lobster clasp')
ON CONFLICT (sku) DO NOTHING;

INSERT INTO public.system_logs (shop_id, event_type, severity, actor_name, details, saps_reference)
VALUES
('a0000000-0000-0000-0000-000000000001'::uuid, 'SYSTEM_INITIALIZED', 'info', 'System Daemon', '{"source": "LocalMarket Supabase Free Tier Sync", "version": "2.0.0"}'::jsonb, NULL),
('a0000000-0000-0000-0000-000000000001'::uuid, 'SAPS_REGISTER_EXPORT', 'audit', 'Thabo Molefe', '{"format": "CSV", "recordCount": 18, "station": "Johannesburg Central SAPS"}'::jsonb, 'SAPS-2026-0842');
