import { useState, useEffect, useCallback, useRef } from 'react';
import { terminalService } from '../services/terminalService';
import { TerminalSession } from '../types';
import { useAuth } from '../context/AuthContext';

export function useTerminalSession() {
  const { user, profile, isSwitchingAccount } = useAuth();
  const [session, setSession] = useState<TerminalSession | null>(null);
  const [conflict, setConflict] = useState<{ active_session: any } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOfflineRevalidation, setIsOfflineRevalidation] = useState(false);

  const initSeq = useRef(0);

  const checkAndInitialize = useCallback(async () => {
    const currentSeq = ++initSeq.current;

    if (isSwitchingAccount) {
      return;
    }

    if (!user || !profile) {
      if (currentSeq === initSeq.current) {
        setSession(null);
        setIsLoading(false);
        setIsOfflineRevalidation(false);
      }
      return;
    }

    try {
      let localSession = await terminalService.getCurrentLocalSession();
      if (currentSeq !== initSeq.current) return;

      if (localSession) {
        const isIdentityMatch = 
          localSession.userId === user.id &&
          localSession.shopId === profile.shop_id &&
          localSession.deviceId === terminalService.getDeviceId();

        if (!isIdentityMatch) {
          console.warn("Stale local terminal session detected. Discarding session belonging to user:", localSession.userId);
          await terminalService.clearLocalSession();
          if (currentSeq === initSeq.current) {
            setSession(null);
          }
          localSession = null;
        }
      }

      if (localSession && localSession.status === 'active') {
        // Render local session immediately so UI never hangs on network latency
        setSession(localSession);
        setIsLoading(false);

        // Perform background server heartbeat/revalidation
        try {
          const heartbeatRes = await terminalService.heartbeat(localSession.id);
          if (currentSeq !== initSeq.current) return;

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
          if (currentSeq === initSeq.current) {
            setIsOfflineRevalidation(true);
          }
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
      if (currentSeq !== initSeq.current) return;

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

      const identity = {
        shopId: profile.shop_id || '',
        userId: user.id,
        userName: profile.full_name
      };

      if (serverCheck.has_active_session) {
        if (serverCheck.terminal_id === terminalService.getDeviceId()) {
          const activateRes = await terminalService.activateSession(`${profile.full_name}'s Terminal`, identity);
          if (currentSeq !== initSeq.current) return;

          if (activateRes.success) {
            const newLocal = await terminalService.getCurrentLocalSession();
            setSession(newLocal);
            setIsOfflineRevalidation(false);
          }
        } else {
          setConflict({ active_session: serverCheck });
        }
      } else {
        const activateRes = await terminalService.activateSession(`${profile.full_name}'s Terminal`, identity);
        if (currentSeq !== initSeq.current) return;

        if (activateRes.success) {
          const newLocal = await terminalService.getCurrentLocalSession();
          setSession(newLocal);
          setIsOfflineRevalidation(false);
        }
      }
    } catch (err) {
      console.error('Terminal session initialization error:', err);
      if (currentSeq !== initSeq.current) return;

      const fallbackLocal = await terminalService.getCurrentLocalSession();
      if (fallbackLocal && fallbackLocal.status === 'active') {
        setSession(fallbackLocal);
        setIsOfflineRevalidation(true);
      }
    } finally {
      if (currentSeq === initSeq.current) {
        setIsLoading(false);
      }
    }
  }, [user, profile, isSwitchingAccount]);

  useEffect(() => {
    checkAndInitialize();
  }, [checkAndInitialize]);

  // Heartbeat loop (Strictly tied to current session identity)
  useEffect(() => {
    if (isSwitchingAccount || !session || session.status !== 'active' || !user) return;

    // Verify session belongs to the current user before starting heartbeat
    if (session.userId !== user.id) {
      console.warn("Heartbeat skipped: session userId mismatch", session.userId, user.id);
      return;
    }

    const interval = setInterval(async () => {
      if (isSwitchingAccount) return;
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
  }, [session?.id, session?.userId, user?.id, isSwitchingAccount]);

  const switchTerminal = async () => {
    if (!profile || !user) return;
    setIsLoading(true);
    try {
      await terminalService.clearLocalSession();
      const identity = {
        shopId: profile.shop_id || '',
        userId: user.id,
        userName: profile.full_name
      };
      const res = await terminalService.activateSession(`${profile.full_name}'s Terminal`, identity);
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
