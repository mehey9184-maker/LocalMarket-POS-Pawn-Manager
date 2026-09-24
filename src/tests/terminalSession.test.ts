import { terminalService } from '../services/terminalService';

function assertTrue(condition: boolean, testName: string) {
  if (condition) {
    console.log(`[PASS] ${testName}`);
  } else {
    console.error(`[FAIL] ${testName}`);
    throw new Error(`Test failed: ${testName}`);
  }
}

export async function runTerminalSessionTests() {
  console.log('=== RUNNING TERMINAL SESSION RESILIENCE TEST SUITE ===');

  // Test 1: Device ID stable generation & retrieval
  {
    const devId1 = terminalService.getDeviceId();
    const devId2 = terminalService.getDeviceId();
    assertTrue(Boolean(devId1), 'Test 1: Device ID generated');
    assertTrue(devId1 === devId2, 'Test 1: Device ID is persistent and stable');
  }

  console.log('=== ALL TERMINAL SESSION TESTS PASSED SUCCESSFULLY ===');
}
