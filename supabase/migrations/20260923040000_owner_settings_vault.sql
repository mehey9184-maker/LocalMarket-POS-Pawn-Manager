-- ==============================================================================
-- OWNER SETTINGS & BUSINESS RULES AUDITING
-- ==============================================================================

-- 1. ADD BUSINESS RULES TO SHOP PROFILES
ALTER TABLE public.shop_profiles 
ADD COLUMN IF NOT EXISTS business_rules JSONB DEFAULT '{
    "pawnMonthlyInterestRate": 0.05,
    "pawnStorageAdminFeeRate": 0.08,
    "defaultLoanTermDays": 30,
    "gracePeriodDays": 7,
    "minLoanPrincipal": 100,
    "defaultRetailMarkupMultiplier": 1.8,
    "retailRoundingMode": "nearest10",
    "storeWarrantyDays": 7,
    "warrantyDescription": "7-Day Store Test Warranty",
    "autoPrintTag": true
}'::jsonb;

-- 2. CREATE BUSINESS RULE AUDIT LOGS
CREATE TABLE IF NOT EXISTS public.business_rule_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES public.shop_profiles(id) ON DELETE CASCADE,
    actor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    actor_name TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    event_type TEXT NOT NULL DEFAULT 'BUSINESS_RULES_CHANGED',
    old_values JSONB NOT NULL,
    new_values JSONB NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS FOR AUDIT LOGS
ALTER TABLE public.business_rule_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shop users can view their own shop's rule audit logs"
ON public.business_rule_audit_logs FOR SELECT
USING (shop_id = public.get_current_user_shop_id() OR public.is_admin());

-- 3. RPC FOR AUTHORITATIVE BUSINESS RULES UPDATE
CREATE OR REPLACE FUNCTION public.update_shop_business_rules(
    p_rules JSONB,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_shop_id UUID;
    v_user_role TEXT;
    v_user_name TEXT;
    v_old_rules JSONB;
BEGIN
    -- 1. Verify caller authentication
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    -- 2. Verify shop isolation and role (Owner only for material financial rules)
    SELECT shop_id, role, full_name INTO v_user_shop_id, v_user_role, v_user_name
    FROM public.profiles
    WHERE id = auth.uid();

    IF v_user_shop_id IS NULL THEN
        RAISE EXCEPTION 'User has no assigned shop.';
    END IF;

    IF v_user_role NOT IN ('owner', 'admin') THEN
        RAISE EXCEPTION 'Unauthorized: Only Owners can modify business rules.';
    END IF;

    -- 3. Get old rules for auditing
    SELECT business_rules INTO v_old_rules
    FROM public.shop_profiles
    WHERE id = v_user_shop_id;

    -- 4. Update shop_profiles
    UPDATE public.shop_profiles
    SET business_rules = p_rules,
        updated_at = timezone('utc'::text, now())
    WHERE id = v_user_shop_id;

    -- 5. Record Audit Log
    INSERT INTO public.business_rule_audit_logs (
        shop_id,
        actor_id,
        actor_name,
        old_values,
        new_values,
        reason
    ) VALUES (
        v_user_shop_id,
        auth.uid(),
        v_user_name,
        v_old_rules,
        p_rules,
        p_reason
    );

    -- 6. Also log to general system_logs
    INSERT INTO public.system_logs (
        shop_id,
        actor_id,
        actor_name,
        event_type,
        details,
        severity
    ) VALUES (
        v_user_shop_id,
        auth.uid(),
        v_user_name,
        'BUSINESS_RULES_CHANGED',
        jsonb_build_object(
            'reason', p_reason,
            'changes_count', (SELECT count(*) FROM jsonb_each(p_rules))
        ),
        'audit'
    );

    RETURN jsonb_build_object(
        'success', true,
        'shop_id', v_user_shop_id
    );
END;
$$;
