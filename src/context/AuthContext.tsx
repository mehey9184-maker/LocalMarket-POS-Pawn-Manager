import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { authApi, profilesApi, staffApi } from '../services/supabaseApi';
import { apiPost } from '../utils/apiClient';
import { ProfileRow, UserRole } from '../types/supabase';
import { Permissions, getEffectivePermissions } from '../types';

export type SwitchState = 'idle' | 'authenticating' | 'loading_profile' | 'acquiring_terminal' | 'ready' | 'error';

interface AuthContextType {
  user: any | null;
  session: any | null;
  profile: ProfileRow | null;
  role: UserRole;
  shopId: string | null;
  isLoading: boolean;
  isProfileLoading: boolean;
  isOwner: boolean;
  isManager: boolean;
  isSeniorCashier: boolean;
  isCashier: boolean;
  isAtLeastSeniorCashier: boolean;
  isAtLeastManager: boolean;
  hasPermission: (permission: keyof Permissions) => boolean;
  verifyManagerPin: (pin: string) => Promise<{ success: boolean; error?: string }>;
  provisionStaff: (data: {
    fullName: string;
    role: 'cashier' | 'senior_cashier' | 'manager';
    cashierCode?: string;
    pinCode?: string;
    email?: string;
  }) => Promise<{ success: boolean; profile?: ProfileRow; error?: string }>;
  logout: () => Promise<void>;
  logoutManager: () => void;
  refreshProfile: () => Promise<void>;
  updateStaffProfile: (id: string, updates: Partial<ProfileRow>, reason?: string) => Promise<{ success: boolean; error?: string }>;
  updateStaffAccessWithPassword: (
    targetId: string,
    permissions: Partial<Permissions>,
    schedule: any,
    password: string,
    reason?: string
  ) => Promise<{ success: boolean; error?: string }>;
  resetStaffPin: (id: string, newPin: string, reason?: string) => Promise<{ success: boolean; error?: string }>;
  setupManagerPassword: (params: {
    managerId: string;
    shopId: string;
    pin: string;
    newPassword: string;
    staffName?: string;
  }) => Promise<{ success: boolean; locked?: boolean; remainingSeconds?: number; error?: string }>;
  users: ProfileRow[];
  isAccountPickerOpen: boolean;
  setIsAccountPickerOpen: (open: boolean) => void;
  isSwitchingAccount: boolean;
  switchState: SwitchState;
  switchError: string | null;
  switchTarget: { targetStaffId: string; targetShopId: string; cashierCode: string; staffName: string } | null;
  retrySwitchAccount: () => Promise<{ success: boolean; error?: string }>;
  cancelSwitchAccount: () => Promise<void>;
  resetSwitchState: () => void;
  switchAccountWithPin: (params: {
    targetStaffId: string;
    targetShopId: string;
    cashierCode: string;
    pin: string;
    staffName: string;
  }) => Promise<{ success: boolean; locked?: boolean; remainingSeconds?: number; error?: string }>;
  loginWithPassword: (params: {
    targetStaffId: string;
    targetShopId: string;
    password: string;
    staffName: string;
  }) => Promise<{ success: boolean; requirePasswordSetup?: boolean; error?: string }>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [session, setSession] = useState<any | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [users, setUsers] = useState<ProfileRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [managerElevation, setManagerElevation] = useState(false);
  const [isAccountPickerOpen, setIsAccountPickerOpen] = useState(false);

  // Switching State Machine variables
  const [switchState, setSwitchState] = useState<SwitchState>('idle');
  const [switchTarget, setSwitchTarget] = useState<{
    targetStaffId: string;
    targetShopId: string;
    cashierCode: string;
    staffName: string;
  } | null>(null);
  const [switchError, setSwitchError] = useState<string | null>(null);

  // Request sequencers for safe asynchronous commits (Generation Guard)
  const profileRequestSeq = useRef(0);
  const staffRequestSeq = useRef(0);
  const activeProfileUserId = useRef<string | null>(null);
  const inFlightProfilePromise = useRef<Promise<void> | null>(null);

  const isSwitchingRef = useRef(false);
  isSwitchingRef.current = switchState !== 'idle';

  const switchOperationRef = useRef(false);

