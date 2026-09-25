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
  const app = await getApp();
  // Ensure req.url matches Express route definitions if path was rewritten
  if (req.url && !req.url.startsWith("/api") && !req.url.startsWith("/uploads")) {
    req.url = `/api${req.url.startsWith("/") ? "" : "/"}${req.url}`;
  }
  return app(req, res);
}
