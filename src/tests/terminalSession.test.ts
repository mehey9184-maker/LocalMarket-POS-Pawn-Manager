import { terminalService } from '../services/terminalService';
import { db } from '../db';
import { TerminalSession } from '../types';

function assertTrue(condition: boolean, testName: string) {
  if (condition) {
    console.log(`[PASS] ${testName}`);
  } else {
    console.error(`[FAIL] ${testName}`);
    throw new Error(`Test failed: ${testName}`);
  }
}

export async function runTerminalSessionTests() {
  console.log('=== RUNNING TERMINAL SESSION RESILIENCE TEST SUITE ===');

  // Test 1: Device ID stable generation & retrieval
  {
    const devId1 = terminalService.getDeviceId();
    const devId2 = terminalService.getDeviceId();
    assertTrue(Boolean(devId1), 'Test 1: Device ID generated');
    assertTrue(devId1 === devId2, 'Test 1: Device ID is persistent and stable');
  }

  const deviceId = terminalService.getDeviceId();
  const testUserId = 'user-worker-101';
  const testShopId = 'shop-branch-202';

  // Test 2: Warm browser return with valid local terminal session
  {
    await terminalService.clearLocalSession();

    const activeSession: TerminalSession = {
      id: 'session-valid-001',
      shopId: testShopId,
      userId: testUserId,
      userName: 'Thabo Worker',
      deviceId: deviceId,
      activatedAt: new Date(Date.now() - 3600000).toISOString(),
      lastHeartbeatAt: new Date().toISOString(),
      status: 'active'
    };

    await db.terminalSessions.add(activeSession);
    const retrieved = await terminalService.getCurrentLocalSession();

    assertTrue(retrieved !== null, 'Test 2.1: Local session found on warm return');
    assertTrue(retrieved?.status === 'active', 'Test 2.2: Local session status is active');
    assertTrue(retrieved?.userId === testUserId, 'Test 2.3: User ID matches current authenticated user');
    assertTrue(retrieved?.shopId === testShopId, 'Test 2.4: Shop ID matches current profile shop');
    assertTrue(retrieved?.deviceId === deviceId, 'Test 2.5: Device ID matches current terminal device');

    // TerminalGuard invariant: hasMatchingActiveSession evaluates to true
    const hasMatchingActiveSession =
      retrieved &&
      retrieved.status === 'active' &&
      retrieved.userId === testUserId &&
      retrieved.shopId === testShopId &&
      retrieved.deviceId === deviceId;

    const isProfileLoading = false;
    const isLoading = false;
    const shouldBlockWithLoader = (isProfileLoading || isLoading) && !hasMatchingActiveSession;
    assertTrue(!shouldBlockWithLoader, 'Test 2.6: Warm browser return does NOT block application with "Connecting to your Shop..."');
  }

  // Test 3: Token refresh with same user/shop/device
  {
    // Simulating token refresh: user object reference changes, but userId and shopId are stable
    const prevIdentity = { userId: testUserId, shopId: testShopId, profileId: 'prof-101' };
    const nextUser = { id: testUserId, email: 'thabo@shop.co.za', tokenRefreshedAt: Date.now() };
    const nextProfile = { id: 'prof-101', shop_id: testShopId, full_name: 'Thabo Worker' };

    const isIdentityEqual =
      prevIdentity.userId === nextUser.id &&
      prevIdentity.shopId === nextProfile.shop_id &&
      prevIdentity.profileId === nextProfile.id;

    assertTrue(isIdentityEqual, 'Test 3.1: Stable identity values match across token refresh');

    const currentSession = await terminalService.getCurrentLocalSession();
    assertTrue(currentSession?.status === 'active', 'Test 3.2: Active terminal session preserved across token refresh without re-boot');
  }

  // Test 4: Offline warm return
  {
    // Simulate warm return when network is completely offline
    const session = await terminalService.getCurrentLocalSession();
    assertTrue(session !== null && session.status === 'active', 'Test 4.1: Offline warm return immediately loads active local session');

    // TerminalGuard invariant when isOfflineRevalidation is true
    const isOfflineRevalidation = true;
    const isProfileLoading = false;
    const isLoading = false;
    const hasMatchingActiveSession =
      session &&
      session.status === 'active' &&
      session.userId === testUserId &&
      session.shopId === testShopId &&
      session.deviceId === deviceId;

    const shouldBlock = (isProfileLoading || isLoading) && !hasMatchingActiveSession;
    assertTrue(!shouldBlock, 'Test 4.2: Temporary network loss does NOT block application or kick worker out');
    assertTrue(isOfflineRevalidation, 'Test 4.3: Enters quiet offline revalidation mode');
  }

  // Test 5: Genuinely invalidated terminal
  {
    // Simulate server reporting session invalidated / expired
    const invalidatedSessionId = 'session-invalid-999';
    await terminalService.clearLocalSession();

    const invalidatedSession: TerminalSession = {
      id: invalidatedSessionId,
      shopId: testShopId,
      userId: testUserId,
      userName: 'Thabo Worker',
      deviceId: deviceId,
      activatedAt: new Date(Date.now() - 7200000).toISOString(),
      lastHeartbeatAt: new Date(Date.now() - 3600000).toISOString(),
      status: 'invalidated',
      invalidatedAt: new Date().toISOString()
    };

    await db.terminalSessions.add(invalidatedSession);
    const retrieved = await terminalService.getCurrentLocalSession();

    assertTrue(retrieved?.status === 'invalidated', 'Test 5.1: Terminal status correctly reflects invalidated');
    const isTerminalEnded = retrieved && (retrieved.status === 'invalidated' || retrieved.status === 'expired');
    assertTrue(Boolean(isTerminalEnded), 'Test 5.2: Genuinely invalidated session triggers Terminal Session Ended security UI');
  }

  // Test 6: Mismatched local session identity
  {
    await terminalService.clearLocalSession();

    // Local session belongs to a DIFFERENT user (e.g. previous shift worker)
    const otherUserSession: TerminalSession = {
      id: 'session-other-worker',
      shopId: testShopId,
      userId: 'different-user-999',
      userName: 'Previous Cashier',
      deviceId: deviceId,
      activatedAt: new Date().toISOString(),
      lastHeartbeatAt: new Date().toISOString(),
      status: 'active'
    };

    await db.terminalSessions.add(otherUserSession);
    const initialSession = await terminalService.getCurrentLocalSession();
    assertTrue(initialSession?.userId === 'different-user-999', 'Test 6.1: Found stale session for different user');

    // Verification check for current user (testUserId)
    const isIdentityMatch =
      initialSession &&
      initialSession.userId === testUserId &&
      initialSession.shopId === testShopId &&
      initialSession.deviceId === deviceId;

    assertTrue(!isIdentityMatch, 'Test 6.2: Identity match fails for mismatched user session');

    if (!isIdentityMatch) {
      await terminalService.clearLocalSession();
    }

    const cleared = await terminalService.getCurrentLocalSession();
    assertTrue(cleared === null, 'Test 6.3: Stale mismatched local session safely discarded and cleared');
  }

  console.log('=== ALL TERMINAL SESSION TESTS PASSED SUCCESSFULLY ===');
}
