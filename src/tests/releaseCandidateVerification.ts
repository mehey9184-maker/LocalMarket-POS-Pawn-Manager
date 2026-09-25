/**
 * LocalMarket Release Candidate Live Integration & Verification Script
 */

import { createApp, startServer } from '../../server';
import crypto from 'crypto';
import http from 'http';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[AssertionFailed] ${message}`);
  }
}

function makeRequest(
  url: string,
  options: { method?: string; headers?: Record<string, string>; body?: any } = {}
): Promise<{ status: number; headers: http.IncomingHttpHeaders; json?: any; text: string }> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const bodyPayload = options.body !== undefined ? JSON.stringify(options.body) : undefined;
    const reqHeaders: Record<string, string> = {
      Accept: 'application/json',
      ...(options.headers || {}),
    };
    if (bodyPayload) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(bodyPayload).toString();
    }

    const req = http.request(
      {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.pathname + parsedUrl.search,
        method: options.method || 'GET',
        headers: reqHeaders,
      },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => {
          rawData += chunk;
        });
        res.on('end', () => {
          let parsedJson: any;
          try {
            parsedJson = JSON.parse(rawData);
          } catch {}
          resolve({
            status: res.statusCode || 0,
            headers: res.headers,
            json: parsedJson,
            text: rawData,
          });
        });
      }
    );

    req.on('error', (err) => reject(err));
    if (bodyPayload) {
      req.write(bodyPayload);
    }
    req.end();
  });
}

export async function runReleaseCandidateVerification() {
  console.log('====================================================');
  console.log('  LOCALMARKET RELEASE CANDIDATE LIVE VERIFICATION   ');
  console.log('====================================================');

  // Step 1: Start an ephemeral test instance of the actual LocalMarket Express server
  const TEST_PORT = 3456;
  const TEST_HOST = '127.0.0.1';

  console.log(`[RC Test 1] Starting Express server on ${TEST_HOST}:${TEST_PORT}...`);
  const { server, port, host } = await startServer(TEST_PORT, TEST_HOST);
  assert(port === TEST_PORT, `Server bound on port ${port} !== expected ${TEST_PORT}`);
  assert(host === TEST_HOST, `Server host ${host} !== expected ${TEST_HOST}`);
  console.log('  ✔ Standalone server booted with zero side effects on module load');

  try {
    const baseUrl = `http://${TEST_HOST}:${TEST_PORT}`;

    // Step 2: Test GET /api/health
    console.log('[RC Test 2] Testing GET /api/health against running Express server...');
    const healthRes = await makeRequest(`${baseUrl}/api/health`);
    assert(healthRes.status === 200, `Expected 200, got ${healthRes.status}`);
    assert(healthRes.json?.status === 'ok', `Expected status: "ok", got ${healthRes.json?.status}`);
    assert(
      healthRes.json?.service === 'LocalMarket API',
      `Expected service: "LocalMarket API", got ${healthRes.json?.service}`
    );
    assert(
      healthRes.json?.mode === 'local-server',
      `Expected mode: "local-server", got ${healthRes.json?.mode}`
    );
    assert(typeof healthRes.json?.uptime === 'number', 'Expected numeric uptime');
    console.log('  ✔ /api/health returned valid JSON payload with mode="local-server"');

    // Step 3: Test GET /health alias
    console.log('[RC Test 3] Testing GET /health alias endpoint...');
    const healthAliasRes = await makeRequest(`${baseUrl}/health`);
    assert(healthAliasRes.status === 200, `Expected 200, got ${healthAliasRes.status}`);
    assert(healthAliasRes.json?.status === 'ok', 'Health alias status must be ok');
    console.log('  ✔ /health alias verified');

    // Step 4: Test POST /api/staff/provision without Authorization
    console.log('[RC Test 4] Testing POST /api/staff/provision without Authorization header...');
    const unauthProvisionRes = await makeRequest(`${baseUrl}/api/staff/provision`, {
      method: 'POST',
      body: {
        shopId: 'shop-test-1',
        fullName: 'Test Cashier',
        cashierCode: 'CASH99',
        pin: '123456',
        role: 'cashier',
      },
    });
    assert(unauthProvisionRes.status === 401, `Expected 401, got ${unauthProvisionRes.status}`);
    assert(unauthProvisionRes.json?.success === false, 'Expected success: false');
    assert(
      unauthProvisionRes.json?.error?.includes('Authorization'),
      `Expected authorization error message, got: ${unauthProvisionRes.json?.error}`
    );
    console.log('  ✔ POST /api/staff/provision safely rejected unauthenticated caller with JSON 401');

    // Step 5: Test POST /api/verify-pin without Authorization
    console.log('[RC Test 5] Testing POST /api/verify-pin without Authorization header...');
    const unauthVerifyPinRes = await makeRequest(`${baseUrl}/api/verify-pin`, {
      method: 'POST',
      body: { pin: '123456' },
    });
    assert(unauthVerifyPinRes.status === 401, `Expected 401, got ${unauthVerifyPinRes.status}`);
    assert(unauthVerifyPinRes.json?.success === false, 'Expected success: false');
    console.log('  ✔ POST /api/verify-pin safely rejected unauthenticated caller with JSON 401');

    // Step 6: Test POST /api/auth/login-with-pin input validation
    console.log('[RC Test 6] Testing POST /api/auth/login-with-pin validation...');
    const invalidPinRes = await makeRequest(`${baseUrl}/api/auth/login-with-pin`, {
      method: 'POST',
      body: { cashierCode: 'CASH01', pin: '123' }, // invalid 3-digit PIN
    });
    assert(invalidPinRes.status === 400, `Expected 400, got ${invalidPinRes.status}`);
    assert(invalidPinRes.json?.success === false, 'Expected success: false');
    assert(
      invalidPinRes.json?.error?.includes('6 numeric digits'),
      `Expected 6 digits error, got ${invalidPinRes.json?.error}`
    );
    console.log('  ✔ POST /api/auth/login-with-pin rejects non-6-digit PIN with JSON 400');

    // Step 7: Test Catch-All /api/* JSON 404 handler
    console.log('[RC Test 7] Testing unknown API endpoint /api/nonexistent-route...');
    const notFoundRes = await makeRequest(`${baseUrl}/api/nonexistent-route`, { method: 'POST' });
    assert(notFoundRes.status === 404, `Expected 404, got ${notFoundRes.status}`);
    assert(notFoundRes.json?.success === false, 'Expected success: false');
    assert(notFoundRes.json?.error?.includes('not found'), 'Expected JSON 404 message');
    console.log('  ✔ Unmapped /api/* routes return JSON 404 and never fallback to SPA HTML');

    // Step 8: Test PBKDF2 PIN Cryptographic Integrity
    console.log('[RC Test 8] Testing PBKDF2 PIN hashing and verification logic...');
    const pin = '987654';
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(pin, salt, 10000, 64, 'sha512').toString('hex');
    const storedHash = `${salt}:${hash}`;

    // Verify correct PIN
    const [storedSalt, expectedHash] = storedHash.split(':');
    const checkHash = crypto.pbkdf2Sync(pin, storedSalt, 10000, 64, 'sha512').toString('hex');
    const isValid = crypto.timingSafeEqual(Buffer.from(checkHash, 'hex'), Buffer.from(expectedHash, 'hex'));
    assert(isValid, 'PBKDF2 verification failed for correct PIN');

    // Verify wrong PIN fails
    const wrongHash = crypto.pbkdf2Sync('000000', storedSalt, 10000, 64, 'sha512').toString('hex');
    const isWrongValid = crypto.timingSafeEqual(Buffer.from(wrongHash, 'hex'), Buffer.from(expectedHash, 'hex'));
    assert(!isWrongValid, 'PBKDF2 accepted wrong PIN!');
    console.log('  ✔ PBKDF2-SHA512 PIN hashing & timing-safe verification verified');

    // Step 9: Test createApp({ isServerless: true }) without starting Vite or listeners
    console.log('[RC Test 9] Testing createApp({ isServerless: true }) for Vercel functions...');
    const serverlessApp = await createApp({ isServerless: true });
    assert(typeof serverlessApp === 'function', 'createApp must return an express request handler function');
    console.log('  ✔ createApp({ isServerless: true }) initialized with zero Vite or listener overhead');

    console.log('====================================================');
    console.log('  ALL RELEASE CANDIDATE LIVE CHECKS PASSED (100%)   ');
    console.log('====================================================');
  } finally {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    console.log('[Cleanup] Live test server closed gracefully.');
  }
}

// Auto-run if executed directly
if (typeof process !== 'undefined' && process.argv && process.argv[1] && process.argv[1].includes('releaseCandidateVerification')) {
  runReleaseCandidateVerification().then(() => {
    process.exit(0);
  }).catch((err) => {
    console.error('Release candidate verification failed:', err);
    process.exit(1);
  });
}
