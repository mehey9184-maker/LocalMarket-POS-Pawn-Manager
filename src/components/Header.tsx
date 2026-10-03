import React, { useState, useMemo } from 'react';
import { useApp, NavTab } from '../context/AppContext';
import { useSellers } from '../context/SellerContext';
import { useAuth } from '../context/AuthContext';
import { normalizeScannerInput } from '../utils/scannerNormalizer';
import { InventoryItem, PawnLoan } from '../types';
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

export type SearchResultType = 'inventory' | 'loan' | 'customer' | 'seller' | 'sale';

export interface ScoredResult {
  type: SearchResultType;
  data: any;
  score: number;
}

export function getSearchMatchScore(
  type: SearchResultType,
  item: any,
  query: string
): number {
  const q = query.toLowerCase();
  
  if (type === 'inventory') {
    const i = item as InventoryItem;
    const title = i.title.toLowerCase();
    const sku = i.sku.toLowerCase();
    const serial = i.serialOrImei?.toLowerCase() || '';
    
    if (sku === q) return 1;
    if (serial === q) return 2;
    if (title === q) return 3;
    if (sku.startsWith(q) || serial.startsWith(q) || title.startsWith(q)) return 4;
    return 5;
  }
  
  if (type === 'loan') {
    const l = item as PawnLoan;
    const ticket = l.ticketNumber.toLowerCase();
    const id = l.customerIdNumber.toLowerCase();
    const mobile = l.customerMobile.toLowerCase();
    const title = l.itemTitle.toLowerCase();
    const name = l.customerName.toLowerCase();
    
    if (ticket === q) return 1;
    if (id === q) return 2;
    if (mobile === q) return 3;
    if (title === q) return 4;
    if (ticket.startsWith(q) || id.startsWith(q) || mobile.startsWith(q) || name.startsWith(q) || title.startsWith(q)) return 5;
    return 6;
  }
  
  if (type === 'customer' || type === 'seller') {
    const p = item as any;
    const id = p.idNumber.toLowerCase();
    const mobile = p.mobile.toLowerCase();
    const name = p.fullName.toLowerCase();
    
    if (id === q) return 1;
    if (mobile === q) return 2;
    if (name === q) return 3;
    if (id.startsWith(q) || mobile.startsWith(q) || name.startsWith(q)) return 4;
    return 5;
  }
  
  if (type === 'sale') {
    const s = item as any; // SaleTransaction
    const rec = s.receiptNumber.toLowerCase();
    
    if (rec === q) return 1;
    if (rec.startsWith(q)) return 2;
    return 3;
  }
  
  return 100;
}

export function getBestSearchMatch(candidates: ScoredResult[]): ScoredResult | null {
  if (candidates.length === 0) return null;
  
  return [...candidates].sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    
    // Tie-breaker: Inventory → Loan → Sale → Customer → Seller
    const order: Record<SearchResultType, number> = {
      inventory: 1,
      loan: 2,
      sale: 3,
      customer: 4,
      seller: 5
    };
    
    return order[a.type] - order[b.type];
  })[0];
}

