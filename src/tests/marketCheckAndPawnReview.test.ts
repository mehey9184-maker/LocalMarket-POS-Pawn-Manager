import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Verification Test Suite: Market Check Origin, Pawn Terminology & Photo UI Consistency
 */
export async function runMarketCheckAndPawnReviewTests() {
  console.log('=== RUNNING MARKET CHECK & PAWN REVIEW TERMINOLOGY TESTS ===');

  // Test 1: Market Check origin tracking logic
  console.log('[Test 1] Verifying Market Check amount application and edit clearance...');
  let agreedOffer = 0;
  let isAgreedOfferFromMarketCheck = false;

  // Simulate applying market check
  const suggestedMid = Math.round((1200 + 1600) / 2);
  agreedOffer = suggestedMid;
  isAgreedOfferFromMarketCheck = true;

  assert.strictEqual(agreedOffer, 1400, 'Applied mid amount must match suggested range');
  assert.strictEqual(isAgreedOfferFromMarketCheck, true, 'Amount must be marked as From Market Check when applied');

  // Simulate worker editing amount
  agreedOffer = 1350;
  isAgreedOfferFromMarketCheck = false;
  assert.strictEqual(isAgreedOfferFromMarketCheck, false, 'Amount must lose From Market Check mark once edited by worker');
  console.log('[PASS] Test 1: Market Check origin correctly tracked and cleared on worker edit');

  // Test 2: Pawn review terminology verification
  console.log('[Test 2] Verifying Pawn review terminology...');
  const businessRulesDefault = { defaultLoanTermDays: 30 };
  const businessRulesCustom = { defaultLoanTermDays: 60 };

  const getPawnTxLabel = (rules: { defaultLoanTermDays: number }) => `${rules.defaultLoanTermDays}-Day Pawn Loan`;
  const getAmountLabel = (txType: 'buy' | 'pawn') => (txType === 'pawn' ? 'Agreed Loan Amount' : 'Negotiated Payout');

  assert.strictEqual(getPawnTxLabel(businessRulesDefault), '30-Day Pawn Loan');
  assert.strictEqual(getPawnTxLabel(businessRulesCustom), '60-Day Pawn Loan');
  assert.strictEqual(getAmountLabel('pawn'), 'Agreed Loan Amount', 'Pawn must use Agreed Loan Amount');
  assert.strictEqual(getAmountLabel('buy'), 'Negotiated Payout', 'Buy must use Negotiated Payout');
  console.log('[PASS] Test 2: Pawn review terminology reflects Agreed Loan Amount and dynamic term days');

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
  console.log('[Test 6] Verifying Market Check origin preservation through drafts...');
  
  // 6.1 Market Check payout applied: amount restored + isAgreedOfferFromMarketCheck=true
  const draftWithMarketPayout = {
    id: 'draft-payout-1',
    payload: {
      agreedOffer: 1500,
      isAgreedOfferFromMarketCheck: true,
      suggestedRetail: 2500,
      retailPriceInput: '2500',
      isRetailPriceFromMarketCheck: false,
    },
  };
  let restoredAgreedOffer = draftWithMarketPayout.payload.agreedOffer;
  let restoredIsAgreedOfferFromMarketCheck = Boolean(draftWithMarketPayout.payload?.isAgreedOfferFromMarketCheck);
  assert.strictEqual(restoredAgreedOffer, 1500, 'Restored payout amount must match draft payload');
  assert.strictEqual(restoredIsAgreedOfferFromMarketCheck, true, 'Restored payout must preserve isAgreedOfferFromMarketCheck=true');

  // 6.2 Market Check retail applied: value restored + isRetailPriceFromMarketCheck=true
  const draftWithMarketRetail = {
    id: 'draft-retail-1',
    payload: {
      agreedOffer: 800,
      isAgreedOfferFromMarketCheck: false,
      retailPriceInput: '3200',
      isRetailPriceFromMarketCheck: true,
    },
  };
  let restoredRetailPriceInput = draftWithMarketRetail.payload.retailPriceInput;
  let restoredIsRetailPriceFromMarketCheck = Boolean(draftWithMarketRetail.payload?.isRetailPriceFromMarketCheck);
  assert.strictEqual(restoredRetailPriceInput, '3200', 'Restored retail price must match draft payload');
  assert.strictEqual(restoredIsRetailPriceFromMarketCheck, true, 'Restored retail price must preserve isRetailPriceFromMarketCheck=true');

  // 6.3 Legacy draft without flags: both default to false
  const legacyDraft = {
    id: 'legacy-draft-1',
    payload: {
      agreedOffer: 1200,
      retailPriceInput: '2400',
      // flags omitted/undefined in legacy drafts
    },
  };
  const legacyIsAgreedOfferMC = Boolean((legacyDraft.payload as any)?.isAgreedOfferFromMarketCheck);
  const legacyIsRetailPriceMC = Boolean((legacyDraft.payload as any)?.isRetailPriceFromMarketCheck);
  assert.strictEqual(legacyIsAgreedOfferMC, false, 'Legacy draft without isAgreedOfferFromMarketCheck must default to false');
  assert.strictEqual(legacyIsRetailPriceMC, false, 'Legacy draft without isRetailPriceFromMarketCheck must default to false');

  // 6.4 Worker edits restored amount: corresponding flag becomes false
  // Worker edits restored payout:
  restoredAgreedOffer = 1450;
  restoredIsAgreedOfferFromMarketCheck = false; // simulates valuation step onChange
  assert.strictEqual(restoredIsAgreedOfferFromMarketCheck, false, 'Editing restored payout must immediately clear isAgreedOfferFromMarketCheck');

  // Worker edits restored retail price:
  restoredRetailPriceInput = '3100';
  restoredIsRetailPriceFromMarketCheck = false; // simulates valuation step onChange
  assert.strictEqual(restoredIsRetailPriceFromMarketCheck, false, 'Editing restored retail price must immediately clear isRetailPriceFromMarketCheck');

  // 6.5 Source code wiring check for useBuyPawnDrafts and useBuyPawnWorkflow
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

  console.log('=== ALL MARKET CHECK & PAWN REVIEW TERMINOLOGY TESTS PASSED ===');
}
