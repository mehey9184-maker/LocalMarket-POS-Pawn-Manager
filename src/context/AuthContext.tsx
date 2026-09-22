import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../services/supabaseApi';

interface AuthContextType {
  user: any | null;
  session: any | null;
  isLoading: boolean;
  isManager: boolean;
  verifyManagerPin: (pin: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  logoutManager: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [session, setSession] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isManager, setIsManager] = useState(false);

  useEffect(() => {
    // Check initial session
    const initAuth = async () => {
      try {
        const currentSession = await authApi.getSession();
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
      } catch (err) {
        console.error('Failed to get initial session:', err);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();

    // Listen for auth changes
    const { unsubscribe } = authApi.onAuthStateChange((newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (!newSession) {
        setIsManager(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const verifyManagerPin = async (pin: string) => {
    try {
      const response = await fetch('/api/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });

      const data = await response.json();
      if (data.success) {
        setIsManager(true);
        return { success: true };
      } else {
        return { success: false, error: data.error };
      }
    } catch (err) {
      return { success: false, error: 'Connection failed' };
    }
  };

  const logout = async () => {
    await authApi.signOut();
    setSession(null);
    setUser(null);
    setIsManager(false);
  };

  const logoutManager = () => {
    setIsManager(false);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      isLoading, 
      isManager, 
      verifyManagerPin, 
      logout,
      logoutManager 
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
