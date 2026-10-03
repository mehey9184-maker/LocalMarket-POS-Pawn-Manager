import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { authApi } from '../../services/supabaseApi';
import { ProfileRow } from '../../types/supabase';
import { Loader2, ArrowLeft, Key, ShieldCheck, Lock, X, Calendar } from 'lucide-react';

// Timezone-aware date generator matching server rules
function getShopNow(timezone: string): Date {
  const now = new Date();
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    const parts = formatter.formatToParts(now);
    const d: any = {};
    parts.forEach(p => { if (p.type !== 'literal') d[p.type] = p.value; });
    return new Date(`${d.year}-${d.month}-${d.day}T${d.hour}:${d.minute}:${d.second}`);
  } catch (e) {
    return now;
  }
}

function getInitials(name: string | null | undefined) {
  if (!name) return 'ST';
  return name.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().substring(0, 2);
}

function getRoleLabel(role: string | null | undefined) {
  if (!role) return 'Staff';
  switch (role) {
    case 'owner': return 'Owner';
    case 'manager': return 'Manager';
    case 'senior_cashier': return 'Senior Cashier';
    case 'cashier': return 'Cashier';
    default: return role.replace(/_/g, ' ');
  }
}

// Calculate the next shift starting from currentDay + 1
function getNextShiftInfo(workingDays: number[], scheduleStartTime: string, currentDay: number): string {
  if (!workingDays || workingDays.length === 0) return '';
  const daysMap = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  for (let i = 1; i <= 7; i++) {
    const nextDay = (currentDay + i) % 7;
    if (workingDays.includes(nextDay)) {
      const dayName = nextDay === (currentDay + 1) % 7 ? 'Tomorrow' : daysMap[nextDay];
      return `Next shift: ${dayName} at ${scheduleStartTime || '08:00'}`;
    }
  }
  return '';
}

export interface ShiftStatus {
  status: 'allowed' | 'too_early' | 'too_late' | 'non_working';
  title: string;
  subtitle: string;
  nextLoginTime: Date | null;
  reason: string;
  countdownLabel: string;
}

