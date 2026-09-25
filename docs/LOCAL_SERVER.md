# LocalMarket Server

LocalMarket's authoritative backend is our dedicated Node.js + Express application server defined in `server.ts`.

In store operations, the Primary Shop PC runs both the POS user interface and the LocalMarket Node/Express server, binding to `0.0.0.0:3000` to serve the local machine as well as secondary POS terminals and mobile devices on the shop Local Area Network (LAN).

---

## Architecture Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                      PRIMARY SHOP PC                        │
│                                                             │
│  ┌───────────────────────────┐  ┌────────────────────────┐  │
│  │ LocalMarket POS Frontend  │  │ LocalMarket Express    │  │
│  │ (IndexedDB / Dexie)       │◄─┼┤ Server (server.ts)    │  │
│  └───────────────────────────┘  └───────────┬────────────┘  │
└─────────────────────────────────────────────┼───────────────┘
                                              │
                    ┌─────────────────────────┼─────────────────────────┐
                    │ Local Area Network      │                         │
                    ▼                         ▼                         ▼
         ┌─────────────────────┐   ┌─────────────────────┐   ┌─────────────────────┐
         │ Secondary POS Client│   │ Mobile Barcode /    │   │ Supabase Cloud      │
         │ (http://SHOP-PC:3000│   │ Intake Tablet       │   │ (Sync & Auth when   │
         │  or VITE_API_BASE)  │   │                     │   │  online)            │
         └─────────────────────┘   └─────────────────────┘   └─────────────────────┘
```

- **Local Server**: Authoritative gateway for staff PIN hashing & verification, staff provisioning, secure role elevation, server-side Backblaze B2 asset storage, and market pricing intelligence.
- **Offline-First Store**: IndexedDB/Dexie remains the local zero-latency database on all clients so transactions, buy/pawn intakes, and inventory lookups never fail during internet outages.
- **Supabase Cloud**: Cloud synchronization and persistent remote data store when the shop has an active internet connection. Supabase service-role keys NEVER leave the server.

---

## Server Execution Commands

### 1. Development Mode (Express + Vite Middleware)
```bash
npm run dev
```
Starts Express on `http://0.0.0.0:3000` with live Vite HMR middleware mounted.

### 2. Production Build & Server
```bash
npm run build
npm run start
```
Compiles Vite client assets to `dist/`, bundles the backend to `dist/server.cjs` via `esbuild`, and starts the production Node server.

---

## Access URLs

| Context | URL | Description |
| :--- | :--- | :--- |
| **Local Machine (Loopback)** | `http://127.0.0.1:3000` | Direct access on the primary shop computer. |
| **LAN Devices (Shop Network)** | `http://<SHOP-PC-IP>:3000` | Access from tablets, secondary POS tills, and LAN scanners. |
| **Health Check Endpoint** | `http://<SHOP-PC-IP>:3000/api/health` | Returns JSON status, service name, mode (`local-server`), and uptime. |

When the server starts in standalone mode, it automatically detects all active non-loopback IPv4 network interfaces and logs the exact LAN URLs to the console:
```text
LocalMarket Server listening on http://127.0.0.1:3000
[LocalMarket LAN]
  http://192.168.1.120:3000
```

---

## Environment Variables

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `HOST` | `0.0.0.0` | Network interface to bind. Use `0.0.0.0` for LAN access, `127.0.0.1` for loopback-only. |
| `PORT` | `3000` | HTTP port for the Express application. |
| `VITE_API_BASE_URL` | *empty* (relative `/api`) | Target API server for remote frontend clients (e.g. `http://192.168.1.120:3000`). |
| `CORS_ORIGINS` | *empty* (allows LAN + localhost) | Comma-separated list of explicit allowed origins (e.g. `http://192.168.1.150:3000,http://pos-till2.local:3000`). |
| `SUPABASE_URL` / `VITE_SUPABASE_URL` | *required* | Supabase project endpoint. |
| `SUPABASE_SERVICE_ROLE_KEY` | *required* | Secret server-only service-role key for authoritative admin operations. |
| `SUPABASE_ANON_KEY` / `VITE_SUPABASE_ANON_KEY` | *required* | Public anon key for client-side queries. |

---

## Security & Architectural Guarantees

1. **Zero Secret Leakage**: `SUPABASE_SERVICE_ROLE_KEY` and Backblaze B2 keys are used exclusively inside server-side route handlers.
2. **Authoritative Authentication**: `authenticateCaller(req)` validates the Supabase session token and verifies the caller's active status and role directly on the backend before executing privileged actions.
3. **LAN Protection**: CORS allows private subnets (`192.168.x.x`, `10.x.x.x`, `172.16-31.x.x`, `*.local`) and explicitly configured origins, while rejecting arbitrary internet origins with credentials.
4. **Safe Module Import**: `createApp({ isServerless?: boolean })` instantiates the Express application without starting a network listener. Standalone startup is guarded and only executes when invoked as a CLI script entry.
