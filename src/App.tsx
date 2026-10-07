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
import { ShopSetup } from './components/screens/ShopSetup';
import { AccountPicker } from './components/auth/AccountPicker';
import { ScannerModal } from './components/modals/ScannerModal';
import { ReceiptModal } from './components/modals/ReceiptModal';
import { ContractModal } from './components/modals/ContractModal';
import { HelpAndInfoFAB } from './components/HelpAndInfoFAB';

import { CompositeProvider } from './context/CompositeProvider';
import { useAuth } from './context/AuthContext';
import { useIdleLock } from './hooks/useIdleLock';

const MainLayout: React.FC = () => {
  const { activeTab, setActiveTab } = useApp();
  const { user, profile, isLoading: authLoading, isProfileLoading, isSwitchingAccount, isIdleLocked } = useAuth();

  // Inactivity lock timer (returns till to PIN/account picker on idle while preserving all worker drafts and work)
  useIdleLock();

  // Session-based navigation enforcement
  React.useEffect(() => {
    // Guard against routing during auth initialization, profile hydration, or account switching.
    // An already-configured shop must NEVER evaluate !hasShop while profile is still resolving.
    if (authLoading || (user && isProfileLoading) || isSwitchingAccount) return;

    const isEmailConfirmed = user?.email_confirmed_at || user?.confirmed_at;
    const hasShop = profile?.shop_id;

    if (user && isEmailConfirmed) {
      if (!hasShop) {
        if (activeTab !== 'shop-setup') {
          setActiveTab('shop-setup');
        }
      } else if (activeTab === 'landing' || activeTab === 'auth' || activeTab === 'shop-setup') {
        const isStandardCashier = profile?.role === 'cashier';
        setActiveTab(isStandardCashier ? 'sell' : 'home');
      }
    } else if (!user && activeTab !== 'auth') {
      setActiveTab('auth');
    }
  }, [user, authLoading, isProfileLoading, activeTab, setActiveTab, profile, isSwitchingAccount]);

  if (authLoading || (user && isProfileLoading)) {
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
  if (activeTab === 'shop-setup') return <ShopSetup />;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#F5F6F8] text-[#1F2937] font-sans selection:bg-[#FDF0EA] selection:text-[#C85A32]">
      <div 
        className="flex flex-col flex-1 h-full w-full overflow-hidden"
        aria-hidden={isIdleLocked || undefined}
        inert={isIdleLocked || undefined}
      >
        <Header />

        <main id="app-viewport" className="flex-1 flex overflow-hidden bg-[#F5F6F8]">
          <div className={`flex-1 h-full w-full ${activeTab === 'home' ? 'flex flex-col overflow-hidden' : 'hidden'}`}><Home /></div>
          <div className={`flex-1 h-full w-full ${activeTab === 'sell' ? 'flex flex-col lg:flex-row overflow-hidden' : 'hidden'}`}><Sell /></div>
          <div className={`flex-1 h-full w-full ${activeTab === 'buy-pawn' ? 'flex flex-col overflow-hidden' : 'hidden'}`}><BuyPawn /></div>
          <div className={`flex-1 h-full w-full ${activeTab === 'inventory' ? 'flex flex-col overflow-hidden' : 'hidden'}`}><Inventory /></div>
          <div className={`flex-1 h-full w-full ${activeTab === 'vault' ? 'flex flex-col overflow-hidden' : 'hidden'}`}><VaultManager /></div>
          <div className={`flex-1 h-full w-full ${activeTab === 'saps' ? 'flex flex-col overflow-hidden' : 'hidden'}`}><SapsRegister /></div>
          <div className={`flex-1 h-full w-full ${activeTab === 'customers' ? 'flex flex-col overflow-hidden' : 'hidden'}`}><Customers /></div>
          <div className={`flex-1 h-full w-full ${activeTab === 'profile' ? 'flex flex-col md:flex-row overflow-hidden' : 'hidden'}`}><CashierProfile /></div>
        </main>

        {/* Hardware Scanner Camera Modal */}
        <ScannerModal />

        {/* Thermal POS Receipt Modal */}
        <ReceiptModal />

        {/* Statutory 30-Day NCR Pledge Contract Modal */}
        <ContractModal />

        {/* Operational Feedback Toast */}
        <Toast />

        {/* Global Help & Info Button */}
        <HelpAndInfoFAB />
      </div>

      {/* Account Switcher Picker */}
      <AccountPicker />
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
