import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

// Ensure public upload directories exist for local development fallback
const UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads");
if (!fs.existsSync(UPLOAD_ROOT)) {
  fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
}

// Server-side Supabase Admin Client helper
// CRITICAL: MUST require SUPABASE_SERVICE_ROLE_KEY only. Never fall back to public anon key!
function getSupabaseAdminClient() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return null;
  }
  return createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

// PIN Hashing Helpers
function hashPin(pin: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(pin, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPinHash(pin: string, storedHash: string): boolean {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, originalHash] = storedHash.split(':');
  try {
    const hash = crypto.pbkdf2Sync(pin, salt, 10000, 64, 'sha512').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(originalHash, 'hex'));
  } catch {
    return false;
  }
}

// Server-side Caller Authentication & Role Verification Helper
async function authenticateCaller(req: express.Request): Promise<{
  user?: any;
  profile?: any;
  shop?: any;
  status: number;
  error?: string;
}> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      status: 401,
      error: "Missing or invalid Authorization header. Expected Bearer <supabase_access_token>."
    };
  }

  const token = authHeader.split(" ")[1]?.trim();
  if (!token) {
    return {
      status: 401,
      error: "Bearer token is empty."
    };
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return {
      status: 503,
      error: "Supabase connection is not configured on the server."
    };
  }

  // Create user-scoped client with the caller's bearer token
  const userClient = createClient(supabaseUrl, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  });

  const { data: authData, error: authError } = await userClient.auth.getUser(token);
  if (authError || !authData?.user) {
    return {
      status: 401,
      error: "Invalid, expired, or unverified session credentials."
    };
  }

  const callerUser = authData.user;

  // Fetch the authoritative profile and shop for the caller
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return { status: 503, error: "Admin client not available" };
  }

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("*, shop:shop_profiles(*)")
    .eq("id", callerUser.id)
    .maybeSingle();

  if (profileError || !profile) {
    return {
      status: 403,
      error: "Authenticated user profile not found in database."
    };
  }

  if (profile.is_active === false) {
    return {
      status: 403,
      error: "User profile account is currently inactive."
    };
  }

  return {
    user: callerUser,
    profile,
    shop: profile.shop,
    status: 200
  };
}

// --- CENTRALIZED SCHEDULE ENGINE ---
function getShopNow(timezone: string = 'Africa/Johannesburg') {
  const now = new Date();
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false
    });
    const parts = formatter.formatToParts(now);
    const d: any = {};
    parts.forEach(p => { if (p.type !== 'literal') d[p.type] = p.value; });
    return new Date(`${d.year}-${d.month}-${d.day}T${d.hour}:${d.minute}:${d.second}`);
  } catch (e) {
    console.error("Timezone error, falling back to local time:", e);
    return now;
  }
}

function verifyStaffSchedule(profile: any, shop: any): { allowed: boolean; error?: string } {
  // Owners and Admins are always allowed
  if (profile.role === 'owner' || profile.role === 'admin') return { allowed: true };

  const schedule = profile.schedule as any;
  if (!schedule) return { allowed: true }; // No schedule restriction

  const timezone = shop?.timezone || 'Africa/Johannesburg';
  const shopNow = getShopNow(timezone);
  const currentDay = shopNow.getDay();
  const currentTotalMinutes = shopNow.getHours() * 60 + shopNow.getMinutes();

  const workingDays = schedule.workingDays || [1, 2, 3, 4, 5];
  const [startH, startM] = (schedule.startTime || "08:00").split(':').map(Number);
  const [endH, endM] = (schedule.endTime || "17:00").split(':').map(Number);
  const earlyMins = schedule.earlyLoginMinutes || 10;
  const overnight = !!schedule.overnight;

  const startTotalMinutes = startH * 60 + startM;
  const startWithEarlyTotalMinutes = startTotalMinutes - earlyMins;
  const endTotalMinutes = endH * 60 + endM;

  // 1. Check shift starting today
  if (workingDays.includes(currentDay)) {
    if (!overnight) {
      if (currentTotalMinutes >= startWithEarlyTotalMinutes && currentTotalMinutes <= endTotalMinutes) {
        return { allowed: true };
      }
    } else {
      // Overnight: starts today, ends tomorrow. 
      // If we are currently after the start-with-early time
      if (currentTotalMinutes >= startWithEarlyTotalMinutes) {
        return { allowed: true };
      }
    }
  }

  // 2. Check shift starting yesterday (if overnight)
  const yesterdayDay = (currentDay + 6) % 7;
  if (workingDays.includes(yesterdayDay) && overnight) {
    // If we are currently before the end time today
    if (currentTotalMinutes <= endTotalMinutes) {
      return { allowed: true };
    }
  }

  // Determine user facing error
  if (!workingDays.includes(currentDay) && (!overnight || currentTotalMinutes > endTotalMinutes)) {
    return { allowed: false, error: "You are not scheduled to work today." };
  }

  if (currentTotalMinutes < startWithEarlyTotalMinutes) {
    return { allowed: false, error: `This shift starts at ${schedule.startTime}.` };
  }

  return { allowed: false, error: "Your scheduled shift has ended." };
}

