-- ============================================================================
-- MIGRATION: Owner-Only Shop Settings & Fixed System Role Permission Invariants
-- Timestamp: 20261002020000
-- Name: 20261002020000_owner_only_shop_settings_and_fixed_role_defaults
--
-- Security Invariants Enforced:
--   1. Owner-Only Shop Profile Settings:
--      Only users with role 'owner' (for their shop) or 'admin' may UPDATE,
--      INSERT, or DELETE records in public.shop_profiles.
--      Managers, Senior Cashiers, and Cashiers are strictly denied.
--   2. Fixed System Role Permission Invariants in secure_update_staff_profile:
--      - Cashier permissions are fixed strictly to Sales and Inventory.
--      - Senior Cashier permissions are fixed strictly to Sales, Inventory, Pawn, Seller Intake.
--      - Manager permissions are fixed to Sales, Inventory, Pawn, Seller Intake, Refunds, Reports.
--      - Direct RPC attempts to elevate fixed role permissions are rejected.
--   3. All Existing Owner Self-Protection & Demotion Invariants Preserved:
--      - Owner cannot change own role or deactivate own account.
--      - Existing Owner profiles cannot be demoted or deactivated if last active owner.
--      - Manager hierarchy and cross-shop isolation strictly enforced.
-- ============================================================================

-- 1. ROW LEVEL SECURITY ON SHOP_PROFILES
ALTER TABLE public.shop_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Managers manage shop profiles" ON public.shop_profiles;
DROP POLICY IF EXISTS "Allow authenticated manage shop profiles" ON public.shop_profiles;
DROP POLICY IF EXISTS "Owners manage shop profiles" ON public.shop_profiles;
DROP POLICY IF EXISTS "Owners update shop profiles" ON public.shop_profiles;
DROP POLICY IF EXISTS "Owners insert shop profiles" ON public.shop_profiles;
DROP POLICY IF EXISTS "Owners delete shop profiles" ON public.shop_profiles;
DROP POLICY IF EXISTS "Staff read active shop profiles" ON public.shop_profiles;

-- Staff can read active shop profile for receipts, headers, etc.
CREATE POLICY "Staff read active shop profiles" ON public.shop_profiles
    FOR SELECT TO authenticated
    USING (is_active = true OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
          AND role IN ('owner', 'admin', 'manager')
    ));

-- Only Owner (of this shop) or Admin can update shop profile
CREATE POLICY "Owners update shop profiles" ON public.shop_profiles
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
              AND role IN ('owner', 'admin')
              AND (shop_id = public.shop_profiles.id OR role = 'admin')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
              AND role IN ('owner', 'admin')
              AND (shop_id = public.shop_profiles.id OR role = 'admin')
        )
    );

-- Only Owner or Admin can insert shop profile
CREATE POLICY "Owners insert shop profiles" ON public.shop_profiles
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
              AND role IN ('owner', 'admin')
        )
    );

-- Only Owner or Admin can delete shop profile
CREATE POLICY "Owners delete shop profiles" ON public.shop_profiles
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
              AND role IN ('owner', 'admin')
              AND (shop_id = public.shop_profiles.id OR role = 'admin')
        )
    );

