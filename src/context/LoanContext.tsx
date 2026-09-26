import React, { createContext, useContext, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { PawnLoan, LoanStatus } from '../types';
import Fuse from 'fuse.js';
import { useSync } from './SyncContext';
import { useInventory } from './InventoryContext';

import { useAuth } from './AuthContext';

interface LoanContextType {
  loans: PawnLoan[];
  filteredLoans: PawnLoan[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  createLoan: (loanData: Omit<PawnLoan, 'id'>) => Promise<string>;
  updateLoan: (id: string, updates: Partial<PawnLoan>) => Promise<void>;
  getLoanByTicket: (ticket: string) => Promise<PawnLoan | undefined>;
  redeemLoan: (ticketNumber: string, amount: number) => Promise<{ success: boolean; error?: string }>;
  extendLoan: (ticketNumber: string, fee: number) => Promise<{ success: boolean; error?: string }>;
  archiveLoan: (id: string) => Promise<void>;
  transferOverdueToFloor: (ticketNumber: string, retailPrice: number) => Promise<{ success: boolean; error?: string }>;
  approveForfeiture: (id: string, retailPrice: number) => Promise<{ success: boolean; error?: string }>;
  rejectForfeiture: (id: string) => Promise<{ success: boolean; error?: string }>;
  batchTransferOverdue: () => Promise<{ success: boolean; count: number; error?: string }>;
  batchApproveForfeitures: (ids: string[]) => Promise<{ success: boolean; count: number; error?: string }>;
}

const LoanContext = createContext<LoanContextType | undefined>(undefined);

export const LoanProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { queueSyncAction } = useSync();
  const { updateItem } = useInventory();
  const { shopId } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');

  const rawLoans = useLiveQuery(
    () => shopId ? db.loans.where('shopId').equals(shopId).sortBy('expiryDate') : Promise.resolve([] as PawnLoan[]),
    [shopId]
  ) || [];

  const loans = useMemo(() => {
    const now = new Date();
    
    return rawLoans.map(loan => {
      const start = new Date(loan.startDate);
      const expiry = new Date(loan.expiryDate);
      
      // Derive remaining days
      const diffRemaining = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      // Derive elapsed days
      const diffElapsed = Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      
      return {
        ...loan,
        daysRemaining: diffRemaining,
        daysElapsed: diffElapsed
      };
    });
  }, [rawLoans]);

  const fuse = useMemo(() => new Fuse(loans, {
    keys: ['ticketNumber', 'customerName', 'customerIdNumber', 'itemTitle'],
    threshold: 0.3
  }), [loans]);

  const filteredLoans = useMemo(() => {
    if (!searchQuery) return loans;
    return fuse.search(searchQuery).map(result => result.item);
  }, [searchQuery, loans, fuse]);

  const createLoan = async (loanData: Omit<PawnLoan, 'id'>) => {
    if (!shopId) throw new Error('Cannot create loan without active shop context.');
    const id = crypto.randomUUID();
    const newLoan = { ...loanData, id, shopId };
    await db.loans.add(newLoan);
    await queueSyncAction('loans', id, 'create', newLoan);
    return id;
  };

  const updateLoan = async (id: string, updates: Partial<PawnLoan>) => {
    const loan = await db.loans.get(id);
    if (!loan || loan.shopId !== shopId) {
      throw new Error('Access Denied: Loan record does not belong to this shop.');
    }
    await db.loans.update(id, updates);
    await queueSyncAction('loans', id, 'update', updates);
  };

  const getLoanByTicket = async (ticket: string) => {
    if (!shopId) return undefined;
    return await db.loans.where('shopId').equals(shopId).and(l => l.ticketNumber === ticket).first();
  };

  const redeemLoan = async (ticketNumber: string, amount: number) => {
    if (!shopId) return { success: false, error: 'No active shop context.' };
    return await db.transaction('rw', db.loans, db.inventory, db.syncLogs, async () => {
      const loan = await db.loans.where('shopId').equals(shopId).and(l => l.ticketNumber === ticketNumber).first();
      if (!loan) return { success: false, error: 'Loan not found' };

      const item = await db.inventory.get(loan.itemId);
      if (!item || item.shopId !== shopId) {
        return { success: false, error: 'Access Denied: Loan item does not belong to this shop.' };
      }

      const now = new Date().toISOString();
      const updatedHistory = [
        ...loan.history,
        {
          date: now.replace('T', ' ').slice(0, 16),
          action: 'Full Redemption' as const,
          amount: amount,
          note: `Loan redeemed in full. Item returned to customer.`
        }
      ];

      await db.loans.update(loan.id, {
        status: 'Redeemed',
        history: updatedHistory
      });

      await db.inventory.update(loan.itemId, {
        status: 'Redeemed'
      });

      await queueSyncAction('loans', loan.id, 'update', { status: 'Redeemed', history: updatedHistory });
      await queueSyncAction('inventory', loan.itemId, 'update', { status: 'Redeemed' });

      return { success: true };
    }).catch(err => {
      console.error('Redemption transaction failed:', err);
      return { success: false, error: err.message };
    });
  };

  const extendLoan = async (ticketNumber: string, fee: number) => {
    if (!shopId) return { success: false, error: 'No active shop context.' };
    return await db.transaction('rw', db.loans, db.syncLogs, async () => {
      const loan = await db.loans.where('shopId').equals(shopId).and(l => l.ticketNumber === ticketNumber).first();
      if (!loan) return { success: false, error: 'Loan not found' };

      const now = new Date();
      const currentExpiry = new Date(loan.expiryDate);
      const nextExpiry = new Date(currentExpiry.setDate(currentExpiry.getDate() + 30)).toISOString().split('T')[0];
      
      const updatedHistory = [
        ...loan.history,
        {
          date: new Date().toISOString().replace('T', ' ').slice(0, 16),
          action: 'Extension' as const,
          amount: fee,
          note: `Loan extended for 30 days. New expiry: ${nextExpiry}`
        }
      ];

      await db.loans.update(loan.id, {
        expiryDate: nextExpiry,
        history: updatedHistory
      });

      await queueSyncAction('loans', loan.id, 'update', { expiryDate: nextExpiry, history: updatedHistory });
      return { success: true };
    }).catch(err => {
      console.error('Extension transaction failed:', err);
      return { success: false, error: err.message };
    });
  };

  const archiveLoan = async (id: string) => {
    const loan = await db.loans.get(id);
    if (!loan || loan.shopId !== shopId) {
      throw new Error('Access Denied: Loan record does not belong to this shop.');
    }
    await db.loans.update(id, { status: 'Archived' });
    await queueSyncAction('loans', id, 'update', { status: 'Archived' });
  };

  const transferOverdueToFloor = async (ticketNumber: string, retailPrice: number) => {
    if (!shopId) return { success: false, error: 'No active shop context.' };
    return await db.transaction('rw', db.loans, db.inventory, db.syncLogs, async () => {
      const loan = await db.loans.where('shopId').equals(shopId).and(l => l.ticketNumber === ticketNumber).first();
      if (!loan) return { success: false, error: 'Loan not found' };

      const item = await db.inventory.get(loan.itemId);
      if (!item || item.shopId !== shopId) {
        return { success: false, error: 'Access Denied: Loan item does not belong to this shop.' };
      }

      const updates = { 
        status: 'Pending Forfeit' as LoanStatus,
        retailPrice // Temporary store for review
      };

      await db.loans.update(loan.id, updates);
      await db.inventory.update(loan.itemId, { 
        status: 'Pending Forfeit'
      });

      await queueSyncAction('loans', loan.id, 'update', updates);
      await queueSyncAction('inventory', loan.itemId, 'update', { status: 'Pending Forfeit' });

      return { success: true };
    }).catch(err => ({ success: false, error: err.message }));
  };

  const approveForfeiture = async (id: string, retailPrice: number) => {
    return await db.transaction('rw', db.loans, db.inventory, db.syncLogs, async () => {
      const loan = await db.loans.get(id);
      if (!loan || loan.shopId !== shopId) return { success: false, error: 'Loan not found' };

      const historyEntry = {
        date: new Date().toISOString().replace('T', ' ').slice(0, 16),
        action: 'Forfeited to Floor' as const,
        amount: 0,
        note: `Forfeiture approved by manager. Retail price set to ${retailPrice}`
      };

      await db.loans.update(loan.id, { 
        status: 'Forfeited',
        history: [...loan.history, historyEntry]
      });

      await db.inventory.update(loan.itemId, { 
        status: 'Retail Floor',
        retailPrice,
        acquisitionType: 'Forfeited'
      });

      await queueSyncAction('loans', loan.id, 'update', { status: 'Forfeited' });
      await queueSyncAction('inventory', loan.itemId, 'update', { 
        status: 'Retail Floor',
        retailPrice,
        acquisitionType: 'Forfeited'
      });

      return { success: true };
    }).catch(err => ({ success: false, error: err.message }));
  };

  const rejectForfeiture = async (id: string) => {
    return await db.transaction('rw', db.loans, db.inventory, db.syncLogs, async () => {
      const loan = await db.loans.get(id);
      if (!loan || loan.shopId !== shopId) return { success: false, error: 'Loan not found' };

      await db.loans.update(loan.id, { status: 'Active' });
      await db.inventory.update(loan.itemId, { status: 'Vault Hold' });

      await queueSyncAction('loans', loan.id, 'update', { status: 'Active' });
      await queueSyncAction('inventory', loan.itemId, 'update', { status: 'Vault Hold' });

      return { success: true };
    }).catch(err => ({ success: false, error: err.message }));
  };

  const batchTransferOverdue = async () => {
    if (!shopId) return { success: false, count: 0, error: 'No active shop context.' };
    const now = new Date().toISOString().split('T')[0];
    const overdueLoans = await db.loans
      .where('shopId').equals(shopId)
      .and(l => l.status === 'Active' && l.expiryDate < now)
      .toArray();

    if (overdueLoans.length === 0) return { success: true, count: 0 };

    let count = 0;
    for (const loan of overdueLoans) {
      const res = await transferOverdueToFloor(loan.ticketNumber, loan.principal * 2);
      if (res.success) count++;
    }

    return { success: true, count };
  };

  const batchApproveForfeitures = async (ids: string[]) => {
    let count = 0;
    for (const id of ids) {
      const loan = await db.loans.get(id);
      if (loan && loan.shopId === shopId) {
        const res = await approveForfeiture(id, (loan as any).retailPrice || loan.principal * 2);
        if (res.success) count++;
      }
    }
    return { success: true, count };
  };

  return (
    <LoanContext.Provider value={{
      loans,
      filteredLoans,
      searchQuery,
      setSearchQuery,
      createLoan,
      updateLoan,
      getLoanByTicket,
      redeemLoan,
      extendLoan,
      archiveLoan,
      approveForfeiture,
      rejectForfeiture,
      batchApproveForfeitures,
      transferOverdueToFloor,
      batchTransferOverdue
    }}>
      {children}
    </LoanContext.Provider>
  );
};

export const useLoans = () => {
  const context = useContext(LoanContext);
  if (!context) throw new Error('useLoans must be used within LoanProvider');
  return context;
};
