-- Migration: Scope cashier_code per shop and add persistent auto-allocation
-- Name: 20260927000000_scope_cashier_code_per_shop

-- 1. Drop global uniqueness constraint on profiles.cashier_code if present
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_cashier_code_key;

-- 2. Add composite unique constraint (shop_id, cashier_code)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_shop_id_cashier_code_key;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_shop_id_cashier_code_key UNIQUE (shop_id, cashier_code);

-- 3. Convert existing legacy numeric staff codes (e.g. '01' -> 'SOW-CH-01', '02' -> '50A-CH-02')
DO $$
DECLARE
    r RECORD;
    v_prefix TEXT;
    v_clean TEXT;
    v_num_str TEXT;
BEGIN
    FOR r IN 
        SELECT p.id, p.shop_id, p.cashier_code, sp.shop_code, sp.name AS shop_name
        FROM public.profiles p
        JOIN public.shop_profiles sp ON sp.id = p.shop_id
        WHERE p.cashier_code IS NOT NULL AND p.cashier_code ~ '^[0-9]+$'
    LOOP
        v_clean := REGEXP_REPLACE(UPPER(COALESCE(r.shop_code, '')), '^SHOP-?', '');
        v_clean := REGEXP_REPLACE(v_clean, '[^A-Z0-9]', '', 'g');
        IF LENGTH(v_clean) >= 3 THEN
            v_prefix := SUBSTRING(v_clean FROM 1 FOR 3);
        ELSIF LENGTH(v_clean) > 0 THEN
            v_prefix := RPAD(v_clean, 3, 'X');
        ELSE
            v_clean := REGEXP_REPLACE(UPPER(COALESCE(r.shop_name, 'SHP')), '[^A-Z0-9]', '', 'g');
            IF LENGTH(v_clean) >= 3 THEN
                v_prefix := SUBSTRING(v_clean FROM 1 FOR 3);
            ELSE
                v_prefix := RPAD(v_clean, 3, 'X');
            END IF;
        END IF;
        v_num_str := LPAD(r.cashier_code, 2, '0');
        UPDATE public.profiles
        SET cashier_code = v_prefix || '-CH-' || v_num_str
        WHERE id = r.id;
    END LOOP;
END $$;

-- 4. Protected sequence tracking table for shop staff codes
CREATE TABLE IF NOT EXISTS public.shop_staff_code_sequences (
    shop_id UUID PRIMARY KEY REFERENCES public.shop_profiles(id) ON DELETE CASCADE,
    next_number INT NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8 & 9. RLS enabled on sequence table and access revoked for normal client roles
ALTER TABLE public.shop_staff_code_sequences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.shop_staff_code_sequences FROM anon, authenticated;

-- 5, 6, 7 & 10. Atomic persistent staff code generator function for privileged server-side use
CREATE OR REPLACE FUNCTION public.generate_next_cashier_code(p_shop_id UUID)
RETURNS TEXT AS $$
DECLARE
    v_shop_code TEXT;
    v_shop_name TEXT;
    v_prefix TEXT;
    v_clean TEXT;
    v_curr_num INT;
    v_code TEXT;
BEGIN
    -- Retrieve shop profile details
    SELECT shop_code, name INTO v_shop_code, v_shop_name
    FROM public.shop_profiles
    WHERE id = p_shop_id;

    -- Derive 3-letter branch prefix
    v_clean := REGEXP_REPLACE(UPPER(COALESCE(v_shop_code, '')), '^SHOP-?', '');
    v_clean := REGEXP_REPLACE(v_clean, '[^A-Z0-9]', '', 'g');

    IF LENGTH(v_clean) >= 3 THEN
        v_prefix := SUBSTRING(v_clean FROM 1 FOR 3);
    ELSIF LENGTH(v_clean) > 0 THEN
        v_prefix := RPAD(v_clean, 3, 'X');
    ELSE
        v_clean := REGEXP_REPLACE(UPPER(COALESCE(v_shop_name, 'SHP')), '[^A-Z0-9]', '', 'g');
        IF LENGTH(v_clean) >= 3 THEN
            v_prefix := SUBSTRING(v_clean FROM 1 FOR 3);
        ELSE
            v_prefix := RPAD(v_clean, 3, 'X');
        END IF;
    END IF;

    -- Ensure sequence row exists for shop_id
    INSERT INTO public.shop_staff_code_sequences (shop_id, next_number)
    VALUES (
        p_shop_id,
        COALESCE(
            (
                SELECT MAX(
                    CASE 
                        WHEN cashier_code ~ ('^' || v_prefix || '-CH-[0-9]+$') 
                        THEN SUBSTRING(cashier_code FROM ('^' || v_prefix || '-CH-([0-9]+)$'))::INT
                        WHEN cashier_code ~ '-CH-[0-9]+$'
                        THEN SUBSTRING(cashier_code FROM '-CH-([0-9]+)$')::INT
                        WHEN cashier_code ~ '^[0-9]+$'
                        THEN cashier_code::INT
                        ELSE 0
                    END
                ) + 1
                FROM public.profiles
                WHERE shop_id = p_shop_id
            ),
            1
        )
    )
    ON CONFLICT (shop_id) DO NOTHING;

    -- Lock the sequence row atomically for persistent reservation
    SELECT next_number INTO v_curr_num
    FROM public.shop_staff_code_sequences
    WHERE shop_id = p_shop_id
    FOR UPDATE;

    -- Increment persistent sequence number
    UPDATE public.shop_staff_code_sequences
    SET next_number = v_curr_num + 1,
        updated_at = NOW()
    WHERE shop_id = p_shop_id;

    -- Format and return cashier code
    v_code := v_prefix || '-CH-' || LPAD(v_curr_num::TEXT, 2, '0');
    RETURN v_code;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp;

-- Restrict function execution to server-side / admin roles
REVOKE EXECUTE ON FUNCTION public.generate_next_cashier_code(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_next_cashier_code(UUID) TO service_role, postgres;
