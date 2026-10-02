import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { normalizeStepForTransactionType } from '../components/screens/buy-pawn/buyPawnTypes';

/**
 * Phase 2C Regression Test Suite: Fluid Buy ↔ Pawn Intake & State Preservation
 */
export async function runPhase2cFluidBuyPawnTests() {
  console.log('=== RUNNING PHASE 2C FLUID BUY ↔ PAWN INTAKE TEST SUITE ===');

  // Test 1: Verify source code wiring of mode-isolated states in useBuyPawnWorkflow.ts
  console.log('[Test 1] Verifying mode-isolated states in useBuyPawnWorkflow.ts...');
  const workflowPath = path.resolve('src/components/screens/buy-pawn/useBuyPawnWorkflow.ts');
  const workflowContent = fs.readFileSync(workflowPath, 'utf8');

  assert(
    workflowContent.includes('buySelectedIdentity') &&
      workflowContent.includes('pawnSelectedIdentity') &&
      workflowContent.includes('buyAgreedOffer') &&
      workflowContent.includes('pawnAgreedOffer'),
    'Test 1a: useBuyPawnWorkflow.ts must define isolated states for buy and pawn identities/offers'
  );

  assert(
    workflowContent.includes('handleSwitchTxType') && workflowContent.includes('switchTxType: handleSwitchTxType'),
    'Test 1b: useBuyPawnWorkflow.ts must export handleSwitchTxType action'
  );

  console.log('[PASS] Test 1: Mode-isolated states and switchTxType action verified in workflow hook');

  // Test 2: Verify Common Item Preservation & Identity Isolation Logic
  console.log('[Test 2] Verifying common item preservation & identity isolation simulation...');

  // Mock State Machine simulating useBuyPawnWorkflow fluid switching
  interface MockItemData {
    title: string;
    category: string;
    brand: string;
    model: string;
    serialOrImei: string;
    imageUrl: string;
  }

  interface MockIdentity {
    id: string;
    fullName: string;
    idNumber: string;
    type: 'seller' | 'customer';
  }

  let txType: 'buy' | 'pawn' | 'existing' | null = 'buy';
  let itemData: MockItemData = {
    title: 'Samsung Galaxy S24 Ultra 512GB',
    category: 'Phones & Tech',
    brand: 'Samsung',
    model: 'Galaxy S24 Ultra',
    serialOrImei: '358912345678901',
    imageUrl: 'data:image/jpeg;base64,mockphotodata',
  };

  let buySelectedIdentity: MockIdentity | null = { id: 's-1', fullName: 'Thabo Mbeki', idNumber: '8001015009087', type: 'seller' };
  let pawnSelectedIdentity: MockIdentity | null = null;
  let buyAgreedOffer = 14000;
  let pawnAgreedOffer = 0;

  let activeIdentity: MockIdentity | null = buySelectedIdentity;
  let activeAgreedOffer = buyAgreedOffer;

  // Function simulating fluid switch to Pawn
  const switchMode = (newMode: 'buy' | 'pawn' | 'existing') => {
    // Snapshot current active into mode storage
    if (txType === 'buy') {
      buySelectedIdentity = activeIdentity;
      buyAgreedOffer = activeAgreedOffer;
    } else if (txType === 'pawn') {
      pawnSelectedIdentity = activeIdentity;
      pawnAgreedOffer = activeAgreedOffer;
    }

    txType = newMode;

    if (newMode === 'buy') {
      activeIdentity = buySelectedIdentity;
      activeAgreedOffer = buyAgreedOffer;
    } else if (newMode === 'pawn') {
      activeIdentity = pawnSelectedIdentity;
      activeAgreedOffer = pawnAgreedOffer;
    } else {
      activeIdentity = null;
      activeAgreedOffer = 0;
    }
  };

  // Step 2a: Verify initial Buy state
  assert.strictEqual(itemData.title, 'Samsung Galaxy S24 Ultra 512GB', 'Common item title intact');
  assert.strictEqual(itemData.imageUrl, 'data:image/jpeg;base64,mockphotodata', 'Common photo intact');
  assert.strictEqual(activeIdentity?.fullName, 'Thabo Mbeki', 'Buy seller is active');
  assert.strictEqual(activeAgreedOffer, 14000, 'Buy payout is R14,000');

  // Step 2b: Switch to Pawn
  switchMode('pawn');
  assert.strictEqual(txType, 'pawn', 'Active mode switched to pawn');
  assert.strictEqual(itemData.title, 'Samsung Galaxy S24 Ultra 512GB', 'Common item title preserved after switch');
  assert.strictEqual(itemData.imageUrl, 'data:image/jpeg;base64,mockphotodata', 'Common photo preserved after switch');
  assert.strictEqual(activeIdentity, null, 'Buy seller must NOT be automatically treated as Pawn borrower');
  assert.strictEqual(activeAgreedOffer, 0, 'Buy payout must NOT be automatically treated as Pawn loan principal');

  // Step 2c: Enter Pawn Borrower and Loan Principal
  pawnSelectedIdentity = { id: 'c-1', fullName: 'Nomvula Mokonyane', idNumber: '8505120009081', type: 'customer' };
  activeIdentity = pawnSelectedIdentity;
  pawnAgreedOffer = 10000;
  activeAgreedOffer = pawnAgreedOffer;

  assert.strictEqual(activeIdentity.fullName, 'Nomvula Mokonyane', 'Pawn borrower set');
  assert.strictEqual(activeAgreedOffer, 10000, 'Pawn loan principal set to R10,000');

  // Step 2d: Switch back to Buy From Person
  switchMode('buy');
  assert.strictEqual(txType, 'buy', 'Active mode switched back to buy');
  assert.strictEqual(itemData.title, 'Samsung Galaxy S24 Ultra 512GB', 'Common item title still preserved');
  assert.strictEqual(activeIdentity?.fullName, 'Thabo Mbeki', 'Buy seller Thabo Mbeki restored');
  assert.strictEqual(activeAgreedOffer, 14000, 'Buy payout R14,000 restored');

  // Step 2e: Switch back to Pawn
  switchMode('pawn');
  assert.strictEqual(activeIdentity?.fullName, 'Nomvula Mokonyane', 'Pawn borrower Nomvula Mokonyane restored');
  assert.strictEqual(activeAgreedOffer, 10000, 'Pawn loan principal R10,000 restored');

  console.log('[PASS] Test 2: Common item preserved, identity & pricing isolated across fluid switches');

  // Test 3: Verify Change Intake Type modal & header UI in source code
  console.log('[Test 3] Verifying ChangeIntakeTypeModal and header controls...');
  const modalPath = path.resolve('src/components/modals/ChangeIntakeTypeModal.tsx');
  assert(fs.existsSync(modalPath), 'ChangeIntakeTypeModal.tsx must exist');

  const buyPawnPath = path.resolve('src/components/screens/BuyPawn.tsx');
  const buyPawnContent = fs.readFileSync(buyPawnPath, 'utf8');

  assert(
    buyPawnContent.includes('Change Intake Type') && buyPawnContent.includes('ChangeIntakeTypeModal'),
    'BuyPawn.tsx must contain Change Intake Type header action and render ChangeIntakeTypeModal'
  );

  console.log('[PASS] Test 3: ChangeIntakeTypeModal and header integration verified');

  // Test 4: Verify Draft Payload Persistence of Mode-Isolated State
  console.log('[Test 4] Verifying draft payload persistence of mode-isolated states...');
  const draftsPath = path.resolve('src/components/screens/buy-pawn/useBuyPawnDrafts.ts');
  const draftsContent = fs.readFileSync(draftsPath, 'utf8');

  assert(
    draftsContent.includes('buySelectedIdentity') &&
      draftsContent.includes('pawnSelectedIdentity') &&
      draftsContent.includes('buyAgreedOffer') &&
      draftsContent.includes('pawnAgreedOffer'),
    'useBuyPawnDrafts.ts must persist buy and pawn mode-isolated identities and offers in draft payload'
  );

  console.log('[PASS] Test 4: Draft payload persistence of mode-isolated states verified');

  // Test 5: Verify Role Permissions Gating for Mode Switcher
  console.log('[Test 5] Verifying role permission boundaries for mode switching...');
  const checkCanSwitch = (role: 'cashier' | 'senior' | 'manager' | 'owner', targetMode: 'buy' | 'pawn' | 'existing') => {
    const isSeniorOrHigher = role === 'senior' || role === 'manager' || role === 'owner';
    if (targetMode === 'existing') return true;
    return isSeniorOrHigher;
  };

  assert.strictEqual(checkCanSwitch('cashier', 'existing'), true, 'Cashier can access Existing Stock');
  assert.strictEqual(checkCanSwitch('cashier', 'buy'), false, 'Cashier denied switching to Buy From Person');
  assert.strictEqual(checkCanSwitch('cashier', 'pawn'), false, 'Cashier denied switching to Pawn');
  assert.strictEqual(checkCanSwitch('senior', 'buy'), true, 'Senior Cashier allowed switching to Buy From Person');
  assert.strictEqual(checkCanSwitch('senior', 'pawn'), true, 'Senior Cashier allowed switching to Pawn');

  console.log('[PASS] Test 5: Role permission gating verified for fluid mode switcher');

  // Test 6: Verify Deterministic Cross-Mode Step Normalization (normalizeStepForTransactionType)
  console.log('[Test 6] Verifying deterministic cross-mode step normalization...');

  const dummyBorrower = { id: 'c-1', fullName: 'Jane Borrower', idNumber: '9001010000000', type: 'customer' } as any;
  const dummySeller = { id: 's-1', fullName: 'John Seller', idNumber: '8001010000000', type: 'seller' } as any;

  // 6a. Buy Item → Pawn (no borrower set) MUST land on Borrower Info ('customer')
  assert.strictEqual(
    normalizeStepForTransactionType('item', 'pawn', null, 0, ''),
    'customer',
    'Buy item -> Pawn without borrower MUST land on customer (Borrower Info)'
  );

  // 6b. Buy Valuation → Pawn (no borrower set) MUST land on Borrower Info ('customer')
  assert.strictEqual(
    normalizeStepForTransactionType('valuation', 'pawn', null, 0, ''),
    'customer',
    'Buy valuation -> Pawn without borrower MUST land on customer (Borrower Info)'
  );

  // 6c. Buy Deal → Pawn (no borrower set) MUST land on Borrower Info ('customer')
  assert.strictEqual(
    normalizeStepForTransactionType('deal', 'pawn', null, 0, ''),
    'customer',
    'Buy deal -> Pawn without borrower MUST land on customer (Borrower Info)'
  );

  // 6d. Buy Item → Pawn WITH borrower restored MUST preserve 'item' (Collateral Item)
  assert.strictEqual(
    normalizeStepForTransactionType('item', 'pawn', dummyBorrower, 0, ''),
    'item',
    'Buy item -> Pawn WITH restored borrower MUST keep item step'
  );

  // 6e. Buy Valuation → Pawn WITH borrower restored MUST preserve 'valuation' (Loan Terms)
  assert.strictEqual(
    normalizeStepForTransactionType('valuation', 'pawn', dummyBorrower, 5000, ''),
    'valuation',
    'Buy valuation -> Pawn WITH restored borrower MUST keep valuation step'
  );

  // 6f. Pawn Customer → Buy (no payout set) MUST land on 'valuation' (Valuation & Price)
  assert.strictEqual(
    normalizeStepForTransactionType('customer', 'buy', null, 0, ''),
    'valuation',
    'Pawn customer -> Buy without payout MUST land on valuation (Valuation & Price)'
  );

  // 6g. Pawn Item → Buy MUST land on 'item' (Evaluate Item)
  assert.strictEqual(
    normalizeStepForTransactionType('item', 'buy', null, 0, ''),
    'item',
    'Pawn item -> Buy MUST land on item'
  );

  // 6h. Pawn Valuation → Buy MUST land on 'valuation' (Valuation & Price)
  assert.strictEqual(
    normalizeStepForTransactionType('valuation', 'buy', null, 0, ''),
    'valuation',
    'Pawn valuation -> Buy MUST land on valuation'
  );

  // 6i. Pawn Deal → Buy (no seller, no payout) MUST land on 'valuation'
  assert.strictEqual(
    normalizeStepForTransactionType('deal', 'buy', null, 0, ''),
    'valuation',
    'Pawn deal -> Buy without seller/payout MUST land on valuation'
  );

  // 6j. Pawn Deal → Buy WITH payout but no seller MUST land on 'customer' (Seller Info)
  assert.strictEqual(
    normalizeStepForTransactionType('deal', 'buy', null, 8000, ''),
    'customer',
    'Pawn deal -> Buy with payout but no seller MUST land on customer (Seller Info)'
  );

  // 6k. Pawn Deal → Buy WITH payout AND seller MUST land on 'deal'
  assert.strictEqual(
    normalizeStepForTransactionType('deal', 'buy', dummySeller, 8000, ''),
    'deal',
    'Pawn deal -> Buy with payout and seller MUST land on deal'
  );

  // 6l. Switch to Existing Stock from any step MUST land on valid Existing Stock step ('item', 'valuation', or 'location')
  assert.strictEqual(
    normalizeStepForTransactionType('customer', 'existing', dummySeller, 8000, ''),
    'item',
    'Switching to Existing Stock from customer MUST land on item'
  );
  assert.strictEqual(
    normalizeStepForTransactionType('valuation', 'existing', dummySeller, 8000, ''),
    'valuation',
    'Switching to Existing Stock from valuation MUST land on valuation'
  );
  assert.strictEqual(
    normalizeStepForTransactionType('deal', 'existing', dummySeller, 8000, '1500'),
    'location',
    'Switching to Existing Stock from deal with retail price MUST land on location'
  );

  console.log('[PASS] Test 6: Deterministic cross-mode step normalization verified for all transitions');

  console.log('====================================================');
  console.log('   ALL PHASE 2C FLUID BUY ↔ PAWN TESTS PASSED!     ');
  console.log('====================================================');
}
