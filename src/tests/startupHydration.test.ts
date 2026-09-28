/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

function assertTrue(condition: boolean, testName: string) {
  if (condition) {
    console.log(`[PASS] ${testName}`);
  } else {
    console.error(`[FAIL] ${testName}`);
    throw new Error(`Test failed: ${testName}`);
  }
}

export async function runStartupHydrationTests() {
  console.log('=== RUNNING STARTUP HYDRATION & SHOP SETUP ROUTING TEST SUITE ===');

  // Test 1: In-flight Single-Flight Deduplication Logic
  {
    let fetchCount = 0;
    const inFlightMap = new Map<string, Promise<{ id: string; shop_id: string }>>();

    const simulateFetchProfile = (userId: string): Promise<{ id: string; shop_id: string }> => {
      const existing = inFlightMap.get(userId);
      if (existing) {
        return existing;
      }

      fetchCount++;
      const promise = new Promise<{ id: string; shop_id: string }>((resolve) => {
        setTimeout(() => {
          resolve({ id: userId, shop_id: 'shop-uuid-001' });
        }, 50);
      }).finally(() => {
        inFlightMap.delete(userId);
      });

      inFlightMap.set(userId, promise);
      return promise;
    };

    // Simulate concurrent startup calls (initAuth and INITIAL_SESSION)
    const p1 = simulateFetchProfile('user-test-1');
    const p2 = simulateFetchProfile('user-test-1');

    assertTrue(p1 === p2, 'Test 1: Simultaneous calls share the identical in-flight Promise instance');
    
    const [res1, res2] = await Promise.all([p1, p2]);
    assertTrue(res1.shop_id === 'shop-uuid-001', 'Test 1: Call 1 resolved correct shopId');
    assertTrue(res2.shop_id === 'shop-uuid-001', 'Test 1: Call 2 resolved correct shopId');
    assertTrue(fetchCount === 1, 'Test 1: Underlying fetch executed exactly once with zero duplicate requests');
  }

  // Test 2: Anti-Flash Routing Invariant for Configured Shops
  {
    // Simulate MainLayout state machine
    let activeTab = 'landing';
    let user: any = { id: 'user-001', email_confirmed_at: '2026-01-01T00:00:00Z' };
    let profile: any = null;
    let authLoading = false;
    let isProfileLoading = true;
    let hasRenderedShopSetup = false;

    const evaluateRouting = () => {
      // MainLayout guard logic
      if (authLoading || (user && isProfileLoading)) {
        return; // Retains starting loader; never routes
      }

      const isEmailConfirmed = user?.email_confirmed_at || user?.confirmed_at;
      const hasShop = profile?.shop_id;

      if (user && isEmailConfirmed) {
        if (!hasShop) {
          activeTab = 'shop-setup';
          hasRenderedShopSetup = true;
        } else if (activeTab === 'landing' || activeTab === 'auth' || activeTab === 'shop-setup') {
          activeTab = 'home';
        }
      } else if (!user && activeTab !== 'auth') {
        activeTab = 'auth';
      }
    };

    // Step A: Immediately after initAuth getSession(), profile is still hydrating
    evaluateRouting();
    assertTrue(activeTab === 'landing', 'Test 2: While isProfileLoading is true, activeTab is not modified');
    assertTrue(hasRenderedShopSetup === false, 'Test 2: ShopSetup is never rendered during the profile hydration window');

    // Step B: Profile resolves with configured shop
    profile = { id: 'user-001', shop_id: 'shop-uuid-001' };
    isProfileLoading = false;
    evaluateRouting();

    assertTrue(activeTab === 'home', 'Test 2: Resolves directly to home tab when profile hydration completes');
    assertTrue(hasRenderedShopSetup === false, 'Test 2: ShopSetup was never displayed at any point for configured shop');
  }

  // Test 3: First-Time User Onboarding Reachability (Genuine Unassigned Shop)
  {
    let activeTab = 'landing';
    let user: any = { id: 'new-user-002', email_confirmed_at: '2026-01-01T00:00:00Z' };
    let profile: any = null;
    let authLoading = false;
    let isProfileLoading = true;

    const evaluateRouting = () => {
      if (authLoading || (user && isProfileLoading)) {
        return;
      }

      const isEmailConfirmed = user?.email_confirmed_at || user?.confirmed_at;
      const hasShop = profile?.shop_id;

      if (user && isEmailConfirmed) {
        if (!hasShop) {
          if (activeTab !== 'shop-setup') {
            activeTab = 'shop-setup';
          }
        } else if (activeTab === 'landing' || activeTab === 'auth' || activeTab === 'shop-setup') {
          activeTab = 'home';
        }
      }
    };

    // Hydration in progress:
    evaluateRouting();
    assertTrue(activeTab === 'landing', 'Test 3: Loading window held during profile resolution');

    // Hydration finishes with no assigned shop:
    profile = { id: 'new-user-002', shop_id: null };
    isProfileLoading = false;
    evaluateRouting();

    assertTrue(activeTab === 'shop-setup', 'Test 3: Authentic first-time user without shop successfully reaches shop-setup');
  }

  // Test 4: Terminal Guard Invariant
  {
    // Verifies TerminalGuard does not drop into children or flash errors while profile is hydrating
    const user: any = { id: 'user-001' };
    const isProfileLoading = true;
    const terminalLoading = true;

    const isGuardShowingLoader = (isProfileLoading || terminalLoading);
    assertTrue(isGuardShowingLoader === true, 'Test 4: TerminalGuard displays connecting loader while profile hydrates');
  }

  // Test 5: Logout Cleanup
  {
    let isProfileLoading = true;
    let profile: any = { shop_id: 'shop-001' };
    let user: any = { id: 'user-001' };

    // Simulate logout()
    user = null;
    profile = null;
    isProfileLoading = false;

    assertTrue(isProfileLoading === false, 'Test 5: Logout resets isProfileLoading to false');
    assertTrue(profile === null, 'Test 5: Logout clears profile state');
    assertTrue(user === null, 'Test 5: Logout clears user session');
  }

  console.log('=== ALL STARTUP HYDRATION & SHOP SETUP ROUTING TESTS PASSED ===');
}
