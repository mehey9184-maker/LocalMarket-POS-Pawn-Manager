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
function getSupabaseServerClient() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !serviceKey) return null;
  return createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
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
  app.post("/api/verify-pin", (req, res) => {
    const { pin } = req.body;
    const MANAGER_PIN = process.env.MANAGER_PIN || "8419";

    if (pin && String(pin) === String(MANAGER_PIN)) {
      return res.json({ success: true });
    }

    return res.status(401).json({ success: false, error: "Invalid Manager PIN" });
  });

  // --- API ROUTE: STAFF PROVISIONING (Real Auth User + Profile) ---
  app.post("/api/staff/provision", async (req, res) => {
    try {
      const { shopId, fullName, role, cashierCode, pinCode, email, password } = req.body;

      if (!shopId) {
        return res.status(400).json({ success: false, error: "shopId is required. Explicit shop assignment is mandatory." });
      }
      if (!fullName || !cashierCode || !role) {
        return res.status(400).json({ success: false, error: "fullName, cashierCode, and role are required." });
      }

      const supabase = getSupabaseServerClient();
      if (!supabase) {
        return res.status(503).json({ success: false, error: "Backend Supabase connection is not configured." });
      }

      const staffEmail = email || `${cashierCode.toLowerCase().replace(/[^a-z0-9]/g, "")}@localmarketpos.co.za`;
      const staffPassword = password || `LM-${Math.floor(100000 + Math.random() * 900000)}!`;

      let userId: string | null = null;

      // 1. Try to create Auth User using Admin API
      if (supabase.auth?.admin) {
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email: staffEmail,
          password: staffPassword,
          email_confirm: true,
          user_metadata: {
            full_name: fullName,
            fullName,
            role,
            shop_id: shopId,
            cashier_code: cashierCode
          }
        });

        if (authError) {
          // If user already exists in auth, find or sign in
          console.warn("Supabase auth.admin.createUser error, checking if user exists:", authError.message);
          // Fallback to checking existing profile or standard signUp
          const { data: existingProfile } = await supabase
            .from("profiles")
            .select("id")
            .eq("cashier_code", cashierCode)
            .maybeSingle();

          if (existingProfile?.id) {
            userId = existingProfile.id;
          }
        } else if (authData?.user?.id) {
          userId = authData.user.id;
        }
      }

      // 2. If admin API not available, try standard signUp
      if (!userId) {
        const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
          email: staffEmail,
          password: staffPassword,
          options: {
            data: {
              full_name: fullName,
              fullName,
              role,
              shop_id: shopId,
              cashier_code: cashierCode
            }
          }
        });

        if (signUpErr && !(signUpData as any)?.user?.id) {
          console.warn("Supabase signUp warning:", signUpErr.message);
        } else if ((signUpData as any)?.user?.id) {
          userId = (signUpData as any).user.id;
        }
      }

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: "Could not create authenticated user account for staff member."
        });
      }

      // 3. Upsert Profile record in profiles table
      const profilePayload = {
        id: userId,
        shop_id: shopId,
        email: staffEmail,
        full_name: fullName,
        role: role,
        cashier_code: cashierCode,
        pin_code: pinCode || null,
        is_active: true,
        updated_at: new Date().toISOString()
      };

      const { data: profileRow, error: profileErr } = await supabase
        .from("profiles")
        .upsert(profilePayload, { onConflict: "id" })
        .select()
        .single();

      if (profileErr) {
        return res.status(400).json({ success: false, error: profileErr.message });
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
      const { image, shopId = "SHOP-SOW-01", itemId = "item-01" } = req.body;

      if (!image || typeof image !== "string") {
        return res.status(400).json({ error: "No image payload provided" });
      }

      // Sanitize shopId and itemId to prevent path traversal
      const safeShopId = shopId.replace(/[^a-zA-Z0-9_-]/g, "_");
      const safeItemId = itemId.replace(/[^a-zA-Z0-9_-]/g, "_");
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
  app.post("/api/storage/delete", (req, res) => {
    try {
      const { storageKey } = req.body;
      if (!storageKey || typeof storageKey !== "string") {
        return res.status(400).json({ error: "Invalid storage key" });
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
