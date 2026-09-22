import React, { createContext, useContext, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { SaleTransaction } from '../types';
import Fuse from 'fuse.js';
import { useSync } from './SyncContext';

interface SalesContextType {
  salesHistory: SaleTransaction[];
  filteredSales: SaleTransaction[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  recordSale: (sale: Omit<SaleTransaction, 'id'>) => Promise<string>;
}

const SalesContext = createContext<SalesContextType | undefined>(undefined);

export const SalesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { queueSyncAction } = useSync();
  const [searchQuery, setSearchQuery] = useState('');

  const salesHistory = useLiveQuery(() => db.sales.orderBy('timestamp').reverse().toArray()) || [];

  const fuse = useMemo(() => new Fuse(salesHistory, {
    keys: ['receiptNumber', 'customerMobile', 'items.item.title'],
    threshold: 0.3
  }), [salesHistory]);

  const filteredSales = useMemo(() => {
    if (!searchQuery) return salesHistory;
    return fuse.search(searchQuery).map(result => result.item);
  }, [searchQuery, salesHistory, fuse]);

  const recordSale = async (saleData: Omit<SaleTransaction, 'id'>) => {
    const id = crypto.randomUUID();
    const newSale = { ...saleData, id };
    await db.sales.add(newSale);
    await queueSyncAction('sales', id, 'create', newSale);
    return id;
  };

  return (
    <SalesContext.Provider value={{
      salesHistory,
      filteredSales,
      searchQuery,
      setSearchQuery,
      recordSale
    }}>
      {children}
    </SalesContext.Provider>
  );
};

export const useSales = () => {
  const context = useContext(SalesContext);
  if (!context) throw new Error('useSales must be used within SalesProvider');
  return context;
};
