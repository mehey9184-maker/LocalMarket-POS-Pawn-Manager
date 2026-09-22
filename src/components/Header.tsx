import React, { useState } from 'react';
import { useApp, NavTab } from '../context/AppContext';
import { Search, Camera, RotateCcw, ChevronDown, MapPin, PlayCircle, X, ShoppingBag, PlusCircle, History, User, MessageSquare } from 'lucide-react';

interface HeaderProps {
  onOpenShortcuts?: () => void;
  onOpenTestProtocol?: () => void;
}

export const Header: React.FC<HeaderProps> = () => {
  const {
    activeTab,
    setActiveTab,
    setActiveCustomer,
    customers,
    showToast,
    shopProfile,
  } = useApp();

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

  const navTabs: { id: NavTab; label: string }[] = [
    { id: 'home', label: 'Home' },
    { id: 'sell', label: 'Sell' },
    { id: 'buy-pawn', label: 'Buy / Pawn' },
    { id: 'inventory', label: 'Inventory' },
    { id: 'customers', label: 'Customers' }
  ];

  return (
    <header className="bg-[#121212] border-b border-[#2A2A2A] px-4 lg:px-6 py-3 flex items-center justify-between gap-4 shrink-0 sticky top-0 z-40">
      {/* ============================================================
          LEFT: BRAND & SEARCH
         ============================================================ */}
      <div className="flex items-center gap-6 flex-1 min-w-0">
        <button
          type="button"
          onClick={() => setActiveTab('home')}
          className="flex items-center gap-3 shrink-0 group"
        >
          <div className="w-9 h-9 rounded-xl bg-[#C85A32] flex items-center justify-center text-white font-bold text-sm tracking-wide shadow-lg shadow-[#C85A32]/20 group-hover:scale-105 transition-transform">
            LM
          </div>
          <div className="flex flex-col text-left">
            <span className="text-sm font-bold text-gray-100 font-headline tracking-tight leading-none">
              {shopProfile.shop_name}
            </span>
            <span className="text-[10px] text-gray-500 font-mono uppercase tracking-widest mt-0.5">
              LocalMarket POS
            </span>
          </div>
        </button>

        {/* UNIVERSAL SEARCH */}
        <div className="relative flex-1 max-w-sm hidden md:block">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
          <input 
            type="text" 
            placeholder="Quick search customers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl py-2 pl-10 pr-4 text-[13px] text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-[#C85A32]/50 focus:ring-1 focus:ring-[#C85A32]/20 transition-all"
          />

          {/* Actionable Results Dropdown */}
          {isSearchFocused && filteredCustomers.length > 0 && (
            <>
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setIsSearchFocused(false)} 
              />
              <div className="absolute top-full left-0 right-0 mt-2 bg-[#1E1E1E] border border-[#2A2A2A] rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
                <div className="p-2.5 border-b border-[#2A2A2A] bg-[#1A1A1A]">
                  <span className="text-[10px] font-bold text-gray-500 uppercase px-3 tracking-widest">Customer Quick Actions</span>
                </div>
                {filteredCustomers.map(customer => (
                  <div key={customer.id} className="p-3 border-b border-[#2A2A2A] last:border-0 hover:bg-[#252525] transition-colors group">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#C85A32]/10 border border-[#C85A32]/20 flex items-center justify-center text-[#E87A5D] font-bold text-xs">
                          {customer.fullName.charAt(0)}
                        </div>
                        <div>
                          <p className="text-[13px] font-bold text-white">{customer.fullName}</p>
                          <p className="text-[10px] text-gray-500 font-mono">{customer.mobile}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handleAction('sell', customer)}
                          className="px-2.5 py-1.5 rounded-lg bg-[#C85A32]/10 text-[#E87A5D] hover:bg-[#C85A32] hover:text-white transition text-[10px] font-bold uppercase"
                        >
                          Sell
                        </button>
                        <button 
                          onClick={() => handleAction('buy-pawn', customer)}
                          className="px-2.5 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white transition text-[10px] font-bold uppercase"
                        >
                          Buy/Pawn
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
          CENTER: NAV TABS
         ============================================================ */}
      <nav aria-label="Main Navigation" className="flex items-center bg-[#1A1A1A] p-1 rounded-xl border border-[#2A2A2A]">
        {navTabs.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-2 rounded-lg text-[13px] font-medium transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-[#C85A32] text-white font-bold shadow-lg shadow-[#C85A32]/20'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#252525]'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* ============================================================
          RIGHT: PROFILE / SESSION
         ============================================================ */}
      <div className="flex items-center gap-4 shrink-0">
        <div className="h-8 w-px bg-[#2A2A2A] hidden xl:block"></div>
        
        <button 
          type="button"
          onClick={() => setActiveTab('profile')}
          className={`flex items-center gap-3 p-1 rounded-xl transition-all duration-300 group ${
            activeTab === 'profile' 
              ? 'text-[#E87A5D]' 
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <div className="text-right hidden xl:block">
            <p className="text-[11px] font-bold uppercase tracking-widest leading-none">Shift Active</p>
            <p className="text-[10px] text-gray-500 font-mono mt-1">Terminal 01 · {shopProfile.shop_code}</p>
          </div>
          <div className={`w-9 h-9 rounded-xl border flex items-center justify-center text-xs font-black transition-all ${
            activeTab === 'profile' 
              ? 'bg-[#C85A32] border-[#C85A32] text-white shadow-lg shadow-[#C85A32]/20' 
              : 'bg-[#1A1A1A] border-[#2A2A2A] text-gray-400 group-hover:border-[#3A3A3A] group-hover:text-white'
          }`}>
            <User className="w-4 h-4" />
          </div>
        </button>
      </div>
    </header>
  );
};
