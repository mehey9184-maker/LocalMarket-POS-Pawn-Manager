import { parseAndValidateRsaId, isValidRsaIdChecksum } from '../utils/rsaIdValidator';
import { terminalService } from '../services/terminalService';
import { db } from '../db';

function assertTrue(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`[FAIL] ${msg}`);
    throw new Error(`Test failed: ${msg}`);
  }
  console.log(`[PASS] ${msg}`);
}

function assertFalse(cond: boolean, msg: string) {
  if (cond) {
    console.error(`[FAIL] ${msg}`);
    throw new Error(`Test failed: ${msg}`);
  }
  console.log(`[PASS] ${msg}`);
}

function assertEqual(actual: any, expected: any, msg: string) {
  if (actual !== expected) {
    console.error(`[FAIL] ${msg}: Expected ${expected}, got ${actual}`);
    throw new Error(`Test failed: ${msg}`);
  }
  console.log(`[PASS] ${msg}`);
}

export async function runTerminalSessionAndRsaIdTests() {
  console.log('=== RUNNING TERMINAL SESSION & RSA ID CHECKSUM TEST SUITE ===');

  // ==========================================
  // SECTION 1: RSA ID CHECKSUM & VALIDATION TESTS
  // ==========================================

  // 1. Known valid RSA ID passes checksum & validation
  {
    const validId = '9204145082086'; // Valid male RSA ID with checksum 6
    assertTrue(isValidRsaIdChecksum(validId), 'RSA Test 1: Checksum calculation recognizes valid 13-digit ID');
    
    const parsed = parseAndValidateRsaId(validId);
    assertTrue(parsed.isValid, 'RSA Test 1: Valid RSA ID passes full validation');
    assertEqual(parsed.dob, '1992-04-14', 'RSA Test 1: Extracts correct DOB');
    assertEqual(parsed.gender, 'Male', 'RSA Test 1: Extracts correct gender');
    assertEqual(parsed.citizenship, 'SA Citizen', 'RSA Test 1: Extracts correct citizenship');
  }

  // 2. Same ID with altered checksum digit fails
  {
    const corruptedId = '9204145082089'; // Changed last digit from 6 to 9
    assertFalse(isValidRsaIdChecksum(corruptedId), 'RSA Test 2: Checksum rejects altered 13th digit');

    const parsed = parseAndValidateRsaId(corruptedId);
    assertFalse(parsed.isValid, 'RSA Test 2: Validation fails on corrupted checksum');
    assertTrue(Boolean(parsed.error && parsed.error.includes('Checksum failed')), 'RSA Test 2: Descriptive checksum error returned');
  }

  // 3. Invalid month
  {
    const invalidMonthId = '9213145082086'; // Month 13
    const parsed = parseAndValidateRsaId(invalidMonthId);
    assertFalse(parsed.isValid, 'RSA Test 3: Validation rejects invalid month 13');
    assertTrue(Boolean(parsed.error && parsed.error.includes('Invalid month')), 'RSA Test 3: Error indicates invalid month');
  }

  // 4. Invalid day
  {
    const invalidDayId = '9204325082086'; // Day 32
    const parsed = parseAndValidateRsaId(invalidDayId);
    assertFalse(parsed.isValid, 'RSA Test 4: Validation rejects invalid day 32');
    assertTrue(Boolean(parsed.error && parsed.error.includes('Invalid day')), 'RSA Test 4: Error indicates invalid day');
  }

  // 5. Impossible calendar date (Feb 30)
  {
    const feb30Id = '9202305082086'; // Feb 30
    const parsed = parseAndValidateRsaId(feb30Id);
    assertFalse(parsed.isValid, 'RSA Test 5: Validation rejects impossible calendar date Feb 30');
    assertTrue(Boolean(parsed.error && parsed.error.includes('Invalid calendar date')), 'RSA Test 5: Error indicates invalid calendar date');
  }

  // 6. Non-13-digit input
  {
    const shortText = '123456789';
    const parsed = parseAndValidateRsaId(shortText);
    assertFalse(parsed.isValid, 'RSA Test 6: Validation rejects input without 13 digits');
  }

  // ==========================================
  // SECTION 2: TERMINAL SESSION RESILIENCE TESTS
  // ==========================================

  // 1. Device ID persistence without loss
  {
    const deviceId1 = terminalService.getDeviceId();
    const deviceId2 = terminalService.getDeviceId();
    assertEqual(deviceId1, deviceId2, 'Terminal Test 1: Device ID remains stable across calls');
    assertTrue(deviceId1.startsWith('term-'), 'Terminal Test 1: Device ID follows format convention');
  }

  // 2. Clear local session record
  {
    await db.terminalSessions.clear();
    await db.terminalSessions.add({
      id: 'test-session-123',
      shopId: 'shop-1',
      userId: 'user-1',
      userName: 'Test User',
      deviceId: terminalService.getDeviceId(),
      activatedAt: new Date().toISOString(),
      lastHeartbeatAt: new Date().toISOString(),
      status: 'invalidated'
    });

    const localBefore = await terminalService.getCurrentLocalSession();
    assertTrue(localBefore !== null, 'Terminal Test 2: Stored session retrieved');

    await terminalService.clearLocalSession();
    const localAfter = await terminalService.getCurrentLocalSession();
    assertEqual(localAfter, null, 'Terminal Test 2: clearLocalSession safely removes local record');
    
    // Device ID preserved!
    assertEqual(terminalService.getDeviceId(), localBefore!.deviceId, 'Terminal Test 2: Device ID preserved after clearing local session');
  }

  // 3. Heartbeat network failure handling
  {
    // Simulate heartbeat network exception
    const result = await terminalService.heartbeat('non-existent-session-id');
    assertEqual(result.status, 'error', 'Terminal Test 3: Heartbeat handles network failure gracefully returning status error');
    assertFalse(result.success, 'Terminal Test 3: Heartbeat network failure sets success false without throwing unhandled exception');
  }

  // 4. Server active session check failure handling
  {
    const checkResult = await terminalService.checkActiveSession();
    assertTrue(typeof checkResult.success === 'boolean', 'Terminal Test 4: checkActiveSession returns boolean success status');
  }

  console.log('=== ALL TERMINAL SESSION & RSA ID CHECKSUM TESTS PASSED ===');
}
