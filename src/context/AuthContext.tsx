import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi, profilesApi, staffApi } from '../services/supabaseApi';
import { ProfileRow, UserRole } from '../types/supabase';

interface AuthContextType {
  user: any | null;
  session: any | null;
  profile: ProfileRow | null;
  role: UserRole;
  shopId: string | null;
  isLoading: boolean;
  isOwner: boolean;
  isManager: boolean;
  isCashier: boolean;
  verifyManagerPin: (pin: string) => Promise<{ success: boolean; error?: string }>;
  provisionStaff: (data: {
    fullName: string;
    role: 'cashier' | 'senior_cashier' | 'manager';
    cashierCode: string;
    pinCode?: string;
    email?: string;
  }) => Promise<{ success: boolean; profile?: ProfileRow; error?: string }>;
  logout: () => Promise<void>;
  logoutManager: () => void;
  refreshProfile: () => Promise<void>;
  updateStaffProfile: (id: string, updates: Partial<ProfileRow>, reason?: string) => Promise<{ success: boolean; error?: string }>;
  users: ProfileRow[];
  isAccountPickerOpen: boolean;
  setIsAccountPickerOpen: (open: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [session, setSession] = useState<any | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [users, setUsers] = useState<ProfileRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [managerElevation, setManagerElevation] = useState(false);
  const [isAccountPickerOpen, setIsAccountPickerOpen] = useState(false);

  const fetchProfile = async (userId: string) => {
    try {
      const p = await profilesApi.getProfileById(userId);
      setProfile(p);
      if (p?.shop_id) {
        const allStaff = await profilesApi.getProfilesByShop(p.shop_id);
        setUsers(allStaff);
      }
    } catch (err) {
      console.warn('Failed to load profile for user:', userId, err);
      setProfile(null);
    }
  };

  const refreshProfile = async () => {
    if (user?.id) {
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
          if (newUser?.id) {
            setTimeout(() => {
              fetchProfile(newUser.id);
            }, 0);
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
          // Do NOT dispatch lm_session_recovered or reload profile on routine TOKEN_REFRESHED
          break;
        }
        case 'USER_UPDATED': {
          activeToken = newToken;
          setSession(newSession);
          const newUser = newSession?.user ?? null;
          setUser(newUser);
          if (newUser?.id) {
            setTimeout(() => {
              fetchProfile(newUser.id);
            }, 0);
          }
          break;
        }
        case 'SIGNED_OUT': {
          activeToken = null;
          setSession(null);
          setUser(null);
          setProfile(null);
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

    // Foreground / visibility change handler — checks recovery only if token changed or session was missing
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        const validSession = await authApi.getSession();
        const freshToken = validSession?.access_token ?? null;
        if (freshToken && validSession) {
          if (freshToken !== activeToken) {
            const wasMissing = !activeToken;
            activeToken = freshToken;
            setSession(validSession);
            setUser(validSession.user ?? null);
            if (wasMissing && typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('lm_session_recovered'));
            }
          }
        } else if (activeToken) {
          activeToken = null;
          setSession(null);
          setUser(null);
          setProfile(null);
        }
      }
    };

    // Throttled window focus handler
    const handleWindowFocus = async () => {
      const now = Date.now();
      if (now - lastFocusCheck < 10000) return; // At most once every 10 seconds
      lastFocusCheck = now;

      const validSession = await authApi.getSession();
      const freshToken = validSession?.access_token ?? null;
      if (freshToken && validSession) {
        if (freshToken !== activeToken) {
          const wasMissing = !activeToken;
          activeToken = freshToken;
          setSession(validSession);
          setUser(validSession.user ?? null);
          if (wasMissing && typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('lm_session_recovered'));
          }
        }
      } else if (activeToken) {
        activeToken = null;
        setSession(null);
        setUser(null);
        setProfile(null);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, []);

  const rawRole = (profile?.role || 'cashier') as UserRole;
  const isOwner = rawRole === 'owner' || rawRole === 'admin';
  const isManager = isOwner || rawRole === 'manager' || managerElevation;
  const isCashier = true; // All authenticated staff have baseline cashier permissions
  const shopId = profile?.shop_id || null;

  const verifyManagerPin = async (pin: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const session = await authApi.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch('/api/verify-pin', {
        method: 'POST',
        headers,
        body: JSON.stringify({ pin }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setManagerElevation(true);
        return { success: true };
      } else {
        return { success: false, error: data.error || 'Invalid Manager PIN' };
      }
    } catch (err: any) {
      return { success: false, error: err?.message || 'Connection failed' };
    }
  };

  const provisionStaff = async (data: {
    fullName: string;
    role: 'cashier' | 'senior_cashier' | 'manager';
    cashierCode: string;
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
    await authApi.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    setManagerElevation(false);
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

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      profile,
      role: rawRole,
      shopId,
      isLoading, 
      isOwner,
      isManager, 
      isCashier,
      verifyManagerPin,
      provisionStaff,
      logout,
      logoutManager,
      refreshProfile,
      updateStaffProfile,
      users,
      isAccountPickerOpen,
      setIsAccountPickerOpen
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
