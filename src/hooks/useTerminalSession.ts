import { useState, useEffect, useCallback } from 'react';
import { terminalService } from '../services/terminalService';
import { TerminalSession } from '../types';
import { useAuth } from '../context/AuthContext';

export function useTerminalSession() {
  const { user, profile } = useAuth();
  const [session, setSession] = useState<TerminalSession | null>(null);
  const [conflict, setConflict] = useState<{ active_session: any } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOfflineRevalidation, setIsOfflineRevalidation] = useState(false);

  const checkAndInitialize = useCallback(async () => {
    if (!user || !profile) {
      setSession(null);
      setIsLoading(false);
      setIsOfflineRevalidation(false);
      return;
    }

    try {
      const localSession = await terminalService.getCurrentLocalSession();

      if (localSession && localSession.status === 'active') {
        // Render local session immediately so UI never hangs on network latency
        setSession(localSession);
        setIsLoading(false);

        // Perform background server heartbeat/revalidation
        try {
          const heartbeatRes = await terminalService.heartbeat(localSession.id);
          if (heartbeatRes.status === 'active') {
            setIsOfflineRevalidation(false);
          } else if (heartbeatRes.status === 'invalidated' || heartbeatRes.status === 'expired') {
            const updated = await terminalService.getCurrentLocalSession();
            setSession(updated);
            setIsOfflineRevalidation(false);
          } else {
            setIsOfflineRevalidation(true);
          }
        } catch {
          setIsOfflineRevalidation(true);
        }
        return;
      }

      setIsLoading(true);

      // If local session is invalidated/expired, display it directly
      if (localSession && (localSession.status === 'invalidated' || localSession.status === 'expired')) {
        setSession(localSession);
        return;
      }

      // Check server for active sessions
      const serverCheck = await terminalService.checkActiveSession();
      if (!serverCheck.success) {
        // Transient network failure contacting server
        if (localSession && localSession.status === 'active') {
          setSession(localSession);
          setIsOfflineRevalidation(true);
        } else {
          setSession(localSession || null);
        }
        return;
      }

      if (serverCheck.has_active_session) {
        if (serverCheck.terminal_id === terminalService.getDeviceId()) {
          const activateRes = await terminalService.activateSession(`${profile.full_name}'s Terminal`);
          if (activateRes.success) {
            const newLocal = await terminalService.getCurrentLocalSession();
            setSession(newLocal);
            setIsOfflineRevalidation(false);
          }
        } else {
          setConflict({ active_session: serverCheck });
        }
      } else {
        const activateRes = await terminalService.activateSession(`${profile.full_name}'s Terminal`);
        if (activateRes.success) {
          const newLocal = await terminalService.getCurrentLocalSession();
          setSession(newLocal);
          setIsOfflineRevalidation(false);
        }
      }
    } catch (err) {
      console.error('Terminal session initialization error:', err);
      const fallbackLocal = await terminalService.getCurrentLocalSession();
      if (fallbackLocal && fallbackLocal.status === 'active') {
        setSession(fallbackLocal);
        setIsOfflineRevalidation(true);
      }
    } finally {
      setIsLoading(false);
    }
  }, [user, profile]);

  useEffect(() => {
    checkAndInitialize();
  }, [checkAndInitialize]);

  // Heartbeat loop
  useEffect(() => {
    if (!session || session.status !== 'active') return;

    const interval = setInterval(async () => {
      try {
        const res = await terminalService.heartbeat(session.id);
        if (res.status === 'active') {
          setIsOfflineRevalidation(false);
        } else if (res.status === 'invalidated' || res.status === 'expired') {
          const updated = await terminalService.getCurrentLocalSession();
          setSession(updated);
        } else {
          // Transient network failure during heartbeat
          setIsOfflineRevalidation(true);
        }
      } catch (err) {
        setIsOfflineRevalidation(true);
      }
    }, 60000); // 1 minute

    return () => clearInterval(interval);
  }, [session]);

  const switchTerminal = async () => {
    if (!profile) return;
    setIsLoading(true);
    try {
      await terminalService.clearLocalSession();
      const res = await terminalService.activateSession(`${profile.full_name}'s Terminal`);
      if (res.success) {
        const newLocal = await terminalService.getCurrentLocalSession();
        setSession(newLocal);
        setConflict(null);
        setIsOfflineRevalidation(false);
      }
    } catch (err) {
      console.error('Switch terminal error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const reconnectTerminal = async () => {
    setIsLoading(true);
    try {
      const local = await terminalService.getCurrentLocalSession();
      if (local && (local.status === 'invalidated' || local.status === 'expired')) {
        await terminalService.clearLocalSession();
      }
      setConflict(null);
      await checkAndInitialize();
    } catch (err) {
      console.error('Reconnect terminal error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    session,
    conflict,
    isLoading,
    isOfflineRevalidation,
    switchTerminal,
    reconnectTerminal,
    refresh: checkAndInitialize
  };
}
