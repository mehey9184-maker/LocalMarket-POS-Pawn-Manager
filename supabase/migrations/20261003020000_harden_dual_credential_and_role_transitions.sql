-- ============================================================================
-- MIGRATION: Harden Dual Credential & Role Transitions
-- Timestamp: 20261003020000
-- Name: 20261003020000_harden_dual_credential_and_role_transitions
--
-- Security Invariants Enforced:
--   1. Role Transitions Atomicity & Permission Normalization:
--      - Senior Cashier / Cashier -> Manager: atomically sets password_setup_required = true
--        and establishes normalized Manager baseline (sales, inventory, pawn, sellerAcquisitions, refunds, reports, staff)
--      - Manager -> Senior Cashier: atomically resets password_setup_required = false
--        and normalizes permissions to Senior Cashier baseline + allowed optional
--      - Manager -> Cashier: atomically resets password_setup_required = false
--        and normalizes permissions to Cashier baseline + allowed optional
--   2. Audit Event Distinction:
--      - Distinct event types: MANAGER_PIN_CHANGED vs PIN_RESET_BY_ADMIN vs STAFF_LOGIN_PASSWORD
-- ============================================================================

-- 1. Ensure password_setup_required column exists
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS password_setup_required BOOLEAN DEFAULT false;

-- 2. Update secure_update_staff_profile to enforce role normalization & password_setup_required atomically
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
    v_allowed_fields TEXT[] := ARRAY['permissions', 'schedule', 'is_active', 'full_name', 'phone', 'role', 'pin_hash', 'avatar_url', 'password_setup_required'];
    v_field TEXT;
    v_old_values JSONB := '{}'::jsonb;
    v_new_values JSONB := '{}'::jsonb;
    v_final_updates JSONB := '{}'::jsonb;
    v_event_type TEXT := 'STAFF_PROFILE_UPDATED';
    v_perms JSONB;
    v_target_effective_role TEXT;
    v_active_owner_count INT;
    v_new_role TEXT;
