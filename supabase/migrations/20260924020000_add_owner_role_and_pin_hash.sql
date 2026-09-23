-- Add owner to user_role enum if not already present
DO $$
BEGIN
    ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'owner';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add pin_hash column to profiles if not exists
ALTER TABLE IF EXISTS public.profiles 
ADD COLUMN IF NOT EXISTS pin_hash TEXT;

-- Update secure_update_staff_profile RPC to support pin_hash and use auth.uid() correctly with user-scoped client
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
BEGIN
    -- 1. Get caller profile using auth.uid()
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

    -- 6. Filter updates to allowed fields and check role transitions
    FOR v_field IN SELECT jsonb_object_keys(p_updates) LOOP
        IF v_field = ANY(v_allowed_fields) THEN
            IF v_field = 'role' AND p_updates->>v_field IN ('owner', 'admin') AND v_caller_profile.role != 'owner' THEN
                RAISE EXCEPTION 'Only Owners can promote staff to Owner or Admin roles';
            END IF;

            v_old_values := v_old_values || jsonb_build_object(v_field, row_to_json(v_target_profile)->v_field);
            v_new_values := v_new_values || jsonb_build_object(v_field, p_updates->v_field);
            v_final_updates := v_final_updates || jsonb_build_object(v_field, p_updates->v_field);
        END IF;
    END LOOP;

    IF v_final_updates = '{}'::jsonb THEN
        RETURN jsonb_build_object('success', true, 'message', 'No valid fields to update');
    END IF;

    -- 7. Apply updates
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

    -- 8. Log audit
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
        'STAFF_PROFILE_UPDATED',
        v_old_values,
        v_new_values,
        p_reason
    );

    RETURN jsonb_build_object('success', true, 'target_id', p_target_id);
END;
$$;
