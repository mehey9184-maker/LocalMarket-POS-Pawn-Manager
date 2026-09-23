-- ============================================================================
-- MARKET INTELLIGENCE SNAPSHOTS & ANALYTICS MIGRATION (20260924090000)
-- Stores normalized market reference snapshots, local demand statistics,
-- and pricing valuation estimates isolated by shop branch.
-- ============================================================================

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
    source_type TEXT NOT NULL, -- 'upcitemdb', 'internal_sales', 'cached_snapshot'
    source_name TEXT NOT NULL,
    source_url TEXT,
    reference_price NUMERIC(12,2),
    used_low NUMERIC(12,2),
    used_high NUMERIC(12,2),
    median_price NUMERIC(12,2),
    demand_score NUMERIC(6,2),
    demand_label TEXT, -- 'Insufficient data', 'Low', 'Moderate', 'High'
    confidence TEXT NOT NULL, -- 'High', 'Medium', 'Low', 'Insufficient data'
    raw_summary JSONB DEFAULT '{}'::jsonb,
    observed_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '24 hours') NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Indexes for performance & tenancy isolation
CREATE INDEX IF NOT EXISTS idx_market_intel_shop_id ON public.market_intelligence_snapshots(shop_id);
CREATE INDEX IF NOT EXISTS idx_market_intel_query_key ON public.market_intelligence_snapshots(query_key);
CREATE INDEX IF NOT EXISTS idx_market_intel_barcode ON public.market_intelligence_snapshots(barcode);
CREATE INDEX IF NOT EXISTS idx_market_intel_expires_at ON public.market_intelligence_snapshots(expires_at);

-- Enable RLS
ALTER TABLE public.market_intelligence_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS Policies (Shop Isolation)
DROP POLICY IF EXISTS "Shop members access market intelligence snapshots" ON public.market_intelligence_snapshots;
CREATE POLICY "Shop members access market intelligence snapshots" ON public.market_intelligence_snapshots
    FOR ALL TO authenticated
    USING (shop_id = public.get_current_user_shop_id() OR public.is_admin())
    WITH CHECK (shop_id = public.get_current_user_shop_id() OR public.is_admin());
