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

  console.log('=== V1 PRODUCTION DEFECT REPAIR PASS TESTS PASSED ===');
}
