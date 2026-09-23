import { runMarketIntelligenceTests } from './marketIntelligence.test';
import { runRsaIdScannerTests } from './rsaIdScanner.test';

export function runAllTests() {
  console.log('====================================================');
  console.log('   LOCALMARKET POS & PAWN - SUITE VERIFICATION     ');
  console.log('====================================================');
  runRsaIdScannerTests();
  runMarketIntelligenceTests();
  console.log('====================================================');
  console.log('   ALL UNIT TESTS EXECUTED WITH ZERO ERRORS       ');
  console.log('====================================================');
}

// Auto-run if executed directly via node/tsx
if (typeof process !== 'undefined' && process.argv && process.argv[1] && process.argv[1].includes('tests')) {
  runAllTests();
}
