/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/Header';
import { Toast } from './components/Toast';
import { Home } from './components/screens/Home';
import { Sell } from './components/screens/Sell';
import { BuyPawn } from './components/screens/BuyPawn';
import { Inventory } from './components/screens/Inventory';
import { Customers } from './components/screens/Customers';
import { CashierProfile } from './components/screens/CashierProfile';
import { VaultManager } from './components/screens/VaultManager';
import { SapsRegister } from './components/screens/SapsRegister';
import { LandingPage } from './components/screens/LandingPage';
import { AuthPage } from './components/screens/AuthPage';
import { AccountPicker } from './components/auth/AccountPicker';
import { ScannerModal } from './components/modals/ScannerModal';
import { ReceiptModal } from './components/modals/ReceiptModal';
import { ContractModal } from './components/modals/ContractModal';

import { CompositeProvider } from './context/CompositeProvider';

import { useAuth } from './context/AuthContext';

const MainLayout: React.FC = () => {
  const { activeTab, setActiveTab } = useApp();
  const { user, isLoading: authLoading } = useAuth();

  // Session-based navigation enforcement
  React.useEffect(() => {
    if (authLoading) return;

    const isEmailConfirmed = user?.email_confirmed_at || user?.confirmed_at;

    if (user && isEmailConfirmed && (activeTab === 'landing' || activeTab === 'auth')) {
      setActiveTab('home');
    } else if (!user && activeTab !== 'auth') {
      setActiveTab('auth');
    }
  }, [user, authLoading, activeTab, setActiveTab]);

  if (authLoading) {
    return (
      <div className="h-screen w-screen bg-[#F5F6F8] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-[#C85A32] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-500 font-mono text-xs uppercase tracking-wider animate-pulse">Starting LocalMarket...</p>
        </div>
      </div>
    );
  }

  // Handle full-screen screens that don't need the standard header/layout
  if (activeTab === 'landing') return <LandingPage />;
  if (activeTab === 'auth') return <AuthPage />;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#F5F6F8] text-[#1F2937] font-sans selection:bg-[#FDF0EA] selection:text-[#C85A32]">
      <Header />

      <main id="app-viewport" className="flex-1 flex overflow-hidden bg-[#F5F6F8]">
        {activeTab === 'home' && <Home />}
        {activeTab === 'sell' && <Sell />}
        {activeTab === 'buy-pawn' && <BuyPawn />}
        {activeTab === 'inventory' && <Inventory />}
        {activeTab === 'vault' && <VaultManager />}
        {activeTab === 'saps' && <SapsRegister />}
        {activeTab === 'customers' && <Customers />}
        {activeTab === 'profile' && <CashierProfile />}
      </main>

      {/* Hardware Scanner Camera Modal */}
      <ScannerModal />

      {/* Thermal POS Receipt Modal */}
      <ReceiptModal />

      {/* Statutory 30-Day NCR Pledge Contract Modal */}
      <ContractModal />

      {/* Account Switcher Picker */}
      <AccountPicker />

      {/* Operational Feedback Toast */}
      <Toast />
    </div>
  );
};

import { TerminalGuard } from './components/TerminalGuard';

export default function App() {
  return (
    <CompositeProvider>
      <AppProvider>
        <TerminalGuard>
          <MainLayout />
        </TerminalGuard>
      </AppProvider>
    </CompositeProvider>
  );
}
