import { useState, useEffect, useCallback, useRef } from 'react';
import { terminalService } from '../services/terminalService';
import { TerminalSession } from '../types';
import { useAuth } from '../context/AuthContext';

export function useTerminalSession() {
  const { user, profile, isProfileLoading, isSwitchingAccount } = useAuth();

  // Stable identity primitives to prevent unnecessary revalidation on object identity changes
  const userId = user?.id ?? null;
  const profileId = profile?.id ?? null;
  const shopId = profile?.shop_id ?? null;
  const userName = profile?.full_name || user?.user_metadata?.full_name || '';

  // Synchronously check local storage cache on initial mount to allow instant warm resume
  const [session, setSession] = useState<TerminalSession | null>(() => {
    const cached = terminalService.getCachedLocalSession();
    if (cached && cached.status === 'active') {
      const devId = terminalService.getDeviceId();
      if (cached.deviceId === devId) {
        if (!userId || cached.userId === userId) {
          if (!shopId || cached.shopId === shopId) {
            return cached;
          }
        }
      }
    }
    return null;
  });

  const [conflict, setConflict] = useState<{ active_session: any } | null>(null);

  // If a matching active local session is immediately available, start with isLoading = false
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    const cached = terminalService.getCachedLocalSession();
    if (cached && cached.status === 'active') {
      const devId = terminalService.getDeviceId();
      if (cached.deviceId === devId) {
        if (!userId || cached.userId === userId) {
          if (!shopId || cached.shopId === shopId) {
            return false;
          }
        }
      }
    }
    return true;
  });

  const [isOfflineRevalidation, setIsOfflineRevalidation] = useState(false);

  const initSeq = useRef(0);
  const prevIdentityRef = useRef<{ userId: string | null; shopId: string | null; profileId: string | null }>({
    userId: null,
    shopId: null,
    profileId: null,
  });

  const checkAndInitialize = useCallback(async () => {
    const currentSeq = ++initSeq.current;

    if (isSwitchingAccount) {
      return;
    }

    // 1. If not authenticated, clear session and loading state
    if (!userId) {
      if (currentSeq === initSeq.current) {
        setSession(null);
        setIsLoading(false);
        setIsOfflineRevalidation(false);
      }
      return;
    }

    // 2. Read local session from authoritative IndexedDB / cache
    let localSession = await terminalService.getCurrentLocalSession();
    if (currentSeq !== initSeq.current) return;

    const deviceId = terminalService.getDeviceId();

    // Check if we have an active matching local session
    const isMatchingLocal =
      localSession &&
      localSession.status === 'active' &&
      localSession.userId === userId &&
      localSession.deviceId === deviceId &&
      (!shopId || localSession.shopId === shopId);

    // If local session exists but belongs to a different user, shop, or device, discard it
    if (localSession && !isMatchingLocal) {
      const isMismatch =
        localSession.userId !== userId ||
        (shopId && localSession.shopId !== shopId) ||
        localSession.deviceId !== deviceId;

      if (isMismatch && localSession.status === 'active') {
        console.warn("Stale local terminal session identity mismatch. Clearing discarded session for:", localSession.userId);
        await terminalService.clearLocalSession();
        if (currentSeq === initSeq.current) {
          setSession(null);
        }
        localSession = null;
      }
    }

    // Warm return / reload: If matching active session exists, reuse it immediately without blocking
    if (localSession && localSession.status === 'active') {
      if (currentSeq === initSeq.current) {
        setSession(localSession);
        setIsLoading(false);
      }

      // If stable identity has not changed (e.g. routine token refresh / visibility change),
      // we only perform background heartbeat revalidation without re-booting the terminal
      prevIdentityRef.current = { userId, shopId, profileId };

      // Background heartbeat / server revalidation
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
          // Temporary network failure during background heartbeat: preserve offline access
          setIsOfflineRevalidation(true);
        }
      } catch {
        if (currentSeq === initSeq.current) {
          setIsOfflineRevalidation(true);
        }
      }
      return;
    }

    // If profile is still hydrating and we have no local session yet, stay in cold-boot loading
    if (isProfileLoading || !shopId) {
      return;
    }

    // Cold start with no usable local session: show connecting loader
    setIsLoading(true);

    // If local session is invalidated/expired, display it directly
    if (localSession && (localSession.status === 'invalidated' || localSession.status === 'expired')) {
      setSession(localSession);
      setIsLoading(false);
      return;
    }

    try {
      // Check server for active sessions
      const serverCheck = await terminalService.checkActiveSession();
      if (currentSeq !== initSeq.current) return;

      if (!serverCheck.success) {
        // Transient network failure contacting server: maintain offline capability
        if (localSession && localSession.status === 'active') {
          setSession(localSession);
          setIsOfflineRevalidation(true);
        } else {
          setSession(localSession || null);
        }
        return;
      }

      const identity = {
        shopId: shopId,
        userId: userId,
        userName: userName
      };

      if (serverCheck.has_active_session) {
        if (serverCheck.terminal_id === deviceId) {
          const activateRes = await terminalService.activateSession(`${userName}'s Terminal`, identity);
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
        const activateRes = await terminalService.activateSession(`${userName}'s Terminal`, identity);
        if (currentSeq !== initSeq.current) return;

        if (activateRes.success) {
          const newLocal = await terminalService.getCurrentLocalSession();
          setSession(newLocal);
          setIsOfflineRevalidation(false);
        }
      }

      prevIdentityRef.current = { userId, shopId, profileId };
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
  }, [userId, profileId, shopId, userName, isProfileLoading, isSwitchingAccount]);

  useEffect(() => {
    checkAndInitialize();
  }, [checkAndInitialize]);

  // Heartbeat loop (Strictly tied to current session identity)
  useEffect(() => {
    if (isSwitchingAccount || !session || session.status !== 'active' || !userId) return;

    // Verify session belongs to the current user before starting heartbeat
    if (session.userId !== userId) {
      console.warn("Heartbeat skipped: session userId mismatch", session.userId, userId);
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
  }, [session?.id, session?.userId, userId, isSwitchingAccount]);

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
