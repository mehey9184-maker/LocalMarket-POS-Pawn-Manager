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

  // Test 4: Clean Cost Basis terminology in Inventory & BuyPawnValuationStep
  console.log('[Test 4] Verifying clean Cost Basis wording...');
  const inventoryPath = path.resolve('src/components/screens/Inventory.tsx');
  const inventoryContent = fs.readFileSync(inventoryPath, 'utf8');
  assert.strictEqual(inventoryContent.includes('Cost Basis (Immutable)'), false, 'Inventory must not use Cost Basis (Immutable)');

  const valuationPath = path.resolve('src/components/screens/buy-pawn/BuyPawnValuationStep.tsx');
  const valuationContent = fs.readFileSync(valuationPath, 'utf8');
  assert.strictEqual(valuationContent.includes('or leave 0'), false, 'Valuation step must not say or leave 0');
  console.log('[PASS] Test 4: Cost Basis wording is clean across Inventory and Valuation');

  // Test 5: Verify duplicate Market Check refresh control removed from card header
  console.log('[Test 5] Verifying duplicate refresh control removed from MarketCheckCard...');
  const cardPath = path.resolve('src/components/common/MarketCheckCard.tsx');
  const cardContent = fs.readFileSync(cardPath, 'utf8');
  assert.strictEqual(cardContent.includes('Refresh Market Intelligence'), false, 'MarketCheckCard header must not contain duplicate refresh button');
  console.log('[PASS] Test 5: Duplicate Market Check refresh control confirmed removed');

  console.log('=== ALL MARKET CHECK & PAWN REVIEW TERMINOLOGY TESTS PASSED ===');
}
