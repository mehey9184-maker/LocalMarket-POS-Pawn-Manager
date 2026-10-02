import 'fake-indexeddb/auto';
import { runMarketIntelligenceTests } from './marketIntelligence.test';
import { runRsaIdScannerTests } from './rsaIdScanner.test';
import { runExternalProviderManagerTests } from './externalProviderManager.test';
import { runStabilityAndScannerTests } from './stabilityAndScanner.test';
import { runIdentityVerificationIntegrityTests } from './identityVerificationIntegrity.test';
import { runIdentifierAndSourceOfTruthTests } from './identifierAndSourceOfTruth.test';
import { runAtomicBuyAndPawnIntegrityTests } from './atomicBuyAndPawnIntegrity.test';
import { runV1DefectRepairPassTests } from './v1DefectRepairPass.test';
import { runTerminalSessionTests } from './terminalSession.test';
import { runIntelligentAssistanceTests } from './intelligentAssistance.test';
import { runResumableWorkTests } from './resumableWork.test';
import { runPrintingTests } from './printingFoundation.test';
import { runStaffSecurityFinalizationTests } from './staffSecurityFinalization.test';
import { runApiRoutingAndResilienceTests } from './apiRoutingAndResilience.test';
import { runTerminalPinLockoutTests } from './terminalPinLockout.test';
import { runOfflineQueueSyncTests } from './offlineQueueSync.test';
import { runInventoryPaginationTests } from './inventoryPagination.test';
import { runImageStoragePolicyTests } from './imageStoragePolicy.test';
import { runBackupIsolationTests } from './backupIsolation.test';
import { runStartupHydrationTests } from './startupHydration.test';
import { runMarketCheckAndPawnReviewTests } from './marketCheckAndPawnReview.test';
import { runInventoryPriceAndVaultPatchTests } from './inventoryPriceAndVaultPatch.test';
import { runOwnerShopSettingsAndFixedRolesTests } from './ownerShopSettingsAndFixedRoles.test';
import { runSeniorUxPhase1Tests } from './seniorUxPhase1.test';
import { runPhase2aCashierSpeedTests } from './phase2aCashierSpeed.test';
import { runPhase2bSecondHandIntakeTests } from './phase2bSecondHandIntake.test';
import { runPhase2cFluidBuyPawnTests } from './phase2cFluidBuyPawn.test';
import { runPhase2dBarcodeScannerTests } from './phase2dBarcodeScanner.test';

export async function runAllTests() {
  console.log('====================================================');
  console.log('   LOCALMARKET POS & PAWN - SUITE VERIFICATION     ');
  console.log('====================================================');
  runRsaIdScannerTests();
  runMarketIntelligenceTests();
  await runExternalProviderManagerTests();
  await runStabilityAndScannerTests();
  await runIdentityVerificationIntegrityTests();
  await runIdentifierAndSourceOfTruthTests();
  await runAtomicBuyAndPawnIntegrityTests();
  await runV1DefectRepairPassTests();
  runStaffSecurityFinalizationTests();
  await runApiRoutingAndResilienceTests();
  await runTerminalPinLockoutTests();
  await runOfflineQueueSyncTests();
  await runInventoryPaginationTests();
  await runImageStoragePolicyTests();
  await runBackupIsolationTests();
  await runTerminalSessionTests();
  await runStartupHydrationTests();
  runIntelligentAssistanceTests();
  await runResumableWorkTests();
  runPrintingTests();
  await runMarketCheckAndPawnReviewTests();
  await runInventoryPriceAndVaultPatchTests();
  runOwnerShopSettingsAndFixedRolesTests();
  runSeniorUxPhase1Tests();
  runPhase2aCashierSpeedTests();
  await runPhase2bSecondHandIntakeTests();
  await runPhase2cFluidBuyPawnTests();
  await runPhase2dBarcodeScannerTests();
  console.log('====================================================');
  console.log('   ALL UNIT TESTS EXECUTED WITH ZERO ERRORS       ');
  console.log('====================================================');
}

// Auto-run if executed directly via node/tsx
if (typeof process !== 'undefined' && process.argv && process.argv[1] && process.argv[1].includes('tests')) {
  runAllTests().then(() => {
    process.exit(0);
  }).catch((err) => {
    console.error('Test suite failed:', err);
    process.exit(1);
  });
}
