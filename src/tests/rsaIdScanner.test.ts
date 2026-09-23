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
  console.log('=== RUNNING LOCALMARKET RSA ID SCANNER TEST SUITE ===');

  // Case 1: Valid 13-digit RSA ID string
  {
    const validRaw = '920414 5082 08 9';
    const result = parseAndValidateRsaId(validRaw);
    assertTrue(result.isValid, 'Case 1: Valid 13-digit RSA ID passes structural validation');
    assertEqual(result.idNumber, '9204145082089', 'Case 1: Extracts clean 13-digit ID number');
    assertEqual(result.dob, '1992-04-14', 'Case 1: Extracts correct DOB');
    assertEqual(result.gender, 'Male', 'Case 2: Extract correct gender (5082 >= 5000)');
    assertEqual(result.citizenship, 'SA Citizen', 'Case 1: Extract SA Citizen citizenship digit');
  }

  // Case 2: Malformed 13-digit ID (invalid month 13)
  {
    const invalidRaw = '9213145082089';
    const result = parseAndValidateRsaId(invalidRaw);
    assertTrue(!result.isValid, 'Case 2: Rejects invalid month digit (13)');
    assertTrue(result.error !== undefined && result.error.includes('Invalid month'), 'Case 2: Contains descriptive error message');
  }

  // Case 3: Random text without 13 digits
  {
    const randomText = 'ABC123XYZ';
    const result = parseAndValidateRsaId(randomText);
    assertTrue(!result.isValid, 'Case 3: Rejects random string without 13 digits');
  }

  // Case 4: Valid Female RSA ID
  {
    const femaleRaw = '8501010123081';
    const result = parseAndValidateRsaId(femaleRaw);
    assertTrue(result.isValid, 'Case 4: Valid Female RSA ID passes validation');
    assertEqual(result.gender, 'Female', 'Case 4: Extract correct female gender (0123 < 5000)');
  }

  console.log('=== ALL RSA ID SCANNER TESTS PASSED SUCCESSFULLY ===');
}
