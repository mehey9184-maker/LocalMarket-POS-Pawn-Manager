/**
 * Normalizes hardware barcode scanner input by trimming transport artifacts
 * such as leading/trailing whitespace, carriage returns (\r), newlines (\n),
 * non-printable control characters (ASCII 0-31, 127), and zero-width spaces.
 *
 * Preserves all valid identifier characters including letters, digits, hyphens,
 * slashes, dots, plus signs, and alphanumeric symbols.
 */
export function normalizeScannerInput(raw: string | null | undefined): string {
  if (raw === null || raw === undefined) return '';

  // Remove non-printable ASCII control characters (0-31, 127) and zero-width spaces
  let cleaned = raw.replace(/[\x00-\x1F\x7F\u200B-\u200D\uFEFF]/g, '');

  // Trim leading and trailing whitespace
  cleaned = cleaned.trim();

  return cleaned;
}
