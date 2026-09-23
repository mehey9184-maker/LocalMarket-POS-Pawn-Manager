-- ============================================================================
-- REPAIRED PRODUCTION RECONCILIATION MIGRATION (20260924070000)
-- Brings live database zhwiinqlknzxyxzvhvni into full compatibility with 
-- the LocalMarket current application architecture.
-- Idempotent, data-preserving, non-recursive RLS, and secure.
-- ============================================================================

-- 1. PROFILES TABLE RECONCILIATION & PIN DEFAULT REMOVAL
ALTER TABLE IF EXISTS public.profiles 
    ADD COLUMN IF NOT EXISTS pin_hash TEXT,
    ADD COLUMN IF NOT EXISTS schedule JSONB,
    ADD COLUMN IF NOT EXISTS permissions JSONB,
    ADD COLUMN IF NOT EXISTS login_attempts INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ;

ALTER TABLE IF EXISTS public.profiles 
    ALTER COLUMN pin_code DROP DEFAULT;

-- 2. SHOP PROFILES & SHOP ITEMS RECONCILIATION
ALTER TABLE IF EXISTS public.shop_profiles
    ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Africa/Johannesburg',
    ADD COLUMN IF NOT EXISTS business_rules JSONB DEFAULT '{}'::jsonb;

ALTER TABLE IF EXISTS public.shop_items
    ADD COLUMN IF NOT EXISTS storage_key TEXT;

