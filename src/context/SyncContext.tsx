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

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export const SyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { shopId } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(localStorage.getItem('last_sync_time'));

  const allLogs = (useLiveQuery(() => db.syncLogs.orderBy('createdAt').reverse().limit(50).toArray()) || []) as SyncLog[];
  const pendingCount = useLiveQuery(() => db.syncLogs.where('status').equals('pending').count()) || 0;

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
    await db.syncLogs.add({
      entityType,
      entityId,
      action,
      payload,
      status: 'pending',
      createdAt: new Date().toISOString(),
      retryCount: 0
    });
  }, []);

  const triggerSync = useCallback(async () => {
    if (isSyncing || !isOnline || !isSupabaseConfigured()) return;

    setIsSyncing(true);
    try {
      await SyncService.processAllPendingSync(shopId || undefined);
      const now = new Date().toISOString();
      setLastSyncTime(now);
      localStorage.setItem('last_sync_time', now);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, isOnline, shopId]);

  const retryFailedSync = async (logId: number) => {
    const log = await db.syncLogs.get(logId);
    if (log) {
      await db.syncLogs.update(logId, { status: 'syncing' });
      await SyncService.syncEntity(log as SyncLog, shopId || undefined);
    }
  };

  const clearCompletedLogs = async () => {
    await db.syncLogs.where('status').equals('completed').delete();
  };

  // Auto-sync when online
  useEffect(() => {
    if (isOnline && pendingCount > 0) {
      const timer = setTimeout(() => triggerSync(), 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, pendingCount, triggerSync]);

  return (
    <SyncContext.Provider value={{
      syncStatus: { isOnline, isSyncing, pendingCount, lastSyncTime },
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
