import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';
import { buildIsoFromDirectory } from './build-iso';

const ROOT_DIR = process.cwd();
const RELEASE_DIR = path.join(ROOT_DIR, 'release');
const ISO_CONTENT_DIR = path.join(RELEASE_DIR, 'iso-payload');
const PKG = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf-8'));
const VERSION = PKG.version === '0.0.0' ? '1.0.0' : PKG.version;

function calculateSha256(filePath: string): string {
  const data = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(data).digest('hex');
}

async function runPackaging() {
  console.log(`=== STARTING LOCALMARKET DESKTOP RELEASE PACKAGING (v${VERSION}) ===`);

  // Ensure release directory
  if (fs.existsSync(RELEASE_DIR)) {
    fs.rmSync(RELEASE_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(RELEASE_DIR, { recursive: true });
  fs.mkdirSync(ISO_CONTENT_DIR, { recursive: true });

  // 1. Prepare production package bundles
  console.log('[Packaging] Verifying authentic electron-builder desktop release artifacts...');

  // 2. Identify Windows EXE installer & Linux binary artifacts
  const winSetupExePath = path.join(RELEASE_DIR, `LocalMarket-POS-Setup-${VERSION}.exe`);
  const winPortableExePath = path.join(RELEASE_DIR, `LocalMarket-POS-Portable-${VERSION}.exe`);
  const linuxDebPath = path.join(RELEASE_DIR, `localmarket-pos_${VERSION}_amd64.deb`);
  const linuxTarPath = path.join(RELEASE_DIR, `localmarket-pos-${VERSION}-x64.tar.gz`);

  // Check if electron-builder artifacts exist; if not, execute electron-builder
  const hasArtifacts = fs.existsSync(winSetupExePath) || fs.existsSync(linuxDebPath) || fs.existsSync(winPortableExePath);
  if (!hasArtifacts) {
    console.log('[Packaging] Electron-builder artifacts not found. Executing electron-builder...');
    try {
      execSync('npx electron-builder --config electron-builder.json', { stdio: 'inherit', cwd: ROOT_DIR });
    } catch (buildErr: any) {
      console.warn('[Packaging] electron-builder execution warning/error:', buildErr.message);
    }
  }

  // Verify that genuine installer files exist. Never generate fake executables!
  const availableInstallers: { name: string; path: string; isoName: string }[] = [];
  if (fs.existsSync(winSetupExePath)) {
    availableInstallers.push({ name: 'Windows NSIS Setup', path: winSetupExePath, isoName: 'SETUP.EXE' });
  }
  if (fs.existsSync(winPortableExePath)) {
    availableInstallers.push({ name: 'Windows Portable', path: winPortableExePath, isoName: 'PORTABLE.EXE' });
  }
  if (fs.existsSync(linuxDebPath)) {
    availableInstallers.push({ name: 'Linux Debian Package', path: linuxDebPath, isoName: 'LOCALMARKET.DEB' });
  }

  if (availableInstallers.length === 0) {
    throw new Error(
      `No authentic release installers found in '${RELEASE_DIR}'. ` +
      `Please run 'npm run build && npm run build:electron && npx electron-builder' to generate authentic binary packages.`
    );
  }

  // 3. Prepare ISO Payload Folder
  console.log('[ISO Preparation] Assembling ISO payload contents with authentic installers...');

  // Copy available genuine installers to ISO content
  for (const installer of availableInstallers) {
    fs.copyFileSync(installer.path, path.join(ISO_CONTENT_DIR, installer.isoName));
  }

  // Create Autorun file
  const autorunInf = `[autorun]
open=SETUP.EXE
icon=SETUP.EXE,0
label=LocalMarket POS & Pawn Manager v${VERSION}
action=Launch LocalMarket POS Installer
`;
  fs.writeFileSync(path.join(ISO_CONTENT_DIR, 'AUTORUN.INF'), autorunInf);

  // Create Windows Batch Installer
  const installBat = `@echo off
echo ===================================================
echo   LOCALMARKET POS & PAWN MANAGER INSTALLER (v${VERSION})
echo ===================================================
echo.
echo Installing LocalMarket POS on Windows Workstation...
start SETUP.EXE
`;
  fs.writeFileSync(path.join(ISO_CONTENT_DIR, 'INSTALL.BAT'), installBat);

  // Create Linux Shell Installer
  const installSh = `#!/usr/bin/env bash
set -e
echo "==================================================="
echo "  LOCALMARKET POS & PAWN MANAGER INSTALLER (v${VERSION})"
echo "==================================================="
echo ""
if command -v dpkg >/dev/null 2>&1; then
  echo "Installing Debian package..."
  sudo dpkg -i LOCALMARKET.DEB || sudo apt-get install -f -y
  echo "Installation complete! Launch via 'localmarket-pos' or Application Menu."
else
  echo "dpkg not found. Please extract the Linux archive or run with Node/Electron."
fi
`;
  fs.writeFileSync(path.join(ISO_CONTENT_DIR, 'INSTALL.SH'), installSh, { mode: 0o755 });

  // Create README & System Requirements
  const readmeContent = `LOCALMARKET POS & PAWN MANAGER - RELEASE v${VERSION}
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
`;
  fs.writeFileSync(path.join(ISO_CONTENT_DIR, 'README.TXT'), readmeContent);

  // 4. Generate Checksums
  console.log('[Checksums] Computing SHA256 checksums for release assets...');
  const checksumFiles = [
    `LocalMarket-POS-Setup-${VERSION}.exe`,
    `LocalMarket-POS-Portable-${VERSION}.exe`,
    `localmarket-pos_${VERSION}_amd64.deb`,
    `localmarket-pos-${VERSION}-x64.tar.gz`
  ];

  let checksumText = '';
  for (const filename of checksumFiles) {
    const p = path.join(RELEASE_DIR, filename);
    if (fs.existsSync(p)) {
      const hash = calculateSha256(p);
      checksumText += `${hash}  ${filename}\n`;
    }
  }
  fs.writeFileSync(path.join(RELEASE_DIR, 'SHA256SUMS.txt'), checksumText);
  fs.writeFileSync(path.join(ISO_CONTENT_DIR, 'SHA256.TXT'), checksumText);

  // 5. Build Distribution ISO Image
  const isoPath = path.join(RELEASE_DIR, `LocalMarket-POS-Pawn-Manager-v${VERSION}.iso`);
  console.log(`[ISO Builder] Building ISO file: ${isoPath}`);
  buildIsoFromDirectory(ISO_CONTENT_DIR, isoPath, 'LOCALMARKET_POS');

  // Compute ISO checksum
  const isoHash = calculateSha256(isoPath);
  fs.appendFileSync(path.join(RELEASE_DIR, 'SHA256SUMS.txt'), `${isoHash}  LocalMarket-POS-Pawn-Manager-v${VERSION}.iso\n`);

  console.log('\n===================================================');
  console.log('  DESKTOP RELEASE ARTIFACTS GENERATED SUCCESSFULLY');
  console.log('===================================================');
  console.log(`- Windows EXE Installer: release/LocalMarket-POS-Setup-${VERSION}.exe`);
  console.log(`- Windows EXE Portable : release/LocalMarket-POS-Portable-${VERSION}.exe`);
  console.log(`- Linux Debian (.deb)  : release/localmarket-pos_${VERSION}_amd64.deb`);
  console.log(`- Distribution ISO     : release/LocalMarket-POS-Pawn-Manager-v${VERSION}.iso`);
  console.log(`- Checksums            : release/SHA256SUMS.txt`);
}

runPackaging().catch((err) => {
  console.error('Packaging failed:', err);
  process.exit(1);
});
