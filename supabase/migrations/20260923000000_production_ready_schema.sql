-- ==============================================================================
-- PRODUCTION SUPABASE MIGRATION: 20260923000000_production_ready_schema.sql
-- Brings Supabase database up to full production schema for LocalMarket POS & Pawn Hub
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('cashier', 'senior_cashier', 'manager', 'admin');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE item_condition AS ENUM ('Mint', 'Excellent', 'Good', 'Fair', 'Damaged');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE item_status AS ENUM ('Vault Hold', 'Retail Floor', 'Sold', 'Redeemed', 'Reserved', 'Flagged', 'InStock', 'Forfeited', 'Pending Forfeit');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE loan_status AS ENUM ('Active', 'Extended', 'Redeemed', 'Forfeited', 'Archived', 'Pending Forfeit');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 1. Ensure shop_profiles exists
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

-- 2. Add columns to shop_items if missing
ALTER TABLE public.shop_items ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES public.shop_profiles(id) ON DELETE SET NULL;
ALTER TABLE public.shop_items ADD COLUMN IF NOT EXISTS storage_key TEXT;

-- 3. Customers
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

-- 4. Sellers
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

-- 5. Seller Transactions
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

-- 6. Pawn Loans
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

-- 7. Sales
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

-- 8. SAPS Entries
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

-- 9. System Logs shop_id
ALTER TABLE public.system_logs ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES public.shop_profiles(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES public.shop_profiles(id) ON DELETE SET NULL;
