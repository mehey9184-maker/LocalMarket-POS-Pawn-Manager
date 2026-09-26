import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { SyncLog, SyncStatus } from '../types';
import { isSupabaseConfigured } from '../services/supabase';
import { SyncService } from '../services/SyncService';
import { useAuth } from './AuthContext';

interface SyncContextType {
  syncStatus: SyncStatus;
  syncLogs: SyncLog[];
  isOnline: boolean;
  isSyncing: boolean;
  triggerSync: () => Promise<void>;
  retryFailedSync: (logId: number) => Promise<void>;
  clearCompletedLogs: () => Promise<void>;
  queueSyncAction: (
    entityType: SyncLog['entityType'],
    entityId: string,
    action: SyncLog['action'],
    payload: any
  ) => Promise<void>;
}

const isUuid = (id: string | null | undefined): boolean => {
  if (!id) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
};

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export const SyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { shopId, isLoading: authLoading, user } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(localStorage.getItem('last_sync_time'));
  const [isQueueAudited, setIsQueueAudited] = useState(false);

  // Audit/quarantine queue on startup BEFORE allowing automatic cloud synchronization
  useEffect(() => {
    const auditQueue = async () => {
      try {
        await SyncService.quarantineLegacyRecords();
      } catch (err) {
        console.error('Failed to audit/quarantine legacy records on startup:', err);
      } finally {
        setIsQueueAudited(true);
      }
    };
    auditQueue();
  }, []);

  const isReadyForAutoSync = isQueueAudited && !authLoading && !!user && !!shopId && isUuid(shopId);
  const currentShopId = shopId;

  const allLogs = (useLiveQuery(
    () => currentShopId ? db.syncLogs.where('shopId').equals(currentShopId).reverse().limit(50).toArray() : Promise.resolve([] as SyncLog[]),
    [currentShopId]
  ) || []) as SyncLog[];

  const pendingCount = useLiveQuery(
    () => currentShopId ? db.syncLogs.where('shopId').equals(currentShopId).and(log => log.status === 'pending').count() : Promise.resolve(0),
    [currentShopId]
  ) || 0;

  const failedCount = useLiveQuery(
    () => currentShopId ? db.syncLogs.where('shopId').equals(currentShopId).and(log => log.status === 'failed').count() : Promise.resolve(0),
    [currentShopId]
  ) || 0;

  // Compute deterministic vs transient error counts reactively
  const failedLogs = useLiveQuery(
    () => currentShopId ? db.syncLogs.where('shopId').equals(currentShopId).and(log => log.status === 'failed').toArray() : Promise.resolve([] as SyncLog[]),
    [currentShopId]
  ) || [];
  const hasDeterministicError = failedLogs.some(log => log.error && log.error.toUpperCase().includes('DETERMINISTIC'));
  const hasTransientError = failedLogs.some(log => log.error && !log.error.toUpperCase().includes('DETERMINISTIC'));

  const [hasRunStartupSync, setHasRunStartupSync] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const queueSyncAction = useCallback(async (
    entityType: SyncLog['entityType'],
    entityId: string,
    action: SyncLog['action'],
    payload: any
  ) => {
    if (!currentShopId) {
      console.warn(`[SyncContext] Refusing to queue ${entityType} action: No active shop context.`);
      return;
    }

    // If the entityId is not a valid UUID, it is synthetic/demo/seed data and must never be queued for Supabase
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(entityId)) {
      console.warn(`[SyncContext] Skipping sync queueing for synthetic/demo entity ${entityType} with ID ${entityId}`);
      return;
    }

    await db.syncLogs.add({
      shopId: currentShopId,
      entityType,
      entityId,
      action,
      payload,
      status: 'pending',
      createdAt: new Date().toISOString(),
      retryCount: 0
    });
  }, [currentShopId]);

  const triggerSync = useCallback(async () => {
    if (isSyncing || !isOnline || !isSupabaseConfigured()) return;
    if (!currentShopId || !isUuid(currentShopId)) {
      console.warn('[SyncContext] Aborting sync: shop context is invalid or not yet established.');
      return;
    }

    setIsSyncing(true);
    try {
      const res = await SyncService.processAllPendingSync(currentShopId);
      if (res && res.failed === 0) {
        const now = new Date().toISOString();
        setLastSyncTime(now);
        localStorage.setItem(`last_sync_time_${currentShopId}`, now);
      }
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, isOnline, currentShopId]);

  const retryFailedSync = async (logId: number) => {
    const log = await db.syncLogs.get(logId);
    if (log && log.shopId === currentShopId) {
      await db.syncLogs.update(logId, { status: 'syncing', error: undefined });
      const res = await SyncService.syncEntity(log as SyncLog, currentShopId || undefined);
      if (res && !res.success) {
        await db.syncLogs.update(logId, {
          status: 'failed',
          error: res.error || 'Manual retry failed'
        });
      }
    }
  };

  const clearCompletedLogs = async () => {
    if (!currentShopId) return;
    await db.syncLogs.where('shopId').equals(currentShopId).and(log => log.status === 'completed').delete();
  };

  // 1. Initial application startup sync trigger
  useEffect(() => {
    if (isReadyForAutoSync && isOnline && !hasRunStartupSync && (pendingCount > 0 || failedCount > 0)) {
      setHasRunStartupSync(true);
      triggerSync();
    }
  }, [isReadyForAutoSync, isOnline, pendingCount, failedCount, hasRunStartupSync, triggerSync]);

  // 2. OFFLINE -> ONLINE transition trigger
  const prevOnlineRef = React.useRef(isOnline);
  useEffect(() => {
    if (isReadyForAutoSync && isOnline && !prevOnlineRef.current) {
      triggerSync();
    }
    prevOnlineRef.current = isOnline;
  }, [isReadyForAutoSync, isOnline, triggerSync]);

  // 3. New pending item addition trigger (excluding failedCount to prevent retry storm)
  const prevPendingCountRef = React.useRef(pendingCount);
  useEffect(() => {
    if (isReadyForAutoSync && pendingCount > prevPendingCountRef.current) {
      const timer = setTimeout(() => triggerSync(), 1000);
      return () => clearTimeout(timer);
    }
    prevPendingCountRef.current = pendingCount;
  }, [isReadyForAutoSync, pendingCount, triggerSync]);

  return (
    <SyncContext.Provider value={{
      syncStatus: { 
        isOnline, 
        isSyncing, 
        pendingCount, 
        failedCount, 
        hasDeterministicError, 
        hasTransientError, 
        lastSyncTime 
      },
      syncLogs: allLogs,
      isOnline,
      isSyncing,
      triggerSync,
      retryFailedSync,
      clearCompletedLogs,
      queueSyncAction
    }}>
      {children}
    </SyncContext.Provider>
  );
};

export const useSync = () => {
  const context = useContext(SyncContext);
  if (!context) throw new Error('useSync must be used within SyncProvider');
  return context;
};
