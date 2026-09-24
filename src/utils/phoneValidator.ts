export type ValidationStatus = 'valid' | 'invalid' | 'suspicious' | 'duplicate' | 'already_known' | 'unable_to_verify' | 'optional' | 'empty';

export interface PhoneValidationResult {
  isValid: boolean;
  status: ValidationStatus;
  normalizedNumber?: string;
  displayNumber?: string;
  error?: string;
}

/**
 * Validates and normalizes South African phone numbers (mobile & landline).
 * Recognized formats:
 * - 067 205 4752
 * - 0672054752
 * - +27 67 205 4752
 * - +27672054752
 * - Landlines (011, 021, 031, etc.)
 */
export function validateAndNormalizeSaPhone(rawInput: string): PhoneValidationResult {
  if (!rawInput || rawInput.trim() === '') {
    return {
      isValid: true, // optional unless required by context
      status: 'empty',
      error: 'Phone number not provided'
    };
  }

  const clean = rawInput.trim();
  // Strip spaces, dashes, parentheses
  let digits = clean.replace(/[\s\-\(\)\+]/g, '');

  // If starts with 27 instead of +27
  if (digits.startsWith('27') && digits.length === 11) {
    digits = '0' + digits.slice(2);
  }

  // Check if it's 10 digits starting with 0
  if (/^0\d{9}$/.test(digits)) {
    const areaCode = digits.substring(0, 3);
    const subscriber = digits.substring(3);
    const displayNumber = `${areaCode} ${subscriber.substring(0, 3)} ${subscriber.substring(3)}`;
    const normalizedNumber = `+27${digits.slice(1)}`;

    // Basic validity check for valid SA prefixes (Mobile: 06, 07, 08; Landline: 01, 02, 03, 04, 05, 086/toll-free or similar)
    const validPrefix = /^(0[1-8])\d{8}$/.test(digits);
    if (!validPrefix) {
      return {
        isValid: false,
        status: 'suspicious',
        rawText: clean,
        error: 'Phone number prefix is not recognized in South Africa.'
      } as any;
    }

    return {
      isValid: true,
      status: 'valid',
      normalizedNumber,
      displayNumber
    };
  }

  // Check if international +27 format
  if (/^27\d{9}$/.test(digits)) {
    const localDigits = '0' + digits.slice(2);
    const areaCode = localDigits.substring(0, 3);
    const subscriber = localDigits.substring(3);
    const displayNumber = `${areaCode} ${subscriber.substring(0, 3)} ${subscriber.substring(3)}`;
    const normalizedNumber = `+27${digits.slice(2)}`;

    return {
      isValid: true,
      status: 'valid',
      normalizedNumber,
      displayNumber
    };
  }

  return {
    isValid: false,
    status: 'invalid',
    error: 'Please enter a valid 10-digit South African phone number (e.g. 082 123 4567).'
  };
}
