import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { authApi } from '../../services/supabaseApi';
import { testSupabaseConnection, ConnectionTestResult } from '../../services/supabase';
import { Loader2, Database, AlertCircle, CheckCircle2, UserPlus, LogIn, Mail, Lock, User, Eye, EyeOff } from 'lucide-react';

const SYSTEM_STAFF_EMAIL_DOMAIN = '@localmarketpos.co.za';

const isSystemGeneratedStaffEmail = (value: string) =>
  value.trim().toLowerCase().endsWith(SYSTEM_STAFF_EMAIL_DOMAIN);

export const AuthPage: React.FC = () => {
  const { showToast } = useApp();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const loginHint = typeof window !== 'undefined' ? (sessionStorage.getItem('lm_login_hint') || '') : '';

  // Form State
  const [email, setEmail] = useState(loginHint);
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');

  // Validation State
  const [errors, setErrors] = useState<{ email?: string; password?: string; fullName?: string }>({});

  // Connection Test State (tucked away secondary diagnostics)
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

  const validateFullName = (val: string) => {
    if (isSignUp && !val) return 'Full name is required';
    return '';
  };

  const toggleAuthMode = () => {
    setIsSignUp(prev => !prev);
    setErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const eError = validateEmail(email);
    const pError = validatePassword(password);
    const fError = validateFullName(fullName);

    if (eError || pError || fError) {
      setErrors({ email: eError, password: pError, fullName: fError });
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      if (isSignUp) {
        console.log('[Auth] Attempting Owner Sign Up for:', email);
        const { data, error } = await authApi.signUp(email, password, fullName, 'owner');
        if (error) throw error;
        
        if (data?.session) {
          showToast('Account Created', 'Welcome to LocalMarket POS.', 'success');
          // Session will be picked up by AuthContext
        } else {
          showToast('Verification Required', 'Please check your email to confirm your account.', 'info');
          setIsSignUp(false);
        }
      } else {
        console.log('[Auth] Attempting Operator Sign In for:', email);
        const { error } = await authApi.signIn(email, password);
        if (error) throw error;

        showToast('Welcome back', 'Welcome to LocalMarket POS Terminal', 'success');
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('lm_login_hint');
        }
        // Redirection logic is handled in App.tsx based on profile state
      }
    } catch (err: any) {
      console.error('[Auth] Authentication Failure:', err);

      const isInvalidCredentials = String(err?.message || '')
        .toLowerCase()
        .includes('invalid login credentials');

      let errorMessage = err.message || 'Failed to authenticate operator terminal';
      let fieldError = 'Invalid credentials or inactive profile';

      if (isInvalidCredentials && isSystemGeneratedStaffEmail(email)) {
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
    } catch {
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

  const getInputClass = (error?: string, hasRightElement?: boolean) => {
    return `w-full h-12 bg-white text-stone-900 placeholder:text-stone-400 text-sm sm:text-base rounded-xl pl-11 ${
      hasRightElement ? 'pr-11' : 'pr-4'
    } border ${
      error
        ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
        : 'border-stone-200 focus:border-[#C85A32] focus:ring-[#C85A32]/20'
    } focus:ring-2 focus:outline-none shadow-xs transition-all duration-150`;
  };

  return (
    <div className="relative min-h-screen flex flex-col justify-between font-sans text-stone-900 antialiased overflow-x-hidden selection:bg-[#FDF0EA] selection:text-[#C85A32]">
      {/* Subtle Animated Sky & Cloud Atmosphere */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0 select-none" aria-hidden="true">
        {/* Soft, serene sky gradient: subtle morning horizon atmosphere */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#EBF2F7] via-[#F6F5F2] to-[#F5ECE3]" />
        
        {/* Gentle dawn warmth horizon glow */}
        <div className="absolute -bottom-24 left-0 right-0 h-96 bg-gradient-to-t from-[#F8EDE1]/60 via-[#FDF9F4]/40 to-transparent" />

        {/* Ambient morning light sheen top-right */}
        <div className="absolute -top-32 right-[-10%] w-[560px] h-[560px] rounded-full bg-gradient-to-br from-[#FFF7EA]/40 via-[#FFF1D6]/20 to-transparent filter blur-3xl" />

        {/* Cloud Layer 1: High subtle drifts */}
        <div className="cloud-layer-1 absolute -top-12 -left-20 w-[140%] h-[55%] opacity-40 filter blur-3xl">
          <div className="absolute top-[8%] left-[12%] w-[480px] h-[220px] rounded-full bg-white/90" />
          <div className="absolute top-[3%] left-[45%] w-[580px] h-[260px] rounded-full bg-white/80" />
          <div className="absolute top-[12%] left-[72%] w-[420px] h-[190px] rounded-full bg-white/75" />
        </div>

        {/* Cloud Layer 2: Mid atmosphere billows */}
        <div className="cloud-layer-2 absolute top-[16%] -left-32 w-[150%] h-[60%] opacity-50 filter blur-[46px]">
          <div className="absolute top-[12%] left-[6%] w-[540px] h-[240px] rounded-full bg-gradient-to-tr from-white via-white/95 to-[#FFFBF5]" />
          <div className="absolute top-[22%] left-[34%] w-[640px] h-[270px] rounded-full bg-white/90" />
          <div className="absolute top-[8%] left-[64%] w-[500px] h-[220px] rounded-full bg-gradient-to-br from-white to-[#F0F6FB]" />
          <div className="absolute top-[26%] left-[82%] w-[400px] h-[190px] rounded-full bg-white/80" />
        </div>

        {/* Cloud Layer 3: Lower soft expanse */}
        <div className="cloud-layer-3 absolute bottom-[6%] -left-20 w-[140%] h-[50%] opacity-45 filter blur-[56px]">
          <div className="absolute bottom-[8%] left-[8%] w-[620px] h-[260px] rounded-full bg-white/90" />
          <div className="absolute bottom-[16%] left-[46%] w-[720px] h-[300px] rounded-full bg-gradient-to-t from-white via-[#FCF9F5] to-white/70" />
          <div className="absolute bottom-[4%] left-[78%] w-[520px] h-[230px] rounded-full bg-white/85" />
        </div>
      </div>

      {/* Top Header */}
      <header className="relative z-10 w-full px-6 py-5 max-w-6xl mx-auto flex items-center justify-between animate-auth-fade">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#C85A32] text-white flex items-center justify-center shadow-sm shadow-[#C85A32]/25">
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 9l2-5h14l2 5" />
              <path d="M21 9v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9" />
              <path d="M9 21V12h6v9" />
              <path d="M3 9h18" />
            </svg>
          </div>
          <div>
            <span className="font-headline font-bold text-lg text-stone-900 tracking-tight block leading-tight">
              LocalMarket <span className="font-semibold text-[#C85A32] text-sm">POS</span>
            </span>
          </div>
        </div>

        <div className="text-xs font-medium text-stone-500 hidden sm:flex items-center gap-2">
          <span>South African Retail &amp; Pawn</span>
        </div>
      </header>

      {/* Main Centered Content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-8 sm:py-12">
        {/* Confident, Calm Hero Area */}
        <div className="text-center mb-6 sm:mb-8 animate-auth-fade">
          <h1 className="font-headline font-bold text-3xl sm:text-4xl text-stone-900 tracking-tight">
            LocalMarket POS
          </h1>
          <p className="text-stone-600 text-sm sm:text-base mt-2 font-normal">
            Your shop, ready when you are.
          </p>
        </div>

        {/* Authentication Card */}
        <div className="w-full max-w-[440px] animate-auth-card">
          <div className="bg-white/95 backdrop-blur-md border border-stone-200/90 rounded-2xl p-7 sm:p-9 shadow-xl shadow-stone-900/[0.04]">
            
            {/* Card Heading */}
            <div className="text-center mb-7">
              <h2 className="font-headline font-bold text-2xl text-stone-900 tracking-tight">
                {isSignUp ? 'Create your LocalMarket account' : 'Sign in to LocalMarket'}
              </h2>
              <p className="text-sm text-stone-500 mt-2 leading-relaxed">
                {isSignUp 
                  ? 'Set up your shop and get started.'
                  : 'Owners sign in with their email. Staff use their account PIN.'}
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4.5" noValidate>
              {/* Full Name field (Sign Up only) */}
              {isSignUp && (
                <div className="space-y-1.5 transition-all">
                  <label htmlFor="fullName" className="block text-xs font-semibold text-stone-700">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
                    <input 
                      id="fullName"
                      required
                      type="text"
                      autoComplete="name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Sipho Dlamini"
                      aria-invalid={!!errors.fullName}
                      aria-describedby={errors.fullName ? "fullName-error" : undefined}
                      className={getInputClass(errors.fullName)}
                    />
                  </div>
                  {errors.fullName && (
                    <p id="fullName-error" role="alert" className="text-xs text-red-600 flex items-center gap-1.5 pt-0.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{errors.fullName}</span>
                    </p>
                  )}
                </div>
              )}

              {/* Email field */}
              <div className="space-y-1.5">
                <label htmlFor="email" className="block text-xs font-semibold text-stone-700">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
                  <input 
                    id="email"
                    required
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. owner@store.co.za"
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? "email-error" : undefined}
                    className={getInputClass(errors.email)}
                  />
                </div>
                {errors.email && (
                  <p id="email-error" role="alert" className="text-xs text-red-600 flex items-center gap-1.5 pt-0.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{errors.email}</span>
                  </p>
                )}
              </div>

              {/* Password field */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="block text-xs font-semibold text-stone-700">
                    Password
                  </label>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
                  <input 
                    id="password"
                    required
                    type={showPassword ? "text" : "password"}
                    autoComplete={isSignUp ? "new-password" : "current-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    aria-invalid={!!errors.password}
                    aria-describedby={errors.password ? "password-error" : undefined}
                    className={getInputClass(errors.password, true)}
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 p-1 focus:outline-none focus:ring-1 focus:ring-[#C85A32] rounded transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p id="password-error" role="alert" className="text-xs text-red-600 flex items-center gap-1.5 pt-0.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{errors.password}</span>
                  </p>
                )}
              </div>

              {/* Primary Action Button */}
              <button 
                type="submit"
                disabled={loading}
                className="w-full h-12 mt-2 bg-[#C85A32] hover:bg-[#B84E27] active:scale-[0.99] text-white font-semibold text-sm rounded-xl flex items-center justify-center gap-2 shadow-sm shadow-[#C85A32]/25 transition-all duration-150 disabled:opacity-50 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85A32] focus-visible:ring-offset-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{isSignUp ? 'Creating account...' : 'Signing in...'}</span>
                  </>
                ) : (
                  <>
                    {isSignUp ? <UserPlus className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
                    <span>{isSignUp ? 'Create Account' : 'Sign In'}</span>
                  </>
                )}
              </button>

              {/* Secondary Action: Mode Switch */}
              <div className="pt-2 text-center">
                <button 
                  type="button"
                  onClick={toggleAuthMode}
                  className="text-sm font-medium text-[#C85A32] hover:text-[#A94725] hover:underline transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85A32] rounded"
                >
                  {isSignUp ? 'Already have an account? Sign In' : 'Need an owner account? Create one'}
                </button>
              </div>

              {/* Staff PIN Notice */}
              {!isSignUp && (
                <div className="mt-5 pt-4 border-t border-stone-100 text-center">
                  <p className="text-xs text-stone-500">
                    Cashiers &amp; staff sign in directly at the terminal with their PIN.
                  </p>
                </div>
              )}

              {/* Discreet Diagnostics Area */}
              <div className="mt-4 pt-2 flex flex-col items-center">
                <button 
                  type="button"
                  onClick={() => setShowDiagnostics(!showDiagnostics)}
                  className="text-[11px] font-medium text-stone-400 hover:text-stone-600 flex items-center gap-1.5 transition-colors focus:outline-none"
                >
                  <Database className="w-3 h-3 text-stone-400" />
                  <span>{showDiagnostics ? 'Hide system status' : 'System diagnostics'}</span>
                </button>

                {showDiagnostics && (
                  <div className="w-full mt-3 p-3.5 rounded-xl bg-stone-50 border border-stone-200/80 space-y-2.5 animate-auth-fade">
                    <button 
                      type="button"
                      onClick={checkConnection}
                      disabled={testingConnection}
                      className="w-full h-9 bg-white hover:bg-stone-100 text-stone-700 text-xs font-medium rounded-lg border border-stone-200 flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {testingConnection ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <>
                          <Database className="w-3.5 h-3.5 text-[#C85A32]" />
                          <span>Test database connection</span>
                        </>
                      )}
                    </button>

                    {testResult && (
                      <div 
                        className={`p-2.5 rounded-lg border text-xs font-medium flex items-start gap-2 ${
                          testResult.success 
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                            : 'bg-rose-50 border-rose-200 text-rose-800'
                        }`}
                      >
                        {testResult.success ? (
                          <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />
                        ) : (
                          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-600" />
                        )}
                        <div className="flex-1 text-[11px] leading-tight">
                          {testResult.success ? 'Connected to secure cloud database.' : testResult.message}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </form>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full py-5 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left text-xs text-stone-500">
          <p>© {new Date().getFullYear()} LocalMarket POS · South African Retail Edition</p>
          <p className="text-stone-400 text-[11px]">Simple, reliable point of sale</p>
        </div>
      </footer>
    </div>
  );
};
