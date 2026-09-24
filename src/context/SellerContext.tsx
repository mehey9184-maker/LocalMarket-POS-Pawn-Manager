import React, { createContext, useContext, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Seller, SellerTransaction, SellerTransactionStatus, SellerPaymentStatus, SellerReversalRecord } from '../types';
import Fuse from 'fuse.js';
import { useSync } from './SyncContext';
import { generateUniqueTransactionNumber } from '../utils/identifierGenerator';

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
  addSellerTransaction: (tx: Omit<SellerTransaction, 'id' | 'transactionNumber'> & { transactionNumber?: string }) => Promise<string>;
  updateSellerTransactionStatus: (txId: string, status: SellerTransactionStatus, paymentStatus?: SellerPaymentStatus) => Promise<void>;
  reverseSellerAcquisition: (txId: string, itemId: string, reason: string, actorId: string, actorName: string, approvingManagerId: string) => Promise<boolean>;
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

  const addSellerTransaction = async (txData: Omit<SellerTransaction, 'id' | 'transactionNumber'> & { transactionNumber?: string }) => {
    const id = crypto.randomUUID();
    let transactionNumber = txData.transactionNumber;
    if (!transactionNumber) {
      const existing = await db.sellerTransactions.toArray();
      const existingSet = new Set(existing.map(t => t.transactionNumber));
      transactionNumber = generateUniqueTransactionNumber(tn => existingSet.has(tn));
    }
    const newTx: SellerTransaction = { 
      ...txData, 
      id, 
      transactionNumber,
      status: txData.status || 'Draft',
      paymentStatus: txData.paymentStatus || 'Pending',
      complianceStatus: txData.complianceStatus || 'PENDING'
    };
    
    await db.sellerTransactions.add(newTx);
    
    // Also add items to the new relation table if present
    if (newTx.items && newTx.items.length > 0) {
      const itemsWithIds = newTx.items.map(item => ({
        ...item,
        id: item.id || crypto.randomUUID(),
        sellerTransactionId: id
      }));
      await db.sellerTransactionItems.bulkAdd(itemsWithIds);
    }
    
    await queueSyncAction('sellerTransactions', id, 'create', newTx);
    return id;
  };

  const updateSellerTransactionStatus = async (txId: string, status: SellerTransactionStatus, paymentStatus?: SellerPaymentStatus) => {
    const updates: any = { status };
    if (paymentStatus) updates.paymentStatus = paymentStatus;
    await db.sellerTransactions.update(txId, updates);
    await queueSyncAction('sellerTransactions', txId, 'update', updates);
  };

  const reverseSellerAcquisition = async (
    txId: string, 
    itemId: string, 
    reason: string, 
    actorId: string, 
    actorName: string, 
    approvingManagerId: string
  ): Promise<boolean> => {
    if (actorId && approvingManagerId && actorId === approvingManagerId) {
      throw new Error('Self-Approval Forbidden: Staff member cannot approve their own acquisition reversal.');
    }

    const tx = await db.sellerTransactions.get(txId);
    if (!tx) throw new Error('Seller transaction not found.');

    const item = await db.inventory.get(itemId);
    if (!item) throw new Error('Item not found in inventory.');

    const reversalId = crypto.randomUUID();
    const reversalRecord: SellerReversalRecord = {
      id: reversalId,
      shopId: tx.shopId || 'default-shop',
      sellerTransactionId: txId,
      itemId,
      sellerId: tx.sellerId,
      originalPayout: item.costBasis,
      reversalAmount: item.costBasis,
      reason,
      actorId,
      actorName,
      approvedBy: approvingManagerId,
      timestamp: new Date().toISOString(),
      resultingInventoryStatus: 'Returned',
      resultingPaymentStatus: 'Reversed'
    };

    await db.sellerReversals.add(reversalRecord);
    await db.inventory.update(itemId, { status: 'Returned', stockLocation: 'Returned / Quarantined' });

    await queueSyncAction('sellerReversals', reversalId, 'create', reversalRecord);
    await queueSyncAction('inventory', itemId, 'update', { status: 'Returned' });
    return true;
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
      addSellerTransaction,
      updateSellerTransactionStatus,
      reverseSellerAcquisition
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
