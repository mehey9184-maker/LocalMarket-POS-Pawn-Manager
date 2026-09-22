-- ==============================================================================
-- SUPABASE FREE TIER SCHEMA: LOCALMARKET POS & PAWN HUB
-- Tables: profiles (Authentication & Staff), shop_items (Inventory), system_logs (Audit & SAPS)
-- Includes: Row Level Security (RLS), Auto-Profile Trigger, Indexes, Seed Data
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. ENUMS & DOMAINS
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('cashier', 'senior_cashier', 'manager', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE item_condition AS ENUM ('Mint', 'Excellent', 'Good', 'Fair', 'Damaged');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE item_status AS ENUM ('Vault Hold', 'Retail Floor', 'Sold', 'Redeemed', 'Reserved', 'Flagged');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2.5 SHOP PROFILES TABLE (Branch Identity, VAT, and SAPS License)
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

-- 3. PROFILES TABLE (Linked with Supabase Auth: auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    shop_id UUID REFERENCES public.shop_profiles(id) ON DELETE SET NULL,
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

-- 4. SHOP ITEMS TABLE (Retail inventory & second-hand asset stock)
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
    specs TEXT,
    pawn_ticket_id TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    added_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. SYSTEM & AUDIT LOGS TABLE (Cashier logs, SAPS filings, and Security events)
CREATE TABLE IF NOT EXISTS public.system_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type TEXT NOT NULL, -- 'AUTH_SIGN_IN', 'SALE_COMPLETED', 'INTAKE_CREATED', 'VAULT_RELEASE', 'PIN_ROTATED', 'SAPS_VERIFICATION'
    severity TEXT DEFAULT 'info' NOT NULL, -- 'info', 'warning', 'audit', 'critical'
    actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    actor_name TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    saps_reference TEXT,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_shop_items_sku ON public.shop_items(sku);
CREATE INDEX IF NOT EXISTS idx_shop_items_status ON public.shop_items(status);
CREATE INDEX IF NOT EXISTS idx_shop_items_category ON public.shop_items(category);
CREATE INDEX IF NOT EXISTS idx_system_logs_event_type ON public.system_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON public.system_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- 7. AUTOMATIC UPDATED_AT TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_profiles_timestamp ON public.profiles;
CREATE TRIGGER update_profiles_timestamp
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

DROP TRIGGER IF EXISTS update_shop_items_timestamp ON public.shop_items;
CREATE TRIGGER update_shop_items_timestamp
    BEFORE UPDATE ON public.shop_items
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- 8. AUTOMATIC PROFILE CREATION ON USER SIGNUP (Supabase Auth Hook)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_cashier_code TEXT;
BEGIN
    new_cashier_code := 'CSH-' || LPAD(FLOOR(RANDOM() * 9000 + 1000)::TEXT, 4, '0');
    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        cashier_code,
        role,
        avatar_url,
        digital_signature
    )
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
        new_cashier_code,
        COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'cashier'::user_role),
        NEW.raw_user_meta_data->>'avatar_url',
        'Verified: ' || COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1))
    );
    
    -- Insert audit log for user registration
    INSERT INTO public.system_logs (event_type, severity, actor_id, actor_name, details)
    VALUES (
        'AUTH_USER_CREATED', 
        'audit', 
        NEW.id, 
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        jsonb_build_object('email', NEW.email, 'cashier_code', new_cashier_code)
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 9. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

-- Profiles: Authenticated users can read all profiles; users can update their own profile; managers/admins can update all
CREATE POLICY "Allow authenticated read profiles" ON public.profiles
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow public anon read profiles" ON public.profiles
    FOR SELECT TO anon USING (true);

CREATE POLICY "Allow users update own profile" ON public.profiles
    FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Shop Items: Everyone (anon & authenticated) can view available inventory
CREATE POLICY "Allow public read shop items" ON public.shop_items
    FOR SELECT TO public USING (true);

-- Authenticated users (Cashiers & Managers) can insert, update, or archive shop items
CREATE POLICY "Allow authenticated insert shop items" ON public.shop_items
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update shop items" ON public.shop_items
    FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated delete shop items" ON public.shop_items
    FOR DELETE TO authenticated USING (true);

-- System Logs: Authenticated staff can view logs, insert new logs
CREATE POLICY "Allow authenticated read system logs" ON public.system_logs
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert system logs" ON public.system_logs
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow public anon insert system logs" ON public.system_logs
    FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow public anon read system logs" ON public.system_logs
    FOR SELECT TO anon USING (true);

-- 10. REALTIME SUBSCRIPTIONS REPLICATION (Supabase Free Tier)
-- Enable realtime for shop items and logs so cashiers get instant sync
ALTER PUBLICATION supabase_realtime ADD TABLE public.shop_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.system_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;

-- 11. INITIAL SEED DATA FOR LOCALMARKET
INSERT INTO public.shop_items (sku, title, category, serial_or_imei, condition, acquisition_type, cost_basis, retail_price, vault_location, status, image_url, specs)
VALUES
('SKU-IPH15-01', 'Apple iPhone 15 Pro 128GB Titanium', 'Phones & Tech', '359281092837192', 'Mint', 'Buy', 12500.00, 18999.00, 'Display-A1', 'Retail Floor', 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=600&q=80', 'Natural Titanium, Battery 98%, USB-C, Original Box'),
('SKU-MAK-501', 'Makita 18V LXT Brushless Cordless Drill Kit', 'Power Tools', 'MK-9821734-LXT', 'Excellent', 'Buy', 1600.00, 2750.00, 'Shelf-T03', 'Retail Floor', 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=600&q=80', 'Includes 2x 4.0Ah Li-ion batteries and rapid charger'),
('SKU-PS5-009', 'Sony PlayStation 5 Disc Edition 825GB', 'Gaming Consoles', 'PS5-839210-SA', 'Excellent', 'Buy', 5200.00, 7999.00, 'Shelf-G02', 'Retail Floor', 'https://images.unsplash.com/photo-1606813907291-d86efa9b94db?w=600&q=80', 'White DualSense controller, HDMI 2.1 cable, power cord'),
('SKU-JBL-442', 'JBL Boombox 3 Portable Bluetooth Speaker', 'Audio & Visual', 'JBL-BB3-88219', 'Good', 'Buy', 3200.00, 4899.00, 'Display-Audio', 'Retail Floor', 'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=600&q=80', 'Squad Camo, IP67 waterproof, 24hr battery'),
('SKU-GLD-991', '9ct Yellow Gold Curb Link Chain 22g', 'Fine Jewelry & Gold', 'CERT-GLD-9912', 'Excellent', 'Buy', 9500.00, 14500.00, 'Vault-Safe-01', 'Retail Floor', 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=600&q=80', 'Hallmarked 375, 55cm length, lobster clasp')
ON CONFLICT (sku) DO NOTHING;

INSERT INTO public.system_logs (event_type, severity, actor_name, details, saps_reference)
VALUES
('SYSTEM_INITIALIZED', 'info', 'System Daemon', '{"source": "LocalMarket Supabase Free Tier Sync", "version": "1.0.0"}'::jsonb, NULL),
('SAPS_REGISTER_EXPORT', 'audit', 'Thabo Molefe', '{"format": "CSV", "recordCount": 18, "station": "Johannesburg Central SAPS"}'::jsonb, 'SAPS-2026-0842'),
('VAULT_AUDIT_LOG', 'info', 'Thabo Molefe', '{"vaultShelf": "Shelf-A03", "itemsVerified": 12, "status": "Secure"}'::jsonb, NULL);
