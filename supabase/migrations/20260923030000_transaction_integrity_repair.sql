-- ==============================================================================
-- TRANSACTION INTEGRITY REPAIR: BATCHES, REVERSALS & TERMINAL SESSIONS
-- ==============================================================================

-- 1. TERMINAL SESSIONS TABLE
CREATE TABLE IF NOT EXISTS public.terminal_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    shop_id UUID NOT NULL REFERENCES public.shop_profiles(id) ON DELETE CASCADE,
    terminal_id TEXT NOT NULL,
    terminal_name TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invalidated', 'expired')),
    activated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    last_heartbeat_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    invalidated_at TIMESTAMPTZ,
    invalidation_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, status) -- Constraint: Only one active session per user
);

-- RLS FOR TERMINAL SESSIONS
ALTER TABLE public.terminal_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own terminal sessions"
ON public.terminal_sessions FOR SELECT
USING (user_id = auth.uid() OR public.is_admin());

-- 2. SELLER TRANSACTION ITEMS TABLE (Relational Child Table)
CREATE TABLE IF NOT EXISTS public.seller_transaction_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    seller_transaction_id UUID NOT NULL REFERENCES public.seller_transactions(id) ON DELETE CASCADE,
    shop_id UUID NOT NULL REFERENCES public.shop_profiles(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES public.shop_items(id) ON DELETE RESTRICT,
    item_sku TEXT NOT NULL,
    item_title TEXT NOT NULL,
    amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0,
    retail_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
    serial_or_imei TEXT,
    condition TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS FOR SELLER TRANSACTION ITEMS
ALTER TABLE public.seller_transaction_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shop users can view seller transaction items in their shop"
ON public.seller_transaction_items FOR SELECT
USING (shop_id = public.get_current_user_shop_id() OR public.is_admin());

-- 3. SELLER REVERSALS TABLE
CREATE TABLE IF NOT EXISTS public.seller_reversals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES public.shop_profiles(id) ON DELETE CASCADE,
    seller_transaction_id UUID NOT NULL REFERENCES public.seller_transactions(id) ON DELETE RESTRICT,
    item_id UUID NOT NULL REFERENCES public.shop_items(id) ON DELETE RESTRICT,
    seller_id UUID NOT NULL REFERENCES public.sellers(id) ON DELETE RESTRICT,
    original_payout NUMERIC(12, 2) NOT NULL DEFAULT 0,
    reversal_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    reason TEXT NOT NULL,
    requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'Reversed' CHECK (status IN ('Under Review', 'Returned', 'Reversed')),
    resulting_inventory_status TEXT,
    resulting_payment_status TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS FOR SELLER REVERSALS
ALTER TABLE public.seller_reversals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shop users can view seller reversals in their shop"
ON public.seller_reversals FOR SELECT
USING (shop_id = public.get_current_user_shop_id() OR public.is_admin());

-- 4. UPDATE SELLER TRANSACTIONS SCHEMA
-- Ensure parent table has the required fields for batch processing
ALTER TABLE public.seller_transactions 
ADD COLUMN IF NOT EXISTS transaction_number TEXT,
ADD COLUMN IF NOT EXISTS total_proposed_payout NUMERIC(12, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_approved_payout NUMERIC(12, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS payment_method TEXT,
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'Pending',
ADD COLUMN IF NOT EXISTS transaction_status TEXT DEFAULT 'Draft',
ADD COLUMN IF NOT EXISTS compliance_status TEXT DEFAULT 'PENDING',
ADD COLUMN IF NOT EXISTS cashier_id UUID REFERENCES auth.users(id);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_seller_transactions_number ON public.seller_transactions(transaction_number);
CREATE INDEX IF NOT EXISTS idx_seller_transaction_items_parent ON public.seller_transaction_items(seller_transaction_id);
CREATE INDEX IF NOT EXISTS idx_seller_reversals_tx ON public.seller_reversals(seller_transaction_id);
CREATE INDEX IF NOT EXISTS idx_terminal_sessions_user_status ON public.terminal_sessions(user_id, status);

-- 5. ATOMIC SELLER TRANSACTION BATCH RPC
CREATE OR REPLACE FUNCTION public.create_seller_transaction_batch(
    p_transaction_id UUID,
    p_transaction_number TEXT,
    p_seller_id UUID,
    p_items JSONB, -- Array of { id, sku, title, amount_paid, retail_price, serial_or_imei, condition }
    p_total_proposed NUMERIC,
    p_total_approved NUMERIC,
    p_payment_method TEXT,
    p_payment_status TEXT,
    p_transaction_status TEXT,
    p_compliance_status TEXT,
    p_saps_ref TEXT DEFAULT NULL,
    p_idempotency_key UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_shop_id UUID;
    v_user_role TEXT;
    v_item JSONB;
    v_item_id UUID;
    v_item_record RECORD;
    v_existing_tx RECORD;
BEGIN
    -- 1. Verify caller authentication
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    -- 2. Verify shop isolation
    SELECT shop_id, role INTO v_user_shop_id, v_user_role
    FROM public.profiles
    WHERE id = auth.uid();

    IF v_user_shop_id IS NULL THEN
        RAISE EXCEPTION 'User is not assigned to an active shop.';
    END IF;

    -- 3. Idempotency Check
    SELECT * INTO v_existing_tx
    FROM public.seller_transactions
    WHERE id = p_transaction_id OR transaction_number = p_transaction_number;

    IF v_existing_tx.id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', true,
            'transaction_id', v_existing_tx.id,
            'transaction_number', v_existing_tx.transaction_number,
            'idempotent_replay', true
        );
    END IF;

    -- 4. Create Parent Seller Transaction
    INSERT INTO public.seller_transactions (
        id,
        shop_id,
        transaction_number,
        seller_id,
        cashier_id,
        total_proposed_payout,
        total_approved_payout,
        payment_method,
        payment_status,
        transaction_status,
        compliance_status,
        saps_reference,
        timestamp,
        created_at,
        updated_at
    ) VALUES (
        p_transaction_id,
        v_user_shop_id,
        p_transaction_number,
        p_seller_id,
        auth.uid(),
        p_total_proposed,
        p_total_approved,
        p_payment_method,
        p_payment_status,
        p_transaction_status,
        p_compliance_status,
        p_saps_ref,
        timezone('utc'::text, now()),
        timezone('utc'::text, now()),
        timezone('utc'::text, now())
    );

    -- 5. Process Child Items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_item_id := (v_item->>'id')::UUID;

        -- Validate item exists and belongs to shop
        SELECT * INTO v_item_record
        FROM public.shop_items
        WHERE id = v_item_id AND shop_id = v_user_shop_id
        FOR UPDATE;

        IF v_item_record.id IS NULL THEN
            RAISE EXCEPTION 'Inventory item % not found.', v_item_id;
        END IF;

        -- Create Child Item Record
        INSERT INTO public.seller_transaction_items (
            seller_transaction_id,
            shop_id,
            item_id,
            item_sku,
            item_title,
            amount_paid,
            retail_price,
            serial_or_imei,
            condition
        ) VALUES (
            p_transaction_id,
            v_user_shop_id,
            v_item_id,
            v_item_record.sku,
            v_item_record.title,
            (v_item->>'amount_paid')::NUMERIC,
            (v_item->>'retail_price')::NUMERIC,
            v_item_record.serial_or_imei,
            v_item_record.condition
        );

        -- Update Inventory Item State if Acquired
        IF p_transaction_status = 'Acquired' THEN
            UPDATE public.shop_items
            SET status = 'Vault Hold', -- Standard intake state
                cost_basis = (v_item->>'amount_paid')::NUMERIC,
                updated_at = timezone('utc'::text, now())
            WHERE id = v_item_id;
        END IF;
    END LOOP;

    -- 6. Audit Log
    INSERT INTO public.system_logs (
        shop_id,
        actor_id,
        event_type,
        details,
        severity
    ) VALUES (
        v_user_shop_id,
        auth.uid(),
        'SELLER_TRANSACTION_CREATED',
        jsonb_build_object(
            'transaction_id', p_transaction_id,
            'transaction_number', p_transaction_number,
            'seller_id', p_seller_id,
            'items_count', jsonb_array_length(p_items)
        ),
        'info'
    );

    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', p_transaction_id,
        'transaction_number', p_transaction_number,
        'idempotent_replay', false
    );
END;
$$;

-- 6. ATOMIC SELLER ACQUISITION REVERSAL RPC
CREATE OR REPLACE FUNCTION public.reverse_seller_acquisition(
    p_reversal_id UUID,
    p_transaction_id UUID,
    p_item_id UUID,
    p_reason TEXT,
    p_approver_id UUID DEFAULT NULL
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
    v_tx RECORD;
    v_item RECORD;
    v_existing_reversal RECORD;
BEGIN
    -- 1. Verify caller authentication
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    -- 2. Verify shop isolation and role (Manager/Owner only)
    SELECT shop_id, role, full_name INTO v_user_shop_id, v_user_role, v_user_name
    FROM public.profiles
    WHERE id = auth.uid();

    IF v_user_role NOT IN ('manager', 'owner', 'admin') THEN
        RAISE EXCEPTION 'Unauthorized: Only Managers and Owners can reverse acquisitions.';
    END IF;

    -- 3. Verify target transaction
    SELECT * INTO v_tx
    FROM public.seller_transactions
    WHERE id = p_transaction_id AND shop_id = v_user_shop_id
    FOR UPDATE;

    IF v_tx.id IS NULL THEN
        RAISE EXCEPTION 'Seller transaction not found.';
    END IF;

    -- 4. Verify target item
    SELECT * INTO v_item
    FROM public.shop_items
    WHERE id = p_item_id AND shop_id = v_user_shop_id
    FOR UPDATE;

    IF v_item.id IS NULL THEN
        RAISE EXCEPTION 'Item not found.';
    END IF;

    -- 5. Prevent duplicate reversal
    SELECT * INTO v_existing_reversal
    FROM public.seller_reversals
    WHERE item_id = p_item_id AND seller_transaction_id = p_transaction_id;

    IF v_existing_reversal.id IS NOT NULL THEN
        RAISE EXCEPTION 'This item has already been reversed.';
    END IF;

    -- 6. Prevent self-approval (if requester is the same as the cashier who did the transaction)
    IF v_tx.cashier_id = auth.uid() AND v_user_role != 'admin' THEN
        RAISE EXCEPTION 'Self-approval forbidden: You cannot reverse a transaction you performed.';
    END IF;

    -- 7. Create Reversal Record
    INSERT INTO public.seller_reversals (
        id,
        shop_id,
        seller_transaction_id,
        item_id,
        seller_id,
        original_payout,
        reversal_amount,
        reason,
        requested_by,
        approved_by,
        status,
        resulting_inventory_status,
        resulting_payment_status
    ) VALUES (
        p_reversal_id,
        v_user_shop_id,
        p_transaction_id,
        p_item_id,
        v_tx.seller_id,
        v_tx.total_approved_payout, -- Or derive from child item if partial reversal is supported
        0, -- Adjust as needed for financial recording
        p_reason,
        auth.uid(),
        p_approver_id,
        'Reversed',
        'Returned',
        'Reversed'
    );

    -- 8. Update Inventory Item Status
    UPDATE public.shop_items
    SET status = 'Returned',
        updated_at = timezone('utc'::text, now())
    WHERE id = p_item_id;

    -- 9. Update Transaction Status if all items reversed (simplified logic here)
    -- For now, just mark the transaction as updated
    UPDATE public.seller_transactions
    SET updated_at = timezone('utc'::text, now())
    WHERE id = p_transaction_id;

    -- 10. Audit Log
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
        'SELLER_ACQUISITION_REVERSED',
        jsonb_build_object(
            'reversal_id', p_reversal_id,
            'transaction_id', p_transaction_id,
            'item_id', p_item_id,
            'reason', p_reason
        ),
        'audit'
    );

    RETURN jsonb_build_object(
        'success', true,
        'reversal_id', p_reversal_id
    );
END;
$$;

-- 7. TERMINAL SESSION MANAGEMENT RPCS

-- A. ACTIVATE TERMINAL SESSION
CREATE OR REPLACE FUNCTION public.activate_terminal_session(
    p_terminal_id TEXT,
    p_terminal_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_shop_id UUID;
    v_session_id UUID;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    SELECT shop_id INTO v_user_shop_id
    FROM public.profiles
    WHERE id = auth.uid();

    IF v_user_shop_id IS NULL THEN
        RAISE EXCEPTION 'User has no assigned shop.';
    END IF;

    -- Invalidate existing active session for this user if any (Atomic Switch)
    UPDATE public.terminal_sessions
    SET status = 'invalidated',
        invalidated_at = timezone('utc'::text, now()),
        invalidation_reason = 'New session activated on another terminal'
    WHERE user_id = auth.uid() AND status = 'active';

    -- Create new session
    v_session_id := uuid_generate_v4();
    INSERT INTO public.terminal_sessions (
        id,
        user_id,
        shop_id,
        terminal_id,
        terminal_name,
        status,
        activated_at,
        last_heartbeat_at
    ) VALUES (
        v_session_id,
        auth.uid(),
        v_user_shop_id,
        p_terminal_id,
        p_terminal_name,
        'active',
        timezone('utc'::text, now()),
        timezone('utc'::text, now())
    );

    -- Audit Log
    INSERT INTO public.system_logs (
        shop_id,
        actor_id,
        event_type,
        details,
        severity
    ) VALUES (
        v_user_shop_id,
        auth.uid(),
        'STAFF_TERMINAL_LOGIN',
        jsonb_build_object(
            'session_id', v_session_id,
            'terminal_id', p_terminal_id
        ),
        'info'
    );

    RETURN jsonb_build_object(
        'success', true,
        'session_id', v_session_id,
        'status', 'active'
    );
END;
$$;

-- B. HEARTBEAT TERMINAL SESSION
CREATE OR REPLACE FUNCTION public.heartbeat_terminal_session(
    p_session_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_session RECORD;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    SELECT * INTO v_session
    FROM public.terminal_sessions
    WHERE id = p_session_id AND user_id = auth.uid();

    IF v_session.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'status', 'not_found');
    END IF;

    IF v_session.status != 'active' THEN
        RETURN jsonb_build_object(
            'success', false, 
            'status', v_session.status,
            'invalidated_at', v_session.invalidated_at,
            'reason', v_session.invalidation_reason
        );
    END IF;

    -- Update last heartbeat
    UPDATE public.terminal_sessions
    SET last_heartbeat_at = timezone('utc'::text, now()),
        updated_at = timezone('utc'::text, now())
    WHERE id = p_session_id;

    RETURN jsonb_build_object('success', true, 'status', 'active');
END;
$$;

-- C. CHECK ACTIVE TERMINAL SESSION (Detect Conflicts)
CREATE OR REPLACE FUNCTION public.check_active_terminal_session()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_active_session RECORD;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    SELECT * INTO v_active_session
    FROM public.terminal_sessions
    WHERE user_id = auth.uid() AND status = 'active'
    ORDER BY activated_at DESC
    LIMIT 1;

    IF v_active_session.id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'has_active_session', true,
            'session_id', v_active_session.id,
            'terminal_id', v_active_session.terminal_id,
            'terminal_name', v_active_session.terminal_name,
            'activated_at', v_active_session.activated_at
        );
    END IF;

    RETURN jsonb_build_object('has_active_session', false);
END;
$$;
