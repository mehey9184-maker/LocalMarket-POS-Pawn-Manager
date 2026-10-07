import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';

export const DEFAULT_IDLE_LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes default inactivity timeout
export const MAX_IDLE_LOCK_DEFERRAL_MS = 10 * 60 * 1000; // 10 minutes maximum bounded deferral

export type IdleLockDecision = 'lock' | 'defer' | 'noop';

export interface EvaluateIdleLockParams {
  user: any;
  profile: any;
  activeTab: string;
  isAccountPickerOpen: boolean;
  isSwitchingAccount: boolean;
  isBusy: boolean;
  isScannerModalOpen: boolean;
  activeReceiptModal: any;
  activeContractModal: any;
  elapsedIdleMs: number;
  maxDeferralMs: number;
}

export function evaluateIdleLockDecision(params: EvaluateIdleLockParams): IdleLockDecision {
  if (!params.user || !params.profile) return 'noop';
  if (['auth', 'landing', 'shop-setup'].includes(params.activeTab)) return 'noop';
  if (params.isAccountPickerOpen || params.isSwitchingAccount) return 'noop';

  const isDeferred =
    params.isBusy ||
    params.isScannerModalOpen ||
    Boolean(params.activeReceiptModal) ||
    Boolean(params.activeContractModal);

  if (isDeferred && params.elapsedIdleMs < params.maxDeferralMs) {
    return 'defer';
  }

  return 'lock';
}

interface UseIdleLockOptions {
  timeoutMs?: number;
  maxDeferralMs?: number;
  isBusy?: boolean;
}

export const useIdleLock = (options?: UseIdleLockOptions) => {
  const { user, profile, isAccountPickerOpen, setIsAccountPickerOpen, isSwitchingAccount, setIsIdleLocked } = useAuth();
  const { activeTab, isScannerModalOpen, activeReceiptModal, activeContractModal, isBusy: globalIsBusy } = useApp();

  const timeoutMs = options?.timeoutMs ?? DEFAULT_IDLE_LOCK_TIMEOUT_MS;
  const maxDeferralMs = options?.maxDeferralMs ?? MAX_IDLE_LOCK_DEFERRAL_MS;
  const isBusy = options?.isBusy ?? globalIsBusy ?? false;

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const idleStartTimeRef = useRef<number>(Date.now());

  const lockTill = useCallback(() => {
    const elapsed = Date.now() - idleStartTimeRef.current;
    const decision = evaluateIdleLockDecision({
      user,
      profile,
      activeTab,
      isAccountPickerOpen,
      isSwitchingAccount,
      isBusy,
      isScannerModalOpen,
      activeReceiptModal,
      activeContractModal,
      elapsedIdleMs: elapsed,
      maxDeferralMs,
    });

    if (decision === 'noop') return;

    if (decision === 'defer') {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(lockTill, 30000);
      return;
    }

    setIsIdleLocked(true);
    setIsAccountPickerOpen(true);
  }, [
    user,
    profile,
    activeTab,
    isAccountPickerOpen,
    isSwitchingAccount,
    isBusy,
    isScannerModalOpen,
    activeReceiptModal,
    activeContractModal,
    setIsIdleLocked,
    setIsAccountPickerOpen,
    maxDeferralMs,
  ]);

  const resetTimer = useCallback(() => {
    idleStartTimeRef.current = Date.now();
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    if (!user || !profile) return;
    if (activeTab === 'auth' || activeTab === 'landing' || activeTab === 'shop-setup') return;
    if (isAccountPickerOpen || isSwitchingAccount) return;

    timerRef.current = setTimeout(lockTill, timeoutMs);
  }, [user, profile, activeTab, isAccountPickerOpen, isSwitchingAccount, lockTill, timeoutMs]);

  useEffect(() => {
    // Activity events that indicate worker presence at the till (mouse, key, touch, scroll, scan)
    const events = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll', 'click'];
    const handleActivity = () => {
      resetTimer();
    };

    events.forEach(evt => window.addEventListener(evt, handleActivity, { passive: true }));
    resetTimer();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach(evt => window.removeEventListener(evt, handleActivity));
    };
  }, [resetTimer]);
};
