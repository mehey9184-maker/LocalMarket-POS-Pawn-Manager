import type { IncomingMessage, ServerResponse } from "http";
import { createApp } from "../server";

let cachedApp: any = null;
let appInitPromise: Promise<any> | null = null;

async function getApp() {
  if (cachedApp) return cachedApp;
  if (!appInitPromise) {
    appInitPromise = createApp({ isServerless: true }).then((app) => {
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