-- 2. SECURE UPDATE STAFF PROFILE RPC WITH FIXED ROLE INVARIANTS
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
    v_perms JSONB;
    v_target_effective_role TEXT;
    v_active_owner_count INT;
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
    v_target_effective_role := COALESCE(p_updates->>'role', v_target_profile.role::text);

    -- 6. Filter updates and check permissions
    FOR v_field IN SELECT jsonb_object_keys(p_updates) LOOP
        IF v_field = ANY(v_allowed_fields) THEN

            -- =================================================================
            -- ROLE UPDATE CHECKS
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
            END IF;

            -- =================================================================
            -- DEACTIVATION (IS_ACTIVE) CHECKS
            -- =================================================================
            IF v_field = 'is_active' AND (p_updates->>v_field)::boolean = false THEN
                -- Invariant 2: Owner Self-Deactivation Protection
                IF v_caller_profile.role = 'owner' AND p_target_id = v_caller_profile.id THEN
                    RAISE EXCEPTION 'The Shop Owner account cannot be deactivated from Staff Management.';
                END IF;

                -- Invariant 4: Last-Owner Safety on Deactivation
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

            -- =================================================================
            -- FIXED SYSTEM ROLE PERMISSION INVARIANTS
            -- =================================================================
            IF v_field = 'permissions' THEN
                v_perms := p_updates->v_field;

                -- Cashier fixed permissions (sales, inventory only)
                IF v_target_effective_role = 'cashier' THEN
                    IF (v_perms->>'pawn')::boolean = true OR
                       (v_perms->>'sellerAcquisitions')::boolean = true OR
                       (v_perms->>'refunds')::boolean = true OR
                       (v_perms->>'pricing')::boolean = true OR
                       (v_perms->>'reports')::boolean = true OR
                       (v_perms->>'staff')::boolean = true THEN
                        RAISE EXCEPTION 'Cashier role permissions are fixed to Sales and Inventory.';
                    END IF;
                END IF;

                -- Senior Cashier fixed permissions (sales, inventory, pawn, sellerAcquisitions only)
                IF v_target_effective_role = 'senior_cashier' THEN
                    IF (v_perms->>'refunds')::boolean = true OR
                       (v_perms->>'pricing')::boolean = true OR
                       (v_perms->>'reports')::boolean = true OR
                       (v_perms->>'staff')::boolean = true THEN
                        RAISE EXCEPTION 'Senior Cashier role permissions are fixed and cannot be elevated.';
                    END IF;
                END IF;

                -- Manager fixed permissions (cannot grant pricing or full staff admin)
                IF v_target_effective_role = 'manager' THEN
                    IF (v_perms->>'pricing')::boolean = true OR
                       (v_perms->>'staff')::boolean = true THEN
                        RAISE EXCEPTION 'Manager role permissions are fixed and cannot be elevated.';
                    END IF;
                END IF;

                -- Non-owners cannot grant staff management permissions under any circumstance
                IF v_caller_profile.role NOT IN ('owner', 'admin') THEN
                    IF (v_perms->>'staff')::boolean = true THEN
                        RAISE EXCEPTION 'Managers cannot grant staff management permissions';
                    END IF;
                END IF;
            END IF;

            -- CRITICAL: Never include pin_hash in audit old/new values
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

    -- Determine descriptive audit event_type
    IF v_final_updates ? 'pin_hash' THEN
        v_event_type := 'PIN_RESET';
    ELSIF v_final_updates ? 'is_active' THEN
        IF (v_final_updates->>'is_active')::boolean = false THEN
            v_event_type := 'STAFF_DEACTIVATED';
        ELSE
            v_event_type := 'STAFF_REACTIVATED';
        END IF;
    ELSIF v_final_updates ? 'role' THEN
        v_event_type := 'ROLE_CHANGED';
    ELSIF v_final_updates ? 'schedule' THEN
        v_event_type := 'SCHEDULE_CHANGED';
    ELSE
        v_event_type := 'STAFF_PROFILE_UPDATED';
    END IF;

    -- 7. Apply updates
    UPDATE public.profiles
    SET 
        full_name = COALESCE((v_final_updates->>'full_name'), full_name),
        phone = COALESCE((v_final_updates->>'phone'), phone),
        role = COALESCE((v_final_updates->>'role')::user_role, role),
        pin_hash = COALESCE((v_final_updates->>'pin_hash'), pin_hash),
        pin_code = CASE WHEN v_final_updates ? 'pin_hash' THEN NULL ELSE pin_code END,
        avatar_url = COALESCE((v_final_updates->>'avatar_url'), avatar_url),
        schedule = COALESCE((v_final_updates->'schedule'), schedule),
        permissions = COALESCE((v_final_updates->'permissions'), permissions),
        is_active = COALESCE((v_final_updates->'is_active')::boolean, is_active),
        updated_at = now()
    WHERE id = p_target_id;

    -- 8. Log audit
    INSERT INTO public.staff_audit_logs (
        shop_id, actor_id, target_staff_id, event_type, old_values, new_values, reason
    ) VALUES (
        v_caller_profile.shop_id, v_caller_profile.id, p_target_id, v_event_type,
        CASE WHEN v_old_values = '{}'::jsonb THEN NULL ELSE v_old_values END,
        CASE WHEN v_new_values = '{}'::jsonb THEN NULL ELSE v_new_values END,
        p_reason
    );

    RETURN jsonb_build_object('success', true, 'target_id', p_target_id, 'event_type', v_event_type);
END;
$$;

-- Routine privileges on secure_update_staff_profile
REVOKE ALL ON FUNCTION public.secure_update_staff_profile(uuid, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.secure_update_staff_profile(uuid, jsonb, text) TO authenticated, service_role;
