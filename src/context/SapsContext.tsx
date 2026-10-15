import React, { createContext, useContext, useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { SapsEntry } from '../types';
import Fuse from 'fuse.js';
import { useSync } from './SyncContext';
import { useAuth } from './AuthContext';
import { isSupabaseConfigured } from '../services/supabase';
import { sapsApi } from '../services/supabaseApi';

export interface SapsSyncStatus {
  isLoading: boolean;
  error: string | null;
  lastSyncedAt: string | null;
}

interface SapsContextType {
  sapsEntries: SapsEntry[];
  filteredSaps: SapsEntry[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  addSapsEntry: (entry: Omit<SapsEntry, 'id' | 'entryNumber'>) => Promise<string>;
  getSapsEntry: (id: string) => Promise<SapsEntry | undefined>;
  cancelSapsEntry: (id: string, reason: string) => Promise<void>;
  exportSapsCsv: () => void;
  refreshSaps: () => Promise<void>;
  syncStatus: SapsSyncStatus;
}

const SapsContext = createContext<SapsContextType | undefined>(undefined);

export const SapsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { queueSyncAction, isOnline } = useSync();
  const { shopId } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [isHydrating, setIsHydrating] = useState(false);
  const [hydrationError, setHydrationError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const activeShopIdRef = useRef<string | null>(shopId);

  useEffect(() => {
    activeShopIdRef.current = shopId;
  }, [shopId]);

  const refreshSaps = useCallback(async () => {
    if (!shopId) {
      setHydrationError('No active shop context assigned.');
      return;
    }
    if (!isSupabaseConfigured() || !isOnline) {
      return;
    }
    setIsHydrating(true);
    setHydrationError(null);
    try {
      const rows = await sapsApi.getEntries({ shopId });
      // Protect against shop switching: late response from previous shop must never be saved
      if (activeShopIdRef.current !== shopId) return;

      if (rows && rows.length > 0) {
        // Collect IDs of pending local mutations from outbox to prevent overwriting in-flight work
        const pendingLogs = await db.syncLogs
          .where('status')
          .anyOf('pending', 'syncing', 'failed')
          .and(l => l.shopId === shopId && (
            l.entityType === 'saps' || 
            (l.entityType as string) === 'sapsEntry' ||
            l.entityType === 'buyAcquisition' ||
            l.entityType === 'pawnIntake'
          ))
          .toArray();

        const pendingIds = new Set<string>();
        for (const l of pendingLogs) {
          if (l.entityType === 'saps' || (l.entityType as string) === 'sapsEntry') {
            if (l.entityId) pendingIds.add(l.entityId);
          }
          if (l.payload?.sapsEntryId) pendingIds.add(l.payload.sapsEntryId);
          if (l.payload?.sapsEntry?.id) pendingIds.add(l.payload.sapsEntry.id);
          if (l.payload?.id && (l.entityType === 'saps' || (l.entityType as string) === 'sapsEntry')) {
            pendingIds.add(l.payload.id);
          }
        }

        const mapped = rows
          .map(sapsApi.mapRowToEntry)
          .filter(entry => !pendingIds.has(entry.id));

        if (mapped.length > 0) {
          await db.saps.bulkPut(mapped);
        }
      }
      setLastSyncedAt(new Date().toISOString());
    } catch (err: any) {
      console.warn('[SapsContext] Cloud SAPS hydration note:', err);
      setHydrationError(err?.message || 'Failed to pull SAPS register entries from cloud.');
    } finally {
      if (activeShopIdRef.current === shopId) {
        setIsHydrating(false);
      }
    }
  }, [shopId, isOnline]);

  useEffect(() => {
    if (shopId) {
      refreshSaps();
    } else {
      setHydrationError(null);
      setIsHydrating(false);
    }
  }, [shopId, refreshSaps]);

  const sapsEntries = useLiveQuery(
    () => shopId ? db.saps.where('shopId').equals(shopId).reverse().sortBy('timestamp') : Promise.resolve([] as SapsEntry[]),
    [shopId]
  ) || [];

  const fuse = useMemo(() => new Fuse(sapsEntries, {
    keys: ['entryNumber', 'customerName', 'customerIdNumber', 'itemDescription', 'serialOrImei'],
    threshold: 0.3
  }), [sapsEntries]);

  const filteredSaps = useMemo(() => {
    if (!searchQuery) return sapsEntries;
    return fuse.search(searchQuery).map(result => result.item);
  }, [searchQuery, sapsEntries, fuse]);

  const addSapsEntry = async (entryData: Omit<SapsEntry, 'id' | 'entryNumber'>) => {
    if (!shopId) throw new Error('Cannot add SAPS entry without active shop context.');
    return await db.transaction('rw', db.saps, db.counters, db.syncLogs, async () => {
      const year = new Date().getFullYear();
      const counterId = `saps-${shopId}-${year}`;
      const counter = await db.counters.get(counterId);
      const nextValue = (counter?.value || 0) + 1;
      
      await db.counters.put({ id: counterId, value: nextValue });
      
      const entryNumber = `SAPS-${year}-${nextValue.toString().padStart(4, '0')}`;
      const id = crypto.randomUUID();
      const newEntry: SapsEntry = { ...entryData, id, entryNumber, shopId };
      
      await db.saps.add(newEntry);
      await queueSyncAction('saps', id, 'create', newEntry);
      return id;
    });
  };

  const cancelSapsEntry = async (id: string, reason: string) => {
    const entry = await db.saps.get(id);
    if (!entry || entry.shopId !== shopId) return;

    const updates = {
      isCancelled: true,
      cancelledAt: new Date().toISOString(),
      cancelReason: reason
    };

    await db.saps.update(id, updates);
    await queueSyncAction('saps', id, 'update', updates);
  };

  const getSapsEntry = async (id: string) => {
    const entry = await db.saps.get(id);
    if (entry && entry.shopId === shopId) return entry;
    return undefined;
  };

  const exportSapsCsv = () => {
    if (sapsEntries.length === 0) return;
    const headers = ['Entry Number', 'Timestamp', 'Status', 'Customer', 'ID Number', 'Item', 'Serial/IMEI', 'Type', 'Amount'];
    const rows = sapsEntries.map(e => [
      e.entryNumber,
      e.timestamp,
      e.isCancelled ? 'CANCELLED' : 'ACTIVE',
      e.customerName,
      e.customerIdNumber,
      e.itemDescription,
      e.serialOrImei,
      e.acquisitionType,
      e.considerationPaid
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SAPS_Register_Export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <SapsContext.Provider value={{
      sapsEntries,
      filteredSaps,
      searchQuery,
      setSearchQuery,
      addSapsEntry,
      cancelSapsEntry,
      getSapsEntry,
      exportSapsCsv,
      refreshSaps,
      syncStatus: {
        isLoading: isHydrating,
        error: hydrationError,
        lastSyncedAt
      }
    }}>
      {children}
    </SapsContext.Provider>
  );
};

export const useSaps = () => {
  const context = useContext(SapsContext);
  if (!context) throw new Error('useSaps must be used within SapsProvider');
  return context;
};
