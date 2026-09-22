import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { authApi } from '../../services/supabaseApi';
import { Loader2 } from 'lucide-react';

export const AuthPage: React.FC = () => {
  const { setActiveTab, showToast } = useApp();
  const [isLogin, setIsLogin] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [otpCode, setOtpCode] = useState('');

  // Validation State
  const [errors, setErrors] = useState<{ email?: string; password?: string; fullName?: string; otp?: string }>({});

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
    if (!isLogin && !val) return 'Full name is required';
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

  const handleFullNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFullName(val);
    setErrors(prev => ({ ...prev, fullName: validateFullName(val) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isVerifying) {
      handleVerifyOtp();
      return;
    }

    // Final validation
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
      console.log('[Auth] Initiating signup flow for:', email);
      
      if (isLogin) {
        console.log('[Auth] Attempting Sign In...');
        const { data, error } = await authApi.signIn(email, password);
        if (error) throw error;
        
        console.log('[Auth] Sign In Successful:', data.user?.id);
        showToast('Operator Verified', 'Welcome to LocalMarket POS Terminal', 'success');
        setActiveTab('dashboard');
      } else {
        console.log('[Auth] Attempting Sign Up with metadata:', { fullName });
        const { data, error } = await authApi.signUp(email, password, fullName);
        
        if (error) {
          console.error('[Auth] Sign Up Error Payload:', error);
          // Special handling for the common "Database error saving new user" (Trigger failure)
          if (error.message.includes('Database error saving new user')) {
            setDbError(true);
            throw new Error('Terminal Database Error: The SQL Trigger in your Supabase project is crashing. This happens when the "profiles" table is missing or doesn\'t match the expected structure.');
          }
          throw error;
        }
        
        console.log('[Auth] Sign Up Successful. User ID:', data.user?.id);
        console.log('[Auth] Transitioning to OTP Verification Screen...');
        
        showToast('Security Code Sent', 'Check your work email for the 6-digit terminal PIN.', 'info');
        setIsVerifying(true);
      }
    } catch (err: any) {
      console.error('[Auth] Comprehensive Authentication Failure:', {
        message: err.message,
        details: err.details,
        hint: err.hint,
        code: err.code,
        stack: err.stack
      });
      
      const errorMessage = err.message || 'Failed to authenticate terminal';
      showToast('Access Denied', errorMessage, 'error');
      
      // If the error specifically mentions the profiles table, set a field error too
      if (err.message.toLowerCase().includes('database') || err.message.toLowerCase().includes('profile')) {
        setErrors(prev => ({ ...prev, email: 'Database Sync Failure' }));
      }
    } finally {
      setLoading(false);
    }
  };

  const [dbError, setDbError] = useState(false);
  const [showSql, setShowSql] = useState(false);

  const repairSql = `-- SUPABASE REPAIR SCRIPT
-- Run this in your Supabase SQL Editor to fix the "Database error saving new user"

-- 1. Reset everything related to profiles
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 2. Create the profiles table with highly resilient defaults
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL PRIMARY KEY,
  email text,
  full_name text DEFAULT 'Operator',
  cashier_code text UNIQUE DEFAULT 'C-' || upper(substring(gen_random_uuid()::text from 1 for 4)),
  role text DEFAULT 'cashier',
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- 3. Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for now" ON public.profiles;
CREATE POLICY "Allow all for now" ON public.profiles FOR ALL USING (true);

-- 4. Resilient trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'fullName', 'Operator'), 
    COALESCE(new.raw_user_meta_data->>'role', 'cashier')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Attach the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();`;

  const copySql = () => {
    navigator.clipboard.writeText(repairSql);
    showToast('SQL Copied', 'Paste this into your Supabase SQL Editor and run it.', 'success');
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length !== 6) {
      setErrors(prev => ({ ...prev, otp: 'Please enter all 6 digits' }));
      return;
    }

    setLoading(true);
    try {
      console.log('[Auth] Attempting OTP verification for:', email);
      const { data, error } = await authApi.verifyEmailOtp(email, otpCode);
      
      if (error) {
        console.error('[Auth] OTP Verification Error:', error);
        throw error;
      }

      console.log('[Auth] OTP Verified. Session:', data.session?.user.id);
      showToast('Terminal Provisioned', 'Account verified successfully.', 'success');
      setActiveTab('dashboard');
    } catch (err: any) {
      console.error('[Auth] Verification Failure:', err);
      showToast('Verification Failed', err.message || 'Invalid or expired security code', 'error');
    } finally {
      setLoading(false);
    }
  };

  const simulateBadgeScan = () => {
    setEmail('OP-4092@localmarket.co.za');
    setPassword('••••••••');
    setErrors({});
    showToast('Badge Detected', 'Sipho D. - Senior Operator', 'success');
  };

  const getInputClass = (error?: string) => {
    return `w-full h-11 bg-[#1f1e1e] text-[#e5e2e1] placeholder:text-[#a58b83]/50 text-sm rounded-lg pl-10 pr-4 border ${
      error ? 'border-red-500/50 focus:border-red-500' : 'border-[#282727] focus:border-[#c85a32]'
    } focus:ring-1 ${error ? 'focus:ring-red-500' : 'focus:ring-[#c85a32]'} focus:outline-none transition-colors`;
  };

  return (
    <div className="flex-1 min-h-screen bg-[#121212] font-body text-[#e5e2e1] antialiased flex flex-col selection:bg-[#c85a32] selection:text-white">
      {/* Minimal Executive Header */}
      <header className="w-full h-16 border-b border-[#282727]/40 bg-[#121212]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto h-full px-6 flex items-center justify-between">
          <button 
            onClick={() => setActiveTab('landing')}
            className="flex items-center gap-3 group focus:outline-none"
          >
            <img 
              alt="LocalMarket Logo" 
              className="h-8 w-auto object-contain transition-transform group-hover:scale-105" 
              src="https://lh3.googleusercontent.com/aida/AEtjO1UfUiIqabsIZ56CPMQZDDINSLpdT6QSVf0B-x4HcMjJ7PbKy_i1yem7zMzcxE-B3NFGYhcHZZk80VwzUIdvChBRjEwHktu1TMTOe5OBWbir5UPYK4hYX8JdLPVmSJk_ijs2Y64lfbrJhnJ7iubyPSX-zCr7eWK0ZpdTKUFjekNlHKaSjlNDN4T_dfkLorrnQuH7uvl4cC9w6XnNreypS5GNTEbnnCG481DTrFY5hD4EUs5E_rhWM71Ivk"
            />
            <div className="flex flex-col text-left">
              <span className="font-headline font-bold text-base text-[#e5e2e1] tracking-tight leading-tight">LocalMarket POS</span>
              <span className="font-mono text-[10px] text-[#a58b83] tracking-wider uppercase">Powered by LocalEats SA</span>
            </div>
          </button>
          
          <div className="flex items-center gap-4">
            <button 
              className="hidden sm:flex items-center gap-1.5 text-xs text-[#a58b83] hover:text-[#e5e2e1] transition-colors font-medium"
              onClick={() => showToast('Terminal Support', 'Dial 0800-LOCAL-POS or contact help@localeats.co.za', 'info')}
            >
              <span className="material-symbols-outlined text-[18px]">help_outline</span>
              <span>Terminal Help</span>
            </button>
            <div className="h-4 w-px bg-[#282727] hidden sm:block"></div>
            <div className="flex items-center gap-2 text-xs text-[#a58b83] font-mono">
              <span className="w-2 h-2 rounded-full bg-[#4edea3]"></span>
              <span className="hidden md:inline">SYSTEM ONLINE</span>
            </div>
          </div>
        </div>
      </header>

      {/* Centered Form Container */}
      <main className="flex-1 flex items-center justify-center px-4 py-12 sm:py-16">
        <div className="w-full max-w-md animate-in fade-in zoom-in duration-500">
          <div className="bg-[#181717] border border-[#282727]/60 rounded-2xl p-7 sm:p-9 shadow-2xl relative overflow-hidden backdrop-blur-sm">
            
            {isVerifying ? (
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-xl bg-[#1f1e1e] flex items-center justify-center mb-3 border border-[#282727]">
                  <span className="material-symbols-outlined text-[#c85a32] text-2xl">mark_email_unread</span>
                </div>
                <h1 className="font-headline font-bold text-2xl text-[#e5e2e1] tracking-tight">Verify Terminal</h1>
                <p className="text-sm text-[#a58b83] mt-2 mb-8">
                  A 6-digit security PIN has been sent to <br />
                  <span className="text-[#e5e2e1] font-medium">{email}</span>
                </p>

                <div className="w-full space-y-6">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-mono font-medium text-[#a58b83] uppercase tracking-wider text-left">6-Digit Security Code</label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#a58b83] text-[18px] pointer-events-none">key</span>
                      <input 
                        required
                        type="text"
                        maxLength={6}
                        value={otpCode}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '');
                          setOtpCode(val);
                          if (val.length === 6) setErrors(prev => ({ ...prev, otp: '' }));
                        }}
                        placeholder="0 0 0 0 0 0"
                        className={`${getInputClass(errors.otp)} text-center tracking-[1em] font-mono text-lg pl-4`}
                      />
                    </div>
                    {errors.otp && <p className="text-[10px] text-red-500 font-mono pl-1 text-left">{errors.otp}</p>}
                  </div>

                  <button 
                    onClick={handleVerifyOtp}
                    disabled={loading || otpCode.length !== 6}
                    className="w-full h-12 bg-[#c85a32] hover:bg-[#b84e27] active:scale-[0.99] text-white font-headline font-semibold text-sm rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-[#c85a32]/25 transition-all focus:outline-none disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirm Verification'}
                  </button>

                  <div className="pt-4 text-center">
                    <button 
                      type="button"
                      onClick={() => { setIsVerifying(false); setOtpCode(''); }}
                      className="text-xs text-[#a58b83] hover:text-[#e5e2e1] transition-colors"
                    >
                      Back to Registration
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-col items-center text-center mb-7">
                  <div className="w-12 h-12 rounded-xl bg-[#1f1e1e] flex items-center justify-center mb-3 border border-[#282727]">
                    <span className="material-symbols-outlined text-[#c85a32] text-2xl">point_of_sale</span>
                  </div>
                  <h1 className="font-headline font-bold text-2xl text-[#e5e2e1] tracking-tight">
                    {isLogin ? 'Welcome back' : 'Register Operator'}
                  </h1>
                  <p className="text-sm text-[#a58b83] mt-1">
                    {isLogin ? 'Sign in to your LocalMarket counter terminal' : 'Create your operator profile & secure access'}
                  </p>
                </div>

                <div className="grid grid-cols-2 p-1 bg-[#0e0e0e] rounded-xl mb-7 border border-[#282727]/40">
                  <button 
                    className={`py-2 text-xs sm:text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-1.5 ${isLogin ? 'bg-[#1f1e1e] text-[#e5e2e1] shadow-sm' : 'text-[#a58b83] hover:text-[#e5e2e1]'}`}
                    onClick={() => { setIsLogin(true); setErrors({}); }}
                  >
                    <span className="material-symbols-outlined text-base">login</span>
                    <span>Sign In</span>
                  </button>
                  <button 
                    className={`py-2 text-xs sm:text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-1.5 ${!isLogin ? 'bg-[#1f1e1e] text-[#e5e2e1] shadow-sm' : 'text-[#a58b83] hover:text-[#e5e2e1]'}`}
                    onClick={() => { setIsLogin(false); setErrors({}); }}
                  >
                    <span className="material-symbols-outlined text-base">person_add</span>
                    <span>Register</span>
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {!isLogin && (
                    <div className="space-y-1.5">
                      <label className="block text-xs font-mono font-medium text-[#a58b83] uppercase tracking-wider">Full Name</label>
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#a58b83] text-[18px] pointer-events-none">person</span>
                        <input 
                          required
                          type="text"
                          value={fullName}
                          onChange={handleFullNameChange}
                          placeholder="e.g. Sipho Dhlamini"
                          className={getInputClass(errors.fullName)}
                        />
                      </div>
                      {errors.fullName && <p className="text-[10px] text-red-500 font-mono pl-1">{errors.fullName}</p>}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="block text-xs font-mono font-medium text-[#a58b83] uppercase tracking-wider">Work Email</label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#a58b83] text-[18px] pointer-events-none">mail</span>
                      <input 
                        required
                        type="email"
                        value={email}
                        onChange={handleEmailChange}
                        placeholder="e.g. cashier@localmarket.co.za"
                        className={getInputClass(errors.email)}
                      />
                    </div>
                    {errors.email && <p className="text-[10px] text-red-500 font-mono pl-1">{errors.email}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-mono font-medium text-[#a58b83] uppercase tracking-wider">Password or PIN</label>
                      <button type="button" className="text-xs text-[#c85a32] hover:underline font-medium focus:outline-none">Forgot?</button>
                    </div>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#a58b83] text-[18px] pointer-events-none">lock</span>
                      <input 
                        required
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={handlePasswordChange}
                        placeholder="••••••••"
                        className={`${getInputClass(errors.password)} font-mono`}
                      />
                      <button 
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a58b83] hover:text-[#e5e2e1] transition-colors focus:outline-none"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          {showPassword ? "visibility_off" : "visibility"}
                        </span>
                      </button>
                    </div>
                    {errors.password && <p className="text-[10px] text-red-500 font-mono pl-1">{errors.password}</p>}
                  </div>

                  {isLogin && (
                    <div className="flex items-center justify-between pt-1">
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input 
                          type="checkbox" 
                          defaultChecked 
                          className="w-4 h-4 rounded border-[#282727] bg-[#1f1e1e] text-[#c85a32] focus:ring-[#c85a32] focus:ring-offset-0 focus:ring-offset-transparent cursor-pointer" 
                        />
                        <span className="text-xs text-[#a58b83] group-hover:text-[#e5e2e1] transition-colors select-none">Remember this terminal</span>
                      </label>
                      <span className="text-[11px] font-mono text-[#4edea3] flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#4edea3]"></span>
                        TLS 1.3
                      </span>
                    </div>
                  )}

                  <button 
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 mt-2 bg-[#c85a32] hover:bg-[#b84e27] active:scale-[0.99] text-white font-headline font-semibold text-sm rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-[#c85a32]/25 transition-all focus:outline-none disabled:opacity-50"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <span>{isLogin ? 'Sign In to Terminal' : 'Create Profile'}</span>
                        <span className="material-symbols-outlined text-base">
                          {isLogin ? 'arrow_forward' : 'check_circle'}
                        </span>
                      </>
                    )}
                  </button>

                  {isLogin && (
                    <>
                      <div className="relative py-2.5 flex items-center justify-center">
                        <div className="w-full border-t border-[#282727]"></div>
                        <span className="absolute bg-[#181717] px-3 text-[11px] font-mono uppercase tracking-wider text-[#a58b83]">or sign in with</span>
                      </div>

                      <button 
                        type="button"
                        onClick={simulateBadgeScan}
                        className="w-full h-11 bg-[#1f1e1e] hover:bg-[#282727] text-[#e5e2e1] text-xs font-medium rounded-lg border border-[#282727] flex items-center justify-center gap-2 transition-colors focus:outline-none"
                      >
                        <span className="material-symbols-outlined text-base text-[#c85a32]">qr_code_scanner</span>
                        <span>Tap Staff Badge / Biometric RFID</span>
                      </button>
                    </>
                  )}
                </form>

                {dbError && (
                  <div className="mt-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl animate-in fade-in slide-in-from-top-2 text-left">
                    <div className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-red-500 text-xl mt-0.5">database_off</span>
                      <div className="space-y-2">
                        <p className="text-[13px] font-bold text-red-400">Database Trigger Failure</p>
                        <p className="text-[11px] text-[#a58b83] leading-relaxed">
                          Your Supabase project is missing the <code className="text-[#e5e2e1]">profiles</code> table or trigger. 
                          The terminal cannot provision your operator profile until this is fixed.
                        </p>
                        <div className="flex flex-wrap gap-2 pt-1">
                          <button 
                            type="button"
                            onClick={copySql}
                            className="px-3 py-1.5 bg-[#c85a32] hover:bg-[#b84e27] text-white text-[10px] font-bold rounded-md flex items-center gap-1.5 transition-colors"
                          >
                            <span className="material-symbols-outlined text-[14px]">content_copy</span>
                            Copy Repair SQL
                          </button>
                          <button 
                            type="button"
                            onClick={() => setShowSql(!showSql)}
                            className="px-3 py-1.5 bg-[#1f1e1e] hover:bg-[#282727] text-[#a58b83] hover:text-[#e5e2e1] text-[10px] font-bold rounded-md flex items-center gap-1.5 transition-colors border border-[#282727]"
                          >
                            <span className="material-symbols-outlined text-[14px]">visibility</span>
                            {showSql ? 'Hide SQL' : 'View SQL'}
                          </button>
                        </div>
                        
                        {showSql && (
                          <div className="mt-3 p-3 bg-black/40 rounded border border-[#282727] overflow-x-auto max-h-40">
                            <pre className="text-[9px] font-mono text-[#a58b83] whitespace-pre">
                              {repairSql}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-6 pt-5 border-t border-[#282727]/60 text-center">
                  <p className="text-xs text-[#a58b83]">
                    {isLogin ? "Don't have an operator profile?" : "Already registered?"}
                    <button 
                      type="button"
                      onClick={() => setIsLogin(!isLogin)}
                      className="text-[#c85a32] hover:underline font-semibold ml-1 focus:outline-none"
                    >
                      {isLogin ? "Register here" : "Sign in to terminal"}
                    </button>
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Quick Trust Indicators */}
          <div className="mt-6 flex items-center justify-center gap-6 text-[11px] text-[#a58b83]/80 font-mono">
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[#4edea3] text-sm">lock</span>
              256-bit Encrypted
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[#4edea3] text-sm">cloud_done</span>
              LocalEats Core Sync
            </span>
          </div>
        </div>
      </main>

      {/* Quiet Legal Footer */}
      <footer className="w-full border-t border-[#282727]/30 py-5">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
          <div className="flex items-center gap-2 text-[11px] font-mono text-[#a58b83]">
            <span>NCRCP Regulated</span>
            <span>•</span>
            <span>SAPS Second-Hand Goods Act Compliant</span>
          </div>
          <p className="text-[11px] text-[#a58b83]">
            © {new Date().getFullYear()} LocalMarket POS. Secure retail and pawn infrastructure.
          </p>
        </div>
      </footer>
    </div>
  );
};