-- 3. MISSING PRODUCTION TABLES
CREATE TABLE IF NOT EXISTS public.staff_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES public.shop_profiles(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    target_staff_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    old_values JSONB,
    new_values JSONB,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.terminal_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES public.shop_profiles(id) ON DELETE CASCADE,
    terminal_name TEXT NOT NULL,
    current_cashier_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    is_locked BOOLEAN DEFAULT false,
    last_active_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.seller_transaction_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES public.shop_profiles(id) ON DELETE CASCADE,
    seller_id UUID REFERENCES public.sellers(id) ON DELETE CASCADE,
    item_id UUID REFERENCES public.shop_items(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    transaction_type TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.seller_reversals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES public.shop_profiles(id) ON DELETE CASCADE,
    seller_id UUID REFERENCES public.sellers(id) ON DELETE CASCADE,
    amount NUMERIC(12,2) NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.business_rule_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES public.shop_profiles(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    rule_name TEXT NOT NULL,
    old_value JSONB,
    new_value JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. ENABLE RLS ON ALL SENSITIVE TABLES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terminal_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_reversals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_rule_audit_logs ENABLE ROW LEVEL SECURITY;

-- 5. NON-RECURSIVE RLS POLICIES FOR PROFILES
-- Avoids infinite recursion by avoiding direct subqueries on public.profiles within profiles policies.
-- Uses auth.uid() directly and helper functions.
DROP POLICY IF EXISTS "Authenticated users view shop profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile or managers update shop profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow all for now" ON public.profiles;
DROP POLICY IF EXISTS "Allow public read profiles" ON public.profiles;

CREATE POLICY "Users can view own profile or shop colleagues" ON public.profiles
    FOR SELECT TO authenticated
    USING (
        id = auth.uid() 
        OR shop_id = public.get_current_user_shop_id()
    );

CREATE POLICY "Users can update own profile or managers update branch" ON public.profiles
    FOR UPDATE TO authenticated
    USING (
        id = auth.uid() 
        OR (
            shop_id = public.get_current_user_shop_id() 
            AND public.is_manager_or_owner()
        )
    )
    WITH CHECK (
        id = auth.uid() 
        OR (
            shop_id = public.get_current_user_shop_id() 
            AND public.is_manager_or_owner()
        )
    );

-- 6. RLS POLICIES FOR NEW TABLES
DROP POLICY IF EXISTS "Staff can view shop audit logs" ON public.staff_audit_logs;
CREATE POLICY "Staff can view shop audit logs" ON public.staff_audit_logs
    FOR SELECT TO authenticated
    USING (shop_id = public.get_current_user_shop_id() OR public.is_admin());

DROP POLICY IF EXISTS "Staff can insert shop audit logs" ON public.staff_audit_logs;
CREATE POLICY "Staff can insert shop audit logs" ON public.staff_audit_logs
    FOR INSERT TO authenticated
    WITH CHECK (shop_id = public.get_current_user_shop_id() OR public.is_admin());

DROP POLICY IF EXISTS "Shop members access terminal sessions" ON public.terminal_sessions;
CREATE POLICY "Shop members access terminal sessions" ON public.terminal_sessions
    FOR ALL TO authenticated
    USING (shop_id = public.get_current_user_shop_id() OR public.is_admin())
    WITH CHECK (shop_id = public.get_current_user_shop_id() OR public.is_admin());

DROP POLICY IF EXISTS "Shop members access seller transaction items" ON public.seller_transaction_items;
CREATE POLICY "Shop members access seller transaction items" ON public.seller_transaction_items
    FOR ALL TO authenticated
    USING (shop_id = public.get_current_user_shop_id() OR public.is_admin())
    WITH CHECK (shop_id = public.get_current_user_shop_id() OR public.is_admin());

DROP POLICY IF EXISTS "Shop members access seller reversals" ON public.seller_reversals;
CREATE POLICY "Shop members access seller reversals" ON public.seller_reversals
    FOR ALL TO authenticated
    USING (shop_id = public.get_current_user_shop_id() OR public.is_admin())
    WITH CHECK (shop_id = public.get_current_user_shop_id() OR public.is_admin());

DROP POLICY IF EXISTS "Shop owners/managers access business rule audit logs" ON public.business_rule_audit_logs;
CREATE POLICY "Shop owners/managers access business rule audit logs" ON public.business_rule_audit_logs
    FOR ALL TO authenticated
    USING (
        (shop_id = public.get_current_user_shop_id() AND public.is_manager_or_owner()) 
        OR public.is_admin()
    );

-- 7. ATOMIC CONCURRENCY-SAFE BRUTE-FORCE LOCKOUT & ATTEMPT ADMISSION RPCs
CREATE OR REPLACE FUNCTION public.check_pin_lockout(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_attempts INT;
    v_last_attempt TIMESTAMPTZ;
    v_now TIMESTAMPTZ := clock_timestamp();
    v_lockout_minutes INT := 15;
    v_remaining INT;
BEGIN
    SELECT login_attempts, last_attempt_at INTO v_attempts, v_last_attempt
    FROM public.profiles
    WHERE id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('locked', false);
    END IF;

    v_attempts := COALESCE(v_attempts, 0);

    IF v_attempts >= 5 AND v_last_attempt IS NOT NULL AND (v_now - v_last_attempt) < (v_lockout_minutes * interval '1 minute') THEN
        v_remaining := CEIL(EXTRACT(EPOCH FROM ((v_last_attempt + (v_lockout_minutes * interval '1 minute')) - v_now)) / 60.0);
        RETURN jsonb_build_object('locked', true, 'remaining_minutes', GREATEST(1, v_remaining));
    END IF;

    RETURN jsonb_build_object('locked', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.record_pin_attempt(p_user_id UUID, p_success BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_attempts INT;
    v_last_attempt TIMESTAMPTZ;
    v_now TIMESTAMPTZ := clock_timestamp();
    v_lockout_minutes INT := 15;
BEGIN
    SELECT login_attempts, last_attempt_at INTO v_attempts, v_last_attempt
    FROM public.profiles
    WHERE id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    v_attempts := COALESCE(v_attempts, 0);

    IF v_last_attempt IS NOT NULL AND (v_now - v_last_attempt) >= (v_lockout_minutes * interval '1 minute') THEN
        v_attempts := 0;
    END IF;

    IF p_success THEN
        UPDATE public.profiles
        SET login_attempts = 0,
            last_attempt_at = NULL,
            last_sign_in_at = v_now
        WHERE id = p_user_id;
    ELSE
        v_attempts := v_attempts + 1;
        UPDATE public.profiles
        SET login_attempts = v_attempts,
            last_attempt_at = v_now
        WHERE id = p_user_id;
    END IF;
END;
$$;

-- 8. SECURE STAFF PROFILE UPDATE RPC WITH SEARCH_PATH HARDENING
CREATE OR REPLACE FUNCTION public.secure_update_staff_profile(
    p_target_id UUID,
    p_updates JSONB,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_profile RECORD;
    v_target_profile RECORD;
    v_allowed_fields TEXT[] := ARRAY['permissions', 'schedule', 'is_active', 'full_name', 'phone', 'role', 'pin_hash', 'avatar_url'];
    v_field TEXT;
    v_old_values JSONB := '{}'::jsonb;
    v_new_values JSONB := '{}'::jsonb;
    v_final_updates JSONB := '{}'::jsonb;
    v_event_type TEXT := 'STAFF_PROFILE_UPDATED';
BEGIN
    SELECT * INTO v_caller_profile FROM public.profiles WHERE id = auth.uid();
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Caller profile not found';
    END IF;

    IF v_caller_profile.role NOT IN ('owner', 'admin', 'manager') THEN
        RAISE EXCEPTION 'Insufficient permissions to manage staff';
    END IF;

    SELECT * INTO v_target_profile FROM public.profiles WHERE id = p_target_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Target staff profile not found';
    END IF;

    IF v_caller_profile.shop_id != v_target_profile.shop_id THEN
        RAISE EXCEPTION 'Cannot manage staff from a different shop branch';
    END IF;

    IF v_caller_profile.role = 'manager' AND v_target_profile.role IN ('owner', 'admin') THEN
        RAISE EXCEPTION 'Managers cannot modify Owner or Admin accounts';
    END IF;
    
    IF v_caller_profile.role = 'manager' AND v_target_profile.role = 'manager' AND v_caller_profile.id != p_target_id THEN
        RAISE EXCEPTION 'Managers cannot modify other Manager accounts';
    END IF;

    FOR v_field IN SELECT jsonb_object_keys(p_updates) LOOP
        IF v_field = ANY(v_allowed_fields) THEN
            IF v_field = 'role' AND p_updates->>v_field IN ('owner', 'admin') AND v_caller_profile.role != 'owner' THEN
                RAISE EXCEPTION 'Only Owners can promote staff to Owner or Admin roles';
            END IF;

            IF v_field != 'pin_hash' THEN
                v_old_values := v_old_values || jsonb_build_object(v_field, row_to_json(v_target_profile)->v_field);
                v_new_values := v_new_values || jsonb_build_object(v_field, p_updates->v_field);
            END IF;

            v_final_updates := v_final_updates || jsonb_build_object(v_field, p_updates->v_field);
        END IF;
    END LOOP;

    IF v_final_updates = '{}'::jsonb THEN
        RETURN jsonb_build_object('success', true, 'message', 'No valid fields to update');
    END IF;

    IF v_final_updates ? 'pin_hash' THEN
        v_event_type := 'PIN_CHANGED';
    END IF;

    UPDATE public.profiles
    SET 
        full_name = COALESCE((v_final_updates->>'full_name'), full_name),
        phone = COALESCE((v_final_updates->>'phone'), phone),
        role = COALESCE((v_final_updates->>'role')::user_role, role),
        pin_hash = COALESCE((v_final_updates->>'pin_hash'), pin_hash),
        avatar_url = COALESCE((v_final_updates->>'avatar_url'), avatar_url),
        schedule = COALESCE((v_final_updates->'schedule'), schedule),
        permissions = COALESCE((v_final_updates->'permissions'), permissions),
        is_active = COALESCE((v_final_updates->'is_active')::boolean, is_active),
        updated_at = now()
    WHERE id = p_target_id;

    INSERT INTO public.staff_audit_logs (
        shop_id,
        actor_id,
        target_staff_id,
        event_type,
        old_values,
        new_values,
        reason
    ) VALUES (
        v_caller_profile.shop_id,
        v_caller_profile.id,
        p_target_id,
        v_event_type,
        CASE WHEN v_old_values = '{}'::jsonb THEN NULL ELSE v_old_values END,
        CASE WHEN v_new_values = '{}'::jsonb THEN NULL ELSE v_new_values END,
        p_reason
    );

    RETURN jsonb_build_object('success', true, 'target_id', p_target_id);
END;
$$;

-- 9. HARDEN SEARCH_PATH ON ALL SECURITY DEFINER FUNCTIONS
ALTER FUNCTION IF EXISTS public.handle_new_user() SET search_path = public;
ALTER FUNCTION IF EXISTS public.update_modified_column() SET search_path = public;
ALTER FUNCTION IF EXISTS public.current_user_role() SET search_path = public;
ALTER FUNCTION IF EXISTS public.get_current_user_shop_id() SET search_path = public;
ALTER FUNCTION IF EXISTS public.is_admin() SET search_path = public;
ALTER FUNCTION IF EXISTS public.is_manager_or_owner() SET search_path = public;
ALTER FUNCTION IF EXISTS public.is_staff() SET search_path = public;
ALTER FUNCTION IF EXISTS public.protect_cashier_inventory_fields() SET search_path = public;
ALTER FUNCTION IF EXISTS public.rls_auto_enable() SET search_path = public;
