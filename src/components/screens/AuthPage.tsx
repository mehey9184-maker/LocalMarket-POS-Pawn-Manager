import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { authApi } from '../../services/supabaseApi';
import { testSupabaseConnection, ConnectionTestResult } from '../../services/supabase';
import { Loader2, Database, AlertCircle, CheckCircle2 } from 'lucide-react';

// Cashier/staff accounts are provisioned with a system-generated email in this
// domain when no real work email is supplied (see StaffAccessManager). Their
// real password is a one-time random secret that is never surfaced and is
// rotated on every PIN login (see server.ts /api/auth/login-with-pin), so a
// login attempt against this email pattern can never succeed here by design.
// This is only used to choose a more honest error message — it changes no
// authentication behavior.
const SYSTEM_STAFF_EMAIL_DOMAIN = '@localmarketpos.co.za';

const isSystemGeneratedStaffEmail = (value: string) =>
  value.trim().toLowerCase().endsWith(SYSTEM_STAFF_EMAIL_DOMAIN);

export const AuthPage: React.FC = () => {
  const { setActiveTab, showToast } = useApp();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Validation State
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  // Connection Test State
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const validateEmail = (val: string) => {
    if (!val) return 'Email is required';
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!regex.test(val)) return 'Invalid email format';
    return '';
  };

  const validatePassword = (val: string) => {
    if (!val) return 'Password is required';
    if (val.length < 6) return 'Minimum 6 characters';
    return '';
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setEmail(val);
    setErrors(prev => ({ ...prev, email: validateEmail(val) }));
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPassword(val);
    setErrors(prev => ({ ...prev, password: validatePassword(val) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const eError = validateEmail(email);
    const pError = validatePassword(password);

    if (eError || pError) {
      setErrors({ email: eError, password: pError });
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      console.log('[Auth] Attempting Operator Sign In for:', email);
      const { data, error } = await authApi.signIn(email, password);
      if (error) throw error;

      console.log('[Auth] Sign In Successful:', data.user?.id);
      showToast('Operator Verified', 'Welcome to LocalMarket POS Terminal', 'success');
      setActiveTab('home');
    } catch (err: any) {
      console.error('[Auth] Authentication Failure:', err);

      const isInvalidCredentials = String(err?.message || '')
        .toLowerCase()
        .includes('invalid login credentials');

      let errorMessage = err.message || 'Failed to authenticate operator terminal';
      let fieldError = 'Invalid credentials or inactive profile';

      if (isInvalidCredentials && isSystemGeneratedStaffEmail(email)) {
        // Known case: this is a staff/cashier system-generated account, which
        // has no stable password by design. Point the person at the correct flow
        // instead of leaving them to keep retrying a password that can't exist.
        errorMessage = 'This looks like a staff PIN account. Please use "Switch Account" and sign in with your 6-digit PIN instead of this screen.';
        fieldError = 'Staff accounts sign in with a PIN, not on this screen';
      } else if (isInvalidCredentials) {
        errorMessage = 'Incorrect email or password.';
        fieldError = 'Incorrect email or password';
      }

      showToast('Access Denied', errorMessage, 'error');
      setErrors(prev => ({ ...prev, email: fieldError }));
    } finally {
      setLoading(false);
    }
  };

  const checkConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);
    try {
      const result = await testSupabaseConnection();
      setTestResult(result);
    } catch (err) {
      setTestResult({
        success: false,
        message: 'Could not reach Supabase endpoint.',
        hasShopItemsTable: false,
        hasProfilesTable: false,
        hasSystemLogsTable: false,
        itemCount: 0
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const getInputClass = (error?: string) => {
    return `w-full h-11 bg-white text-gray-900 placeholder:text-gray-400 text-sm rounded-lg pl-3 pr-4 border ${
      error ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-[#c85a32]'
    } focus:ring-1 ${error ? 'focus:ring-red-500' : 'focus:ring-[#c85a32]'} focus:outline-none transition-colors`;
  };

  return (
    <div className="flex-1 min-h-screen bg-[#F5F6F8] font-sans text-gray-900 antialiased flex flex-col selection:bg-[#FDF0EA] selection:text-[#C85A32]">
      {/* Executive Header */}
      <header className="w-full h-16 border-b border-gray-200 bg-white sticky top-0 z-40">
        <div className="max-w-6xl mx-auto h-full px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-bold text-base text-gray-900 tracking-tight leading-tight">LocalMarket POS</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs text-gray-500 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>SYSTEM ONLINE</span>
            </div>
          </div>
        </div>
      </header>

      {/* Centered Form Container */}
      <main className="flex-1 flex items-center justify-center px-4 py-12 sm:py-16">
        <div className="w-full max-w-md animate-in fade-in zoom-in duration-500">
          <div className="bg-white border border-gray-200 rounded-2xl p-7 sm:p-9 shadow-sm relative overflow-hidden">
            
            <div className="flex flex-col items-center text-center mb-7">
              <h1 className="font-bold text-2xl text-gray-900 tracking-tight">
                Sign in to your shop terminal
              </h1>
              <p className="text-sm text-gray-500 mt-2">
                Use the shop owner account to unlock the terminal. Staff can then use Switch Account.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-gray-500">Email</label>
                <div className="relative">
                  <input 
                    required
                    type="email"
                    value={email}
                    onChange={handleEmailChange}
                    placeholder="e.g. owner@store.co.za"
                    className={getInputClass(errors.email)}
                  />
                </div>
                {errors.email && <p className="text-[10px] text-red-500 pl-1">{errors.email}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-gray-500">Password</label>
                <div className="relative">
                  <input 
                    required
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={handlePasswordChange}
                    placeholder="••••••••"
                    className={getInputClass(errors.password)}
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors focus:outline-none"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
                {errors.password && <p className="text-[10px] text-red-500 pl-1">{errors.password}</p>}
              </div>

              <button 
                type="submit"
                disabled={loading}
                className="w-full h-11 mt-4 bg-[#c85a32] hover:bg-[#b84e27] text-white font-semibold text-sm rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <span>Sign In</span>
                )}
              </button>

              <div className="pt-4 text-center">
                <button 
                  type="button"
                  onClick={() => setShowDiagnostics(!showDiagnostics)}
                  className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showDiagnostics ? 'Hide Diagnostics' : 'Show Terminal Diagnostics'}
                </button>
              </div>

              {showDiagnostics && (
                <div className="space-y-4 pt-2">
                  <button 
                    type="button"
                    onClick={checkConnection}
                    disabled={testingConnection}
                    className="w-full h-10 bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-medium rounded-lg border border-gray-200 flex items-center justify-center gap-2 transition-colors"
                  >
                    {testingConnection ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Database className="w-4 h-4 text-[#c85a32]" />
                        <span>Test Database Connection</span>
                      </>
                    )}
                  </button>

                  {testResult && (
                    <div className={`p-3 rounded-lg border text-[11px] font-medium flex items-start gap-2.5 ${
                      testResult.success ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
                    }`}>
                      {testResult.success ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
                      <div className="flex flex-col gap-1">
                        <span>{testResult.message}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </form>

            <div className="mt-6 pt-5 border-t border-gray-100 text-center">
              <p className="text-xs text-gray-500">
                Staff operator accounts are managed by authorized store owners and managers.
              </p>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-center gap-6 text-[11px] text-gray-400">
            <span>Encrypted Session</span>
            <span>•</span>
            <span>Multi-Branch Sync</span>
          </div>
        </div>
      </main>

      <footer className="w-full border-t border-gray-100 py-5">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
          <div className="flex items-center gap-2 text-[11px] text-gray-500">
            <span>NCR & Second-Hand Goods Workflow Ready</span>
            <span>•</span>
            <span>SAPS Form 21 Register Support</span>
          </div>
          <p className="text-[11px] text-gray-500">
            © {new Date().getFullYear()} LocalMarket POS.
          </p>
        </div>
      </footer>
    </div>
  );
};
