# LocalMarket POS & Pawn Manager — Release Guide

---

## 1. Architecture Overview

LocalMarket is an authoritative, offline-first Point of Sale, Second-Hand Goods Acquisition, Pawn Loan Manager, and SAPS Compliance Register built specifically for South African pawnshops and retail trading environments.

```text
┌─────────────────────────────────────────────────────────────┐
│                      PRIMARY SHOP WORKSTATION               │
│                                                             │
│  ┌───────────────────────────┐  ┌────────────────────────┐  │
│  │ LocalMarket POS UI        │  │ Authoritative Express  │  │
│  │ (React 19 + Dexie DB)     │◄─┼┤ Server (server.ts)    │  │
│  └───────────────────────────┘  └───────────┬────────────┘  │
└─────────────────────────────────────────────┼───────────────┘
                                              │
                    ┌─────────────────────────┼─────────────────────────┐
                    │ Shop Local Area Network │                         │
                    ▼                         ▼                         ▼
         ┌─────────────────────┐   ┌─────────────────────┐   ┌─────────────────────┐
         │ Secondary POS Till  │   │ Mobile Barcode /    │   │ Supabase Cloud      │
         │ (http://SHOP-PC:3000│   │ Intake Tablet       │   │ (Sync & Auth when   │
         │  or VITE_API_BASE)  │   │                     │   │  online)            │
         └─────────────────────┘   └─────────────────────┘   └─────────────────────┘
```

### Core Tenets:
1. **Zero-Latency Offline Execution**: Dexie / IndexedDB handles all active sales transactions, customer looks, stock management, and buy/pawn contract intakes immediately on the device without requiring network round-trips.
2. **Authoritative Local Server**: `server.ts` is the single source of truth for staff PIN authentication (PBKDF2-SHA512 hashing), secure role elevation, staff provisioning, market intelligence, and server-side asset storage.
3. **Cloud Synchronization**: When an internet connection is available, the sync engine replicates local transactional logs to Supabase via atomic, idempotent RPCs.
4. **Security Discipline**: `SUPABASE_SERVICE_ROLE_KEY` and Backblaze B2 credentials exist exclusively on the server and are never delivered to client browsers.

---

## 2. Release & Execution Commands

### A. Development Mode (Local Standalone)
Starts the Express server with live Vite middleware on `http://0.0.0.0:3000`:
```bash
npm run dev
```

### B. Production Server Mode
Compiles Vite frontend assets to `dist/`, bundles the backend into `dist/server.cjs`, and starts the production Node server:
```bash
npm run build
npm run start
```

### C. Desktop Electron Release Build
Compiles frontend, builds Electron main/preload processes, and generates authentic installers via `electron-builder`:
```bash
npm run build
npm run build:electron
npx electron-builder
```
*Generated Installers Location:* `release/`
- **Windows NSIS Setup**: `release/LocalMarket-POS-Setup-1.0.0.exe`
- **Windows Portable**: `release/LocalMarket-POS-Portable-1.0.0.exe`
- **Linux Debian Package**: `release/localmarket-pos_1.0.0_amd64.deb`

---

## 3. Network Access & LAN Configuration

| Endpoint | Access URL | Description |
| :--- | :--- | :--- |
| **Local Machine** | `http://127.0.0.1:3000` | Loopback access for primary workstation. |
| **LAN Devices** | `http://<SHOP-PC-IP>:3000` | Multi-till access across the shop Wi-Fi / Ethernet subnet. |
| **Health Check** | `http://<SHOP-PC-IP>:3000/api/health` | Authoritative JSON health and mode status. |

---

## 4. Key Workflows Verified for Release

1. **Staff Provisioning**: Owner/Manager generates new cashier profiles with 6-digit numeric PINs; server hashes the PIN using PBKDF2-SHA512 and stores `pin_hash` (`pin_code` is set to null).
2. **Account Switching**: Quick switch modal allows cashiers to authenticate with their 6-digit PIN; returns a genuine Supabase auth session.
3. **Offline POS Transactions**: Offline retail sales execute instantly in Dexie, mark items as `Sold`, queue sync operations, and replicate to Supabase idempotently when connectivity is restored.
4. **Hardware Integrations**: Integrated WebUSB/Serial barcode scanning, camera-based RSA ID barcode decoding, and ESC/POS thermal receipt printing.
