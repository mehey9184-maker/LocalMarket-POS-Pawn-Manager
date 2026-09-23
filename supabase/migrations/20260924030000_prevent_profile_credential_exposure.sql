-- Prevent Profile Credential Exposure Migration
-- Creates a safe_profiles view exposing only non-sensitive profile attributes,
-- ensuring pin_hash, pin_code, login_attempts, and last_attempt_at never leak.

CREATE OR REPLACE VIEW public.safe_profiles AS
SELECT 
    id,
    shop_id,
    email,
    full_name,
    role,
    cashier_code,
    phone,
    avatar_url,
    is_active,
    schedule,
    permissions,
    created_at,
    updated_at
FROM public.profiles;

-- Grant access on safe_profiles view
GRANT SELECT ON public.safe_profiles TO authenticated, anon;