  const fetchProfile = (userId: string): Promise<void> => {
    // Single-flight deduplication: if a profile request is already in-flight for this exact userId,
    // share the existing promise to prevent competing fetches and generation invalidations.
    if (inFlightProfilePromise.current && activeProfileUserId.current === userId) {
      return inFlightProfilePromise.current;
    }

    const requestId = ++profileRequestSeq.current;
    activeProfileUserId.current = userId;
    setIsProfileLoading(true);

    const promise = (async () => {
      try {
        const p = await profilesApi.getProfileById(userId);
        
        // Check generation validity
        if (requestId !== profileRequestSeq.current) return;
        
        // Verify the authenticated user is still the same before committing
        const currentUser = await authApi.getUser();
        if (!currentUser || currentUser.id !== userId) return;

        setProfile(p);

        if (p?.shop_id) {
          const staffRequestId = ++staffRequestSeq.current;
          const allStaff = await profilesApi.getProfilesByShop(p.shop_id);
          
          if (staffRequestId !== staffRequestSeq.current) return;
          setUsers(allStaff);
        }
      } catch (err) {
        console.warn('Failed to load profile for user:', userId, err);
        if (profileRequestSeq.current === requestId) {
          setProfile(null);
        }
      } finally {
        if (profileRequestSeq.current === requestId) {
          setIsProfileLoading(false);
          inFlightProfilePromise.current = null;
        }
      }
    })();

    inFlightProfilePromise.current = promise;
    return promise;
  };

  const refreshProfile = async () => {
    if (user?.id) {
      inFlightProfilePromise.current = null;
      await fetchProfile(user.id);
    }
  };

