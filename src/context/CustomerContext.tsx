import React, { createContext, useContext, useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Customer } from '../types';
import Fuse from 'fuse.js';
import { useSync } from './SyncContext';
import { useAuth } from './AuthContext';
import { isSupabaseConfigured } from '../services/supabase';
import { customersApi } from '../services/supabaseApi';

export interface CustomerSyncStatus {
  isLoading: boolean;
  error: string | null;
  lastSyncedAt: string | null;
}

interface CustomerContextType {
  customers: Customer[];
  filteredCustomers: Customer[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  addCustomer: (customer: Omit<Customer, 'id' | 'createdAt'>) => Promise<string>;
  updateCustomer: (id: string, updates: Partial<Customer>) => Promise<void>;
  getCustomerById: (id: string) => Promise<Customer | undefined>;
  getCustomerByIdNumber: (idNumber: string) => Promise<Customer | undefined>;
  refreshCustomers: () => Promise<void>;
  syncStatus: CustomerSyncStatus;
}

const CustomerContext = createContext<CustomerContextType | undefined>(undefined);

export const CustomerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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

  const refreshCustomers = useCallback(async () => {
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
      const rows = await customersApi.getCustomers({ shopId });
      if (activeShopIdRef.current !== shopId) return;

      if (rows && rows.length > 0) {
        // Collect IDs of pending local mutations from outbox to prevent overwriting in-flight work
        const pendingLogs = await db.syncLogs
          .where('status')
          .anyOf('pending', 'syncing', 'failed')
          .and(l => l.shopId === shopId && (l.entityType === 'customers' || (l.entityType as string) === 'customer'))
          .toArray();
        const pendingIds = new Set<string>();
        for (const l of pendingLogs) {
          if (l.entityId) pendingIds.add(l.entityId);
          if (l.payload?.id) pendingIds.add(l.payload.id);
          if (l.payload?.customerId) pendingIds.add(l.payload.customerId);
        }

        const mapped = rows
          .map(customersApi.mapRowToCustomer)
          .filter(c => !pendingIds.has(c.id));

        if (mapped.length > 0) {
          await db.customers.bulkPut(mapped);
        }
      }
      setLastSyncedAt(new Date().toISOString());
    } catch (err: any) {
      console.warn('[CustomerContext] Cloud customer hydration note:', err);
      setHydrationError(err?.message || 'Failed to pull customer records from cloud.');
    } finally {
      if (activeShopIdRef.current === shopId) {
        setIsHydrating(false);
      }
    }
  }, [shopId, isOnline]);

  useEffect(() => {
    if (shopId) {
      refreshCustomers();
    } else {
      setHydrationError(null);
      setIsHydrating(false);
    }
  }, [shopId, refreshCustomers]);

  const customers = useLiveQuery(
    () => shopId ? db.customers.where('shopId').equals(shopId).sortBy('fullName') : Promise.resolve([] as Customer[]),
    [shopId]
  ) || [];

  const fuse = useMemo(() => new Fuse(customers, {
    keys: ['fullName', 'idNumber', 'mobile'],
    threshold: 0.3
  }), [customers]);

  const filteredCustomers = useMemo(() => {
    if (!searchQuery) return customers;
    return fuse.search(searchQuery).map(result => result.item);
  }, [searchQuery, customers, fuse]);

  const addCustomer = async (customerData: Omit<Customer, 'id' | 'createdAt'>) => {
    if (!shopId) throw new Error('Cannot add customer without active shop context.');
    const id = crypto.randomUUID();
    const newCustomer = {
      ...customerData,
      id,
      shopId,
      createdAt: new Date().toISOString()
    };
    await db.customers.add(newCustomer);
    await queueSyncAction('customers', id, 'create', newCustomer);
    return id;
  };

  const updateCustomer = async (id: string, updates: Partial<Customer>) => {
    const customer = await db.customers.get(id);
    if (!customer || customer.shopId !== shopId) {
      throw new Error('Access Denied: Customer record does not belong to this shop.');
    }
    await db.customers.update(id, updates);
    await queueSyncAction('customers', id, 'update', updates);
  };

  const getCustomerById = async (id: string) => {
    const customer = await db.customers.get(id);
    if (customer && customer.shopId === shopId) return customer;
    return undefined;
  };

  const getCustomerByIdNumber = async (idNumber: string) => {
    if (!shopId) return undefined;
    return await db.customers.where('shopId').equals(shopId).and(c => c.idNumber === idNumber).first();
  };

  return (
    <CustomerContext.Provider value={{
      customers,
      filteredCustomers,
      searchQuery,
      setSearchQuery,
      addCustomer,
      updateCustomer,
      getCustomerById,
      getCustomerByIdNumber,
      refreshCustomers,
      syncStatus: {
        isLoading: isHydrating,
        error: hydrationError,
        lastSyncedAt
      }
    }}>
      {children}
    </CustomerContext.Provider>
  );
};

export const useCustomers = () => {
  const context = useContext(CustomerContext);
  if (!context) throw new Error('useCustomers must be used within CustomerProvider');
  return context;
};

