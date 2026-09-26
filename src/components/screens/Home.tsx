import React, { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useInventory } from '../../context/InventoryContext';
import { useLoans } from '../../context/LoanContext';
import { useSales } from '../../context/SalesContext';
import { 
  ShoppingBag, 
  ArrowRightLeft, 
  Lock, 
  Clock, 
  TrendingUp, 
  ChevronRight,
  Package,
  User,
  Plus,
  Search,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';

export const Home: React.FC = () => {
  const { setActiveTab, shopProfile } = useApp();
  const { user, hasPermission, isAtLeastSeniorCashier } = useAuth();
  const { inventory } = useInventory();
  const { loans } = useLoans();
  const { salesHistory } = useSales();

  // 1. Calculate Operational States (Preserved exactly)
  const today = new Date().toISOString().split('T')[0];
  const threeDaysFromNow = new Date();
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
  const expiryThreshold = threeDaysFromNow.toISOString().split('T')[0];

  const dailySales = useMemo(() => salesHistory.filter(s => s.timestamp.startsWith(today)), [salesHistory, today]);
  const dailyBuys = useMemo(() => inventory.filter(i => (i.acquisitionType === 'Buy' || i.acquisitionType === 'Existing Stock') && i.addedAt.startsWith(today)), [inventory, today]);
  const dailyPawns = useMemo(() => loans.filter(l => l.startDate.startsWith(today)), [loans, today]);

  const activeLoans = useMemo(() => loans.filter(l => l.status === 'Active'), [loans]);
  const expiringSoon = useMemo(() => activeLoans.filter(l => l.expiryDate <= expiryThreshold && l.expiryDate >= today), [activeLoans, expiryThreshold, today]);
  const overdueLoans = useMemo(() => activeLoans.filter(l => l.expiryDate < today), [activeLoans, today]);
  const pendingApproval = useMemo(() => loans.filter(l => l.status === 'Pending Forfeit'), [loans]);
  
  const readyForRetail = useMemo(() => inventory.filter(i => i.status === 'Vault Hold' && i.acquisitionType === 'Forfeited'), [inventory]);

  const todayTotals = useMemo(() => ({
    sales: dailySales.length,
    salesValue: dailySales.reduce((sum, s) => sum + s.total, 0),
    buys: dailyBuys.length,
    pawns: dailyPawns.length,
    payouts: dailyBuys.reduce((sum, i) => sum + (i.costBasis || 0), 0) + dailyPawns.reduce((sum, l) => sum + l.principal, 0)
  }), [dailySales, dailyBuys, dailyPawns]);

  // Check if this is a brand-new empty shop
  const isBrandNewShop = inventory.length === 0 && loans.length === 0 && salesHistory.length === 0;

  // Context-aware greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const staffName = user?.user_metadata?.full_name || 'Staff Member';

  return (
    <div className="relative flex-1 overflow-y-auto no-scrollbar font-sans text-stone-900 bg-stone-50/60 selection:bg-[#FDF0EA] selection:text-[#C85A32]">
      {/* Subtle Atmospheric Sky Background (Consistent with Auth & Setup, restrained for workspace) */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0 select-none" aria-hidden="true">
        <div className="absolute inset-0 bg-gradient-to-b from-[#EEF4F8]/60 via-[#F7F7F5]/70 to-[#F6EFE8]/40" />
        <div className="cloud-layer-1 absolute -top-20 -left-20 w-[140%] h-[35%] opacity-20 filter blur-3xl" />
        <div className="cloud-layer-2 absolute top-[30%] -left-32 w-[150%] h-[35%] opacity-15 filter blur-[46px]" />
      </div>

      {/* TOP STATUS BAR */}
      <header className="relative z-10 px-6 lg:px-8 py-3.5 bg-white/95 backdrop-blur-md border-b border-stone-200/90 flex items-center justify-between sticky top-0 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#FDF0EA] text-[#C85A32] flex items-center justify-center font-bold">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-stone-900 leading-tight">
                {shopProfile.shop_name || 'LocalMarket'}
              </span>
              <span className="text-[11px] font-medium text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full">
                Main Counter
              </span>
            </div>
            <p className="text-[11px] text-stone-500">LocalMarket POS Workspace</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-[11px] text-stone-400 font-medium">Logged in</p>
            <p className="text-xs font-semibold text-stone-800">{staffName}</p>
          </div>
          <div className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 flex items-center gap-1.5 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-semibold text-emerald-800">Ready</span>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <div className="relative z-10 p-6 lg:p-8 max-w-[1400px] mx-auto space-y-8 animate-auth-fade">
        
        {/* ============================================================
            HERO / WELCOME SECTION
           ============================================================ */}
        {isBrandNewShop ? (
          /* Brand-New Shop Welcome (Intentional first-run experience) */
          <section className="bg-white/95 backdrop-blur-md border border-stone-200/90 rounded-2xl p-7 sm:p-9 shadow-sm">
            <div className="max-w-2xl space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FDF0EA] text-[#C85A32] text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Shop initialized successfully</span>
              </div>
              <h1 className="font-headline font-bold text-2xl sm:text-3xl text-stone-900 tracking-tight">
                Welcome to LocalMarket
              </h1>
              <p className="text-stone-600 text-sm sm:text-base leading-relaxed">
                Your shop is ready. Let’s get your first item in so you can start selling or managing customer pledges.
              </p>
            </div>
          </section>
        ) : (
          /* Established Shop Header */
          <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="font-headline font-bold text-2xl sm:text-3xl text-stone-900 tracking-tight">
                {greeting}, {staffName}
              </h1>
              <p className="text-stone-500 text-sm mt-1">
                Your shop is open. What would you like to do?
              </p>
            </div>
          </section>
        )}

        {/* ============================================================
            PRIMARY ACTION CARDS
           ============================================================ */}
        {isBrandNewShop ? (
          /* FIRST-RUN ACTION LAYOUT: Clear primary emphasis on Add Stock */
          <section className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* PRIMARY CARD: Add First Item */}
              {hasPermission('sellerAcquisitions') && (
                <div className="lg:col-span-2 group relative p-7 rounded-2xl bg-gradient-to-br from-white via-white to-[#FDF9F6] border-2 border-[#C85A32]/30 hover:border-[#C85A32] shadow-sm hover:shadow-md transition-all duration-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                    <div className="space-y-3 max-w-md">
                      <div className="w-12 h-12 rounded-xl bg-[#FDF0EA] text-[#C85A32] flex items-center justify-center shadow-xs">
                        <Package className="w-6 h-6" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-stone-900 group-hover:text-[#C85A32] transition-colors">
                          Add your first item
                        </h2>
                        <p className="text-sm text-stone-600 mt-1 leading-relaxed">
                          Intake existing store inventory, record an outright purchase from a seller, or book a customer pawn loan.
                        </p>
                      </div>
                    </div>

                    <button 
                      type="button"
                      onClick={() => setActiveTab('buy-pawn')}
                      className="self-start sm:self-center shrink-0 h-12 px-6 rounded-xl bg-[#C85A32] hover:bg-[#B84E27] active:scale-[0.99] text-white font-semibold text-sm flex items-center gap-2 shadow-sm shadow-[#C85A32]/25 transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85A32]"
                    >
                      <span>Add Stock Now</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* SECONDARY SHORTCUTS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3.5">
                {hasPermission('sales') && (
                  <button 
                    type="button"
                    onClick={() => setActiveTab('sell')}
                    className="p-4 rounded-xl bg-white/95 border border-stone-200 hover:border-[#C85A32] hover:shadow-xs transition-all flex items-center gap-3.5 text-left cursor-pointer group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85A32]"
                  >
                    <div className="w-10 h-10 rounded-lg bg-stone-100 group-hover:bg-[#FDF0EA] text-stone-600 group-hover:text-[#C85A32] flex items-center justify-center transition-colors">
                      <ShoppingBag className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-stone-900 group-hover:text-[#C85A32] transition-colors">
                        Point of Sale
                      </h3>
                      <p className="text-xs text-stone-400">Ring up retail sales</p>
                    </div>
                  </button>
                )}

                {hasPermission('pawn') && (
                  <button 
                    type="button"
                    onClick={() => setActiveTab('customers')}
                    className="p-4 rounded-xl bg-white/95 border border-stone-200 hover:border-blue-500 hover:shadow-xs transition-all flex items-center gap-3.5 text-left cursor-pointer group focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    <div className="w-10 h-10 rounded-lg bg-stone-100 group-hover:bg-blue-50 text-stone-600 group-hover:text-blue-600 flex items-center justify-center transition-colors">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-stone-900 group-hover:text-blue-600 transition-colors">
                        Find Customer
                      </h3>
                      <p className="text-xs text-stone-400">Look up RSA ID or phone</p>
                    </div>
                  </button>
                )}

                {hasPermission('inventory') && (
                  <button 
                    type="button"
                    onClick={() => setActiveTab('inventory')}
                    className="p-4 rounded-xl bg-white/95 border border-stone-200 hover:border-stone-400 hover:shadow-xs transition-all flex items-center gap-3.5 text-left cursor-pointer group focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-400"
                  >
                    <div className="w-10 h-10 rounded-lg bg-stone-100 text-stone-600 flex items-center justify-center">
                      <Search className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-stone-900">
                        Search Inventory
                      </h3>
                      <p className="text-xs text-stone-400">Browse current stock list</p>
                    </div>
                  </button>
                )}
              </div>
            </div>
          </section>
        ) : (
          /* ACTIVE SHOP ACTION GRID: 4 Coordinated, Balanced Cards */
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {/* ACTION 1: SELL */}
            {hasPermission('sales') && (
              <button 
                type="button"
                onClick={() => setActiveTab('sell')}
                className="group p-5 sm:p-6 rounded-2xl bg-white/95 backdrop-blur-xs border border-stone-200/90 hover:border-[#C85A32] hover:shadow-md transition-all duration-150 flex flex-col items-center justify-center text-center gap-3 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85A32]"
              >
                <div className="w-12 h-12 rounded-xl bg-[#FDF0EA] text-[#C85A32] flex items-center justify-center group-hover:scale-105 transition-transform shadow-2xs">
                  <ShoppingBag className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-stone-900 group-hover:text-[#C85A32] transition-colors">
                    Sell
                  </h2>
                  <p className="text-xs text-stone-400 mt-0.5">Counter sales & receipts</p>
                </div>
              </button>
            )}

            {/* ACTION 2: ADD STOCK */}
            {hasPermission('sellerAcquisitions') && (
              <button 
                type="button"
                onClick={() => setActiveTab('buy-pawn')}
                className="group p-5 sm:p-6 rounded-2xl bg-white/95 backdrop-blur-xs border border-stone-200/90 hover:border-[#C85A32] hover:shadow-md transition-all duration-150 flex flex-col items-center justify-center text-center gap-3 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85A32]"
              >
                <div className="w-12 h-12 rounded-xl bg-orange-50 text-[#C85A32] flex items-center justify-center group-hover:scale-105 transition-transform shadow-2xs">
                  <Package className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-stone-900 group-hover:text-[#C85A32] transition-colors">
                    Add Stock
                  </h2>
                  <p className="text-xs text-stone-400 mt-0.5">Purchases, buy-ins & pawns</p>
                </div>
              </button>
            )}

            {/* ACTION 3: FIND CUSTOMER */}
            {hasPermission('pawn') && (
              <button 
                type="button"
                onClick={() => setActiveTab('customers')}
                className="group p-5 sm:p-6 rounded-2xl bg-white/95 backdrop-blur-xs border border-stone-200/90 hover:border-blue-500 hover:shadow-md transition-all duration-150 flex flex-col items-center justify-center text-center gap-3 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform shadow-2xs">
                  <User className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-stone-900 group-hover:text-blue-600 transition-colors">
                    Find Customer
                  </h2>
                  <p className="text-xs text-stone-400 mt-0.5">Pawn history & profiles</p>
                </div>
              </button>
            )}
            
            {/* ACTION 4: INVENTORY */}
            {hasPermission('inventory') && (
              <button 
                type="button"
                onClick={() => setActiveTab('inventory')}
                className="group p-5 sm:p-6 rounded-2xl bg-white/95 backdrop-blur-xs border border-stone-200/90 hover:border-stone-500 hover:shadow-md transition-all duration-150 flex flex-col items-center justify-center text-center gap-3 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-500"
              >
                <div className="w-12 h-12 rounded-xl bg-stone-100 text-stone-600 flex items-center justify-center group-hover:scale-105 transition-transform shadow-2xs">
                  <Search className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-stone-900 group-hover:text-stone-900 transition-colors">
                    Find Item
                  </h2>
                  <p className="text-xs text-stone-400 mt-0.5">Search stock & barcodes</p>
                </div>
              </button>
            )}
          </section>
        )}

        {/* ============================================================
            ACTIVITY & MANAGEMENT SECTION
           ============================================================ */}
        {isBrandNewShop ? (
          /* Empty Shop Supporting Section: Quiet & Reassuring */
          <section className="bg-white/80 border border-stone-200/80 rounded-2xl p-8 text-center max-w-xl mx-auto space-y-2">
            <div className="w-10 h-10 rounded-full bg-stone-100 text-stone-400 mx-auto flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-stone-700">No activity yet</h3>
            <p className="text-xs text-stone-400 leading-relaxed">
              Your first sale, inventory intake, or pawn pledge will automatically appear here once recorded.
            </p>
          </section>
        ) : (
          /* Active Shop Operational Center & Management Overview */
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 sm:gap-8">
            
            {/* OPERATIONAL ATTENTION CENTER (LEFT 2 COLS) */}
            <div className="xl:col-span-2 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold text-stone-500 uppercase tracking-wider flex items-center gap-2">
                  <span>Store Activity &amp; Due Items</span>
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Critical: Overdue & Due Soon */}
                <div className="p-6 rounded-2xl bg-white border border-stone-200 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-orange-50 text-[#C85A32] flex items-center justify-center">
                      <Clock className="w-5 h-5" />
                    </div>
                    <span className="text-[11px] font-semibold text-[#C85A32] bg-[#FDF0EA] px-2.5 py-0.5 rounded-full">
                      Pawn Status
                    </span>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-stone-900">Pawn Loans</h3>
                    <p className="text-xs text-stone-500">Agreements requiring counter attention</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-rose-50/70 p-3.5 rounded-xl border border-rose-100">
                      <p className="text-2xl font-bold text-rose-700 font-mono">{overdueLoans.length}</p>
                      <p className="text-xs text-rose-600 font-medium mt-0.5">Overdue</p>
                    </div>
                    <div className="bg-amber-50/70 p-3.5 rounded-xl border border-amber-100">
                      <p className="text-2xl font-bold text-amber-700 font-mono">{expiringSoon.length}</p>
                      <p className="text-xs text-amber-600 font-medium mt-0.5">Due Soon</p>
                    </div>
                  </div>
                </div>

                {/* Approval & Pipeline */}
                {isAtLeastSeniorCashier && (
                  <div className="p-6 rounded-2xl bg-white border border-stone-200 shadow-xs space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                        <User className="w-5 h-5" />
                      </div>
                      <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full">
                        Management
                      </span>
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-stone-900">Approval Pipeline</h3>
                      <p className="text-xs text-stone-500">Items ready for review or retail</p>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between p-3 bg-stone-50 rounded-xl border border-stone-200/60">
                        <span className="font-medium text-stone-700">Pending Forfeitures</span>
                        <span className="font-bold text-stone-900 font-mono text-sm">{pendingApproval.length}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-stone-50 rounded-xl border border-stone-200/60">
                        <span className="font-medium text-stone-700">Ready for Retail</span>
                        <span className="font-bold text-stone-900 font-mono text-sm">{readyForRetail.length}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Vault At-a-Glance */}
              {isAtLeastSeniorCashier && (
                <div className="p-6 rounded-2xl bg-white border border-stone-200 shadow-xs space-y-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-stone-100 text-stone-600 flex items-center justify-center">
                        <Lock className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-stone-900">Vault &amp; Pledged Goods</h3>
                        <p className="text-xs text-stone-500">Secure storage tracking</p>
                      </div>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setActiveTab('vault')}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold transition cursor-pointer"
                    >
                      <span>Open Vault</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                    <div className="p-4 rounded-xl bg-stone-50 border border-stone-100">
                      <span className="text-[10px] font-semibold text-stone-500 uppercase block mb-1">Standard</span>
                      <p className="text-xl font-bold text-stone-900 font-mono">
                        {Math.max(0, activeLoans.length - expiringSoon.length - overdueLoans.length)}
                      </p>
                    </div>
                    <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-100">
                      <span className="text-[10px] font-semibold text-amber-700 uppercase block mb-1">Due Soon</span>
                      <p className="text-xl font-bold text-amber-800 font-mono">
                        {expiringSoon.filter(l => l.expiryDate > today).length}
                      </p>
                    </div>
                    <div className="p-4 rounded-xl bg-orange-50/60 border border-orange-100">
                      <span className="text-[10px] font-semibold text-orange-700 uppercase block mb-1">Due Today</span>
                      <p className="text-xl font-bold text-orange-800 font-mono">
                        {expiringSoon.filter(l => l.expiryDate === today).length}
                      </p>
                    </div>
                    <div className="p-4 rounded-xl bg-rose-50/60 border border-rose-100">
                      <span className="text-[10px] font-semibold text-rose-700 uppercase block mb-1">Overdue</span>
                      <p className="text-xl font-bold text-rose-800 font-mono">
                        {overdueLoans.length}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* PERFORMANCE COLUMN (RIGHT) */}
            {isAtLeastSeniorCashier ? (
              <aside className="space-y-4">
                <h2 className="text-xs font-bold text-stone-500 uppercase tracking-wider">
                  Today’s Summary
                </h2>
                
                <div className="rounded-2xl bg-white border border-stone-200 shadow-xs overflow-hidden">
                  <div className="p-6 space-y-5">
                    <div>
                      <p className="text-xs font-medium text-stone-500">Net Retail Revenue</p>
                      <p className="text-3xl font-bold text-stone-900 font-mono mt-1">
                        R {todayTotals.salesValue.toLocaleString()}
                      </p>
                    </div>

                    <div className="h-px bg-stone-100" />

                    <div className="space-y-3.5 text-xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                            <TrendingUp className="w-4 h-4" />
                          </div>
                          <span className="font-medium text-stone-700">Retail Sales</span>
                        </div>
                        <span className="font-bold text-stone-900 font-mono text-sm">{todayTotals.sales}</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-orange-50 text-[#C85A32] flex items-center justify-center">
                            <ArrowRightLeft className="w-4 h-4" />
                          </div>
                          <span className="font-medium text-stone-700">Stock Inflow</span>
                        </div>
                        <span className="font-bold text-stone-900 font-mono text-sm">{todayTotals.buys}</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                            <Lock className="w-4 h-4" />
                          </div>
                          <span className="font-medium text-stone-700">Pawn Pledges</span>
                        </div>
                        <span className="font-bold text-stone-900 font-mono text-sm">{todayTotals.pawns}</span>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200/60 space-y-1">
                      <span className="text-[11px] font-medium text-stone-500">Cash Payouts</span>
                      <p className="text-lg font-bold text-stone-900 font-mono">
                        R {todayTotals.payouts.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              </aside>
            ) : (
              <aside className="space-y-4">
                <h2 className="text-xs font-bold text-stone-500 uppercase tracking-wider">
                  Counter Status
                </h2>
                <div className="rounded-2xl bg-white border border-stone-200 shadow-xs p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-stone-900">Counter Ready</h3>
                      <p className="text-xs text-stone-500">Fast transactions active</p>
                    </div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-100 text-xs text-stone-600 space-y-2">
                    <p className="font-semibold text-stone-800">Counter Tips</p>
                    <p className="text-stone-500 leading-relaxed">• Use <span className="font-semibold text-stone-700">Point of Sale</span> for direct retail sales.</p>
                    <p className="text-stone-500 leading-relaxed">• Press <span className="font-mono font-semibold text-stone-700">F1 / F2 / F3</span> at checkout for Cash / Card / EFT.</p>
                    <p className="text-stone-500 leading-relaxed">• Search items by SKU, serial number, or title.</p>
                  </div>
                </div>
              </aside>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
