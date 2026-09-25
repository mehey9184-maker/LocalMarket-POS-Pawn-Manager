-- ============================================================================
-- PERFORMANCE HARDENING INDEXES MIGRATION (20260925010000)
-- Minimal, targeted B-Tree indexes for RLS evaluation and delta sync queries.
-- Safe, reversible, and non-blocking (IF NOT EXISTS).
-- ============================================================================

-- 1. shop_items: Accelerates shop-scoped filtering and RLS policy evaluation
CREATE INDEX IF NOT EXISTS idx_shop_items_shop_id ON public.shop_items(shop_id);

-- 2. shop_items: Accelerates delta synchronization queries (gt('updated_at', sinceTimestamp))
CREATE INDEX IF NOT EXISTS idx_shop_items_updated_at ON public.shop_items(updated_at);

-- 3. profiles: Accelerates staff lookup and shop isolation RLS policies
CREATE INDEX IF NOT EXISTS idx_profiles_shop_id ON public.profiles(shop_id);

-- 4. sales: Accelerates shop financial dashboard queries and transaction history lookups
CREATE INDEX IF NOT EXISTS idx_sales_shop_created ON public.sales(shop_id, created_at DESC);
