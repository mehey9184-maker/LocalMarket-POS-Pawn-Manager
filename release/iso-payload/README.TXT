LOCALMARKET POS & PAWN MANAGER - RELEASE v1.0.0
============================================================
Hybrid Retail POS, Second-Hand Goods Intake, Pawn Loan Manager,
Vault Stockroom Management, and SAPS Compliance Register.

DISTRIBUTION MEDIA CONTENTS:
- SETUP.EXE         : Windows NSIS Standalone Setup Installer
- PORTABLE.EXE      : Windows Portable Single-Executable
- LOCALMARKET.DEB   : Linux Debian / Ubuntu Package
- INSTALL.BAT       : Windows Terminal Quick-Install Launcher
- INSTALL.SH        : Linux Terminal Quick-Install Launcher
- AUTORUN.INF       : Optical / USB Autoplay Configuration
- SHA256SUMS.TXT    : Cryptographic Integrity Verification

SYSTEM REQUIREMENTS:
- Minimum OS: Windows 10/11 (64-bit) or Ubuntu/Debian 20.04+ (x64)
- RAM: 4 GB minimum (8 GB recommended for heavy vault caching)
- Storage: 500 MB free space
- Screen Resolution: 1024x768 minimum (1366x768 recommended)
- Hardware: USB/Bluetooth Barcode Scanner (Native BarcodeDetector / ZXing),
  ESC/POS Thermal Receipt Printer (58mm or 80mm).

OFFLINE CAPABILITY:
LocalMarket includes an embedded Dexie & SQLite caching engine.
All Cashier Sales, Buy/Pawn intakes, and Form 21 entries can be
performed offline with zero latency, and will automatically synchronize
with authoritative atomic Supabase RPCs once reconnected.

(c) 2026 LocalMarket Engineering. All rights reserved.
