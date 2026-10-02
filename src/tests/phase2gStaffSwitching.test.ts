import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Phase 2G Human Staff Switching UX Test Suite
 */
export function runPhase2gStaffSwitchingTests() {
  console.log('=== RUNNING PHASE 2G HUMAN STAFF SWITCHING UX TEST SUITE ===');

  const accountPickerPath = path.join(process.cwd(), 'src/components/auth/AccountPicker.tsx');
  const accountPickerSrc = fs.readFileSync(accountPickerPath, 'utf8');

  // --- Test A & F — Staff Selection & Owner Protection ---
  assert(
    accountPickerSrc.includes("Switch Staff"),
    'AccountPicker must display "Switch Staff" title'
  );
  assert(
    accountPickerSrc.includes("Choose the staff member using this counter"),
    'AccountPicker must display human-friendly subtitle'
  );
  assert(
    accountPickerSrc.includes("staff.role === 'owner'"),
    'Owner selection logic must be preserved for logout/login flow'
  );
  console.log('[PASS] Test A & F: Staff selection and Owner protection logic verified');

  // --- Test B — PIN Requirement (6-digit) ---
  assert(
    accountPickerSrc.includes("pin.length !== 6") && accountPickerSrc.includes("Enter your 6-digit PIN"),
    'PIN requirement must strictly enforce 6 digits with human wording'
  );
  console.log('[PASS] Test B: 6-digit PIN requirement and copy verified');

  // --- Test C — Lockout ---
  assert(
    accountPickerSrc.includes("Please try again when the timer ends.") &&
    accountPickerSrc.includes("Try again in"),
    'Lockout message must use human wording'
  );
  console.log('[PASS] Test C: Lockout message and timer presentation verified');

  // --- Test D & E — Recovery & Cancel ---
  assert(
    accountPickerSrc.includes("Try Again") && accountPickerSrc.includes("Sign Out"),
    'Error recovery buttons must use "Try Again" and "Sign Out"'
  );
  assert(
    accountPickerSrc.includes("Cancel") && !accountPickerSrc.includes("Cancel & return to terminal"),
    'Cancel button must use simplified "Cancel" wording'
  );
  console.log('[PASS] Test D & E: Recovery and Cancel button copy verified');

  // --- Test G — Human Language vs Technical Terms Absence ---
  assert(!accountPickerSrc.includes("Switch Account"), 'Old technical title must be removed');
  assert(!accountPickerSrc.includes("Choose who is using this terminal"), 'Old technical subtitle must be removed');
  assert(!accountPickerSrc.includes("Authorizing terminal access"), 'Technical terminal auth message must be removed');
  assert(!accountPickerSrc.includes("Loading operator profile"), 'Technical operator message must be removed');
  assert(!accountPickerSrc.includes("Securing this terminal"), 'Technical securing message must be removed');
  assert(!accountPickerSrc.includes("Authorize Terminal"), 'Technical authorize button must be removed');
  assert(accountPickerSrc.includes("Continue"), 'Button must use "Continue"');
  assert(accountPickerSrc.includes("Checking PIN…"), 'Progress message must use "Checking PIN…"');
  assert(accountPickerSrc.includes("Ready."), 'Progress message must use "Ready."');

  console.log('[PASS] Test G: Human language contract strictly enforced and technical terminology absent');
  console.log('====================================================');
  console.log('   ALL PHASE 2G HUMAN STAFF SWITCHING TESTS PASSED!');
  console.log('====================================================');
}
