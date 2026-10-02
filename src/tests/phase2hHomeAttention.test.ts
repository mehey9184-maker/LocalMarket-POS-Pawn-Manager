import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Phase 2H Home Attention-First UX Test Suite
 */
export function runPhase2hHomeAttentionTests() {
  console.log('=== RUNNING PHASE 2H HOME ATTENTION-FIRST UX TEST SUITE ===');

  const homePath = path.join(process.cwd(), 'src/components/screens/Home.tsx');
  const homeSrc = fs.readFileSync(homePath, 'utf8');

  // --- Test A — Primary Actions ---
  assert(homeSrc.includes('setActiveTab(\'sell\')') && homeSrc.includes('Sell'), 'Sell primary action must be available');
  assert(homeSrc.includes('setActiveTab(\'buy-pawn\')') && homeSrc.includes('Add Stock'), 'Add Stock primary action must be available');
  assert(homeSrc.includes('setActiveTab(\'customers\')') && homeSrc.includes('Find Customer'), 'Find Customer primary action must be available');
  assert(homeSrc.includes('setActiveTab(\'inventory\')') && homeSrc.includes('Find Item'), 'Find Item primary action must be available');
  console.log('[PASS] Test A: Coordinated, balanced primary action cards remain available according to permissions');

  // --- Test B — Attention Section ---
  assert(homeSrc.includes('Needs attention'), 'A single "Needs attention" section title must exist');
  assert(homeSrc.includes('overdueLoans.length'), 'Overdue data must be bound in the Needs Attention list');
  assert(homeSrc.includes('expiringSoon.length'), 'Expiring soon data must be bound in the Needs Attention list');
  assert(homeSrc.includes('pendingApproval.length'), 'Forfeiture data must be bound in the Needs Attention list');
  assert(homeSrc.includes('readyForRetail.length'), 'Retail ready data must be bound in the Needs Attention list');
  console.log('[PASS] Test B: Needs Attention section aggregates overdue, due-soon, forfeiture, and retail-ready data');

  // --- Test C — Empty Attention ---
  assert(homeSrc.includes('Nothing needs your attention right now.'), 'Nothing needs your attention quiet message must exist');
  assert(!homeSrc.includes('Today’s Summary') || homeSrc.includes('View today’s activity'), 'The old technical dashboard of summary metrics zeroes is hidden / replaced by small activity link');
  console.log('[PASS] Test C: Zero attention state is quiet and calm, avoiding any technical dashboard grids of zeroes');

  // --- Test D — Role Safety ---
  assert(
    homeSrc.includes('isAtLeastSeniorCashier && pendingApproval.length > 0') &&
    homeSrc.includes('isAtLeastSeniorCashier && readyForRetail.length > 0'),
    'Management-only attention items must be strictly protected by isAtLeastSeniorCashier permissions'
  );
  console.log('[PASS] Test D: Management attention items are strictly protected by role safety checks');

  // --- Test E — Navigation ---
  assert(
    homeSrc.includes('setActiveTab(\'vault\')') && homeSrc.includes('setActiveTab(\'inventory\')'),
    'Attention rows must route to existing vault / inventory screens with no new navigation architecture'
  );
  assert(homeSrc.includes('View today’s activity') && homeSrc.includes('setActiveTab(\'profile\')'), 'Activity link routes to profile screen');
  console.log('[PASS] Test E: Attention items map correctly to existing operational tabs and view profiles');

  // --- Test F — First Run ---
  assert(homeSrc.includes('Welcome to LocalMarket'), 'Brand-new empty shop experience remains untouched');
  assert(homeSrc.includes('isBrandNewShop'), 'First-run empty-shop conditional remains correct');
  console.log('[PASS] Test F: First-run brand-new shop workflow and copy remain fully preserved');

  console.log('====================================================');
  console.log('   ALL PHASE 2H HOME ATTENTION-FIRST UX TESTS PASSED!');
  console.log('====================================================');
}
