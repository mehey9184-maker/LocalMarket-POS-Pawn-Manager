import React, { createContext, useContext, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Customer } from '../types';
import Fuse from 'fuse.js';
import { useSync } from './SyncContext';

interface CustomerContextType {
  customers: Customer[];
  filteredCustomers: Customer[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  addCustomer: (customer: Omit<Customer, 'id' | 'createdAt'>) => Promise<string>;
  updateCustomer: (id: string, updates: Partial<Customer>) => Promise<void>;
  getCustomerById: (id: string) => Promise<Customer | undefined>;
  getCustomerByIdNumber: (idNumber: string) => Promise<Customer | undefined>;
}

const CustomerContext = createContext<CustomerContextType | undefined>(undefined);

export const CustomerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { queueSyncAction } = useSync();
  const [searchQuery, setSearchQuery] = useState('');

  const customers = useLiveQuery(() => db.customers.orderBy('fullName').toArray()) || [];

  const fuse = useMemo(() => new Fuse(customers, {
    keys: ['fullName', 'idNumber', 'mobile'],
    threshold: 0.3
  }), [customers]);

  const filteredCustomers = useMemo(() => {
    if (!searchQuery) return customers;
    return fuse.search(searchQuery).map(result => result.item);
  }, [searchQuery, customers, fuse]);

  const addCustomer = async (customerData: Omit<Customer, 'id' | 'createdAt'>) => {
    const id = crypto.randomUUID();
    const newCustomer = {
      ...customerData,
      id,
      createdAt: new Date().toISOString()
    };
    await db.customers.add(newCustomer);
    await queueSyncAction('customers', id, 'create', newCustomer);
    return id;
  };

  const updateCustomer = async (id: string, updates: Partial<Customer>) => {
    await db.customers.update(id, updates);
    await queueSyncAction('customers', id, 'update', updates);
  };

  const getCustomerById = async (id: string) => {
    return await db.customers.get(id);
  };

  const getCustomerByIdNumber = async (idNumber: string) => {
    return await db.customers.where('idNumber').equals(idNumber).first();
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
      getCustomerByIdNumber
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
