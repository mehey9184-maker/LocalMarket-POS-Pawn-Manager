-- ==============================================================================
-- PRODUCTION HARDENING MIGRATION: ATOMIC OPERATIONS, REFUNDS, PRICING & PROVISIONING
-- ==============================================================================

-- 1. REFUND REQUESTS TABLE
CREATE TABLE IF NOT EXISTS public.refund_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES public.shop_profiles(id) ON DELETE CASCADE,
    sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
    receipt_number TEXT NOT NULL,
    item_id UUID NOT NULL REFERENCES public.shop_items(id) ON DELETE RESTRICT,
    item_sku TEXT NOT NULL,
    item_title TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    refund_amount NUMERIC(12, 2) NOT NULL CHECK (refund_amount >= 0),
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending Approval' CHECK (status IN ('Pending Approval', 'Approved', 'Rejected')),
    requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    requested_by_name TEXT NOT NULL,
    approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    approved_by_name TEXT,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS FOR REFUND REQUESTS
ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shop users can view refund requests in their shop"
ON public.refund_requests FOR SELECT
USING (shop_id = public.get_current_user_shop_id() OR public.is_admin());

CREATE POLICY "Shop cashiers and managers can request refunds"
ON public.refund_requests FOR INSERT
WITH CHECK (shop_id = public.get_current_user_shop_id() OR public.is_admin());

CREATE POLICY "Only managers and owners can update/approve refund requests"
ON public.refund_requests FOR UPDATE
USING (
    (shop_id = public.get_current_user_shop_id() AND EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('manager', 'owner', 'admin')
    )) OR public.is_admin()
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_refund_requests_shop ON public.refund_requests(shop_id);
CREATE INDEX IF NOT EXISTS idx_refund_requests_receipt ON public.refund_requests(receipt_number);
CREATE INDEX IF NOT EXISTS idx_refund_requests_status ON public.refund_requests(status);


-- 2. ATOMIC RETAIL SALE RPC
CREATE OR REPLACE FUNCTION public.complete_retail_sale(
    p_sale_id UUID,
    p_receipt_number TEXT,
    p_shop_id UUID,
    p_items JSONB,
    p_subtotal NUMERIC,
    p_vat_amount NUMERIC,
    p_total NUMERIC,
    p_tender_method TEXT,
    p_amount_tendered NUMERIC,
    p_change NUMERIC,
    p_receipt_type TEXT,
    p_customer_mobile TEXT DEFAULT NULL,
    p_cashier TEXT DEFAULT NULL
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
    v_existing_sale RECORD;
BEGIN
    -- 1. Verify caller authentication
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required to complete retail sale.';
    END IF;

    -- 2. Verify shop isolation
    SELECT shop_id, role INTO v_user_shop_id, v_user_role
    FROM public.profiles
    WHERE id = auth.uid();

    IF v_user_shop_id IS NULL THEN
        RAISE EXCEPTION 'User is not assigned to an active shop.';
    END IF;

    IF p_shop_id IS NOT NULL AND p_shop_id != v_user_shop_id AND v_user_role NOT IN ('admin') THEN
        RAISE EXCEPTION 'Unauthorized: Shop ID mismatch.';
    END IF;

    -- 3. Check for idempotent retry (if sale already exists with this ID or receipt)
    SELECT * INTO v_existing_sale
    FROM public.sales
    WHERE id = p_sale_id OR receipt_number = p_receipt_number;

    IF v_existing_sale.id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', true,
            'sale_id', v_existing_sale.id,
            'receipt_number', v_existing_sale.receipt_number,
            'idempotent_replay', true
        );
    END IF;

    -- 4. Validate items & update inventory state atomically
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_item_id := (v_item->>'id')::UUID;

        SELECT * INTO v_item_record
        FROM public.shop_items
        WHERE id = v_item_id AND shop_id = v_user_shop_id
        FOR UPDATE;

        IF v_item_record.id IS NULL THEN
            RAISE EXCEPTION 'Inventory item % not found in current shop.', v_item_id;
        END IF;

        IF v_item_record.status NOT IN ('Retail Floor', 'Reserved') THEN
            RAISE EXCEPTION 'Item "%" is not available for sale (Current status: %).', v_item_record.title, v_item_record.status;
        END IF;

        -- Mark item as Sold
        UPDATE public.shop_items
        SET status = 'Sold',
            updated_at = timezone('utc'::text, now())
        WHERE id = v_item_id;
    END LOOP;

    -- 5. Insert Sale Record
    INSERT INTO public.sales (
        id,
        shop_id,
        receipt_number,
        items,
        subtotal,
        vat_amount,
        total,
        tender_method,
        amount_tendered,
        change,
        receipt_type,
        customer_mobile,
        cashier,
        created_at
    ) VALUES (
        p_sale_id,
        v_user_shop_id,
        p_receipt_number,
        p_items,
        p_subtotal,
        p_vat_amount,
        p_total,
        p_tender_method,
        p_amount_tendered,
        p_change,
        p_receipt_type,
        p_customer_mobile,
        COALESCE(p_cashier, 'Cashier'),
        timezone('utc'::text, now())
    );

    -- 6. Insert Audit Log
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
        COALESCE(p_cashier, 'Cashier'),
        'RETAIL_SALE_COMPLETED',
        jsonb_build_object(
            'sale_id', p_sale_id,
            'receipt_number', p_receipt_number,
            'total', p_total,
            'tender_method', p_tender_method,
            'items_count', jsonb_array_length(p_items)
        ),
        'info'
    );

    RETURN jsonb_build_object(
        'success', true,
        'sale_id', p_sale_id,
        'receipt_number', p_receipt_number,
        'idempotent_replay', false
    );
