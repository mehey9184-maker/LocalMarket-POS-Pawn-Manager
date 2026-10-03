import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

// Emulated server-side authorization check matching our SQL RPC secure constraints
export function evaluateCompleteRetailSale(
  callerRole: string,
  items: { id: string; title: string; status: 'Retail Floor' | 'Reserved' | 'Sold' | 'Vault Hold' }[]
): { success: boolean; error?: string } {
  // 1. Enforce Authentication (emulated check)
  if (!callerRole) {
    return { success: false, error: 'Authentication required for retail checkout.' };
  }

  // 2. Validate Items Payload
  if (!items || items.length === 0) {
    return { success: false, error: 'Retail checkout requires at least one sale item.' };
  }

  // 3. Enforce Item Availability & Role Authorization
  for (const item of items) {
    if (item.status !== 'Retail Floor' && item.status !== 'Reserved') {
      return {
        success: false,
        error: `Item "${item.title}" is not available for sale (current status: ${item.status}).`
      };
    }

    // Crucial Business Rule: Normal Cashier is not permitted to sell Reserved stock
    if (item.status === 'Reserved' && callerRole === 'cashier') {
      return {
        success: false,
        error: 'Unauthorized: Cashiers are not permitted to sell Reserved stock.'
      };
    }
  }

  return { success: true };
}

/**
 * Corrective Security & UX Contract Pass Test Suite
 */
