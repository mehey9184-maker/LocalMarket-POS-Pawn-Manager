import React, { createContext, useContext, useMemo, useState, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { InventoryItem, ItemStatus } from '../types';
import Fuse from 'fuse.js';
import { useSync } from './SyncContext';
import { useAuth } from './AuthContext';
import { shopItemsApi, logsApi, isSupabaseConfigured, SystemLogRow } from '../services/supabaseApi';

export interface PriceChangeRecord {
  id: string;
  itemId: string;
  oldPrice: number;
  newPrice: number;
  actorName: string;
  reason: string;
  timestamp: string;
}

interface InventoryContextType {
  inventory: InventoryItem[];
  filteredInventory: InventoryItem[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  addItem: (item: Omit<InventoryItem, 'id' | 'addedAt'>) => Promise<string>;
  updateItem: (id: string, updates: Partial<InventoryItem>) => Promise<void>;
  changePermanentRetailPrice: (id: string, newPrice: number, reason?: string) => Promise<{ success: boolean; error?: string }>;
  getItem: (id: string) => Promise<InventoryItem | undefined>;
  getInventoryByStatus: (status: ItemStatus) => InventoryItem[];
  priceChangeLogs: SystemLogRow[];
  fetchPriceChangeLogs: () => Promise<void>;
  getPriceChangeHistory: (itemId: string) => PriceChangeRecord[];
}

export const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

export const InventoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { queueSyncAction, isOnline } = useSync();
  const { isManager, isOwner, hasPermission, shopId } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [priceChangeLogs, setPriceChangeLogs] = useState<SystemLogRow[]>([]);

  const fetchPriceChangeLogs = useCallback(async () => {
    if (!isSupabaseConfigured() || !shopId) return;
    try {
      const logs = await logsApi.getPriceChangeLogs({ shopId });
      setPriceChangeLogs(logs);
    } catch {
      // Permission-safe fallback
    }
  }, [shopId]);

  useEffect(() => {
    fetchPriceChangeLogs();
  }, [fetchPriceChangeLogs]);

  const getPriceChangeHistory = useCallback((itemId: string): PriceChangeRecord[] => {
    return priceChangeLogs
      .filter(log => {
        const details = log.details as Record<string, any> | null;
        return details?.item_id === itemId;
      })
      .map(log => {
        const details = log.details as Record<string, any> | null;
        return {
          id: log.id,
          itemId,
          oldPrice: Number(details?.old_price ?? 0),
          newPrice: Number(details?.new_price ?? 0),
          actorName: log.actor_name || 'Staff Member',
          reason: details?.reason || 'Price adjustment',
          timestamp: log.created_at
        };
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [priceChangeLogs]);
  
  const inventory = useLiveQuery(
    () => shopId ? db.inventory.where('shopId').equals(shopId).reverse().sortBy('addedAt') : Promise.resolve([] as InventoryItem[]),
    [shopId]
  ) || [];

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
    if (!shopId) throw new Error('Cannot add item without active shop context.');
    const id = crypto.randomUUID();
    const newItem: InventoryItem = {
      ...itemData,
      id,
      shopId,
      addedAt: new Date().toISOString()
    };
    
    await db.inventory.add(newItem);
    await queueSyncAction('inventory', id, 'create', newItem);
    return id;
  };

  const updateItem = async (id: string, updates: Partial<InventoryItem>) => {
    const item = await db.inventory.get(id);
    if (!item || item.shopId !== shopId) {
      throw new Error('Access Denied: Inventory item does not belong to this shop.');
    }
    await db.inventory.update(id, updates);
    await queueSyncAction('inventory', id, 'update', updates);
  };

  const changePermanentRetailPrice = async (
    id: string, 
    newPrice: number, 
    reason?: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!hasPermission('pricing')) {
      return { success: false, error: 'Unauthorized: You do not have permission to alter retail prices.' };
    }

    if (newPrice < 0) {
      return { success: false, error: 'Retail price cannot be negative.' };
    }

    // If online, invoke the Supabase RPC first
    if (isOnline && isSupabaseConfigured()) {
      const res = await shopItemsApi.changeRetailPriceRpc(id, newPrice, reason);
      if (!res.success) {
        return { success: false, error: res.error || 'Server rejected price change.' };
      }
    }

    // Update local Dexie once authorized / confirmed
    const item = await db.inventory.get(id);
    if (item && item.shopId === shopId) {
      await db.inventory.update(id, { retailPrice: newPrice });
    } else if (item) {
      return { success: false, error: 'Access Denied: Inventory item does not belong to this shop.' };
    }

    // If offline, queue sync action
    if (!isOnline || !isSupabaseConfigured()) {
      await queueSyncAction('inventory', id, 'update', { retailPrice: newPrice });
      // Add local synthetic log for instant offline visibility
      const syntheticLog: SystemLogRow = {
        id: crypto.randomUUID(),
        event_type: 'RETAIL_PRICE_UPDATED',
        severity: 'audit',
        actor_id: null,
        actor_name: 'Current Staff',
        details: {
          item_id: id,
          old_price: item?.retailPrice ?? 0,
          new_price: newPrice,
          reason: reason || 'Manager Price Adjustment'
        },
        saps_reference: null,
        ip_address: null,
        created_at: new Date().toISOString(),
        shop_id: shopId || null
      };
      setPriceChangeLogs(prev => [syntheticLog, ...prev]);
    } else {
      await fetchPriceChangeLogs();
    }

    return { success: true };
  };

  const getItem = async (id: string) => {
    const item = await db.inventory.get(id);
    if (item && item.shopId === shopId) return item;
    return undefined;
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
      changePermanentRetailPrice,
      getItem,
      getInventoryByStatus,
      priceChangeLogs,
      fetchPriceChangeLogs,
      getPriceChangeHistory
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
