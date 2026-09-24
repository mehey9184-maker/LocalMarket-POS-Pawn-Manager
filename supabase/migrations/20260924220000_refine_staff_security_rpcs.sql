
-- Refine Staff Security RPC for Role Promotion and Privilege Escalation
-- Ensure Managers cannot create more Managers or grant sensitive permissions

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
BEGIN
    -- 1. Get caller profile
    SELECT * INTO v_caller_profile FROM public.profiles WHERE id = auth.uid();
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Caller profile not found';
    END IF;

    -- 2. Check if caller is owner or manager
    IF v_caller_profile.role NOT IN ('owner', 'admin', 'manager') THEN
        RAISE EXCEPTION 'Insufficient permissions to manage staff';
    END IF;

    -- 3. Get target profile
    SELECT * INTO v_target_profile FROM public.profiles WHERE id = p_target_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Target staff profile not found';
    END IF;

    -- 4. Enforce shop isolation
    IF v_caller_profile.shop_id != v_target_profile.shop_id THEN
        RAISE EXCEPTION 'Cannot manage staff from a different shop branch';
    END IF;

    -- 5. Enforce role hierarchy
    IF v_caller_profile.role = 'manager' AND v_target_profile.role IN ('owner', 'admin') THEN
        RAISE EXCEPTION 'Managers cannot modify Owner or Admin accounts';
    END IF;
    
    IF v_caller_profile.role = 'manager' AND v_target_profile.role = 'manager' AND v_caller_profile.id != p_target_id THEN
        RAISE EXCEPTION 'Managers cannot modify other Manager accounts';
    END IF;

    -- 6. Filter updates and check permissions
    FOR v_field IN SELECT jsonb_object_keys(p_updates) LOOP
        IF v_field = ANY(v_allowed_fields) THEN
            -- Role promotion check
            IF v_field = 'role' THEN
                -- Only Owners can promote to Owner or Admin
                IF p_updates->>v_field IN ('owner', 'admin') AND v_caller_profile.role != 'owner' THEN
                    RAISE EXCEPTION 'Only Owners can promote staff to Owner or Admin roles';
                END IF;
                -- Managers cannot promote to Manager
                IF p_updates->>v_field = 'manager' AND v_caller_profile.role = 'manager' AND v_target_profile.role != 'manager' THEN
                    RAISE EXCEPTION 'Managers cannot promote staff to Manager role';
                END IF;
            END IF;

            -- Privilege escalation check in permissions JSON
            IF v_field = 'permissions' AND v_caller_profile.role != 'owner' THEN
                v_perms := p_updates->v_field;
                -- Managers cannot grant staff management permission
                IF (v_perms->>'staff')::boolean = true THEN
                    RAISE EXCEPTION 'Managers cannot grant staff management permissions';
                END IF;
                -- Managers cannot grant reporting permissions if they want to restrict cost access
                -- (Optional: add more restrictions here if needed)
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

    -- If pin_hash is being updated, set event_type
    IF v_final_updates ? 'pin_hash' THEN
        v_event_type := 'PIN_CHANGED';
    END IF;

    -- 7. Apply updates
    UPDATE public.profiles
    SET 
        full_name = COALESCE((v_final_updates->>'full_name'), full_name),
        phone = COALESCE((v_final_updates->>'phone'), phone),
        role = COALESCE((v_final_updates->>'role')::user_role, role),
        pin_hash = COALESCE((v_final_updates->>'pin_hash'), pin_hash),
        -- CRITICAL: Clear legacy pin_code when pin_hash is updated
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

    RETURN jsonb_build_object('success', true, 'target_id', p_target_id);
END;
$$;
