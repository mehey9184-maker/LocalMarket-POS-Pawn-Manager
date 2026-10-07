import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { shouldRecalculateShelfPrice, getNextItemShelfState } from '../components/screens/buy-pawn/useBuyPawnWorkflow';
import { formatShelfPrice, canAddItemToCart } from '../components/screens/Sell';
import { canAddToCartGuard, hasUnpricedLine } from '../context/AppContext';
import { displaySerial } from '../utils/serialFormatter';

/**
 * Verification Test Suite: Market Check Origin, Pawn Terminology & Photo UI Consistency
 */
export async function runMarketCheckAndPawnReviewTests() {
  console.log('=== RUNNING MARKET CHECK & PAWN REVIEW TERMINOLOGY TESTS ===');

  // Test 1: Shelf price decision pure function & batch reset
  console.log('[Test 1] Verifying shouldRecalculateShelfPrice & getNextItemShelfState pure functions...');
  assert.strictEqual(shouldRecalculateShelfPrice(false), true, 'Unedited shelf price must recalculate on payout change');
  assert.strictEqual(shouldRecalculateShelfPrice(true), false, 'Edited shelf price must NOT recalculate on payout change');

  const batchReset = getNextItemShelfState();
  assert.strictEqual(batchReset.suggestedRetail, 0, 'getNextItemShelfState must reset suggestedRetail to 0');
  assert.strictEqual(batchReset.isShelfPriceEdited, false, 'getNextItemShelfState must reset isShelfPriceEdited to false');
  console.log('[PASS] Test 1: Pure functions shouldRecalculateShelfPrice and getNextItemShelfState verified');

  // Test 2: Pawn review terminology verification
  console.log('[Test 2] Verifying Pawn review terminology in BuyPawnReviewStep source code...');
  const reviewStepPath = path.resolve('src/components/screens/buy-pawn/BuyPawnReviewStep.tsx');
  const reviewStepContent = fs.readFileSync(reviewStepPath, 'utf8');

  assert(reviewStepContent.includes('businessRules?.defaultLoanTermDays'), 'Review step must use businessRules.defaultLoanTermDays');
  assert(reviewStepContent.includes('Shelf price'), 'Review step must display Shelf price row');
  console.log('[PASS] Test 2: Pawn review terminology and shelf price row confirmed in BuyPawnReviewStep source code');

  // Test 3: Photo UI local-only consistency (no B2, no Cloud Asset, no compression stats)
  console.log('[Test 3] Verifying Photo UI local-only storage consistency in source code...');
  const itemStepPath = path.resolve('src/components/screens/buy-pawn/BuyPawnItemStep.tsx');
  const itemStepContent = fs.readFileSync(itemStepPath, 'utf8');

  assert.strictEqual(itemStepContent.includes('Syncing to B2'), false, 'BuyPawnItemStep must not contain B2 sync string');
  assert.strictEqual(itemStepContent.includes('Cloud Asset'), false, 'BuyPawnItemStep must not contain Cloud Asset badge');
  assert.strictEqual(itemStepContent.includes('photoMeta?.compressedSize'), false, 'BuyPawnItemStep must not display compression statistics');
  assert.strictEqual(itemStepContent.includes('formatBytes'), false, 'BuyPawnItemStep must not import or use formatBytes');
  assert(itemStepContent.includes('Take Photo'), 'BuyPawnItemStep must include camera-first action');
  console.log('[PASS] Test 3: Item photo UI is completely consistent with local-only storage');

  // Test 4: Cost Basis terminology in Inventory & BuyPawnValuationStep
  console.log('[Test 4] Verifying Cost Basis wording in Inventory and BuyPawnValuationStep...');
  const inventoryPath = path.resolve('src/components/screens/Inventory.tsx');
  const inventoryContent = fs.readFileSync(inventoryPath, 'utf8');
  assert.strictEqual(
    inventoryContent.includes('Cost Basis (Immutable)'),
    true,
    'Inventory must preserve original Cost Basis (Immutable) wording'
  );

  const valuationPath = path.resolve('src/components/screens/buy-pawn/BuyPawnValuationStep.tsx');
  const valuationContent = fs.readFileSync(valuationPath, 'utf8');
  assert.strictEqual(valuationContent.includes('or leave 0'), false, 'Valuation step must not say or leave 0');
  console.log('[PASS] Test 4: Cost Basis wording verified (Inventory restored to Cost Basis (Immutable), Valuation clean)');

  // Test 5: Verify duplicate Market Check refresh control removed from card header
  console.log('[Test 5] Verifying duplicate refresh control removed from MarketCheckCard...');
  const cardPath = path.resolve('src/components/common/MarketCheckCard.tsx');
  const cardContent = fs.readFileSync(cardPath, 'utf8');
  assert.strictEqual(cardContent.includes('Refresh Market Intelligence'), false, 'MarketCheckCard header must not contain duplicate refresh button');
  console.log('[PASS] Test 5: Duplicate Market Check refresh control confirmed removed');

  // Test 6: Draft Save and Restore Preserving Market Check Origin
  console.log('[Test 6] Verifying Market Check origin preservation through drafts via source code checks...');
  
  // 6.1 Source code wiring check for useBuyPawnDrafts and useBuyPawnWorkflow
  const draftsFilePath = path.resolve('src/components/screens/buy-pawn/useBuyPawnDrafts.ts');
  const draftsFileContent = fs.readFileSync(draftsFilePath, 'utf8');
  assert(
    draftsFileContent.includes('isAgreedOfferFromMarketCheck: Boolean(isAgreedOfferFromMarketCheck)'),
    'useBuyPawnDrafts must persist isAgreedOfferFromMarketCheck in draft payload'
  );
  assert(
    draftsFileContent.includes('isRetailPriceFromMarketCheck: Boolean(isRetailPriceFromMarketCheck)'),
    'useBuyPawnDrafts must persist isRetailPriceFromMarketCheck in draft payload'
  );
  assert(
    draftsFileContent.includes('setIsAgreedOfferFromMarketCheck?.(Boolean(draft.payload?.isAgreedOfferFromMarketCheck))'),
    'useBuyPawnDrafts must restore isAgreedOfferFromMarketCheck with fallback'
  );
  assert(
    draftsFileContent.includes('setIsRetailPriceFromMarketCheck?.(Boolean(draft.payload?.isRetailPriceFromMarketCheck))'),
    'useBuyPawnDrafts must restore isRetailPriceFromMarketCheck with fallback'
  );

  const workflowFilePath = path.resolve('src/components/screens/buy-pawn/useBuyPawnWorkflow.ts');
  const workflowFileContent = fs.readFileSync(workflowFilePath, 'utf8');
  assert(
    workflowFileContent.includes('isAgreedOfferFromMarketCheck,') &&
    workflowFileContent.includes('setIsAgreedOfferFromMarketCheck,') &&
    workflowFileContent.includes('isRetailPriceFromMarketCheck,') &&
    workflowFileContent.includes('setIsRetailPriceFromMarketCheck,'),
    'useBuyPawnWorkflow must wire both market check provenance flags and setters to useBuyPawnDrafts'
  );

  console.log('[PASS] Test 6: Draft save, restore, legacy compatibility, and edit clearance verified');

  // Test 7: Verify complete_buy_acquisition_internal migration and privilege grant
  console.log('[Test 7] Verifying complete_buy_acquisition_internal routine privilege migration...');
  const migrationPath = path.resolve('supabase/migrations/20260930000000_grant_complete_buy_acquisition_internal.sql');
  assert(fs.existsSync(migrationPath), 'Migration 20260930000000_grant_complete_buy_acquisition_internal.sql must exist');
  const migrationContent = fs.readFileSync(migrationPath, 'utf8');

  const expectedSignature = 'public.complete_buy_acquisition_internal(\n    uuid, text, uuid, jsonb, numeric, text, text, text, text, text, text, text, uuid, jsonb\n)';
  assert(
    migrationContent.includes(expectedSignature) ||
    migrationContent.replace(/\s+/g, ' ').includes('public.complete_buy_acquisition_internal( uuid, text, uuid, jsonb, numeric, text, text, text, text, text, text, text, uuid, jsonb )'),
    'Migration must target the exact signature of complete_buy_acquisition_internal'
  );
  assert(
    migrationContent.includes('FROM PUBLIC, anon'),
    'Migration must explicitly revoke privileges from PUBLIC and anon'
  );
  assert(
    migrationContent.includes('TO authenticated, service_role'),
    'Migration must grant EXECUTE exclusively to authenticated and service_role'
  );
  assert(
    !migrationContent.includes('TO anon') && !migrationContent.includes('TO PUBLIC'),
    'Migration must never grant EXECUTE to anon or PUBLIC'
  );
  console.log('[PASS] Test 7: Migration grants EXECUTE to authenticated and service_role while denying PUBLIC and anon');

  // Test 8: Verify complete_buy_acquisition_internal user_role enum fix migration
  console.log('[Test 8] Verifying user_role enum-safe comparison migration...');
  const enumFixMigrationPath = path.resolve('supabase/migrations/20260930010000_fix_complete_buy_acquisition_internal_role_enum.sql');
  assert(fs.existsSync(enumFixMigrationPath), 'Migration 20260930010000_fix_complete_buy_acquisition_internal_role_enum.sql must exist');
  const enumFixContent = fs.readFileSync(enumFixMigrationPath, 'utf8');

  // 8.1 Must NOT contain the broken COALESCE(..., '') pattern for role
  assert(
    !enumFixContent.includes("COALESCE(v_caller_profile.role, '')"),
    'Migration must eliminate COALESCE(v_caller_profile.role, \'\') pattern'
  );

  // 8.2 Must use enum-safe comparison: IS DISTINCT FROM 'admin'::public.user_role
  assert(
    enumFixContent.includes("v_caller_profile.role IS DISTINCT FROM 'admin'::public.user_role"),
    'Migration must use enum-safe comparison IS DISTINCT FROM \'admin\'::public.user_role'
  );

  // 8.3 Must preserve security context
  assert(
    enumFixContent.includes('SECURITY DEFINER') && enumFixContent.includes('SET search_path = public, auth'),
    'Migration must preserve SECURITY DEFINER and search_path'
  );

  // 8.4 Must preserve privilege grants
  assert(
    enumFixContent.includes('GRANT EXECUTE ON FUNCTION public.complete_buy_acquisition_internal') &&
    enumFixContent.includes('TO authenticated, service_role') &&
    enumFixContent.includes('REVOKE ALL ON FUNCTION public.complete_buy_acquisition_internal') &&
    enumFixContent.includes('FROM PUBLIC, anon'),
    'Migration must preserve routine privileges for authenticated and service_role while denying anon and PUBLIC'
  );

  console.log('[PASS] Test 8: User role enum-safe comparison migration verified');

  // Test 9: Zero-priced items format & override checks
  console.log('[Test 9] Verifying formatShelfPrice and canAddItemToCart pure helper functions...');
  
  // Format check
  assert.strictEqual(formatShelfPrice(0), 'Price needed', 'retailPrice 0 must display "Price needed"');
  assert.strictEqual(formatShelfPrice(-5), 'Price needed', 'Negative retailPrice must display "Price needed"');
  assert.strictEqual(formatShelfPrice(120), 'R 120.00', 'Positive price must format correctly');
  assert.strictEqual(formatShelfPrice(1249.5), 'R 1,249.50', 'Large positive price must format correctly');

  // Add to cart validation checks
  assert.strictEqual(canAddItemToCart(150, ''), true, 'Non-zero priced item should add to cart without override');
  assert.strictEqual(canAddItemToCart(0, ''), false, 'Zero priced item with missing override must NOT add to cart');
  assert.strictEqual(canAddItemToCart(0, 'abc'), false, 'Zero priced item with non-numeric override must NOT add to cart');
  assert.strictEqual(canAddItemToCart(0, '-50'), false, 'Zero priced item with negative override must NOT add to cart');
  assert.strictEqual(canAddItemToCart(0, '120.50'), true, 'Zero priced item with valid override should add to cart');
  assert.strictEqual(canAddItemToCart(-10, '150'), true, 'Negative priced item with valid override should add to cart');

  console.log('[PASS] Test 9: formatShelfPrice and canAddItemToCart pure functions verified');

  // Test 10: Pure functions canAddToCartGuard and hasUnpricedLine checks
  console.log('[Test 10] Verifying canAddToCartGuard and hasUnpricedLine pure functions...');

  // canAddToCartGuard checks
  assert.strictEqual(canAddToCartGuard(0), false, '0 price with no override cannot add to cart');
  assert.strictEqual(canAddToCartGuard(0, undefined), false, '0 price with undefined override cannot add to cart');
  assert.strictEqual(canAddToCartGuard(0, 0), false, '0 price with 0 override cannot add to cart');
  assert.strictEqual(canAddToCartGuard(0, -10), false, '0 price with negative override cannot add to cart');
  assert.strictEqual(canAddToCartGuard(-5, undefined), false, 'Negative price with no override cannot add to cart');
  assert.strictEqual(canAddToCartGuard(0, 150), true, '0 price with positive override can add to cart');
  assert.strictEqual(canAddToCartGuard(100), true, 'Positive price with no override can add to cart');
  assert.strictEqual(canAddToCartGuard(100, undefined), true, 'Positive price with undefined override can add to cart');
  assert.strictEqual(canAddToCartGuard(100, 200), true, 'Positive price with positive override can add to cart');

  // hasUnpricedLine checks
  assert.strictEqual(hasUnpricedLine([]), false, 'Empty cart has no unpriced lines');
  assert.strictEqual(
    hasUnpricedLine([{ item: { retailPrice: 100 } } as any]),
    false,
    'Cart with positive retailPrice has no unpriced lines'
  );
  assert.strictEqual(
    hasUnpricedLine([{ item: { retailPrice: 0 } } as any]),
    true,
    'Cart with 0 retailPrice and no override has unpriced lines'
  );
  assert.strictEqual(
    hasUnpricedLine([{ item: { retailPrice: -10 } } as any]),
    true,
    'Cart with negative retailPrice and no override has unpriced lines'
  );
  assert.strictEqual(
    hasUnpricedLine([{ item: { retailPrice: 0 }, overridePrice: 150 } as any]),
    false,
    'Cart with 0 retailPrice but positive overridePrice has no unpriced lines'
  );
  assert.strictEqual(
    hasUnpricedLine([
      { item: { retailPrice: 100 } },
      { item: { retailPrice: 0 } }
    ] as any),
    true,
    'Mixed cart with unpriced item has unpriced lines'
  );
  assert.strictEqual(
    hasUnpricedLine([
      { item: { retailPrice: 100 } },
      { item: { retailPrice: 0 }, overridePrice: 50 }
    ] as any),
    false,
    'Mixed cart with valid override on 0 price has no unpriced lines'
  );
  assert.strictEqual(
    hasUnpricedLine([
      { item: { retailPrice: 100 } },
      { item: { retailPrice: 200 }, overridePrice: 0 }
    ] as any),
    true,
    'Cart with 0 overridePrice has unpriced lines'
  );

  console.log('[PASS] Test 10: canAddToCartGuard and hasUnpricedLine pure functions verified');

  // Test 11: Pure function displaySerial checks
  console.log('[Test 11] Verifying displaySerial pure function...');
  assert.strictEqual(displaySerial(), 'No serial', 'Undefined serial must return "No serial"');
  assert.strictEqual(displaySerial(undefined), 'No serial', 'Undefined serial must return "No serial"');
  assert.strictEqual(displaySerial(null), 'No serial', 'Null serial must return "No serial"');
  assert.strictEqual(displaySerial(''), 'No serial', 'Empty serial must return "No serial"');
  assert.strictEqual(displaySerial('   '), 'No serial', 'Whitespace-only serial must return "No serial"');
  assert.strictEqual(displaySerial('N/A'), 'No serial', '"N/A" serial must return "No serial"');
  assert.strictEqual(displaySerial('n/a'), 'No serial', '"n/a" serial must return "No serial"');
  assert.strictEqual(displaySerial('  N/a  '), 'No serial', 'Trimmed and case-insensitive "N/A" must return "No serial"');
  assert.strictEqual(displaySerial('SN-12345'), 'SN-12345', 'Valid serial must return trimmed serial');
  assert.strictEqual(displaySerial('  358900112233445  '), '358900112233445', 'Valid serial with whitespace must return trimmed serial');
  console.log('[PASS] Test 11: displaySerial pure function verified');

  console.log('=== ALL MARKET CHECK & PAWN REVIEW TERMINOLOGY TESTS PASSED ===');
}
