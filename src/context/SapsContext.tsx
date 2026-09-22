import React, { createContext, useContext, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { SapsEntry } from '../types';
import Fuse from 'fuse.js';
import { useSync } from './SyncContext';

interface SapsContextType {
  sapsEntries: SapsEntry[];
  filteredSaps: SapsEntry[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  addSapsEntry: (entry: Omit<SapsEntry, 'id' | 'entryNumber'>) => Promise<string>;
  getSapsEntry: (id: string) => Promise<SapsEntry | undefined>;
  cancelSapsEntry: (id: string, reason: string) => Promise<void>;
  exportSapsCsv: () => void;
}

const SapsContext = createContext<SapsContextType | undefined>(undefined);

export const SapsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { queueSyncAction } = useSync();
  const [searchQuery, setSearchQuery] = useState('');

  const sapsEntries = useLiveQuery(() => db.saps.orderBy('timestamp').reverse().toArray()) || [];

  const fuse = useMemo(() => new Fuse(sapsEntries, {
    keys: ['entryNumber', 'customerName', 'customerIdNumber', 'itemDescription', 'serialOrImei'],
    threshold: 0.3
  }), [sapsEntries]);

  const filteredSaps = useMemo(() => {
    if (!searchQuery) return sapsEntries;
    return fuse.search(searchQuery).map(result => result.item);
  }, [searchQuery, sapsEntries, fuse]);

  const addSapsEntry = async (entryData: Omit<SapsEntry, 'id' | 'entryNumber'>) => {
    return await db.transaction('rw', db.saps, db.counters, db.syncLogs, async () => {
      const year = new Date().getFullYear();
      const counterId = `saps-${year}`;
      const counter = await db.counters.get(counterId);
      const nextValue = (counter?.value || 0) + 1;
      
      await db.counters.put({ id: counterId, value: nextValue });
      
      const entryNumber = `SAPS-${year}-${nextValue.toString().padStart(4, '0')}`;
      const id = crypto.randomUUID();
      const newEntry: SapsEntry = { ...entryData, id, entryNumber };
      
      await db.saps.add(newEntry);
      await queueSyncAction('saps', id, 'create', newEntry);
      return id;
    });
  };

  const cancelSapsEntry = async (id: string, reason: string) => {
    const entry = await db.saps.get(id);
    if (!entry) return;

    const updates = {
      isCancelled: true,
      cancelledAt: new Date().toISOString(),
      cancelReason: reason
    };

    await db.saps.update(id, updates);
    await queueSyncAction('saps', id, 'update', updates);
  };

  const getSapsEntry = async (id: string) => {
    return await db.saps.get(id);
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
      exportSapsCsv
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
