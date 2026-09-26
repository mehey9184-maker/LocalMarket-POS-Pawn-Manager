import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { authApi } from '../../services/supabaseApi';
import { ProfileRow } from '../../types/supabase';
import { Loader2, ArrowLeft, Key, ShieldCheck, Lock, X } from 'lucide-react';

export const AccountPicker: React.FC = () => {
  const { 
    users, 
    profile: currentProfile, 
    isAccountPickerOpen, 
    setIsAccountPickerOpen,
    logout
  } = useAuth();

  const { showToast } = useApp();
  
  const [selectedStaff, setSelectedStaff] = useState<ProfileRow | null>(null);
  const [pin, setPin] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);

  // Close modal on Escape key press
  useEffect(() => {
    if (!isAccountPickerOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsAccountPickerOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAccountPickerOpen, setIsAccountPickerOpen]);

  // Reset local state when picker closes
  useEffect(() => {
    if (!isAccountPickerOpen) {
      setSelectedStaff(null);
      setPin('');
      setError(null);
      setLockoutUntil(null);
      setRemainingSeconds(0);
    }
  }, [isAccountPickerOpen]);

  if (!isAccountPickerOpen) return null;

  // Format seconds as MM:SS
  const formatTime = (totalSeconds: number): string => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleSelectStaff = (staff: ProfileRow) => {
    if (staff.id === currentProfile?.id) {
      setIsAccountPickerOpen(false);
      return;
    }

    if (staff.role === 'owner') {
      // Owner selection ends current staff session and returns to login flow
      if (staff.email) {
        sessionStorage.setItem('lm_login_hint', staff.email);
      }
      setIsAccountPickerOpen(false);
      logout();
      return;
    }

    setSelectedStaff(staff);
    setPin('');
    setError(null);

    // Restore any existing session lockout timestamp for this staff
    try {
      const savedLockout = sessionStorage.getItem(`pin_lockout_${staff.id}`);
      if (savedLockout) {
        const until = parseInt(savedLockout, 10);
        const now = Date.now();
        if (until > now) {
          setLockoutUntil(until);
          setRemainingSeconds(Math.ceil((until - now) / 1000));
        } else {
          sessionStorage.removeItem(`pin_lockout_${staff.id}`);
          setLockoutUntil(null);
          setRemainingSeconds(0);
        }
      } else {
        setLockoutUntil(null);
        setRemainingSeconds(0);
      }
    } catch {
      setLockoutUntil(null);
      setRemainingSeconds(0);
    }
  };

  const handleBack = () => {
    setSelectedStaff(null);
    setPin('');
    setError(null);
    setLockoutUntil(null);
    setRemainingSeconds(0);
  };

  // Timer effect that counts down once per second and cleans up on unmount or zero
  useEffect(() => {
    if (!lockoutUntil) {
      setRemainingSeconds(0);
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const diff = Math.max(0, Math.ceil((lockoutUntil - now) / 1000));
      setRemainingSeconds(diff);

      if (diff <= 0) {
        setLockoutUntil(null);
        setError(null);
        if (selectedStaff) {
          try {
            sessionStorage.removeItem(`pin_lockout_${selectedStaff.id}`);
          } catch {}
        }
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [lockoutUntil, selectedStaff]);

  const isLocked = remainingSeconds > 0;

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'owner': return 'Owner';
      case 'manager': return 'Manager';
      case 'senior_cashier': return 'Senior Cashier';
      case 'cashier': return 'Cashier';
      default: return role.replace(/_/g, ' ');
    }
  };

  const handleLogin = async () => {
    if (!selectedStaff || isLocked || isAuthenticating || pin.length !== 6) return;

    setIsAuthenticating(true);
    setError(null);

    try {
      const res = await authApi.loginWithPin(selectedStaff.cashier_code, pin);
      
      if (!res.success) {
        if (res.locked) {
          const seconds = res.remainingSeconds || 900;
          const until = Date.now() + seconds * 1000;
          setLockoutUntil(until);
          setRemainingSeconds(seconds);
          try {
            sessionStorage.setItem(`pin_lockout_${selectedStaff.id}`, String(until));
          } catch {}
          setError(res.error || 'Too many failed attempts.');
        } else {
          setError(res.error || 'Invalid PIN.');
        }
        return;
      }

      showToast('Welcome Back', `Logged in as ${selectedStaff.full_name}`, 'success');
      setIsAccountPickerOpen(false);
      setSelectedStaff(null);
      setPin('');
      setLockoutUntil(null);
      setRemainingSeconds(0);
    } catch (err: any) {
      setError(err.message || 'Connection error during authentication');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const activeStaff = users.filter(u => u.is_active && u.role !== 'admin');

  const content = (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md overflow-y-auto animate-auth-fade"
      onClick={() => setIsAccountPickerOpen(false)}
    >
      <div 
        className="w-full max-w-2xl bg-white text-gray-900 border border-stone-200 rounded-3xl p-6 sm:p-8 shadow-2xl relative my-auto max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => setIsAccountPickerOpen(false)}
          className="absolute top-5 right-5 p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
          aria-label="Close Account Switcher"
        >
          <X className="w-5 h-5" />
        </button>

        {!selectedStaff ? (
          <div className="text-center">
            <h1 className="font-headline font-bold text-3xl sm:text-4xl text-stone-900 mb-2 tracking-tight">
              Switch Account
            </h1>
            <p className="text-stone-500 mb-8 text-sm">Select staff member for this terminal session</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {activeStaff.map((staff) => (
                <button
                  key={staff.id}
                  onClick={() => handleSelectStaff(staff)}
                  className={`group relative bg-stone-50 border rounded-2xl p-5 flex flex-col items-center gap-3 transition-all hover:border-[#C85A32] hover:bg-white hover:shadow-md cursor-pointer ${
                    staff.id === currentProfile?.id ? 'ring-2 ring-[#C85A32] border-transparent bg-white shadow-xs' : 'border-stone-200'
                  }`}
                >
                  <div className="w-14 h-14 rounded-full bg-stone-200 border-2 border-stone-300 flex items-center justify-center group-hover:border-[#C85A32]/50 transition-colors overflow-hidden shrink-0">
                    {staff.avatar_url ? (
                      <img src={staff.avatar_url} alt={staff.full_name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-lg font-bold text-stone-600 group-hover:text-stone-900 transition-colors">
                        {getInitials(staff.full_name)}
                      </span>
                    )}
                  </div>
                  
                  <div className="text-center w-full min-w-0">
                    <p className="font-bold text-stone-900 truncate text-sm">{staff.full_name}</p>
                    <p className="text-[10px] text-stone-500 uppercase tracking-widest mt-0.5 font-mono">{getRoleLabel(staff.role)}</p>
                  </div>

                  {staff.id === currentProfile?.id && (
                    <div className="absolute top-2.5 right-2.5 flex items-center gap-1 bg-[#C85A32]/10 px-2 py-0.5 rounded-full border border-[#C85A32]/20">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#C85A32] animate-pulse"></div>
                      <span className="text-[9px] font-bold text-[#C85A32] uppercase">Active</span>
                    </div>
                  )}
                </button>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 border-t border-stone-200">
              <button
                onClick={() => { setIsAccountPickerOpen(false); logout(); }}
                className="text-xs text-red-600 hover:text-red-700 font-semibold uppercase tracking-wider transition-colors cursor-pointer"
              >
                Sign Out Terminal
              </button>

              <span className="hidden sm:inline text-stone-300">•</span>

              <button
                onClick={() => setIsAccountPickerOpen(false)}
                className="text-xs text-stone-500 hover:text-stone-900 transition-colors cursor-pointer"
              >
                Cancel &amp; return to terminal
              </button>
            </div>
          </div>
        ) : (
          <div className="max-w-md mx-auto">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 text-xs font-semibold text-stone-500 hover:text-stone-900 transition-colors mb-6 group cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              <span>Back to staff list</span>
            </button>

            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-stone-100 border-2 border-stone-200 flex items-center justify-center mb-3 overflow-hidden shadow-xs">
                {selectedStaff.avatar_url ? (
                  <img src={selectedStaff.avatar_url} alt={selectedStaff.full_name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xl font-bold text-stone-600">{getInitials(selectedStaff.full_name)}</span>
                )}
              </div>
              <h2 className="font-headline font-bold text-2xl text-stone-900 tracking-tight">{selectedStaff.full_name}</h2>
              <p className="text-xs text-stone-500 mt-1">Enter your 6-digit terminal PIN</p>
            </div>

            <div className="space-y-5">
              {/* LOCKOUT DISPLAY BANNER */}
              {isLocked && (
                <div
                  role="alert"
                  aria-live="polite"
                  className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center space-y-2 animate-auth-fade"
                >
                  <div className="w-8 h-8 rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center mx-auto text-amber-600">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-amber-900">Too many failed attempts</h4>
                    <p className="text-[11px] text-amber-700 mt-0.5">
                      Account temporarily locked for security
                    </p>
                  </div>
                  <div className="pt-1">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-stone-500 block mb-1">
                      Try again in
                    </span>
                    <div className="inline-block bg-white border border-amber-200 rounded-xl px-4 py-1 font-mono text-xl font-bold tracking-wider text-amber-700 shadow-inner">
                      {formatTime(remainingSeconds)}
                    </div>
                  </div>
                </div>
              )}

              {/* PIN INPUT */}
              <div className="relative">
                <Key className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors ${isLocked ? 'text-stone-300' : 'text-stone-400'}`} />
                <input
                  type="password"
                  disabled={isLocked || isAuthenticating}
                  value={pin}
                  onChange={(e) => !isLocked && setPin(e.target.value.replace(/\D/g, '').substring(0, 6))}
                  onKeyDown={(e) => e.key === 'Enter' && !isLocked && handleLogin()}
                  placeholder={isLocked ? '••••••' : '6-Digit PIN'}
                  autoFocus={!isLocked}
                  aria-label="6-Digit Terminal PIN"
                  className={`w-full h-12 border rounded-xl pl-12 pr-4 text-center text-xl tracking-[0.5em] font-mono transition-all outline-none ${
                    isLocked
                      ? 'bg-stone-100 border-stone-200 text-stone-400 cursor-not-allowed opacity-60'
                      : 'bg-stone-50 border-stone-200 text-stone-900 focus:border-[#C85A32] focus:bg-white focus:ring-2 focus:ring-[#C85A32]/20 placeholder:text-stone-400'
                  }`}
                />
              </div>

              {/* STANDARD NON-LOCKOUT ERROR */}
              {!isLocked && error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2.5 animate-auth-fade">
                  <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center shrink-0 mt-0.5 text-white font-bold text-[10px]">
                    !
                  </div>
                  <p className="text-xs text-red-600 font-medium leading-relaxed">{error}</p>
                </div>
              )}

              {/* AUTHORIZE BUTTON */}
              <button
                onClick={handleLogin}
                disabled={isLocked || isAuthenticating || pin.length !== 6}
                aria-disabled={isLocked || isAuthenticating || pin.length !== 6}
                className={`w-full h-12 font-bold rounded-xl flex items-center justify-center gap-2.5 text-sm transition-all ${
                  isLocked
                    ? 'bg-stone-100 border border-stone-200 text-stone-400 cursor-not-allowed opacity-60'
                    : 'bg-[#C85A32] hover:bg-[#B84E27] disabled:bg-stone-200 disabled:text-stone-400 text-white shadow-xs active:scale-[0.98] cursor-pointer'
                }`}
              >
                {isAuthenticating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isLocked ? (
                  <>
                    <Lock className="w-4 h-4 text-stone-400" />
                    <span>Locked ({formatTime(remainingSeconds)})</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Authorize Terminal</span>
                  </>
                )}
              </button>
              
              <div className="flex justify-center gap-1.5 mt-3">
                {[...Array(6)].map((_, i) => (
                  <div
                    key={i}
                    className={`w-2.5 h-2.5 rounded-full border transition-all duration-200 ${
                      isLocked
                        ? 'bg-transparent border-stone-200'
                        : i < pin.length
                        ? 'bg-[#C85A32] border-[#C85A32] scale-110'
                        : 'bg-transparent border-stone-300'
                    }`}
                  ></div>
                ))}
              </div>

              <p className="text-[11px] text-stone-500 text-center mt-3 font-normal">
                Forgot your PIN? Ask your Manager or Owner to reset it under Staff Settings.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
};
