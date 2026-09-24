-- ============================================================================
-- PRODUCTION-COMPATIBLE RECONCILED RPCs (20260924120000)
-- Reconciles complete_buy_acquisition, complete_pawn_intake, request_refund,
-- and approve_refund with the actual production database schema.
-- ============================================================================

-- 1. PRODUCTION-COMPATIBLE ATOMIC BUY ACQUISITION RPC
CREATE OR REPLACE FUNCTION public.complete_buy_acquisition(
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

    -- 2. Verify Shop Isolation
    v_effective_shop_id := COALESCE(p_shop_id, v_caller_profile.shop_id);
    IF v_effective_shop_id IS NULL THEN
        RAISE EXCEPTION 'Valid shop branch context is required.';
    END IF;

    IF COALESCE(v_caller_profile.role, '') != 'admin' AND v_caller_profile.shop_id IS DISTINCT FROM v_effective_shop_id THEN
        RAISE EXCEPTION 'Cannot perform acquisition for a different shop branch.';
    END IF;

    -- 3. Verify Seller exists and belongs to shop context
    SELECT * INTO v_seller 
    FROM public.sellers 
    WHERE id = p_seller_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Seller record % not found.', p_seller_id;
    END IF;

    IF v_seller.shop_id IS NOT NULL AND COALESCE(v_caller_profile.role, '') != 'admin' AND v_seller.shop_id IS DISTINCT FROM v_effective_shop_id THEN
        RAISE EXCEPTION 'Seller belongs to a different shop.';
    END IF;

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

        -- Insert or update shop_items
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
            created_at,
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
            'verified',
            'Purchased from ' || v_seller.full_name || ' (' || v_seller.id_number || ')',
            v_internal_note,
            auth.uid(),
            now(),
            now(),
            now()
        )
        ON CONFLICT (id) DO UPDATE SET
            cost_basis = EXCLUDED.cost_basis,
            retail_price = EXCLUDED.retail_price,
            status = EXCLUDED.status,
            updated_at = now();

        -- Insert child item using ACTUAL seller_transaction_items schema
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

        -- Insert SAPS register entry
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
            'VERIFIED',
            now(),
            now()
        )
        ON CONFLICT (entry_number) DO NOTHING;
    END LOOP;

    -- 7. Insert Parent Seller Transaction using ACTUAL seller_transactions schema
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
            'total_amount', p_total_amount
        ),
        'info'
    );

    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', p_transaction_id
    );
END;
$$;

