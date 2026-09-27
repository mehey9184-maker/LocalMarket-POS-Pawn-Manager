-- Migration: Scope cashier_code per shop and add auto-allocation RPC
-- Date: 2026-09-27

-- 1. Drop global uniqueness constraint on profiles.cashier_code if present
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_cashier_code_key;

-- 2. Add composite unique constraint (shop_id, cashier_code)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_shop_id_cashier_code_key;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_shop_id_cashier_code_key UNIQUE (shop_id, cashier_code);

-- 3. Atomic staff code sequence allocation function per shop
CREATE OR REPLACE FUNCTION generate_next_cashier_code(p_shop_id UUID)
RETURNS TEXT AS $$
DECLARE
    v_shop_code TEXT;
    v_shop_name TEXT;
    v_prefix TEXT;
    v_max_num INT := 0;
    v_next_num INT := 1;
    v_code TEXT;
    v_clean TEXT;
BEGIN
    -- Lock shop row for atomic sequence generation
    SELECT shop_code, name INTO v_shop_code, v_shop_name
    FROM public.shop_profiles
    WHERE id = p_shop_id
    FOR UPDATE;

    IF v_shop_code IS NULL THEN
        v_shop_code := '';
    END IF;

    -- Extract 3-letter branch prefix (e.g. SHOP-SOW-01 -> SOW, SOW-01 -> SOW)
    v_clean := REGEXP_REPLACE(UPPER(v_shop_code), '^SHOP-?', '');
    v_clean := REGEXP_REPLACE(v_clean, '[^A-Z0-9]', '', 'g');

    IF LENGTH(v_clean) >= 3 THEN
        v_prefix := SUBSTRING(v_clean FROM 1 FOR 3);
    ELSIF LENGTH(v_clean) > 0 THEN
        v_prefix := RPAD(v_clean, 3, 'X');
    ELSE
        -- Fallback to shop name if shop_code is missing
        v_clean := REGEXP_REPLACE(UPPER(COALESCE(v_shop_name, 'SHP')), '[^A-Z0-9]', '', 'g');
        IF LENGTH(v_clean) >= 3 THEN
            v_prefix := SUBSTRING(v_clean FROM 1 FOR 3);
        ELSE
            v_prefix := RPAD(v_clean, 3, 'X');
        END IF;
    END IF;

    -- Find max sequence number for this shop matching PREFIX-CH-NN or -CH-NN
    SELECT COALESCE(MAX(
        CASE 
            WHEN cashier_code ~ ('^' || v_prefix || '-CH-[0-9]+$') 
            THEN SUBSTRING(cashier_code FROM ('^' || v_prefix || '-CH-([0-9]+)$'))::INT
            WHEN cashier_code ~ '-CH-[0-9]+$'
            THEN SUBSTRING(cashier_code FROM '-CH-([0-9]+)$')::INT
            ELSE 0
        END
    ), 0) INTO v_max_num
    FROM public.profiles
    WHERE shop_id = p_shop_id;

    v_next_num := v_max_num + 1;
    v_code := v_prefix || '-CH-' || LPAD(v_next_num::TEXT, 2, '0');

    RETURN v_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
