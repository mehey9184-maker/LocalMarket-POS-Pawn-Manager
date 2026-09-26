import { draftService } from '../src/services/draftService';
import fs from 'fs';
import path from 'path';

console.log('=== VERIFYING SHOP CONTEXT & ISOLATION REPAIRS ===');

// Check 1: draftService requires shopId on saveDraft
console.log('\n[Check 1] Verifying draftService requires shopId on saveDraft:');
let threwMissingShop = false;
try {
  // @ts-expect-error testing runtime check
  await draftService.saveDraft({
    id: 'test-draft-no-shop',
    userId: 'user-1',
    workflowType: 'buy',
    step: 'mode',
    payload: {}
  });
} catch (err: any) {
  if (err.message.includes('shopId is required')) {
    threwMissingShop = true;
  }
}
if (threwMissingShop) {
  console.log('  [PASS] draftService.saveDraft strictly throws when shopId is missing.');
} else {
  console.error('  [FAIL] draftService.saveDraft did not throw when shopId is missing!');
  process.exit(1);
}

// Check 2: draftService requires shopId on closeDraft & discardDraft
console.log('\n[Check 2] Verifying draftService requires shopId on closeDraft and discardDraft:');
let closeThrew = false;
let discardThrew = false;
try {
  // @ts-expect-error testing runtime check
  await draftService.closeDraft('test-draft', '');
} catch (e: any) {
  if (e.message.includes('shopId is required')) closeThrew = true;
}
try {
  // @ts-expect-error testing runtime check
  await draftService.discardDraft('test-draft', '');
} catch (e: any) {
  if (e.message.includes('shopId is required')) discardThrew = true;
}
if (closeThrew && discardThrew) {
  console.log('  [PASS] closeDraft & discardDraft strictly require shopId.');
} else {
  console.error('  [FAIL] closeDraft or discardDraft did not enforce shopId requirement!');
  process.exit(1);
}

// Check 3: Check BuyPawn.tsx code content directly
console.log('\n[Check 3] Inspecting BuyPawn.tsx source code for shop isolation:');
const buyPawnContent = fs.readFileSync(path.join(process.cwd(), 'src/components/screens/BuyPawn.tsx'), 'utf-8');

const checks = [
  {
    name: 'No "default-shop" fallback',
    pass: !buyPawnContent.includes('default-shop')
  },
  {
    name: 'getActiveDrafts passes shopProfile.id',
    pass: buyPawnContent.includes('draftService.getActiveDrafts(user.id, shopProfile.id)')
  },
  {
    name: 'saveDraft passes shopProfile.id',
    pass: buyPawnContent.includes('shopId: shopProfile.id') && buyPawnContent.includes('draftService.saveDraft({')
  },
  {
    name: 'closeDraft in Buy path passes currentShopId',
    pass: buyPawnContent.includes('draftService.closeDraft(draftId, currentShopId)')
  },
  {
    name: 'discardDraft passes shopProfile.id',
    pass: buyPawnContent.includes('draftService.discardDraft(id, shopProfile.id)')
  },
  {
    name: 'sellerTransactions query is shop-scoped',
    pass: buyPawnContent.includes("db.sellerTransactions.where('shopId').equals(currentShopId).toArray()")
  },
  {
    name: 'inventory query in Buy path is shop-scoped',
    pass: buyPawnContent.includes("db.inventory.where('shopId').equals(currentShopId).toArray()")
  },
  {
    name: 'loans query in Pawn path is shop-scoped',
    pass: buyPawnContent.includes("db.loans.where('shopId').equals(currentShopId).toArray()")
  },
  {
    name: 'syncLogs receives shopId',
    pass: buyPawnContent.includes('shopId: currentShopId')
  },
  {
    name: 'Preserves "What are you adding?" heading',
    pass: buyPawnContent.includes('What are you adding?')
  },
  {
    name: 'Preserves "Choose what best matches what’s happening at the counter."',
    pass: buyPawnContent.includes('Choose what best matches what’s happening at the counter.')
  },
  {
    name: 'Preserves 3 cards: Existing Stock, Buy From Person, Pawn',
    pass: buyPawnContent.includes('Existing Stock') && buyPawnContent.includes('Buy From Person') && buyPawnContent.includes('Pawn')
  }
];

let allPassed = true;
for (const c of checks) {
  if (c.pass) {
    console.log(`  [PASS] ${c.name}`);
  } else {
    console.error(`  [FAIL] ${c.name}`);
    allPassed = false;
  }
}

if (!allPassed) {
  process.exit(1);
} else {
  console.log('\n=== ALL SHOP CONTEXT & ISOLATION REPAIR CHECKS PASSED! ===');
}