END;
$$;


-- 3. REQUEST REFUND RPC
CREATE OR REPLACE FUNCTION public.request_refund(
    p_receipt_number TEXT,
    p_item_id UUID,
    p_quantity INTEGER,
    p_refund_amount NUMERIC,
    p_reason TEXT
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

    -- 1. Verify receipt exists
    SELECT * INTO v_sale
    FROM public.sales
    WHERE receipt_number = p_receipt_number AND shop_id = v_user_shop_id;

    IF v_sale.id IS NULL THEN
        RAISE EXCEPTION 'Receipt % not found in current branch.', p_receipt_number;
    END IF;

    -- 2. Verify item
    SELECT * INTO v_item
    FROM public.shop_items
    WHERE id = p_item_id AND shop_id = v_user_shop_id;

    IF v_item.id IS NULL THEN
        RAISE EXCEPTION 'Item not found in current branch.';
    END IF;

    IF v_item.status != 'Sold' THEN
        RAISE EXCEPTION 'Item "%" is not currently recorded as Sold.', v_item.title;
    END IF;

    -- 3. Check for existing active/pending refund
    SELECT * INTO v_existing_pending
    FROM public.refund_requests
    WHERE receipt_number = p_receipt_number AND item_id = p_item_id AND status = 'Pending Approval';

    IF v_existing_pending.id IS NOT NULL THEN
        RAISE EXCEPTION 'A pending refund request already exists for this receipt and item.';
    END IF;

    -- 4. Create refund request
    v_refund_id := uuid_generate_v4();

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
        requested_by_name
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
        COALESCE(v_user_name, 'Cashier')
    );

    -- 5. Audit Log
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


-- 4. APPROVE OR REJECT REFUND RPC
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
        RAISE EXCEPTION 'Unauthorized: Only Managers and Owners can approve refunds.';
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

    IF p_approved THEN
        -- 1. Restore item to Retail Floor
        SELECT * INTO v_item
        FROM public.shop_items
        WHERE id = v_req.item_id AND shop_id = v_user_shop_id
        FOR UPDATE;

        IF v_item.id IS NOT NULL THEN
            UPDATE public.shop_items
            SET status = 'Retail Floor',
                updated_at = timezone('utc'::text, now())
            WHERE id = v_req.item_id;
        END IF;

        -- 2. Update refund request status
        UPDATE public.refund_requests
        SET status = 'Approved',
            approved_by = auth.uid(),
            approved_by_name = COALESCE(v_user_name, 'Manager'),
            updated_at = timezone('utc'::text, now())
        WHERE id = p_refund_id;

        -- 3. Audit log (Never delete original sale)
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
        -- Rejected
        UPDATE public.refund_requests
        SET status = 'Rejected',
            approved_by = auth.uid(),
            approved_by_name = COALESCE(v_user_name, 'Manager'),
            rejection_reason = p_note,
            updated_at = timezone('utc'::text, now())
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


-- 5. PERMANENT RETAIL PRICE CHANGE RPC
CREATE OR REPLACE FUNCTION public.change_retail_price(
    p_item_id UUID,
    p_new_price NUMERIC,
    p_reason TEXT DEFAULT NULL
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
    v_item RECORD;
    v_old_price NUMERIC;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    SELECT shop_id, role, full_name INTO v_user_shop_id, v_user_role, v_user_name
    FROM public.profiles
    WHERE id = auth.uid();

    IF v_user_role NOT IN ('manager', 'owner', 'admin') THEN
        RAISE EXCEPTION 'Unauthorized: Only Managers and Owners can permanently change retail prices.';
    END IF;

    IF p_new_price < 0 THEN
        RAISE EXCEPTION 'Price cannot be negative.';
    END IF;

    SELECT * INTO v_item
    FROM public.shop_items
    WHERE id = p_item_id AND shop_id = v_user_shop_id
    FOR UPDATE;

    IF v_item.id IS NULL THEN
        RAISE EXCEPTION 'Item not found in current shop.';
    END IF;

    v_old_price := v_item.retail_price;

    UPDATE public.shop_items
    SET retail_price = p_new_price,
        updated_at = timezone('utc'::text, now())
    WHERE id = p_item_id;

    -- Audit Log
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
        'RETAIL_PRICE_CHANGED',
        jsonb_build_object(
            'item_id', p_item_id,
            'sku', v_item.sku,
            'title', v_item.title,
            'old_price', v_old_price,
            'new_price', p_new_price,
            'reason', p_reason
        ),
        'audit'
    );

    RETURN jsonb_build_object(
        'success', true,
        'item_id', p_item_id,
        'old_price', v_old_price,
        'new_price', p_new_price
    );
END;
$$;
