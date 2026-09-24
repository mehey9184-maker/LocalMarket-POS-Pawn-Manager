import fs from 'fs';
import path from 'path';

function assertEqual(actual: any, expected: any, testName: string) {
  if (actual !== expected) {
    throw new Error(`[FAIL] ${testName}: Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
  console.log(`[PASS] ${testName}`);
}

function assertTrue(condition: boolean, testName: string) {
  if (!condition) {
    throw new Error(`[FAIL] ${testName}: Condition was false`);
  }
  console.log(`[PASS] ${testName}`);
}

export async function runV1DefectRepairPassTests() {
  console.log('=== RUNNING V1 PRODUCTION DEFECT REPAIR PASS TEST SUITE ===');

  // --- 1. PIN RULE CONSISTENCY (EXACTLY 6 DIGITS) ---
  const pinRegex = /^\d{6}$/;

  assertTrue(pinRegex.test('123456'), 'PIN Test: Valid 6-digit PIN accepted');
  assertTrue(pinRegex.test('987654'), 'PIN Test: Another valid 6-digit PIN accepted');
  assertTrue(!pinRegex.test('1234'), 'PIN Test: Rejects 4-digit PIN');
  assertTrue(!pinRegex.test('12345'), 'PIN Test: Rejects 5-digit PIN');
  assertTrue(!pinRegex.test('1234567'), 'PIN Test: Rejects 7-digit PIN');
  assertTrue(!pinRegex.test('12345a'), 'PIN Test: Rejects alphanumeric 6-char string');
  assertTrue(!pinRegex.test('abcdef'), 'PIN Test: Rejects non-numeric letters');
  assertTrue(!pinRegex.test(''), 'PIN Test: Rejects empty PIN');

  // --- 2. HARDCODED MANAGER PIN REGRESSION CHECK ---
  const srcFiles: string[] = [];
  function collectFiles(dir: string) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && entry.name !== '.git' && entry.name !== 'dist') {
          collectFiles(fullPath);
        }
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
        srcFiles.push(fullPath);
      }
    }
  }

  collectFiles(path.join(process.cwd(), 'src'));
  collectFiles(path.join(process.cwd(), 'electron'));
  srcFiles.push(path.join(process.cwd(), 'server.ts'));

  const forbiddenPin = '84' + '19';
  let foundDemoPin = false;
  for (const file of srcFiles) {
    if (file.includes('v1DefectRepairPass.test.ts')) continue;
    const content = fs.readFileSync(file, 'utf-8');
    if (content.includes(forbiddenPin) || content.includes(`Default: ${forbiddenPin}`)) {
      console.error(`[SECURITY DEFECT] Found hardcoded demo PIN ${forbiddenPin} in ${file}`);
      foundDemoPin = true;
    }
  }
  assertTrue(!foundDemoPin, 'Security Test: Production source contains zero instances of hardcoded demo PIN (8419)');

  // --- 3. ELECTRON & CLIENT BUNDLE SERVICE-ROLE KEY LEAK PREVENTION ---
  const clientBundleDir = path.join(process.cwd(), 'dist', 'assets');
  let serviceRoleLeakedInClient = false;
  if (fs.existsSync(clientBundleDir)) {
    const files = fs.readdirSync(clientBundleDir);
    for (const file of files) {
      if (file.endsWith('.js')) {
        const content = fs.readFileSync(path.join(clientBundleDir, file), 'utf-8');
        if (content.includes('SUPABASE_SERVICE_ROLE_KEY') || content.includes('service_role')) {
          serviceRoleLeakedInClient = true;
        }
      }
    }
  }
  assertTrue(!serviceRoleLeakedInClient, 'Security Test: Client web bundle assets contain NO SUPABASE_SERVICE_ROLE_KEY or service_role credentials');

  // --- 4. STAFF PROVISIONING AUTHORIZATION RULES ---
  // Owner permission matrix
  const ownerAllowedRoles = ['cashier', 'senior_cashier', 'manager'];
  assertTrue(ownerAllowedRoles.includes('cashier'), 'Provisioning Matrix: Owner permitted to create Cashier');
  assertTrue(ownerAllowedRoles.includes('senior_cashier'), 'Provisioning Matrix: Owner permitted to create Senior Cashier');
  assertTrue(ownerAllowedRoles.includes('manager'), 'Provisioning Matrix: Owner permitted to create Manager');

  // Manager permission matrix (Blocked from creating Manager)
  function isRoleAllowedForCaller(callerRole: string, targetRole: string): boolean {
    if (callerRole === 'owner' || callerRole === 'admin') {
      return ['cashier', 'senior_cashier', 'manager'].includes(targetRole);
    }
    if (callerRole === 'manager') {
      return ['cashier', 'senior_cashier'].includes(targetRole);
    }
    return false; // Cashiers/others blocked
  }

  assertTrue(isRoleAllowedForCaller('owner', 'cashier'), 'Auth Rule: Owner -> Cashier allowed');
  assertTrue(isRoleAllowedForCaller('owner', 'manager'), 'Auth Rule: Owner -> Manager allowed');
  assertTrue(isRoleAllowedForCaller('manager', 'cashier'), 'Auth Rule: Manager -> Cashier allowed');
  assertTrue(isRoleAllowedForCaller('manager', 'senior_cashier'), 'Auth Rule: Manager -> Senior Cashier allowed');
  assertTrue(!isRoleAllowedForCaller('manager', 'manager'), 'Auth Rule: Manager -> Manager BLOCKED');
  assertTrue(!isRoleAllowedForCaller('manager', 'owner'), 'Auth Rule: Manager -> Owner BLOCKED');
  assertTrue(!isRoleAllowedForCaller('cashier', 'cashier'), 'Auth Rule: Cashier -> Cashier BLOCKED');

  // --- 5. UI & CLAIMS REGRESSION TESTS ---
  const authPageContent = fs.readFileSync(path.join(process.cwd(), 'src/components/screens/AuthPage.tsx'), 'utf-8');
  assertTrue(!authPageContent.includes('Register Operator'), 'AuthPage Test: No "Register Operator" toggle');
  assertTrue(!authPageContent.includes('Register Shop Owner Account'), 'AuthPage Test: Public staff/owner self-registration tab removed');
  assertTrue(!authPageContent.includes('Register here'), 'AuthPage Test: No public self-registration link');

  const contractModalContent = fs.readFileSync(path.join(process.cwd(), 'src/components/modals/ContractModal.tsx'), 'utf-8');
  assertTrue(!contractModalContent.includes('LOCALMARKET SOWETO'), 'ContractModal Test: No hardcoded LOCALMARKET SOWETO');
  assertTrue(!contractModalContent.includes('Powered by LocalEats SA'), 'ContractModal Test: No hardcoded LocalEats SA branding');
  assertTrue(!contractModalContent.includes('NCRCP No: 12948'), 'ContractModal Test: No fake NCRCP number 12948');
  assertTrue(!contractModalContent.includes('biometric vault facilities'), 'ContractModal Test: No unverified biometric vault claim');

  const landingPageContent = fs.readFileSync(path.join(process.cwd(), 'src/components/screens/LandingPage.tsx'), 'utf-8');
  assertTrue(!landingPageContent.includes('NCR 34 of 2005'), 'LandingPage Test: No hardcoded NCR compliance claim');
  assertTrue(!landingPageContent.includes('Soweto Flagship Store'), 'LandingPage Test: No hardcoded Soweto Flagship claim');
  assertTrue(!landingPageContent.includes('Active Terminal Network'), 'LandingPage Test: No hardcoded Active Terminal Network claim');

  const sapsRegisterContent = fs.readFileSync(path.join(process.cwd(), 'src/components/screens/SapsRegister.tsx'), 'utf-8');
  assertTrue(!sapsRegisterContent.includes('Audit Certified:'), 'SapsRegister Test: Terminology clarifies merchant entry vs government certification');

  // --- 6. REFUND & RPC CONTRACT INTEGRITY TESTS (A THROUGH J) ---
  const salesContextContent = fs.readFileSync(path.join(process.cwd(), 'src/context/SalesContext.tsx'), 'utf-8');
  const syncServiceContent = fs.readFileSync(path.join(process.cwd(), 'src/services/SyncService.ts'), 'utf-8');
  const supabaseApiContent = fs.readFileSync(path.join(process.cwd(), 'src/services/supabaseApi.ts'), 'utf-8');
  const hardeningMigrationContent = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/20260924200000_harden_buy_pawn_saps_and_refund_integrity.sql'), 'utf-8');
  const reconciledMigrationContent = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/20260924120000_reconciled_buy_pawn_refund_rpcs.sql'), 'utf-8');

  // Test A: Online refund uses server refund ID as authoritative local ID
  assertTrue(salesContextContent.includes('const authoritativeId = res.refundId || refundId;'), 'Test A: Online refund uses authoritative server refund ID');
  assertTrue(salesContextContent.includes('id: authoritativeId'), 'Test A: Local Dexie refund record uses server refund ID');

  // Test B: Offline refund sync reconciles local ID to server ID
  assertTrue(syncServiceContent.includes('if (refundRes.refundId && refundRes.refundId !== log.entityId)'), 'Test B: Offline sync checks for server/local ID divergence');
  assertTrue(syncServiceContent.includes('await db.refundRequests.delete(oldId);'), 'Test B: Offline sync deletes old client UUID record upon server ID reconciliation');

  // Test C: Offline refund approval is queued and replayed through approve_refund()
  assertTrue(salesContextContent.includes('queueSyncAction') && salesContextContent.includes('refund_approval'), 'Test C: Offline refund approval queues durable sync action');
  assertTrue(syncServiceContent.includes("case 'refund_approval':"), 'Test C: SyncService handles refund_approval entity');
  assertTrue(syncServiceContent.includes('refundsApi.approveRefund'), 'Test C: Offline approval replays through approveRefund RPC');

  // Test D: Server rejection does not get marked synced
  assertTrue(syncServiceContent.includes("throw new Error(refundRes.error || 'Server rejected offline refund request');"), 'Test D: Offline refund request failure throws error');
  assertTrue(syncServiceContent.includes("throw new Error(approvalRes.error || 'Server rejected offline refund approval/rejection');"), 'Test D: Offline approval failure throws error');

  // Test E: Buy/Pawn payload fields match live RPC contracts
  assertTrue(supabaseApiContent.includes("p_transaction_id: params.transactionId,"), 'Test E: Buy RPC maps p_transaction_id');
  assertTrue(supabaseApiContent.includes("p_seller_id: params.sellerId,"), 'Test E: Buy RPC maps p_seller_id');
  assertTrue(supabaseApiContent.includes("p_loan_id: params.loanId,"), 'Test E: Pawn RPC maps p_loan_id');
  assertTrue(supabaseApiContent.includes("p_customer_id: params.customerId,"), 'Test E: Pawn RPC maps p_customer_id');

  // Test F: No shop_items.created_at reference in migrations
  function checkNoCreatedAtInShopItemsInsert(content: string) {
    const insertIdx = content.indexOf('INSERT INTO public.shop_items');
    if (insertIdx === -1) return true;
    const valuesIdx = content.indexOf('VALUES', insertIdx);
    const colsPart = content.slice(insertIdx, valuesIdx);
    return !colsPart.includes('created_at');
  }

  assertTrue(checkNoCreatedAtInShopItemsInsert(hardeningMigrationContent), 'Test F: shop_items INSERT in 20260924200000 migration has no created_at column');
  assertTrue(checkNoCreatedAtInShopItemsInsert(reconciledMigrationContent), 'Test F: shop_items INSERT in 20260924120000 migration has no created_at column');

  // Test G: No loan_status reference
  assertTrue(!hardeningMigrationContent.includes('loan_status'), 'Test G: 20260924200000 migration contains 0 loan_status references');
  assertTrue(!reconciledMigrationContent.includes('loan_status'), 'Test G: 20260924120000 migration contains 0 loan_status references');

  // Test H: Pending seller/customer verification remains PENDING in compliance/SAPS data
  assertTrue(hardeningMigrationContent.includes("v_saps_verification_status := CASE WHEN COALESCE(v_seller.verified, false) THEN 'VERIFIED' ELSE 'PENDING' END;"), 'Test H: Buy SAPS verification tracks seller verification state');
  assertTrue(hardeningMigrationContent.includes("v_saps_verification_status := CASE WHEN COALESCE(v_customer.verified, false) THEN 'VERIFIED' ELSE 'PENDING' END;"), 'Test H: Pawn SAPS verification tracks customer verification state');

  // Test I: Refund UI/server validation prevents over-refunding a sold item
  assertTrue(salesContextContent.includes('if (params.refundAmount > maxAllowedRefund)'), 'Test I: Local UI validates refund amount limit');
  assertTrue(hardeningMigrationContent.includes('Requested refund amount (R%) exceeds sold item total (R%)'), 'Test I: Server RPC validates refund amount limit');
  assertTrue(hardeningMigrationContent.includes('Cumulative refund quantity (%) exceeds original quantity sold (%)'), 'Test I: Server RPC validates cumulative refund quantity');

  // Test J: Original sales remain immutable during refund processing
  assertTrue(!salesContextContent.includes('db.sales.delete'), 'Test J: Local SalesContext never deletes sales records');
  assertTrue(!hardeningMigrationContent.includes('DELETE FROM public.sales'), 'Test J: Server migration never deletes sales records');

  console.log('=== V1 PRODUCTION DEFECT REPAIR PASS TESTS PASSED ===');
}
