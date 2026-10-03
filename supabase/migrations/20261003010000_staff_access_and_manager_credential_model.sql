-- ============================================================================
-- MIGRATION: Staff Access & Secure Manager/Owner Credential Model
-- Timestamp: 20261003010000
-- Name: 20261003010000_staff_access_and_manager_credential_model
--
-- Security Invariants Enforced:
--   1. Role Baseline + Allowed Optional Grants Architecture:
--      - Cashier baseline: sales, inventory. Optional: pawn.
--      - Senior Cashier baseline: sales, inventory, pawn, sellerAcquisitions.
--        Optional: refunds, pricing, reports. Never: staff.
--      - Manager baseline: sales, inventory, pawn, sellerAcquisitions, refunds, reports, staff.
--        Optional: pricing (can only be granted by Owner).
--      - Owner baseline: all permissions permanently active.
--   2. Dedicated Service-Role Only RPC for Access Mutation:
--      - secure_update_staff_access is strictly service_role only.
--      - Authenticated users must pass password verification at server endpoint.
--   3. Password Setup Required Tracking:
--      - Adds password_setup_required boolean column to profiles.
--      - Sets password_setup_required = true for all existing/new managers until bootstrap.
-- ============================================================================

-- 1. ADD PASSWORD_SETUP_REQUIRED COLUMN TO PROFILES
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS password_setup_required BOOLEAN DEFAULT false;

-- Existing managers must bootstrap their password
UPDATE public.profiles 
SET password_setup_required = true 
WHERE role = 'manager' AND (password_setup_required IS NULL OR password_setup_required = false);

