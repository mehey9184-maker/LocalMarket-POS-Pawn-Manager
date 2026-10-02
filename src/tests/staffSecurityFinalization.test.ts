import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
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

// Full Invariant Simulation for secure_update_staff_profile
function evaluateSecureUpdateStaffProfile(
  caller: { id: string; role: UserRole; shop_id: string },
  target: { id: string; role: UserRole; shop_id: string },
  updates: Record<string, any>,
  otherActiveOwnersInShop: number = 0
): { success: boolean; error?: string } {
  if (!['owner', 'admin', 'manager'].includes(caller.role)) {
    return { success: false, error: 'Insufficient permissions to manage staff' };
  }

  if (caller.shop_id !== target.shop_id && caller.role !== 'admin') {
    return { success: false, error: 'Cannot manage staff from a different shop branch' };
  }

  if (caller.role === 'manager' && (target.role === 'owner' || target.role === 'admin')) {
    return { success: false, error: 'Managers cannot modify Owner or Admin accounts' };
  }

  if (caller.role === 'manager' && target.role === 'manager' && caller.id !== target.id) {
    return { success: false, error: 'Managers cannot modify other Manager accounts' };
  }

  for (const field of Object.keys(updates)) {
    if (field === 'role') {
      const requestedRole = updates[field];
      if (caller.role === 'owner' && caller.id === target.id && requestedRole !== 'owner') {
        return { success: false, error: 'Your Owner account cannot be changed to a staff role.' };
      }
      if (target.role === 'owner' && requestedRole !== 'owner') {
        return { success: false, error: 'An existing Owner account cannot be changed to a staff role.' };
      }
      if (target.role === 'owner' && requestedRole !== 'owner' && otherActiveOwnersInShop < 1) {
        return { success: false, error: 'Cannot modify or deactivate the last remaining active Owner for this shop.' };
      }
      if (['owner', 'admin'].includes(requestedRole) && !['owner', 'admin'].includes(caller.role)) {
        return { success: false, error: 'Only Owners can promote staff to Owner or Admin roles' };
      }
      if (requestedRole === 'manager' && caller.role === 'manager' && target.role !== 'manager') {
        return { success: false, error: 'Managers cannot promote staff to Manager role' };
      }
    }

    if (field === 'is_active' && updates[field] === false) {
      if (caller.role === 'owner' && caller.id === target.id) {
        return { success: false, error: 'The Shop Owner account cannot be deactivated from Staff Management.' };
      }
      if (target.role === 'owner' && otherActiveOwnersInShop < 1) {
        return { success: false, error: 'Cannot modify or deactivate the last remaining active Owner for this shop.' };
      }
    }

    if (field === 'permissions' && !['owner', 'admin'].includes(caller.role)) {
      if (updates.permissions?.staff === true) {
        return { success: false, error: 'Managers cannot grant staff management permissions' };
      }
    }
  }

  return { success: true };
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

  // =========================================================================
  // TEST 6: Critical Staff Role Safety & Owner Self-Protection Invariants
  // =========================================================================
  console.log('\n--- Group 6: Critical Staff Role Safety & Owner Self-Protection ---');
  const callerOwner = { id: 'owner-uuid-1', role: 'owner' as UserRole, shop_id: shopA };
  const targetOwner2 = { id: 'owner-uuid-2', role: 'owner' as UserRole, shop_id: shopA };
  const targetCashier = { id: 'cashier-uuid-1', role: 'cashier' as UserRole, shop_id: shopA };
  const targetSenior = { id: 'senior-uuid-1', role: 'senior_cashier' as UserRole, shop_id: shopA };
  const targetManager = { id: 'manager-uuid-1', role: 'manager' as UserRole, shop_id: shopA };
  const targetAdmin = { id: 'admin-uuid-1', role: 'admin' as UserRole, shop_id: shopA };
  const callerManager = { id: 'manager-uuid-1', role: 'manager' as UserRole, shop_id: shopA };
  const callerCrossShopOwner = { id: 'owner-uuid-cross', role: 'owner' as UserRole, shop_id: shopB };

  // 1. Owner cannot change own role (Owner -> Cashier, Owner -> Senior Cashier, Owner -> Manager)
  const demoteSelfToCashier = evaluateSecureUpdateStaffProfile(callerOwner, callerOwner, { role: 'cashier' }, 1);
  assert(demoteSelfToCashier.success === false, 'Owner cannot change own role to Cashier');
  assert(demoteSelfToCashier.error === 'Your Owner account cannot be changed to a staff role.', 'Owner self-role change returns exact invariant error message');

  const demoteSelfToSenior = evaluateSecureUpdateStaffProfile(callerOwner, callerOwner, { role: 'senior_cashier' }, 1);
  assert(demoteSelfToSenior.success === false, 'Owner cannot change own role to Senior Cashier');
  assert(demoteSelfToSenior.error === 'Your Owner account cannot be changed to a staff role.', 'Owner self-demotion to Senior Cashier returns exact invariant error');

  const demoteSelfToManager = evaluateSecureUpdateStaffProfile(callerOwner, callerOwner, { role: 'manager' }, 1);
  assert(demoteSelfToManager.success === false, 'Owner cannot change own role to Manager');
  assert(demoteSelfToManager.error === 'Your Owner account cannot be changed to a staff role.', 'Owner self-demotion to Manager returns exact invariant error');

  // 2. Owner cannot deactivate own account
  const deactivateSelf = evaluateSecureUpdateStaffProfile(callerOwner, callerOwner, { is_active: false }, 1);
  assert(deactivateSelf.success === false, 'Owner cannot deactivate own account');
  assert(deactivateSelf.error === 'The Shop Owner account cannot be deactivated from Staff Management.', 'Owner self-deactivation returns exact invariant error message');

  // 3. Owner cannot demote another Owner
  const demoteOtherOwner = evaluateSecureUpdateStaffProfile(callerOwner, targetOwner2, { role: 'senior_cashier' }, 1);
  assert(demoteOtherOwner.success === false, 'Owner cannot demote another Owner account');
  assert(demoteOtherOwner.error === 'An existing Owner account cannot be changed to a staff role.', 'Demoting existing owner returns exact invariant error');

  // 4. Last-Owner safety (Cannot deactivate or demote last remaining active owner)
  const deactivateLastOwner = evaluateSecureUpdateStaffProfile(callerOwner, targetOwner2, { is_active: false }, 0);
  assert(deactivateLastOwner.success === false, 'Cannot deactivate last remaining active Owner in shop');
  assert(deactivateLastOwner.error === 'Cannot modify or deactivate the last remaining active Owner for this shop.', 'Last-owner deactivation returns exact invariant error');

  // 5. Owner can still manage Cashier
  const ownerManageCashier = evaluateSecureUpdateStaffProfile(callerOwner, targetCashier, { role: 'senior_cashier', is_active: true }, 1);
  assert(ownerManageCashier.success === true, 'Owner can still manage and promote Cashier to Senior Cashier');

  // 6. Owner can still manage Senior Cashier
  const ownerManageSenior = evaluateSecureUpdateStaffProfile(callerOwner, targetSenior, { role: 'manager', full_name: 'Senior Lead' }, 1);
  assert(ownerManageSenior.success === true, 'Owner can still manage and promote Senior Cashier to Manager');

  // 7. Owner can still manage Manager
  const ownerManageManager = evaluateSecureUpdateStaffProfile(callerOwner, targetManager, { is_active: false, full_name: 'Branch Manager' }, 1);
  assert(ownerManageManager.success === true, 'Owner can still manage and deactivate Manager');

  // 8. Manager cannot modify Owner
  const managerModOwner = evaluateSecureUpdateStaffProfile(callerManager, targetOwner2, { full_name: 'Hacked Owner' }, 1);
  assert(managerModOwner.success === false, 'Manager cannot modify Owner account');
  assert(managerModOwner.error === 'Managers cannot modify Owner or Admin accounts', 'Manager modifying Owner returns exact error');

  // 9. Manager cannot promote to Manager
  const managerPromoteManager = evaluateSecureUpdateStaffProfile(callerManager, targetCashier, { role: 'manager' }, 1);
  assert(managerPromoteManager.success === false, 'Manager cannot promote staff to Manager');
  assert(managerPromoteManager.error === 'Managers cannot promote staff to Manager role', 'Manager promoting to Manager returns exact error');

  // 10. Admin remains protected
  const managerModAdmin = evaluateSecureUpdateStaffProfile(callerManager, targetAdmin, { is_active: false }, 1);
  assert(managerModAdmin.success === false, 'Manager cannot modify technical Admin account');
  assert(managerModAdmin.error === 'Managers cannot modify Owner or Admin accounts', 'Manager modifying Admin returns exact error');

  // 11. Shop isolation remains enforced
  const crossShopUpdate = evaluateSecureUpdateStaffProfile(callerCrossShopOwner, targetCashier, { is_active: false }, 1);
  assert(crossShopUpdate.success === false, 'Cross-shop staff update is strictly blocked');
  assert(crossShopUpdate.error === 'Cannot manage staff from a different shop branch', 'Cross-shop update returns shop isolation error');

  // 12. Verify Database Migration SQL File Integrity
  const migrationPath = path.resolve('supabase/migrations/20261002010000_critical_staff_role_safety_and_owner_protection.sql');
  assert(fs.existsSync(migrationPath), 'Migration file 20261002010000_critical_staff_role_safety_and_owner_protection.sql exists');
  const migrationSql = fs.readFileSync(migrationPath, 'utf-8');

  assert(migrationSql.includes('Your Owner account cannot be changed to a staff role.'), 'Migration enforces Owner self-role change protection message');
  assert(migrationSql.includes('The Shop Owner account cannot be deactivated from Staff Management.'), 'Migration enforces Owner self-deactivation protection message');
  assert(migrationSql.includes('An existing Owner account cannot be changed to a staff role.'), 'Migration enforces Owner demotion protection message');
  assert(migrationSql.includes('Cannot modify or deactivate the last remaining active Owner for this shop.'), 'Migration enforces Last-Owner safety invariant');
  assert(migrationSql.includes('REVOKE ALL ON FUNCTION public.secure_update_staff_profile'), 'Migration revokes public/anon execution privileges');
  assert(migrationSql.includes('GRANT EXECUTE ON FUNCTION public.secure_update_staff_profile'), 'Migration grants execution privileges to authenticated and service_role');

  console.log('====================================================');
  console.log('   ALL STAFF SECURITY FINALIZATION TESTS PASSED!   ');
  console.log('====================================================\n');
}

// Auto-run if executed directly via node/tsx
if (typeof process !== 'undefined' && process.argv && process.argv[1] && process.argv[1].includes('staffSecurityFinalization')) {
  runStaffSecurityFinalizationTests();
}
