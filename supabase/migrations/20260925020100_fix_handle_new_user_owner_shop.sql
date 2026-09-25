-- Prevent automatic shop assignment for owners during initial profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_cashier_code TEXT;
    default_shop_id UUID;
    v_role user_role;
BEGIN
    new_cashier_code := 'CSH-' || LPAD(FLOOR(RANDOM() * 9000 + 1000)::TEXT, 4, '0');
    v_role := COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'cashier'::user_role);
    
    -- Assign to default active shop profile ONLY if user is NOT an owner or admin
    -- Owners must create their own shop during first-run setup
    IF v_role != 'owner' AND v_role != 'admin' THEN
        SELECT id INTO default_shop_id FROM public.shop_profiles WHERE is_active = true ORDER BY created_at ASC LIMIT 1;
    ELSE
        default_shop_id := NULL;
    END IF;

    INSERT INTO public.profiles (
        id,
        shop_id,
        email,
        full_name,
        cashier_code,
        role,
        avatar_url,
        digital_signature
    )
    VALUES (
        NEW.id,
        default_shop_id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
        new_cashier_code,
        v_role,
        NEW.raw_user_meta_data->>'avatar_url',
        'Verified: ' || COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1))
    );
    
    INSERT INTO public.system_logs (event_type, severity, actor_id, actor_name, details, shop_id)
    VALUES (
        'AUTH_USER_CREATED', 
        'audit', 
        NEW.id, 
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        jsonb_build_object('email', NEW.email, 'cashier_code', new_cashier_code, 'role', v_role),
        default_shop_id
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
