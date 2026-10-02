import assert from 'node:assert';
import { normalizeScannerInput } from '../utils/scannerNormalizer';
import { InventoryItem } from '../types';

/**
 * Phase 2D Test Suite: Barcode Scanner Input Cleanup & Exact-Match Hygiene
 */
export async function runPhase2dBarcodeScannerTests() {
  console.log('=== RUNNING PHASE 2D BARCODE SCANNER INPUT CLEANUP TEST SUITE ===');

  // --- 1. Basic Normalization ---
  assert.strictEqual(
    normalizeScannerInput('6001234567890\n'),
    '6001234567890',
    'Trailing newline must be removed'
  );
  assert.strictEqual(
    normalizeScannerInput('\r6001234567890\r\n'),
    '6001234567890',
    'Leading and trailing CRLF must be removed'
  );
  assert.strictEqual(
    normalizeScannerInput(' 6001234567890 '),
    '6001234567890',
    'Leading and trailing whitespace must be trimmed'
  );
  assert.strictEqual(
    normalizeScannerInput('\x026001234567890\x03\r\n'),
    '6001234567890',
    'Control characters (STX/ETX/CR/LF) must be removed'
  );
  console.log('[PASS] Test 1: Basic barcode input normalization verified');

  // --- 2. Empty Input Handling ---
  assert.strictEqual(normalizeScannerInput(''), '', 'Empty string returns empty string');
  assert.strictEqual(normalizeScannerInput('   \r\n\t  '), '', 'Whitespace-only input returns empty string');
  assert.strictEqual(normalizeScannerInput(null), '', 'null returns empty string');
  assert.strictEqual(normalizeScannerInput(undefined), '', 'undefined returns empty string');
  console.log('[PASS] Test 2: Empty / whitespace / null input safety verified');

  // --- 3. Alphanumeric Identifier Preservation ---
  assert.strictEqual(
    normalizeScannerInput('ABC-123\n'),
    'ABC-123',
    'Hyphens, uppercase letters, and numbers must be preserved'
  );
  assert.strictEqual(
    normalizeScannerInput('SKU/2026+001\r\n'),
    'SKU/2026+001',
    'Slashes and plus signs must be preserved'
  );
  assert.strictEqual(
    normalizeScannerInput('item.code.99\t'),
    'item.code.99',
    'Dots and lowercase characters must be preserved'
  );
  console.log('[PASS] Test 3: Alphanumeric SKU & special character preservation verified');

  // --- 4. Serial & IMEI Safety ---
  assert.strictEqual(
    normalizeScannerInput('IMEI-990000112233445\r\n'),
    'IMEI-990000112233445',
    'IMEI identifiers with hyphens and digits preserved'
  );
  assert.strictEqual(
    normalizeScannerInput('SN/2026/XYZ.01\n'),
    'SN/2026/XYZ.01',
    'Serial numbers with alphanumeric slash/dot structure preserved'
  );
  console.log('[PASS] Test 4: Serial and IMEI safety verified');

  // --- 5. Enter Behavior & Duplicate Prevention Simulation ---
  let cartCount = 0;
  let lastScan = { query: '', time: 0 };

  const simulateScanSubmit = (rawInput: string, now: number) => {
    const cleanQuery = normalizeScannerInput(rawInput);
    if (!cleanQuery) return false;

    // Duplicate check within 300ms window
    if (lastScan.query.toLowerCase() === cleanQuery.toLowerCase() && now - lastScan.time < 300) {
      return false; // Ignored as duplicate scanner enter trigger
    }
    lastScan = { query: cleanQuery, time: now };
    cartCount += 1;
    return true;
  };

  const t0 = 1000;
  // First scan event fired by scanner
  const firstTrigger = simulateScanSubmit('6001234567890\r\n', t0);
  assert.strictEqual(firstTrigger, true, 'First scan should succeed');
  assert.strictEqual(cartCount, 1, 'Cart count incremented once');

  // Rapid duplicate Enter event fired 10ms later by scanner suffix
  const duplicateTrigger = simulateScanSubmit('6001234567890', t0 + 10);
  assert.strictEqual(duplicateTrigger, false, 'Rapid duplicate scan within 300ms must be ignored');
  assert.strictEqual(cartCount, 1, 'Cart count remains 1');

  // Subsequent scan 500ms later for a different item
  const nextItemTrigger = simulateScanSubmit('6009999999999\n', t0 + 500);
  assert.strictEqual(nextItemTrigger, true, 'Subsequent scan for different item succeeds');
  assert.strictEqual(cartCount, 2, 'Cart count incremented to 2');

  console.log('[PASS] Test 5: Rapid duplicate scan prevention verified');

  // --- 6. Exact Match Inventory Matching with Normalized Input ---
  const mockInventory: InventoryItem[] = [
    {
      id: 'inv-1',
      title: 'Samsung Galaxy A15 128GB',
      sku: 'SKU-A15-001',
      category: 'Smartphones',
      condition: 'Mint',
      retailPrice: 2499,
      costBasis: 1500,
      status: 'Retail Floor',
      serialOrImei: '358900112233445',
      pawnTicketId: 'PAWN-2026-101',
      imageUrl: '',
      acquisitionType: 'Buy',
      addedAt: '2026-01-01'
    }
  ];

  const findItemByRawScan = (rawScan: string) => {
    const clean = normalizeScannerInput(rawScan);
    if (!clean) return null;
    return mockInventory.find(
      i =>
        i.sku.toLowerCase() === clean.toLowerCase() ||
        (i.serialOrImei && i.serialOrImei.toLowerCase() === clean.toLowerCase()) ||
        (i.pawnTicketId && i.pawnTicketId.toLowerCase() === clean.toLowerCase())
    ) || null;
  };

  const matchedBySkuWithNewline = findItemByRawScan('\rSKU-A15-001\r\n');
  assert.ok(matchedBySkuWithNewline, 'Matched item by SKU with CRLF prefix/suffix');
  assert.strictEqual(matchedBySkuWithNewline?.id, 'inv-1');

  const matchedByImeiWithWhitespace = findItemByRawScan('  358900112233445 \n');
  assert.ok(matchedByImeiWithWhitespace, 'Matched item by IMEI with trailing space & newline');
  assert.strictEqual(matchedByImeiWithWhitespace?.id, 'inv-1');

  const matchedByPawnTicket = findItemByRawScan('PAWN-2026-101\n');
  assert.ok(matchedByPawnTicket, 'Matched item by Pawn Ticket ID with newline');
  assert.strictEqual(matchedByPawnTicket?.id, 'inv-1');

  console.log('[PASS] Test 6: Exact-match inventory search with normalized scanner input verified');

  console.log('====================================================');
  console.log('   ALL PHASE 2D BARCODE SCANNER TESTS PASSED!       ');
  console.log('====================================================');
}
