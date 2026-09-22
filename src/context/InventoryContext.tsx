import React, { createContext, useContext, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { InventoryItem, ItemStatus } from '../types';
import Fuse from 'fuse.js';
import { useSync } from './SyncContext';

interface InventoryContextType {
  inventory: InventoryItem[];
  filteredInventory: InventoryItem[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  addItem: (item: Omit<InventoryItem, 'id' | 'addedAt'>) => Promise<string>;
  updateItem: (id: string, updates: Partial<InventoryItem>) => Promise<void>;
  getItem: (id: string) => Promise<InventoryItem | undefined>;
  getInventoryByStatus: (status: ItemStatus) => InventoryItem[];
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

export const InventoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { queueSyncAction } = useSync();
  const [searchQuery, setSearchQuery] = useState('');
  
  const inventory = useLiveQuery(() => db.inventory.orderBy('addedAt').reverse().toArray()) || [];

  const fuse = useMemo(() => new Fuse(inventory, {
    keys: ['title', 'sku', 'serialOrImei', 'specs'],
    threshold: 0.3,
    distance: 100
  }), [inventory]);

  const filteredInventory = useMemo(() => {
    if (!searchQuery) return inventory;
    return fuse.search(searchQuery).map(result => result.item);
  }, [searchQuery, inventory, fuse]);

  const addItem = async (itemData: Omit<InventoryItem, 'id' | 'addedAt'>) => {
    const id = crypto.randomUUID();
    const newItem: InventoryItem = {
      ...itemData,
      id,
      addedAt: new Date().toISOString()
    };
    
    await db.inventory.add(newItem);
    await queueSyncAction('inventory', id, 'create', newItem);
    return id;
  };

  const updateItem = async (id: string, updates: Partial<InventoryItem>) => {
    await db.inventory.update(id, updates);
    await queueSyncAction('inventory', id, 'update', updates);
  };

  const getItem = async (id: string) => {
    return await db.inventory.get(id);
  };

  const getInventoryByStatus = (status: ItemStatus) => {
    return inventory.filter(i => i.status === status);
  };

  return (
    <InventoryContext.Provider value={{
      inventory,
      filteredInventory,
      searchQuery,
      setSearchQuery,
      addItem,
      updateItem,
      getItem,
      getInventoryByStatus
    }}>
      {children}
    </InventoryContext.Provider>
  );
};

export const useInventory = () => {
  const context = useContext(InventoryContext);
  if (!context) throw new Error('useInventory must be used within InventoryProvider');
  return context;
};