export function evaluateShiftStatus(staff: ProfileRow, timezone: string): ShiftStatus {
  if (staff.role === 'owner' || staff.role === 'admin') {
    return { status: 'allowed', title: "You're scheduled now", subtitle: "Unrestricted Owner/Admin access", nextLoginTime: null, reason: "", countdownLabel: "" };
  }

  const schedule = (staff.schedule as any);
  if (!schedule) {
    return { status: 'allowed', title: "You're scheduled now", subtitle: "No schedule restriction", nextLoginTime: null, reason: "", countdownLabel: "" };
  }

  const workingDays = schedule.workingDays || [1, 2, 3, 4, 5];
  const startTime = schedule.startTime || "08:00";
  const endTime = schedule.endTime || "17:00";
  const earlyMins = schedule.earlyLoginMinutes || 10;
  const overnight = !!schedule.overnight;

  const shopNow = getShopNow(timezone);
  const currentDay = shopNow.getDay();
  const currentTotalMinutes = shopNow.getHours() * 60 + shopNow.getMinutes();

  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);

  const startTotalMinutes = startH * 60 + startM;
  const startWithEarlyTotalMinutes = startTotalMinutes - earlyMins;
  const endTotalMinutes = endH * 60 + endM;

  const yesterdayDay = (currentDay + 6) % 7;
  let isActiveOvernightFromYesterday = false;
  if (workingDays.includes(yesterdayDay) && overnight) {
    if (currentTotalMinutes <= endTotalMinutes) isActiveOvernightFromYesterday = true;
  }

  const getNextPermittedDate = (day: number, time: string, earlyMins: number): Date => {
    const next = new Date(shopNow);
    let daysUntil = (day - next.getDay() + 7) % 7;
    if (daysUntil === 0 && (currentTotalMinutes > (startH * 60 + startM - earlyMins))) daysUntil = 7;
    next.setDate(next.getDate() + daysUntil);
    const [h, m] = time.split(':').map(Number);
    let totalM = h * 60 + m - earlyMins;
    next.setHours(Math.floor(totalM / 60), totalM % 60, 0, 0);
    return next;
  };

  const isWorkingToday = workingDays.includes(currentDay);
  if (isWorkingToday) {
    if (!overnight) {
      if (currentTotalMinutes >= startWithEarlyTotalMinutes && currentTotalMinutes <= endTotalMinutes) {
        return { status: 'allowed', title: "You're scheduled now", subtitle: `${startTime}–${endTime}`, nextLoginTime: null, reason: "", countdownLabel: "" };
      } else if (currentTotalMinutes < startWithEarlyTotalMinutes) {
        return {
          status: 'too_early',
          title: `Your shift starts at ${startTime}`,
          subtitle: `You can sign in from ${startTime.split(':').map((v, i) => i === 0 ? String(Math.floor((startH * 60 + startM - earlyMins) / 60)).padStart(2, '0') : String((startH * 60 + startM - earlyMins) % 60).padStart(2, '0')).join(':')}.`,
          nextLoginTime: getNextPermittedDate(currentDay, startTime, earlyMins),
          reason: "You're a little early",
          countdownLabel: "Your shift starts in"
        };
      } else {
        let nextDay = (currentDay + 1) % 7;
        while (!workingDays.includes(nextDay)) nextDay = (nextDay + 1) % 7;
        return {
          status: 'too_late',
          title: "Your shift has ended",
          subtitle: `Your scheduled hours were ${startTime}–${endTime}.`,
          nextLoginTime: getNextPermittedDate(nextDay, startTime, earlyMins),
          reason: "Your shift has ended",
          countdownLabel: "Next access in"
        };
      }
    } else {
        if (currentTotalMinutes >= startWithEarlyTotalMinutes) {
          return { status: 'allowed', title: "You're scheduled now", subtitle: `${startTime}–${endTime} (Overnight)`, nextLoginTime: null, reason: "", countdownLabel: "" };
        } else if (currentTotalMinutes < startWithEarlyTotalMinutes) {
          if (isActiveOvernightFromYesterday) return { status: 'allowed', title: "You're scheduled now", subtitle: `Active shift ends at ${endTime}`, nextLoginTime: null, reason: "", countdownLabel: "" };
          return {
            status: 'too_early',
            title: `Your shift starts at ${startTime}`,
            subtitle: `You can sign in from ${startTime.split(':').map((v, i) => i === 0 ? String(Math.floor((startH * 60 + startM - earlyMins) / 60)).padStart(2, '0') : String((startH * 60 + startM - earlyMins) % 60).padStart(2, '0')).join(':')}.`,
            nextLoginTime: getNextPermittedDate(currentDay, startTime, earlyMins),
            reason: "You're a little early",
            countdownLabel: "Your shift starts in"
          };
        }
    }
  } else {
    if (isActiveOvernightFromYesterday) return { status: 'allowed', title: "You're scheduled now", subtitle: `Active shift ends at ${endTime}`, nextLoginTime: null, reason: "", countdownLabel: "" };

    let nextDay = (currentDay + 1) % 7;
    while (!workingDays.includes(nextDay)) nextDay = (nextDay + 1) % 7;
    return {
      status: 'non_working',
      title: "You're off today",
      subtitle: "You're not scheduled to work today.",
      nextLoginTime: getNextPermittedDate(nextDay, startTime, earlyMins),
      reason: "You're off today",
      countdownLabel: "Next access in"
    };
  }
  return { status: 'too_late', title: "Your shift has ended", subtitle: `Your scheduled hours are finished.`, nextLoginTime: null, reason: "Your shift has ended", countdownLabel: "" };
}

// Map server schedule rejection error messages to descriptive, user-friendly copy
function translateServerError(serverError: string): React.ReactNode {
  if (serverError.includes("This shift starts at")) {
    const shiftTime = serverError.replace("This shift starts at ", "").replace(".", "");
    return (
      <div className="space-y-1">
        <p className="font-bold text-red-700">You're a little early</p>
        <p>Your shift starts at {shiftTime}.</p>
      </div>
    );
  }
  if (serverError.includes("You are not scheduled to work today")) {
    return (
      <div className="space-y-1">
        <p className="font-bold text-red-700">You're not scheduled today</p>
        <p>Please check your work schedule.</p>
      </div>
    );
  }
  if (serverError.includes("Your scheduled shift has ended")) {
    return (
      <div className="space-y-1">
        <p className="font-bold text-red-700">Today's shift has ended</p>
        <p>Your scheduled hours are finished.</p>
      </div>
    );
  }
  return serverError;
}

export // Helper to format duration for countdown
function formatDuration(ms: number) {
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));

  if (days > 0) return `${days}d ${hours}h ${minutes}m ${seconds}s`;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