-- 2. DEDICATED ATOMIC ACCESS UPDATE RPC (SERVICE-ROLE ONLY)
CREATE OR REPLACE FUNCTION public.secure_update_staff_access(
    p_actor_id UUID,
    p_target_id UUID,
    p_permissions JSONB,
    p_schedule JSONB,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor_profile RECORD;
    v_target_profile RECORD;
    v_normalized_perms JSONB;
    v_old_perms JSONB;
    v_old_schedule JSONB;
BEGIN
    -- 1. Identify acting user
    SELECT * INTO v_actor_profile FROM public.profiles WHERE id = p_actor_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Acting user profile not found';
    END IF;

    IF v_actor_profile.role NOT IN ('owner', 'admin', 'manager') THEN
        RAISE EXCEPTION 'Insufficient authority to configure staff access';
    END IF;

    -- 2. Identify target staff member
    SELECT * INTO v_target_profile FROM public.profiles WHERE id = p_target_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Target staff profile not found';
    END IF;

    -- 3. Enforce shop isolation
    IF v_actor_profile.shop_id IS DISTINCT FROM v_target_profile.shop_id AND v_actor_profile.role != 'admin' THEN
        RAISE EXCEPTION 'Cannot manage staff from a different shop branch';
    END IF;

    -- 4. Enforce role hierarchy
    IF v_actor_profile.role = 'manager' THEN
        IF v_target_profile.role IN ('owner', 'admin') THEN
            RAISE EXCEPTION 'Managers cannot configure Owner or Admin accounts';
        END IF;
        IF v_target_profile.role = 'manager' THEN
            RAISE EXCEPTION 'Managers cannot configure Manager accounts';
        END IF;
    END IF;

    IF v_target_profile.role = 'owner' THEN
        RAISE EXCEPTION 'Owner permissions are fixed and cannot be modified';
    END IF;

    -- 5. Normalize permissions according to target role & reject forbidden grants
    IF v_target_profile.role = 'cashier' THEN
        -- Cashier: baseline sales, inventory. Optional: pawn.
        -- Forbidden: sellerAcquisitions, refunds, pricing, reports, staff
        IF (p_permissions->>'sellerAcquisitions')::boolean = true OR
           (p_permissions->>'refunds')::boolean = true OR
           (p_permissions->>'pricing')::boolean = true OR
           (p_permissions->>'reports')::boolean = true OR
           (p_permissions->>'staff')::boolean = true THEN
            RAISE EXCEPTION 'Cashier role cannot be granted second-hand intake, refund, pricing, reporting, or staff authority';
        END IF;

        v_normalized_perms := jsonb_build_object(
            'sales', true,
            'inventory', true,
            'pawn', COALESCE((p_permissions->>'pawn')::boolean, false),
            'sellerAcquisitions', false,
            'refunds', false,
            'pricing', false,
            'reports', false,
            'staff', false
        );

    ELSIF v_target_profile.role = 'senior_cashier' THEN
        -- Senior Cashier: baseline sales, inventory, pawn, sellerAcquisitions.
        -- Optional: refunds, pricing, reports.
        -- Forbidden: staff.
        IF (p_permissions->>'staff')::boolean = true THEN
            RAISE EXCEPTION 'Senior Cashier role cannot be granted staff management authority';
        END IF;

        v_normalized_perms := jsonb_build_object(
            'sales', true,
            'inventory', true,
            'pawn', true,
            'sellerAcquisitions', true,
            'refunds', COALESCE((p_permissions->>'refunds')::boolean, false),
            'pricing', COALESCE((p_permissions->>'pricing')::boolean, false),
            'reports', COALESCE((p_permissions->>'reports')::boolean, false),
            'staff', false
        );

    ELSIF v_target_profile.role = 'manager' THEN
        -- Manager: baseline sales, inventory, pawn, sellerAcquisitions, refunds, reports, staff.
        -- Optional: pricing (can only be granted by Owner).
        IF v_actor_profile.role NOT IN ('owner', 'admin') THEN
            RAISE EXCEPTION 'Only Shop Owners can configure Manager permissions';
        END IF;

        v_normalized_perms := jsonb_build_object(
            'sales', true,
            'inventory', true,
            'pawn', true,
            'sellerAcquisitions', true,
            'refunds', true,
            'reports', true,
            'staff', true,
            'pricing', COALESCE((p_permissions->>'pricing')::boolean, false)
        );

    ELSE
        RAISE EXCEPTION 'Unrecognized staff role for access configuration';
    END IF;

    v_old_perms := COALESCE(v_target_profile.permissions, '{}'::jsonb);
    v_old_schedule := COALESCE(v_target_profile.schedule, '{}'::jsonb);

    -- 6. Perform the profile update atomically
    UPDATE public.profiles
    SET 
        permissions = v_normalized_perms,
        schedule = COALESCE(p_schedule, v_target_profile.schedule),
        updated_at = NOW()
    WHERE id = p_target_id;

    -- 7. Write the audit event (excluding any sensitive credentials)
    INSERT INTO public.staff_audit_logs (
        shop_id,
        actor_id,
        target_staff_id,
        event_type,
        old_values,
        new_values,
        reason
    ) VALUES (
        v_target_profile.shop_id,
        p_actor_id,
        p_target_id,
        'STAFF_ACCESS_UPDATED',
        jsonb_build_object(
            'permissions', v_old_perms,
            'schedule', v_old_schedule
        ),
        jsonb_build_object(
            'permissions', v_normalized_perms,
            'schedule', COALESCE(p_schedule, v_target_profile.schedule)
        ),
        COALESCE(p_reason, 'Staff access and schedule updated with password verification')
    );

    RETURN jsonb_build_object(
        'success', true,
        'permissions', v_normalized_perms,
        'schedule', COALESCE(p_schedule, v_target_profile.schedule)
    );
END;
$$;

-- 3. STRICTLY RESTRICT EXECUTION PRIVILEGES (SERVICE-ROLE ONLY)
REVOKE ALL ON FUNCTION public.secure_update_staff_access(UUID, UUID, JSONB, JSONB, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.secure_update_staff_access(UUID, UUID, JSONB, JSONB, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.secure_update_staff_access(UUID, UUID, JSONB, JSONB, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.secure_update_staff_access(UUID, UUID, JSONB, JSONB, TEXT) TO service_role;
