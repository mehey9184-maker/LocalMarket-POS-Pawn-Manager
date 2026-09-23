import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

// Ensure public upload directories exist for local development fallback
const UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads");
if (!fs.existsSync(UPLOAD_ROOT)) {
  fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
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
