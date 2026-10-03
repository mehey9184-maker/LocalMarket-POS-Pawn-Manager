import fs from 'fs';
import path from 'path';
import { 
  ROLE_BASELINE_PERMISSIONS, 
  ROLE_OPTIONAL_PERMISSIONS, 
  getEffectivePermissions, 
  Permissions 
} from '../types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`[FAIL] ${message}`);
    throw new Error(message);
  }
  console.log(`[PASS] ${message}`);
}

export function runStaffPermissionsAndDualCredentialSecurityTests() {
  console.log('\n====================================================');
  console.log('   STAFF PERMISSIONS & DUAL CREDENTIAL SECURITY PASS');
  console.log('====================================================');

  // =========================================================================
  // 1. ROLE BASELINE & OPTIONAL GRANTS ARCHITECTURE
  // =========================================================================
  console.log('\n--- 1. Effective Permission Calculation Invariants ---');

  // Owner: all 8 permissions permanently active
  const ownerPerms = getEffectivePermissions('owner', {
    sales: false,
    inventory: false,
    pawn: false,
    sellerAcquisitions: false,
    refunds: false,
    pricing: false,
    reports: false,
    staff: false
  });
  assert(ownerPerms.sales === true, 'Owner: sales is permanently active');
  assert(ownerPerms.inventory === true, 'Owner: inventory is permanently active');
  assert(ownerPerms.pawn === true, 'Owner: pawn is permanently active');
  assert(ownerPerms.sellerAcquisitions === true, 'Owner: sellerAcquisitions is permanently active');
  assert(ownerPerms.refunds === true, 'Owner: refunds is permanently active');
  assert(ownerPerms.pricing === true, 'Owner: pricing is permanently active');
  assert(ownerPerms.reports === true, 'Owner: reports is permanently active');
  assert(ownerPerms.staff === true, 'Owner: staff is permanently active');

  // Manager: baseline 7 + optional pricing
  const managerDefault = getEffectivePermissions('manager', {});
  assert(managerDefault.sales === true, 'Manager baseline: sales is active');
  assert(managerDefault.inventory === true, 'Manager baseline: inventory is active');
  assert(managerDefault.pawn === true, 'Manager baseline: pawn is active');
  assert(managerDefault.sellerAcquisitions === true, 'Manager baseline: sellerAcquisitions is active');
  assert(managerDefault.refunds === true, 'Manager baseline: refunds is active');
  assert(managerDefault.reports === true, 'Manager baseline: reports is active');
  assert(managerDefault.staff === true, 'Manager baseline: staff is active');
  assert(managerDefault.pricing === false, 'Manager default: pricing is inactive without grant');

  const managerWithPricing = getEffectivePermissions('manager', { pricing: true });
  assert(managerWithPricing.pricing === true, 'Manager with pricing grant: pricing is active');

  // Manager baseline cannot be disabled by stored json
  const managerAttemptDisabled = getEffectivePermissions('manager', {
    sales: false,
    inventory: false,
    pawn: false,
    sellerAcquisitions: false,
    refunds: false,
    reports: false,
    staff: false
  });
  assert(managerAttemptDisabled.sales === true, 'Manager baseline cannot be disabled: sales');
  assert(managerAttemptDisabled.inventory === true, 'Manager baseline cannot be disabled: inventory');
  assert(managerAttemptDisabled.pawn === true, 'Manager baseline cannot be disabled: pawn');
  assert(managerAttemptDisabled.sellerAcquisitions === true, 'Manager baseline cannot be disabled: sellerAcquisitions');
  assert(managerAttemptDisabled.refunds === true, 'Manager baseline cannot be disabled: refunds');
  assert(managerAttemptDisabled.reports === true, 'Manager baseline cannot be disabled: reports');
  assert(managerAttemptDisabled.staff === true, 'Manager baseline cannot be disabled: staff');

  // Senior Cashier: baseline 4 + optional (refunds, pricing, reports). Never staff!
  const seniorDefault = getEffectivePermissions('senior_cashier', {});
  assert(seniorDefault.sales === true, 'Senior Cashier baseline: sales is active');
  assert(seniorDefault.inventory === true, 'Senior Cashier baseline: inventory is active');
  assert(seniorDefault.pawn === true, 'Senior Cashier baseline: pawn is active');
  assert(seniorDefault.sellerAcquisitions === true, 'Senior Cashier baseline: sellerAcquisitions is active');
  assert(seniorDefault.refunds === false, 'Senior Cashier default: refunds is inactive');
  assert(seniorDefault.pricing === false, 'Senior Cashier default: pricing is inactive');
  assert(seniorDefault.reports === false, 'Senior Cashier default: reports is inactive');
  assert(seniorDefault.staff === false, 'Senior Cashier default: staff is inactive');

  const seniorWithGrants = getEffectivePermissions('senior_cashier', {
    refunds: true,
    pricing: true,
    reports: true,
    staff: true // Attempted privilege escalation
  });
  assert(seniorWithGrants.refunds === true, 'Senior Cashier optional grant: refunds active');
  assert(seniorWithGrants.pricing === true, 'Senior Cashier optional grant: pricing active');
  assert(seniorWithGrants.reports === true, 'Senior Cashier optional grant: reports active');
  assert(seniorWithGrants.staff === false, 'Senior Cashier privilege escalation blocked: staff remains FALSE');

  // Cashier: baseline 2 + optional pawn. Forbidden: sellerAcquisitions, refunds, pricing, reports, staff
  const cashierDefault = getEffectivePermissions('cashier', {});
  assert(cashierDefault.sales === true, 'Cashier baseline: sales is active');
  assert(cashierDefault.inventory === true, 'Cashier baseline: inventory is active');
  assert(cashierDefault.pawn === false, 'Cashier default: pawn is inactive');
  assert(cashierDefault.sellerAcquisitions === false, 'Cashier default: sellerAcquisitions is inactive');
  assert(cashierDefault.refunds === false, 'Cashier default: refunds is inactive');
  assert(cashierDefault.pricing === false, 'Cashier default: pricing is inactive');
  assert(cashierDefault.reports === false, 'Cashier default: reports is inactive');
  assert(cashierDefault.staff === false, 'Cashier default: staff is inactive');

  const cashierWithPawn = getEffectivePermissions('cashier', { pawn: true });
  assert(cashierWithPawn.pawn === true, 'Cashier optional grant: pawn active');

  const cashierAttemptEscalation = getEffectivePermissions('cashier', {
    sellerAcquisitions: true,
    refunds: true,
    pricing: true,
    reports: true,
    staff: true
  });
  assert(cashierAttemptEscalation.sellerAcquisitions === false, 'Cashier escalation blocked: sellerAcquisitions is FALSE');
  assert(cashierAttemptEscalation.refunds === false, 'Cashier escalation blocked: refunds is FALSE');
  assert(cashierAttemptEscalation.pricing === false, 'Cashier escalation blocked: pricing is FALSE');
  assert(cashierAttemptEscalation.reports === false, 'Cashier escalation blocked: reports is FALSE');
  assert(cashierAttemptEscalation.staff === false, 'Cashier escalation blocked: staff is FALSE');

  // =========================================================================
  // 2. SERVER & DATABASE SECURITY INVARIANTS
  // =========================================================================
  console.log('\n--- 2. Server & Migration Security Boundaries ---');

  const migrationPath = path.join(process.cwd(), 'supabase/migrations/20261003010000_staff_access_and_manager_credential_model.sql');
  assert(fs.existsSync(migrationPath), 'Migration 20261003010000 exists');
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');

  assert(migrationSql.includes('secure_update_staff_access'), 'Migration defines secure_update_staff_access RPC');
  assert(migrationSql.includes('REVOKE ALL ON FUNCTION public.secure_update_staff_access'), 'Migration revokes execution from public/anon/authenticated');
  assert(migrationSql.includes('GRANT EXECUTE ON FUNCTION public.secure_update_staff_access(UUID, UUID, JSONB, JSONB, TEXT) TO service_role'), 'RPC is strictly service_role only');
  assert(migrationSql.includes('Managers cannot configure Manager accounts'), 'Migration rejects Manager-on-Manager modifications');
  assert(migrationSql.includes('Managers cannot configure Owner or Admin accounts'), 'Migration rejects Manager-on-Owner modifications');
  assert(migrationSql.includes('Cannot manage staff from a different shop branch'), 'Migration enforces shop branch isolation');
  assert(migrationSql.includes('password_setup_required'), 'Migration tracks password_setup_required');

  const serverPath = path.join(process.cwd(), 'server.ts');
  const serverSrc = fs.readFileSync(serverPath, 'utf8');

  assert(serverSrc.includes('/api/staff/update-access'), 'server.ts exposes /api/staff/update-access endpoint');
  assert(serverSrc.includes('signInWithPassword'), 'server.ts verifies caller password on update-access');
  assert(serverSrc.includes('delete processedUpdates.permissions'), 'server.ts strips permissions from general update-profile endpoint');

  // Ensure passwords and PINs are never logged in plaintext
  assert(!serverSrc.includes('console.log("password"'), 'server.ts does not log password');
  assert(!serverSrc.includes('console.log(password'), 'server.ts does not log password variable');

  // =========================================================================
  // 3. STAFF ACCESS MANAGER UI CONTRACT
  // =========================================================================
  console.log('\n--- 3. StaffAccessManager UI Contract ---');

  const staffManagerPath = path.join(process.cwd(), 'src/components/profile/StaffAccessManager.tsx');
  const staffManagerSrc = fs.readFileSync(staffManagerPath, 'utf8');

  assert(staffManagerSrc.includes('Required access'), 'StaffAccessManager renders Required access section');
  assert(staffManagerSrc.includes('Additional access'), 'StaffAccessManager renders Additional access section');
  assert(staffManagerSrc.includes('Always on'), 'StaffAccessManager displays Always on status indicator');
  assert(staffManagerSrc.includes('isPasswordModalOpen'), 'StaffAccessManager includes password verification modal state');
  assert(staffManagerSrc.includes('Confirm Security Changes'), 'StaffAccessManager prompts with password modal title');
  assert(staffManagerSrc.includes('Connection required'), 'StaffAccessManager enforces offline security boundary');
  assert(staffManagerSrc.includes('handleToggleOptionalPermission'), 'StaffAccessManager provides dedicated optional capability toggles');

  console.log('\n====================================================');
  console.log('   ALL STAFF PERMISSIONS & CREDENTIAL TESTS PASSED! ');
  console.log('====================================================\n');
}
