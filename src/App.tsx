/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { Header } from './components/Header';
import { FloatingActionMenu } from './components/FloatingActionMenu';
import { Toast } from './components/Toast';
import { Dashboard } from './components/screens/Dashboard';
import { PosTerminal } from './components/screens/PosTerminal';
import { IntakeDesk } from './components/screens/IntakeDesk';
import { VaultManager } from './components/screens/VaultManager';
import { Registry } from './components/screens/Registry';
import { CashierProfile } from './components/screens/CashierProfile';
import { ScannerModal } from './components/modals/ScannerModal';
import { ReceiptModal } from './components/modals/ReceiptModal';
import { ContractModal } from './components/modals/ContractModal';
import { KeyboardShortcutsGuide } from './components/modals/ShortcutsModal';
import { SystemTestProtocolModal } from './components/modals/SystemTestProtocolModal';
import { SupabaseApiModal } from './components/modals/SupabaseApiModal';
import { DealRulesModal } from './components/modals/DealRulesModal';

const MainLayout: React.FC = () => {
  const { activeTab } = useApp();
  const [isShortcutsHelpOpen, setIsShortcutsHelpOpen] = useState(false);
  const [isTestProtocolOpen, setIsTestProtocolOpen] = useState(false);

  // Initialize global keyboard shortcuts for fast cashier navigation and POS actions
  useKeyboardShortcuts({
    onOpenShortcutsHelp: () => setIsShortcutsHelpOpen(prev => !prev)
  });

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#121212] text-gray-100 font-sans selection:bg-[#C85A32] selection:text-white">
      {/* Streamlined Global Header & Single Navigation System */}
      <Header 
        onOpenShortcuts={() => setIsShortcutsHelpOpen(true)} 
        onOpenTestProtocol={() => setIsTestProtocolOpen(true)}
      />

      {/* Clean Single Main Viewport */}
      <main id="app-viewport" className="flex-1 flex overflow-hidden bg-[#121212]">
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'pos' && <PosTerminal />}
        {activeTab === 'intake' && <IntakeDesk />}
        {activeTab === 'vault' && <VaultManager />}
        {activeTab === 'registry' && <Registry />}
        {activeTab === 'profile' && <CashierProfile />}
      </main>

      {/* Hardware Scanner Camera Modal */}
      <ScannerModal />

      {/* Thermal POS Receipt Modal */}
      <ReceiptModal />

      {/* Statutory 30-Day NCR Pledge Contract Modal */}
      <ContractModal />

      {/* Cashier Keyboard Shortcuts Cheat-sheet Modal */}
      <KeyboardShortcutsGuide
        isOpen={isShortcutsHelpOpen}
        onClose={() => setIsShortcutsHelpOpen(false)}
      />

      {/* Walkthrough & Simulation Protocol Modal */}
      <SystemTestProtocolModal 
        isOpen={isTestProtocolOpen}
        onClose={() => setIsTestProtocolOpen(false)}
      />

      {/* Supabase Free Tier API, Auth, Database & Logs Center */}
      <SupabaseApiModal />

      {/* Customizable Deal Rules & Margins Modal */}
      <DealRulesModal />

      {/* Operational Feedback Toast */}
      <Toast />

      {/* UNIVERSAL ACTION BUTTON (UAB) - Facebook/Modern App Pattern */}
      <FloatingActionMenu />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainLayout />
    </AppProvider>
  );
}
