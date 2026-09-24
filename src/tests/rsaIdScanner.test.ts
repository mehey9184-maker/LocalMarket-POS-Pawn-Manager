import { parseAndValidateRsaId } from '../utils/rsaIdValidator';

function assertEqual(actual: any, expected: any, testName: string) {
  if (actual === expected) {
    console.log(`[PASS] ${testName}`);
  } else {
    console.error(`[FAIL] ${testName}: expected ${expected}, got ${actual}`);
    throw new Error(`Test failed: ${testName}`);
  }
}

function assertTrue(condition: boolean, testName: string) {
  if (condition) {
    console.log(`[PASS] ${testName}`);
  } else {
    console.error(`[FAIL] ${testName}`);
    throw new Error(`Test failed: ${testName}`);
  }
}

export function runRsaIdScannerTests() {
  console.log('=== RUNNING LOCALMARKET RSA ID SCANNER & CHECKSUM TEST SUITE ===');

  // Case 1: Valid 13-digit RSA ID with correct checksum ('8001015009087')
  {
    const validRaw = '800101 5009 08 7';
    const result = parseAndValidateRsaId(validRaw);
    assertTrue(result.isValid, 'Case 1: Valid 13-digit RSA ID with correct checksum passes validation');
    assertEqual(result.idNumber, '8001015009087', 'Case 1: Extracts clean 13-digit ID number');
    assertEqual(result.dob, '1980-01-01', 'Case 1: Extracts correct DOB');
    assertEqual(result.gender, 'Male', 'Case 1: Extracts correct gender');
  }

  // Case 2: Same ID with altered checksum digit that fails
  {
    const invalidChecksumRaw = '8001015009080';
    const result = parseAndValidateRsaId(invalidChecksumRaw);
    assertTrue(!result.isValid, 'Case 2: Rejects RSA ID with incorrect checksum digit');
    assertTrue(result.error !== undefined && result.error.includes('Checksum failed'), 'Case 2: Contains checksum failure error message');
  }

  // Case 3: Invalid month (13)
  {
    const invalidMonthRaw = '8013015009087';
    const result = parseAndValidateRsaId(invalidMonthRaw);
    assertTrue(!result.isValid, 'Case 3: Rejects invalid month digit (13)');
    assertTrue(result.error !== undefined && result.error.includes('Invalid month'), 'Case 3: Contains invalid month error message');
  }

  // Case 4: Invalid day (32)
  {
    const invalidDayRaw = '8001325009087';
    const result = parseAndValidateRsaId(invalidDayRaw);
    assertTrue(!result.isValid, 'Case 4: Rejects invalid day digit (32)');
    assertTrue(result.error !== undefined && result.error.includes('Invalid day'), 'Case 4: Contains invalid day error message');
  }

  // Case 5: Impossible calendar date (Feb 30)
  {
    const invalidDateRaw = '8002305009087';
    const result = parseAndValidateRsaId(invalidDateRaw);
    assertTrue(!result.isValid, 'Case 5: Rejects impossible calendar date');
    assertTrue(result.error !== undefined && result.error.includes('Invalid calendar date'), 'Case 5: Contains invalid calendar date error message');
  }

  // Case 6: Non-13-digit input
  {
    const non13Raw = '12345';
    const result = parseAndValidateRsaId(non13Raw);
    assertTrue(!result.isValid, 'Case 6: Rejects non-13-digit input');
  }

  console.log('=== ALL RSA ID SCANNER & CHECKSUM TESTS PASSED SUCCESSFULLY ===');
}
