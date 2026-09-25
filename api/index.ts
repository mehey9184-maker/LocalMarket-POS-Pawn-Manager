import type { IncomingMessage, ServerResponse } from "http";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

let cachedApp: any = null;
let appInitPromise: Promise<any> | null = null;

function loadCreateApp(): (options?: { isServerless?: boolean }) => Promise<any> {
  const candidatePaths = [
    path.join(process.cwd(), "dist", "server.cjs"),
    path.join(__dirname, "../dist/server.cjs"),
    path.join(__dirname, "dist/server.cjs"),
    path.join(__dirname, "server.cjs"),
    path.join(process.cwd(), "server.cjs"),
    path.resolve("./dist/server.cjs"),
    path.resolve("../dist/server.cjs"),
  ];

  for (const candidate of candidatePaths) {
    try {
      if (candidate && fs.existsSync(candidate)) {
        const serverMod = require(candidate);
        if (typeof serverMod.createApp === "function") {
          return serverMod.createApp;
        }
        if (serverMod.default && typeof serverMod.default.createApp === "function") {
          return serverMod.default.createApp;
        }
      }
    } catch {
      // Continue to next candidate
    }
  }

  // Fallback to direct require attempt
  try {
    const serverMod = require("../dist/server.cjs");
    if (typeof serverMod.createApp === "function") {
      return serverMod.createApp;
    }
    if (serverMod.default && typeof serverMod.default.createApp === "function") {
      return serverMod.default.createApp;
    }
  } catch (err: any) {
    console.error("Direct require('../dist/server.cjs') failed:", err);
  }

  throw new Error("Unable to locate or load createApp from compiled backend bundle (dist/server.cjs)");
}

async function getApp() {
  if (cachedApp) return cachedApp;
  if (!appInitPromise) {
    const createApp = loadCreateApp();
    appInitPromise = createApp({ isServerless: true }).then((app: any) => {
      cachedApp = app;
      return app;
    });
  }
  return appInitPromise;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const app = await getApp();

    // Resolve original path from headers if Vercel altered req.url
    const originalUrl =
      (req.headers["x-forwarded-uri"] as string) ||
      (req.headers["x-matched-path"] as string) ||
      (req.headers["x-original-url"] as string) ||
      req.url ||
      "/";

    if (
      (req.url === "/api" || req.url === "/" || req.url === "") &&
      originalUrl &&
      originalUrl !== "/api" &&
      originalUrl !== "/"
    ) {
      req.url = originalUrl;
    }

    // Ensure req.url matches Express route definitions if path was rewritten without prefix
    if (req.url && !req.url.startsWith("/api") && !req.url.startsWith("/uploads")) {
      req.url = `/api${req.url.startsWith("/") ? "" : "/"}${req.url}`;
    }

    return app(req, res);
  } catch (err: any) {
    console.error("Vercel Serverless Function invocation error:", err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(
        JSON.stringify({
          success: false,
          error: "LocalMarket backend serverless function error",
          message: err?.message || String(err),
        })
      );
    }
  }
}


