-- ============================================================================
-- AUTHORITATIVE ATOMIC BUY & PAWN ACQUISITIONS RPCs (20260924110000)
-- Atomically processes Outright Purchase (Buy) and Pawn Intakes in LocalMarket.
-- Enforces:
-- 1. Single database transaction boundary (no partial success)
-- 2. Caller authentication and shop isolation
-- 3. Identity validation (Seller / Customer ownership)
-- 4. Serial / IMEI duplicate validation against active store inventory
-- 5. Inventory item creation / acquisition state
-- 6. Relational transaction / loan creation
-- 7. Statutory SAPS Form 21 register entry creation
-- 8. Immutable audit log entry
-- 9. Complete idempotency for safe retryability
-- ============================================================================

-- 1. AUTHORITATIVE ATOMIC BUY ACQUISITION RPC
CREATE OR REPLACE FUNCTION public.complete_buy_acquisition(
    p_transaction_id UUID,
    p_transaction_number TEXT,
    p_seller_id UUID,
    p_items JSONB, -- Array of { id, sku, title, category, brand, model, serial_or_imei, condition, amount_paid, retail_price, image_url, specs, stock_location, internal_note, saps_entry_id, saps_entry_number }
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
    v_compliance_status TEXT;
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
    v_item_count INT := 0;
    v_calc_total NUMERIC(12,2) := 0.00;
BEGIN
    -- 1. Enforce Authentication
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

    IF v_caller_profile.role != 'admin' AND v_caller_profile.shop_id != v_effective_shop_id THEN
        RAISE EXCEPTION 'Cannot perform acquisition for a different shop branch.';
    END IF;

    -- 3. Verify Seller exists and belongs to shop context
    SELECT * INTO v_seller 
    FROM public.sellers 
    WHERE id = p_seller_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Seller record % not found.', p_seller_id;
    END IF;

    IF v_seller.shop_id IS NOT NULL AND v_caller_profile.role != 'admin' AND v_seller.shop_id != v_effective_shop_id THEN
        RAISE EXCEPTION 'Seller belongs to a different shop.';
    END IF;

    -- 4. Idempotency Check
    SELECT id, transaction_number, total_approved_payout INTO v_existing_tx
    FROM public.seller_transactions
    WHERE id = p_transaction_id OR transaction_number = p_transaction_number
    LIMIT 1;

    IF v_existing_tx.id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', true,
            'transaction_id', v_existing_tx.id,
            'transaction_number', v_existing_tx.transaction_number,
            'total_approved_payout', v_existing_tx.total_approved_payout,
            'idempotent', true
        );
    END IF;

    -- 5. Validate Items Payload
    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'At least one item is required for acquisition.';
    END IF;

    -- 6. Derive statutory compliance status
    v_compliance_status := COALESCE(p_compliance_status, CASE WHEN v_seller.verified THEN 'VERIFIED' ELSE 'PENDING' END);

    -- 7. Process Items Atomically
    FOR v_item_elem IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_item_id := COALESCE((v_item_elem->>'id')::UUID, gen_random_uuid());
        v_item_sku := COALESCE(v_item_elem->>'sku', 'LM-' || SUBSTRING(v_item_id::text, 1, 8));
        v_item_title := COALESCE(v_item_elem->>'title', 'Untitled Second-Hand Item');
        v_item_category := COALESCE(v_item_elem->>'category', 'General');
        v_item_brand := v_item_elem->>'brand';
        v_item_model := v_item_elem->>'model';
        v_item_serial := TRIM(COALESCE(v_item_elem->>'serial_or_imei', v_item_elem->>'serialOrImei', 'N/A'));
        v_item_condition := COALESCE(v_item_elem->>'condition', 'Good');
        v_amount_paid := COALESCE((v_item_elem->>'amount_paid')::NUMERIC, (v_item_elem->>'agreedOffer')::NUMERIC, (v_item_elem->>'amountPaid')::NUMERIC, 0.00);
        v_retail_price := COALESCE((v_item_elem->>'retail_price')::NUMERIC, (v_item_elem->>'suggestedRetail')::NUMERIC, (v_item_elem->>'retailPrice')::NUMERIC, ROUND(v_amount_paid * 1.85, 2));
        v_image_url := v_item_elem->>'image_url';
        IF v_image_url IS NULL THEN
            v_image_url := v_item_elem->>'imageUrl';
        END IF;
        v_specs := COALESCE(v_item_elem->>'specs', NULLIF(CONCAT_WS(' • ', v_item_brand, v_item_model), ''));
        v_stock_location := COALESCE(v_item_elem->>'stock_location', v_item_elem->>'stockLocation', 'Retail Floor');
        v_internal_note := COALESCE(v_item_elem->>'internal_note', v_item_elem->>'internalNote');

        -- Prevent duplicates in same payload
        IF v_item_id = ANY(v_seen_item_ids) THEN
            RAISE EXCEPTION 'Item ID % appears multiple times in acquisition payload.', v_item_id;
        END IF;
        v_seen_item_ids := array_append(v_seen_item_ids, v_item_id);

        -- Enforce duplicate serial/IMEI check against active store inventory
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

        -- Insert or Update Inventory Item
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
            v_item_condition::item_condition,
            'Buy',
            v_amount_paid,
            v_retail_price,
            v_stock_location,
            v_stock_location,
            'Retail Floor'::item_status,
            v_image_url,
            v_specs,
            'seller',
            LOWER(v_compliance_status),
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

        -- Insert Relational Child Item in seller_transaction_items
        INSERT INTO public.seller_transaction_items (
            id,
            seller_transaction_id,
            shop_id,
            item_id,
            item_sku,
            item_title,
            amount_paid,
            retail_price,
            serial_or_imei,
            condition,
            created_at,
            updated_at
        ) VALUES (
            COALESCE((v_item_elem->>'seller_item_id')::UUID, gen_random_uuid()),
            p_transaction_id,
            v_effective_shop_id,
            v_item_id,
            v_item_sku,
            v_item_title,
            v_amount_paid,
            v_retail_price,
            v_item_serial,
            v_item_condition,
            now(),
            now()
        );

        -- Insert Statutory SAPS Form 21 Register Entry for each item
        v_saps_id := COALESCE((v_item_elem->>'saps_entry_id')::UUID, (v_item_elem->>'sapsId')::UUID, gen_random_uuid());
        v_saps_entry_no := COALESCE(
            v_item_elem->>'saps_entry_number', 
            v_item_elem->>'sapsEntryNumber', 
            'SAPS-' || TO_CHAR(now(), 'YYYY') || '-' || UPPER(SUBSTRING(v_saps_id::text, 1, 8))
        );

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
            barcode_ref,
            created_at,
            updated_at
        ) VALUES (
            v_saps_id,
            v_effective_shop_id,
            v_saps_entry_no,
            now(),
            v_seller.id::text,
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
            COALESCE(p_officer_name, v_caller_profile.full_name, 'System Operator'),
            COALESCE(p_police_station_ref, (SELECT saps_dealer_license FROM public.shop_profiles WHERE id = v_effective_shop_id)),
            v_compliance_status,
            v_item_sku,
            now(),
            now()
        )
        ON CONFLICT (id) DO NOTHING;

        v_calc_total := v_calc_total + v_amount_paid;
        v_item_count := v_item_count + 1;
    END LOOP;

    -- 8. Insert Parent Seller Transaction
    INSERT INTO public.seller_transactions (
        id,
        shop_id,
        transaction_number,
        seller_id,
        cashier_id,
        total_proposed_payout,
        total_approved_payout,
        amount_paid,
        payment_method,
        payment_status,
        transaction_status,
        compliance_status,
        saps_reference,
        status,
        timestamp,
        metadata,
        created_at,
        updated_at
    ) VALUES (
        p_transaction_id,
        v_effective_shop_id,
        p_transaction_number,
        p_seller_id,
        auth.uid(),
        COALESCE(NULLIF(p_total_amount, 0), v_calc_total),
        COALESCE(NULLIF(p_total_amount, 0), v_calc_total),
        COALESCE(NULLIF(p_total_amount, 0), v_calc_total),
        p_payment_method,
        p_payment_status,
        p_transaction_status,
        v_compliance_status,
        COALESCE(p_saps_ref, p_transaction_number),
        p_transaction_status,
        now(),
        p_metadata || jsonb_build_object('processed_by_rpc', true, 'caller_id', auth.uid()),
        now(),
        now()
    );

    -- 9. Immutable Audit Log
    INSERT INTO public.system_logs (
        shop_id,
        event_type,
        severity,
        actor_id,
        actor_name,
        details
    ) VALUES (
        v_effective_shop_id,
        'BUY_ACQUISITION_COMPLETED',
        'info',
        auth.uid(),
        v_caller_profile.full_name,
        jsonb_build_object(
            'transaction_id', p_transaction_id,
            'transaction_number', p_transaction_number,
            'seller_id', p_seller_id,
            'total_payout', COALESCE(NULLIF(p_total_amount, 0), v_calc_total),
            'item_count', v_item_count
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', p_transaction_id,
        'transaction_number', p_transaction_number,
        'total_amount', COALESCE(NULLIF(p_total_amount, 0), v_calc_total),
        'item_count', v_item_count,
        'compliance_status', v_compliance_status
    );
END;
$$;


-- 2. AUTHORITATIVE ATOMIC PAWN INTAKE RPC
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
    p_expiry_date DATE DEFAULT (CURRENT_DATE + INTERVAL '30 days')::DATE,
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
    v_serial_clean TEXT;
    v_dup_item RECORD;
    v_verification_status TEXT;
    v_saps_id UUID;
    v_saps_entry_no TEXT;
    v_effective_qr TEXT;
    v_loan_history JSONB;
BEGIN
    -- 1. Enforce Authentication
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

    IF v_caller_profile.role != 'admin' AND v_caller_profile.shop_id != v_effective_shop_id THEN
        RAISE EXCEPTION 'Cannot perform pawn intake for a different shop branch.';
    END IF;

    -- 3. Verify Customer belongs to shop context
    SELECT * INTO v_customer 
    FROM public.customers 
    WHERE id = p_customer_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Customer record % not found.', p_customer_id;
    END IF;

    IF v_customer.shop_id IS NOT NULL AND v_caller_profile.role != 'admin' AND v_customer.shop_id != v_effective_shop_id THEN
        RAISE EXCEPTION 'Customer belongs to a different shop.';
    END IF;

    -- 4. Idempotency Check
    SELECT id, ticket_number, principal INTO v_existing_loan
    FROM public.pawn_loans
    WHERE id = p_loan_id OR ticket_number = p_ticket_number
    LIMIT 1;

    IF v_existing_loan.id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', true,
            'loan_id', v_existing_loan.id,
            'ticket_number', v_existing_loan.ticket_number,
            'principal', v_existing_loan.principal,
            'idempotent', true
        );
    END IF;

    -- 5. Duplicate Serial / IMEI Check
    v_serial_clean := TRIM(COALESCE(p_serial_or_imei, 'N/A'));
    IF v_serial_clean IS NOT NULL AND UPPER(v_serial_clean) != 'N/A' AND LENGTH(v_serial_clean) >= 4 THEN
        SELECT id, sku, title, status INTO v_dup_item
        FROM public.shop_items
        WHERE lower(trim(serial_or_imei)) = lower(v_serial_clean)
          AND (shop_id = v_effective_shop_id OR shop_id IS NULL)
          AND status IN ('Retail Floor', 'Vault Hold', 'InStock', 'Reserved', 'Flagged')
          AND id != p_item_id
        LIMIT 1;

        IF v_dup_item.id IS NOT NULL THEN
            RAISE EXCEPTION 'Serial/IMEI "%" already belongs to active inventory item "%" (SKU: %, Status: %).',
                v_serial_clean, v_dup_item.title, v_dup_item.sku, v_dup_item.status;
        END IF;
    END IF;

    -- 6. Derive Statutory Verification Status
    v_verification_status := CASE WHEN v_customer.verified THEN 'VERIFIED' ELSE 'PENDING' END;
    v_effective_qr := COALESCE(p_qr_token, 'TKN-' || UPPER(SUBSTRING(p_loan_id::text, 1, 8)));

    IF p_history IS NOT NULL AND jsonb_array_length(p_history) > 0 THEN
        v_loan_history := p_history;
    ELSE
        v_loan_history := jsonb_build_array(jsonb_build_object(
            'date', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
            'action', 'Created',
            'amount', p_principal,
            'note', 'Pawn loan initiated'
        ));
    END IF;

    -- 7. Insert Item into Inventory (Shop Items)
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
        days_in_vault,
        image_url,
        specs,
        pawn_ticket_id,
        source_type,
        source_status,
        source_note,
        internal_note,
        created_by,
        added_at,
        updated_at
    ) VALUES (
        p_item_id,
        v_effective_shop_id,
        p_item_sku,
        p_item_title,
        p_item_category,
        p_item_brand,
        p_item_model,
        v_serial_clean,
        p_condition::item_condition,
        'Pawn',
        p_principal,
        ROUND(p_principal * 1.85, 2),
        COALESCE(p_vault_shelf, 'Vault A - Shelf 1'),
        COALESCE(p_stock_location, p_vault_shelf, 'Vault A - Shelf 1'),
        'Vault Hold'::item_status,
        0,
        p_item_image_url,
        COALESCE(p_specs, NULLIF(CONCAT_WS(' • ', p_item_brand, p_item_model), '')),
        p_ticket_number,
        'pawn',
        LOWER(v_verification_status),
        'Pawned by ' || v_customer.full_name || ' under Ticket ' || p_ticket_number,
        p_internal_note,
        auth.uid(),
        now(),
        now()
    )
    ON CONFLICT (id) DO UPDATE SET
        pawn_ticket_id = EXCLUDED.pawn_ticket_id,
        status = 'Vault Hold'::item_status,
        cost_basis = EXCLUDED.cost_basis,
        updated_at = now();

    -- 8. Insert Pawn Loan Record
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
        v_serial_clean,
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
        COALESCE(p_vault_shelf, 'Vault A - Shelf 1'),
        'Active'::loan_status,
        v_effective_qr,
        v_loan_history,
        now(),
        now()
    );

    -- 9. Insert Statutory SAPS Form 21 Register Entry
    v_saps_id := COALESCE(p_saps_entry_id, gen_random_uuid());
    v_saps_entry_no := COALESCE(
        p_saps_entry_number, 
        'SAPS-' || TO_CHAR(now(), 'YYYY') || '-' || UPPER(SUBSTRING(v_saps_id::text, 1, 8))
    );

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
        barcode_ref,
        created_at,
        updated_at
    ) VALUES (
        v_saps_id,
        v_effective_shop_id,
        v_saps_entry_no,
        now(),
        v_customer.id::text,
        v_customer.full_name,
        v_customer.id_number,
        v_customer.address,
        v_customer.mobile,
        p_item_title,
        p_item_category,
        v_serial_clean,
        p_condition,
        'Pawn',
        p_principal,
        COALESCE(p_officer_name, v_caller_profile.full_name, 'System Operator'),
        COALESCE(p_police_station_ref, (SELECT saps_dealer_license FROM public.shop_profiles WHERE id = v_effective_shop_id)),
        v_verification_status,
        p_item_sku,
        now(),
        now()
    )
    ON CONFLICT (id) DO NOTHING;

    -- 10. Immutable Audit Log
    INSERT INTO public.system_logs (
        shop_id,
        event_type,
        severity,
        actor_id,
        actor_name,
        details
    ) VALUES (
        v_effective_shop_id,
        'PAWN_INTAKE_COMPLETED',
        'info',
        auth.uid(),
        v_caller_profile.full_name,
        jsonb_build_object(
            'loan_id', p_loan_id,
            'ticket_number', p_ticket_number,
            'customer_id', p_customer_id,
            'item_id', p_item_id,
            'principal', p_principal,
            'vault_shelf', COALESCE(p_vault_shelf, 'Vault A - Shelf 1')
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'loan_id', p_loan_id,
        'ticket_number', p_ticket_number,
        'item_id', p_item_id,
        'principal', p_principal,
        'verification_status', v_verification_status
    );
END;
$$;
