-- STAFF ACCESS AND SCHEDULING REFACTOR
-- 1. Add schedule and permissions to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS schedule JSONB DEFAULT '{
  "workingDays": [1, 2, 3, 4, 5],
  "startTime": "08:00",
  "endTime": "17:00",
  "overnight": false,
  "earlyLoginMinutes": 10
}'::jsonb;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{
  "sales": true,
  "inventory": true,
  "pawn": true,
  "sellerAcquisitions": true,
  "refunds": false,
  "pricing": false,
  "reports": false,
  "staff": false,
  "ownerSettings": false
}'::jsonb;

-- 2. Ensure cashier_code is always present for staff (some owners might not have one)
UPDATE public.profiles SET cashier_code = 'OWNER-' || id WHERE role = 'owner' AND cashier_code IS NULL;

-- 3. Create a function to verify PIN and return user email for login
-- This helps the frontend know which email to use for signInWithPassword if we use a deterministic password
-- OR we can just have the server return a temporary session (token) if we use service role
-- But simpler is to have the server verify the PIN and the client then uses the email + deterministic password.

-- Actually, a better way for "Switch Account" in a POS context without deterministic passwords:
-- Server route /api/auth/login-with-pin
-- 1. Verify PIN
-- 2. Use admin auth to create a session or generate a sign-in link.

-- Let's stick to a clean implementation in server.ts.
