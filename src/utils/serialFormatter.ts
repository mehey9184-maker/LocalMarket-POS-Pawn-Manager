/**
 * Formats a serial number or IMEI for worker display.
 * Returns 'No serial' for null, empty, whitespace-only, or 'N/A' (case-insensitive, trimmed).
 * Otherwise returns the trimmed serial string.
 */
export function displaySerial(serial?: string | null): string {
  if (!serial) return 'No serial';
  const trimmed = serial.trim();
  if (!trimmed || trimmed.toUpperCase() === 'N/A') return 'No serial';
  return trimmed;
}
