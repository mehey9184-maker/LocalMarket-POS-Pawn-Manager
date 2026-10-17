/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { isPermanentManagerRole } from '../../utils/authRoles';
import { useSales } from '../../context/SalesContext';
import { useInventory } from '../../context/InventoryContext';
import { useLoans } from '../../context/LoanContext';
import {
  getShopTodayDateString,
  getShopRelativeDayThreshold,
  normalizeDateToShopYmd,
  formatShopDateTime,
  formatRand,
  DEFAULT_SHOP_TIMEZONE
} from '../../utils/shopDate';
import {
  BarChart3,
  TrendingUp,
  Package,
  Clock,
  ShoppingBag,
  ArrowDownRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  ShieldAlert,
  Search,
  Filter,
  Info,
  CheckCircle2,
  DollarSign,
  Layers,
  ArrowRight
} from 'lucide-react';

import { ItemStatus, PaymentMethod } from '../../types';

export function normalizePaymentMethodLabel(method: PaymentMethod | string | undefined | null): string {
  if (!method) return 'Unknown';
  const clean = method.toLowerCase().trim();
  if (clean === 'cash') return 'Cash';
  if (clean === 'card') return 'Card';
  if (clean === 'eft') return 'EFT';
  if (clean === 'snapscan') return 'SnapScan';
  return method.charAt(0).toUpperCase() + method.slice(1);
}

export const ALL_ITEM_STATUSES: ItemStatus[] = [
  'Retail Floor',
  'Vault Hold',
  'Forfeited',
  'Pending Forfeit',
  'Reserved',
  'Flagged',
  'Sold',
  'Redeemed',
  'Returned',
  'Reversed',
  'InStock'
];

export type AnalysisSection = 'overview' | 'sales' | 'stock' | 'loans';

interface TabItem {
  id: AnalysisSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TABS: TabItem[] = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'sales', label: 'Sales', icon: ShoppingBag },
  { id: 'stock', label: 'Stock', icon: Package },
  { id: 'loans', label: 'Pawn & Loans', icon: Clock }
];

