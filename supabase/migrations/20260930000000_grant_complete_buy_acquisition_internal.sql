-- ============================================================================
-- MIGRATION: Grant EXECUTE on complete_buy_acquisition_internal
-- Timestamp: 20260930000000
-- Name: 20260930000000_grant_complete_buy_acquisition_internal
--
-- Problem:
--   Live Supabase environment reported:
--   "permission denied for function complete_buy_acquisition_internal"
--   when authenticated staff (e.g. owner/senior_cashier) complete Buy From Person.
--
-- Cause:
--   complete_buy_acquisition is executable by authenticated and performs the
--   authoritative role and permission check. It delegates execution to
--   complete_buy_acquisition_internal, but complete_buy_acquisition_internal
--   had EXECUTE granted only to postgres and service_role.
--
-- Solution:
--   1. Revoke ALL on complete_buy_acquisition_internal from PUBLIC and anon.
--   2. Grant EXECUTE on complete_buy_acquisition_internal to authenticated and service_role.
--   3. Authoritative role verification remains unchanged in complete_buy_acquisition.
-- ============================================================================

-- 1. Ensure PUBLIC and anon roles have NO execution privileges
REVOKE ALL ON FUNCTION public.complete_buy_acquisition_internal(
    uuid, text, uuid, jsonb, numeric, text, text, text, text, text, text, text, uuid, jsonb
) FROM PUBLIC, anon;

-- 2. Grant EXECUTE to authenticated staff and service_role
GRANT EXECUTE ON FUNCTION public.complete_buy_acquisition_internal(
    uuid, text, uuid, jsonb, numeric, text, text, text, text, text, text, text, uuid, jsonb
) TO authenticated, service_role;