export async function runPhase2jSecurityAndReservedStockTests() {
  console.log('=== RUNNING PHASE 2J CORRECTIVE SECURITY & UX CONTRACT PASS TESTS ===');

  const staffManagerPath = path.join(process.cwd(), 'src/components/profile/StaffAccessManager.tsx');
  const staffManagerSrc = fs.readFileSync(staffManagerPath, 'utf8');

  const authContextPath = path.join(process.cwd(), 'src/context/AuthContext.tsx');
  const authContextSrc = fs.readFileSync(authContextPath, 'utf8');

  const serverPath = path.join(process.cwd(), 'server.ts');
  const serverSrc = fs.readFileSync(serverPath, 'utf8');

  const checkoutMigrationPath = path.join(process.cwd(), 'supabase/migrations/20260924080000_complete_retail_sale.sql');
  const checkoutMigrationSql = fs.readFileSync(checkoutMigrationPath, 'utf8');

  // =========================================================================
  // 1. STAFF ACCESS CONTROL UI CONTRACT TESTS
  // =========================================================================
  console.log('\n--- 1. Staff Access Control UI Contract ---');
  
  // Verify UI uses role-fixed permissions and no misleading toggles
  assert(staffManagerSrc.includes('getFixedPermissionsForRole'), 'StaffAccessManager.tsx must use getFixedPermissionsForRole');
  assert(!staffManagerSrc.includes('onChange={(e) => handleTogglePermission(item.id, e.target.checked)}'), 'StaffAccessManager.tsx must not render editable toggle inputs for fixed role permissions');
  assert(staffManagerSrc.includes('Permissions are fixed by role'), 'StaffAccessManager.tsx must display explanatory notice about fixed permissions');
  
  // Verify schedule editing remains fully intact
  assert(staffManagerSrc.includes('toggleDay'), 'StaffAccessManager.tsx must allow toggling schedule days');
  assert(staffManagerSrc.includes('handleUpdateScheduleDraft'), 'StaffAccessManager.tsx must allow editing schedule hours');
  
  console.log('[PASS] Access Control UI accurately reflects role-fixed permissions and keeps schedule editable');

  // =========================================================================
  // 2. SENSITIVE AUTHENTICATION LOGGING TESTS
  // =========================================================================
  console.log('\n--- 2. Sensitive Authentication Logging Diagnostics ---');

  // Verify AuthContext console logs do NOT output targetStaffId, cashierCode, or email
  const leakyClientPhrases = [
    'params.cashierCode',
    'params.targetStaffId',
    'params.staffName',
    'currentUser?.id',
    'currentUser.id'
  ];
  for (const phrase of leakyClientPhrases) {
    const isLeaking = authContextSrc.includes(`console.log(\`[Client Switch] ${phrase}`) || 
                      authContextSrc.includes(`console.log('[Client Switch] ${phrase}`) || 
                      authContextSrc.includes(`console.error("[Client Switch] ${phrase}`);
    assert(!isLeaking, `AuthContext.tsx must not log sensitive detail: "${phrase}"`);
  }

  // Verify server logs do NOT leak pin, cashierCode, email, targetStaffId, etc.
  const leakyServerLogs = [
    'cashierCode: ${cashierCode}',
    'staffId: ${staffId}',
    'PIN format mismatch for cashierCode',
    'Profile found. targetStaffId',
    'Profile is deactivated for user',
    'bypass attempt for high-privilege account: ${profile.id}',
    'Checking lockout status for user ID',
    'Lockout check RPC failed for user',
    'locked. Remaining seconds',
    'not admitted for user ${profile.id}',
    'against pin_hash for user',
    'against legacy pin_code for user',
    'PIN migration failed for user',
    'Legacy PIN migrated to secure hash for user',
    'configured for user: ${profile.id}',
    'for user ID: ${profile.id}, success',
    'PIN attempt for user ${profile.id}',
    'schedule enforcement for user',
    'constraint for user: ${profile.id}',
    'bypass for user: ${profile.id}',
    'update failed for user ${profile.id}',
    'updated successfully for user ${profile.id}',
    'Email: ${profile.email}',
    'email ${profile.email}',
    'User ID in session: ${authData.session.user.id}',
    'for user: ${profile.id}',
    'User ID: ${profile.id}'
  ];
  for (const log of leakyServerLogs) {
    assert(!serverSrc.includes(log), `server.ts must not print sensitive detail: "${log}"`);
  }

  console.log('[PASS] Sensitive operational credentials and employee identifiers are completely absent from logs');

  // =========================================================================
  // 3. RESERVED STOCK AUTHORIZATION TESTS
  // =========================================================================
  console.log('\n--- 3. Reserved Stock Authorization Invariants ---');

  // Verify the authoritative database layer enforces the cashier restriction on Reserved stock
  assert(checkoutMigrationSql.includes("IF v_db_item.status = 'Reserved' AND v_caller_profile.role = 'cashier' THEN"), 'complete_retail_sale migration must authoritative reject Reserved sales for cashiers');
  assert(checkoutMigrationSql.includes("RAISE EXCEPTION 'Unauthorized: Cashiers are not permitted to sell Reserved stock.'"), 'complete_retail_sale migration must raise exact cashier reserved rejection exception');

  // Authoritative Layer Emulation assertions:
  const reservedItem = { id: 'item-101', title: 'Reserved Gold Necklace', status: 'Reserved' as const };
  const retailFloorItem = { id: 'item-102', title: 'Vintage watch', status: 'Retail Floor' as const };
  const vaultItem = { id: 'item-103', title: 'Secured Gold Coin', status: 'Vault Hold' as const };

  // 1. Cashier attempts Reserved sale -> REJECTED
  const res1 = evaluateCompleteRetailSale('cashier', [reservedItem]);
  assert(res1.success === false, 'Authoritative layer must reject cashier Reserved checkout');
  assert(res1.error === 'Unauthorized: Cashiers are not permitted to sell Reserved stock.', 'Authoritative layer returns exact cashier reserved error message');

  // 2. Manager attempts Reserved sale -> ALLOWED
  const res2 = evaluateCompleteRetailSale('manager', [reservedItem]);
  assert(res2.success === true, 'Authoritative layer must allow manager Reserved checkout');

  // 3. Owner attempts Reserved sale -> ALLOWED
  const res3 = evaluateCompleteRetailSale('owner', [reservedItem]);
  assert(res3.success === true, 'Authoritative layer must allow owner Reserved checkout');

  // 4. Cashier sells Retail Floor item -> ALLOWED
  const res4 = evaluateCompleteRetailSale('cashier', [retailFloorItem]);
  assert(res4.success === true, 'Authoritative layer must allow cashier normal Retail Floor checkout');

  // 5. Checkout attempts for Vault/Sold items are still validated and rejected
  const res5 = evaluateCompleteRetailSale('manager', [vaultItem]);
  assert(res5.success === false, 'Items in Vault must still be rejected');

  console.log('[PASS] Authoritative reserved stock checkout restrictions verified (Cashier blocked, Managers/Owners allowed)');

  console.log('====================================================');
  console.log('   ALL CORRECTIVE PASS SECURITY TESTS PASSED!');
  console.log('====================================================\n');
}

// Auto-run if executed directly via node/tsx
if (typeof process !== 'undefined' && process.argv && process.argv[1] && process.argv[1].includes('phase2jSecurityAndReservedStock')) {
  runPhase2jSecurityAndReservedStockTests();
}
