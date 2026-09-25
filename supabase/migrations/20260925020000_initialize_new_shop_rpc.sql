-- RPC for atomic shop creation and owner linking
CREATE OR REPLACE FUNCTION public.initialize_new_shop(
    p_shop_name TEXT,
    p_shop_code TEXT,
    p_phone TEXT DEFAULT NULL,
    p_email TEXT DEFAULT NULL,
    p_address TEXT DEFAULT NULL,
    p_city TEXT DEFAULT NULL,
    p_province TEXT DEFAULT NULL,
    p_postal_code TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_user_role user_role;
    v_existing_shop_id UUID;
    v_new_shop_id UUID;
    v_shop_code TEXT;
    v_result JSONB;
BEGIN
    -- 1. Verify Authentication
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    -- 2. Verify Caller is Owner
    SELECT role, shop_id INTO v_user_role, v_existing_shop_id
    FROM public.profiles
    WHERE id = v_user_id;

    IF v_user_role != 'owner' AND v_user_role != 'admin' THEN
        RAISE EXCEPTION 'Only owners can initialize a new shop.';
    END IF;

    -- 3. Verify No Existing Shop
    IF v_existing_shop_id IS NOT NULL THEN
        RAISE EXCEPTION 'This account is already linked to a shop.';
    END IF;

    -- 4. Generate or Validate Shop Code
    v_shop_code := COALESCE(NULLIF(TRIM(p_shop_code), ''), UPPER(SUBSTRING(REPLACE(p_shop_name, ' ', ''), 1, 3)) || '-' || LPAD(FLOOR(RANDOM() * 1000)::TEXT, 3, '0'));

    -- 5. Create Shop Profile
    INSERT INTO public.shop_profiles (
        shop_code,
        shop_name,
        phone,
        email,
        address,
        city,
        province,
        postal_code,
        is_active,
        metadata
    )
    VALUES (
        v_shop_code,
        p_shop_name,
        p_phone,
        p_email,
        p_address,
        p_city,
        p_province,
        p_postal_code,
        true,
        p_metadata
    )
    RETURNING id INTO v_new_shop_id;

    -- 6. Link Owner Profile
    UPDATE public.profiles
    SET shop_id = v_new_shop_id,
        updated_at = now()
    WHERE id = v_user_id;

    -- 7. Audit Log
    INSERT INTO public.system_logs (
        shop_id,
        event_type,
        severity,
        actor_id,
        actor_name,
        details
    )
    VALUES (
        v_new_shop_id,
        'SHOP_INITIALIZED',
        'audit',
        v_user_id,
        'System',
        jsonb_build_object(
            'shop_name', p_shop_name,
            'shop_code', v_shop_code,
            'owner_id', v_user_id
        )
    );

    -- 8. Return Result
    SELECT jsonb_build_object(
        'success', true,
        'shop_id', v_new_shop_id,
        'shop_code', v_shop_code,
        'shop_name', p_shop_name
    ) INTO v_result;

    RETURN v_result;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to initialize shop: %', SQLERRM;
END;
$$;
