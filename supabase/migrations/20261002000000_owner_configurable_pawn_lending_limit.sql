-- ============================================================================
-- MIGRATION: Owner-Configurable Pawn Lending Limit & Server Enforcement
-- Timestamp: 20261002000000
-- Name: 20261002000000_owner_configurable_pawn_lending_limit
--
-- Features:
--   1. Adds support for shop policy maximum pawn lending limit: maxLoanPrincipal.
--   2. Updates complete_pawn_intake RPC to enforce both minLoanPrincipal and
--      maxLoanPrincipal from authoritative shop_profiles.business_rules.
--   3. Rejects intakes exceeding the shop policy maximum with clear plain language:
--      "Above this shop’s pawn limit: Maximum pawn amount: R X".
--   4. Preserves existing minimum validation and authorized role checks.
--   5. Uses enum-safe comparison for user_role to prevent runtime cast errors.
--   6. Grants EXECUTE to authenticated and service_role while denying anon and PUBLIC.
-- ============================================================================

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
    v_shop_rules JSONB;
    v_min_principal NUMERIC;
    v_max_principal NUMERIC;
    v_customer RECORD;
    v_existing_loan RECORD;
    v_saps_id UUID;
    v_saps_entry_no TEXT;
    v_dup_item RECORD;
    v_item_serial TEXT;
    v_saps_verification_status TEXT;
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

    -- 2. Verify Shop Isolation (Enum-safe role check)
    v_effective_shop_id := COALESCE(p_shop_id, v_caller_profile.shop_id);
    IF v_effective_shop_id IS NULL THEN
        RAISE EXCEPTION 'Valid shop branch context is required.';
    END IF;

    IF v_caller_profile.role IS DISTINCT FROM 'admin'::public.user_role AND v_caller_profile.shop_id IS DISTINCT FROM v_effective_shop_id THEN
        RAISE EXCEPTION 'Cannot perform pawn intake for a different shop branch.';
    END IF;

    -- 3. Enforce Shop Business Rules Lending Limits (minLoanPrincipal & maxLoanPrincipal)
    SELECT business_rules INTO v_shop_rules
    FROM public.shop_profiles
    WHERE id = v_effective_shop_id;

    IF v_shop_rules IS NOT NULL THEN
        -- Minimum loan principal validation
        IF (v_shop_rules->>'minLoanPrincipal') IS NOT NULL AND (v_shop_rules->>'minLoanPrincipal')::numeric > 0 THEN
            v_min_principal := (v_shop_rules->>'minLoanPrincipal')::numeric;
            IF p_principal < v_min_principal THEN
                RAISE EXCEPTION 'Principal R % is below shop minimum R %', p_principal, v_min_principal;
            END IF;
        ELSE
            IF p_principal < 100 THEN
                RAISE EXCEPTION 'Pawn principal must be at least the configured minimum of 100';
            END IF;
        END IF;

        -- Maximum loan principal validation (Shop policy setting)
        IF (v_shop_rules->>'maxLoanPrincipal') IS NOT NULL AND (v_shop_rules->>'maxLoanPrincipal')::numeric > 0 THEN
            v_max_principal := (v_shop_rules->>'maxLoanPrincipal')::numeric;
            IF p_principal > v_max_principal THEN
                RAISE EXCEPTION 'Above this shop’s pawn limit: Maximum pawn amount: R %', v_max_principal;
            END IF;
        END IF;
    ELSE
        IF p_principal < 100 THEN
            RAISE EXCEPTION 'Pawn principal must be at least the configured minimum of 100';
        END IF;
    END IF;

    -- 4. Verify Customer
    SELECT * INTO v_customer 
    FROM public.customers 
    WHERE id = p_customer_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Customer record % not found.', p_customer_id;
    END IF;

    IF v_customer.shop_id IS NOT NULL AND v_caller_profile.role IS DISTINCT FROM 'admin'::public.user_role AND v_customer.shop_id IS DISTINCT FROM v_effective_shop_id THEN
        RAISE EXCEPTION 'Customer belongs to a different shop.';
    END IF;

    -- Conditional SAPS verification status based on customer verified state
    v_saps_verification_status := CASE WHEN COALESCE(v_customer.verified, false) THEN 'VERIFIED' ELSE 'PENDING' END;

    -- 5. Idempotency Check
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

    -- 6. Serial / IMEI duplicate protection
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

    -- 7. Insert / Update shop_items (NO created_at column)
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
        now()
    )
    ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        updated_at = now();

    -- 8. Insert pawn_loans (status is TEXT 'Active')
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

    -- 9. Insert saps_entries
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
        v_saps_verification_status,
        now(),
        now()
    )
    ON CONFLICT (entry_number) DO NOTHING;

    -- 10. Audit Log
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
            'principal', p_principal,
            'verification_status', v_saps_verification_status
        ),
        'info'
    );

    RETURN jsonb_build_object(
        'success', true,
        'loan_id', p_loan_id
    );
END;
$$;

-- Privileges: Deny to anon & PUBLIC, grant to authenticated and service_role
REVOKE ALL ON FUNCTION public.complete_pawn_intake(uuid, text, uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, numeric, numeric, numeric, numeric, numeric, numeric, date, date, integer, text, text, text, text, uuid, text, jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_pawn_intake(uuid, text, uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, numeric, numeric, numeric, numeric, numeric, numeric, date, date, integer, text, text, text, text, uuid, text, jsonb, uuid) TO authenticated, service_role;
