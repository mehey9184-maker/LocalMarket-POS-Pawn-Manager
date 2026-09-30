-- ============================================================================
-- MIGRATION: Fix complete_buy_acquisition_internal user_role enum comparison
-- Timestamp: 20260930010000
-- Name: 20260930010000_fix_complete_buy_acquisition_internal_role_enum
--
-- Problem:
--   Live Supabase environment reported:
--   "invalid input value for enum user_role: """
--   at line 55 inside PL/pgSQL function complete_buy_acquisition_internal.
--
-- Cause:
--   The previous implementation used COALESCE with role and an empty string literal.
--   Since profiles.role is of enum type public.user_role, coercing an empty
--   string literal into public.user_role raises a PostgreSQL runtime error (code 22P02).
--
-- Solution:
--   Use enum-safe comparison:
--   v_caller_profile.role IS DISTINCT FROM 'admin'::public.user_role
--   in both shop-isolation and seller-isolation checks.
--
-- Security:
--   - Retains SECURITY DEFINER and SET search_path = public, auth
--   - Retains all authentication, active-profile, and isolation checks
--   - Retains exact privileges: EXECUTE to authenticated and service_role;
--     DENIED to PUBLIC and anon.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.complete_buy_acquisition_internal(
    p_transaction_id UUID,
    p_transaction_number TEXT,
    p_seller_id UUID,
    p_items JSONB,
    p_total_amount NUMERIC DEFAULT 0.00,
    p_payment_method TEXT DEFAULT 'cash',
    p_payment_status TEXT DEFAULT 'Paid',
    p_transaction_status TEXT DEFAULT 'Acquired',
    p_compliance_status TEXT DEFAULT NULL,
    p_saps_ref TEXT DEFAULT NULL,
    p_officer_name TEXT DEFAULT NULL,
    p_police_station_ref TEXT DEFAULT NULL,
    p_shop_id UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_caller_profile RECORD;
    v_effective_shop_id UUID;
    v_seller RECORD;
    v_existing_tx RECORD;
    v_item_elem JSONB;
    v_item_id UUID;
    v_item_sku TEXT;
    v_item_title TEXT;
    v_item_category TEXT;
    v_item_brand TEXT;
    v_item_model TEXT;
    v_item_serial TEXT;
    v_item_condition TEXT;
    v_amount_paid NUMERIC(12,2);
    v_retail_price NUMERIC(12,2);
    v_image_url TEXT;
    v_specs TEXT;
    v_stock_location TEXT;
    v_internal_note TEXT;
    v_saps_id UUID;
    v_saps_entry_no TEXT;
    v_dup_item RECORD;
    v_seen_item_ids UUID[] := '{}';
    v_first_item_id UUID := NULL;
    v_first_item_sku TEXT := NULL;
    v_first_item_title TEXT := NULL;
    v_saps_verification_status TEXT;
    v_cast_condition item_condition;
    v_cast_status item_status;
BEGIN
    -- 1. Authentication Check
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required for buy acquisition.';
    END IF;

    SELECT * INTO v_caller_profile 
    FROM public.profiles 
    WHERE id = auth.uid();

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Caller profile not found.';
    END IF;

    IF NOT COALESCE(v_caller_profile.is_active, true) THEN
        RAISE EXCEPTION 'Caller account is deactivated.';
    END IF;

    -- 2. Verify Shop Isolation (Enum-safe comparison)
    v_effective_shop_id := COALESCE(p_shop_id, v_caller_profile.shop_id);
    IF v_effective_shop_id IS NULL THEN
        RAISE EXCEPTION 'Valid shop branch context is required.';
    END IF;

    IF v_caller_profile.role IS DISTINCT FROM 'admin'::public.user_role
       AND v_caller_profile.shop_id IS DISTINCT FROM v_effective_shop_id THEN
        RAISE EXCEPTION 'Cannot perform acquisition for a different shop branch.';
    END IF;

    -- 3. Verify Seller (Enum-safe comparison)
    SELECT * INTO v_seller 
    FROM public.sellers 
    WHERE id = p_seller_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Seller record % not found.', p_seller_id;
    END IF;

    IF v_seller.shop_id IS NOT NULL
       AND v_caller_profile.role IS DISTINCT FROM 'admin'::public.user_role
       AND v_seller.shop_id IS DISTINCT FROM v_effective_shop_id THEN
        RAISE EXCEPTION 'Seller belongs to a different shop.';
    END IF;

    -- Conditional SAPS verification based on seller verified state
    v_saps_verification_status := CASE WHEN COALESCE(v_seller.verified, false) THEN 'VERIFIED' ELSE 'PENDING' END;

    -- 4. Idempotency Check
    SELECT id INTO v_existing_tx
    FROM public.seller_transactions
    WHERE id = p_transaction_id
    LIMIT 1;

    IF v_existing_tx.id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', true,
            'transaction_id', v_existing_tx.id,
            'idempotent', true
        );
    END IF;

    -- 5. Validate Items Payload
    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'At least one item is required for acquisition.';
    END IF;

    -- 6. Process Items Atomically
    FOR v_item_elem IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_item_id := COALESCE((v_item_elem->>'id')::UUID, gen_random_uuid());
        v_item_sku := COALESCE(v_item_elem->>'sku', 'LM-' || SUBSTRING(v_item_id::text, 1, 8));
        v_item_title := COALESCE(v_item_elem->>'title', 'Untitled Second-Hand Item');
        v_item_category := COALESCE(v_item_elem->>'category', 'General');
        v_item_brand := v_item_elem->>'brand';
        v_item_model := v_item_elem->>'model';
        v_item_serial := TRIM(COALESCE(v_item_elem->>'serial_or_imei', v_item_elem->>'serialOrImei', 'N/A'));
        v_item_condition := COALESCE(v_item_elem->>'condition', 'Good');
        v_amount_paid := COALESCE((v_item_elem->>'amount_paid')::NUMERIC, (v_item_elem->>'agreedOffer')::NUMERIC, 0.00);
        v_retail_price := COALESCE((v_item_elem->>'retail_price')::NUMERIC, ROUND(v_amount_paid * 1.85, 2));
        v_image_url := COALESCE(v_item_elem->>'image_url', v_item_elem->>'imageUrl');
        v_specs := COALESCE(v_item_elem->>'specs', NULLIF(CONCAT_WS(' • ', v_item_brand, v_item_model), ''));
        v_stock_location := COALESCE(v_item_elem->>'stock_location', v_item_elem->>'stockLocation', 'Retail Floor');
        v_internal_note := COALESCE(v_item_elem->>'internal_note', v_item_elem->>'internalNote');

        IF v_first_item_id IS NULL THEN
            v_first_item_id := v_item_id;
            v_first_item_sku := v_item_sku;
            v_first_item_title := v_item_title;
        END IF;

        IF v_item_id = ANY(v_seen_item_ids) THEN
            RAISE EXCEPTION 'Item ID % appears multiple times in acquisition payload.', v_item_id;
        END IF;
        v_seen_item_ids := array_append(v_seen_item_ids, v_item_id);

        -- Duplicate serial/IMEI protection against active inventory
        IF v_item_serial IS NOT NULL AND UPPER(v_item_serial) != 'N/A' AND LENGTH(v_item_serial) >= 4 THEN
            SELECT id, sku, title, status INTO v_dup_item
            FROM public.shop_items
            WHERE lower(trim(serial_or_imei)) = lower(v_item_serial)
              AND (shop_id = v_effective_shop_id OR shop_id IS NULL)
              AND status IN ('Retail Floor', 'Vault Hold', 'InStock', 'Reserved', 'Flagged')
              AND id != v_item_id
            LIMIT 1;

            IF v_dup_item.id IS NOT NULL THEN
                RAISE EXCEPTION 'Serial/IMEI "%" already belongs to active inventory item "%" (SKU: %, Status: %).',
                    v_item_serial, v_dup_item.title, v_dup_item.sku, v_dup_item.status;
            END IF;
        END IF;

        -- Safe enum casting
        BEGIN
            v_cast_condition := v_item_condition::item_condition;
        EXCEPTION WHEN OTHERS THEN
            v_cast_condition := 'Good'::item_condition;
        END;

        BEGIN
            v_cast_status := 'Retail Floor'::item_status;
        EXCEPTION WHEN OTHERS THEN
            v_cast_status := 'Retail Floor'::item_status;
        END;

        -- Insert or update shop_items (NO created_at column)
        INSERT INTO public.shop_items (
            id,
            shop_id,
            sku,
            title,
            category,
            brand,
            model,
            serial_or_imei,
            condition,
            acquisition_type,
            cost_basis,
            retail_price,
            vault_location,
            stock_location,
            status,
            image_url,
            specs,
            source_type,
            source_status,
            source_note,
            internal_note,
            created_by,
            added_at,
            updated_at
        ) VALUES (
            v_item_id,
            v_effective_shop_id,
            v_item_sku,
            v_item_title,
            v_item_category,
            v_item_brand,
            v_item_model,
            v_item_serial,
            v_cast_condition,
            'Buy',
            v_amount_paid,
            v_retail_price,
            v_stock_location,
            v_stock_location,
            v_cast_status,
            v_image_url,
            v_specs,
            'seller',
            LOWER(v_saps_verification_status),
            'Purchased from ' || v_seller.full_name || ' (' || v_seller.id_number || ')',
            v_internal_note,
            auth.uid(),
            now(),
            now()
        )
        ON CONFLICT (id) DO UPDATE SET
            cost_basis = EXCLUDED.cost_basis,
            retail_price = EXCLUDED.retail_price,
            status = EXCLUDED.status,
            updated_at = now();

        -- Insert seller_transaction_items
        INSERT INTO public.seller_transaction_items (
            id,
            shop_id,
            seller_id,
            item_id,
            title,
            amount,
            transaction_type,
            created_at
        ) VALUES (
            COALESCE((v_item_elem->>'seller_item_id')::UUID, gen_random_uuid()),
            v_effective_shop_id,
            p_seller_id,
            v_item_id,
            v_item_title,
            v_amount_paid,
            'Buy',
            now()
        );

        -- Insert SAPS register entry with conditional verification status
        v_saps_id := COALESCE((v_item_elem->>'saps_entry_id')::UUID, gen_random_uuid());
        v_saps_entry_no := COALESCE(v_item_elem->>'saps_entry_number', 'SAPS-' || SUBSTRING(v_saps_id::text, 1, 8));

        INSERT INTO public.saps_entries (
            id,
            shop_id,
            entry_number,
            timestamp,
            customer_id,
            customer_name,
            customer_id_number,
            customer_address,
            customer_phone,
            item_description,
            category,
            serial_or_imei,
            condition,
            acquisition_type,
            consideration_paid,
            officer_name,
            police_station_ref,
            verification_status,
            created_at,
            updated_at
        ) VALUES (
            v_saps_id,
            v_effective_shop_id,
            v_saps_entry_no,
            now(),
            p_seller_id::text,
            v_seller.full_name,
            v_seller.id_number,
            v_seller.address,
            v_seller.mobile,
            v_item_title,
            v_item_category,
            v_item_serial,
            v_item_condition,
            'Buy',
            v_amount_paid,
            p_officer_name,
            p_police_station_ref,
            v_saps_verification_status,
            now(),
            now()
        )
        ON CONFLICT (entry_number) DO NOTHING;
    END LOOP;

    -- 7. Insert Parent Seller Transaction
    INSERT INTO public.seller_transactions (
        id,
        shop_id,
        seller_id,
        item_id,
        item_sku,
        item_title,
        transaction_type,
        amount_paid,
        saps_reference,
        cashier_id,
        status,
        metadata,
        timestamp,
        created_at,
        updated_at
    ) VALUES (
        p_transaction_id,
        v_effective_shop_id,
        p_seller_id,
        v_first_item_id,
        v_first_item_sku,
        v_first_item_title,
        'Buy',
        p_total_amount,
        p_saps_ref,
        auth.uid(),
        COALESCE(p_payment_status, 'Completed'),
        p_metadata,
        now(),
        now(),
        now()
    );

    -- 8. Audit Log
    INSERT INTO public.system_logs (
        shop_id,
        actor_id,
        event_type,
        details,
        severity
    ) VALUES (
        v_effective_shop_id,
        auth.uid(),
        'BUY_ACQUISITION_COMPLETED',
        jsonb_build_object(
            'transaction_id', p_transaction_id,
            'seller_id', p_seller_id,
            'items_count', jsonb_array_length(p_items),
            'total_amount', p_total_amount,
            'verification_status', v_saps_verification_status
        ),
        'info'
    );

    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', p_transaction_id
    );
END;
$$;

-- Maintain strict routine privileges:
REVOKE ALL ON FUNCTION public.complete_buy_acquisition_internal(
    uuid, text, uuid, jsonb, numeric, text, text, text, text, text, text, text, uuid, jsonb
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.complete_buy_acquisition_internal(
    uuid, text, uuid, jsonb, numeric, text, text, text, text, text, text, text, uuid, jsonb
) TO authenticated, service_role;
