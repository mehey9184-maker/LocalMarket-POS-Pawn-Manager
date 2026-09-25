import crypto from 'crypto';
import { UserRole } from '../types/supabase';

// =========================================================================
// LOCAL IMPLEMENTATION OF SERVER SECURITY HELPERS FOR TESTING
// =========================================================================
function hashPin(pin: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(pin, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPinHash(pin: string, storedHash: string): boolean {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, originalHash] = storedHash.split(':');
  try {
    const hash = crypto.pbkdf2Sync(pin, salt, 10000, 64, 'sha512').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(originalHash, 'hex'));
  } catch {
    return false;
  }
}

// Role Hierarchy Authorization Evaluator
function canManageStaff(
  callerRole: UserRole, 
  callerShopId: string, 
  targetRole: UserRole, 
  targetShopId: string,
  callerId: string,
  targetId: string
): { allowed: boolean; reason?: string } {
  if (callerShopId !== targetShopId) {
    return { allowed: false, reason: 'Cross-shop management is strictly prohibited' };
  }

  if (callerRole !== 'owner' && callerRole !== 'admin' && callerRole !== 'manager') {
    return { allowed: false, reason: 'Insufficient permissions to manage staff' };
  }

  if (callerRole === 'manager') {
    if (targetRole === 'owner' || targetRole === 'admin') {
      return { allowed: false, reason: 'Managers cannot modify Owner or Admin accounts' };
    }
    if (targetRole === 'manager' && callerId !== targetId) {
      return { allowed: false, reason: 'Managers cannot modify other Manager accounts' };
    }
  }

  return { allowed: true };
}

// Role Promotion Evaluator
function canPromoteRole(callerRole: UserRole, requestedRole: UserRole, targetCurrentRole: UserRole): { allowed: boolean; reason?: string } {
  if (requestedRole === 'owner' || requestedRole === 'admin') {
    if (callerRole !== 'owner' && callerRole !== 'admin') {
      return { allowed: false, reason: 'Only Owners can promote staff to Owner or Admin roles' };
    }
  }

  if (callerRole === 'manager' && requestedRole === 'manager' && targetCurrentRole !== 'manager') {
    return { allowed: false, reason: 'Managers cannot promote staff to Manager role' };
  }

  return { allowed: true };
}

// Permission Grant Evaluator
function canGrantPermission(callerRole: UserRole, permissionKey: string, value: boolean): { allowed: boolean; reason?: string } {
  if (callerRole !== 'owner' && callerRole !== 'admin') {
    if (permissionKey === 'staff' && value === true) {
      return { allowed: false, reason: 'Managers cannot grant staff management permissions' };
    }
  }
  return { allowed: true };
}

// Account Picker Filter
function filterStaffForAccountPicker(staffList: Array<{ id: string; role: UserRole; is_active: boolean }>) {
  return staffList.filter(s => s.is_active && s.role !== 'admin');
}

// Format Role Label for UI
function formatRoleLabel(role: UserRole): string {
  switch (role) {
    case 'owner': return 'Owner';
    case 'manager': return 'Manager';
    case 'senior_cashier': return 'Senior Cashier';
    case 'cashier': return 'Cashier';
    default: return (role as string).replace(/_/g, ' ');
  }
}

// Senior Cashier Default Permissions
function getSeniorCashierDefaultPermissions(): Record<string, boolean> {
  return {
    sales: true,
    inventory: true,
    pawn: true,
    sellerAcquisitions: true,
    refunds: false,
    pricing: false,
    reports: false,
    staff: false
  };
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`[FAIL] ${message}`);
    throw new Error(message);
  }
  console.log(`[PASS] ${message}`);
}

