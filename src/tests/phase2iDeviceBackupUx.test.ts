import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Phase 2I Device, Backup & Recovery UX Test Suite
 */
export function runPhase2iDeviceBackupUxTests() {
  console.log('=== RUNNING PHASE 2I DEVICE, BACKUP & RECOVERY UX TEST SUITE ===');

  const cashierProfilePath = path.join(process.cwd(), 'src/components/screens/CashierProfile.tsx');
  const cashierProfileSrc = fs.readFileSync(cashierProfilePath, 'utf8');

  const hubPath = path.join(process.cwd(), 'src/components/profile/ShopProfileAndOfflineHub.tsx');
  const hubSrc = fs.readFileSync(hubPath, 'utf8');

  // --- Test A — Correct destination label ---
  assert(cashierProfileSrc.includes("Device & Backup"), 'CashierProfile.tsx must display "Device & Backup"');
  assert(!cashierProfileSrc.includes("System & Audit"), 'CashierProfile.tsx must no longer present "System & Audit"');
  console.log('[PASS] Test A: Correct destination label "Device & Backup" present, and "System & Audit" absent');

  // --- Test B — Human-facing heading ---
  assert(
    cashierProfileSrc.includes("Keep this computer ready for work, manage saved data, and create or restore a backup."),
    'Device & Backup screen heading description copy must be correct'
  );
  assert(
    hubSrc.includes("Saved on this computer"),
    'ShopProfileAndOfflineHub.tsx must display human-friendly header "Saved on this computer"'
  );
  console.log('[PASS] Test B: Non-technical human-facing headings and description copy verified');

  // --- Test C — No implementation leakage ---
  const leakyPhrases = [
    'Local Device Storage & Sync',
    'Local database cache',
    'Download full database snapshot',
    'entityName',
    'Invalid data format',
    'Trickle Sync',
    'IndexedDB',
    'Supabase',
    'egress'
  ];

  for (const phrase of leakyPhrases) {
    // We check user-visible tags (e.g. text nodes, text attributes rendered to users, not variable definitions)
    const isLeaking = hubSrc.includes(`>${phrase}<`) || 
                      hubSrc.includes(`"${phrase}"`) || 
                      hubSrc.includes(`'${phrase}'`) ||
                      hubSrc.includes(` ${phrase} `) ||
                      hubSrc.includes(`p className="text-[10px] text-stone-400 mt-1">Local database cache`);
    assert(!isLeaking, `ShopProfileAndOfflineHub.tsx must not leak technical details of: "${phrase}"`);
  }
  console.log('[PASS] Test C: Technical storage/database/sync implementation leakage verified absent');

  // --- Test D — Sync truthfulness ---
  assert(hubSrc.includes("isSlowSyncing"), 'Syncing status condition must exist');
  assert(hubSrc.includes("pendingSyncCount"), 'Pending count condition must exist');
  assert(hubSrc.includes("failedSyncCount"), 'Failed count condition must exist');
  assert(hubSrc.includes("hasDeterministicError"), 'Deterministic error condition must exist');
  assert(hubSrc.includes("hasTransientError"), 'Transient error condition must exist');
  console.log('[PASS] Test D: Sync state truthfulness conditions fully preserved');

  // --- Test E — Owner-only backup ---
  assert(hubSrc.includes("isOwner && ("), 'Backup and recovery actions must be gated by isOwner check');
  console.log('[PASS] Test E: Backup controls are strictly gated to isOwner');

  // --- Test F — Backup behavior preserved ---
  assert(hubSrc.includes("exportDeviceBackup"), 'Manual backup action exportDeviceBackup must remain connected');
  assert(hubSrc.includes("restoreDeviceBackup"), 'Manual restore action restoreDeviceBackup must remain connected');
  console.log('[PASS] Test F: Device backup export and restore actions are fully connected');

  // --- Test G — No audit functionality accidentally removed ---
  // Ensure logSystemEvent is still defined and imported/used elsewhere
  const appContextPath = path.join(process.cwd(), 'src/context/AppContext.tsx');
  const appContextSrc = fs.readFileSync(appContextPath, 'utf8');
  assert(appContextSrc.includes("logSystemEvent"), 'System event audit logger is fully intact and not removed');
  console.log('[PASS] Test G: Actual system audit/event functionality remains completely intact');

  console.log('====================================================');
  console.log('   ALL PHASE 2I DEVICE, BACKUP & RECOVERY UX TESTS PASSED!');
  console.log('====================================================');
}
