/**
 * API Routing, Resilience, Base URL & Non-JSON Interception Tests
 */

import { apiRequest, apiPost, resolveApiUrl, getApiBaseUrl } from '../utils/apiClient';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[AssertionFailed] ${message}`);
  }
}

export async function runApiRoutingAndResilienceTests() {
  console.log('--- Running API Routing & Resilience Tests ---');

  // Test 1: Non-JSON HTML error interception (e.g. preview fallback or CDN 404/502)
  const originalFetch = globalThis.fetch;

  try {
    // Mock HTML error response
    globalThis.fetch = (async () => {
      return new Response('<!DOCTYPE html><html><head><title>Page not found</title></head><body>The page cannot be found</body></html>', {
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
    console.log('  ✔ Non-JSON HTML error page safely intercepted without JSON parse exception');

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

    const json401Res = await apiPost('/api/staff/provision', {}, undefined);
    assert(!json401Res.ok, '401 response must not be marked ok');
    assert(json401Res.isJson, 'JSON response must be marked isJson=true');
    assert(
      json401Res.error === 'Missing or invalid Authorization header.',
      `Expected JSON error message, got: ${json401Res.error}`
    );
    console.log('  ✔ POST /api/staff/provision without Authorization correctly parsed as JSON 401 error');

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
    console.log('  ✔ Valid API response successfully parsed');

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
    console.log('  ✔ Network drop handled gracefully');

    // Test 5: /api/health check payload structure with mode
    globalThis.fetch = (async () => {
      return new Response(
        JSON.stringify({
          status: 'ok',
          service: 'LocalMarket API',
          mode: 'local-server',
          timestamp: new Date().toISOString(),
          uptime: 42.5
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        }
      );
    }) as any;

    const healthRes = await apiRequest<{ status: string; service: string; mode: string; uptime: number }>('/api/health');
    assert(healthRes.ok, '/api/health response must be ok');
    assert(healthRes.data?.status === 'ok', '/api/health status must be ok');
    assert(healthRes.data?.service === 'LocalMarket API', '/api/health service must match');
    assert(healthRes.data?.mode === 'local-server', '/api/health mode must be local-server');
    assert(typeof healthRes.data?.uptime === 'number', '/api/health uptime must be a number');
    console.log('  ✔ Health check endpoint response verified (status, service, mode, uptime)');

    // Test 6: API URL Resolution (Relative vs LAN Base URL)
    const relativeUrl = resolveApiUrl('/api/staff/provision');
    assert(relativeUrl === '/api/staff/provision', `Expected relative URL '/api/staff/provision', got: ${relativeUrl}`);

    // Test with runtime LAN base URL configuration
    (window as any).__LOCALMARKET_API_BASE_URL__ = 'http://192.168.1.50:3000/';
    const lanUrl = resolveApiUrl('/api/staff/provision');
    assert(
      lanUrl === 'http://192.168.1.50:3000/api/staff/provision',
      `Expected normalized LAN URL 'http://192.168.1.50:3000/api/staff/provision', got: ${lanUrl}`
    );
    delete (window as any).__LOCALMARKET_API_BASE_URL__;
    console.log('  ✔ API Base URL resolution and trailing slash normalization verified');

  } finally {
    globalThis.fetch = originalFetch;
  }

  console.log('--- API Routing & Resilience Tests Passed ---');
}