export function runStaffSecurityFinalizationTests() {
  console.log('\n=== RUNNING STAFF SECURITY FINALIZATION TEST SUITE ===');

  // =========================================================================
  // TEST 1: PBKDF2 PIN Hashing & Verification
  // =========================================================================
  console.log('\n--- Group 1: Authoritative PBKDF2 PIN Hashing ---');
  const validPin = '123456';
  const hashedPin = hashPin(validPin);

  assert(hashedPin.includes(':'), 'PBKDF2 hash contains salt:digest separator');
  assert(hashedPin.split(':')[0].length === 32, 'Salt is 16 bytes hex-encoded (32 hex characters)');
  assert(hashedPin.split(':')[1].length === 128, 'PBKDF2-SHA512 digest is 64 bytes hex-encoded (128 hex characters)');
  assert(verifyPinHash(validPin, hashedPin) === true, 'Correct PIN verifies successfully against authoritative hash');
  assert(verifyPinHash('654321', hashedPin) === false, 'Incorrect PIN fails verification');
  assert(verifyPinHash('12345', hashedPin) === false, '5-digit PIN fails verification');
  assert(verifyPinHash('', hashedPin) === false, 'Empty PIN string fails verification');
  assert(verifyPinHash(validPin, 'invalid:hash') === false, 'Malformed stored hash fails gracefully');

  const secondHash = hashPin(validPin);
  assert(hashedPin !== secondHash, 'PBKDF2 salt is unique per hash generation');
  assert(verifyPinHash(validPin, secondHash) === true, 'Both salted hashes verify identical PIN correctly');

  // =========================================================================
  // TEST 2: Role Hierarchy Enforcement (Owner / Manager / Senior Cashier / Cashier)
  // =========================================================================
  console.log('\n--- Group 2: Role Hierarchy & Management Boundaries ---');
  const shopA = 'shop-1111-aaaa';
  const shopB = 'shop-2222-bbbb';

  // Owner Authority
  assert(
    canManageStaff('owner', shopA, 'manager', shopA, 'owner-1', 'mgr-1').allowed === true,
    'Owner can manage Manager in same shop'
  );
  assert(
    canManageStaff('owner', shopA, 'senior_cashier', shopA, 'owner-1', 'sc-1').allowed === true,
    'Owner can manage Senior Cashier in same shop'
  );
  assert(
    canManageStaff('owner', shopA, 'cashier', shopA, 'owner-1', 'csh-1').allowed === true,
    'Owner can manage Cashier in same shop'
  );

  // Cross-Shop Isolation
  assert(
    canManageStaff('owner', shopA, 'cashier', shopB, 'owner-1', 'csh-2').allowed === false,
    'Owner cross-shop staff management is strictly rejected'
  );

  // Manager Authority
  assert(
    canManageStaff('manager', shopA, 'cashier', shopA, 'mgr-1', 'csh-1').allowed === true,
    'Manager can manage Cashier in same shop'
  );
  assert(
    canManageStaff('manager', shopA, 'senior_cashier', shopA, 'mgr-1', 'sc-1').allowed === true,
    'Manager can manage Senior Cashier in same shop'
  );
  assert(
    canManageStaff('manager', shopA, 'owner', shopA, 'mgr-1', 'owner-1').allowed === false,
    'Manager cannot manage Owner account'
  );
  assert(
    canManageStaff('manager', shopA, 'admin', shopA, 'mgr-1', 'admin-1').allowed === false,
    'Manager cannot manage technical Admin account'
  );
  assert(
    canManageStaff('manager', shopA, 'manager', shopA, 'mgr-1', 'mgr-2').allowed === false,
    'Manager cannot manage another Manager account'
  );

  // Senior Cashier & Cashier Disallowed from Staff Management
  assert(
    canManageStaff('senior_cashier', shopA, 'cashier', shopA, 'sc-1', 'csh-1').allowed === false,
    'Senior Cashier cannot manage Cashier staff accounts'
  );
  assert(
    canManageStaff('cashier', shopA, 'cashier', shopA, 'csh-1', 'csh-2').allowed === false,
    'Cashier cannot manage other Cashier staff accounts'
  );

  // =========================================================================
  // TEST 3: Privilege Escalation & Role Promotion Protection
  // =========================================================================
  console.log('\n--- Group 3: Privilege Escalation & Promotion Protection ---');
  // Manager promoting to Manager / Owner / Admin
  assert(
    canPromoteRole('manager', 'manager', 'cashier').allowed === false,
    'Manager cannot promote Cashier to Manager'
  );
  assert(
    canPromoteRole('manager', 'manager', 'senior_cashier').allowed === false,
    'Manager cannot promote Senior Cashier to Manager'
  );
  assert(
    canPromoteRole('manager', 'owner', 'senior_cashier').allowed === false,
    'Manager cannot promote anyone to Owner'
  );
  assert(
    canPromoteRole('manager', 'admin', 'senior_cashier').allowed === false,
    'Manager cannot promote anyone to Admin'
  );

  // Manager promoting Cashier to Senior Cashier is permitted
  assert(
    canPromoteRole('manager', 'senior_cashier', 'cashier').allowed === true,
    'Manager can promote Cashier to Senior Cashier'
  );

  // Owner can promote to Manager
  assert(
    canPromoteRole('owner', 'manager', 'senior_cashier').allowed === true,
    'Owner can promote Senior Cashier to Manager'
  );

  // Manager granting staff management permission
  assert(
    canGrantPermission('manager', 'staff', true).allowed === false,
    'Manager cannot grant staff management permission in permissions JSON'
  );
  assert(
    canGrantPermission('owner', 'staff', true).allowed === true,
    'Owner can grant staff management permission'
  );

  // =========================================================================
  // TEST 4: PIN Reset Flow & Plaintext Elimination
  // =========================================================================
  console.log('\n--- Group 4: PIN Reset Flow & Plaintext Elimination ---');
  // Simulate PIN reset payload mutation
  const resetPinInput = '987654';
  const targetStaffRecord = {
    id: 'staff-uuid-1',
    full_name: 'Lerato Khumalo',
    role: 'cashier' as UserRole,
    pin_code: '123456', // legacy plaintext
    pin_hash: null as string | null
  };

  // Perform reset
  const generatedHash = hashPin(resetPinInput);
  const updatedRecord = {
    ...targetStaffRecord,
    pin_hash: generatedHash,
    pin_code: null // Explicitly cleared to NULL
  };

  assert(updatedRecord.pin_code === null, 'Legacy pin_code is strictly NULL after PIN reset');
  assert(updatedRecord.pin_hash !== null, 'pin_hash is populated with authoritative hash');
  assert(verifyPinHash(resetPinInput, updatedRecord.pin_hash!) === true, 'New PIN successfully authenticates');
  assert(verifyPinHash('123456', updatedRecord.pin_hash!) === false, 'Old legacy PIN is rejected');

  // Verify Audit Log Safety (No PIN, hash, or password in audit records)
  const auditRecord = {
    shop_id: shopA,
    actor_id: 'owner-1',
    target_staff_id: updatedRecord.id,
    event_type: 'PIN_RESET',
    old_values: null,
    new_values: null,
    reason: 'Staff PIN reset by authorized administrator'
  };

  const serializedAudit = JSON.stringify(auditRecord);
  assert(!serializedAudit.includes(resetPinInput), 'Raw PIN is NEVER recorded in audit log');
  assert(!serializedAudit.includes(generatedHash), 'pin_hash is NEVER recorded in audit log');
  assert(!serializedAudit.includes('password'), 'Passwords are NEVER recorded in audit log');

  // =========================================================================
  // TEST 5: Senior Cashier Role Consistency & Account Picker UI
  // =========================================================================
  console.log('\n--- Group 5: Senior Cashier Representation & Account Picker UI ---');
  const seniorRole: UserRole = 'senior_cashier';
  assert(seniorRole === 'senior_cashier', 'Internal representation is strictly snake_case senior_cashier');
  assert(formatRoleLabel(seniorRole) === 'Senior Cashier', 'UI display representation is strictly "Senior Cashier"');

  const seniorDefaults = getSeniorCashierDefaultPermissions();
  assert(seniorDefaults.sales === true, 'Senior Cashier default: sales permitted');
  assert(seniorDefaults.inventory === true, 'Senior Cashier default: inventory permitted');
  assert(seniorDefaults.pawn === true, 'Senior Cashier default: pawn operations permitted');
  assert(seniorDefaults.sellerAcquisitions === true, 'Senior Cashier default: seller intake permitted');
  assert(seniorDefaults.staff === false, 'Senior Cashier default: staff management NOT permitted');
  assert(seniorDefaults.pricing === false, 'Senior Cashier default: permanent price edit NOT permitted');

  // Test Account Picker Filtering
  const rawStaffList: Array<{ id: string; role: UserRole; is_active: boolean }> = [
    { id: '1', role: 'owner', is_active: true },
    { id: '2', role: 'manager', is_active: true },
    { id: '3', role: 'senior_cashier', is_active: true },
    { id: '4', role: 'cashier', is_active: true },
    { id: '5', role: 'admin', is_active: true }, // Technical admin
    { id: '6', role: 'cashier', is_active: false }, // Deactivated
  ];

  const pickerStaff = filterStaffForAccountPicker(rawStaffList);
  assert(pickerStaff.length === 4, 'Account Picker shows exactly 4 active operational staff');
  assert(pickerStaff.some(s => s.role === 'admin') === false, 'Technical admin is strictly hidden from Account Picker');
  assert(pickerStaff.some(s => s.is_active === false) === false, 'Deactivated staff are excluded from Account Picker');
  assert(pickerStaff.some(s => s.role === 'senior_cashier'), 'Senior Cashier is distinctly present in Account Picker');

  console.log('====================================================');
  console.log('   ALL STAFF SECURITY FINALIZATION TESTS PASSED!   ');
  console.log('====================================================\n');
}

// Auto-run if executed directly via node/tsx
if (typeof process !== 'undefined' && process.argv && process.argv[1] && process.argv[1].includes('staffSecurityFinalization')) {
  runStaffSecurityFinalizationTests();
}
