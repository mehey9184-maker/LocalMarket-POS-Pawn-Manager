import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { authApi } from '../../services/supabaseApi';
import { testSupabaseConnection, ConnectionTestResult } from '../../services/supabase';
import { Loader2, Database, AlertCircle, CheckCircle2 } from 'lucide-react';

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
      const errorMessage = err.message || 'Failed to authenticate operator terminal';
      showToast('Access Denied', errorMessage, 'error');
      setErrors(prev => ({ ...prev, email: 'Invalid credentials or inactive profile' }));
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
    return `w-full h-11 bg-[#1f1e1e] text-[#e5e2e1] placeholder:text-[#a58b83]/50 text-sm rounded-lg pl-10 pr-4 border ${
      error ? 'border-red-500/50 focus:border-red-500' : 'border-[#282727] focus:border-[#c85a32]'
    } focus:ring-1 ${error ? 'focus:ring-red-500' : 'focus:ring-[#c85a32]'} focus:outline-none transition-colors`;
  };

  return (
    <div className="flex-1 min-h-screen bg-[#121212] font-body text-[#e5e2e1] antialiased flex flex-col selection:bg-[#c85a32] selection:text-white">
      {/* Executive Header */}
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
              <span className="font-mono text-[10px] text-[#a58b83] tracking-wider uppercase">Point of Sale & Pawn Management</span>
            </div>
          </button>

          <div className="flex items-center gap-4">
            <button 
              className="hidden sm:flex items-center gap-1.5 text-xs text-[#a58b83] hover:text-[#e5e2e1] transition-colors font-medium"
              onClick={() => showToast('Terminal Support', 'Contact store administrator for account provisioning', 'info')}
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
            
            <div className="flex flex-col items-center text-center mb-7">
              <div className="w-12 h-12 rounded-xl bg-[#1f1e1e] flex items-center justify-center mb-3 border border-[#282727]">
                <span className="material-symbols-outlined text-[#c85a32] text-2xl">point_of_sale</span>
              </div>
              <h1 className="font-headline font-bold text-2xl text-[#e5e2e1] tracking-tight">
                Terminal Sign In
              </h1>
              <p className="text-sm text-[#a58b83] mt-1">
                Sign in to your branch terminal. Accounts are provisioned by store management.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-mono font-medium text-[#a58b83] uppercase tracking-wider">Work Email</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#a58b83] text-[18px] pointer-events-none">mail</span>
                  <input 
                    required
                    type="email"
                    value={email}
                    onChange={handleEmailChange}
                    placeholder="e.g. cashier@store.co.za"
                    className={getInputClass(errors.email)}
                  />
                </div>
                {errors.email && <p className="text-[10px] text-red-500 font-mono pl-1">{errors.email}</p>}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-mono font-medium text-[#a58b83] uppercase tracking-wider">Password or PIN</label>
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

              <button 
                type="submit"
                disabled={loading}
                className="w-full h-12 mt-2 bg-[#c85a32] hover:bg-[#b84e27] active:scale-[0.99] text-white font-headline font-semibold text-sm rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-[#c85a32]/25 transition-all focus:outline-none disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <span>Sign In to Terminal</span>
                    <span className="material-symbols-outlined text-base">arrow_forward</span>
                  </>
                )}
              </button>

              <div className="flex flex-col gap-4 pt-2">
                <div className="relative py-1 flex items-center justify-center">
                  <div className="w-full border-t border-[#282727]"></div>
                  <span className="absolute bg-[#181717] px-3 text-[10px] font-mono uppercase tracking-widest text-[#a58b83]/60">Diagnostics</span>
                </div>

                <button 
                  type="button"
                  onClick={checkConnection}
                  disabled={testingConnection}
                  className="w-full h-11 bg-[#1f1e1e] hover:bg-[#282727] text-[#e5e2e1] text-xs font-medium rounded-lg border border-[#282727] flex items-center justify-center gap-2 transition-colors focus:outline-none"
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
                  <div className={`p-3 rounded-lg border text-[11px] font-medium flex items-start gap-2.5 animate-in fade-in slide-in-from-top-1 ${
                    testResult.success ? 'bg-green-500/5 border-green-500/20 text-green-400' : 'bg-red-500/5 border-red-500/20 text-red-400'
                  }`}>
                    {testResult.success ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
                    <div className="flex flex-col gap-1">
                      <span>{testResult.message}</span>
                      {testResult.success && (
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 opacity-80 font-mono text-[9px] mt-1">
                          <span className="flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${testResult.hasProfilesTable ? 'bg-green-500' : 'bg-red-500'}`}></span>
                            Profiles: {testResult.hasProfilesTable ? 'Found' : 'Missing'}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${testResult.hasShopItemsTable ? 'bg-green-500' : 'bg-red-500'}`}></span>
                            Inventory: {testResult.hasShopItemsTable ? 'Found' : 'Missing'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </form>

            <div className="mt-6 pt-5 border-t border-[#282727]/60 text-center">
              <p className="text-xs text-[#a58b83]">
                Staff operator accounts are managed by authorized store owners and managers.
              </p>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-center gap-6 text-[11px] text-[#a58b83]/80 font-mono">
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[#4edea3] text-sm">lock</span>
              Encrypted Session
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[#4edea3] text-sm">cloud_done</span>
              Multi-Branch Sync
            </span>
          </div>
        </div>
      </main>

      <footer className="w-full border-t border-[#282727]/30 py-5">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
          <div className="flex items-center gap-2 text-[11px] font-mono text-[#a58b83]">
            <span>NCR & Second-Hand Goods Workflow Ready</span>
            <span>•</span>
            <span>SAPS Form 21 Register Support</span>
          </div>
          <p className="text-[11px] text-[#a58b83]">
            © {new Date().getFullYear()} LocalMarket POS.
          </p>
        </div>
      </footer>
    </div>
  );
};