const ShiftLocked: React.FC<{
  staff: ProfileRow;
  shiftInfo: ShiftStatus;
  onBack: () => void;
}> = ({ staff, shiftInfo, onBack }) => {
  const [timeRemaining, setTimeRemaining] = useState<number>(() => Math.max(0, shiftInfo.nextLoginTime!.getTime() - Date.now()));

  useEffect(() => {
    if (!shiftInfo.nextLoginTime) return;
    const timer = setInterval(() => {
      const now = Date.now();
      const diff = Math.max(0, shiftInfo.nextLoginTime!.getTime() - now);
      setTimeRemaining(diff);
    }, 1000);
    return () => clearInterval(timer);
  }, [shiftInfo.nextLoginTime]);

  return (
    <div className="fixed inset-0 z-[10000] bg-stone-50 flex items-center justify-center p-4 animate-auth-fade">
      {/* Immersive subtle ambient background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,_#f5f5f4_0%,_#e7e5e4_100%)]"></div>
      
      {/* Compact premium panel */}
      <div className="relative z-10 bg-white/60 backdrop-blur-xl border border-white/50 rounded-[24px] shadow-2xl p-8 max-w-md w-full text-center">
        {/* Staff Identity */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-full bg-stone-200 flex items-center justify-center shadow-sm overflow-hidden mb-4">
             {staff.avatar_url ? <img src={staff.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-xl font-bold text-stone-600">{getInitials(staff.full_name)}</span>}
          </div>
          <h1 className="text-xl font-bold text-stone-900">{staff.full_name}</h1>
          <p className="text-stone-500 uppercase tracking-widest text-[10px] font-mono mt-0.5">{getRoleLabel(staff.role)}</p>
          <div className="inline-block mt-3 px-3 py-1 rounded-full bg-stone-100 text-[10px] font-bold text-stone-600 uppercase tracking-wider">
            {shiftInfo.reason}
          </div>
        </div>

        {/* Lock Animation */}
        <div className="relative w-16 h-16 mx-auto mb-8 flex items-center justify-center">
          <div className="absolute inset-0 border border-[#C85A32]/20 rounded-full animate-slow-pulse"></div>
          <Lock className="w-8 h-8 text-[#C85A32] relative z-10" />
        </div>
        
        {/* Main Content */}
        <div className="space-y-1 mb-8">
          <h2 className="text-xl font-semibold text-stone-900">{shiftInfo.title}</h2>
          <p className="text-sm text-stone-600 font-medium">Access opens at {shiftInfo.nextLoginTime?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
        </div>

        {/* Countdown */}
        <div className="bg-white/50 border border-stone-200 rounded-2xl p-6 mb-8">
          <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-2">{shiftInfo.countdownLabel}</p>
          <div className="text-5xl font-mono font-bold text-stone-900 tabular-nums tracking-tight">
            {formatDuration(timeRemaining)}
          </div>
          <p className="text-xs font-medium text-stone-500 mt-2">
             {shiftInfo.nextLoginTime?.toLocaleDateString([], { weekday: 'long' })} · {shiftInfo.nextLoginTime?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>

        {/* Back Button */}
        <button
          onClick={onBack}
          className="w-full h-12 flex items-center justify-center gap-2 text-sm font-semibold text-stone-700 bg-white hover:bg-stone-50 border border-stone-200 rounded-xl transition-all shadow-sm active:scale-[0.98] cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to staff list
        </button>
      </div>
    </div>
  );
};

export const AccountPicker: React.FC = () => {
  const { 
    users, 
    profile: currentProfile, 
    isAccountPickerOpen, 
    setIsAccountPickerOpen,
    logout,
    isSwitchingAccount,
    resetSwitchState,
    switchAccountWithPin,
    switchState,
    switchError,
    switchTarget,
    retrySwitchAccount,
    cancelSwitchAccount
  } = useAuth();

  const { showToast, setActiveTab, shopProfile } = useApp();
  
  const [selectedStaff, setSelectedStaff] = useState<ProfileRow | null>(null);
  const [pin, setPin] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<React.ReactNode | null>(null);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [timeTick, setTimeTick] = useState(0);

  // Auto-refresh the selected staff shift awareness status as time passes
  useEffect(() => {
    if (!selectedStaff) return;
    const interval = setInterval(() => {
      setTimeTick(t => t + 1);
    }, 1000); // Trigger a tick evaluation every 1 second
    return () => clearInterval(interval);
  }, [selectedStaff]);

  // Close modal on Escape key press
  useEffect(() => {
    if (!isAccountPickerOpen || isSwitchingAccount) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsAccountPickerOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAccountPickerOpen, setIsAccountPickerOpen, isSwitchingAccount]);

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

  const shiftInfo = useMemo(() => {
    if (!selectedStaff) return null;
    const timezone = (shopProfile as any)?.timezone || 'Africa/Johannesburg';
    return evaluateShiftStatus(selectedStaff, timezone);
  }, [selectedStaff, shopProfile, timeTick]);

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

  const isLocked = remainingSeconds > 0;
  const isShiftLocked = shiftInfo && shiftInfo.status !== 'allowed';

  const handleLogin = async () => {
    if (!selectedStaff || isLocked || isAuthenticating || pin.length !== 6) return;
    
    // Security check again before calling switchAccountWithPin
    const timezone = (shopProfile as any)?.timezone || 'Africa/Johannesburg';
    const shiftInfoNow = evaluateShiftStatus(selectedStaff, timezone);
    if (shiftInfoNow.status !== 'allowed') return;

    setIsAuthenticating(true);
    setError(null);

    try {
      const res = await switchAccountWithPin({
        targetStaffId: selectedStaff.id,
        targetShopId: selectedStaff.shop_id || '',
        cashierCode: selectedStaff.cashier_code,
        pin,
        staffName: selectedStaff.full_name
      });
      
      if (!res.success) {
        if (res.locked) {
          const seconds = res.remainingSeconds || 900;
          const until = Date.now() + seconds * 1000;
          setLockoutUntil(until);
          setRemainingSeconds(seconds);
          try {
            sessionStorage.setItem(`pin_lockout_${selectedStaff.id}`, String(until));
          } catch {}
          setError(translateServerError(res.error || 'Too many failed attempts.'));
        } else {
          setError(translateServerError(res.error || 'Invalid PIN.'));
        }
        return;
      }

      showToast('Welcome Back', `Logged in as ${selectedStaff.full_name}`, 'success');
      if (selectedStaff.role === 'cashier') {
        setActiveTab('sell');
      }
      setIsAccountPickerOpen(false);
      setSelectedStaff(null);
      setPin('');
      setLockoutUntil(null);
      setRemainingSeconds(0);
      resetSwitchState();
    } catch (err: any) {
      setError(translateServerError(err.message || 'Connection error during authentication'));
    } finally {
      setIsAuthenticating(false);
    }
  };

  const activeStaff = users.filter(u => u.is_active && u.role !== 'admin');

  const content = (
    <div 
      className={isSwitchingAccount 
        ? "fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-stone-50 p-6 animate-auth-fade"
        : "fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-stone-50/95 backdrop-blur-md p-6 overflow-y-auto animate-auth-fade"
      }
      onClick={() => !isSwitchingAccount && setIsAccountPickerOpen(false)}
    >
      {isSwitchingAccount ? (
        // ... (existing isSwitchingAccount rendering block)
        // [Existing block]
        switchState === 'error' ? (
          <div className="text-center space-y-6 flex flex-col items-center max-w-md w-full animate-auth-fade" onClick={(e) => e.stopPropagation()}>
            <div className="w-20 h-20 rounded-full bg-red-50 border border-red-100 flex items-center justify-center shrink-0 text-[#C85A32] shadow-sm">
              <Lock className="w-10 h-10 text-[#C85A32]" />
            </div>

            <div className="space-y-3">
              <h1 className="font-headline font-bold text-2xl text-stone-900 tracking-tight">
                We couldn't switch staff
              </h1>
              <div className="text-sm text-stone-600 space-y-1">
                <p>Switching to:</p>
                <p className="font-bold text-stone-900 text-base">{switchTarget?.staffName || selectedStaff?.full_name || 'Staff'}</p>
              </div>
              <div className="bg-red-50/50 border border-red-100 rounded-2xl p-4 mt-2 max-w-sm mx-auto text-left">
                <p className="text-xs text-[#C85A32] font-semibold uppercase tracking-wider mb-1">What happened</p>
                <div className="text-xs text-stone-600 font-medium leading-relaxed">
                  {switchError ? translateServerError(switchError) : 'An unexpected error occurred while switching staff.'}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full pt-6">
              <button
                type="button"
                onClick={async () => {
                  try {
                    const res = await retrySwitchAccount();
                    if (res && res.success) {
                      showToast('Welcome Back', `Logged in as ${switchTarget?.staffName || selectedStaff?.full_name || 'Staff'}`, 'success');
                      setIsAccountPickerOpen(false);
                      setSelectedStaff(null);
                      setPin('');
                      setLockoutUntil(null);
                      setRemainingSeconds(0);
                      resetSwitchState();
                    } else {
                      showToast('Switch Failed', res?.error || 'Failed to complete switch', 'error');
                    }
                  } catch (err: any) {
                    showToast('Retry Failed', err.message || 'Verification failed again', 'error');
                  }
                }}
                disabled={isAuthenticating}
                className="flex-1 bg-[#C85A32] hover:bg-[#B84E27] disabled:bg-stone-200 disabled:text-stone-400 text-white font-bold h-12 rounded-xl transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                {isAuthenticating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <span>Try Again</span>
                )}
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await cancelSwitchAccount();
                    setIsAccountPickerOpen(false);
                    setSelectedStaff(null);
                    setPin('');
                  } catch (err: any) {
                    showToast('Error', err.message || 'Failed to cancel', 'error');
                  }
                }}
                disabled={isAuthenticating}
                className="flex-1 bg-stone-100 hover:bg-stone-200 disabled:opacity-50 text-stone-700 font-semibold h-12 rounded-xl border border-stone-200 transition-colors cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center space-y-6 flex flex-col items-center max-w-md w-full animate-auth-fade">
            <div className="w-24 h-24 rounded-full bg-white border border-stone-200 flex items-center justify-center overflow-hidden shadow-md">
              {(selectedStaff || currentProfile)?.avatar_url ? (
                <img src={(selectedStaff || currentProfile)?.avatar_url || undefined} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl font-bold text-stone-600">
                  {getInitials((selectedStaff || currentProfile)?.full_name || 'Staff')}
                </span>
              )}
            </div>
            
            <div className="space-y-3">
              <h1 className="font-headline font-bold text-3xl text-stone-900 tracking-tight">
                Switching staff
              </h1>
              <p className="text-stone-600 text-base">
                Signing in as <span className="font-bold">{(selectedStaff || currentProfile)?.full_name}</span>…
              </p>
              <p className="text-stone-400 text-sm mt-1">
                {switchState === 'authenticating' && 'Checking PIN…'}
                {switchState === 'loading_profile' && 'Getting your workspace ready…'}
                {switchState === 'acquiring_terminal' && 'Almost ready…'}
                {switchState === 'ready' && 'Ready.'}
                {switchState === 'idle' && 'Ready.'}
              </p>
            </div>

            <div className="flex justify-center pt-6">
              <Loader2 className="w-10 h-10 text-[#C85A32] animate-spin" />
            </div>
          </div>
        )
      ) : (
        <div 
          className="w-full max-w-2xl bg-white text-gray-900 border border-stone-200 rounded-3xl p-6 sm:p-8 shadow-2xl relative my-auto max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => setIsAccountPickerOpen(false)}
            className="absolute top-5 right-5 p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
            aria-label="Close Staff Switcher"
          >
            <X className="w-5 h-5" />
          </button>

          {!selectedStaff ? (
          <div className="text-center">
            <h1 className="font-headline font-bold text-3xl sm:text-4xl text-stone-900 mb-2 tracking-tight">
              Switch Staff
            </h1>
            <p className="text-stone-500 mb-8 text-sm">Choose the staff member using this counter</p>

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
                      <span className="text-[9px] font-bold text-[#C85A32] uppercase">You</span>
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
                Sign Out
              </button>

              <span className="hidden sm:inline text-stone-300">•</span>

              <button
                onClick={() => setIsAccountPickerOpen(false)}
                className="text-xs text-stone-500 hover:text-stone-900 transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : isShiftLocked ? (
          <ShiftLocked staff={selectedStaff} shiftInfo={shiftInfo} onBack={handleBack} />
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
              <h2 className="font-headline font-bold text-2xl text-stone-900 tracking-tight">Welcome back, {selectedStaff.full_name}</h2>
              <p className="text-xs text-stone-500 mt-1">Enter your 6-digit PIN</p>
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
                      Please try again when the timer ends.
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
                  aria-label="6-Digit PIN"
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
                  <div className="text-xs text-red-600 font-medium leading-relaxed">{error}</div>
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
                    <span>Try again in {formatTime(remainingSeconds)}</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Continue</span>
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
      )}
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(content, document.body);
};