// --- CENTRALIZED STAFF AUDIT LOGGING ---
async function logStaffAudit(adminClient: any, {
  shopId,
  actorId,
  targetId,
  eventType,
  oldValues,
  newValues,
  reason
}: {
  shopId: string;
  actorId: string;
  targetId: string;
  eventType: string;
  oldValues?: any;
  newValues?: any;
  reason?: string;
}) {
  try {
    await adminClient.from('staff_audit_logs').insert({
      shop_id: shopId,
      actor_id: actorId,
      target_staff_id: targetId,
      event_type: eventType,
      old_values: oldValues,
      new_values: newValues,
      reason
    });
  } catch (err) {
    console.error("Failed to write staff audit log:", err);
  }
}

/**
 * Server-side Backblaze B2 / Storage Helper
 * Keeps all application secrets strictly on the server.
 */
async function uploadToBackblazeB2(
  buffer: Buffer,
  filePath: string,
  mimeType: string
): Promise<{ url: string; key: string } | null> {
  const keyId = process.env.B2_APPLICATION_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
  const applicationKey = process.env.B2_APPLICATION_KEY || process.env.AWS_SECRET_ACCESS_KEY;
  const bucketName = process.env.B2_BUCKET_NAME;
  const customEndpoint = process.env.B2_ENDPOINT; // e.g. s3.us-west-004.backblazeb2.com

  if (!keyId || !applicationKey || !bucketName) {
    return null;
  }

  try {
    // 1. Authorize B2 Account
    const basicAuth = Buffer.from(`${keyId}:${applicationKey}`).toString("base64");
    const authRes = await fetch("https://api.backblazeb2.com/b2api/v2/b2_authorize_account", {
      headers: {
        Authorization: `Basic ${basicAuth}`,
      },
    });

    if (!authRes.ok) {
      console.warn("B2 authorize failed:", await authRes.text());
      return null;
    }

    const authData: any = await authRes.json();
    const apiUrl = authData.apiUrl;
    const authToken = authData.authorizationToken;
    const downloadUrl = authData.downloadUrl;
    const bucketId = process.env.B2_BUCKET_ID || authData.allowed?.bucketId;

    if (!bucketId) {
      console.warn("B2 bucketId not configured and not present in application key restrictions.");
      return null;
    }

    // 2. Get Upload URL
    const uploadUrlRes = await fetch(`${apiUrl}/b2api/v2/b2_get_upload_url`, {
      method: "POST",
      headers: {
        Authorization: authToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ bucketId }),
    });

    if (!uploadUrlRes.ok) {
      console.warn("B2 get_upload_url failed:", await uploadUrlRes.text());
      return null;
    }

    const uploadUrlData: any = await uploadUrlRes.json();
    const targetUploadUrl = uploadUrlData.uploadUrl;
    const uploadAuthToken = uploadUrlData.authorizationToken;

    // 3. Upload File
    const sha1 = crypto.createHash("sha1").update(buffer).digest("hex");
    const uploadRes = await fetch(targetUploadUrl, {
      method: "POST",
      headers: {
        Authorization: uploadAuthToken,
        "X-Bz-File-Name": encodeURIComponent(filePath),
        "Content-Type": mimeType,
        "Content-Length": buffer.length.toString(),
        "X-Bz-Content-Sha1": sha1,
      },
      body: new Uint8Array(buffer),
    });

    if (!uploadRes.ok) {
      console.warn("B2 upload file failed:", await uploadRes.text());
      return null;
    }

    const publicUrl = `${downloadUrl}/file/${bucketName}/${filePath}`;
    return { url: publicUrl, key: filePath };
  } catch (error) {
    console.warn("Backblaze B2 upload error (falling back to local storage):", error);
    return null;
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Support image base64 payloads up to 25MB
  app.use(express.json({ limit: "25mb" }));
  app.use(express.urlencoded({ extended: true, limit: "25mb" }));

  // Static uploads directory for local persistence / offline fallback
  app.use("/uploads", express.static(UPLOAD_ROOT));

  // --- API ROUTE: VERIFY MANAGER PIN ---
  // Authenticates caller session and verifies owner/manager authorization
  app.post("/api/verify-pin", async (req, res) => {
    try {
      const auth = await authenticateCaller(req);
      if (auth.status !== 200) {
        return res.status(auth.status).json({ success: false, error: auth.error || "Authentication required." });
      }

      const adminSupabase = getSupabaseAdminClient();
      if (!adminSupabase) {
        return res.status(503).json({ success: false, error: "Backend admin service not configured." });
      }

      // Caller role must be manager or owner
      if (auth.profile.role !== "owner" && auth.profile.role !== "manager" && auth.profile.role !== "admin") {
        return res.status(403).json({ success: false, error: "Only authenticated managers or owners can access elevated operations." });
      }

      const { pin } = req.body;
      if (!pin) {
        return res.status(400).json({ success: false, error: "PIN is required." });
      }

      // 1. Atomic Brute Force Lockout Check & Attempt Reservation
      const { data: lockoutData, error: lockoutErr } = await adminSupabase.rpc('check_pin_lockout', {
        p_user_id: auth.profile.id
      });

      if (!lockoutErr && lockoutData) {
        if (lockoutData.locked) {
          return res.status(429).json({ success: false, error: `Too many failed attempts. Try again in ${lockoutData.remaining_minutes || 15} minutes.` });
        }
        if (lockoutData.attempt_admitted === false) {
          return res.status(429).json({ success: false, error: "Authentication attempt denied due to account lockout." });
        }
      }

      let isPinValid = false;

      // 2. Verify PIN (pin_hash or legacy pin_code migration fallback)
      if (auth.profile.pin_hash) {
        isPinValid = verifyPinHash(pin, auth.profile.pin_hash);
      } else if (auth.profile.pin_code && String(auth.profile.pin_code) === String(pin)) {
        isPinValid = true;
        const newHash = hashPin(pin);
        await adminSupabase.from('profiles').update({
          pin_hash: newHash,
          pin_code: null
        }).eq('id', auth.profile.id);
      }

      // 3. Atomically record attempt result
      await adminSupabase.rpc('record_pin_attempt', {
        p_user_id: auth.profile.id,
        p_success: isPinValid
      });

      if (!isPinValid) {
        return res.status(401).json({ success: false, error: "Invalid Manager PIN." });
      }

      return res.json({ success: true, authorizedRole: auth.profile.role });
    } catch (err: any) {
      console.error("PIN verification error:", err);
      return res.status(500).json({ success: false, error: "Internal server error." });
    }
  });

  // --- API ROUTE: LOGIN WITH PIN ---
  app.post("/api/auth/login-with-pin", async (req, res) => {
    try {
      const { cashierCode, pin } = req.body;
      if (!cashierCode || !pin) {
        return res.status(400).json({ success: false, error: "Cashier code and PIN are required." });
      }

      const adminSupabase = getSupabaseAdminClient();
      if (!adminSupabase) {
        return res.status(503).json({ success: false, error: "Backend admin service not configured." });
      }

      // 1. Find profile by cashier code
      const { data: profile, error: profileErr } = await adminSupabase
        .from("profiles")
        .select("*, shop:shop_profiles(*)")
        .eq("cashier_code", cashierCode)
        .maybeSingle();

      if (profileErr || !profile) {
        // Generic error to avoid account enumeration
        return res.status(401).json({ success: false, error: "Invalid credentials." });
      }

      if (!profile.is_active) {
        return res.status(403).json({ success: false, error: "Account is deactivated." });
      }

      // 2. Atomic Brute Force Lockout Check & Attempt Reservation
      const { data: lockoutData, error: lockoutErr } = await adminSupabase.rpc('check_pin_lockout', {
        p_user_id: profile.id
      });

      if (!lockoutErr && lockoutData) {
        if (lockoutData.locked) {
          return res.status(429).json({ success: false, error: `Too many failed attempts. Try again in ${lockoutData.remaining_minutes || 15} minutes.` });
        }
        if (lockoutData.attempt_admitted === false) {
          return res.status(429).json({ success: false, error: "Authentication attempt denied due to account lockout." });
        }
      }

      // 3. Verify PIN
      let isPinValid = false;
      if (profile.pin_hash) {
        isPinValid = verifyPinHash(pin, profile.pin_hash);
      } else if (profile.pin_code && String(profile.pin_code) === String(pin)) {
        isPinValid = true;
        const newHash = hashPin(pin);
        await adminSupabase.from('profiles').update({
          pin_hash: newHash,
          pin_code: null
        }).eq('id', profile.id);
      }

      // 4. Atomically record attempt result
      await adminSupabase.rpc('record_pin_attempt', {
        p_user_id: profile.id,
        p_success: isPinValid
      });

      if (!isPinValid) {
        return res.status(401).json({ success: false, error: "Invalid PIN." });
      }

      // 5. Check Schedule Enforcement
      const scheduleCheck = verifyStaffSchedule(profile, profile.shop);
      if (!scheduleCheck.allowed) {
        return res.status(403).json({ success: false, error: scheduleCheck.error });
      }

      // 6. Establish Real Supabase Session
      const tempPassword = crypto.randomBytes(16).toString('hex') + "A1!";
      const { error: updateAuthErr } = await adminSupabase.auth.admin.updateUserById(profile.id, {
        password: tempPassword
      });

      if (updateAuthErr) {
        console.error("Auth update failed during PIN login:", updateAuthErr);
        return res.status(500).json({ success: false, error: "Failed to establish secure session." });
      }

      // Sign in on server to get session
      const { data: authData, error: signInErr } = await adminSupabase.auth.signInWithPassword({
        email: profile.email!,
        password: tempPassword
      });

      if (signInErr || !authData.session) {
        console.error("Auth signin failed during PIN login:", signInErr);
        return res.status(500).json({ success: false, error: "Session establishment failed." });
      }

      // Audit login
      await logStaffAudit(adminSupabase, {
        shopId: profile.shop_id!,
        actorId: profile.id,
        targetId: profile.id,
        eventType: 'STAFF_LOGIN_PIN',
        reason: 'Staff terminal activation'
      });

      return res.json({ 
        success: true, 
        session: authData.session,
        message: "Terminal activated successfully."
      });

    } catch (err: any) {
      console.error("Login with PIN error:", err);
      return res.status(500).json({ success: false, error: "Internal server error during login." });
    }
  });

  // --- API ROUTE: SECURE STAFF PROFILE UPDATE ---
  app.post("/api/staff/update-profile", async (req, res) => {
    try {
      const auth = await authenticateCaller(req);
      if (auth.status !== 200) {
        return res.status(auth.status).json({ success: false, error: auth.error });
      }

      const { targetId, updates, reason } = req.body;
      if (!targetId || !updates) {
        return res.status(400).json({ success: false, error: "Target ID and updates are required." });
      }

      const token = req.headers.authorization!.split(" ")[1].trim();
      const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
      const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
      const userScopedClient = createClient(supabaseUrl!, anonKey!, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${token}` } }
      });

      const processedUpdates = { ...updates };
      if (processedUpdates.pinCode) {
        processedUpdates.pin_hash = hashPin(processedUpdates.pinCode);
        delete processedUpdates.pinCode;
        delete processedUpdates.pin_code;
      } else if (processedUpdates.pin_code) {
        processedUpdates.pin_hash = hashPin(processedUpdates.pin_code);
        delete processedUpdates.pin_code;
      }

      // Call the secure RPC via user-scoped client so auth.uid() resolves to caller
      const { data, error } = await userScopedClient.rpc('secure_update_staff_profile', {
        p_target_id: targetId,
        p_updates: processedUpdates,
        p_reason: reason || 'Staff profile update via Admin panel'
      });

      if (error) {
        return res.status(400).json({ success: false, error: error.message });
      }

      return res.json({ success: true, data });
    } catch (err: any) {
      console.error("Update staff profile error:", err);
      return res.status(500).json({ success: false, error: "Failed to update staff profile." });
    }
  });

  // --- API ROUTE: STAFF PROVISIONING (Real Auth User + Profile) ---
  // Strictly authenticates caller, verifies owner/manager role, enforces shop isolation, and audits creation
  app.post("/api/staff/provision", async (req, res) => {
    try {
      // 1. Authenticate caller
      const auth = await authenticateCaller(req);
      if (auth.status !== 200) {
        return res.status(auth.status).json({ success: false, error: auth.error || "Authentication required." });
      }

      const callerProfile = auth.profile;

      // 2. Verify caller role is owner or manager
      if (callerProfile.role !== "owner" && callerProfile.role !== "manager") {
        return res.status(403).json({
          success: false,
          error: "Forbidden: Only authenticated Shop Owners and Managers can provision staff."
        });
      }

      // 3. Verify caller has an assigned shop_id
      if (!callerProfile.shop_id) {
        return res.status(400).json({
          success: false,
          error: "Caller profile has no assigned shop branch."
        });
      }

      const authoritativeShopId = callerProfile.shop_id;

      // 4. Prevent cross-shop staff provisioning
      if (req.body.shopId && req.body.shopId !== authoritativeShopId) {
        return res.status(403).json({
          success: false,
          error: "Forbidden: Cross-shop staff provisioning is prohibited. You may only provision staff for your own assigned branch."
        });
      }

      const { fullName, role, cashierCode, pinCode, email, password } = req.body;

      if (!fullName || !cashierCode || !role) {
        return res.status(400).json({
          success: false,
          error: "fullName, cashierCode, and role are required."
        });
      }

      // 5. Restrict allowed staff roles (Disallow creating owner or admin accounts)
      const allowedRoles = ["cashier", "senior_cashier", "manager"];
      if (!allowedRoles.includes(role)) {
        return res.status(403).json({
          success: false,
          error: "Forbidden: Creating owner or admin accounts via standard staff provisioning is strictly forbidden."
        });
      }

      // 6. Admin client verification (Service-Role Key only)
      const adminSupabase = getSupabaseAdminClient();
      if (!adminSupabase) {
        return res.status(503).json({
          success: false,
          error: "Backend admin service-role key (SUPABASE_SERVICE_ROLE_KEY) is not configured on the server."
        });
      }

      const staffEmail = email || `${cashierCode.toLowerCase().replace(/[^a-z0-9]/g, "")}@localmarketpos.co.za`;
      
      // Use a random password - users only login via PIN which establishes session on server
      const staffPassword = password || crypto.randomBytes(16).toString('hex') + "A1!";

      let userId: string | null = null;

      // 7. Create Auth User using Admin API
      const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
        email: staffEmail,
        password: staffPassword,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          role,
          shop_id: authoritativeShopId,
          cashier_code: cashierCode
        }
      });

      if (authError) {
        // If user already exists in auth, check if profile exists
        console.warn("Supabase auth.admin.createUser note:", authError.message);
        const { data: existingProfile } = await adminSupabase
          .from("profiles")
          .select("id, shop_id")
          .eq("cashier_code", cashierCode)
          .maybeSingle();

        if (existingProfile?.id) {
          if (existingProfile.shop_id && existingProfile.shop_id !== authoritativeShopId) {
            return res.status(403).json({
              success: false,
              error: "Cashier code already belongs to another shop branch."
            });
          }
          userId = existingProfile.id;
        } else {
          return res.status(400).json({
            success: false,
            error: `Auth user creation failed: ${authError.message}`
          });
        }
      } else if (authData?.user?.id) {
        userId = authData.user.id;
      }

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: "Could not create or locate authenticated user account for staff member."
        });
      }

      // 8. Upsert Profile record in profiles table
      const hashedPin = (pinCode || req.body.pin_code) ? hashPin(pinCode || req.body.pin_code) : null;
      const profilePayload = {
        id: userId,
        shop_id: authoritativeShopId,
        email: staffEmail,
        full_name: fullName,
        role: role,
        cashier_code: cashierCode,
        pin_hash: hashedPin,
        pin_code: null,
        is_active: true,
        updated_at: new Date().toISOString()
      };

      const { data: profileRow, error: profileErr } = await adminSupabase
        .from("profiles")
        .upsert(profilePayload, { onConflict: "id" })
        .select()
        .single();

      if (profileErr) {
        return res.status(400).json({ success: false, error: profileErr.message });
      }

      // 9. Write audit log for staff provisioning
      await logStaffAudit(adminSupabase, {
        shopId: authoritativeShopId,
        actorId: callerProfile.id,
        targetId: userId,
        eventType: 'STAFF_PROVISIONED',
        newValues: {
          full_name: fullName,
          role,
          cashier_code: cashierCode
        },
        reason: 'New staff member registration'
      });

      const safeProfile = {
        id: profileRow.id,
        shop_id: profileRow.shop_id,
        email: profileRow.email,
        full_name: profileRow.full_name,
        role: profileRow.role,
        cashier_code: profileRow.cashier_code,
        phone: profileRow.phone,
        avatar_url: profileRow.avatar_url,
        is_active: profileRow.is_active,
        schedule: profileRow.schedule,
        permissions: profileRow.permissions,
        created_at: profileRow.created_at,
        updated_at: profileRow.updated_at
      };

      return res.json({
        success: true,
        profile: safeProfile
      });
    } catch (err: any) {
      console.error("Staff provisioning server error:", err);
      return res.status(500).json({ success: false, error: err.message || "Failed to provision staff." });
    }
  });

  // --- API ROUTE: SECURE IMAGE UPLOAD (Backblaze B2 with local fallback) ---
  app.post("/api/storage/upload", async (req, res) => {
    try {
      // Authenticate caller to enforce shop isolation
      const auth = await authenticateCaller(req);
      if (auth.status !== 200) {
        return res.status(auth.status).json({ error: auth.error || "Authentication required to upload assets." });
      }

      const safeShopId = (auth.profile.shop_id || "general").replace(/[^a-zA-Z0-9_-]/g, "_");
      const { image, itemId = "item-01" } = req.body;

      if (!image || typeof image !== "string") {
        return res.status(400).json({ error: "No image payload provided" });
      }

      // Sanitize itemId to prevent path traversal
      const safeItemId = String(itemId).replace(/[^a-zA-Z0-9_-]/g, "_");
      const imageId = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

      let buffer: Buffer;
      let mimeType = "image/jpeg";
      let ext = "jpg";

      if (image.startsWith("data:")) {
        const matches = image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          mimeType = matches[1];
          ext = mimeType.split("/")[1] || "jpg";
          if (ext === "jpeg") ext = "jpg";
          buffer = Buffer.from(matches[2], "base64");
        } else {
          buffer = Buffer.from(image, "base64");
        }
      } else {
        buffer = Buffer.from(image, "base64");
      }

      const storageKey = `shops/${safeShopId}/items/${safeItemId}/${imageId}.${ext}`;

      // Try Backblaze B2 first if configured
      const b2Result = await uploadToBackblazeB2(buffer, storageKey, mimeType);
      if (b2Result) {
        return res.json({
          imageUrl: b2Result.url,
          storageKey: b2Result.key,
          provider: "backblaze-b2",
        });
      }

      // Local fallback storage
      const localDir = path.join(UPLOAD_ROOT, "shops", safeShopId, "items", safeItemId);
      fs.mkdirSync(localDir, { recursive: true });
      const localFilePath = path.join(localDir, `${imageId}.${ext}`);
      fs.writeFileSync(localFilePath, buffer);

      const localUrl = `/uploads/shops/${safeShopId}/items/${safeItemId}/${imageId}.${ext}`;
      return res.json({
        imageUrl: localUrl,
        storageKey,
        provider: "local-fallback",
      });
    } catch (err: any) {
      console.error("Storage upload server error:", err);
      return res.status(500).json({ error: err.message || "Failed to process image upload" });
    }
  });

  // --- API ROUTE: DELETE IMAGE ---
  app.post("/api/storage/delete", async (req, res) => {
    try {
      // Authenticate caller to enforce shop isolation
      const auth = await authenticateCaller(req);
      if (auth.status !== 200) {
        return res.status(auth.status).json({ error: auth.error || "Authentication required." });
      }

      const { storageKey } = req.body;
      if (!storageKey || typeof storageKey !== "string") {
        return res.status(400).json({ error: "Invalid storage key" });
      }

      const safeShopId = (auth.profile.shop_id || "").replace(/[^a-zA-Z0-9_-]/g, "_");

      // Verify that caller's shop matches the path (unless admin or owner)
      if (
        safeShopId &&
        !storageKey.includes(safeShopId) &&
        auth.profile.role !== "owner" &&
        auth.profile.role !== "admin"
      ) {
        return res.status(403).json({ error: "Forbidden: Cannot delete storage files from another shop." });
      }

      // Check local file
      const safeRelativePath = storageKey.replace(/\.\./g, "");
      const localPath = path.join(UPLOAD_ROOT, safeRelativePath);
      if (fs.existsSync(localPath)) {
        fs.unlinkSync(localPath);
      }

      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || "Failed to delete image" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
