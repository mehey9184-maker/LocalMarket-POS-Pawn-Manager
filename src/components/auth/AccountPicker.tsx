import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { authApi } from '../../services/supabaseApi';
import { ProfileRow } from '../../types/supabase';
import { Loader2, ArrowLeft, Key, ShieldCheck, Lock } from 'lucide-react';

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

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/95 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-full max-w-2xl px-6">
        {!selectedStaff ? (
          <div className="text-center">
            <h1 className="font-headline font-bold text-4xl text-gray-900 mb-2 tracking-tight">Welcome back</h1>
            <p className="text-gray-500 mb-12">Who is using this terminal?</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {users.filter(u => u.is_active && u.role !== 'admin').map((staff) => (
                <button
                  key={staff.id}
                  onClick={() => handleSelectStaff(staff)}
                  className={`group relative bg-white border border-gray-200 rounded-2xl p-6 flex flex-col items-center gap-4 transition-all hover:border-[#c85a32] hover:bg-gray-50 hover:shadow-lg hover:shadow-gray-200/50 ${
                    staff.id === currentProfile?.id ? 'ring-2 ring-[#c85a32] border-transparent' : ''
                  }`}
                >
                  <div className="w-16 h-16 rounded-full bg-gray-100 border-2 border-gray-200 flex items-center justify-center group-hover:border-[#c85a32]/50 transition-colors overflow-hidden">
                    {staff.avatar_url ? (
                      <img src={staff.avatar_url} alt={staff.full_name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xl font-bold text-gray-500 group-hover:text-gray-700 transition-colors">
                        {getInitials(staff.full_name)}
                      </span>
                    )}
                  </div>
                  
                  <div className="text-center">
                    <p className="font-bold text-gray-900 truncate max-w-[140px]">{staff.full_name}</p>
                    <p className="text-xs text-gray-500 uppercase tracking-widest mt-1 font-mono">{getRoleLabel(staff.role)}</p>
                  </div>

                  {staff.id === currentProfile?.id && (
                    <div className="absolute top-3 right-3 flex items-center gap-1 bg-[#c85a32]/10 px-2 py-0.5 rounded-full border border-[#c85a32]/20">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#c85a32] animate-pulse"></div>
                      <span className="text-[9px] font-bold text-[#c85a32] uppercase">Active</span>
                    </div>
                  )}
                </button>
              ))}
            </div>

            <button
              onClick={() => { setIsAccountPickerOpen(false); logout(); }}
              className="mt-6 text-xs text-red-600 hover:text-red-700 font-semibold uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
            >
              Sign Out / Start Over
            </button>

            <button
              onClick={() => setIsAccountPickerOpen(false)}
              className="mt-6 text-sm text-gray-500 hover:text-gray-900 transition-colors"
            >
              Cancel and return to terminal
            </button>
          </div>
        ) : (
          <div className="max-w-md mx-auto bg-white border border-gray-200 rounded-3xl p-8 shadow-xl animate-in zoom-in-95 duration-200">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors mb-8 group cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              <span>Back to staff list</span>
            </button>

            <div className="flex flex-col items-center text-center mb-8">
              <div className="w-20 h-20 rounded-full bg-gray-100 border-2 border-gray-200 flex items-center justify-center mb-4 overflow-hidden shadow-sm">
                {selectedStaff.avatar_url ? (
                  <img src={selectedStaff.avatar_url} alt={selectedStaff.full_name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl font-bold text-gray-500">{getInitials(selectedStaff.full_name)}</span>
                )}
              </div>
              <h2 className="font-headline font-bold text-2xl text-gray-900 tracking-tight">{selectedStaff.full_name}</h2>
              <p className="text-sm text-gray-500 mt-1">Please enter your 6-digit terminal PIN</p>
            </div>

            <div className="space-y-6">
              {/* LOCKOUT DISPLAY BANNER */}
              {isLocked && (
                <div
                  role="alert"
                  aria-live="polite"
                  className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-center space-y-3 animate-in fade-in zoom-in-95 duration-200"
                >
                  <div className="w-10 h-10 rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center mx-auto text-amber-600">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-amber-900">Too many failed attempts</h4>
                    <p className="text-xs text-amber-700 mt-0.5">
                      Account temporarily locked for security
                    </p>
                  </div>
                  <div className="pt-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 block mb-1">
                      Try again in
                    </span>
                    <div className="inline-block bg-white border border-amber-200 rounded-xl px-5 py-1.5 font-mono text-2xl font-bold tracking-wider text-amber-700 shadow-inner">
                      {formatTime(remainingSeconds)}
                    </div>
                  </div>
                </div>
              )}

              {/* PIN INPUT */}
              <div className="relative">
                <Key className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors ${isLocked ? 'text-gray-300' : 'text-gray-400'}`} />
                <input
                  type="password"
                  disabled={isLocked || isAuthenticating}
                  value={pin}
                  onChange={(e) => !isLocked && setPin(e.target.value.replace(/\D/g, '').substring(0, 6))}
                  onKeyDown={(e) => e.key === 'Enter' && !isLocked && handleLogin()}
                  placeholder={isLocked ? '••••••' : '6-Digit PIN'}
                  autoFocus={!isLocked}
                  aria-label="6-Digit Terminal PIN"
                  className={`w-full h-14 border rounded-xl pl-12 pr-4 text-center text-2xl tracking-[0.5em] font-mono transition-all outline-none ${
                    isLocked
                      ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed opacity-60'
                      : 'bg-[#F8F9FA] border-gray-200 text-gray-900 focus:border-[#c85a32] focus:ring-1 focus:ring-[#c85a32] placeholder:text-gray-400'
                  }`}
                />
              </div>

              {/* STANDARD NON-LOCKOUT ERROR */}
              {!isLocked && error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 animate-shake">
                  <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[10px] font-bold text-white">!</span>
                  </div>
                  <p className="text-xs text-red-600 font-medium leading-relaxed">{error}</p>
                </div>
              )}

              {/* AUTHORIZE BUTTON */}
              <button
                onClick={handleLogin}
                disabled={isLocked || isAuthenticating || pin.length !== 6}
                aria-disabled={isLocked || isAuthenticating || pin.length !== 6}
                className={`w-full h-14 font-bold rounded-xl flex items-center justify-center gap-3 transition-all ${
                  isLocked
                    ? 'bg-gray-100 border border-gray-200 text-gray-400 cursor-not-allowed opacity-60'
                    : 'bg-[#c85a32] hover:bg-[#b84e27] disabled:bg-gray-200 disabled:text-gray-400 text-white shadow-sm active:scale-[0.98] cursor-pointer'
                }`}
              >
                {isAuthenticating ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : isLocked ? (
                  <>
                    <Lock className="w-5 h-5 text-gray-400" />
                    <span>Locked ({formatTime(remainingSeconds)})</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-5 h-5" />
                    <span>Authorize Terminal</span>
                  </>
                )}
              </button>
              
              <div className="flex justify-center gap-1 mt-4">
                {[...Array(6)].map((_, i) => (
                  <div
                    key={i}
                    className={`w-3 h-3 rounded-full border transition-all duration-200 ${
                      isLocked
                        ? 'bg-transparent border-gray-200'
                        : i < pin.length
                        ? 'bg-[#c85a32] border-[#c85a32] scale-110'
                        : 'bg-transparent border-gray-300'
                    }`}
                  ></div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
