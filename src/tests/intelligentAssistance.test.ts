import { validateAndNormalizeSaPhone } from '../utils/phoneValidator';
import { parseAndValidateRsaId } from '../utils/rsaIdValidator';
import { getProductSuggestion } from '../utils/suggestionEngine';
import { formatUserFriendlyError, focusAndScrollErrorField } from '../utils/errorNavigator';

function assertTrue(condition: boolean, testName: string) {
  if (condition) {
    console.log(`[PASS] ${testName}`);
  } else {
    console.error(`[FAIL] ${testName}`);
    throw new Error(`Test failed: ${testName}`);
  }
}

function assertEqual(actual: any, expected: any, testName: string) {
  if (actual === expected) {
    console.log(`[PASS] ${testName}`);
  } else {
    console.error(`[FAIL] ${testName}: expected ${expected}, got ${actual}`);
    throw new Error(`Test failed: ${testName}`);
  }
}

export function runIntelligentAssistanceTests() {
  console.log('=== RUNNING LOCALMARKET INTELLIGENT ASSISTANCE FOUNDATION TEST SUITE ===');

  // Test 1: Phone Validation & Normalization
  {
    const res1 = validateAndNormalizeSaPhone('067 205 4752');
    assertTrue(res1.isValid, 'Phone 1: Formatted mobile phone is valid');
    assertEqual(res1.normalizedNumber, '+27672054752', 'Phone 1: Normalizes to +27 format');

    const res2 = validateAndNormalizeSaPhone('0672054752');
    assertTrue(res2.isValid, 'Phone 2: Compact mobile phone is valid');
    assertEqual(res2.normalizedNumber, '+27672054752', 'Phone 2: Normalizes correctly');

    const res3 = validateAndNormalizeSaPhone('+27672054752');
    assertTrue(res3.isValid, 'Phone 3: International +27 format is valid');

    const res4 = validateAndNormalizeSaPhone('');
    assertTrue(res4.isValid, 'Phone 4: Empty optional phone is valid');
    assertEqual(res4.status, 'empty', 'Phone 4: Status is empty');

    const res5 = validateAndNormalizeSaPhone('12345');
    assertTrue(!res5.isValid, 'Phone 5: Rejects short invalid phone number');
  }

  // Test 2: RSA ID Checksum & Validation
  {
    const validId = '8001015009087';
    const parsedValid = parseAndValidateRsaId(validId);
    assertTrue(parsedValid.isValid, 'RSA ID 1: Valid ID with correct checksum passes');

    const invalidChecksumId = '8001015009080';
    const parsedInvalid = parseAndValidateRsaId(invalidChecksumId);
    assertTrue(!parsedInvalid.isValid, 'RSA ID 2: Rejects invalid checksum digit');
    assertTrue(parsedInvalid.error?.includes('Checksum failed') ?? false, 'RSA ID 2: Gives checksum error');
  }

  // Test 3: Suggestion Engine (Non-forcing)
  {
    const suggestion = getProductSuggestion('samsng galaxy s24');
    assertTrue(Boolean(suggestion.suggestedText), 'Suggestion 1: Detects spelling correction');
    assertEqual(suggestion.suggestedText, 'Samsung galaxy s24', 'Suggestion 2: Suggests corrected brand');
    assertEqual(suggestion.originalText, 'samsng galaxy s24', 'Suggestion 3: Original user text remains untouched until accepted');

    const cleanSuggestion = getProductSuggestion('Samsung Galaxy S24');
    assertEqual(cleanSuggestion.suggestedText, undefined, 'Suggestion 4: No suggestion needed for correct spelling');
  }

  // Test 4: Human-Friendly Error Formatting
  {
    const friendly1 = formatUserFriendlyError('null value in column "price" violates not-null constraint');
    assertEqual(friendly1, 'Please fill in this required field.', 'Error 1: Maps null constraint to friendly message');

    const friendly2 = formatUserFriendlyError('PGRST303 jwt expired');
    assertEqual(friendly2, 'Your session needs to reconnect. Your work is still here.', 'Error 2: Maps auth error to friendly reconnect message');
  }

  // Test 5: Error Focus & Scroll Helper (Offline/Headless Safe)
  {
    const mockEl = {
      scrollIntoView: () => {},
      focus: () => {},
      classList: { add: () => {}, remove: () => {} }
    } as unknown as HTMLElement;

    const focused = focusAndScrollErrorField(mockEl);
    assertTrue(focused, 'Error Navigator 1: Successfully focuses and scrolls error element');

    const nullFocused = focusAndScrollErrorField(null);
    assertTrue(!nullFocused, 'Error Navigator 2: Handles null element gracefully without throwing');
  }

  console.log('=== ALL INTELLIGENT ASSISTANCE FOUNDATION TESTS PASSED SUCCESSFULLY ===');
}
