import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';
import {
  getOrCreateDeviceId,
  getTerminalName,
  checkTerminalConflict,
  activateTerminalSession,
  sendTerminalHeartbeat
} from '../services/terminalService';

export function useTerminalSession() {
  const { user, currentUserProfile, signOut } = useAuth();
  const { isOnline } = useSync();

  const [hasConflict, setHasConflict] = useState(false);
  const [existingTerminalName, setExistingTerminalName] = useState('Another Terminal');
  const [lastActiveTime, setLastActiveTime] = useState<string | undefined>(undefined);
  const [isActivating, setIsActivating] = useState(false);
  const [isInvalidated, setIsInvalidated] = useState(false);
  const [invalidationReason, setInvalidationReason] = useState<string | undefined>(undefined);

  const sessionTokenRef = useRef<string | undefined>(undefined);
  const heartbeatIntervalRef = useRef<any>(null);
  const terminalId = getOrCreateDeviceId();
  const terminalName = getTerminalName();

  // Perform conflict check on login / load
  const runSessionCheck = useCallback(async () => {
    if (!user || !isOnline) return;

    try {
      const conflictRes = await checkTerminalConflict(terminalId);
      if (conflictRes.hasConflict) {
        setExistingTerminalName(conflictRes.existingTerminalName || 'Another Terminal');
        setLastActiveTime(conflictRes.lastActive);
        setHasConflict(true);
      } else {
        // No conflict, activate immediately
        const actRes = await activateTerminalSession(terminalId, terminalName, false);
        if (actRes.sessionToken) {
          sessionTokenRef.current = actRes.sessionToken;
        }
      }
    } catch (err) {
      console.warn('Session check error:', err);
    }
  }, [user, isOnline, terminalId, terminalName]);

  // Handle Switch Confirmation
  const handleSwitchTerminal = async () => {
    setIsActivating(true);
    try {
      const res = await activateTerminalSession(terminalId, terminalName, true);
      if (res.sessionToken) {
        sessionTokenRef.current = res.sessionToken;
      }
      setHasConflict(false);
      setIsInvalidated(false);
    } catch (err) {
      console.error('Failed to switch terminal:', err);
    } finally {
      setIsActivating(false);
    }
  };

  // Handle Stay on Previous Terminal (Logout here)
  const handleStayOnCurrent = async () => {
    setHasConflict(false);
    await signOut();
  };

  // Handle Re-authentication from Lock Modal
  const handleReAuthenticate = async () => {
    await handleSwitchTerminal();
  };

  useEffect(() => {
    if (!user) {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      setHasConflict(false);
      setIsInvalidated(false);
      return;
    }

    runSessionCheck();

    // Heartbeat loop (every 45s)
    heartbeatIntervalRef.current = setInterval(async () => {
      if (!isOnline || isInvalidated) return;

      const heartbeat = await sendTerminalHeartbeat(terminalId, sessionTokenRef.current);
      if (heartbeat.isInvalidated) {
        setIsInvalidated(true);
        setInvalidationReason(heartbeat.reason);
      }
    }, 45000);

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, [user, isOnline, runSessionCheck]);

  // Re-check on tab visibility
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && user && isOnline) {
        sendTerminalHeartbeat(terminalId, sessionTokenRef.current).then(res => {
          if (res.isInvalidated) {
            setIsInvalidated(true);
            setInvalidationReason(res.reason);
          }
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [user, isOnline, terminalId]);

  return {
    hasConflict,
    existingTerminalName,
    lastActiveTime,
    isActivating,
    isInvalidated,
    invalidationReason,
    handleSwitchTerminal,
    handleStayOnCurrent,
    handleReAuthenticate
  };
}
