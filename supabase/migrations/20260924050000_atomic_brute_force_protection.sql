-- Atomic Brute-Force Protection Migration
-- Implements row-locking atomic functions (check_pin_lockout and record_pin_attempt)
-- to prevent race conditions and concurrent brute-force bypasses.

CREATE OR REPLACE FUNCTION public.check_pin_lockout(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_attempts INT;
    v_last_attempt TIMESTAMPTZ;
    v_now TIMESTAMPTZ := clock_timestamp();
    v_lockout_minutes INT := 15;
    v_remaining INT;
BEGIN
    -- Lock profile row to prevent race conditions during lockout check
    SELECT login_attempts, last_attempt_at INTO v_attempts, v_last_attempt
    FROM public.profiles
    WHERE id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('locked', false);
    END IF;

    v_attempts := COALESCE(v_attempts, 0);

    IF v_attempts >= 5 AND v_last_attempt IS NOT NULL AND (v_now - v_last_attempt) < (v_lockout_minutes * interval '1 minute') THEN
        v_remaining := CEIL(EXTRACT(EPOCH FROM ((v_last_attempt + (v_lockout_minutes * interval '1 minute')) - v_now)) / 60.0);
        RETURN jsonb_build_object('locked', true, 'remaining_minutes', GREATEST(1, v_remaining));
    END IF;

    RETURN jsonb_build_object('locked', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.record_pin_attempt(p_user_id UUID, p_success BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_attempts INT;
    v_last_attempt TIMESTAMPTZ;
    v_now TIMESTAMPTZ := clock_timestamp();
    v_lockout_minutes INT := 15;
BEGIN
    -- Lock profile row to ensure atomic update of failure/success counters
    SELECT login_attempts, last_attempt_at INTO v_attempts, v_last_attempt
    FROM public.profiles
    WHERE id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    v_attempts := COALESCE(v_attempts, 0);

    -- Reset attempts if lockout window expired
    IF v_last_attempt IS NOT NULL AND (v_now - v_last_attempt) >= (v_lockout_minutes * interval '1 minute') THEN
        v_attempts := 0;
    END IF;

    IF p_success THEN
        UPDATE public.profiles
        SET login_attempts = 0,
            last_attempt_at = NULL,
            last_sign_in_at = v_now
        WHERE id = p_user_id;
    ELSE
        v_attempts := v_attempts + 1;
        UPDATE public.profiles
        SET login_attempts = v_attempts,
            last_attempt_at = v_now
        WHERE id = p_user_id;
    END IF;
END;
$$;
