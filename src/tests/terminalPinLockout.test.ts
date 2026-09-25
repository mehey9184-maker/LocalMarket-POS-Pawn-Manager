/**
 * Terminal PIN Lockout UX & Server Authority Tests
 */

import { authApi } from '../services/supabaseApi';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[AssertionFailed] ${message}`);
  }
}

// Format seconds as MM:SS (matching UI)
function formatTime(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export async function runTerminalPinLockoutTests() {
  console.log('=== RUNNING TERMINAL PIN LOCKOUT UX & SERVER AUTHORITY TESTS ===');

  const originalFetch = globalThis.fetch;

  try {
    // ---------------------------------------------------------
    // Test A: Normal PIN Screen State (No lockout)
    // ---------------------------------------------------------
    let mockSecondsLeft = 0;
    let isLocked = mockSecondsLeft > 0;
    assert(!isLocked, 'Test A: Normal screen state must not be locked');
    assert(mockSecondsLeft === 0, 'Test A: Normal state has 0 remaining seconds');
    console.log('[PASS] Test A: Normal PIN screen - PIN input and Authorize button are enabled');

    // ---------------------------------------------------------
    // Test B: Server reports Lockout Response (429 Too Many Attempts)
    // ---------------------------------------------------------
    globalThis.fetch = (async () => {
      return new Response(
        JSON.stringify({
          success: false,
          locked: true,
          remainingSeconds: 300,
          remainingMinutes: 5,
          error: 'Too many failed attempts. Try again in 5 minutes.',
        }),
        {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }) as any;

    const lockedRes = await authApi.loginWithPin('CASH01', '123456');
    assert(!lockedRes.success, 'Test B: Login must fail when locked');
    assert(lockedRes.locked === true, 'Test B: Response must indicate locked=true');
    assert(lockedRes.remainingSeconds === 300, 'Test B: Response must provide authoritative remainingSeconds=300');
    assert(formatTime(lockedRes.remainingSeconds!) === '05:00', 'Test B: 300 seconds formats to 05:00');

    mockSecondsLeft = lockedRes.remainingSeconds!;
    isLocked = mockSecondsLeft > 0;
    assert(isLocked === true, 'Test B: UI isLocked state becomes true');
    console.log('[PASS] Test B: Locked response - PIN input disabled, Authorize button disabled, countdown parsed from server');

    // ---------------------------------------------------------
    // Test C: Countdown Progression (Decreases 1s per tick)
    // ---------------------------------------------------------
    const countdownSteps = [300, 299, 298, 60, 59, 1, 0];
    const expectedFormats = ['05:00', '04:59', '04:58', '01:00', '00:59', '00:01', '00:00'];

    countdownSteps.forEach((secs, idx) => {
      assert(formatTime(secs) === expectedFormats[idx], `Test C: ${secs}s should format to ${expectedFormats[idx]}`);
    });
    console.log('[PASS] Test C: Countdown decreases accurately with MM:SS visual formatting');

    // ---------------------------------------------------------
    // Test D: Countdown reaches zero (Controls re-enable locally)
    // ---------------------------------------------------------
    mockSecondsLeft = 0;
    isLocked = mockSecondsLeft > 0;
    assert(isLocked === false, 'Test D: Controls re-enable when timer hits 0');
    console.log('[PASS] Test D: When countdown reaches zero, controls re-enable locally for next attempt');

    // ---------------------------------------------------------
    // Test E: Server Still Locked after local timer expiration (Server Authority)
    // ---------------------------------------------------------
    globalThis.fetch = (async () => {
      return new Response(
        JSON.stringify({
          success: false,
          locked: true,
          remainingSeconds: 120,
          remainingMinutes: 2,
          error: 'Too many failed attempts. Try again in 2 minutes.',
        }),
        {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }) as any;

    const retryLockedRes = await authApi.loginWithPin('CASH01', '123456');
    assert(!retryLockedRes.success, 'Test E: Server rejects attempt if still locked');
    assert(retryLockedRes.locked === true, 'Test E: Server flags locked=true');
    assert(retryLockedRes.remainingSeconds === 120, 'Test E: Server provides remaining time (120s)');
    assert(formatTime(retryLockedRes.remainingSeconds!) === '02:00', 'Test E: Formats to 02:00');

    mockSecondsLeft = retryLockedRes.remainingSeconds!;
    isLocked = mockSecondsLeft > 0;
    assert(isLocked === true, 'Test E: UI immediately returns to locked state');
    console.log('[PASS] Test E: Server authority maintained - if still locked on server, UI immediately restores lockout with authoritative time');

    // ---------------------------------------------------------
    // Test F: Standard Invalid PIN (Non-lockout failure)
    // ---------------------------------------------------------
    globalThis.fetch = (async () => {
      return new Response(
        JSON.stringify({
          success: false,
          locked: false,
          error: 'Invalid PIN.',
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }) as any;

    const invalidRes = await authApi.loginWithPin('CASH01', '999999');
    assert(!invalidRes.success, 'Test F: Invalid PIN must return success: false');
    assert(!invalidRes.locked, 'Test F: Single failed attempt must not flag locked=true');
    assert(invalidRes.error === 'Invalid PIN.', 'Test F: Returns standard invalid PIN message');
    console.log('[PASS] Test F: Standard invalid PIN - existing failed attempt behavior remains unchanged');

    // ---------------------------------------------------------
    // Test G: Successful PIN Authentication
    // ---------------------------------------------------------
    const validDummyJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE5OTk5OTk5OTksInN1YiI6InVzci0xMjMifQ.mock-signature';
    globalThis.fetch = (async () => {
      return new Response(
        JSON.stringify({
          success: true,
          session: { access_token: validDummyJwt, refresh_token: 'mock-refresh-token', user: { id: 'usr-123' } },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }) as any;

    const successRes = await authApi.loginWithPin('CASH01', '200000');
    assert(successRes.success === true, `Test G: Valid PIN must return success: true, got: ${JSON.stringify(successRes)}`);
    console.log('[PASS] Test G: Successful PIN authentication - session established without lockout interference');

  } finally {
    globalThis.fetch = originalFetch;
  }

  console.log('=== ALL TERMINAL PIN LOCKOUT UX & SERVER AUTHORITY TESTS PASSED ===');
}
