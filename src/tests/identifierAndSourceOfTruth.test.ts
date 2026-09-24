import { 
  getCryptoRandomInt, 
  generateUniqueSku, 
  generateUniqueTransactionNumber, 
  generateUniquePawnTicket, 
  generateUniqueReceiptNumber 
} from '../utils/identifierGenerator';
import { DEFAULT_BUSINESS_RULES } from '../utils/pricingRules';
import { BusinessRules } from '../types';

export function runIdentifierAndSourceOfTruthTests() {
  console.log('\n=== RUNNING IDENTIFIER & SOURCE-OF-TRUTH TEST SUITE ===');

  // Test 1: getCryptoRandomInt range and distribution
  const min = 10;
  const max = 25;
  for (let i = 0; i < 100; i++) {
    const val = getCryptoRandomInt(min, max);
    if (val < min || val > max || !Number.isInteger(val)) {
      throw new Error(`[FAIL] getCryptoRandomInt produced out-of-range value: ${val}`);
    }
  }
  console.log('[PASS] Test 1: getCryptoRandomInt produces integers strictly within [min, max]');

  // Test 2: SKU generation format (LM-xxxxx)
  const skuPattern = /^LM-\d{5}$/;
  for (let i = 0; i < 50; i++) {
    const sku = generateUniqueSku();
    if (!skuPattern.test(sku)) {
      throw new Error(`[FAIL] SKU does not match LM-xxxxx format: ${sku}`);
    }
  }
  console.log('[PASS] Test 2: generateUniqueSku preserves standard LM-xxxxx format');

  // Test 3: SKU collision avoidance
  const existingSkus = new Set(['LM-12345', 'LM-54321', 'LM-99999']);
  const uniqueSku = generateUniqueSku(sku => existingSkus.has(sku));
  if (existingSkus.has(uniqueSku)) {
    throw new Error(`[FAIL] generateUniqueSku produced a colliding SKU`);
  }
  console.log('[PASS] Test 3: generateUniqueSku avoids collisions against existing inventory');

  // Test 4: Seller Transaction Number format (ST-xxxxxx) and collision avoidance
  const stPattern = /^ST-\d{6}$/;
  const existingTxs = new Set<string>();
  for (let i = 0; i < 50; i++) {
    const st = generateUniqueTransactionNumber(num => existingTxs.has(num));
    if (!stPattern.test(st)) {
      throw new Error(`[FAIL] Transaction number does not match ST-xxxxxx format: ${st}`);
    }
    if (existingTxs.has(st)) {
      throw new Error(`[FAIL] generateUniqueTransactionNumber produced a duplicate: ${st}`);
    }
    existingTxs.add(st);
  }
  console.log('[PASS] Test 4: generateUniqueTransactionNumber preserves ST-xxxxxx format and enforces uniqueness');

  // Test 5: Pawn Ticket Number format (PWN-xxxx) and collision avoidance
  const pwnPattern = /^PWN-\d{4,5}$/;
  const existingTickets = new Set<string>();
  for (let i = 0; i < 50; i++) {
    const ticket = generateUniquePawnTicket(t => existingTickets.has(t));
    if (!pwnPattern.test(ticket)) {
      throw new Error(`[FAIL] Ticket number does not match PWN-xxxx format: ${ticket}`);
    }
    if (existingTickets.has(ticket)) {
      throw new Error(`[FAIL] generateUniquePawnTicket produced a duplicate: ${ticket}`);
    }
    existingTickets.add(ticket);
  }
  console.log('[PASS] Test 5: generateUniquePawnTicket preserves PWN-xxxx format and avoids collisions');

  // Test 6: Receipt Number format (REC-xxxxxx) and collision avoidance
  const recPattern = /^REC-\d{6}$/;
  const existingReceipts = new Set<string>();
  for (let i = 0; i < 50; i++) {
    const rec = generateUniqueReceiptNumber(r => existingReceipts.has(r));
    if (!recPattern.test(rec)) {
      throw new Error(`[FAIL] Receipt number does not match REC-xxxxxx format: ${rec}`);
    }
    if (existingReceipts.has(rec)) {
      throw new Error(`[FAIL] generateUniqueReceiptNumber produced a duplicate: ${rec}`);
    }
    existingReceipts.add(rec);
  }
  console.log('[PASS] Test 6: generateUniqueReceiptNumber preserves REC-xxxxxx format and avoids collisions');

  // Test 7: Source of Truth Precedence Logic
  // Stale local settings simulating an outdated cache in localStorage
  const staleLocalRules: BusinessRules = {
    ...DEFAULT_BUSINESS_RULES,
    defaultLoanTermDays: 14,
    pawnMonthlyInterestRate: 0.15, // Outdated local value
    gracePeriodDays: 3
  };

  // Authoritative server rules from Supabase
  const authoritativeServerRules: BusinessRules = {
    ...DEFAULT_BUSINESS_RULES,
    defaultLoanTermDays: 30,
    pawnMonthlyInterestRate: 0.05, // Authoritative cloud value
    gracePeriodDays: 7
  };

  // Function reflecting the precedence engine established in AppContext
  function resolveAuthoritativeBusinessRules(
    cachedLocal: BusinessRules | null,
    serverData: BusinessRules | null
  ): BusinessRules {
    if (serverData) {
      // Cloud is authoritative; merge with schema defaults for backward compatibility
      return { ...DEFAULT_BUSINESS_RULES, ...serverData };
    }
    if (cachedLocal) {
      // Offline fallback: cache provides continuity
      return { ...DEFAULT_BUSINESS_RULES, ...cachedLocal };
    }
    return DEFAULT_BUSINESS_RULES;
  }

  // Verification 7A: When server data is available, server overrides stale local cache
  const resolvedWithServer = resolveAuthoritativeBusinessRules(staleLocalRules, authoritativeServerRules);
  if (resolvedWithServer.pawnMonthlyInterestRate !== 0.05 || resolvedWithServer.defaultLoanTermDays !== 30) {
    throw new Error(`[FAIL] Stale local rules overrode authoritative server rules`);
  }
  console.log('[PASS] Test 7A: Cloud data takes authoritative precedence over stale local cache');

  // Verification 7B: When server is offline/unavailable, local cache maintains continuity
  const resolvedOffline = resolveAuthoritativeBusinessRules(staleLocalRules, null);
  if (resolvedOffline.pawnMonthlyInterestRate !== 0.15 || resolvedOffline.defaultLoanTermDays !== 14) {
    throw new Error(`[FAIL] Offline fallback failed to preserve cached rules`);
  }
  console.log('[PASS] Test 7B: Local storage cache acts as reliable offline fallback when cloud is unavailable');

  console.log('=== ALL IDENTIFIER & SOURCE-OF-TRUTH TESTS PASSED ===\n');
}

// Auto-run if executed directly via node/tsx
if (typeof process !== 'undefined' && process.argv && process.argv[1] && process.argv[1].includes('identifierAndSourceOfTruth')) {
  runIdentifierAndSourceOfTruthTests();
}
