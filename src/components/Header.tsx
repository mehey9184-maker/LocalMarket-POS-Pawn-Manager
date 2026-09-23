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
    <header className="bg-white border-b border-gray-200 px-6 py-3.5 flex items-center justify-between gap-6 shrink-0 sticky top-0 z-40 shadow-xs">
      {/* ============================================================
          LEFT: BRAND & SEARCH
         ============================================================ */}
      <div className="flex items-center gap-6 flex-1 min-w-0">
        <button
          type="button"
          onClick={() => setActiveTab('home')}
          className="flex items-center gap-3 shrink-0 group text-left"
        >
          <div className="w-9 h-9 rounded-xl bg-[#C85A32] flex items-center justify-center text-white font-bold text-sm tracking-wide shadow-sm group-hover:bg-[#A94725] transition-colors">
            LM
          </div>
          <div className="flex flex-col text-left">
            <span className="text-sm font-bold text-gray-900 font-headline tracking-tight leading-none">
              {shopProfile.shop_name}
            </span>
            <span className="text-[11px] text-gray-500 font-medium mt-0.5">
              POS & Pawn Manager
            </span>
          </div>
        </button>

        {/* UNIVERSAL SEARCH */}
        <div className="relative flex-1 max-w-sm hidden md:block">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search customers or sellers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            className="w-full bg-[#F8F9FA] border border-gray-200 rounded-xl py-2 pl-10 pr-4 text-[13px] text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-[#C85A32] focus:bg-white focus:ring-2 focus:ring-[#C85A32]/10 transition-all"
          />

          {/* Actionable Results Dropdown */}
          {isSearchFocused && filteredCustomers.length > 0 && (
            <>
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setIsSearchFocused(false)} 
              />
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                <div className="px-4 py-2.5 border-b border-gray-100 bg-[#F8F9FA]">
                  <span className="text-[11px] font-semibold text-gray-500">Quick Actions</span>
                </div>
                {filteredCustomers.map(customer => (
                  <div key={customer.id} className="p-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#FDF0EA] text-[#C85A32] font-semibold text-xs flex items-center justify-center">
                          {customer.fullName.charAt(0)}
                        </div>
                        <div>
                          <p className="text-[13px] font-semibold text-gray-900">{customer.fullName}</p>
                          <p className="text-[11px] text-gray-500 font-mono">{customer.mobile}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handleAction('sell', customer)}
                          className="px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition text-[11px] font-medium"
                        >
                          Sell
                        </button>
                        <button 
                          onClick={() => handleAction('buy-pawn', customer)}
                          className="px-2.5 py-1.5 rounded-lg bg-[#FDF0EA] text-[#C85A32] hover:bg-[#C85A32] hover:text-white transition text-[11px] font-medium"
                        >
                          Intake
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
      <nav aria-label="Main Navigation" className="flex items-center bg-[#F3F4F6] p-1 rounded-xl border border-gray-200/80">
        {navTabs.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-[13px] font-medium transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-white text-gray-900 font-semibold shadow-xs border border-gray-200/50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
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
        <div className="h-6 w-px bg-gray-200 hidden xl:block"></div>
        
        <button 
          type="button"
          onClick={() => setActiveTab('profile')}
          className="flex items-center gap-3 p-1 rounded-xl transition-colors group"
        >
          <div className="text-right hidden xl:block">
            <p className="text-[11px] font-semibold text-gray-800 leading-none">Shift Active</p>
            <p className="text-[10px] text-gray-400 font-mono mt-1">Terminal 01 · {shopProfile.shop_code}</p>
          </div>
          <div className={`w-9 h-9 rounded-xl border flex items-center justify-center text-xs font-semibold transition-all ${
            activeTab === 'profile' 
              ? 'bg-[#C85A32] border-[#C85A32] text-white shadow-xs' 
              : 'bg-white border-gray-200 text-gray-600 group-hover:border-gray-300 group-hover:text-gray-900'
          }`}>
            <User className="w-4 h-4" />
          </div>
        </button>
      </div>
    </header>
  );
};
