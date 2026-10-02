-- ============================================================================
-- MIGRATION: Owner-Configurable Pawn Lending Limit & Server Enforcement
-- Timestamp: 20261002000000
-- Name: 20261002000000_owner_configurable_pawn_lending_limit
--
-- Architecture:
--   public.complete_pawn_intake (SECURITY INVOKER)
--     -> authoritative authentication & active-profile checks
--     -> authoritative role checks (senior_cashier, manager, owner, admin)
--     -> authoritative shop-assignment checks
--     -> authoritative shop policy lending limits (minLoanPrincipal & maxLoanPrincipal)
--     -> authoritative financial terms calculation (ncr rate, monthly interest,
--        storage/admin fee, total redemption, loan term, expiry date, days remaining)
--     -> public.complete_pawn_intake_internal (SECURITY DEFINER)
--        for atomic write boundary and system_logs insert with NOT NULL actor_name.
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
SECURITY INVOKER
SET search_path = public, auth
AS $$
DECLARE
    v_caller_profile RECORD;
    v_effective_shop_id UUID;
    v_shop_rules JSONB;
    v_min_principal NUMERIC := 100.00;
    v_max_principal NUMERIC := NULL;
    v_calc_interest_rate NUMERIC;
    v_calc_storage_rate NUMERIC;
    v_calc_monthly_interest NUMERIC;
    v_calc_monthly_storage NUMERIC;
    v_calc_total_redemption NUMERIC;
    v_calc_extension_fee NUMERIC;
    v_calc_term_days INT := 30;
    v_calc_start_date DATE;
    v_calc_expiry_date DATE;
    v_calc_days_remaining INT;
    v_internal_result JSONB;
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

    -- 2. Active Staff Profile Check
    IF NOT COALESCE(v_caller_profile.is_active, true) THEN
        RAISE EXCEPTION 'Caller account is deactivated.';
    END IF;

    -- 3. Strict Role Authorization Check
    IF v_caller_profile.role NOT IN ('senior_cashier'::public.user_role, 'manager'::public.user_role, 'owner'::public.user_role, 'admin'::public.user_role) THEN
        RAISE EXCEPTION 'Pawn intake requires Senior Cashier, Manager, or Owner access';
    END IF;

    -- 4. Shop Assignment & Isolation Check
    v_effective_shop_id := COALESCE(p_shop_id, v_caller_profile.shop_id);
    IF v_effective_shop_id IS NULL THEN
        RAISE EXCEPTION 'Valid shop branch context is required.';
    END IF;

    IF v_caller_profile.role IS DISTINCT FROM 'admin'::public.user_role AND v_caller_profile.shop_id IS DISTINCT FROM v_effective_shop_id THEN
        RAISE EXCEPTION 'Shop assignment mismatch';
    END IF;

    -- 5. Read Authoritative Shop Business Rules
    SELECT business_rules INTO v_shop_rules
    FROM public.shop_profiles
    WHERE id = v_effective_shop_id;

    IF v_shop_rules IS NOT NULL THEN
        IF (v_shop_rules->>'minLoanPrincipal') IS NOT NULL AND (v_shop_rules->>'minLoanPrincipal')::numeric > 0 THEN
            v_min_principal := (v_shop_rules->>'minLoanPrincipal')::numeric;
        END IF;

        IF (v_shop_rules->>'maxLoanPrincipal') IS NOT NULL AND (v_shop_rules->>'maxLoanPrincipal')::numeric > 0 THEN
            v_max_principal := (v_shop_rules->>'maxLoanPrincipal')::numeric;
        END IF;
    END IF;

    -- 6. Enforce Minimum Loan Principal
    IF p_principal < v_min_principal THEN
        RAISE EXCEPTION 'Pawn principal must be at least the configured minimum of %', v_min_principal;
    END IF;

    -- 7. Enforce Maximum Loan Principal (Shop Policy Setting)
    -- null / missing / empty / 0 = no maximum; principal <= maximum = allowed; principal > maximum = reject
    IF v_max_principal IS NOT NULL AND v_max_principal > 0 THEN
        IF p_principal > v_max_principal THEN
            RAISE EXCEPTION 'Above this shop’s pawn limit: Maximum pawn amount: R %', v_max_principal;
        END IF;
    END IF;

    -- 8. Authoritative Server-Side Calculation of Financial Terms
    v_calc_interest_rate := COALESCE((v_shop_rules->>'pawnMonthlyInterestRate')::numeric, 0.05);
    v_calc_storage_rate  := COALESCE((v_shop_rules->>'pawnStorageAdminFeeRate')::numeric, 0.08);
    v_calc_term_days     := COALESCE((v_shop_rules->>'defaultLoanTermDays')::int, 30);

    v_calc_monthly_interest := ROUND(p_principal * v_calc_interest_rate, 2);
    v_calc_monthly_storage  := ROUND(p_principal * v_calc_storage_rate, 2);
    v_calc_total_redemption := ROUND(p_principal + v_calc_monthly_interest + v_calc_monthly_storage, 2);
    v_calc_extension_fee    := ROUND(v_calc_monthly_interest + v_calc_monthly_storage, 2);

    v_calc_start_date       := COALESCE(p_start_date, CURRENT_DATE);
    v_calc_expiry_date      := v_calc_start_date + (v_calc_term_days || ' days')::interval;
    v_calc_days_remaining   := GREATEST(0, (v_calc_expiry_date - CURRENT_DATE));

    -- 9. Delegate to complete_pawn_intake_internal for Atomic SECURITY DEFINER Write
    v_internal_result := public.complete_pawn_intake_internal(
        p_loan_id                   => p_loan_id,
        p_ticket_number             => p_ticket_number,
        p_customer_id               => p_customer_id,
        p_item_id                   => p_item_id,
        p_item_sku                  => p_item_sku,
        p_item_title                => p_item_title,
        p_item_category             => p_item_category,
        p_item_brand                => p_item_brand,
        p_item_model                => p_item_model,
        p_serial_or_imei            => p_serial_or_imei,
        p_condition                 => p_condition,
        p_item_image_url            => p_item_image_url,
        p_specs                     => p_specs,
        p_stock_location            => p_stock_location,
        p_internal_note             => p_internal_note,
        p_principal                 => p_principal,
        p_ncr_monthly_rate          => v_calc_interest_rate,
        p_monthly_interest          => v_calc_monthly_interest,
        p_monthly_storage_admin_fee => v_calc_monthly_storage,
        p_total_redemption_amount   => v_calc_total_redemption,
        p_extension_fee             => v_calc_extension_fee,
        p_start_date                => v_calc_start_date,
        p_expiry_date               => v_calc_expiry_date,
        p_days_remaining            => v_calc_days_remaining,
        p_vault_shelf               => p_vault_shelf,
        p_qr_token                  => p_qr_token,
        p_officer_name              => COALESCE(p_officer_name, v_caller_profile.full_name, 'System Operator'),
        p_police_station_ref        => p_police_station_ref,
        p_saps_entry_id             => p_saps_entry_id,
        p_saps_entry_number         => p_saps_entry_number,
        p_history                   => p_history,
        p_shop_id                   => v_effective_shop_id
    );

    RETURN v_internal_result;
END;
$$;

-- Routine privileges on public wrapper
REVOKE ALL ON FUNCTION public.complete_pawn_intake(uuid, text, uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, numeric, numeric, numeric, numeric, numeric, numeric, date, date, integer, text, text, text, text, uuid, text, jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_pawn_intake(uuid, text, uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, numeric, numeric, numeric, numeric, numeric, numeric, date, date, integer, text, text, text, text, uuid, text, jsonb, uuid) TO authenticated, service_role;
