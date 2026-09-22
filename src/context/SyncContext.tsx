import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { SyncLog, SyncStatus } from '../types';
import { isSupabaseConfigured } from '../services/supabase';
import { shopItemsApi, logsApi } from '../services/supabaseApi';

interface SyncContextType {
  syncStatus: SyncStatus;
  syncLogs: SyncLog[];
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
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(localStorage.getItem('last_sync_time'));

  const pendingLogs = useLiveQuery(() => db.syncLogs.where('status').equals('pending').toArray()) || [];
  const allLogs = useLiveQuery(() => db.syncLogs.orderBy('createdAt').reverse().limit(50).toArray()) || [];
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

  const processSyncItem = async (log: SyncLog) => {
    if (!isSupabaseConfigured()) return;

    try {
      if (log.entityType === 'inventory') {
        if (log.action === 'create') {
          await shopItemsApi.createItem(log.payload);
        } else if (log.action === 'update') {
          await shopItemsApi.updateItem(log.entityId, log.payload);
        }
      } else {
        // Generic log for other types
        await logsApi.createLog(
          `${log.action.toUpperCase()}_${log.entityType.toUpperCase()}`,
          'System Sync',
          log.payload,
          'info'
        );
      }

      await db.syncLogs.update(log.id!, {
        status: 'completed',
        syncedAt: new Date().toISOString(),
        error: undefined
      });
    } catch (error: any) {
      await db.syncLogs.update(log.id!, {
        status: 'failed',
        error: error.message,
        retryCount: (log.retryCount || 0) + 1
      });
      throw error;
    }
  };

  const triggerSync = useCallback(async () => {
    if (isSyncing || !isOnline || !isSupabaseConfigured()) return;

    setIsSyncing(true);
    try {
      const logs = await db.syncLogs.where('status').anyOf('pending', 'failed').toArray();
      for (const log of logs) {
        await db.syncLogs.update(log.id!, { status: 'syncing' });
        try {
          await processSyncItem(log);
        } catch (e) {
          console.error(`Sync failed for log ${log.id}:`, e);
          // Continue with next item even if one fails
        }
      }
      const now = new Date().toISOString();
      setLastSyncTime(now);
      localStorage.setItem('last_sync_time', now);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, isOnline]);

  const retryFailedSync = async (logId: number) => {
    const log = await db.syncLogs.get(logId);
    if (log) {
      await db.syncLogs.update(logId, { status: 'syncing' });
      await processSyncItem(log);
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
