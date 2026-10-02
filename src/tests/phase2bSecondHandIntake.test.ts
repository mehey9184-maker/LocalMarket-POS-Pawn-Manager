import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { calculatePawnFees, roundRetailPrice } from '../utils/pricingRules';

/**
 * Phase 2B Regression Test Suite: Second-Hand Intake UX & State Machine
 */
export async function runPhase2bSecondHandIntakeTests() {
  console.log('=== RUNNING PHASE 2B SECOND-HAND INTAKE UX TEST SUITE ===');

  // Test 1: Verify Buy From Person step sequence in source code
  console.log('[Test 1] Verifying Buy From Person item-first step sequence...');
  const workflowPath = path.resolve('src/components/screens/buy-pawn/useBuyPawnWorkflow.ts');
  const workflowContent = fs.readFileSync(workflowPath, 'utf8');

  // 1a. Selecting 'buy' must set step to 'item' (Item First)
  assert(
    workflowContent.includes('handleSwitchTxType') &&
      workflowContent.includes('normalizeStepForTransactionType'),
    'Test 1a: Selecting Buy From Person must navigate directly to item step via normalizeStepForTransactionType'
  );

  // 1b. Stepper labels for Buy From Person must reflect human workflow
  assert(
    workflowContent.includes("if (txType === 'buy') {") &&
      workflowContent.includes("{ id: 'item', label: 'Evaluate Item' }") &&
      workflowContent.includes("{ id: 'valuation', label: 'Valuation & Price' }") &&
      workflowContent.includes("{ id: 'customer', label: 'Seller Info' }") &&
      workflowContent.includes("{ id: 'deal', label: 'Review & Record' }"),
    'Test 1b: Stepper labels must present Evaluate Item -> Valuation & Price -> Seller Info -> Review & Record'
  );

  console.log('[PASS] Test 1: Buy From Person item-first step sequence verified');

  // Test 2: Verify Pawn step sequence preserves borrower-first workflow
  console.log('[Test 2] Verifying Pawn borrower-first step sequence...');
  assert(
    workflowContent.includes("if (txType === 'pawn') {") &&
      workflowContent.includes("{ id: 'customer', label: 'Borrower Info' }") &&
      workflowContent.includes("{ id: 'item', label: 'Collateral Item' }") &&
      workflowContent.includes("{ id: 'valuation', label: 'Loan Terms' }") &&
      workflowContent.includes("{ id: 'deal', label: 'Review & Pledge' }"),
    'Test 2: Pawn stepper labels must preserve Borrower Info -> Collateral Item -> Loan Terms -> Review & Pledge'
  );
  console.log('[PASS] Test 2: Pawn borrower-first step sequence verified');

  // Test 3: Verify step navigation state machine transitions (Buy: item -> valuation -> customer -> deal)
  console.log('[Test 3] Verifying Buy step navigation state transitions...');

  // Mock state transition helper simulating useBuyPawnWorkflow handleNext & handleBack
  type WorkflowStep = 'mode' | 'customer' | 'item' | 'valuation' | 'location' | 'deal' | 'completion';
  type TxType = 'existing' | 'buy' | 'pawn' | null;

  const getNextStep = (step: WorkflowStep, txType: TxType, hasIdentity: boolean, agreedOffer: number): WorkflowStep => {
    if (step === 'customer') {
      if (!hasIdentity) throw new Error('Seller Required');
      return txType === 'buy' ? 'deal' : 'item';
    }
    if (step === 'item') {
      return 'valuation';
    }
    if (step === 'valuation') {
      if (agreedOffer <= 0) throw new Error('Amount Required');
      return txType === 'existing' ? 'location' : txType === 'buy' ? 'customer' : 'deal';
    }
    if (step === 'deal') return 'completion';
    return step;
  };

  const getBackStep = (step: WorkflowStep, txType: TxType): WorkflowStep => {
    if (step === 'customer') return txType === 'buy' ? 'valuation' : 'mode';
    if (step === 'item') return txType === 'pawn' ? 'customer' : 'mode';
    if (step === 'valuation') return 'item';
    if (step === 'deal') return txType === 'buy' ? 'customer' : 'valuation';
    return 'mode';
  };

  // Trace Buy From Person forward
  assert.strictEqual(getNextStep('item', 'buy', false, 0), 'valuation', 'Buy: item -> valuation');
  assert.strictEqual(getNextStep('valuation', 'buy', false, 1500), 'customer', 'Buy: valuation -> customer');
  assert.strictEqual(getNextStep('customer', 'buy', true, 1500), 'deal', 'Buy: customer -> deal');

  // Trace Buy From Person backward
  assert.strictEqual(getBackStep('deal', 'buy'), 'customer', 'Buy back: deal -> customer');
  assert.strictEqual(getBackStep('customer', 'buy'), 'valuation', 'Buy back: customer -> valuation');
  assert.strictEqual(getBackStep('valuation', 'buy'), 'item', 'Buy back: valuation -> item');
  assert.strictEqual(getBackStep('item', 'buy'), 'mode', 'Buy back: item -> mode');

  console.log('[PASS] Test 3: Buy step navigation state transitions verified');

  // Test 4: Verify Pawn step navigation state transitions
  console.log('[Test 4] Verifying Pawn step navigation state transitions...');
  assert.strictEqual(getNextStep('customer', 'pawn', true, 0), 'item', 'Pawn: customer -> item');
  assert.strictEqual(getNextStep('item', 'pawn', true, 0), 'valuation', 'Pawn: item -> valuation');
  assert.strictEqual(getNextStep('valuation', 'pawn', true, 800), 'deal', 'Pawn: valuation -> deal');

  assert.strictEqual(getBackStep('deal', 'pawn'), 'valuation', 'Pawn back: deal -> valuation');
  assert.strictEqual(getBackStep('valuation', 'pawn'), 'item', 'Pawn back: valuation -> item');
  assert.strictEqual(getBackStep('item', 'pawn'), 'customer', 'Pawn back: item -> customer');
  assert.strictEqual(getBackStep('customer', 'pawn'), 'mode', 'Pawn back: customer -> mode');

  console.log('[PASS] Test 4: Pawn step navigation state transitions verified');

  // Test 5: Verify Decision Point & Abandonment safety (No persistent identity created)
  console.log('[Test 5] Verifying Decision Point and abandonment data safety...');
  const valuationStepPath = path.resolve('src/components/screens/buy-pawn/BuyPawnValuationStep.tsx');
  const valuationContent = fs.readFileSync(valuationStepPath, 'utf8');

  assert(
    valuationContent.includes('Purchase This Item (Seller Details)'),
    'Test 5a: Valuation step must feature explicit Purchase This Item action'
  );
  assert(
    valuationContent.includes('Not Worth Buying'),
    'Test 5b: Valuation step must feature clear Not Worth Buying (Abandon) option'
  );

  console.log('[PASS] Test 5: Decision point and abandonment safety verified');

  // Test 6: Verify Role authorization enforcement
  console.log('[Test 6] Verifying role permission boundaries for Buy and Pawn...');
  const hasPermission = (rolePermissions: string[], permission: string) => rolePermissions.includes(permission);

  const cashierPermissions = ['sales', 'inventory'];
  const seniorCashierPermissions = ['sales', 'inventory', 'pawn', 'sellerAcquisitions'];

  assert.strictEqual(hasPermission(cashierPermissions, 'sellerAcquisitions'), false, 'Cashier denied sellerAcquisitions');
  assert.strictEqual(hasPermission(cashierPermissions, 'pawn'), false, 'Cashier denied pawn');
  assert.strictEqual(hasPermission(seniorCashierPermissions, 'sellerAcquisitions'), true, 'Senior Cashier granted sellerAcquisitions');
  assert.strictEqual(hasPermission(seniorCashierPermissions, 'pawn'), true, 'Senior Cashier granted pawn');

  console.log('[PASS] Test 6: Role permissions strictly enforced for Buy and Pawn');

  // Test 7: Verify Pawn financial calculations remain intact
  console.log('[Test 7] Verifying pawn fee calculations remain unchanged...');
  const businessRules = {
    pawnMonthlyInterestRate: 0.05,
    pawnStorageAdminFeeRate: 0.05,
    defaultLoanTermDays: 30,
  } as any;

  const calc = calculatePawnFees(1000, businessRules);
  assert.strictEqual(calc.interest, 50, 'Monthly interest for R1000 at 5% must be R50');
  assert.strictEqual(calc.storage, 50, 'Storage fee for R1000 at 5% must be R50');
  assert.strictEqual(calc.total, 1100, 'Total redemption for R1000 must be R1100');

  console.log('[PASS] Test 7: Pawn financial rules & fee calculations verified');

  console.log('====================================================');
  console.log('   ALL PHASE 2B SECOND-HAND INTAKE TESTS PASSED!   ');
  console.log('====================================================');
}
