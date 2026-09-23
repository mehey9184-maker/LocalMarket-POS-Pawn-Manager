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
  }) => Promise<{ success: boolean; profile?: ProfileRow; error?: string }>;
  logout: () => Promise<void>;
  logoutManager: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [session, setSession] = useState<any | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [managerElevation, setManagerElevation] = useState(false);

  const fetchProfile = async (userId: string) => {
    try {
      const p = await profilesApi.getProfileById(userId);
      setProfile(p);
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

    // Check initial session
    const initAuth = async () => {
      try {
        const currentSession = await authApi.getSession();
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
      switch (event) {
        case 'INITIAL_SESSION':
        case 'SIGNED_IN': {
          setSession(newSession);
          const newUser = newSession?.user ?? null;
          setUser(newUser);
          if (newUser?.id) {
            // Schedule non-blocking profile fetch
            setTimeout(() => {
              fetchProfile(newUser.id);
            }, 0);
          }
          break;
        }
        case 'TOKEN_REFRESHED': {
          setSession(newSession);
          const newUser = newSession?.user ?? null;
          if (newUser) {
            setUser(newUser);
          }
          // Notify dependent components that a fresh valid token is available
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('lm_session_recovered'));
          }
          break;
        }
        case 'USER_UPDATED': {
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
          setSession(null);
          setUser(null);
          setProfile(null);
          setManagerElevation(false);
          break;
        }
        default: {
          if (newSession) {
            setSession(newSession);
            setUser(newSession.user);
          }
          break;
        }
      }
    });

    // Foreground / visibility change handler
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        const validSession = await authApi.getSession();
        if (validSession) {
          setSession(validSession);
          setUser(validSession.user);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('lm_session_recovered'));
          }
        }
      }
    };

    // Throttled window focus handler
    const handleWindowFocus = async () => {
      const now = Date.now();
      if (now - lastFocusCheck < 10000) return; // At most once every 10 seconds
      lastFocusCheck = now;

      const validSession = await authApi.getSession();
      if (validSession) {
        setSession(validSession);
        setUser(validSession.user);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('lm_session_recovered'));
        }
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
    // 1. If currently logged in profile is manager/owner, verify profile pin if set
    if (profile && (profile.role === 'manager' || profile.role === 'owner' || profile.role === 'admin')) {
      if (profile.pin_code && profile.pin_code === pin) {
        setManagerElevation(true);
        return { success: true };
      }
    }

    // 2. Otherwise verify with backend secure server pin endpoint
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

    return await staffApi.provisionStaff({
      shopId,
      fullName: data.fullName,
      role: data.role,
      cashierCode: data.cashierCode,
      pinCode: data.pinCode
    });
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
      refreshProfile
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
