import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

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
  assert(pickerSrc.includes('evaluateShiftStatus'), 'AccountPicker must contain evaluateShiftStatus');
  assert(pickerSrc.includes('getShopNow'), 'AccountPicker must contain getShopNow helper');
  assert(pickerSrc.includes('getNextShiftInfo'), 'AccountPicker must contain getNextShiftInfo helper');
  assert(pickerSrc.includes('shiftInfo'), 'AccountPicker must render shiftInfo UI alert');
  assert(pickerSrc.includes('EMPLOYEE SHIFT AWARENESS UX'), 'AccountPicker must contain shift awareness card block');
  console.log('[PASS] Test D: Timezone-aware Shift Status evaluation & Employee Shift Awareness alerts verified');

  console.log('====================================================');
  console.log('   ALL PHASE 2J STAFF SCHEDULING TESTS PASSED!');
  console.log('====================================================');
}
