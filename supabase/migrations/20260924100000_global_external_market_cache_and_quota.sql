-- ============================================================================
-- GLOBAL EXTERNAL MARKET CACHE AND ATOMIC QUOTA RESERVATION (20260924100000)
-- Provides platform-wide cache for public market reference data and
-- atomic server-side provider request quota reservation.
-- ============================================================================

-- 1. GLOBAL EXTERNAL MARKET CACHE TABLE
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

-- Indexes for fast cache lookups
CREATE INDEX IF NOT EXISTS idx_ext_cache_key ON public.external_market_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_ext_cache_barcode ON public.external_market_cache(barcode);
CREATE INDEX IF NOT EXISTS idx_ext_cache_expires_at ON public.external_market_cache(expires_at);

-- 2. PROVIDER QUOTAS TABLE
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

-- RLS Enablement
ALTER TABLE public.external_market_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_quotas ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Authenticated users read external market cache" ON public.external_market_cache;
CREATE POLICY "Authenticated users read external market cache" ON public.external_market_cache
    FOR SELECT TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Authenticated users read provider quotas" ON public.provider_quotas;
CREATE POLICY "Authenticated users read provider quotas" ON public.provider_quotas
    FOR SELECT TO authenticated
    USING (true);

-- 3. ATOMIC PROVIDER QUOTA RESERVATION FUNCTION
CREATE OR REPLACE FUNCTION public.reserve_provider_request(
    p_provider TEXT DEFAULT 'upcitemdb',
    p_default_limit INTEGER DEFAULT 25
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_now TIMESTAMPTZ := timezone('utc'::text, now());
    v_quota RECORD;
    v_next_reset TIMESTAMPTZ;
    v_allowed BOOLEAN := FALSE;
    v_reason TEXT := '';
BEGIN
    -- Ensure row exists and lock for atomic update
    INSERT INTO public.provider_quotas (provider, daily_limit, requests_today, reset_at, updated_at)
    VALUES (
        p_provider,
        p_default_limit,
        0,
        timezone('utc'::text, date_trunc('day', v_now) + INTERVAL '24 hours'),
        v_now
    )
    ON CONFLICT (provider) DO NOTHING;

    SELECT * INTO v_quota
    FROM public.provider_quotas
    WHERE provider = p_provider
    FOR UPDATE;

    -- Check daily reset
    IF v_now >= v_quota.reset_at THEN
        v_next_reset := timezone('utc'::text, date_trunc('day', v_now) + INTERVAL '24 hours');
        UPDATE public.provider_quotas
        SET requests_today = 0,
            reset_at = v_next_reset,
            updated_at = v_now
        WHERE provider = p_provider;

        v_quota.requests_today := 0;
        v_quota.reset_at := v_next_reset;
    END IF;

    -- Check failure cooldown
    IF v_quota.cooldown_until IS NOT NULL AND v_now < v_quota.cooldown_until THEN
        v_allowed := FALSE;
        v_reason := 'Provider in failure cooldown until ' || v_quota.cooldown_until::text;
    ELSIF v_quota.requests_today >= v_quota.daily_limit THEN
        v_allowed := FALSE;
        v_reason := 'Daily provider request quota exhausted (' || v_quota.requests_today || '/' || v_quota.daily_limit || ')';
    ELSE
        -- Reserve request slot
        v_allowed := TRUE;
        v_quota.requests_today := v_quota.requests_today + 1;

        UPDATE public.provider_quotas
        SET requests_today = v_quota.requests_today,
            updated_at = v_now
        WHERE provider = p_provider;
    END IF;

    RETURN jsonb_build_object(
        'allowed', v_allowed,
        'reason', v_reason,
        'provider', v_quota.provider,
        'daily_limit', v_quota.daily_limit,
        'requests_today', v_quota.requests_today,
        'reset_at', v_quota.reset_at,
        'consecutive_failures', v_quota.consecutive_failures,
        'cooldown_until', v_quota.cooldown_until
    );
END;
$$;

-- Security hardening: Grants & Revokes
REVOKE EXECUTE ON FUNCTION public.reserve_provider_request(TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_provider_request(TEXT, INTEGER) TO service_role;
