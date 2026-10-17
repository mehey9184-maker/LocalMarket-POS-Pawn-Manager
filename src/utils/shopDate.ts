/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * South African Shop-Local Date and Time Utilities
 * 
 * Ensures consistent 'Africa/Johannesburg' (SAST, UTC+2) calendar date boundaries
 * across the POS & Pawn Manager, avoiding UTC date shifts around midnight.
 */

export const DEFAULT_SHOP_TIMEZONE = 'Africa/Johannesburg';

/**
 * Returns today's date in the shop timezone formatted as 'YYYY-MM-DD'.
 */
export function getShopTodayDateString(timezone: string = DEFAULT_SHOP_TIMEZONE): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(new Date());
  } catch {
    // Fallback if timezone string is malformed
    const d = new Date();
    return d.toISOString().split('T')[0];
  }
}

/**
 * Normalizes an arbitrary timestamp or date representation into a shop-local 'YYYY-MM-DD' string.
 * - Calendar date strings already in 'YYYY-MM-DD' format are preserved directly.
 * - ISO strings and Date instances are evaluated in the shop timezone.
 */
export function normalizeDateToShopYmd(
  dateOrIso: string | Date | undefined | null,
  timezone: string = DEFAULT_SHOP_TIMEZONE
): string {
  if (!dateOrIso) return '';

  if (typeof dateOrIso === 'string') {
    const trimmed = dateOrIso.trim();
    // Fast path: already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
  }

  try {
    const date = typeof dateOrIso === 'string' ? new Date(dateOrIso) : dateOrIso;
    if (isNaN(date.getTime())) return '';

    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(date);
  } catch {
    return '';
  }
}

/**
 * Returns a 'YYYY-MM-DD' threshold date offset by daysAhead from today in shop timezone.
 */
export function getShopRelativeDayThreshold(
  daysAhead: number,
  timezone: string = DEFAULT_SHOP_TIMEZONE
): string {
  try {
    const now = new Date();
    const target = new Date(now.getTime() + daysAhead * 86400000);
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(target);
  } catch {
    const d = new Date(Date.now() + daysAhead * 86400000);
    return d.toISOString().split('T')[0];
  }
}

/**
 * Formats a timestamp into a human-readable South African local date & time.
 * E.g., '17 Oct 2026, 14:32'
 */
export function formatShopDateTime(
  dateOrIso: string | Date | undefined | null,
  timezone: string = DEFAULT_SHOP_TIMEZONE
): string {
  if (!dateOrIso) return '—';
  try {
    const date = typeof dateOrIso === 'string' ? new Date(dateOrIso) : dateOrIso;
    if (isNaN(date.getTime())) return '—';

    const formatter = new Intl.DateTimeFormat('en-ZA', {
      timeZone: timezone,
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    return formatter.format(date);
  } catch {
    return '—';
  }
}

/**
 * Formats an amount as South African Rands (ZAR).
 */
export function formatRand(amount: number): string {
  const rounded = Math.round((amount || 0) * 100) / 100;
  return `R ${rounded.toLocaleString('en-ZA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}