REVOKE ALL ON FUNCTION public.complete_buy_acquisition(uuid, text, uuid, jsonb, numeric, text, text, text, text, text, text, text, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_buy_acquisition(uuid, text, uuid, jsonb, numeric, text, text, text, text, text, text, text, uuid, jsonb) TO authenticated, service_role;


-- 2. PRODUCTION-COMPATIBLE ATOMIC PAWN INTAKE RPC
CREATE OR REPLACE FUNCTION public.complete_pawn_intake(
    p_loan_id UUID,
    p_ticket_number TEXT,
    p_customer_id UUID,
    p_item_id UUID,
    p_item_sku TEXT,
    p_item_title TEXT,
    p_item_category TEXT,
    p_item_brand TEXT DEFAULT NULL,
    p_item_model TEXT DEFAULT NULL,
    p_serial_or_imei TEXT DEFAULT NULL,
    p_condition TEXT DEFAULT 'Good',
    p_item_image_url TEXT DEFAULT NULL,
    p_specs TEXT DEFAULT NULL,
    p_stock_location TEXT DEFAULT NULL,
    p_internal_note TEXT DEFAULT NULL,
    p_principal NUMERIC DEFAULT 0.00,
    p_ncr_monthly_rate NUMERIC DEFAULT 0.05,
    p_monthly_interest NUMERIC DEFAULT 0.00,
    p_monthly_storage_admin_fee NUMERIC DEFAULT 0.00,
    p_total_redemption_amount NUMERIC DEFAULT 0.00,
    p_extension_fee NUMERIC DEFAULT 0.00,
    p_start_date DATE DEFAULT CURRENT_DATE,
    p_expiry_date DATE DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
    p_days_remaining INT DEFAULT 30,
    p_vault_shelf TEXT DEFAULT 'Vault A - Shelf 1',
    p_qr_token TEXT DEFAULT NULL,
    p_officer_name TEXT DEFAULT NULL,
    p_police_station_ref TEXT DEFAULT NULL,
    p_saps_entry_id UUID DEFAULT NULL,
    p_saps_entry_number TEXT DEFAULT NULL,
    p_history JSONB DEFAULT '[]'::jsonb,
    p_shop_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_caller_profile RECORD;
    v_effective_shop_id UUID;
    v_customer RECORD;
    v_existing_loan RECORD;
    v_saps_id UUID;
    v_saps_entry_no TEXT;
    v_dup_item RECORD;
    v_item_serial TEXT;
    v_cast_condition item_condition;
    v_cast_item_status item_status;
BEGIN
    -- 1. Authentication Check
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required for pawn intake.';
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

    -- 2. Verify Shop Isolation
    v_effective_shop_id := COALESCE(p_shop_id, v_caller_profile.shop_id);
    IF v_effective_shop_id IS NULL THEN
        RAISE EXCEPTION 'Valid shop branch context is required.';
    END IF;

    IF COALESCE(v_caller_profile.role, '') != 'admin' AND v_caller_profile.shop_id IS DISTINCT FROM v_effective_shop_id THEN
        RAISE EXCEPTION 'Cannot perform pawn intake for a different shop branch.';
    END IF;

    -- 3. Verify Customer
    SELECT * INTO v_customer 
    FROM public.customers 
    WHERE id = p_customer_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Customer record % not found.', p_customer_id;
    END IF;

    IF v_customer.shop_id IS NOT NULL AND COALESCE(v_caller_profile.role, '') != 'admin' AND v_customer.shop_id IS DISTINCT FROM v_effective_shop_id THEN
        RAISE EXCEPTION 'Customer belongs to a different shop.';
    END IF;

    -- 4. Idempotency Check
    SELECT id INTO v_existing_loan
    FROM public.pawn_loans
    WHERE id = p_loan_id OR ticket_number = p_ticket_number
    LIMIT 1;

    IF v_existing_loan.id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', true,
            'loan_id', v_existing_loan.id,
            'idempotent', true
        );
    END IF;

    -- 5. Serial / IMEI duplicate protection
    v_item_serial := TRIM(COALESCE(p_serial_or_imei, 'N/A'));
    IF v_item_serial IS NOT NULL AND UPPER(v_item_serial) != 'N/A' AND LENGTH(v_item_serial) >= 4 THEN
        SELECT id, sku, title, status INTO v_dup_item
        FROM public.shop_items
        WHERE lower(trim(serial_or_imei)) = lower(v_item_serial)
          AND (shop_id = v_effective_shop_id OR shop_id IS NULL)
          AND status IN ('Retail Floor', 'Vault Hold', 'InStock', 'Reserved', 'Flagged')
          AND id != p_item_id
        LIMIT 1;

        IF v_dup_item.id IS NOT NULL THEN
            RAISE EXCEPTION 'Serial/IMEI "%" already belongs to active inventory item "%" (SKU: %, Status: %).',
                v_item_serial, v_dup_item.title, v_dup_item.sku, v_dup_item.status;
        END IF;
    END IF;

    -- Safe enum casts
    BEGIN
        v_cast_condition := p_condition::item_condition;
    EXCEPTION WHEN OTHERS THEN
        v_cast_condition := 'Good'::item_condition;
    END;

    BEGIN
        v_cast_item_status := 'Vault Hold'::item_status;
    EXCEPTION WHEN OTHERS THEN
        v_cast_item_status := 'Vault Hold'::item_status;
    END;

    -- 6. Insert / Update shop_items
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
        internal_note,
        created_by,
        added_at,
        created_at,
        updated_at
    ) VALUES (
        p_item_id,
        v_effective_shop_id,
        p_item_sku,
        p_item_title,
        p_item_category,
        p_item_brand,
        p_item_model,
        v_item_serial,
        v_cast_condition,
        'Pawn',
        p_principal,
        p_principal,
        p_vault_shelf,
        p_stock_location,
        v_cast_item_status,
        p_item_image_url,
        p_specs,
        'pawn',
        'active',
        p_internal_note,
        auth.uid(),
        now(),
        now(),
        now()
    )
    ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        updated_at = now();

    -- 7. Insert pawn_loans (status is TEXT 'Active')
    INSERT INTO public.pawn_loans (
        id,
        shop_id,
        ticket_number,
        customer_id,
        customer_name,
        customer_id_number,
        customer_mobile,
        customer_address,
        item_id,
        item_title,
        item_category,
        serial_or_imei,
        condition,
        item_image_url,
        principal,
        ncr_monthly_rate,
        monthly_interest,
        monthly_storage_admin_fee,
        total_redemption_amount,
        extension_fee,
        start_date,
        expiry_date,
        days_remaining,
        days_elapsed,
        vault_shelf,
        status,
        qr_token,
        history,
        created_at,
        updated_at
    ) VALUES (
        p_loan_id,
        v_effective_shop_id,
        p_ticket_number,
        p_customer_id,
        v_customer.full_name,
        v_customer.id_number,
        v_customer.mobile,
        v_customer.address,
        p_item_id,
        p_item_title,
        p_item_category,
        v_item_serial,
        p_condition,
        p_item_image_url,
        p_principal,
        p_ncr_monthly_rate,
        p_monthly_interest,
        p_monthly_storage_admin_fee,
        p_total_redemption_amount,
        p_extension_fee,
        p_start_date,
        p_expiry_date,
        p_days_remaining,
        0,
        p_vault_shelf,
        'Active',
        p_qr_token,
        p_history,
        now(),
        now()
    );

    -- 8. Insert saps_entries
    v_saps_id := COALESCE(p_saps_entry_id, gen_random_uuid());
    v_saps_entry_no := COALESCE(p_saps_entry_number, 'SAPS-' || SUBSTRING(p_loan_id::text, 1, 8));

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
        p_customer_id::text,
        v_customer.full_name,
        v_customer.id_number,
        v_customer.address,
        v_customer.mobile,
        p_item_title,
        p_item_category,
        v_item_serial,
        p_condition,
        'Pawn',
        p_principal,
        p_officer_name,
        p_police_station_ref,
        'VERIFIED',
        now(),
        now()
    )
    ON CONFLICT (entry_number) DO NOTHING;

    -- 9. Audit Log
    INSERT INTO public.system_logs (
        shop_id,
        actor_id,
        event_type,
        details,
        severity
    ) VALUES (
        v_effective_shop_id,
        auth.uid(),
        'PAWN_INTAKE_COMPLETED',
        jsonb_build_object(
            'loan_id', p_loan_id,
            'ticket_number', p_ticket_number,
            'customer_id', p_customer_id,
            'principal', p_principal
        ),
        'info'
    );

    RETURN jsonb_build_object(
        'success', true,
        'loan_id', p_loan_id
    );
