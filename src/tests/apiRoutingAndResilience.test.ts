/**
 * API Routing, Resilience & Non-JSON Interception Tests
 */

import { apiRequest, apiPost } from '../utils/apiClient';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[AssertionFailed] ${message}`);
  }
}

export async function runApiRoutingAndResilienceTests() {
  console.log('--- Running API Routing & Resilience Tests ---');

  // Test 1: Non-JSON HTML error interception
  const originalFetch = globalThis.fetch;

  try {
    // Mock HTML error response (e.g. from preview/CDN error page)
    globalThis.fetch = (async () => {
      return new Response('The page cannot be found', {
        status: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }) as any;

    const htmlRes = await apiRequest('/api/staff/provision', { method: 'POST' });
    assert(!htmlRes.ok, 'HTML error response must not be marked ok');
    assert(!htmlRes.isJson, 'HTML response must be detected as non-JSON');
    assert(
      htmlRes.error === 'LocalMarket backend is not reachable. The app interface is running, but the API server is unavailable.',
      `Expected user-friendly backend unavailable message, got: ${htmlRes.error}`
    );
    console.log('  â Non-JSON HTML error page safely intercepted without JSON parse exception');

    // Test 2: Standard JSON 400/401 response from backend
    globalThis.fetch = (async () => {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing or invalid Authorization header.' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        }
      );
    }) as any;

    const json401Res = await apiPost('/api/staff/provision', {}, 'fake-token');
    assert(!json401Res.ok, '401 response must not be marked ok');
    assert(json401Res.isJson, 'JSON response must be marked isJson=true');
    assert(
      json401Res.error === 'Missing or invalid Authorization header.',
      `Expected JSON error message, got: ${json401Res.error}`
    );
    console.log('  â Standard JSON API error correctly parsed from backend');

    // Test 3: Successful JSON response
    globalThis.fetch = (async () => {
      return new Response(
        JSON.stringify({ success: true, profile: { id: 'prof-123', full_name: 'Test Cashier' } }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        }
      );
    }) as any;

    const successRes = await apiPost<{ success: boolean; profile: any }>(
      '/api/staff/provision',
      { fullName: 'Test Cashier' },
      'valid-token'
    );
    assert(successRes.ok, '200 JSON response must be ok');
    assert(successRes.data?.profile?.id === 'prof-123', 'Parsed profile payload must match');
    console.log('  â Valid API response successfully parsed');

    // Test 4: Network failure / disconnected server
    globalThis.fetch = (async () => {
      throw new TypeError('Failed to fetch');
    }) as any;

    const netErrRes = await apiPost('/api/auth/login-with-pin', { cashierCode: 'CASH01', pin: '123456' });
    assert(!netErrRes.ok, 'Network error must not be ok');
    assert(
      netErrRes.error!.includes('Failed to fetch') || netErrRes.error!.includes('not reachable'),
      `Network error should have meaningful message: ${netErrRes.error}`
    );
    console.log('  â Network drop handled gracefully');

  } finally {
    globalThis.fetch = originalFetch;
  }

  console.log('--- API Routing & Resilience Tests Passed ---');
}
