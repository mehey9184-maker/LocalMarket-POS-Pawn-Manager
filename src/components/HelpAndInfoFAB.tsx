import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';
import { 
  HelpCircle, 
  X, 
  BookOpen, 
  Activity, 
  Shield, 
  Check, 
  ChevronRight, 
  ExternalLink,
  Wifi,
  WifiOff,
  User,
  Database
} from 'lucide-react';

export const HelpAndInfoFAB: React.FC = () => {
  const { activeTab, shopProfile } = useApp();
  const { profile } = useAuth();
  const { syncStatus } = useSync();
  const [isOpen, setIsOpen] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'context' | 'compliance' | 'system'>('context');
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isOpen && 
        panelRef.current && 
        !panelRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Determine visibility
  const isVisible = [
    'home',
    'sell',
    'buy-pawn',
    'inventory',
    'customers',
    'vault',
    'saps'
  ].includes(activeTab);

  if (!isVisible) return null;

  // Render context-specific help text
  const getContextHelp = () => {
    switch (activeTab) {
      case 'home':
        return {
          title: 'Home Dashboard',
          description: 'Your operational center for starting and monitoring daily transactions.',
          tips: [
            'Alert counters highlight critical items needing immediate review.',
            'Review overdue and expiring pawn loans directly from the notice tiles.',
            'Check daily transaction totals and recent counter logs below.'
          ]
        };
      case 'sell':
        return {
          title: 'Point of Sale (POS) Register',
          description: 'A rapid, unified interface to ring up customer sales and process payments.',
          tips: [
            'Scan a barcode or type a SKU/title to search and add stock items directly.',
            'Link a registered customer to the transaction to track loyalty or credit.',
            'Accept multiple forms of payment, then complete the transaction to issue receipts.'
          ]
        };
      case 'buy-pawn':
        return {
          title: 'Add Stock & Intake',
          description: 'The single entry point to bring new goods into your shop inventory.',
          tips: [
            'Existing Stock: Add items already owned by the business without customer records.',
            'Buy from Person: Acquire second-hand goods outright from verified individuals.',
            'Pawn: Accept valuable collateral to secure a statutory 30-day interest-bearing loan.',
            'Enter a South African ID to instantly find existing seller/customer profiles.'
          ]
        };
      case 'inventory':
        return {
          title: 'Inventory & Asset Catalog',
          description: 'Search, audit, and manage the complete physical stock catalog.',
          tips: [
            'Check current retail status: Retail, Vault Hold, Sold, or Forfeited.',
            'Click any item row to edit specific metadata, locations, or notes.',
            'Print customized asset price tags and barcodes for the shop floor.'
          ]
        };
      case 'customers':
        return {
          title: 'Customer Directory',
          description: 'Keep a secure, detailed register of clients, pawners, and verified sellers.',
          tips: [
            'Search by name, contact phone, or National Identity number.',
            'View a centralized list of active loans, outstanding balances, and historical trades.',
            'Confirm identity verification details to ensure compliance.'
          ]
        };
      case 'vault':
        return {
          title: 'Vault Storage & Safekeeping',
          description: 'Secure custody logs of high-value collateral items held under pledge.',
          tips: [
            'Tracks individual items assigned to vault locations.',
            'Process a forfeiture directly to legally convert expired pawn collateral into retail stock.',
            'Process a redemption/release when loans are settled to return items to customers.'
          ]
        };
      case 'saps':
        return {
          title: 'SAPS Compliance Register',
          description: 'Statutory electronic ledger keeping logs for the South African Police Service (SAPS).',
          tips: [
            'Records all buy/pawn transactions required under Section 21 of the Second-Hand Goods Act.',
            'Helps protect the business by keeping clean records for inspection audits.',
            'Filter by date range and view clear operational histories.'
          ]
        };
      default:
        return {
          title: 'Operational Workspace',
          description: 'Manage active transactions and secure data stores.',
          tips: [
            'Use the main menu at the top to navigate to different working tabs.',
            'All updates sync securely between local database and the cloud database.'
          ]
        };
    }
  };

  const contextHelp = getContextHelp();

  return (
    <div className="relative font-sans">
      {/* Small Floating Circular Button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Help & Info"
        title="Help & Info"
        className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-[#C85A32] text-white flex items-center justify-center shadow-lg hover:bg-[#B34D28] focus-visible:ring-2 focus-visible:ring-[#C85A32]/50 focus-visible:outline-none hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
      >
        {isOpen ? (
          <X className="w-5 h-5 transition-transform duration-200 rotate-90" />
        ) : (
          <HelpCircle className="w-5 h-5 transition-transform duration-200" />
        )}
      </button>

      {/* Floating Panel Panel */}
      {isOpen && (
        <div
          ref={panelRef}
          className="fixed bottom-20 right-6 z-50 w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden max-h-[500px] animate-in fade-in slide-in-from-bottom-4 duration-200"
          style={{ contentVisibility: 'auto' }}
        >
          {/* Header */}
          <div className="bg-[#FAF8F6] border-b border-gray-100 p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-[#C85A32]/10 flex items-center justify-center">
                <HelpCircle className="w-3.5 h-3.5 text-[#C85A32]" />
              </div>
              <span className="text-sm font-semibold text-gray-900 tracking-tight">
                LocalMarket Assistant
              </span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
              aria-label="Close panel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Segmented Tab Control */}
          <div className="flex p-1 bg-[#F5F6F8] mx-4 mt-3 rounded-xl border border-gray-100 gap-1">
            <button
              onClick={() => setActiveSubTab('context')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                activeSubTab === 'context'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Context Guide</span>
            </button>
            <button
              onClick={() => setActiveSubTab('compliance')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                activeSubTab === 'compliance'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>NCR & SAPS</span>
            </button>
            <button
              onClick={() => setActiveSubTab('system')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                activeSubTab === 'system'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Diagnostics</span>
            </button>
          </div>

          {/* Tab Contents */}
          <div className="flex-1 overflow-y-auto p-5">
            {/* Context Guide Tab */}
            {activeSubTab === 'context' && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    {contextHelp.title}
                  </h4>
                  <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                    {contextHelp.description}
                  </p>
                </div>

                <div className="space-y-3 pt-1 border-t border-gray-50">
                  <span className="text-[11px] font-semibold text-[#C85A32] uppercase tracking-wider block">
                    Cashier Operational Tips
                  </span>
                  <div className="space-y-2.5">
                    {contextHelp.tips.map((tip, idx) => (
                      <div key={idx} className="flex gap-2.5 items-start">
                        <div className="w-4 h-4 rounded-full bg-[#FAF8F6] border border-[#C85A32]/20 flex items-center justify-center shrink-0 mt-0.5">
                          <span className="text-[10px] font-bold text-[#C85A32]">{idx + 1}</span>
                        </div>
                        <p className="text-xs text-gray-600 leading-normal">{tip}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-[#FAF8F6] rounded-xl p-3 border border-[#C85A32]/5 mt-4">
                  <h5 className="text-[11px] font-semibold text-[#C85A32] uppercase tracking-wider">
                    Helpful Reminder
                  </h5>
                  <p className="text-xs text-gray-600 mt-1 leading-normal">
                    LocalMarket is built to match the way you work. If a customer doesn&apos;t remember historical records, leave them blank and move forward.
                  </p>
                </div>
              </div>
            )}

            {/* Compliance Tab */}
            {activeSubTab === 'compliance' && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                    Regulatory Compliance Guide
                  </h4>
                  <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                    LocalMarket is customized to adhere precisely to South African statutory requirements.
                  </p>
                </div>

                <div className="space-y-3 pt-2 border-t border-gray-50">
                  <div className="space-y-3">
                    <div className="flex gap-2 items-start">
                      <div className="w-1.5 h-1.5 bg-[#C85A32] rounded-full mt-1.5 shrink-0" />
                      <div>
                        <span className="text-xs font-semibold text-gray-800">Second-Hand Goods Act 06 of 2009</span>
                        <p className="text-[11px] text-gray-500 mt-0.5 leading-normal">
                          All acquired inventory (outright buy or pawn) must retain full details of the seller, physical address verification, and ID.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2 items-start">
                      <div className="w-1.5 h-1.5 bg-[#C85A32] rounded-full mt-1.5 shrink-0" />
                      <div>
                        <span className="text-xs font-semibold text-gray-800">NCR Pledge Contract Regulations</span>
                        <p className="text-[11px] text-gray-500 mt-0.5 leading-normal">
                          Pawn loans are statutory agreements with a fixed 30-day redemption duration. Interest rates are regulated and capped to protect consumers.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2 items-start">
                      <div className="w-1.5 h-1.5 bg-[#C85A32] rounded-full mt-1.5 shrink-0" />
                      <div>
                        <span className="text-xs font-semibold text-gray-800">Vault Hold Period Lock</span>
                        <p className="text-[11px] text-gray-500 mt-0.5 leading-normal">
                          Collateral must remain safely held in the Vault. It cannot be sold or put on the shop floor before formal loan forfeit occurs.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-[#FAF8F6] rounded-xl p-3 border border-[#C85A32]/5 mt-4">
                  <span className="text-[11px] font-semibold text-[#C85A32] uppercase tracking-wider block">
                    NCR Statutory Pledge Terms
                  </span>
                  <div className="text-[11px] text-gray-600 space-y-1 mt-1 leading-normal">
                    <p>• Term: 30 Calendar Days (Default)</p>
                    <p>• Extension: Subject to complete outstanding interest payment</p>
                    <p>• Forfeit: Non-payment allows safe transfer of collateral to stock</p>
                  </div>
                </div>
              </div>
            )}

            {/* System Diagnostics Tab */}
            {activeSubTab === 'system' && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-semibold text-gray-900">System & Network Diagnostics</h4>
                  <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                    Real-time status of your terminal connection and synchronized database records.
                  </p>
                </div>

                <div className="pt-2 border-t border-gray-50 space-y-3">
                  {/* Connection */}
                  <div className="flex items-center justify-between py-1 border-b border-gray-50">
                    <span className="text-xs text-gray-600 flex items-center gap-1.5">
                      <Wifi className="w-3.5 h-3.5 text-gray-400" />
                      Network Connection
                    </span>
                    <span className="text-xs font-medium text-gray-800 flex items-center gap-1.5">
                      {syncStatus.isOnline ? (
                        <>
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span>Online</span>
                        </>
                      ) : (
                        <>
                          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                          <span>Offline Mode</span>
                        </>
                      )}
                    </span>
                  </div>

                  {/* Sync Queue */}
                  <div className="flex items-center justify-between py-1 border-b border-gray-50">
                    <span className="text-xs text-gray-600 flex items-center gap-1.5">
                      <Database className="w-3.5 h-3.5 text-gray-400" />
                      Sync Queue Status
                    </span>
                    <span className="text-xs font-mono text-gray-800">
                      {syncStatus.isSyncing ? (
                        <span className="text-[#C85A32] animate-pulse">Syncing...</span>
                      ) : syncStatus.pendingCount > 0 ? (
                        <span className="text-amber-600 font-semibold">{syncStatus.pendingCount} pending changes</span>
                      ) : (
                        <span className="text-gray-500">All data synced</span>
                      )}
                    </span>
                  </div>

                  {/* Cashier Role */}
                  <div className="flex items-center justify-between py-1 border-b border-gray-50">
                    <span className="text-xs text-gray-600 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-gray-400" />
                      Active Worker
                    </span>
                    <span className="text-xs font-medium text-gray-800">
                      {profile?.full_name || 'Counter Operator'}
                    </span>
                  </div>

                  {/* Shop Profile Name */}
                  <div className="flex items-center justify-between py-1">
                    <span className="text-xs text-gray-600 flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-gray-400" />
                      Shop Brand
                    </span>
                    <span className="text-xs font-medium text-gray-800 max-w-[200px] truncate" title={shopProfile?.shop_name}>
                      {shopProfile?.shop_name || 'LocalMarket'}
                    </span>
                  </div>
                </div>

                {/* Unboxed Metadata Footer with typographic separators */}
                <div className="text-[10px] text-gray-400 text-center pt-3 border-t border-gray-50 flex items-center justify-center gap-2">
                  <span>LocalMarket POS v1.0.4</span>
                  <span>·</span>
                  <span>Branch Secure</span>
                  <span>·</span>
                  <span>Powered by LocalEats</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
