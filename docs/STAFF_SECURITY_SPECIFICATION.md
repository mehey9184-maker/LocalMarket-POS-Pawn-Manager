# LocalMarket POS & Pawn Manager - Staff Security & Role Specification

**Status:** Code Complete & Verified (Repository Implementation Finalized)  
**Target Architecture:** Supabase Postgres + Express Session Proxy + React Client  
**Version:** 1.1.0  

---

## 1. Role Hierarchy & Access Matrix

LocalMarket implements a strict, hierarchical four-tier operational role system. The technical `admin` role is reserved exclusively for infrastructure maintenance and is strictly hidden from standard business interfaces.

| Role | Hierarchy Level | Can Manage | Operational Counter Permissions | Management & Admin Access |
|---|---|---|---|---|
| **Owner** | Tier 1 (Apex) | Managers, Senior Cashiers, Cashiers | Full Access (Sales, Inventory, Pawn, Seller Intake, SAPS, Customers) | Full Access (Staff Management, Financial Settings, Vault Rules, Deletions) |
| **Manager** | Tier 2 | Senior Cashiers, Cashiers | Full Access (Sales, Inventory, Pawn, Seller Intake, SAPS, Customers) | Staff Operations for Cashiers & Senior Cashiers only. Cannot manage or promote to Manager/Owner/Admin. |
| **Senior Cashier** | Tier 3 | None | Counter Operations (Sales, Inventory Stockroom, Pawn Loans, Second-Hand Intake, SAPS Register, Customers) | No Staff Management, No System Financial Setting Edits, No Permanent Price Overrides without elevation. |
| **Cashier** | Tier 4 (Base) | None | Sales & Register, Receipt Printing | Base retail operations only. |
| *Admin (Technical)* | Hidden Infrastructure | System / DB | Hidden from UI | Reserved for DB migrations and background workers. |

---

## 2. Authoritative Credential Architecture (PBKDF2-SHA512)

### 2.1 Storage & Hashing Standard
- **Field:** `public.profiles.pin_hash` (Authoritative).
- **Format:** `<salt_hex_16_bytes>:<pbkdf2_sha512_digest_hex_64_bytes>`.
- **Iteration Count:** 10,000 rounds.
- **Legacy Compatibility:** Plaintext `pin_code` column is strictly marked legacy and set to `NULL` for all active operational credentials.
- **Auto-Migration on Login:** Any existing profile with legacy `pin_code` is seamlessly converted to `pin_hash` upon successful verification, immediately clearing `pin_code = NULL`.

### 2.2 Security Guarantees
1. **No Client-Side Hashing:** PINs are never hashed in React.
2. **No Hash Exposure:** `pin_hash` is never returned in client profile objects (`safeProfile`).
3. **No Logging:** Plaintext PINs and salted hashes are never logged to console or database audit trails.
4. **Timing-Safe Comparison:** Verification uses `crypto.timingSafeEqual`.
5. **Brute Force Protection:** Atomic database functions `check_pin_lockout` and `record_pin_attempt` lock the account after 5 consecutive failed attempts.

---

## 3. Dedicated PIN Reset Flow

1. Authorized Owner or Manager opens staff details in `StaffAccessManager`.
2. Manager clicks **"Reset Terminal PIN"**, launching the secure in-modal dialog.
3. User enters new 6-digit numeric PIN with input masking and validation.
4. Client sends an authenticated `POST /api/staff/reset-pin` request with Bearer JWT.
5. Server validates:
   - Caller identity and active session via Supabase auth.
   - Caller role (`owner` or `manager`).
   - Shop branch isolation (`caller.shop_id === target.shop_id`).
   - Role hierarchy (Managers cannot reset PIN for Owners, Admins, or other Managers).
   - Format: exactly 6 numeric digits (`/^\d{6}$/`).
6. Server computes salted PBKDF2-SHA512 hash and invokes `secure_update_staff_profile`.
7. Database updates `pin_hash`, sets `pin_code = NULL`, and inserts audit record with `event_type = 'PIN_RESET'`.
8. Sensitive credentials are completely omitted from the response.

---

## 4. Privilege Escalation Safeguards (Server & Database RPC)

- **Owner Promotion:** Only Owners can promote accounts to `owner` or `admin`.
- **Manager Promotion:** Managers cannot promote any staff to `manager`.
- **Peer & Superior Protection:** Managers cannot modify Owner, Admin, or other Manager accounts.
- **Staff Permission Restriction:** Managers cannot grant `staff: true` in permissions JSON.
- **Cross-Shop Boundary:** Any attempt to read or modify staff outside the caller's assigned `shop_id` raises a PostgreSQL exception.

---

## 5. Audit Logging Architecture

Table: `public.staff_audit_logs`

### Recorded Event Types:
- `STAFF_PROVISIONED`: Creation of new staff account and initial role assignment.
- `ROLE_CHANGED`: Promotion or demotion between allowed roles.
- `PIN_RESET`: Terminal PIN reset by authorized administrator.
- `SCHEDULE_CHANGED`: Modifications to scheduled work days or shift hours.
- `STAFF_DEACTIVATED`: Account lockout / deactivation.
- `STAFF_REACTIVATED`: Account reinstatement.
- `PIN_MIGRATED`: One-time automated migration from plaintext credential.

### Payload Isolation:
- `actor_id`: UUID of the authenticated admin performing the action.
- `target_staff_id`: UUID of the affected staff member.
- `shop_id`: Authoritative shop branch ID.
- `old_values` & `new_values`: JSONB metadata strictly filtering out `pin_hash`, `pin_code`, `password`, and access tokens.

---

## 6. Live Supabase Deployment Instructions

When applying these changes to the live/test Supabase project (`zhwiinqlknzxyxzvhvni`):

1. **Apply Migrations in Order:**
   - `supabase/migrations/20260924210000_harden_staff_security_and_migrate_pins.sql`
   - `supabase/migrations/20260924220000_refine_staff_security_rpcs.sql`

2. **Run One-Time PIN Migration Script (Optional / Alternative):**
   ```bash
   SUPABASE_SERVICE_ROLE_KEY="<service-role-key>" VITE_SUPABASE_URL="https://zhwiinqlknzxyxzvhvni.supabase.co" npx tsx scripts/migrate-pins.ts
   ```
   *Note: Profiles with legacy PINs will also automatically migrate to `pin_hash` upon their next login.*

3. **Verify Post-Migration State:**
   ```sql
   SELECT id, full_name, role, (pin_code IS NULL) as pin_code_cleared, (pin_hash IS NOT NULL) as pin_hash_populated 
   FROM public.profiles;
   ```
