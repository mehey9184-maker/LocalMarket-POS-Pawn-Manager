import React, { useState, useMemo } from 'react';
import { useApp, NavTab } from '../context/AppContext';
import { useSellers } from '../context/SellerContext';
import { useAuth } from '../context/AuthContext';
import { 
  Search, 
  User, 
  Package, 
  Clock, 
  ShoppingBag, 
  Receipt, 
  Store,
  ChevronRight,
  Plus,
  ArrowLeftRight
} from 'lucide-react';

interface HeaderProps {
  onOpenShortcuts?: () => void;
  onOpenTestProtocol?: () => void;
}

export const Header: React.FC<HeaderProps> = () => {
  const {
    activeTab,
    setActiveTab,
    setActiveCustomer,
    inventory,
    pawnLoans,
    customers,
    salesHistory,
    addToCart,
    setActiveReceiptModal,
    showToast,
    shopProfile,
  } = useApp();

  const { profile, setIsAccountPickerOpen, hasPermission, isAtLeastSeniorCashier } = useAuth();
  const { sellers } = useSellers();

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Universal Search across domains
  const searchResults = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (q.length < 2) return null;

    const matchedInventory = inventory.filter(i => 
      i.title.toLowerCase().includes(q) ||
      i.sku.toLowerCase().includes(q) ||
      (i.serialOrImei && i.serialOrImei.toLowerCase().includes(q))
    ).slice(0, 3);

    const matchedLoans = pawnLoans.filter(l =>
      l.ticketNumber.toLowerCase().includes(q) ||
      l.customerName.toLowerCase().includes(q) ||
      l.customerIdNumber.includes(q) ||
      l.itemTitle.toLowerCase().includes(q)
    ).slice(0, 3);

    const matchedCustomers = customers.filter(c =>
      c.fullName.toLowerCase().includes(q) ||
      c.idNumber.includes(q) ||
      c.mobile.includes(q)
    ).slice(0, 3);

    const matchedSellers = sellers.filter(s =>
      s.fullName.toLowerCase().includes(q) ||
      s.idNumber.includes(q) ||
      s.mobile.includes(q)
    ).slice(0, 3);

    const matchedSales = salesHistory.filter(s =>
      s.receiptNumber.toLowerCase().includes(q)
    ).slice(0, 2);

    const totalCount = matchedInventory.length + matchedLoans.length + matchedCustomers.length + matchedSellers.length + matchedSales.length;

    return {
      inventory: matchedInventory,
      loans: matchedLoans,
      customers: matchedCustomers,
      sellers: matchedSellers,
      sales: matchedSales,
      totalCount
    };
  }, [searchQuery, inventory, pawnLoans, customers, sellers, salesHistory]);

  const handleSelectCustomer = (customer: any, tab: NavTab) => {
    setActiveCustomer(customer);
    setActiveTab(tab);
    setSearchQuery('');
    setIsSearchFocused(false);
    showToast('Customer Selected', `Active client: ${customer.fullName}`, 'info');
  };

  const navTabs = useMemo(() => {
    const tabs: { id: NavTab; label: string }[] = [{ id: 'home', label: 'Home' }];
    
    if (hasPermission('sales')) tabs.push({ id: 'sell', label: 'Sell' });
    
    if (hasPermission('pawn') || hasPermission('sellerAcquisitions') || hasPermission('inventory')) {
      tabs.push({ id: 'buy-pawn', label: 'Add Stock' });
    }
    
    if (hasPermission('inventory')) tabs.push({ id: 'inventory', label: 'Inventory' });
    if (hasPermission('pawn')) tabs.push({ id: 'vault', label: 'Vault' });
    
    // SAPS and Customers are trusted data domains
    if (isAtLeastSeniorCashier) {
      tabs.push({ id: 'saps', label: 'SAPS Register' });
      tabs.push({ id: 'customers', label: 'Customers' });
    }
    
    return tabs;
  }, [hasPermission, isAtLeastSeniorCashier]);

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-3.5 flex items-center justify-between gap-6 shrink-0 sticky top-0 z-40 shadow-xs">
      {/* ============================================================
          LEFT: BRAND & SEARCH
         ============================================================ */}
      <div className="flex items-center gap-6 flex-1 min-w-0">
        <button
          type="button"
          onClick={() => setActiveTab('home')}
          className="flex items-center gap-3 shrink-0 group text-left cursor-pointer"
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

        {/* UNIVERSAL OPERATIONAL SEARCH */}
        <div className="relative flex-1 max-w-md hidden md:block">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search stock SKU, pawn loans, customers, sellers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            className="w-full bg-[#F8F9FA] border border-gray-200 rounded-xl py-2 pl-10 pr-4 text-[13px] text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-[#C85A32] focus:bg-white focus:ring-2 focus:ring-[#C85A32]/10 transition-all"
          />

          {/* Actionable Results Dropdown */}
          {isSearchFocused && searchResults && searchResults.totalCount > 0 && (
            <>
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setIsSearchFocused(false)} 
              />
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-2xl shadow-xl z-50 overflow-hidden max-h-[460px] overflow-y-auto divide-y divide-gray-100">
                {/* 1. INVENTORY MATCHES */}
                {searchResults.inventory.length > 0 && (
                  <div className="p-2">
                    <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                      <Package className="w-3 h-3 text-[#C85A32]" />
                      <span>Stock & Inventory</span>
                    </div>
                    {searchResults.inventory.map(item => (
                      <div key={item.id} className="p-2 hover:bg-gray-50 rounded-xl flex items-center justify-between gap-3 transition">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-gray-900 truncate">{item.title}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-bold">{item.sku}</span>
                          </div>
                          <div className="text-[11px] text-gray-500 flex items-center gap-2 mt-0.5">
                            <span className="font-mono font-bold text-gray-800">R {item.retailPrice.toLocaleString()}</span>
                            <span>•</span>
                            <span className={`text-[10px] font-medium ${item.status === 'Retail Floor' ? 'text-emerald-600' : 'text-amber-600'}`}>{item.status}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {item.status === 'Retail Floor' && (
                            <button
                              onClick={() => {
                                addToCart(item);
                                setActiveTab('sell');
                                setIsSearchFocused(false);
                                setSearchQuery('');
                              }}
                              className="px-2.5 py-1 rounded-lg bg-[#FDF0EA] text-[#C85A32] hover:bg-[#C85A32] hover:text-white text-xs font-semibold transition"
                            >
                              Sell
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setActiveTab('inventory');
                              setIsSearchFocused(false);
                              setSearchQuery('');
                            }}
                            className="px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 text-xs font-semibold transition"
                          >
                            View
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 2. PAWN LOANS */}
                {searchResults.loans.length > 0 && (
                  <div className="p-2">
                    <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                      <Clock className="w-3 h-3 text-blue-500" />
                      <span>Pawn Loans</span>
                    </div>
                    {searchResults.loans.map(loan => (
                      <div key={loan.id} className="p-2 hover:bg-gray-50 rounded-xl flex items-center justify-between gap-3 transition">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-gray-900">{loan.customerName}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-bold">{loan.ticketNumber}</span>
                          </div>
                          <p className="text-[11px] text-gray-500 truncate">{loan.itemTitle} · Principal: R {loan.principal}</p>
                        </div>
                        <button
                          onClick={() => {
                            setActiveTab('customers');
                            setIsSearchFocused(false);
                            setSearchQuery('');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white text-xs font-semibold transition"
                        >
                          Ledger
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* 3. SELLERS */}
                {searchResults.sellers.length > 0 && (
                  <div className="p-2">
                    <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                      <Store className="w-3 h-3 text-orange-500" />
                      <span>Outright Sellers</span>
                    </div>
                    {searchResults.sellers.map(seller => (
                      <div key={seller.id} className="p-2 hover:bg-gray-50 rounded-xl flex items-center justify-between gap-3 transition">
                        <div>
                          <p className="text-xs font-semibold text-gray-900">{seller.fullName}</p>
                          <p className="text-[11px] text-gray-500 font-mono">ID: {seller.idNumber} · {seller.mobile}</p>
                        </div>
                        <button
                          onClick={() => {
                            setActiveCustomer(seller as any);
                            setActiveTab('buy-pawn');
                            setIsSearchFocused(false);
                            setSearchQuery('');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-orange-50 text-[#C85A32] hover:bg-[#C85A32] hover:text-white text-xs font-semibold transition"
                        >
                          Buy Intake
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* 4. CUSTOMERS */}
                {searchResults.customers.length > 0 && (
                  <div className="p-2">
                    <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                      <User className="w-3 h-3 text-emerald-500" />
                      <span>Pawn Customers</span>
                    </div>
                    {searchResults.customers.map(customer => (
                      <div key={customer.id} className="p-2 hover:bg-gray-50 rounded-xl flex items-center justify-between gap-3 transition">
                        <div>
                          <p className="text-xs font-semibold text-gray-900">{customer.fullName}</p>
                          <p className="text-[11px] text-gray-500 font-mono">ID: {customer.idNumber} · {customer.mobile}</p>
                        </div>
                        <button
                          onClick={() => handleSelectCustomer(customer, 'buy-pawn')}
                          className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white text-xs font-semibold transition"
                        >
                          Pawn Intake
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* 5. SALES RECEIPTS */}
                {searchResults.sales.length > 0 && (
                  <div className="p-2">
                    <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                      <Receipt className="w-3 h-3 text-purple-500" />
                      <span>Sales Receipts</span>
                    </div>
                    {searchResults.sales.map(sale => (
                      <div key={sale.id} className="p-2 hover:bg-gray-50 rounded-xl flex items-center justify-between gap-3 transition">
                        <div>
                          <p className="text-xs font-bold font-mono text-gray-900">{sale.receiptNumber}</p>
                          <p className="text-[11px] text-gray-500">R {sale.total.toLocaleString()} · {sale.tenderMethod.toUpperCase()}</p>
                        </div>
                        <button
                          onClick={() => {
                            setActiveReceiptModal(sale);
                            setIsSearchFocused(false);
                            setSearchQuery('');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-600 hover:text-white text-xs font-semibold transition"
                        >
                          Receipt
                        </button>
                      </div>
                    ))}
                  </div>
                )}
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
              className={`px-4 py-2 rounded-lg text-[13px] font-medium transition-all whitespace-nowrap cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85A32] focus-visible:ring-offset-2 ${
                isActive
                  ? 'bg-white text-gray-900 font-semibold'
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
        <button
          onClick={() => setIsAccountPickerOpen(true)}
          className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-600 hover:bg-[#FDF0EA] hover:border-[#C85A32] hover:text-[#C85A32] transition-all group"
          title="Switch Account"
        >
          <ArrowLeftRight className="w-3.5 h-3.5 group-hover:rotate-180 transition-transform duration-500" />
          <span className="text-[11px] font-bold">Switch</span>
        </button>

        <div className="h-6 w-px bg-gray-200 hidden xl:block"></div>
        
        <button 
          type="button"
          onClick={() => setActiveTab('profile')}
          className="flex items-center gap-3 p-1 rounded-xl transition-colors group cursor-pointer"
        >
          <div className="text-right hidden xl:block">
            <p className="text-[11px] font-bold text-gray-900 leading-none truncate max-w-[120px]">
              {profile?.full_name || 'Staff Member'}
            </p>
            <p className="text-[10px] text-gray-400 font-mono mt-1 uppercase tracking-wider">
              {profile?.role?.replace('_', ' ') || 'Shift Active'}
            </p>
          </div>
          <div className={`w-9 h-9 rounded-xl border flex items-center justify-center text-xs font-semibold transition-all ${
            activeTab === 'profile' 
              ? 'bg-[#C85A32] border-[#C85A32] text-white shadow-xs' 
              : 'bg-white border-gray-200 text-gray-600 group-hover:border-gray-300 group-hover:text-gray-900'
          }`}>
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-full h-full object-cover rounded-lg" />
            ) : (
              <User className="w-4 h-4" />
            )}
          </div>
        </button>
      </div>
    </header>
  );
};

