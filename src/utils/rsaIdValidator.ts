export interface RsaIdParseResult {
  isValid: boolean;
  idNumber?: string;
  dob?: string;
  gender?: 'Male' | 'Female';
  citizenship?: 'SA Citizen' | 'Permanent Resident';
  rawText: string;
  error?: string;
}

function isValidChecksum(id: string): boolean {
  const digits = id.split('').map(Number);

  let oddSum = 0;
  for (let i = 0; i < 12; i += 2) {
    oddSum += digits[i];
  }

  let evenConcat = '';
  for (let i = 1; i < 12; i += 2) {
    evenConcat += digits[i];
  }

  const doubled = (parseInt(evenConcat, 10) * 2).toString();

  const evenSum = doubled
    .split('')
    .reduce((sum, digit) => sum + Number(digit), 0);

  const checkDigit =
    (10 - ((oddSum + evenSum) % 10)) % 10;

  return checkDigit === digits[12];
}

/**
 * Validates South African ID numbers decoded from barcodes or input strings.
 * Structural rules: YYMMDD SSSS C A Z (13 digits)
 * - YYMMDD: Date of Birth
 * - SSSS: Gender (0000-4999 = Female, 5000-9999 = Male)
 * - C: Citizenship (0 = SA Citizen, 1 = Permanent Resident)
 * - A: Legacy digit / race classification (usually 8 or 9)
 * - Z: Checksum digit
 */
export function parseAndValidateRsaId(rawText: string): RsaIdParseResult {
  const cleanText = rawText.trim();
  // Strip all non-digit characters to find candidate 13-digit sequence
  const digitsOnly = cleanText.replace(/\D/g, '');
  const idMatch = digitsOnly.match(/\d{13}/);

  if (!idMatch) {
    return {
      isValid: false,
      rawText: cleanText,
      error: 'Barcode payload does not contain a valid 13-digit candidate'
    };
  }

  const idNumber = idMatch[0];

  const yearTwoDigits = parseInt(idNumber.substring(0, 2), 10);
  const monthNum = parseInt(idNumber.substring(2, 4), 10);
  const dayNum = parseInt(idNumber.substring(4, 6), 10);

  // Validate month range
  if (monthNum < 1 || monthNum > 12) {
    return {
      isValid: false,
      rawText: cleanText,
      error: `Invalid month '${idNumber.substring(2, 4)}' in RSA ID number`
    };
  }

  // Validate day range
  if (dayNum < 1 || dayNum > 31) {
    return {
      isValid: false,
      rawText: cleanText,
      error: `Invalid day '${idNumber.substring(4, 6)}' in RSA ID number`
    };
  }

  // Determine century based on current year cutoff
  const currentYearTwoDigits = parseInt(new Date().getFullYear().toString().slice(-2), 10);
  const century = yearTwoDigits <= currentYearTwoDigits ? 2000 : 1900;
  const fullYear = century + yearTwoDigits;

  // Validate calendar date using JS Date
  const testDate = new Date(fullYear, monthNum - 1, dayNum);
  if (
    testDate.getFullYear() !== fullYear ||
    testDate.getMonth() !== monthNum - 1 ||
    testDate.getDate() !== dayNum
  ) {
    return {
      isValid: false,
      rawText: cleanText,
      error: `Invalid calendar date 'YYMMDD = ${idNumber.substring(0, 6)}' in RSA ID number`
    };
  }

  // Validate Checksum digit (digit 13)
  if (!isValidChecksum(idNumber)) {
    return {
      isValid: false,
      rawText: cleanText,
      error: 'Checksum failed — ID number may be mistyped or misscanned'
    };
  }

  // Extract Gender: digits 7-10 (0000-4999 Female, 5000-9999 Male)
  const genderCode = parseInt(idNumber.substring(6, 10), 10);
  const gender: 'Male' | 'Female' = genderCode >= 5000 ? 'Male' : 'Female';

  // Extract Citizenship: digit 11 (0 = SA Citizen, 1 = Permanent Resident)
  const citizenshipDigit = parseInt(idNumber.substring(10, 11), 10);
  const citizenship = citizenshipDigit === 0 ? 'SA Citizen' : 'Permanent Resident';

  const monthStr = String(monthNum).padStart(2, '0');
  const dayStr = String(dayNum).padStart(2, '0');
  const dob = `${fullYear}-${monthStr}-${dayStr}`;

  return {
    isValid: true,
    idNumber,
    dob,
    gender,
    citizenship,
    rawText: cleanText
  };
}