END;
$$;

REVOKE ALL ON FUNCTION public.complete_pawn_intake(uuid, text, uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, numeric, numeric, numeric, numeric, numeric, numeric, date, date, integer, text, text, text, text, uuid, text, jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_pawn_intake(uuid, text, uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, numeric, numeric, numeric, numeric, numeric, numeric, date, date, integer, text, text, text, text, uuid, text, jsonb, uuid) TO authenticated, service_role;


-- 3. PRODUCTION-COMPATIBLE REQUEST REFUND RPC
CREATE OR REPLACE FUNCTION public.request_refund(
    p_receipt_number TEXT,
    p_item_id UUID,
    p_quantity INTEGER DEFAULT 1,
    p_refund_amount NUMERIC DEFAULT 0.00,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_shop_id UUID;
    v_user_name TEXT;
    v_sale RECORD;
    v_item RECORD;
    v_refund_id UUID;
    v_existing_pending RECORD;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    SELECT shop_id, full_name INTO v_user_shop_id, v_user_name
    FROM public.profiles
    WHERE id = auth.uid();

    IF v_user_shop_id IS NULL THEN
        RAISE EXCEPTION 'User has no assigned shop.';
    END IF;

    -- Positive quantity and refund amount validation
    IF COALESCE(p_quantity, 0) <= 0 THEN
        RAISE EXCEPTION 'Quantity must be greater than zero.';
    END IF;

    IF COALESCE(p_refund_amount, 0) < 0 THEN
        RAISE EXCEPTION 'Refund amount cannot be negative.';
    END IF;

    -- Verify sale receipt
    SELECT * INTO v_sale
    FROM public.sales
    WHERE receipt_number = p_receipt_number AND shop_id = v_user_shop_id;

    IF v_sale.id IS NULL THEN
        RAISE EXCEPTION 'Receipt % not found in current branch.', p_receipt_number;
    END IF;

    -- Verify item
    SELECT * INTO v_item
    FROM public.shop_items
    WHERE id = p_item_id AND shop_id = v_user_shop_id;

    IF v_item.id IS NULL THEN
        RAISE EXCEPTION 'Item not found in current branch.';
    END IF;

    IF v_item.status != 'Sold' THEN
        RAISE EXCEPTION 'Item "%" is not currently recorded as Sold.', v_item.title;
    END IF;

    -- Check for existing pending refund
    SELECT id INTO v_existing_pending
    FROM public.refund_requests
    WHERE receipt_number = p_receipt_number AND item_id = p_item_id AND status = 'Pending Approval'
    LIMIT 1;

    IF v_existing_pending.id IS NOT NULL THEN
        RAISE EXCEPTION 'A pending refund request already exists for this receipt and item.';
    END IF;

    v_refund_id := gen_random_uuid();

    INSERT INTO public.refund_requests (
        id,
        shop_id,
        sale_id,
        receipt_number,
        item_id,
        item_sku,
        item_title,
        quantity,
        refund_amount,
        reason,
        status,
        requested_by,
        requested_by_name,
        created_at,
        updated_at
    ) VALUES (
        v_refund_id,
        v_user_shop_id,
        v_sale.id,
        p_receipt_number,
        p_item_id,
        v_item.sku,
        v_item.title,
        COALESCE(p_quantity, 1),
        p_refund_amount,
        p_reason,
        'Pending Approval',
        auth.uid(),
        COALESCE(v_user_name, 'Cashier'),
        now(),
        now()
    );

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
        'REFUND_REQUESTED',
        jsonb_build_object(
            'refund_id', v_refund_id,
            'receipt_number', p_receipt_number,
            'item_id', p_item_id,
            'amount', p_refund_amount,
            'reason', p_reason
        ),
        'audit'
    );

    RETURN jsonb_build_object(
        'success', true,
        'refund_id', v_refund_id,
        'status', 'Pending Approval'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.request_refund(text, uuid, integer, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_refund(text, uuid, integer, numeric, text) TO authenticated, service_role;


-- 4. PRODUCTION-COMPATIBLE APPROVE REFUND RPC
CREATE OR REPLACE FUNCTION public.approve_refund(
    p_refund_id UUID,
    p_approved BOOLEAN,
    p_note TEXT DEFAULT NULL
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
    v_req RECORD;
    v_item RECORD;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    SELECT shop_id, role, full_name INTO v_user_shop_id, v_user_role, v_user_name
    FROM public.profiles
    WHERE id = auth.uid();

    IF v_user_role NOT IN ('manager', 'owner', 'admin') THEN
        RAISE EXCEPTION 'Unauthorized: Only Managers, Owners, and Admins can approve refunds.';
    END IF;

    SELECT * INTO v_req
    FROM public.refund_requests
    WHERE id = p_refund_id AND shop_id = v_user_shop_id
    FOR UPDATE;

    IF v_req.id IS NULL THEN
        RAISE EXCEPTION 'Refund request not found.';
    END IF;

    IF v_req.status != 'Pending Approval' THEN
        RAISE EXCEPTION 'Refund request is already %.', v_req.status;
    END IF;

    -- Self-approval prohibition
    IF v_req.requested_by = auth.uid() THEN
        RAISE EXCEPTION 'Self-approval is not permitted. Manager or Owner approval required.';
    END IF;

    IF p_approved THEN
        SELECT * INTO v_item
        FROM public.shop_items
        WHERE id = v_req.item_id AND shop_id = v_user_shop_id
        FOR UPDATE;

        IF v_item.id IS NOT NULL THEN
            UPDATE public.shop_items
            SET status = 'Retail Floor'::item_status,
                updated_at = now()
            WHERE id = v_req.item_id;
        END IF;

        UPDATE public.refund_requests
        SET status = 'Approved',
            approved_by = auth.uid(),
            approved_by_name = COALESCE(v_user_name, 'Manager'),
            updated_at = now()
        WHERE id = p_refund_id;

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
            'REFUND_APPROVED',
            jsonb_build_object(
                'refund_id', p_refund_id,
                'receipt_number', v_req.receipt_number,
                'item_id', v_req.item_id,
                'amount', v_req.refund_amount,
                'note', p_note
            ),
            'audit'
        );

        RETURN jsonb_build_object(
            'success', true,
            'status', 'Approved',
            'item_restored', true
        );
    ELSE
        UPDATE public.refund_requests
        SET status = 'Rejected',
            approved_by = auth.uid(),
            approved_by_name = COALESCE(v_user_name, 'Manager'),
            rejection_reason = p_note,
            updated_at = now()
        WHERE id = p_refund_id;

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
            'REFUND_REJECTED',
            jsonb_build_object(
                'refund_id', p_refund_id,
                'receipt_number', v_req.receipt_number,
                'item_id', v_req.item_id,
                'reason', p_note
            ),
            'audit'
        );

        RETURN jsonb_build_object(
            'success', true,
            'status', 'Rejected'
        );
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_refund(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_refund(uuid, boolean, text) TO authenticated, service_role;
