-- Migration: Support Existing Stock & Inventory Provenance
-- LocalMarket POS & Pawn Manager

ALTER TABLE public.shop_items ADD COLUMN IF NOT EXISTS brand TEXT;
ALTER TABLE public.shop_items ADD COLUMN IF NOT EXISTS model TEXT;
ALTER TABLE public.shop_items ADD COLUMN IF NOT EXISTS stock_location TEXT;
ALTER TABLE public.shop_items ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'existing_stock';
ALTER TABLE public.shop_items ADD COLUMN IF NOT EXISTS source_status TEXT DEFAULT 'unknown';
ALTER TABLE public.shop_items ADD COLUMN IF NOT EXISTS source_note TEXT;
ALTER TABLE public.shop_items ADD COLUMN IF NOT EXISTS internal_note TEXT;

-- Update customers table to ensure dob and gender are optional
ALTER TABLE public.customers ALTER COLUMN dob DROP NOT NULL;
ALTER TABLE public.customers ALTER COLUMN gender DROP NOT NULL;
