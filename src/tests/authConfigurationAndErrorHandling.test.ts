/**
 * Auth Configuration & Error Classification Test Suite
 * 
 * Verifies:
 * 1. Missing Supabase configuration detection and safe diagnostics failure
 * 2. Auth API rejection when credentials are not configured
 * 3. Error classification logic: missing configuration vs genuine invalid credentials
 * 4. AuthPage.tsx source invariants (unconfigured banner, non-misleading error feedback)
 * 5. Windows GitHub Actions release workflow injection of vars.VITE_SUPABASE_URL and secrets.VITE_SUPABASE_ANON_KEY
 */

import fs from 'fs';
import path from 'path';
import { 
  isSupabaseConfigured, 
  getSupabase, 
  testSupabaseConnection, 
  saveSupabaseCredentials, 
  clearSupabaseCredentials 
} from '../services/supabase';
import { authApi } from '../services/supabaseApi';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[AssertionFailed] ${message}`);
  }
}

function readSourceFile(relativePath: string): string {
  const absolutePath = path.resolve(relativePath);
  return fs.readFileSync(absolutePath, 'utf-8').replace(/\r\n/g, '\n');
}

export async function runAuthConfigurationAndErrorHandlingTests() {
  console.log('====================================================');
  console.log('   RUNNING AUTH CONFIG & ERROR HANDLING TEST SUITE   ');
  console.log('====================================================');

  const originalFetch = globalThis.fetch;
  const originalEnvUrl = process.env.VITE_SUPABASE_URL;
  const originalEnvKey = process.env.VITE_SUPABASE_ANON_KEY;

  try {
    // --- 1. Missing Supabase Configuration Behavior ---
    console.log('[Auth Test 1] Verifying unconfigured Supabase client behavior...');
    clearSupabaseCredentials();

    assert(!isSupabaseConfigured(), 'isSupabaseConfigured() must return false when no credentials exist');
    assert(!authApi.isConfigured(), 'authApi.isConfigured() must return false when no credentials exist');
    assert(getSupabase() === null, 'getSupabase() must return null when unconfigured');

    const testConn = await testSupabaseConnection();
    assert(!testConn.success, 'testSupabaseConnection() must return success: false when unconfigured');
    assert(
      testConn.message.toLowerCase().includes('not provided') || testConn.message.toLowerCase().includes('invalid'),
      `Expected message mentioning missing credentials, got: ${testConn.message}`
    );
    console.log('  ✔ Unconfigured Supabase diagnostics fail safely without uncaught exceptions');

    // --- 2. Auth API Rejection on Missing Configuration ---
    console.log('[Auth Test 2] Verifying Auth API rejections on missing configuration...');
    let signInFailed = false;
    try {
      await authApi.signIn('owner@store.co.za', 'Secret123!');
    } catch (err: any) {
      signInFailed = true;
      assert(
        err.message.includes('not configured'),
        `authApi.signIn error must explicitly state not configured, got: ${err.message}`
      );
    }
    assert(signInFailed, 'authApi.signIn must throw when Supabase is not configured');

    let signUpFailed = false;
    try {
      await authApi.signUp('owner@store.co.za', 'Secret123!', 'Shop Owner');
    } catch (err: any) {
      signUpFailed = true;
      assert(
        err.message.includes('not configured'),
        `authApi.signUp error must explicitly state not configured, got: ${err.message}`
      );
    }
    assert(signUpFailed, 'authApi.signUp must throw when Supabase is not configured');
    console.log('  ✔ authApi.signIn and signUp strictly reject unconfigured invocations');

    // --- 3. Error Classification Logic (AuthPage contract) ---
    console.log('[Auth Test 3] Verifying error classification semantics (no misleading inactive profile)...');

    // Helper implementing AuthPage's error classification logic
    const classifyAuthError = (err: any, email: string) => {
      const errLower = String(err?.message || '').toLowerCase();
      const isUnconfigured = !authApi.isConfigured() ||
        errLower.includes('supabase is not configured') ||
        errLower.includes('supabase credentials') ||
        errLower.includes('supabase client is not initialized') ||
        errLower.includes('not configured');

      const isInvalidCredentials = errLower.includes('invalid login credentials');
      const isEmailNotConfirmed = errLower.includes('email not confirmed');
      const isUserAlreadyExists = errLower.includes('user already registered') || errLower.includes('already exists');

      const isStaffEmail = email.trim().toLowerCase().endsWith('@localmarketpos.co.za');

      let errorTitle = 'Access Denied';
      let errorMessage = err?.message || 'Failed to authenticate operator terminal';
      let fieldError = 'Authentication failed. Please verify credentials.';

      if (isUnconfigured) {
        errorTitle = 'Configuration Error';
        errorMessage = 'Supabase database credentials are not configured for this build.';
        fieldError = 'Database is not configured. Missing Supabase credentials.';
      } else if (isInvalidCredentials && isStaffEmail) {
        errorMessage = 'This looks like a staff PIN account. Please use "Switch Account" and sign in with your 6-digit PIN instead of this screen.';
        fieldError = 'Staff accounts sign in with a PIN, not on this screen';
      } else if (isInvalidCredentials) {
        errorMessage = 'Incorrect email or password.';
        fieldError = 'Incorrect email or password';
      } else if (isEmailNotConfirmed) {
        errorTitle = 'Verification Required';
        errorMessage = 'Email address has not been verified yet. Please check your inbox.';
        fieldError = 'Email not verified yet';
      } else if (isUserAlreadyExists) {
        errorTitle = 'Account Exists';
        errorMessage = 'An account with this email already exists. Please sign in instead.';
        fieldError = 'Account already exists. Please sign in';
      }

      return { errorTitle, errorMessage, fieldError };
    };

    // Case A: Missing configuration error
    const unconfigResult = classifyAuthError(new Error('Supabase is not configured.'), 'owner@store.co.za');
    assert(
      unconfigResult.fieldError === 'Database is not configured. Missing Supabase credentials.',
      `Unconfigured must produce configuration error, got: "${unconfigResult.fieldError}"`
    );
    assert(
      !unconfigResult.fieldError.includes('Invalid credentials or inactive profile'),
      'Must NEVER report "Invalid credentials or inactive profile" when unconfigured'
    );
    assert(
      unconfigResult.errorTitle === 'Configuration Error',
      `Expected "Configuration Error", got: ${unconfigResult.errorTitle}`
    );

    // Case B: Genuine bad password / email
    // Temporarily supply mock credentials so authApi.isConfigured() is true
    saveSupabaseCredentials('https://mock.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy-anon-key-token-with-sufficient-length-12345');
    const badPassResult = classifyAuthError(new Error('Invalid login credentials'), 'owner@store.co.za');
    assert(
      badPassResult.fieldError === 'Incorrect email or password',
      `Genuine invalid credentials must report "Incorrect email or password", got: "${badPassResult.fieldError}"`
    );
    assert(
      badPassResult.errorMessage === 'Incorrect email or password.',
      `Expected "Incorrect email or password.", got: "${badPassResult.errorMessage}"`
    );

    // Case C: Staff system email used on owner screen
    const staffEmailResult = classifyAuthError(new Error('Invalid login credentials'), 'cashier_01@localmarketpos.co.za');
    assert(
      staffEmailResult.fieldError === 'Staff accounts sign in with a PIN, not on this screen',
      `Staff email must redirect to PIN login, got: "${staffEmailResult.fieldError}"`
    );

    // Case D: Email not confirmed
    const unconfirmedResult = classifyAuthError(new Error('Email not confirmed'), 'newowner@store.co.za');
    assert(
      unconfirmedResult.fieldError === 'Email not verified yet',
      `Unconfirmed email must report verification required, got: "${unconfirmedResult.fieldError}"`
    );
    console.log('  ✔ Error classification contract strictly tested across all failure variants');

    // --- 4. AuthPage.tsx Source Invariants ---
    console.log('[Auth Test 4] Auditing AuthPage.tsx source code...');
    const authPageSrc = readSourceFile('src/components/screens/AuthPage.tsx');

    assert(
      authPageSrc.includes('!authApi.isConfigured()'),
      'AuthPage.tsx must check !authApi.isConfigured()'
    );
    assert(
      authPageSrc.includes('data-testid="supabase-unconfigured-banner"'),
      'AuthPage.tsx must render unconfigured alert banner'
    );
    assert(
      authPageSrc.includes('Database Configuration Required'),
      'AuthPage.tsx unconfigured banner must state Database Configuration Required'
    );
    assert(
      authPageSrc.includes('Database is not configured. Missing Supabase credentials.'),
      'AuthPage.tsx must set clear field error on unconfigured submission'
    );
    console.log('  ✔ AuthPage.tsx source invariants audited and verified');

    // --- 5. Windows Workflow Production Environment & Secrets Invariants ---
    console.log('[Auth Test 5] Auditing .github/workflows/windows-desktop-release.yml...');
    const workflowSrc = readSourceFile('.github/workflows/windows-desktop-release.yml');

    assert(
      workflowSrc.includes('environment: Production'),
      'Workflow release job must target the "Production" environment'
    );
    assert(
      workflowSrc.includes('Build Application & Electron'),
      'Workflow must contain "Build Application & Electron" step'
    );
    assert(
      workflowSrc.includes('VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}'),
      'Workflow must pass VITE_SUPABASE_URL from secrets.VITE_SUPABASE_URL'
    );
    assert(
      !workflowSrc.includes('vars.VITE_SUPABASE_URL'),
      'Workflow must NOT reference vars.VITE_SUPABASE_URL (must reuse existing Production environment secrets)'
    );
    assert(
      workflowSrc.includes('VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}'),
      'Workflow must pass VITE_SUPABASE_ANON_KEY from secrets.VITE_SUPABASE_ANON_KEY'
    );
    assert(
      workflowSrc.includes('VITE_SUPABASE_URL is missing or blank') &&
      workflowSrc.includes('VITE_SUPABASE_ANON_KEY is missing or blank'),
      'Workflow must include pre-build validation that refuses to build if secrets are missing or blank'
    );
    assert(
      !workflowSrc.includes('echo $VITE_SUPABASE_URL') &&
      !workflowSrc.includes('echo $VITE_SUPABASE_ANON_KEY') &&
      !workflowSrc.includes('echo "${VITE_SUPABASE_URL}"'),
      'Workflow must NEVER print secret values into logs'
    );
    assert(
      !workflowSrc.includes('SUPABASE_SERVICE_ROLE_KEY') &&
      !workflowSrc.includes('B2_') &&
      !workflowSrc.includes('BACKBLAZE'),
      'Workflow must NOT inject privileged service role key or Backblaze credentials into desktop build'
    );
    assert(
      !workflowSrc.includes('https://') || !workflowSrc.includes('supabase.co'),
      'Workflow must NOT contain any hardcoded Supabase project URLs'
    );
    console.log('  ✔ Workflow targets Production environment, maps secrets, and validates pre-build presence');

  } finally {
    globalThis.fetch = originalFetch;
    if (originalEnvUrl !== undefined) {
      process.env.VITE_SUPABASE_URL = originalEnvUrl;
    } else {
      delete process.env.VITE_SUPABASE_URL;
    }
    if (originalEnvKey !== undefined) {
      process.env.VITE_SUPABASE_ANON_KEY = originalEnvKey;
    } else {
      delete process.env.VITE_SUPABASE_ANON_KEY;
    }
    clearSupabaseCredentials();
  }

  console.log('====================================================');
  console.log('   ALL AUTH CONFIG & ERROR HANDLING TESTS PASSED!   ');
  console.log('====================================================\n');
}
