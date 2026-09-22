import React, { useState } from 'react';
import { useApp, NavTab } from '../context/AppContext';
import { Search, Camera, RotateCcw, ChevronDown, MapPin, PlayCircle, X, ShoppingBag, PlusCircle, History, User, MessageSquare } from 'lucide-react';

interface HeaderProps {
  onOpenShortcuts?: () => void;
  onOpenTestProtocol?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenTestProtocol }) => {
  const {
    activeTab,
    setActiveTab,
    activeCustomer,
    setActiveCustomer,
    setIsScannerModalOpen,
    setIsSupabaseModalOpen,
    supabaseStatus,
    resetToDefaultData,
    customers,
    showToast,
    shopProfile,
    isOnline,
    isSlowSyncing,
    pendingSyncCount
  } = useApp();

  const [selectedBranch, setSelectedBranch] = useState('Soweto Main Branch');
  const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const filteredCustomers = searchQuery.length >= 2 
    ? customers.filter(c => 
        c.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.idNumber.includes(searchQuery) ||
        c.mobile.includes(searchQuery)
      ).slice(0, 5)
    : [];

  const handleAction = (tab: NavTab, customer: any) => {
    setActiveCustomer(customer);
    setActiveTab(tab);
    setSearchQuery('');
    setIsSearchFocused(false);
    showToast('Session Started', `Acting for ${customer.fullName}`, 'success');
  };

  const branches = [
    'Soweto Main Branch',
    'Jabulani Mall Branch',
    'Diepkloof Square Branch'
  ];

  const navTabs: { id: NavTab; label: string }[] = [
    { id: 'dashboard', label: 'Home' },
    { id: 'pos', label: 'Retail POS' },
    { id: 'intake', label: 'Intake' },
    { id: 'vault', label: 'Vault' },
    { id: 'registry', label: 'Registry' }
  ];

  return (
    <header className="bg-[#1E1E1E] border-b border-[#2A2A2A] px-4 lg:px-6 py-2 flex items-center justify-between gap-4 shrink-0 sticky top-0 z-40">
      {/* ============================================================
          LEFT: BRAND & SEARCH
         ============================================================ */}
      <div className="flex items-center gap-6 flex-1 min-w-0">
        <button
          type="button"
          onClick={() => setActiveTab('dashboard')}
          className="flex items-center gap-2.5 shrink-0"
        >
          <div className="w-8 h-8 rounded-lg bg-[#C85A32] flex items-center justify-center text-white font-bold text-sm tracking-wide shadow-lg shadow-[#C85A32]/20">
            LM
          </div>
          <span className="hidden md:inline text-sm font-bold text-gray-100 font-headline tracking-tight">
            LocalMarket
          </span>
        </button>

        {/* UNIVERSAL SEARCH: COMMAND PALETTE UPGRADE */}
        <div className="relative flex-1 max-w-md hidden sm:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input 
            type="text" 
            placeholder="Action Search (e.g. 'Start Sale for Thabo')..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            className="w-full bg-[#141414] border border-[#2A2A2A] rounded-xl py-1.5 pl-9 pr-4 text-xs text-gray-200 placeholder:text-gray-500 focus:outline-none focus:border-[#C85A32] transition-all"
          />

          {/* Actionable Results Dropdown */}
          {isSearchFocused && filteredCustomers.length > 0 && (
            <>
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setIsSearchFocused(false)} 
              />
              <div className="absolute top-full left-0 right-0 mt-2 bg-[#1E1E1E] border border-[#2A2A2A] rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
                <div className="p-2 border-b border-[#2A2A2A] bg-[#141414]">
                  <span className="text-[10px] font-bold text-gray-500 uppercase px-3">Start Transaction For...</span>
                </div>
                {filteredCustomers.map(customer => (
                  <div key={customer.id} className="p-3 border-b border-[#2A2A2A] last:border-0 hover:bg-[#252525] transition-colors group">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#C85A32]/20 flex items-center justify-center text-[#E87A5D] font-bold text-xs">
                          {customer.fullName.charAt(0)}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white">{customer.fullName}</p>
                          <p className="text-[10px] text-gray-500 font-mono">{customer.idNumber}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleAction('pos', customer)}
                          className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white transition"
                          title="Start Sale"
                        >
                          <ShoppingBag className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => handleAction('intake', customer)}
                          className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white transition"
                          title="Pawn/Buy Intake"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => handleAction('registry', customer)}
                          className="p-1.5 rounded-lg bg-[#2A2A2A] text-gray-400 hover:bg-white hover:text-black transition"
                          title="View Records"
                        >
                          <History className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ============================================================
          CENTER: NAV TABS (UNIVERSAL START ACTION)
         ============================================================ */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setActiveTab('intake')}
          className="hidden xl:flex items-center gap-2 px-4 py-1.5 bg-white text-black rounded-lg text-[11px] font-black uppercase tracking-tighter hover:bg-[#C85A32] hover:text-white transition group"
        >
          <PlusCircle className="w-4 h-4" />
          <span>New Transaction</span>
        </button>
        
        <nav aria-label="Main Navigation" className="flex items-center bg-[#121212] p-1 rounded-xl border border-[#2A2A2A] text-xs">
        {navTabs.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-1.5 rounded-lg text-xs transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-[#C85A32] text-white font-bold shadow-md'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#1E1E1E]'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>
    </div>

      {/* ============================================================
          RIGHT: UTILITY & PROFILE / ACTIVE SESSION
         ============================================================ */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Offline / Trickle Sync Status Pill */}
        {!isOnline ? (
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-mono font-bold hover:bg-amber-500/20 transition"
            title="Offline mode: Data safely stored on local device"
          >
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            <span>Offline (Device DB)</span>
          </button>
        ) : isSlowSyncing ? (
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/30 text-cyan-400 text-[10px] font-mono font-bold animate-pulse hover:bg-blue-500/20 transition"
            title="Trickle sync active"
          >
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
            <span>Trickle Syncing...</span>
          </button>
        ) : pendingSyncCount > 0 ? (
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#252525] border border-[#3A3A3A] text-gray-300 text-[10px] font-mono font-bold hover:border-[#C85A32]/40 transition"
            title={`${pendingSyncCount} mutations in local queue`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#E87A5D]"></span>
            <span>{pendingSyncCount} in Outbox</span>
          </button>
        ) : null}

        {/* Quick Utilities */}
        <div className="flex items-center gap-1.5 pr-2 border-r border-[#2A2A2A]">
          <button
            type="button"
            onClick={() => setIsScannerModalOpen(true)}
            className="p-2 rounded-xl bg-[#141414] hover:bg-[#1E1E1E] border border-[#2A2A2A] text-gray-400 hover:text-[#E87A5D] transition relative"
            title="Scan Barcode / ID"
          >
            <Camera className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 border border-[#141414]"></span>
          </button>
        </div>

        {/* Dynamic Identity: Cashier or Active Customer Session */}
        {activeCustomer ? (
          <div className="flex items-center gap-3 animate-in slide-in-from-right duration-300">
            <button 
              onClick={() => setActiveTab('registry')}
              className="text-right hidden sm:block hover:opacity-80 transition"
              title="View Customer Records"
            >
              <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest leading-tight">Active Session</p>
              <p className="text-xs font-bold text-white truncate max-w-[120px]">{activeCustomer.fullName}</p>
            </button>
            <button
              onClick={() => setActiveCustomer(null)}
              className="group relative"
              title="End Customer Session"
            >
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:bg-red-500/10 group-hover:border-red-500/30 group-hover:text-red-400 transition-all">
                <span className="group-hover:hidden font-bold text-xs">{activeCustomer.fullName.charAt(0)}</span>
                <X className="hidden group-hover:block w-4 h-4" />
              </div>
            </button>
          </div>
        ) : (
          <button 
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2.5 p-1.5 rounded-xl border transition-all duration-300 group ${
              activeTab === 'profile' 
                ? 'bg-[#C85A32]/10 border-[#C85A32] shadow-[0_0_15px_rgba(200,90,50,0.2)]' 
                : 'bg-transparent border-transparent hover:bg-[#252525] hover:border-[#333333]'
            }`}
            title="View Cashier Profile & Shift Tools"
          >
            <div className="hidden lg:block text-right">
              <p className="text-[10px] font-black text-white uppercase tracking-[0.1em] leading-tight group-hover:text-[#E87A5D] transition-colors">Shift Hub</p>
              <p className="text-[9px] text-gray-500 font-mono tracking-tighter truncate max-w-[130px]">{shopProfile.shop_code} · {shopProfile.city}</p>
            </div>
            <div className={`w-8 h-8 rounded-lg border flex items-center justify-center text-xs font-black shadow-inner transition-transform group-hover:scale-105 ${
              activeTab === 'profile' 
                ? 'bg-[#C85A32] border-[#C85A32] text-white' 
                : 'bg-[#141414] border-[#2A2A2A] text-[#E87A5D]'
            }`}>
              CS
            </div>
            <ChevronDown className={`w-3.5 h-3.5 text-gray-600 transition-transform ${activeTab === 'profile' ? 'rotate-180 text-[#E87A5D]' : 'group-hover:translate-y-0.5'}`} />
          </button>
        )}
      </div>
    </header>
  );
};
