-- ==============================================================================
-- SHOP PROFILES & LOCAL-FIRST COMPLIANCE MIGRATION
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql/new
-- ==============================================================================

-- 1. CREATE SHOP PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.shop_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_code TEXT UNIQUE NOT NULL,
    shop_name TEXT NOT NULL,
    trading_name TEXT,
    registration_number TEXT,     -- CIPC Registration Number (e.g. 2019/581920/07)
    vat_number TEXT,              -- South African SARS VAT Number
    saps_dealer_license TEXT,     -- Second-Hand Goods Act 06 of 2009 SAPS Certificate
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

-- 2. LINK PROFILES & SHOP ITEMS TO SHOP PROFILES (SAFE IF ALREADY EXISTS)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'shop_id'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN shop_id UUID REFERENCES public.shop_profiles(id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shop_items' AND column_name = 'shop_id'
    ) THEN
        ALTER TABLE public.shop_items ADD COLUMN shop_id UUID REFERENCES public.shop_profiles(id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'system_logs' AND column_name = 'shop_id'
    ) THEN
        ALTER TABLE public.system_logs ADD COLUMN shop_id UUID REFERENCES public.shop_profiles(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 3. INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_shop_profiles_code ON public.shop_profiles(shop_code);
CREATE INDEX IF NOT EXISTS idx_shop_profiles_active ON public.shop_profiles(is_active);

-- 4. AUTO UPDATED_AT TRIGGER
DROP TRIGGER IF EXISTS update_shop_profiles_timestamp ON public.shop_profiles;
CREATE TRIGGER update_shop_profiles_timestamp
    BEFORE UPDATE ON public.shop_profiles
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- 5. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.shop_profiles ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read active shop profiles (for receipt printing & branch validation)
CREATE POLICY "Allow public read active shop profiles" ON public.shop_profiles
    FOR SELECT TO public USING (is_active = true);

-- Allow authenticated cashiers and managers to update shop configuration
CREATE POLICY "Allow authenticated manage shop profiles" ON public.shop_profiles
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Allow anon read/write if using anon key in offline/POS terminals
CREATE POLICY "Allow anon read shop profiles" ON public.shop_profiles
    FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anon insert shop profiles" ON public.shop_profiles
    FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anon update shop profiles" ON public.shop_profiles
    FOR UPDATE TO anon USING (true);

-- 6. SEED INITIAL SOWETO CENTRAL SHOP PROFILE
INSERT INTO public.shop_profiles (
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
ON CONFLICT (shop_code) DO UPDATE SET
    shop_name = EXCLUDED.shop_name,
    saps_dealer_license = EXCLUDED.saps_dealer_license,
    vat_number = EXCLUDED.vat_number,
    phone = EXCLUDED.phone,
    receipt_header = EXCLUDED.receipt_header,
    receipt_footer = EXCLUDED.receipt_footer;
