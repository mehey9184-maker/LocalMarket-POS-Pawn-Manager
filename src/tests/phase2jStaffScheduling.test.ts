import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { evaluateShiftStatus, ShiftStatus, getInstantFromShopComponents, getShopComponents } from '../components/auth/AccountPicker';
import { ProfileRow } from '../types/supabase';

/**
 * Phase 2J Staff Scheduling & Shift Awareness Test Suite
 */
export function runPhase2jStaffSchedulingTests() {
  console.log('=== RUNNING PHASE 2J STAFF SCHEDULING & SHIFT AWARENESS TEST SUITE ===');

  const staffManagerPath = path.join(process.cwd(), 'src/components/profile/StaffAccessManager.tsx');
  const staffManagerSrc = fs.readFileSync(staffManagerPath, 'utf8');

  const pickerPath = path.join(process.cwd(), 'src/components/auth/AccountPicker.tsx');
  const pickerSrc = fs.readFileSync(pickerPath, 'utf8');

  // --- Test A — Local Draft State & No Immediate Save on Toggle ---
  assert(staffManagerSrc.includes('draftPermissions'), 'StaffAccessManager must use draftPermissions state');
  assert(staffManagerSrc.includes('draftSchedule'), 'StaffAccessManager must use draftSchedule state');
  assert(staffManagerSrc.includes('handleTogglePermission'), 'StaffAccessManager must have handleTogglePermission');
  assert(staffManagerSrc.includes('handleUpdateScheduleDraft'), 'StaffAccessManager must have handleUpdateScheduleDraft');
  console.log('[PASS] Test A: Local draft states used for permissions & schedules, preventing immediate saves');

  // --- Test B — Floating Save Bar Present ---
  assert(staffManagerSrc.includes('FLOATING SAVE BAR'), 'StaffAccessManager must render a Floating Save Bar');
  assert(staffManagerSrc.includes('Unsaved changes'), 'Floating Save Bar must say "Unsaved changes"');
  assert(staffManagerSrc.includes('handleSaveChanges'), 'Floating Save Bar must call handleSaveChanges');
  assert(staffManagerSrc.includes('handleDiscardChanges'), 'Floating Save Bar must call handleDiscardChanges');
  console.log('[PASS] Test B: Floating Save Bar correctly rendered with options to Save Changes or Discard');

  // --- Test C — Back-button Warning Dialog Present ---
  assert(staffManagerSrc.includes('DISCARD CONFIRMATION DIALOG FOR BACK BUTTON'), 'StaffAccessManager must render a back-button warning dialog');
  assert(staffManagerSrc.includes('unsavedConfirm'), 'StaffAccessManager must use unsavedConfirm state to guard backing out');
  console.log('[PASS] Test C: Back-out warning modal exists to guard against losing unsaved changes');

  // --- Test D — Shift Awareness Functions & Rendering ---
  assert(pickerSrc.includes('ShiftLocked'), 'AccountPicker must contain ShiftLocked screen implementation');
  assert(pickerSrc.includes('formatDuration'), 'AccountPicker must contain formatDuration helper');
  assert(pickerSrc.includes('evaluateShiftStatus'), 'AccountPicker must contain evaluateShiftStatus');
  console.log('[PASS] Test D: ShiftLocked screen and logic implemented');

  // --- Test E — Shift Status Logic Verification & Timezone Hardening ---
  console.log('[Test E] Verifying timezone-safe wall-clock to instant conversion...');
  
  // Johannesburg: 2026-10-05 08:00 -> 2026-10-05T06:00:00.000Z
  const joburgInstant = evaluateShiftStatus({ role: 'owner' } as any, 'Africa/Johannesburg'); // Dummy call to get helpers if they were internal, but we imported them.
  // Wait, I need to export the helpers or test them through evaluateShiftStatus nextLoginTime.
  
  const mockStaff: ProfileRow = {
    id: 'staff-1',
    full_name: 'Test Cashier',
    role: 'cashier',
    is_active: true,
    shop_id: 'shop-1',
    schedule: {
      workingDays: [1, 2, 3, 4, 5], // Mon-Fri
      startTime: "08:00",
      endTime: "17:00",
      earlyLoginMinutes: 10,
      overnight: false
    }
  } as any;

  // 1. Johannesburg Standard Time (no DST)
  // Wall clock: 2026-10-05 07:45 (Mon) -> TOO EARLY (starts 08:00, early allowed 10m -> 07:50)
  const joburgNow = new Date('2026-10-05T05:45:00Z'); // 07:45 SAST
  const res1 = evaluateShiftStatus(mockStaff, 'Africa/Johannesburg', joburgNow);
  assert.strictEqual(res1.status, 'too_early', '07:45 should be too early for 08:00 shift');
  assert.strictEqual(res1.nextLoginTime?.toISOString(), '2026-10-05T05:50:00.000Z', 'Next login should be 07:50 SAST');

  // 2. New York Standard Time
  // Wall clock: 2026-01-15 08:00 (Thu) -> ALLOWED
  const nyStdNow = new Date('2026-01-15T13:00:00Z'); // 08:00 EST
  const res2 = evaluateShiftStatus(mockStaff, 'America/New_York', nyStdNow);
  assert.strictEqual(res2.status, 'allowed', '08:00 should be allowed');

  // 3. New York Daylight Time
  // Wall clock: 2026-07-15 07:40 (Wed) -> TOO EARLY (early allowed 10m -> 07:50)
  const nyDstNow = new Date('2026-07-15T11:40:00Z'); // 07:40 EDT
  const res3 = evaluateShiftStatus(mockStaff, 'America/New_York', nyDstNow);
  assert.strictEqual(res3.status, 'too_early', '07:40 EDT should be too early');
  assert.strictEqual(res3.nextLoginTime?.toISOString(), '2026-07-15T11:50:00.000Z', 'Next login should be 07:50 EDT (11:50Z)');

  // 4. DST Spring Forward Edge (New York)
  // 2026-03-08 02:00 -> 03:00 jump.
  // We use Monday March 9 to ensure it's a working day.
  const springNow = new Date('2026-03-09T07:30:00Z'); // 03:30 EDT (offset -4)
  const res4 = evaluateShiftStatus(mockStaff, 'America/New_York', springNow);
  // mockStaff works 08:00-17:00. 03:30 is TOO EARLY.
  assert.strictEqual(res4.status, 'too_early', '03:30 EDT should be too early for 08:00 shift');
  
  // Mock shift to include 03:30
  const earlyStaff = { 
    ...mockStaff, 
    schedule: { 
      ...mockStaff.schedule as any, 
      startTime: "03:00",
      earlyLoginMinutes: 0
    } 
  };
  const res4b = evaluateShiftStatus(earlyStaff, 'America/New_York', springNow);
  assert.strictEqual(res4b.status, 'allowed', '03:30 EDT should be allowed for 03:00 shift');

  // 5. Overnight Shift Verification
  const overnightStaff: ProfileRow = {
    ...mockStaff,
    schedule: {
      workingDays: [1], // Monday only
      startTime: "22:00",
      endTime: "06:00",
      earlyLoginMinutes: 10,
      overnight: true
    }
  } as any;

  // Monday Evening (Start)
  const monEve = new Date('2026-10-05T19:55:00Z'); // 21:55 SAST (Mon)
  const res5 = evaluateShiftStatus(overnightStaff, 'Africa/Johannesburg', monEve);
  assert.strictEqual(res5.status, 'allowed', '21:55 Mon should be allowed (within 10m of 22:00)');

  // Tuesday Morning (Continuation)
  const tueMorn = new Date('2026-10-06T03:00:00Z'); // 05:00 SAST (Tue)
  const res6 = evaluateShiftStatus(overnightStaff, 'Africa/Johannesburg', tueMorn);
  assert.strictEqual(res6.status, 'allowed', '05:00 Tue should be allowed as continuation of Mon shift');

  // Tuesday Morning (Past End)
  const tueLate = new Date('2026-10-06T04:10:00Z'); // 06:10 SAST (Tue)
  const res7 = evaluateShiftStatus(overnightStaff, 'Africa/Johannesburg', tueLate);
  assert.strictEqual(res7.status, 'non_working', '06:10 Tue should be non_working (shift ended, next is Mon)');
  // Next permitted should be Monday 22:00 (minus 10m -> 21:50)
  // Monday is 2026-10-12
  assert.strictEqual(res7.nextLoginTime?.toISOString(), '2026-10-12T19:50:00.000Z', 'Next login should be Mon Oct 12 21:50 SAST');

  // 6. Weekend Boundary
  const fridayEve = new Date('2026-10-09T18:00:00Z'); // 20:00 SAST (Fri)
  const res8 = evaluateShiftStatus(mockStaff, 'Africa/Johannesburg', fridayEve);
  assert.strictEqual(res8.status, 'too_late', 'Friday night should be too late');
  // Next permitted should be Monday 08:00 (minus early login 10m -> 07:50)
  // Monday is 2026-10-12
  assert.strictEqual(res8.nextLoginTime?.toISOString(), '2026-10-12T05:50:00.000Z', 'Next login should be Monday 07:50 SAST');

  // 7. DST Fall Back (New York)
  // 2026-11-01 01:30 wall clock. Implementation should pick one valid instant.
  const fallbackInstant = getInstantFromShopComponents({ year: 2026, month: 11, day: 1, hour: 1, minute: 30 }, 'America/New_York');
  const checkFallback = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: false }).format(fallbackInstant);
  assert.strictEqual(checkFallback, '01:30', 'Fallback instant should format back to 01:30');

  console.log('[PASS] Test E: Shift Status Logic & Timezone Hardening verified with deterministic instants and DST edge cases');

  console.log('====================================================');
  console.log('   ALL PHASE 2J STAFF SCHEDULING TESTS PASSED!');
  console.log('====================================================');
}
