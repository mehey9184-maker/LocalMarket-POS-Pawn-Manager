import React, { createContext, useContext, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Seller, SellerTransaction } from '../types';
import Fuse from 'fuse.js';
import { useSync } from './SyncContext';

interface SellerContextType {
  sellers: Seller[];
  filteredSellers: Seller[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  addSeller: (seller: Omit<Seller, 'id' | 'createdAt'>) => Promise<string>;
  updateSeller: (id: string, updates: Partial<Seller>) => Promise<void>;
  getSellerById: (id: string) => Promise<Seller | undefined>;
  getSellerByIdNumber: (idNumber: string) => Promise<Seller | undefined>;
  getSellerTransactions: (sellerId: string) => Promise<SellerTransaction[]>;
  addSellerTransaction: (tx: Omit<SellerTransaction, 'id'>) => Promise<string>;
}

const SellerContext = createContext<SellerContextType | undefined>(undefined);

export const SellerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { queueSyncAction } = useSync();
  const [searchQuery, setSearchQuery] = useState('');

  const sellers = useLiveQuery(() => db.sellers.orderBy('fullName').toArray()) || [];

  const fuse = useMemo(() => new Fuse(sellers, {
    keys: ['fullName', 'idNumber', 'mobile'],
    threshold: 0.3
  }), [sellers]);

  const filteredSellers = useMemo(() => {
    if (!searchQuery) return sellers;
    return fuse.search(searchQuery).map(result => result.item);
  }, [searchQuery, sellers, fuse]);

  const addSeller = async (sellerData: Omit<Seller, 'id' | 'createdAt'>) => {
    const id = crypto.randomUUID();
    const newSeller = {
      ...sellerData,
      id,
      createdAt: new Date().toISOString()
    };
    await db.sellers.add(newSeller);
    await queueSyncAction('sellers', id, 'create', newSeller);
    return id;
  };

  const updateSeller = async (id: string, updates: Partial<Seller>) => {
    await db.sellers.update(id, updates);
    await queueSyncAction('sellers', id, 'update', updates);
  };

  const getSellerById = async (id: string) => {
    return await db.sellers.get(id);
  };

  const getSellerByIdNumber = async (idNumber: string) => {
    return await db.sellers.where('idNumber').equals(idNumber).first();
  };

  const getSellerTransactions = async (sellerId: string) => {
    return await db.sellerTransactions.where('sellerId').equals(sellerId).reverse().sortBy('timestamp');
  };

  const addSellerTransaction = async (txData: Omit<SellerTransaction, 'id'>) => {
    const id = crypto.randomUUID();
    const newTx = { ...txData, id };
    await db.sellerTransactions.add(newTx);
    await queueSyncAction('sellerTransactions', id, 'create', newTx);
    return id;
  };

  return (
    <SellerContext.Provider value={{
      sellers,
      filteredSellers,
      searchQuery,
      setSearchQuery,
      addSeller,
      updateSeller,
      getSellerById,
      getSellerByIdNumber,
      getSellerTransactions,
      addSellerTransaction
    }}>
      {children}
    </SellerContext.Provider>
  );
};

export const useSellers = () => {
  const context = useContext(SellerContext);
  if (!context) throw new Error('useSellers must be used within SellerProvider');
  return context;
};