export function getSearchItemStatus(item: InventoryItem, pawnLoans: PawnLoan[]): {
  type: 'retail' | 'vault' | 'reserved' | 'pawned' | 'sold' | 'other';
  label: string;
  colorClass: string;
  linkedLoan: PawnLoan | undefined;
} {
  const isSold = item.status === 'Sold' || item.status === 'Redeemed';
  const isRetail = item.status === 'Retail Floor';
  const isVault = item.status === 'Vault Hold' || item.status === 'Forfeited';
  const isReserved = item.status === 'Reserved' || item.status === 'Flagged';

  const linkedLoan = pawnLoans.find(
    l => l.ticketNumber === item.pawnTicketId || (l.serialOrImei && item.serialOrImei && l.serialOrImei.toLowerCase() === item.serialOrImei.toLowerCase()) || l.itemId === item.id
  );
  const isPawned = Boolean(linkedLoan && linkedLoan.status === 'Active');

  if (isSold) {
    return { type: 'sold', label: 'Sold', colorClass: 'text-gray-500', linkedLoan: undefined };
  }
  if (isRetail) {
    return { type: 'retail', label: 'Available in Store', colorClass: 'text-emerald-600', linkedLoan: undefined };
  }
  if (isVault) {
    return { type: 'vault', label: 'In Vault', colorClass: 'text-amber-600', linkedLoan };
  }
  if (isReserved) {
    return { type: 'reserved', label: 'Reserved', colorClass: 'text-amber-700', linkedLoan: undefined };
  }
  if (isPawned) {
    return { type: 'pawned', label: 'Pawned', colorClass: 'text-blue-600', linkedLoan };
  }
  return { type: 'other', label: item.status, colorClass: 'text-gray-600', linkedLoan };
}

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
    setSelectedVaultLoan,
    setSelectedInventoryItem,
    showToast,
    shopProfile,
  } = useApp();

  const { profile, setIsAccountPickerOpen, hasPermission, isAtLeastSeniorCashier } = useAuth();
  const { sellers } = useSellers();

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Shared result-action dispatcher
  const activateSearchResult = (type: 'inventory' | 'loan' | 'customer' | 'seller' | 'sale', data: any) => {
    if (type === 'inventory') {
      const item = data as InventoryItem;
      const statusInfo = getSearchItemStatus(item, pawnLoans);
      
      if (statusInfo.type === 'retail' && hasPermission('sales')) {
        addToCart(item);
        setActiveTab('sell');
      } else if (statusInfo.type === 'vault') {
        if (statusInfo.linkedLoan) {
          setSelectedVaultLoan(statusInfo.linkedLoan);
        } else {
          setSelectedInventoryItem(item);
        }
        setActiveTab('vault');
      } else if (statusInfo.type === 'reserved') {
        setSelectedInventoryItem(item);
        setActiveTab('inventory');
      } else if (statusInfo.type === 'pawned' && statusInfo.linkedLoan) {
        setSelectedVaultLoan(statusInfo.linkedLoan);
        setActiveTab('vault');
      } else if (statusInfo.type === 'sold') {
        const saleByItemId = salesHistory.find(s =>
          s.items.some(si => si.item.id === item.id)
        );
        let matchingSale = saleByItemId;
        if (!matchingSale && item.serialOrImei) {
          const serialMatches = salesHistory.filter(s =>
            s.items.some(si =>
              Boolean(si.item.serialOrImei) &&
              si.item.serialOrImei!.toLowerCase() === item.serialOrImei!.toLowerCase()
            )
          );
          if (serialMatches.length === 1) matchingSale = serialMatches[0];
        }

        if (matchingSale) {
          setActiveReceiptModal(matchingSale);
        } else {
          setSelectedInventoryItem(item);
          setActiveTab('inventory');
        }
      } else {
        setSelectedInventoryItem(item);
        setActiveTab('inventory');
      }
    } else if (type === 'loan') {
      if (hasPermission('pawn')) {
        setSelectedVaultLoan(data);
        setActiveTab('vault');
      }
    } else if (type === 'seller') {
      setActiveCustomer(data);
      setActiveTab('buy-pawn');
    } else if (type === 'customer') {
      handleSelectCustomer(data, 'buy-pawn');
    } else if (type === 'sale') {
      setActiveReceiptModal(data);
    }

    setSearchQuery('');
    setIsSearchFocused(false);
  };

  // Universal Search across domains
  const searchResults = useMemo(() => {
    const q = normalizeScannerInput(searchQuery).toLowerCase();
    if (q.length < 2) return null;

    const inventoryMatches = inventory.filter(i => 
      i.title.toLowerCase().includes(q) ||
      i.sku.toLowerCase().includes(q) ||
      (i.serialOrImei && i.serialOrImei.toLowerCase().includes(q))
    ).sort((a, b) => 
      getSearchMatchScore('inventory', a, q) - getSearchMatchScore('inventory', b, q)
    ).slice(0, 3);

    const loanMatches = pawnLoans.filter(l =>
      l.ticketNumber.toLowerCase().includes(q) ||
      l.customerName.toLowerCase().includes(q) ||
      l.customerIdNumber.includes(q) ||
      l.customerMobile.includes(q) ||
      l.itemTitle.toLowerCase().includes(q)
    ).sort((a, b) => 
      getSearchMatchScore('loan', a, q) - getSearchMatchScore('loan', b, q)
    ).slice(0, 3);

    const customerMatches = customers.filter(c =>
      c.fullName.toLowerCase().includes(q) ||
      c.idNumber.includes(q) ||
      c.mobile.includes(q)
    ).sort((a, b) => 
      getSearchMatchScore('customer', a, q) - getSearchMatchScore('customer', b, q)
    ).slice(0, 3);

    const sellerMatches = sellers.filter(s =>
      s.fullName.toLowerCase().includes(q) ||
      s.idNumber.includes(q) ||
      s.mobile.includes(q)
    ).sort((a, b) => 
      getSearchMatchScore('seller', a, q) - getSearchMatchScore('seller', b, q)
    ).slice(0, 3);

    const saleMatches = salesHistory.filter(s =>
      s.receiptNumber.toLowerCase().includes(q)
    ).sort((a, b) => 
      getSearchMatchScore('sale', a, q) - getSearchMatchScore('sale', b, q)
    ).slice(0, 2);

    const totalCount = inventoryMatches.length + loanMatches.length + customerMatches.length + sellerMatches.length + saleMatches.length;

    // Collect all candidates for global bestMatch selection
    const allCandidates: ScoredResult[] = [
      ...inventoryMatches.map(data => ({ type: 'inventory' as const, data, score: getSearchMatchScore('inventory', data, q) })),
      ...loanMatches.map(data => ({ type: 'loan' as const, data, score: getSearchMatchScore('loan', data, q) })),
      ...saleMatches.map(data => ({ type: 'sale' as const, data, score: getSearchMatchScore('sale', data, q) })),
      ...customerMatches.map(data => ({ type: 'customer' as const, data, score: getSearchMatchScore('customer', data, q) })),
      ...sellerMatches.map(data => ({ type: 'seller' as const, data, score: getSearchMatchScore('seller', data, q) }))
    ];

    const bestMatch = getBestSearchMatch(allCandidates);

    return {
      inventory: inventoryMatches,
      loans: loanMatches,
      customers: customerMatches,
      sellers: sellerMatches,
      sales: saleMatches,
      totalCount,
      bestMatch
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
          {shopProfile?.logo_url || (shopProfile?.metadata as any)?.logo_url || (shopProfile?.id ? localStorage.getItem(`shop_logo_local_${shopProfile.id}`) : null) ? (
            <img 
              src={shopProfile.logo_url || (shopProfile.metadata as any)?.logo_url || localStorage.getItem(`shop_logo_local_${shopProfile.id}`) || ''} 
              alt={shopProfile.shop_name} 
              className="w-9 h-9 rounded-xl object-contain bg-white border border-gray-200 p-0.5 shadow-xs" 
            />
          ) : (
            <div className="w-9 h-9 rounded-xl bg-[#C85A32] flex items-center justify-center text-white font-bold text-sm tracking-wide shadow-xs group-hover:bg-[#A94725] transition-colors">
              LM
            </div>
          )}
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
            onKeyDown={(e) => {
              if (e.key === 'Enter' && searchResults?.bestMatch) {
                activateSearchResult(searchResults.bestMatch.type, searchResults.bestMatch.data);
              } else if (e.key === 'Escape') {
                setIsSearchFocused(false);
              }
            }}
            className="w-full bg-[#F8F9FA] border border-gray-200 rounded-xl py-2 pl-10 pr-4 text-[13px] text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-[#C85A32] focus:bg-white focus:ring-2 focus:ring-[#C85A32]/10 transition-all"
          />

          {/* Actionable Results Dropdown */}
          {isSearchFocused && searchResults && searchResults.totalCount > 0 && (
            <>
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setIsSearchFocused(false)} 
              />
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-2xl shadow-xl z-50 overflow-hidden max-h-[460px] overflow-y-auto divide-y divide-gray-100 animate-in fade-in slide-in-from-top-1 duration-200">
                <div className="bg-gray-50/50 px-4 py-1.5 border-b border-gray-100 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{searchResults.totalCount} Results Found</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-bold text-gray-400 bg-white border border-gray-200 px-1 rounded shadow-3xs italic">Enter to open best match</span>
                  </div>
                </div>

                {/* 1. INVENTORY MATCHES */}
                {searchResults.inventory.length > 0 && (
                  <div className="p-2">
                    <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                      <Package className="w-3 h-3 text-[#C85A32]" />
                      <span>Stock & Inventory</span>
                    </div>
                    {searchResults.inventory.map(item => {
                      const statusInfo = getSearchItemStatus(item, pawnLoans);

                      return (
                        <div key={item.id} className={`p-2 rounded-xl flex items-center justify-between gap-3 transition ${searchResults.bestMatch?.type === 'inventory' && searchResults.bestMatch?.data.id === item.id ? 'bg-orange-50/80 border border-orange-200 shadow-sm' : 'hover:bg-gray-50'}`}>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-gray-900 truncate">{item.title}</span>
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-bold">{item.sku}</span>
                              {searchResults.bestMatch?.type === 'inventory' && searchResults.bestMatch?.data.id === item.id && (
                                <span className="flex items-center gap-1 text-[9px] font-bold text-[#C85A32] bg-white border border-orange-200 px-1.5 py-0.5 rounded shadow-3xs">
                                  ENTER ↲
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-gray-500 flex items-center gap-2 mt-0.5">
                              <span className="font-mono font-bold text-gray-800">R {item.retailPrice.toLocaleString()}</span>
                              <span>•</span>
                              <span className={`text-[10px] font-medium ${statusInfo.colorClass}`}>{statusInfo.label}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {statusInfo.type === 'retail' && hasPermission('sales') && (
                              <button
                                onClick={() => activateSearchResult('inventory', item)}
                                className="px-2.5 py-1 rounded-lg bg-[#FDF0EA] text-[#C85A32] hover:bg-[#C85A32] hover:text-white text-xs font-semibold transition cursor-pointer"
                              >
                                Sell
                              </button>
                            )}
                            {statusInfo.type === 'vault' && (
                              <button
                                onClick={() => activateSearchResult('inventory', item)}
                                className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 text-xs font-semibold transition cursor-pointer"
                              >
                                {statusInfo.linkedLoan ? 'Open Loan' : 'Open in Vault'}
                              </button>
                            )}
                            {statusInfo.type === 'reserved' && (
                              <button
                                onClick={() => activateSearchResult('inventory', item)}
                                className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 hover:bg-amber-100 text-xs font-semibold transition cursor-pointer"
                              >
                                Open Item
                              </button>
                            )}
                            {statusInfo.type === 'pawned' && statusInfo.linkedLoan && (
                              <button
                                onClick={() => activateSearchResult('inventory', item)}
                                className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-semibold transition cursor-pointer"
                              >
                                Open Loan
                              </button>
                            )}
                            {statusInfo.type === 'sold' && (
                              <button
                                onClick={() => activateSearchResult('inventory', item)}
                                className="px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 text-xs font-semibold transition cursor-pointer"
                              >
                                Receipt
                              </button>
                            )}
                            {statusInfo.type === 'other' && (
                              <button
                                onClick={() => activateSearchResult('inventory', item)}
                                className="px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 text-xs font-semibold transition cursor-pointer"
                              >
                                View
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
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
                      <div key={loan.id} className={`p-2 rounded-xl flex items-center justify-between gap-3 transition ${searchResults.bestMatch?.type === 'loan' && searchResults.bestMatch?.data.id === loan.id ? 'bg-blue-50/80 border border-blue-200 shadow-sm' : 'hover:bg-gray-50'}`}>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-gray-900">{loan.customerName}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-bold">{loan.ticketNumber}</span>
                            {searchResults.bestMatch?.type === 'loan' && searchResults.bestMatch?.data.id === loan.id && (
                              <span className="flex items-center gap-1 text-[9px] font-bold text-blue-600 bg-white border border-blue-200 px-1.5 py-0.5 rounded shadow-3xs">
                                ENTER ↲
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-gray-500 truncate">{loan.itemTitle} · Principal: R {loan.principal}</p>
                        </div>
                        {hasPermission('pawn') && (
                          <button
                            onClick={() => activateSearchResult('loan', loan)}
                            className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white text-xs font-semibold transition cursor-pointer"
                          >
                            Open Loan
                          </button>
                        )}
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
                      <div key={seller.id} className={`p-2 rounded-xl flex items-center justify-between gap-3 transition ${searchResults.bestMatch?.type === 'seller' && searchResults.bestMatch?.data.id === seller.id ? 'bg-orange-50/80 border border-orange-200 shadow-sm' : 'hover:bg-gray-50'}`}>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-semibold text-gray-900 truncate">{seller.fullName}</p>
                            {searchResults.bestMatch?.type === 'seller' && searchResults.bestMatch?.data.id === seller.id && (
                              <span className="flex items-center gap-1 text-[9px] font-bold text-[#C85A32] bg-white border border-orange-200 px-1.5 py-0.5 rounded shadow-3xs">
                                ENTER ↲
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-gray-500 font-mono">ID: {seller.idNumber} · {seller.mobile}</p>
                        </div>
                        <button
                          onClick={() => activateSearchResult('seller', seller)}
                          className="px-2.5 py-1 rounded-lg bg-orange-50 text-[#C85A32] hover:bg-[#C85A32] hover:text-white text-xs font-semibold transition shrink-0"
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
                      <div key={customer.id} className={`p-2 rounded-xl flex items-center justify-between gap-3 transition ${searchResults.bestMatch?.type === 'customer' && searchResults.bestMatch?.data.id === customer.id ? 'bg-emerald-50/80 border border-emerald-200 shadow-sm' : 'hover:bg-gray-50'}`}>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-semibold text-gray-900 truncate">{customer.fullName}</p>
                            {searchResults.bestMatch?.type === 'customer' && searchResults.bestMatch?.data.id === customer.id && (
                              <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-600 bg-white border border-emerald-200 px-1.5 py-0.5 rounded shadow-3xs">
                                ENTER ↲
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-gray-500 font-mono">ID: {customer.idNumber} · {customer.mobile}</p>
                        </div>
                        <button
                          onClick={() => activateSearchResult('customer', customer)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white text-xs font-semibold transition shrink-0"
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
                      <div key={sale.id} className={`p-2 rounded-xl flex items-center justify-between gap-3 transition ${searchResults.bestMatch?.type === 'sale' && searchResults.bestMatch?.data.id === sale.id ? 'bg-purple-50/80 border border-purple-200 shadow-sm' : 'hover:bg-gray-50'}`}>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-bold font-mono text-gray-900 truncate">{sale.receiptNumber}</p>
                            {searchResults.bestMatch?.type === 'sale' && searchResults.bestMatch?.data.id === sale.id && (
                              <span className="flex items-center gap-1 text-[9px] font-bold text-purple-600 bg-white border border-purple-200 px-1.5 py-0.5 rounded shadow-3xs">
                                ENTER ↲
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-gray-500">R {sale.total.toLocaleString()} · {sale.tenderMethod.toUpperCase()}</p>
                        </div>
                        <button
                          onClick={() => activateSearchResult('sale', sale)}
                          className="px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-600 hover:text-white text-xs font-semibold transition shrink-0"
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