  useEffect(() => {
    let lastFocusCheck = 0;

    // Active access token tracking ref to prevent unnecessary state churn
    let activeToken: string | null = null;

    // Check initial session
    const initAuth = async () => {
      try {
        const currentSession = await authApi.getSession();
        activeToken = currentSession?.access_token ?? null;
        setSession(currentSession);
        const currentUser = currentSession?.user ?? null;
        setUser(currentUser);
        if (currentUser?.id) {
          await fetchProfile(currentUser.id);
        }
      } catch (err) {
        console.error('Failed to get initial session:', err);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();

    // Listen for auth changes (Synchronous callback to satisfy Supabase contract)
    const { unsubscribe } = authApi.onAuthStateChange((event, newSession) => {
      const newToken = newSession?.access_token ?? null;

      switch (event) {
        case 'INITIAL_SESSION':
        case 'SIGNED_IN': {
          activeToken = newToken;
          setSession(newSession);
          const newUser = newSession?.user ?? null;
          setUser(newUser);
          if (newUser?.id && !isSwitchingRef.current) {
            fetchProfile(newUser.id);
          }
          break;
        }
        case 'TOKEN_REFRESHED': {
          // Routine token refresh updates session state only if token changed
          if (newToken !== activeToken) {
            activeToken = newToken;
            setSession(newSession);
            const newUser = newSession?.user ?? null;
            if (newUser) {
              setUser(newUser);
            }
          }
          break;
        }
        case 'USER_UPDATED': {
          activeToken = newToken;
          setSession(newSession);
          const newUser = newSession?.user ?? null;
          setUser(newUser);
          if (newUser?.id && !isSwitchingRef.current) {
            inFlightProfilePromise.current = null;
            fetchProfile(newUser.id);
          }
          break;
        }
        case 'SIGNED_OUT': {
          activeToken = null;
          activeProfileUserId.current = null;
          inFlightProfilePromise.current = null;
          setSession(null);
          setUser(null);
          setProfile(null);
          setIsProfileLoading(false);
          setManagerElevation(false);
          break;
        }
        default: {
          if (newToken !== activeToken) {
            activeToken = newToken;
            setSession(newSession);
            if (newSession) {
              setUser(newSession.user);
            }
          }
          break;
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const rawRole = (profile?.role || 'cashier') as UserRole;
  const isOwner = rawRole === 'owner' || rawRole === 'admin';
  const isManager = rawRole === 'manager' || managerElevation;
  const isSeniorCashier = rawRole === 'senior_cashier';
  const isCashier = true; // All authenticated staff have baseline cashier permissions
  
  const isAtLeastSeniorCashier = isOwner || isManager || isSeniorCashier;
  const isAtLeastManager = isOwner || isManager;
  const shopId = profile?.shop_id || null;

  const hasPermission = (permission: keyof Permissions): boolean => {
    // 1. Owners and Admins have absolute business authority
    if (isOwner) return true;
    
    // 2. Critical privilege-escalation protection:
    // Temporary managerElevation via Cashier PIN elevation MUST NOT grant staff management
    if (permission === 'staff') {
      return (rawRole as string) === 'owner' || (rawRole as string) === 'admin' || (rawRole as string) === 'manager';
    }

    // 3. Authoritative effective permissions (Role Baseline + Allowed Optional Grants)
    const effective = getEffectivePermissions(rawRole, profile?.permissions as any);
    if (effective[permission]) return true;

    // 4. Temporary operational elevation on register (approvals for refunds, reports, etc.)
    if (managerElevation) {
      const operationalElevation: (keyof Permissions)[] = [
        'sales', 'inventory', 'pawn', 'sellerAcquisitions', 'refunds', 'reports'
      ];
      return operationalElevation.includes(permission);
    }

    return false;
  };

  const verifyManagerPin = async (pin: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const session = await authApi.getSession();
      const token = session?.access_token;

      const result = await apiPost<{ success: boolean; authorizedRole?: string; error?: string }>(
        '/api/verify-pin',
        { pin },
        token
      );

      if (result.ok && result.data?.success) {
        setManagerElevation(true);
        return { success: true };
      } else {
        return { success: false, error: result.error || result.data?.error || 'Invalid Manager PIN' };
      }
    } catch (err: any) {
      return { success: false, error: err?.message || 'Connection failed' };
    }
  };

  const provisionStaff = async (data: {
    fullName: string;
    role: 'cashier' | 'senior_cashier' | 'manager';
    cashierCode?: string;
    pinCode?: string;
    email?: string;
  }) => {
    if (!isManager && !isOwner) {
      return { success: false, error: 'Unauthorized: Manager or Owner authority required to provision staff.' };
    }

    if (!shopId) {
      return { 
        success: false, 
        error: 'No active shop assignment found. Staff can only be provisioned to an authenticated shop branch.' 
      };
    }

    const res = await staffApi.provisionStaff({
      shopId,
      fullName: data.fullName,
      role: data.role,
      cashierCode: data.cashierCode,
      pinCode: data.pinCode,
      email: data.email
    });

    if (res.success) {
      await refreshProfile();
    }

    return res;
  };

  const logout = async () => {
    profileRequestSeq.current++;
    staffRequestSeq.current++;
    activeProfileUserId.current = null;
    inFlightProfilePromise.current = null;
    setIsProfileLoading(false);
    try {
      const { terminalService } = await import('../services/terminalService');
      await terminalService.clearLocalSession();
    } catch (err) {
      console.warn('Failed to clear local terminal session during logout:', err);
    }
    await authApi.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    setIsProfileLoading(false);
    setManagerElevation(false);
    setSwitchState('idle');
    setSwitchTarget(null);
    setSwitchError(null);
  };

  const logoutManager = () => {
    setManagerElevation(false);
  };

  const updateStaffProfile = async (id: string, updates: Partial<ProfileRow>, reason?: string) => {
    const res = await staffApi.updateStaffProfile(id, updates, reason);
    if (res.success) {
      await refreshProfile();
    }
    return res;
  };

  const updateStaffAccessWithPassword = async (
    targetId: string,
    permissions: Partial<Permissions>,
    schedule: any,
    password: string,
    reason?: string
  ) => {
    const res = await staffApi.updateStaffAccess({
      targetId,
      permissions,
      schedule,
      password,
      reason
    });
    if (res.success) {
      await refreshProfile();
    }
    return res;
  };

  const resetStaffPin = async (id: string, newPin: string, reason?: string) => {
    const res = await staffApi.resetStaffPin(id, newPin, reason);
    if (res.success) {
      await refreshProfile();
    }
    return res;
  };

  const completeSwitchSteps = async (
    targetStaffId: string,
    targetShopId: string,
    cashierCode: string
  ): Promise<{ success: boolean; error?: string }> => {
    // Increment sequencer so any running background fetchProfile is canceled/ignored
    profileRequestSeq.current++;
    staffRequestSeq.current++;
    activeProfileUserId.current = targetStaffId;
    inFlightProfilePromise.current = null;
    setIsProfileLoading(true);

    setSwitchState('loading_profile');
    try {
      let profileSyncOk = false;
      let freshProfile: ProfileRow | null = null;

      // Poll and wait for user.id === profile.id === targetStaffId and match targetShopId and is_active === true
      // Limit to 10 seconds of polling (100 attempts at 100ms)
      for (let attempts = 0; attempts < 100; attempts++) {
        const currentUser = await authApi.getUser();
        const p = await profilesApi.getCurrentProfile();

        if (
          currentUser && 
          p && 
          currentUser.id === targetStaffId && 
          p.id === targetStaffId && 
          p.shop_id === targetShopId && 
          (!cashierCode || p.cashier_code === cashierCode)
        ) {
          if (p.is_active !== true) {
            throw new Error('This operator profile has been deactivated.');
          }
          freshProfile = p;
          profileSyncOk = true;
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      if (!profileSyncOk || !freshProfile) {
        throw new Error('Failed to verify profile synchronization. Please try again.');
      }

      // Sync React Auth State immediately
      const currentUser = await authApi.getUser();
      setUser(currentUser);
      setProfile(freshProfile);
      setIsProfileLoading(false);

      setSwitchState('acquiring_terminal');

      // Sync local terminal session for the new staff member
      const { terminalService } = await import('../services/terminalService');
      await terminalService.clearLocalSession();

      const terminalName = `${freshProfile.full_name}'s Terminal`;
      const activateRes = await terminalService.activateSession(terminalName, {
        shopId: targetShopId,
        userId: targetStaffId,
        userName: freshProfile.full_name
      });

      if (!activateRes.success) {
        throw new Error('Failed to acquire terminal session. Terminal is not authorized.');
      }

      // Verify stored local session and device ID
      const newSession = await terminalService.getCurrentLocalSession();
      if (
        !newSession ||
        newSession.shopId !== targetShopId ||
        newSession.userId !== targetStaffId ||
        newSession.userName !== freshProfile.full_name ||
        newSession.status !== 'active' ||
        newSession.deviceId !== terminalService.getDeviceId()
      ) {
        throw new Error('Failed to verify local terminal session integrity.');
      }

      // Check atomic invariants (Requirement 4)
      const finalUser = await authApi.getUser();
      const finalProfile = await profilesApi.getCurrentProfile();

      if (!finalUser || finalUser.id !== targetStaffId) {
        throw new Error('Atomic verification failed: Supabase user ID mismatch.');
      }
      if (!finalProfile || finalProfile.id !== targetStaffId) {
        throw new Error('Atomic verification failed: Profile ID mismatch.');
      }
      if (finalProfile.shop_id !== targetShopId) {
        throw new Error('Atomic verification failed: Profile shop ID mismatch.');
      }
      if (cashierCode && finalProfile.cashier_code !== cashierCode) {
        throw new Error('Atomic verification failed: Profile cashier code mismatch.');
      }
      if (finalProfile.is_active !== true) {
        throw new Error('Atomic verification failed: Target profile is not active.');
      }
      if (!currentUser || currentUser.id !== targetStaffId) {
        throw new Error('Atomic verification failed: React user queue mismatch.');
      }
      if (!freshProfile || freshProfile.id !== targetStaffId) {
        throw new Error('Atomic verification failed: React profile queue mismatch.');
      }

      // Pre-load the new shop's active staff list so the Account Picker shows correct members immediately
      if (freshProfile.shop_id) {
        try {
          const allStaff = await profilesApi.getProfilesByShop(freshProfile.shop_id);
          setUsers(allStaff);
        } catch (err) {
          console.warn('Failed to pre-load new shop staff profiles:', err);
        }
      }

      setSwitchState('ready');
      setSwitchError(null);
      return { success: true };

    } catch (err: any) {
      setIsProfileLoading(false);
      console.error("Account switch step completion failed:", err);
      const errMsg = err?.message || 'Failed to complete account switch';
      setSwitchState('error');
      setSwitchError(errMsg);
      return { success: false, error: errMsg };
    }
  };

  const switchAccountWithPin = async (params: {
    targetStaffId: string;
    targetShopId: string;
    cashierCode: string;
    pin: string;
    staffName: string;
  }): Promise<{ success: boolean; locked?: boolean; remainingSeconds?: number; error?: string }> => {
    console.log('[Client Switch] Initiated switchAccountWithPin');

    if (switchState !== 'idle' && switchState !== 'error') {
      console.warn('[Client Switch] Rejected: switchState is not idle/error');
      return { success: false, error: 'A switch is already in progress' };
    }

    if (switchOperationRef.current) {
      console.warn('[Client Switch] Rejected: switchOperationRef.current is true');
      return { success: false, error: 'A switch is already in progress' };
    }

    switchOperationRef.current = true;

    setSwitchState('authenticating');
    setSwitchError(null);
    setSwitchTarget({
      targetStaffId: params.targetStaffId,
      targetShopId: params.targetShopId,
      cashierCode: params.cashierCode,
      staffName: params.staffName
    });

    try {
      console.log('[Client Switch] Calling authApi.loginWithPin');
      const res = await authApi.loginWithPin(params.cashierCode, params.pin, params.targetShopId, params.targetStaffId);
      console.log(`[Client Switch] loginWithPin result success: ${res.success}`);

      if (!res.success) {
        console.warn('[Client Switch] loginWithPin failed. Resetting state to idle.');
        setSwitchState('idle');
        setSwitchTarget(null);
        return res;
      }

      // Verify the authenticated user is really the target, per Point 3
      console.log('[Client Switch] PIN login succeeded on server. Checking current active user...');
      const currentUser = await authApi.getUser();
      console.log('[Client Switch] Current user query complete');

      if (!currentUser || currentUser.id !== params.targetStaffId) {
        console.error('[Client Switch] Authenticated user mismatch after PIN login.');
        const errMessage = `Security mismatch: Authenticated identity does not match.`;
        setSwitchState('error');
        setSwitchError(errMessage);
        return { success: false, error: errMessage };
      }

      console.log('[Client Switch] Identity match verified. Invoking completeSwitchSteps...');
      const stepRes = await completeSwitchSteps(params.targetStaffId, params.targetShopId, params.cashierCode);
      console.log(`[Client Switch] completeSwitchSteps result success: ${stepRes.success}`);

      if (!stepRes.success) {
        // Do NOT immediately destroy the recovery state, remain authenticated to target to allow retry, per Requirement 6
        return { success: false, error: stepRes.error };
      }

      console.log('[Client Switch] Switch process completed successfully.');
      return { success: true };

    } catch (err: any) {
      console.error('[Client Switch] Account switch pipeline failed');
      const errMsg = err?.message || 'Authentication failed';
      setSwitchState('error');
      setSwitchError(errMsg);
      return { success: false, error: errMsg };
    } finally {
      switchOperationRef.current = false;
    }
  };

  const loginWithPassword = async (params: {
    targetStaffId: string;
    targetShopId: string;
    password: string;
    staffName: string;
  }): Promise<{ success: boolean; requirePasswordSetup?: boolean; error?: string }> => {
    if (switchOperationRef.current) {
      return { success: false, error: 'A switch is already in progress' };
    }

    switchOperationRef.current = true;
    setSwitchState('authenticating');
    setSwitchTarget({
      targetStaffId: params.targetStaffId,
      targetShopId: params.targetShopId,
      cashierCode: '',
      staffName: params.staffName
    });
    setSwitchError(null);

    try {
      const res = await authApi.loginWithPassword(params.targetStaffId, params.password, params.targetShopId);

      if (!res.success) {
        setSwitchState('idle');
        setSwitchTarget(null);
        return res;
      }

      const currentUser = await authApi.getUser();
      if (!currentUser || currentUser.id !== params.targetStaffId) {
        const errMessage = 'Security mismatch: Authenticated identity does not match.';
        setSwitchState('error');
        setSwitchError(errMessage);
        return { success: false, error: errMessage };
      }

      const stepRes = await completeSwitchSteps(params.targetStaffId, params.targetShopId, '');
      if (!stepRes.success) {
        return { success: false, error: stepRes.error };
      }

      setSwitchState('ready');
      setIsAccountPickerOpen(false);
      return { success: true };
    } catch (err: any) {
      const errMsg = err?.message || 'Authentication failed';
      setSwitchState('error');
      setSwitchError(errMsg);
      return { success: false, error: errMsg };
    } finally {
      switchOperationRef.current = false;
    }
  };

  const setupManagerPassword = async (params: {
    managerId: string;
    shopId: string;
    pin: string;
    newPassword: string;
    staffName?: string;
  }): Promise<{ success: boolean; locked?: boolean; remainingSeconds?: number; error?: string }> => {
    if (switchOperationRef.current) {
      return { success: false, error: 'A switch is already in progress' };
    }

    switchOperationRef.current = true;
    setSwitchState('authenticating');
    setSwitchTarget({
      targetStaffId: params.managerId,
      targetShopId: params.shopId,
      cashierCode: '',
      staffName: params.staffName || 'Manager'
    });
    setSwitchError(null);

    try {
      const res = await authApi.setupManagerPassword(params);
      if (!res.success) {
        setSwitchState('idle');
        setSwitchTarget(null);
        return res;
      }

      const currentUser = await authApi.getUser();
      if (!currentUser || currentUser.id !== params.managerId) {
        const errMessage = 'Security mismatch: Authenticated identity does not match.';
        setSwitchState('error');
        setSwitchError(errMessage);
        return { success: false, error: errMessage };
      }

      const stepRes = await completeSwitchSteps(params.managerId, params.shopId, '');
      if (!stepRes.success) {
        return { success: false, error: stepRes.error };
      }

      setSwitchState('ready');
      setIsAccountPickerOpen(false);
      await refreshProfile();
      return { success: true };
    } catch (err: any) {
      const errMsg = err?.message || 'Password setup failed';
      setSwitchState('error');
      setSwitchError(errMsg);
      return { success: false, error: errMsg };
    } finally {
      switchOperationRef.current = false;
    }
  };

  const retrySwitchAccount = async (): Promise<{ success: boolean; error?: string }> => {
    if (!switchTarget) {
      return { success: false, error: 'No active switch target to retry' };
    }
    if (switchOperationRef.current) {
      return { success: false, error: 'A switch is already in progress' };
    }

    switchOperationRef.current = true;
    setSwitchError(null);
    try {
      return await completeSwitchSteps(
        switchTarget.targetStaffId,
        switchTarget.targetShopId,
        switchTarget.cashierCode
      );
    } finally {
      switchOperationRef.current = false;
    }
  };

  const cancelSwitchAccount = async () => {
    if (switchOperationRef.current) {
      console.warn("Cancel ignored: switch operation in progress");
      return;
    }
    switchOperationRef.current = true;
    try {
      // Keep switchState as 'error' during the async logout to block the terminal, per Issue 2
      await logout();
    } finally {
      switchOperationRef.current = false;
    }
  };

  const resetSwitchState = () => {
    setSwitchState('idle');
    setSwitchTarget(null);
    setSwitchError(null);
  };

  // Remains true during the entire transition flow until explicitly closed and reset to idle
  const isSwitchingAccount = switchState !== 'idle';

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      profile,
      role: rawRole,
      shopId,
      isLoading, 
      isProfileLoading,
      isOwner,
      isManager, 
      isSeniorCashier,
      isCashier,
      isAtLeastSeniorCashier,
      isAtLeastManager,
      hasPermission,
      verifyManagerPin,
      provisionStaff,
      logout,
      logoutManager,
      refreshProfile,
      updateStaffProfile,
      updateStaffAccessWithPassword,
      resetStaffPin,
      setupManagerPassword,
      users,
      isAccountPickerOpen,
      setIsAccountPickerOpen,
      isSwitchingAccount,
      switchState,
      switchError,
      switchTarget,
      retrySwitchAccount,
      cancelSwitchAccount,
      resetSwitchState,
      switchAccountWithPin,
      loginWithPassword
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