const AnalysisWorkspace: React.FC = () => {
  const { setActiveTab, shopProfile } = useApp();
  const { salesHistory } = useSales();
  const { inventory } = useInventory();
  const { loans } = useLoans();

  const [activeSection, setActiveSection] = useState<AnalysisSection>('overview');
  const [salesSearch, setSalesSearch] = useState('');
  const [stockSearch, setStockSearch] = useState('');
  const [loanSearch, setLoanSearch] = useState('');

  // Horizontal sub-tab scrolling state & refs
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [hasOverflow, setHasOverflow] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const timezone = (shopProfile as any)?.timezone || DEFAULT_SHOP_TIMEZONE;

  // ---------------------------------------------------------------------------
  // 1. HORIZONTAL TAB SCROLL MANAGEMENT
  // ---------------------------------------------------------------------------
  const updateScrollState = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const tolerance = 2;
    const isOverflowing = el.scrollWidth > el.clientWidth + tolerance;
    setHasOverflow(isOverflowing);
    setCanScrollLeft(el.scrollLeft > tolerance);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - tolerance);
  }, []);

  useEffect(() => {
    updateScrollState();
    const el = scrollContainerRef.current;
    if (!el) return;

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => updateScrollState());
      observer.observe(el);
      return () => observer.disconnect();
    } else {
      window.addEventListener('resize', updateScrollState);
      return () => window.removeEventListener('resize', updateScrollState);
    }
  }, [updateScrollState]);

  // Keep selected tab scrolled into view automatically
  useEffect(() => {
    const el = tabRefs.current[activeSection];
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
    // Update scroll arrows after smooth scroll finishes
    const timer = setTimeout(updateScrollState, 250);
    return () => clearTimeout(timer);
  }, [activeSection, updateScrollState]);

  const handleScroll = (direction: 'left' | 'right') => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const scrollDistance = 180;
    el.scrollBy({
      left: direction === 'left' ? -scrollDistance : scrollDistance,
      behavior: 'smooth'
    });
  };

  // ---------------------------------------------------------------------------
  // 3. GENUINE DATA CALCULATIONS (South African Shop-Local Dates)
  // ---------------------------------------------------------------------------
  const todayYmd = useMemo(() => getShopTodayDateString(timezone), [timezone]);
  const threeDaysThresholdYmd = useMemo(() => getShopRelativeDayThreshold(3, timezone), [timezone]);

  // A. Sales Calculations
  const dailySales = useMemo(() => {
    return salesHistory.filter(s => normalizeDateToShopYmd(s.timestamp, timezone) === todayYmd);
  }, [salesHistory, todayYmd, timezone]);

  const salesTotals = useMemo(() => {
    const todayRevenue = dailySales.reduce((sum, s) => sum + (s.total || 0), 0);
    const todayCount = dailySales.length;
    const allTimeRevenue = salesHistory.reduce((sum, s) => sum + (s.total || 0), 0);
    const allTimeCount = salesHistory.length;
    const avgBasket = allTimeCount > 0 ? allTimeRevenue / allTimeCount : 0;

    // Payment method breakdown (All Time) - normalized standard methods from PaymentMethod in src/types.ts
    const byTender: Record<string, { count: number; total: number }> = {
      Cash: { count: 0, total: 0 },
      Card: { count: 0, total: 0 },
      EFT: { count: 0, total: 0 },
      SnapScan: { count: 0, total: 0 }
    };

    salesHistory.forEach(s => {
      const label = normalizePaymentMethodLabel(s.tenderMethod);
      if (!byTender[label]) byTender[label] = { count: 0, total: 0 };
      byTender[label].count += 1;
      byTender[label].total += (s.total || 0);
    });

    return {
      todayRevenue,
      todayCount,
      allTimeRevenue,
      allTimeCount,
      avgBasket,
      byTender
    };
  }, [dailySales, salesHistory]);

  // B. Outright Buys & Outlay Calculations
  const dailyBuys = useMemo(() => {
    return inventory.filter(i => 
      i.acquisitionType === 'Buy' && normalizeDateToShopYmd(i.addedAt, timezone) === todayYmd
    );
  }, [inventory, todayYmd, timezone]);

  const buyOutlays = useMemo(() => {
    const todaySpend = dailyBuys.reduce((sum, i) => sum + (i.costBasis || 0), 0);
    const todayCount = dailyBuys.length;
    return { todaySpend, todayCount };
  }, [dailyBuys]);

  // C. Pawn Loan Calculations
  const dailyLoans = useMemo(() => {
    return loans.filter(l => normalizeDateToShopYmd(l.startDate, timezone) === todayYmd);
  }, [loans, todayYmd, timezone]);

  const loanMetrics = useMemo(() => {
    const todayPrincipal = dailyLoans.reduce((sum, l) => sum + (l.principal || 0), 0);
    const todayCount = dailyLoans.length;

    const activeLoans = loans.filter(l => l.status === 'Active');
    const totalActivePrincipal = activeLoans.reduce((sum, l) => sum + (l.principal || 0), 0);
    const activeContractedFees = activeLoans.reduce((sum, l) => 
      sum + ((l.monthlyInterest || 0) + (l.monthlyStorageAdminFee || 0)), 0
    );

    const overdue = activeLoans.filter(l => {
      const expYmd = normalizeDateToShopYmd(l.expiryDate, timezone);
      return expYmd && expYmd < todayYmd;
    });

    const expiringSoon = activeLoans.filter(l => {
      const expYmd = normalizeDateToShopYmd(l.expiryDate, timezone);
      return expYmd && expYmd >= todayYmd && expYmd <= threeDaysThresholdYmd;
    });

    const goodStanding = activeLoans.filter(l => {
      const expYmd = normalizeDateToShopYmd(l.expiryDate, timezone);
      return expYmd && expYmd > threeDaysThresholdYmd;
    });

    const pendingForfeit = loans.filter(l => l.status === 'Pending Forfeit');
    const forfeited = loans.filter(l => l.status === 'Forfeited');

    const avgPrincipal = activeLoans.length > 0 ? totalActivePrincipal / activeLoans.length : 0;

    return {
      todayPrincipal,
      todayCount,
      activeLoans,
      totalActivePrincipal,
      activeContractedFees,
      avgPrincipal,
      overdue,
      expiringSoon,
      goodStanding,
      pendingForfeit,
      forfeited
    };
  }, [loans, dailyLoans, todayYmd, threeDaysThresholdYmd, timezone]);

  // D. Stock & Inventory Calculations
  const stockMetrics = useMemo(() => {
    const byStatus: Record<string, { count: number; retailTotal: number; costTotal: number; withCostCount: number }> = {};
    ALL_ITEM_STATUSES.forEach(status => {
      byStatus[status] = { count: 0, retailTotal: 0, costTotal: 0, withCostCount: 0 };
    });

    const byCategory: Record<string, { count: number; retailTotal: number }> = {};

    inventory.forEach(i => {
      const statusKey = i.status || 'Unknown';
      if (!byStatus[statusKey]) {
        byStatus[statusKey] = { count: 0, retailTotal: 0, costTotal: 0, withCostCount: 0 };
      }
      byStatus[statusKey].count += 1;
      byStatus[statusKey].retailTotal += (i.retailPrice || 0);
      if (i.costBasis != null && !isNaN(i.costBasis) && i.costBasis > 0) {
        byStatus[statusKey].costTotal += i.costBasis;
        byStatus[statusKey].withCostCount += 1;
      }

      // Category metrics strictly include items genuinely marked as Retail Floor
      if (i.status === 'Retail Floor') {
        const cat = i.category || 'General Goods';
        if (!byCategory[cat]) byCategory[cat] = { count: 0, retailTotal: 0 };
        byCategory[cat].count += 1;
        byCategory[cat].retailTotal += (i.retailPrice || 0);
      }
    });

    return {
      byStatus,
      byCategory,
      totalItems: inventory.length
    };
  }, [inventory]);

  // Filtered lists for table views
  const filteredSalesHistory = useMemo(() => {
    if (!salesSearch.trim()) return salesHistory.slice(0, 50);
    const q = salesSearch.toLowerCase().trim();
    return salesHistory.filter(s =>
      s.receiptNumber.toLowerCase().includes(q) ||
      s.cashier.toLowerCase().includes(q) ||
      (s.tenderMethod && s.tenderMethod.toLowerCase().includes(q))
    ).slice(0, 50);
  }, [salesHistory, salesSearch]);

  const filteredActiveLoans = useMemo(() => {
    const list = loanMetrics.activeLoans;
    if (!loanSearch.trim()) return list;
    const q = loanSearch.toLowerCase().trim();
    return list.filter(l =>
      l.ticketNumber.toLowerCase().includes(q) ||
      l.customerName.toLowerCase().includes(q) ||
      l.itemTitle.toLowerCase().includes(q) ||
      l.customerIdNumber.includes(q)
    );
  }, [loanMetrics.activeLoans, loanSearch]);

  return (
    <div className="flex-1 flex flex-col h-full w-full overflow-hidden bg-[#F5F6F8] text-[#1F2937]">
      {/* ============================================================
          TOP BAR: TITLE & HORIZONTAL SUB-TAB STRIP
         ============================================================ */}
      <div className="bg-white border-b border-gray-200 px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-gray-900 tracking-tight font-headline">
              Management Analysis
            </h1>
            <span className="text-[11px] font-semibold text-stone-500 bg-stone-100 border border-stone-200/80 px-2 py-0.5 rounded-md">
              Read-Only
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Operational summaries, genuine turnover, inventory valuations, and pledge portfolios.
          </p>
        </div>

        {/* HORIZONTAL SCROLLABLE TAB STRIP */}
        <div className="flex items-center gap-1 max-w-full sm:max-w-md bg-[#F3F4F6] p-1 rounded-xl border border-gray-200/80">
          {/* Scroll Left Arrow */}
          {hasOverflow && (
            <button
              type="button"
              aria-label="Scroll tabs left"
              disabled={!canScrollLeft}
              onClick={(e) => {
                e.stopPropagation();
                handleScroll('left');
              }}
              className={`shrink-0 p-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85A32] ${
                canScrollLeft
                  ? 'hover:bg-gray-50 hover:text-gray-900 cursor-pointer opacity-100 shadow-2xs'
                  : 'opacity-0 pointer-events-none'
              }`}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Sub-tabs List */}
          <div
            ref={scrollContainerRef}
            onScroll={updateScrollState}
            role="tablist"
            aria-label="Analysis Sections"
            className="flex items-center gap-1 overflow-x-auto no-scrollbar scroll-smooth px-0.5 py-0.5 max-w-full flex-1"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {TABS.map((tab) => {
              const isActive = activeSection === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  ref={(el) => {
                    tabRefs.current[tab.id] = el;
                  }}
                  role="tab"
                  aria-selected={isActive}
                  tabIndex={0}
                  onClick={() => setActiveSection(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85A32] focus-visible:ring-offset-1 cursor-pointer ${
                    isActive
                      ? 'bg-white text-gray-900 shadow-xs border border-gray-200/80 font-bold'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-white/50 border border-transparent'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#C85A32]' : 'text-gray-400'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Scroll Right Arrow */}
          {hasOverflow && (
            <button
              type="button"
              aria-label="Scroll tabs right"
              disabled={!canScrollRight}
              onClick={(e) => {
                e.stopPropagation();
                handleScroll('right');
              }}
              className={`shrink-0 p-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85A32] ${
                canScrollRight
                  ? 'hover:bg-gray-50 hover:text-gray-900 cursor-pointer opacity-100 shadow-2xs'
                  : 'opacity-0 pointer-events-none'
              }`}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ============================================================
          MAIN BODY CONTAINER
         ============================================================ */}
      <div className="flex-1 overflow-y-auto p-6 max-w-7xl w-full mx-auto space-y-6">

        {/* ------------------------------------------------------------
            SECTION 1: OVERVIEW
           ------------------------------------------------------------ */}
        {activeSection === 'overview' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* TODAY'S FINANCIAL COUNTER ACTIVITY */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-gray-100">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 font-mono">
                    Today's Counter Activity ({todayYmd})
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Real-time transaction inflow and operational cash disbursements.
                  </p>
                </div>
                <div className="text-xs text-gray-400 font-mono">
                  Timezone: {timezone}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. SALES REVENUE */}
                <div className="bg-emerald-50/50 border border-emerald-200/70 rounded-xl p-4">
                  <div className="flex items-center justify-between text-emerald-800 text-xs font-semibold">
                    <span className="flex items-center gap-1.5">
                      <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                      Gross Sales Revenue (Pre-Refund)
                    </span>
                    <span className="text-[11px] font-mono text-emerald-700 bg-emerald-100/70 px-1.5 py-0.5 rounded">
                      {salesTotals.todayCount} {salesTotals.todayCount === 1 ? 'sale' : 'sales'}
                    </span>
                  </div>
                  <div className="mt-2 text-2xl font-bold font-mono text-gray-900 tracking-tight">
                    {formatRand(salesTotals.todayRevenue)}
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Gross intake from completed customer sales (pre-refund; refund deductions not included).
                  </p>
                </div>

                {/* 2. STOCK PURCHASE OUTLAY */}
                <div className="bg-blue-50/50 border border-blue-200/70 rounded-xl p-4">
                  <div className="flex items-center justify-between text-blue-800 text-xs font-semibold">
                    <span className="flex items-center gap-1.5">
                      <ArrowDownRight className="w-4 h-4 text-blue-600" />
                      Stock Purchase Spend
                    </span>
                    <span className="text-[11px] font-mono text-blue-700 bg-blue-100/70 px-1.5 py-0.5 rounded">
                      {buyOutlays.todayCount} {buyOutlays.todayCount === 1 ? 'buy' : 'buys'}
                    </span>
                  </div>
                  <div className="mt-2 text-2xl font-bold font-mono text-gray-900 tracking-tight">
                    {formatRand(buyOutlays.todaySpend)}
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Cash disbursed for second-hand purchases.
                  </p>
                </div>

                {/* 3. PAWN PRINCIPAL ADVANCED */}
                <div className="bg-amber-50/50 border border-amber-200/70 rounded-xl p-4">
                  <div className="flex items-center justify-between text-amber-800 text-xs font-semibold">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-amber-600" />
                      Pawn Principal Advanced
                    </span>
                    <span className="text-[11px] font-mono text-amber-700 bg-amber-100/70 px-1.5 py-0.5 rounded">
                      {loanMetrics.todayCount} {loanMetrics.todayCount === 1 ? 'loan' : 'loans'}
                    </span>
                  </div>
                  <div className="mt-2 text-2xl font-bold font-mono text-gray-900 tracking-tight">
                    {formatRand(loanMetrics.todayPrincipal)}
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Cash advanced for statutory 30-day pledges.
                  </p>
                </div>
              </div>

              {/* ACCOUNTING DISTINCTION & DISCLAIMER NOTICE */}
              <div className="bg-[#F8F9FA] rounded-xl border border-gray-200 p-3.5 flex items-start gap-3 text-xs text-gray-600">
                <Info className="w-4 h-4 text-[#C85A32] shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-gray-800">
                    Financial Distinction & Calculation Policy
                  </p>
                  <p className="text-[11px] text-gray-500 leading-relaxed">
                    Gross recorded sales figures are pre-refund; refund adjustments are not deducted. Keep revenue, stock purchase outlay, pawn principal advanced and projected contractual fees distinct. Projected contractual fees represent uncollected potential earnings upon redemption and must not be treated as realized revenue. Inventory retail tag values reflect asking prices, not profit. Profit calculations require completed cost reconciliation, staff overhead, and finalized refund adjustments.
                  </p>
                </div>
              </div>
            </div>

            {/* OPERATIONAL SNAPSHOT TILES */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Floor Stock */}
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs">
                <div className="flex items-center justify-between text-xs text-gray-500 font-medium">
                  <span>Retail Floor Stock</span>
                  <Package className="w-4 h-4 text-stone-400" />
                </div>
                <div className="text-xl font-bold font-mono text-gray-900 mt-2">
                  {stockMetrics.byStatus['Retail Floor']?.count || 0} items
                </div>
                <div className="text-xs text-gray-500 font-mono mt-0.5">
                  Floor Value: {formatRand(stockMetrics.byStatus['Retail Floor']?.retailTotal || 0)}
                </div>
              </div>

              {/* Active Pawn Loans */}
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs">
                <div className="flex items-center justify-between text-xs text-gray-500 font-medium">
                  <span>Active Pawn Collateral</span>
                  <Clock className="w-4 h-4 text-stone-400" />
                </div>
                <div className="text-xl font-bold font-mono text-gray-900 mt-2">
                  {loanMetrics.activeLoans.length} active loans
                </div>
                <div className="text-xs text-gray-500 font-mono mt-0.5">
                  Principal: {formatRand(loanMetrics.totalActivePrincipal)}
                </div>
              </div>

              {/* Overdue Loans */}
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs">
                <div className="flex items-center justify-between text-xs text-gray-500 font-medium">
                  <span>Overdue Pledges</span>
                  <AlertTriangle className="w-4 h-4 text-rose-500" />
                </div>
                <div className={`text-xl font-bold font-mono mt-2 ${loanMetrics.overdue.length > 0 ? 'text-rose-600' : 'text-gray-900'}`}>
                  {loanMetrics.overdue.length} overdue
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  Past agreed expiry date
                </div>
              </div>

              {/* Expiring Soon */}
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs">
                <div className="flex items-center justify-between text-xs text-gray-500 font-medium">
                  <span>Expiring Within 3 Days</span>
                  <Clock className="w-4 h-4 text-amber-500" />
                </div>
                <div className="text-xl font-bold font-mono text-gray-900 mt-2">
                  {loanMetrics.expiringSoon.length} expiring
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  Actionable for client contact
                </div>
              </div>
            </div>

            {/* QUICK NAVIGATION SHORTCUTS */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 font-mono mb-3">
                Direct Ledger Navigation
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('inventory')}
                  className="flex items-center justify-between p-3 rounded-xl border border-gray-200 hover:border-[#C85A32] hover:bg-[#FDF0EA]/30 transition group text-left cursor-pointer"
                >
                  <div>
                    <p className="text-xs font-bold text-gray-900 group-hover:text-[#C85A32]">Open Inventory</p>
                    <p className="text-[11px] text-gray-500">Audit physical catalog & labels</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-[#C85A32] group-hover:translate-x-0.5 transition" />
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('vault')}
                  className="flex items-center justify-between p-3 rounded-xl border border-gray-200 hover:border-[#C85A32] hover:bg-[#FDF0EA]/30 transition group text-left cursor-pointer"
                >
                  <div>
                    <p className="text-xs font-bold text-gray-900 group-hover:text-[#C85A32]">Open Vault</p>
                    <p className="text-[11px] text-gray-500">Manage pledges & forfeitures</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-[#C85A32] group-hover:translate-x-0.5 transition" />
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('customers')}
                  className="flex items-center justify-between p-3 rounded-xl border border-gray-200 hover:border-[#C85A32] hover:bg-[#FDF0EA]/30 transition group text-left cursor-pointer"
                >
                  <div>
                    <p className="text-xs font-bold text-gray-900 group-hover:text-[#C85A32]">Open Customers</p>
                    <p className="text-[11px] text-gray-500">View client registers & history</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-[#C85A32] group-hover:translate-x-0.5 transition" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------
            SECTION 2: SALES
           ------------------------------------------------------------ */}
        {activeSection === 'sales' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* SALES SUMMARY METRICS */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
                <span className="text-xs font-medium text-gray-500">Total Gross Recorded Sales (Pre-Refund)</span>
                <div className="text-2xl font-bold font-mono text-gray-900 mt-1">
                  {formatRand(salesTotals.allTimeRevenue)}
                </div>
                <p className="text-[11px] text-gray-500 mt-1">
                  Across {salesTotals.allTimeCount} completed transactions before refund deductions
                </p>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
                <span className="text-xs font-medium text-gray-500">Today's Gross Sales (Pre-Refund)</span>
                <div className="text-2xl font-bold font-mono text-emerald-600 mt-1">
                  {formatRand(salesTotals.todayRevenue)}
                </div>
                <p className="text-[11px] text-gray-500 mt-1">
                  {salesTotals.todayCount} completed transactions recorded today ({todayYmd})
                </p>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
                <span className="text-xs font-medium text-gray-500">Average Transaction Size (Pre-Refund)</span>
                <div className="text-2xl font-bold font-mono text-gray-900 mt-1">
                  {formatRand(salesTotals.avgBasket)}
                </div>
                <p className="text-[11px] text-gray-500 mt-1">
                  Mean counter receipt value (pre-refund)
                </p>
              </div>
            </div>

            {/* PAYMENT METHOD BREAKDOWN */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-3">
              <h3 className="text-sm font-bold text-gray-900 font-headline">
                Payment Method Breakdown
              </h3>
              <p className="text-xs text-gray-500">
                Distribution of recorded counter sales by tender type.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                {Object.entries(salesTotals.byTender).map(([tender, data]) => {
                  const pct = salesTotals.allTimeRevenue > 0
                    ? Math.round((data.total / salesTotals.allTimeRevenue) * 100)
                    : 0;

                  return (
                    <div key={tender} className="bg-gray-50 rounded-xl p-3.5 border border-gray-100">
                      <div className="flex items-center justify-between text-xs text-gray-600">
                        <span className="font-semibold">{tender}</span>
                        <span className="text-gray-400 font-mono text-[11px]">{pct}%</span>
                      </div>
                      <div className="text-base font-bold font-mono text-gray-900 mt-1">
                        {formatRand(data.total)}
                      </div>
                      <div className="text-[11px] text-gray-400 mt-0.5">
                        {data.count} {data.count === 1 ? 'sale' : 'sales'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* RECENT SALES TABLE */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 font-headline">
                    Recent Sales Transactions
                  </h3>
                  <p className="text-xs text-gray-500">
                    Read-only log of recent register receipts.
                  </p>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search receipt, cashier..."
                    value={salesSearch}
                    onChange={(e) => setSalesSearch(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-[#C85A32] focus:bg-white"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50/80 border-b border-gray-100 text-gray-500 font-medium uppercase font-mono text-[10px] tracking-wider">
                    <tr>
                      <th className="px-5 py-3">Receipt #</th>
                      <th className="px-4 py-3">Date & Time</th>
                      <th className="px-4 py-3">Cashier</th>
                      <th className="px-4 py-3">Tender</th>
                      <th className="px-4 py-3 text-right">Items</th>
                      <th className="px-5 py-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-700">
                    {filteredSalesHistory.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-5 py-8 text-center text-gray-400">
                          No sales transactions found.
                        </td>
                      </tr>
                    ) : (
                      filteredSalesHistory.map(sale => (
                        <tr key={sale.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-5 py-3 font-mono font-bold text-gray-900">
                            {sale.receiptNumber}
                          </td>
                          <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                            {formatShopDateTime(sale.timestamp, timezone)}
                          </td>
                          <td className="px-4 py-3 text-gray-800">
                            {sale.cashier || 'Staff'}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-700">
                              {sale.tenderMethod}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-gray-600">
                            {sale.items?.length || 0}
                          </td>
                          <td className="px-5 py-3 text-right font-mono font-bold text-gray-900">
                            {formatRand(sale.total)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------
            SECTION 3: STOCK
           ------------------------------------------------------------ */}
        {activeSection === 'stock' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* STOCK SNAPSHOT BY STATUS */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs">
                <span className="text-xs font-medium text-gray-500">Retail Floor</span>
                <div className="text-xl font-bold font-mono text-gray-900 mt-1">
                  {stockMetrics.byStatus['Retail Floor']?.count || 0}
                </div>
                <div className="text-xs text-gray-500 font-mono mt-0.5">
                  Value: {formatRand(stockMetrics.byStatus['Retail Floor']?.retailTotal || 0)}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs">
                <span className="text-xs font-medium text-gray-500">Vault Hold</span>
                <div className="text-xl font-bold font-mono text-amber-700 mt-1">
                  {stockMetrics.byStatus['Vault Hold']?.count || 0}
                </div>
                <div className="text-xs text-gray-500 font-mono mt-0.5">
                  Collateral: {formatRand(stockMetrics.byStatus['Vault Hold']?.retailTotal || 0)}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs">
                <span className="text-xs font-medium text-gray-500">Forfeited</span>
                <div className="text-xl font-bold font-mono text-gray-900 mt-1">
                  {stockMetrics.byStatus['Forfeited']?.count || 0}
                </div>
                <div className="text-xs text-gray-500 font-mono mt-0.5">
                  Ready for floor
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs">
                <span className="text-xs font-medium text-gray-500">Sold (Historical)</span>
                <div className="text-xl font-bold font-mono text-gray-400 mt-1">
                  {stockMetrics.byStatus['Sold']?.count || 0}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  Archived records
                </div>
              </div>
            </div>

            {/* INVENTORY STATUS BREAKDOWN (ALL VALID STATUSES) */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 font-headline">
                    Inventory Status Breakdown
                  </h3>
                  <p className="text-xs text-gray-500">
                    Comprehensive catalog audit across all valid operational and statutory statuses.
                  </p>
                </div>
                <div className="text-xs text-gray-500 font-mono">
                  {stockMetrics.totalItems} total catalog records
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-1">
                {ALL_ITEM_STATUSES.map(status => {
                  const stats = stockMetrics.byStatus[status] || { count: 0, retailTotal: 0 };
                  return (
                    <div key={status} className="bg-gray-50/80 rounded-xl p-3 border border-gray-100 flex flex-col justify-between">
                      <span className="text-[11px] font-medium text-gray-600 truncate">{status}</span>
                      <div className="mt-1 flex items-baseline justify-between gap-1">
                        <span className="text-base font-bold font-mono text-gray-900">{stats.count}</span>
                        <span className="text-[10px] text-gray-400 font-mono">{formatRand(stats.retailTotal)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* FINANCIAL VALUATION TRANSPARENCY */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
              <div>
                <h3 className="text-sm font-bold text-gray-900 font-headline">
                  Floor Stock Valuation & Recorded Cost Basis
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Detailed comparison between retail price tag value and verified acquisition cost basis. Shelf asking prices do not represent profit.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <span className="text-xs text-gray-500">Total Retail Tag Value</span>
                  <div className="text-xl font-bold font-mono text-gray-900 mt-1">
                    {formatRand(stockMetrics.byStatus['Retail Floor']?.retailTotal || 0)}
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">
                    Combined shelf prices for items on floor
                  </p>
                </div>

                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <span className="text-xs text-gray-500">Recorded Cost Basis</span>
                  <div className="text-xl font-bold font-mono text-gray-900 mt-1">
                    {formatRand(stockMetrics.byStatus['Retail Floor']?.costTotal || 0)}
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">
                    For items with verified purchase cost
                  </p>
                </div>

                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <span className="text-xs text-gray-500">Cost Basis Availability</span>
                  <div className="text-xl font-bold font-mono text-gray-900 mt-1">
                    {stockMetrics.byStatus['Retail Floor']?.withCostCount || 0} / {stockMetrics.byStatus['Retail Floor']?.count || 0}
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">
                    Items with explicit acquisition costs
                  </p>
                </div>
              </div>

              <div className="text-xs text-gray-500 bg-[#FDF0EA]/50 border border-orange-200/50 rounded-xl p-3">
                <span className="font-semibold text-[#C85A32]">Cost Accuracy & Valuation Note: </span>
                Items added without an explicit purchase amount are excluded from cost basis totals to maintain financial integrity. Total retail values reflect asking prices, not realized revenue or profit.
              </div>
            </div>

            {/* CATEGORY BREAKDOWN TABLE */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-gray-100">
                <h3 className="text-sm font-bold text-gray-900 font-headline">
                  Floor Stock by Category
                </h3>
                <p className="text-xs text-gray-500">
                  Distribution of active retail items across categories.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50/80 border-b border-gray-100 text-gray-500 font-medium uppercase font-mono text-[10px] tracking-wider">
                    <tr>
                      <th className="px-5 py-3">Category</th>
                      <th className="px-4 py-3 text-right">Items on Floor</th>
                      <th className="px-5 py-3 text-right">Total Retail Value</th>
                      <th className="px-5 py-3 text-right">Average Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-700">
                    {Object.keys(stockMetrics.byCategory).length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-5 py-8 text-center text-gray-400">
                          No items on retail floor.
                        </td>
                      </tr>
                    ) : (
                      Object.entries(stockMetrics.byCategory)
                        .sort((a, b) => b[1].retailTotal - a[1].retailTotal)
                        .map(([cat, data]) => {
                          const avgPrice = data.count > 0 ? data.retailTotal / data.count : 0;
                          return (
                            <tr key={cat} className="hover:bg-gray-50/50 transition-colors">
                              <td className="px-5 py-3 font-semibold text-gray-800">
                                {cat}
                              </td>
                              <td className="px-4 py-3 text-right font-mono font-medium text-gray-700">
                                {data.count}
                              </td>
                              <td className="px-5 py-3 text-right font-mono font-bold text-gray-900">
                                {formatRand(data.retailTotal)}
                              </td>
                              <td className="px-5 py-3 text-right font-mono text-gray-500">
                                {formatRand(avgPrice)}
                              </td>
                            </tr>
                          );
                        })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------
            SECTION 4: PAWN & LOANS
           ------------------------------------------------------------ */}
        {activeSection === 'loans' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* PORTFOLIO SUMMARY CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
                <span className="text-xs font-medium text-gray-500">Active Pledge Count</span>
                <div className="text-2xl font-bold font-mono text-gray-900 mt-1">
                  {loanMetrics.activeLoans.length}
                </div>
                <p className="text-[11px] text-gray-500 mt-1">
                  Secured loans currently held
                </p>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
                <span className="text-xs font-medium text-gray-500">Total Capital Advanced</span>
                <div className="text-2xl font-bold font-mono text-gray-900 mt-1">
                  {formatRand(loanMetrics.totalActivePrincipal)}
                </div>
                <p className="text-[11px] text-gray-500 mt-1">
                  Outstanding principal balance
                </p>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
                <span className="text-xs font-medium text-gray-500">Projected Monthly Fees</span>
                <div className="text-2xl font-bold font-mono text-emerald-600 mt-1">
                  {formatRand(loanMetrics.activeContractedFees)}
                </div>
                <p className="text-[11px] text-gray-500 mt-1">
                  Monthly interest & storage fees
                </p>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
                <span className="text-xs font-medium text-gray-500">Average Principal</span>
                <div className="text-2xl font-bold font-mono text-gray-900 mt-1">
                  {formatRand(loanMetrics.avgPrincipal)}
                </div>
                <p className="text-[11px] text-gray-500 mt-1">
                  Mean loan advance
                </p>
              </div>
            </div>

            {/* EXPIRY RISK BREAKDOWN */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
              <div>
                <h3 className="text-sm font-bold text-gray-900 font-headline">
                  Statutory 30-Day Term Status
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Portfolio classified by South African shop-local expiry dates.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-4">
                  <div className="flex items-center justify-between text-xs font-semibold text-rose-800">
                    <span>Overdue Collateral</span>
                    <AlertTriangle className="w-4 h-4 text-rose-500" />
                  </div>
                  <div className="text-2xl font-bold font-mono text-rose-700 mt-2">
                    {loanMetrics.overdue.length}
                  </div>
                  <p className="text-[11px] text-rose-600/80 mt-1">
                    Expired past 30 days — eligible for review or floor forfeiture
                  </p>
                </div>

                <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4">
                  <div className="flex items-center justify-between text-xs font-semibold text-amber-800">
                    <span>Expiring in 3 Days</span>
                    <Clock className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="text-2xl font-bold font-mono text-amber-800 mt-2">
                    {loanMetrics.expiringSoon.length}
                  </div>
                  <p className="text-[11px] text-amber-700/80 mt-1">
                    Reaching statutory expiry shortly
                  </p>
                </div>

                <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4">
                  <div className="flex items-center justify-between text-xs font-semibold text-emerald-800">
                    <span>Current / Good Standing</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="text-2xl font-bold font-mono text-emerald-800 mt-2">
                    {loanMetrics.goodStanding.length}
                  </div>
                  <p className="text-[11px] text-emerald-700/80 mt-1">
                    More than 3 days remaining
                  </p>
                </div>
              </div>
            </div>

            {/* ACTIVE LOANS REGISTER */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 font-headline">
                    Active Pawn Loans Register
                  </h3>
                  <p className="text-xs text-gray-500">
                    Active pledges currently held in custody.
                  </p>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search ticket, customer, item..."
                    value={loanSearch}
                    onChange={(e) => setLoanSearch(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-[#C85A32] focus:bg-white"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50/80 border-b border-gray-100 text-gray-500 font-medium uppercase font-mono text-[10px] tracking-wider">
                    <tr>
                      <th className="px-5 py-3">Ticket #</th>
                      <th className="px-4 py-3">Customer</th>
                      <th className="px-4 py-3">Collateral Item</th>
                      <th className="px-4 py-3 text-right">Principal</th>
                      <th className="px-4 py-3">Expiry Date</th>
                      <th className="px-5 py-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-700">
                    {filteredActiveLoans.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-5 py-8 text-center text-gray-400">
                          No active pawn loans found.
                        </td>
                      </tr>
                    ) : (
                      filteredActiveLoans.map(loan => {
                        const expYmd = normalizeDateToShopYmd(loan.expiryDate, timezone);
                        const isOverdue = expYmd && expYmd < todayYmd;
                        const isExpiringSoon = expYmd && expYmd >= todayYmd && expYmd <= threeDaysThresholdYmd;

                        return (
                          <tr key={loan.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-5 py-3 font-mono font-bold text-gray-900">
                              {loan.ticketNumber}
                            </td>
                            <td className="px-4 py-3 text-gray-800">
                              <span className="font-semibold block">{loan.customerName}</span>
                              <span className="text-[10px] text-gray-400 font-mono">{loan.customerIdNumber}</span>
                            </td>
                            <td className="px-4 py-3 text-gray-700">
                              <span className="font-medium block truncate max-w-[200px]">{loan.itemTitle}</span>
                              <span className="text-[10px] text-gray-400">{loan.itemCategory}</span>
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-bold text-gray-900">
                              {formatRand(loan.principal)}
                            </td>
                            <td className="px-4 py-3 font-mono text-gray-600 whitespace-nowrap">
                              {expYmd || loan.expiryDate}
                            </td>
                            <td className="px-5 py-3 text-right whitespace-nowrap">
                              {isOverdue ? (
                                <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-100 text-rose-800 border border-rose-200">
                                  Overdue
                                </span>
                              ) : isExpiringSoon ? (
                                <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                                  Expiring Soon
                                </span>
                              ) : (
                                <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                  Good Standing
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export const Analysis: React.FC = () => {
  const { setActiveTab } = useApp();
  const {
    profile,
    isProfileLoading,
    isSwitchingAccount,
    isLoading: authLoading
  } = useAuth();

  const isAuthorized = isPermanentManagerRole(profile?.role);

  // ---------------------------------------------------------------------------
  // ACCESS ENFORCEMENT & HARD NAVIGATION GUARD
  // ---------------------------------------------------------------------------
  useEffect(() => {
    // Never redirect while auth or profile is resolving, or during an account switch
    if (authLoading || isProfileLoading || isSwitchingAccount) return;

    // Hard guard: Cashier and Senior Cashier must not access Analysis
    if (!isAuthorized) {
      const isStandardCashier = profile?.role === 'cashier';
      setActiveTab(isStandardCashier ? 'sell' : 'home');
    }
  }, [isAuthorized, authLoading, isProfileLoading, isSwitchingAccount, profile?.role, setActiveTab]);

  // Prevent any DOM rendering or metric leakage to unauthorized roles
  if (authLoading || isProfileLoading || isSwitchingAccount || !isAuthorized) {
    return null;
  }

  return <AnalysisWorkspace />;
};
