
-- Staff Access & Administration Hardening
-- Adds timezone support, brute-force protection, and detailed audit logging

-- 1. Add timezone to shop_profiles
ALTER TABLE IF EXISTS public.shop_profiles 
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Africa/Johannesburg';

-- 2. Add rate limiting fields to profiles
ALTER TABLE IF EXISTS public.profiles 
ADD COLUMN IF NOT EXISTS login_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMP WITH TIME ZONE;

-- 3. Create staff_audit_logs table
CREATE TABLE IF NOT EXISTS public.staff_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES public.shop_profiles(id),
    actor_id UUID REFERENCES public.profiles(id),
    target_staff_id UUID REFERENCES public.profiles(id),
    event_type TEXT NOT NULL,
    old_values JSONB,
    new_values JSONB,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on audit logs
ALTER TABLE public.staff_audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow owners and managers to view audit logs for their shop
CREATE POLICY "Owners and managers can view their shop's staff audit logs"
ON public.staff_audit_logs FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
        AND p.shop_id = staff_audit_logs.shop_id
        AND p.role IN ('owner', 'admin', 'manager')
    )
);

-- 4. Create protected profiles update function (RPC)
-- This allows more granular control than standard RLS for complex staff admin logic
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
    v_allowed_fields TEXT[] := ARRAY['permissions', 'schedule', 'is_active', 'full_name', 'phone', 'role', 'pin_code', 'avatar_url'];
    v_field TEXT;
    v_old_values JSONB := '{}'::jsonb;
    v_new_values JSONB := '{}'::jsonb;
    v_final_updates JSONB := '{}'::jsonb;
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
    -- Managers cannot modify owners/admins
    IF v_caller_profile.role = 'manager' AND v_target_profile.role IN ('owner', 'admin') THEN
        RAISE EXCEPTION 'Managers cannot modify Owner or Admin accounts';
    END IF;
    
    -- Managers cannot modify other managers (unless they are the same person, but we use this for admin)
    -- Allow modifying self for basic fields is handled differently, here we focus on admin
    IF v_caller_profile.role = 'manager' AND v_target_profile.role = 'manager' AND v_caller_profile.id != p_target_id THEN
         -- Optional: could allow manager to manager if business rules allow, but spec says "Do not let a Manager modify another Manager"
         RAISE EXCEPTION 'Managers cannot modify other Manager accounts';
    END IF;

    -- 6. Filter updates to allowed fields and check role transitions
    FOR v_field IN SELECT jsonb_object_keys(p_updates) LOOP
        IF v_field = ANY(v_allowed_fields) THEN
            -- Check if trying to promote someone to owner/admin
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
        pin_code = CASE WHEN v_final_updates ? 'pin_code' THEN (v_final_updates->>'pin_code') ELSE pin_code END,
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
