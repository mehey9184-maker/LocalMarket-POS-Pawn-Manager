-- ============================================================================
-- AUTHORITATIVE RETAIL CHECKOUT RPC (20260924080000)
-- Atomically processes point-of-sale retail sales in LocalMarket.
-- Validates shop isolation, locks inventory rows with FOR UPDATE, enforces
-- item availability, updates item statuses to 'Sold', and inserts sales records.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.complete_retail_sale(
    p_sale_id UUID DEFAULT NULL,
    p_receipt_number TEXT DEFAULT NULL,
    p_shop_id UUID DEFAULT NULL,
    p_items JSONB DEFAULT '[]'::jsonb,
    p_subtotal NUMERIC DEFAULT 0.00,
    p_vat_amount NUMERIC DEFAULT 0.00,
    p_total NUMERIC DEFAULT 0.00,
    p_tender_method TEXT DEFAULT 'cash',
    p_amount_tendered NUMERIC DEFAULT 0.00,
    p_change NUMERIC DEFAULT 0.00,
    p_receipt_type TEXT DEFAULT 'thermal',
    p_customer_mobile TEXT DEFAULT NULL,
    p_cashier TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_profile RECORD;
    v_effective_sale_id UUID;
    v_effective_receipt TEXT;
    v_item_elem JSONB;
    v_item_id UUID;
    v_db_item RECORD;
    v_seen_item_ids UUID[] := '{}';
    v_calculated_subtotal NUMERIC(12,2) := 0.00;
    v_item_qty INT;
    v_item_price NUMERIC(12,2);
    v_existing_sale RECORD;
BEGIN
    -- 1. Enforce Authentication
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required for retail checkout.';
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
    IF p_shop_id IS NULL THEN
        p_shop_id := v_caller_profile.shop_id;
    END IF;

    IF p_shop_id IS NULL THEN
        RAISE EXCEPTION 'Valid shop branch context is required.';
    END IF;

    IF v_caller_profile.role != 'admin' AND v_caller_profile.shop_id != p_shop_id THEN
        RAISE EXCEPTION 'Cannot perform retail checkout for a different shop branch.';
    END IF;

    -- 3. Idempotency Check
    v_effective_sale_id := COALESCE(p_sale_id, gen_random_uuid());
    
    IF p_receipt_number IS NOT NULL THEN
        v_effective_receipt := p_receipt_number;
    ELSE
        v_effective_receipt := 'REC-' || TO_CHAR(now(), 'YYYYMMDD') || '-' || SUBSTRING(v_effective_sale_id::text, 1, 6);
    END IF;

    SELECT id, receipt_number, total INTO v_existing_sale
    FROM public.sales
    WHERE id = v_effective_sale_id OR receipt_number = v_effective_receipt
    LIMIT 1;

    IF v_existing_sale.id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', true,
            'sale_id', v_existing_sale.id,
            'receipt_number', v_existing_sale.receipt_number,
            'total', v_existing_sale.total,
            'idempotent', true
        );
    END IF;

    -- 4. Validate Items Payload
    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Retail checkout requires at least one sale item.';
    END IF;

    -- 5. Lock Inventory Rows & Validate Item Availability
    FOR v_item_elem IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        -- Support both item object wrapper {item: {id: ...}} and direct item object {id: ...}
        IF v_item_elem ? 'item' AND (v_item_elem->'item') ? 'id' THEN
            v_item_id := (v_item_elem->'item'->>'id')::UUID;
            v_item_price := COALESCE((v_item_elem->>'overridePrice')::NUMERIC, (v_item_elem->'item'->>'retailPrice')::NUMERIC, 0.00);
            v_item_qty := COALESCE((v_item_elem->>'quantity')::INT, 1);
        ELSIF v_item_elem ? 'id' THEN
            v_item_id := (v_item_elem->>'id')::UUID;
            v_item_price := COALESCE((v_item_elem->>'overridePrice')::NUMERIC, (v_item_elem->>'retailPrice')::NUMERIC, 0.00);
            v_item_qty := COALESCE((v_item_elem->>'quantity')::INT, 1);
        ELSE
            RAISE EXCEPTION 'Invalid item structure in checkout payload.';
        END IF;

        -- Prevent duplicate item IDs in single sale transaction (for unique inventory items)
        IF v_item_id = ANY(v_seen_item_ids) THEN
            RAISE EXCEPTION 'Item % appears multiple times in sale payload.', v_item_id;
        END IF;
        v_seen_item_ids := array_append(v_seen_item_ids, v_item_id);

        -- Lock item with FOR UPDATE
        SELECT * INTO v_db_item
        FROM public.shop_items
        WHERE id = v_item_id AND (shop_id = p_shop_id OR shop_id IS NULL)
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Item ID % not found in shop inventory.', v_item_id;
        END IF;

        -- Enforce status restriction: must be 'Retail Floor' or 'Reserved'
        IF v_db_item.status NOT IN ('Retail Floor', 'Reserved') THEN
            RAISE EXCEPTION 'Item "%" (SKU: %) is not available for sale (current status: %).', 
                v_db_item.title, v_db_item.sku, v_db_item.status;
        END IF;

        -- Mark item as Sold in database
        UPDATE public.shop_items
        SET status = 'Sold'::item_status,
            updated_at = now()
        WHERE id = v_item_id;

        v_calculated_subtotal := v_calculated_subtotal + (v_item_price * v_item_qty);
    END LOOP;

    -- 6. Insert Sale Record
    INSERT INTO public.sales (
        id,
        shop_id,
        receipt_number,
        timestamp,
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
        status,
        metadata
    ) VALUES (
        v_effective_sale_id,
        p_shop_id,
        v_effective_receipt,
        now(),
        p_items,
        p_subtotal,
        p_vat_amount,
        p_total,
        p_tender_method,
        p_amount_tendered,
        p_change,
        p_receipt_type,
        p_customer_mobile,
        COALESCE(p_cashier, v_caller_profile.full_name),
        'Completed',
        jsonb_build_object('processed_by_rpc', true, 'caller_id', auth.uid())
    );

    -- 7. Audit Log
    INSERT INTO public.system_logs (
        shop_id,
        event_type,
        severity,
        actor_id,
        actor_name,
        details
    ) VALUES (
        p_shop_id,
        'RETAIL_SALE_COMPLETED',
        'info',
        auth.uid(),
        v_caller_profile.full_name,
        jsonb_build_object(
            'sale_id', v_effective_sale_id,
            'receipt_number', v_effective_receipt,
            'total', p_total,
            'item_count', array_length(v_seen_item_ids, 1)
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'sale_id', v_effective_sale_id,
        'receipt_number', v_effective_receipt,
        'total', p_total
    );
END;
$$;
