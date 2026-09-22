import React, { useEffect } from 'react';
import { SyncProvider } from './SyncContext';
import { InventoryProvider } from './InventoryContext';
import { LoanProvider } from './LoanContext';
import { CustomerProvider } from './CustomerContext';
import { SellerProvider } from './SellerContext';
import { SapsProvider } from './SapsContext';
import { SalesProvider } from './SalesContext';
import { AuthProvider } from './AuthContext';
import { seedDatabase } from '../db';
import { runMigration } from '../db/migration';
import { 
  INITIAL_INVENTORY, 
  INITIAL_CUSTOMERS, 
  INITIAL_PAWN_LOANS, 
  INITIAL_SAPS_REGISTER 
} from '../data/initialData';

export const CompositeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useEffect(() => {
    const init = async () => {
      await runMigration();
      await seedDatabase(
        INITIAL_INVENTORY,
        INITIAL_CUSTOMERS,
        INITIAL_PAWN_LOANS,
        INITIAL_SAPS_REGISTER
      );
    };
    init().catch(console.error);
  }, []);

  return (
    <AuthProvider>
      <SyncProvider>
        <InventoryProvider>
          <LoanProvider>
            <CustomerProvider>
              <SellerProvider>
                <SapsProvider>
                  <SalesProvider>
                    {children}
                  </SalesProvider>
                </SapsProvider>
              </SellerProvider>
            </CustomerProvider>
          </LoanProvider>
        </InventoryProvider>
      </SyncProvider>
    </AuthProvider>
  );
};
