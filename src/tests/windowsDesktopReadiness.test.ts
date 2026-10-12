/**
 * Targeted tests for Windows Desktop Electron Readiness:
 * - Desktop Route-Aware API Routing (Cloud Vercel vs Local Express)
 * - Safe Upload Path Resolution on Windows Desktop (%APPDATA%\LocalMarket POS\uploads)
 * - electron-builder.json Configuration (Icons, Distinct Artifact Names, Required Assets)
 * - Electron Main Process Invariants (Single-Instance Lock, Error Recovery, Icon Resolution)
 */

import fs from 'fs';
import path from 'path';
import { resolveUploadRoot } from '../../server';
import { resolveApiUrl, isCloudRequiredRoute, CLOUD_REQUIRED_ROUTES, DEFAULT_PRODUCTION_CLOUD_ORIGIN } from '../utils/apiClient';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[AssertionFailed] ${message}`);
  }
}

export async function runWindowsDesktopReadinessTests() {
  console.log('====================================================');
  console.log('   RUNNING WINDOWS DESKTOP READINESS TEST SUITE     ');
  console.log('====================================================');

  // --- 1. Cloud vs Local Route Selection ---
  console.log('[Desktop Test 1] Verifying Cloud-required vs Local route definitions...');
  assert(CLOUD_REQUIRED_ROUTES.includes('/api/auth/login-with-pin'), 'PIN login must be cloud-required');
  assert(CLOUD_REQUIRED_ROUTES.includes('/api/auth/login-with-password'), 'Password login must be cloud-required');
  assert(CLOUD_REQUIRED_ROUTES.includes('/api/auth/setup-manager-password'), 'Manager setup must be cloud-required');
  assert(CLOUD_REQUIRED_ROUTES.includes('/api/verify-pin'), 'Manager PIN verification must be cloud-required');
  assert(CLOUD_REQUIRED_ROUTES.includes('/api/staff/provision'), 'Staff provision must be cloud-required');
  assert(CLOUD_REQUIRED_ROUTES.includes('/api/staff/update-profile'), 'Staff update profile must be cloud-required');
  assert(CLOUD_REQUIRED_ROUTES.includes('/api/staff/reset-pin'), 'Staff reset PIN must be cloud-required');
  assert(CLOUD_REQUIRED_ROUTES.includes('/api/staff/update-access'), 'Staff update access must be cloud-required');
  assert(CLOUD_REQUIRED_ROUTES.includes('/api/storage/upload'), 'Storage upload must be cloud-required');
  assert(CLOUD_REQUIRED_ROUTES.includes('/api/storage/delete'), 'Storage delete must be cloud-required');

  assert(!isCloudRequiredRoute('/api/health'), '/api/health must NEVER be cloud-required');
  assert(!isCloudRequiredRoute('/api/market-intelligence/check'), 'Market intelligence must stay local on Express');
  console.log('  ✔ Route classification matrix verified');

  // --- 2. Desktop Environment Route-Aware Dispatch ---
  console.log('[Desktop Test 2] Verifying Desktop environment route-aware dispatch...');
  const originalElectronAPI = (globalThis as any).electronAPI;
  try {
    (globalThis as any).electronAPI = { isDesktop: true };

    const cloudPinUrl = resolveApiUrl('/api/auth/login-with-pin');
    assert(
      cloudPinUrl === `${DEFAULT_PRODUCTION_CLOUD_ORIGIN}/api/auth/login-with-pin`,
      `Expected ${DEFAULT_PRODUCTION_CLOUD_ORIGIN}/api/auth/login-with-pin, got: ${cloudPinUrl}`
    );

    const cloudStaffUrl = resolveApiUrl('/api/staff/provision');
    assert(
      cloudStaffUrl === `${DEFAULT_PRODUCTION_CLOUD_ORIGIN}/api/staff/provision`,
      `Expected ${DEFAULT_PRODUCTION_CLOUD_ORIGIN}/api/staff/provision, got: ${cloudStaffUrl}`
    );

    const localHealth = resolveApiUrl('/api/health');
    assert(localHealth === '/api/health', `Local health check must remain relative, got: ${localHealth}`);

    const localIntel = resolveApiUrl('/api/market-intelligence/check');
    assert(localIntel === '/api/market-intelligence/check', `Local market intel must remain relative, got: ${localIntel}`);
    console.log('  ✔ Desktop routes correctly split: Cloud Vercel vs Local Express');
  } finally {
    (globalThis as any).electronAPI = originalElectronAPI;
  }

  // --- 3. Browser & LAN Mode Preservation ---
  console.log('[Desktop Test 3] Verifying Browser web & LAN mode preservation...');
  delete (globalThis as any).electronAPI;
  const webPinUrl = resolveApiUrl('/api/auth/login-with-pin');
  assert(webPinUrl === '/api/auth/login-with-pin', `Web browser PIN login must remain relative, got: ${webPinUrl}`);

  (globalThis as any).__LOCALMARKET_API_BASE_URL__ = 'http://192.168.1.100:3000';
  const lanPinUrl = resolveApiUrl('/api/auth/login-with-pin');
  assert(
    lanPinUrl === 'http://192.168.1.100:3000/api/auth/login-with-pin',
    `LAN multi-device mode must target custom LAN server, got: ${lanPinUrl}`
  );
  delete (globalThis as any).__LOCALMARKET_API_BASE_URL__;
  console.log('  ✔ Browser web and LAN modes preserved with zero regressions');

  // --- 4. Electron Safe Upload Storage Path on Windows ---
  console.log('[Desktop Test 4] Verifying safe upload root directory resolution...');
  const origElectronMain = process.env.IS_ELECTRON_MAIN;
  const origAppData = process.env.APPDATA;
  try {
    process.env.IS_ELECTRON_MAIN = 'true';
    process.env.APPDATA = 'C:\\Users\\ShopWorker\\AppData\\Roaming';

    const uploadRoot = resolveUploadRoot();
    if (process.platform === 'win32') {
      assert(
        uploadRoot === 'C:\\Users\\ShopWorker\\AppData\\Roaming\\LocalMarket POS\\uploads',
        `Expected Windows AppData upload path, got: ${uploadRoot}`
      );
    } else {
      assert(
        uploadRoot.includes('uploads') && !uploadRoot.startsWith(path.join(process.cwd(), 'public')),
        `Expected per-user application storage directory, got: ${uploadRoot}`
      );
    }
    console.log(`  ✔ Safe upload path resolved: ${uploadRoot}`);
  } finally {
    process.env.IS_ELECTRON_MAIN = origElectronMain;
    process.env.APPDATA = origAppData;
  }

  // --- 5. electron-builder.json Configuration ---
  console.log('[Desktop Test 5] Auditing electron-builder.json packaging specification...');
  const builderConfigPath = path.resolve('electron-builder.json');
  assert(fs.existsSync(builderConfigPath), 'electron-builder.json must exist');
  const builderConfig = JSON.parse(fs.readFileSync(builderConfigPath, 'utf8'));

  assert(builderConfig.files.includes('public/**/*'), 'electron-builder.json files must include public/**/*');
  assert(builderConfig.files.includes('dist/**/*'), 'electron-builder.json files must include dist/**/*');
  assert(builderConfig.files.includes('dist-electron/**/*'), 'electron-builder.json files must include dist-electron/**/*');

  assert(builderConfig.win?.icon === 'build/icon.ico', 'Windows icon must be set to build/icon.ico');
  assert(
    builderConfig.nsis?.artifactName === 'LocalMarket-POS-Setup-${version}.${ext}',
    'NSIS installer must have distinct filename'
  );
  assert(
    builderConfig.portable?.artifactName === 'LocalMarket-POS-Portable-${version}.${ext}',
    'Portable executable must have distinct filename'
  );
  console.log('  ✔ electron-builder.json verified (assets included, distinct NSIS and Portable filenames)');

  // --- 6. Icon File Integrity ---
  console.log('[Desktop Test 6] Verifying authentic icon files exist...');
  assert(fs.existsSync('build/icon.ico'), 'build/icon.ico must exist');
  assert(fs.existsSync('build/icon.png'), 'build/icon.png must exist');
  assert(fs.existsSync('public/icon.png'), 'public/icon.png must exist');
  assert(fs.existsSync('public/icon.ico'), 'public/icon.ico must exist');
  assert(fs.statSync('build/icon.ico').size > 0, 'build/icon.ico must be non-empty');
  assert(fs.statSync('public/icon.png').size > 0, 'public/icon.png must be non-empty');
  console.log('  ✔ All required PNG and ICO icon assets verified');

  // --- 7. electron/main.ts Single-Instance Lock and Icon Audit ---
  console.log('[Desktop Test 7] Auditing electron/main.ts source for single-instance & clean lifecycle...');
  const electronMainSrc = fs.readFileSync('electron/main.ts', 'utf8');
  assert(
    electronMainSrc.includes('app.requestSingleInstanceLock()'),
    'electron/main.ts must acquire single-instance lock'
  );
  assert(
    electronMainSrc.includes('app.on(\'second-instance\''),
    'electron/main.ts must handle second-instance event'
  );
  assert(
    electronMainSrc.includes('resolveAppIcon()'),
    'electron/main.ts must resolve icon path safely'
  );
  assert(
    electronMainSrc.includes('embeddedServer.close()'),
    'electron/main.ts must gracefully close embedded server'
  );
  console.log('  ✔ electron/main.ts single-instance and lifecycle invariants verified');

  console.log('====================================================');
  console.log('   ALL WINDOWS DESKTOP READINESS TESTS PASSED!      ');
  console.log('====================================================');
}
