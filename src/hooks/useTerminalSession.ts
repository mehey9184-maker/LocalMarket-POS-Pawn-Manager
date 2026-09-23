import { useState, useEffect, useCallback } from 'react';
import { terminalService } from '../services/terminalService';
import { TerminalSession } from '../types';
import { useAuth } from '../context/AuthContext';

export function useTerminalSession() {
  const { user, profile } = useAuth();
  const [session, setSession] = useState<TerminalSession | null>(null);
  const [conflict, setConflict] = useState<{ active_session: any } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkAndInitialize = useCallback(async () => {
    if (!user || !profile) {
      setSession(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const localSession = await terminalService.getCurrentLocalSession();
    
    if (localSession && localSession.status === 'active') {
      // Check if this local session is still valid on the server
      const heartbeatRes = await terminalService.heartbeat(localSession.id);
      if (heartbeatRes.status === 'active') {
        setSession(localSession);
        setIsLoading(false);
        return;
      }
    }

    // No valid local session, check server for other active sessions
    const serverCheck = await terminalService.checkActiveSession();
    if (serverCheck.has_active_session) {
      // Conflict detected
      if (serverCheck.terminal_id === terminalService.getDeviceId()) {
        // It's this terminal! Try to recover it.
        // If recover fails (e.g. status was not active in server_check return, but rpc says it is)
        // For simplicity, if IDs match, we should just reactivate or use it.
        const activateRes = await terminalService.activateSession(`${profile.full_name}'s Terminal`);
        if (activateRes.success) {
          const newLocal = await terminalService.getCurrentLocalSession();
          setSession(newLocal);
        }
      } else {
        setConflict({ active_session: serverCheck });
      }
    } else {
      // No active session anywhere, create one
      const activateRes = await terminalService.activateSession(`${profile.full_name}'s Terminal`);
      if (activateRes.success) {
        const newLocal = await terminalService.getCurrentLocalSession();
        setSession(newLocal);
      }
    }
    
    setIsLoading(false);
  }, [user, profile]);

  useEffect(() => {
    checkAndInitialize();
  }, [checkAndInitialize]);

  // Heartbeat loop
  useEffect(() => {
    if (!session || session.status !== 'active') return;

    const interval = setInterval(async () => {
      const res = await terminalService.heartbeat(session.id);
      if (res.status !== 'active') {
        const updated = await terminalService.getCurrentLocalSession();
        setSession(updated);
      }
    }, 60000); // 1 minute

    return () => clearInterval(interval);
  }, [session]);

  const switchTerminal = async () => {
    if (!profile) return;
    setIsLoading(true);
    const res = await terminalService.activateSession(`${profile.full_name}'s Terminal`);
    if (res.success) {
      const newLocal = await terminalService.getCurrentLocalSession();
      setSession(newLocal);
      setConflict(null);
    }
    setIsLoading(false);
  };

  return {
    session,
    conflict,
    isLoading,
    switchTerminal,
    refresh: checkAndInitialize
  };
}
