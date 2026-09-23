-- Remove unsafe safe_profiles view migration
-- The frontend now uses explicit column projections (SAFE_PROFILE_COLUMNS),
-- making this view redundant and avoiding potential multi-tenant leakage risks.

DROP VIEW IF EXISTS public.safe_profiles;