BEGIN
    -- 1. Get caller profile
    SELECT * INTO v_caller_profile FROM public.profiles WHERE id = auth.uid();
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Caller profile not found';
    END IF;

    -- 2. Check if caller is owner, admin, or manager
    IF v_caller_profile.role NOT IN ('owner', 'admin', 'manager') THEN
        RAISE EXCEPTION 'Insufficient permissions to manage staff';
    END IF;

    -- 3. Get target profile
    SELECT * INTO v_target_profile FROM public.profiles WHERE id = p_target_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Target staff profile not found';
    END IF;

    -- 4. Enforce shop isolation
    IF v_caller_profile.shop_id IS DISTINCT FROM v_target_profile.shop_id AND v_caller_profile.role != 'admin' THEN
        RAISE EXCEPTION 'Cannot manage staff from a different shop branch';
    END IF;

    -- 5. Enforce role hierarchy against Managers
    IF v_caller_profile.role = 'manager' AND v_target_profile.role IN ('owner', 'admin') THEN
        RAISE EXCEPTION 'Managers cannot modify Owner or Admin accounts';
    END IF;
    
    IF v_caller_profile.role = 'manager' AND v_target_profile.role = 'manager' AND v_caller_profile.id != p_target_id THEN
        RAISE EXCEPTION 'Managers cannot modify other Manager accounts';
    END IF;

    -- Determine target role after potential update
    v_new_role := p_updates->>'role';
    v_target_effective_role := COALESCE(v_new_role, v_target_profile.role::text);

    -- 6. Filter updates and check permissions
    FOR v_field IN SELECT jsonb_object_keys(p_updates) LOOP
        IF v_field = ANY(v_allowed_fields) THEN

            -- =================================================================
            -- ROLE UPDATE CHECKS & ATOMIC NORMALIZATION
            -- =================================================================
            IF v_field = 'role' THEN
                -- Invariant 1: Owner Self-Protection (Cannot change own role)
                IF v_caller_profile.role = 'owner' AND p_target_id = v_caller_profile.id THEN
                    IF (p_updates->>v_field)::text != 'owner' THEN
                        RAISE EXCEPTION 'Your Owner account cannot be changed to a staff role.';
                    END IF;
                END IF;

                -- Invariant 3: Owner Role Integrity (Demotion Protection)
                IF v_target_profile.role = 'owner' AND (p_updates->>v_field)::text != 'owner' THEN
                    RAISE EXCEPTION 'An existing Owner account cannot be changed to a staff role.';
                END IF;

                -- Invariant 4: Last-Owner Safety when role changes away from Owner
                IF v_target_profile.role = 'owner' AND (p_updates->>v_field)::text != 'owner' THEN
                    SELECT COUNT(*) INTO v_active_owner_count
                    FROM public.profiles
                    WHERE shop_id = v_target_profile.shop_id
                      AND role = 'owner'
                      AND is_active = true
                      AND id != p_target_id;

                    IF v_active_owner_count < 1 THEN
                        RAISE EXCEPTION 'Cannot modify or deactivate the last remaining active Owner for this shop.';
                    END IF;
                END IF;

                -- Only Owners/Admins can promote to Owner or Admin
                IF p_updates->>v_field IN ('owner', 'admin') AND v_caller_profile.role NOT IN ('owner', 'admin') THEN
                    RAISE EXCEPTION 'Only Owners can promote staff to Owner or Admin roles';
                END IF;

                -- Managers cannot promote to Manager
                IF p_updates->>v_field = 'manager' AND v_caller_profile.role = 'manager' AND v_target_profile.role != 'manager' THEN
                    RAISE EXCEPTION 'Managers cannot promote staff to Manager role';
                END IF;

                -- Atomically apply role normalization and password_setup_required
                IF v_new_role = 'manager' AND v_target_profile.role != 'manager' THEN
                    v_final_updates := v_final_updates || jsonb_build_object(
                        'password_setup_required', true,
                        'permissions', jsonb_build_object(
                            'sales', true,
                            'inventory', true,
                            'pawn', true,
                            'sellerAcquisitions', true,
                            'refunds', true,
                            'reports', true,
                            'staff', true,
                            'pricing', COALESCE((v_target_profile.permissions->>'pricing')::boolean, false)
                        )
                    );
                ELSIF v_new_role = 'senior_cashier' AND v_target_profile.role != 'senior_cashier' THEN
                    v_final_updates := v_final_updates || jsonb_build_object(
                        'password_setup_required', false,
                        'permissions', jsonb_build_object(
                            'sales', true,
                            'inventory', true,
                            'pawn', true,
                            'sellerAcquisitions', true,
                            'refunds', COALESCE((v_target_profile.permissions->>'refunds')::boolean, false),
                            'pricing', COALESCE((v_target_profile.permissions->>'pricing')::boolean, false),
                            'reports', COALESCE((v_target_profile.permissions->>'reports')::boolean, false),
                            'staff', false
                        )
                    );
                ELSIF v_new_role = 'cashier' AND v_target_profile.role != 'cashier' THEN
                    v_final_updates := v_final_updates || jsonb_build_object(
                        'password_setup_required', false,
                        'permissions', jsonb_build_object(
                            'sales', true,
                            'inventory', true,
                            'pawn', COALESCE((v_target_profile.permissions->>'pawn')::boolean, false),
                            'sellerAcquisitions', false,
                            'refunds', false,
                            'pricing', false,
                            'reports', false,
                            'staff', false
                        )
                    );
                END IF;
            END IF;

            -- =================================================================
            -- DEACTIVATION (IS_ACTIVE) CHECKS
            -- =================================================================
            IF v_field = 'is_active' AND (p_updates->>v_field)::boolean = false THEN
                IF v_caller_profile.role = 'owner' AND p_target_id = v_caller_profile.id THEN
                    RAISE EXCEPTION 'The Shop Owner account cannot be deactivated from Staff Management.';
                END IF;

                IF v_target_profile.role = 'owner' THEN
                    SELECT COUNT(*) INTO v_active_owner_count
                    FROM public.profiles
                    WHERE shop_id = v_target_profile.shop_id
                      AND role = 'owner'
                      AND is_active = true
                      AND id != p_target_id;

                    IF v_active_owner_count < 1 THEN
                        RAISE EXCEPTION 'Cannot modify or deactivate the last remaining active Owner for this shop.';
                    END IF;
                END IF;
            END IF;

            -- Add to final updates and audit (excluding sensitive pin_hash)
            v_final_updates := v_final_updates || jsonb_build_object(v_field, p_updates->v_field);
            IF v_field != 'pin_hash' THEN
                v_old_values := v_old_values || jsonb_build_object(v_field, to_jsonb(v_target_profile)->v_field);
                v_new_values := v_new_values || jsonb_build_object(v_field, p_updates->v_field);
            END IF;
        END IF;
    END LOOP;

    -- Determine event type
    IF p_updates ? 'role' AND (p_updates->>'role') IS DISTINCT FROM (v_target_profile.role::text) THEN
        v_event_type := 'ROLE_CHANGED';
    ELSIF p_updates ? 'is_active' THEN
        IF (p_updates->>'is_active')::boolean = false THEN
            v_event_type := 'STAFF_DEACTIVATED';
        ELSE
            v_event_type := 'STAFF_REACTIVATED';
        END IF;
    ELSIF p_updates ? 'pin_hash' THEN
        IF v_caller_profile.id = p_target_id AND v_caller_profile.role = 'manager' THEN
            v_event_type := 'MANAGER_PIN_CHANGED';
        ELSE
            v_event_type := 'PIN_RESET_BY_ADMIN';
        END IF;
    ELSIF p_updates ? 'schedule' THEN
        v_event_type := 'SCHEDULE_CHANGED';
    END IF;

    -- Perform the profile update
    UPDATE public.profiles
    SET 
        role = COALESCE((v_final_updates->>'role')::public."UserRole", role),
        full_name = COALESCE(v_final_updates->>'full_name', full_name),
        phone = COALESCE(v_final_updates->>'phone', phone),
        avatar_url = COALESCE(v_final_updates->>'avatar_url', avatar_url),
        is_active = COALESCE((v_final_updates->>'is_active')::boolean, is_active),
        schedule = COALESCE(v_final_updates->'schedule', schedule),
        permissions = COALESCE(v_final_updates->'permissions', permissions),
        password_setup_required = COALESCE((v_final_updates->>'password_setup_required')::boolean, password_setup_required),
        pin_hash = COALESCE(v_final_updates->>'pin_hash', pin_hash),
        pin_code = NULL,
        updated_at = NOW()
    WHERE id = p_target_id;

    -- Record audit log
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
        v_caller_profile.id,
        p_target_id,
        v_event_type,
        v_old_values,
        v_new_values,
        COALESCE(p_reason, 'Staff profile updated via Admin panel')
    );

    RETURN jsonb_build_object(
        'success', true,
        'profile', (SELECT to_jsonb(p) FROM public.profiles p WHERE p.id = p_target_id)
    );
END;
$$;

REVOKE ALL ON FUNCTION public.secure_update_staff_profile(UUID, JSONB, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.secure_update_staff_profile(UUID, JSONB, TEXT) TO authenticated, service_role;
