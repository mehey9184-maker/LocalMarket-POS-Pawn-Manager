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

// Server-side Caller Authentication & Role Verification Helper
async function authenticateCaller(req: express.Request): Promise<{
  user?: any;
  profile?: any;
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

  // Fetch the authoritative profile for the caller
  const { data: profile, error: profileError } = await userClient
    .from("profiles")
    .select("*")
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
    status: 200
  };
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

      // Caller role must be manager or owner
      if (auth.profile.role !== "owner" && auth.profile.role !== "manager") {
        return res.status(403).json({ success: false, error: "Only authenticated managers or owners can access elevated operations." });
      }

      const { pin } = req.body;
      if (!pin) {
        return res.status(400).json({ success: false, error: "PIN is required." });
      }

      let isPinValid = false;

      // 1. Check if caller profile has a specific pin_code set
      if (auth.profile.pin_code && String(auth.profile.pin_code) === String(pin)) {
        isPinValid = true;
      }

      // 2. Check if server-side MANAGER_PIN environment variable matches
      if (!isPinValid && process.env.MANAGER_PIN && String(pin) === String(process.env.MANAGER_PIN)) {
        isPinValid = true;
      }

      if (isPinValid) {
        return res.json({ success: true, authorizedRole: auth.profile.role });
      }

      return res.status(401).json({ success: false, error: "Invalid Manager PIN for authenticated account." });
    } catch (err: any) {
      console.error("PIN verification error:", err);
      return res.status(500).json({ success: false, error: err.message || "Failed to verify PIN." });
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
        .select("*")
        .eq("cashier_code", cashierCode)
        .maybeSingle();

      if (profileErr || !profile) {
        return res.status(404).json({ success: false, error: "Staff account not found." });
      }

      if (!profile.is_active) {
        return res.status(403).json({ success: false, error: "Account is deactivated." });
      }

      // 2. Verify PIN
      if (profile.pin_code !== pin) {
        return res.status(401).json({ success: false, error: "Invalid PIN." });
      }

      // 3. Check Schedule Enforcement (if not owner/admin)
      if (profile.role !== 'owner' && profile.role !== 'admin') {
        const schedule = profile.schedule as any;
        if (schedule) {
          const now = new Date();
          const day = now.getDay(); // 0 is Sunday, 1 is Monday
          const workingDays = schedule.workingDays || [1, 2, 3, 4, 5];
          
          if (!workingDays.includes(day)) {
             return res.status(403).json({ success: false, error: "You are not scheduled to work today." });
          }

          const [startH, startM] = (schedule.startTime || "08:00").split(':').map(Number);
          const [endH, endM] = (schedule.endTime || "17:00").split(':').map(Number);
          const earlyMins = schedule.earlyLoginMinutes || 10;

          const startTime = new Date(now);
          startTime.setHours(startH, startM - earlyMins, 0, 0);
          
          const endTime = new Date(now);
          endTime.setHours(endH, endM, 0, 0);

          if (now < startTime) {
             return res.status(403).json({ 
               success: false, 
               error: `Too early. Shift starts at ${schedule.startTime}. Early login allowed ${earlyMins} mins prior.` 
             });
          }

          if (now > endTime && !schedule.overnight) {
             return res.status(403).json({ success: false, error: "Your scheduled shift has ended." });
          }
        }
      }

      // 4. Return deterministic password for client to sign in with standard Supabase Auth
      const secret = process.env.STAFF_PASSWORD_SECRET || "LM-SECURE-STAFF-DEFAULT-2026";
      const staffPassword = crypto.createHmac('sha256', secret)
        .update(profile.cashier_code.toUpperCase())
        .digest('hex')
        .substring(0, 16) + "!";
      
      return res.json({ 
        success: true, 
        email: profile.email,
        password: staffPassword,
        message: "PIN verified. Authenticating..."
      });

    } catch (err: any) {
      console.error("Login with PIN error:", err);
      return res.status(500).json({ success: false, error: err.message || "Login failed." });
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
      
      // Use a deterministic password based on cashierCode and a server-side secret
      // This allows PIN login to work by having the server verify the PIN and then
      // telling the client the deterministic password (or just signing them in).
      const secret = process.env.STAFF_PASSWORD_SECRET || "LM-SECURE-STAFF-DEFAULT-2026";
      const staffPassword = password || crypto.createHmac('sha256', secret)
        .update(cashierCode.toUpperCase())
        .digest('hex')
        .substring(0, 16) + "!";

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
      const profilePayload = {
        id: userId,
        shop_id: authoritativeShopId,
        email: staffEmail,
        full_name: fullName,
        role: role,
        cashier_code: cashierCode,
        pin_code: pinCode || null,
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
      try {
        await adminSupabase.from("system_logs").insert({
          shop_id: authoritativeShopId,
          event_type: "STAFF_PROVISIONED",
          severity: "audit",
          actor_id: callerProfile.id,
          actor_name: callerProfile.full_name || "Manager",
          details: {
            created_user_id: userId,
            created_user_role: role,
            cashier_code: cashierCode,
            shop_id: authoritativeShopId,
            timestamp: new Date().toISOString()
          }
        });
      } catch (logErr: any) {
        console.warn("Audit log creation error (non-blocking):", logErr.message);
      }

      return res.json({
        success: true,
        profile: profileRow,
        credentials: {
          email: staffEmail,
          temporaryPassword: staffPassword
        }
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
