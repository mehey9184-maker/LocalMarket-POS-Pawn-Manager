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
  AlertCircle, 
  Clock, 
  TrendingUp, 
  ChevronRight,
  ShieldCheck,
  Package,
  User,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Plus
} from 'lucide-react';

export const Home: React.FC = () => {
  const { setActiveTab, shopProfile } = useApp();
  const { user } = useAuth();
  const { inventory } = useInventory();
  const { loans } = useLoans();
  const { salesHistory } = useSales();

  // 1. Calculate Operational States
  const today = new Date().toISOString().split('T')[0];
  const threeDaysFromNow = new Date();
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
  const expiryThreshold = threeDaysFromNow.toISOString().split('T')[0];

  const dailySales = useMemo(() => salesHistory.filter(s => s.timestamp.startsWith(today)), [salesHistory, today]);
  const dailyBuys = useMemo(() => inventory.filter(i => (i.acquisitionType === 'Buy' || i.acquisitionType === 'Existing Stock') && i.addedAt.startsWith(today)), [inventory, today]);
  const dailyPawns = useMemo(() => loans.filter(l => l.startDate.startsWith(today)), [loans, today]);

  const activeLoans = loans.filter(l => l.status === 'Active');
  const expiringSoon = activeLoans.filter(l => l.expiryDate <= expiryThreshold && l.expiryDate >= today);
  const overdueLoans = activeLoans.filter(l => l.expiryDate < today);
  const pendingApproval = loans.filter(l => l.status === 'Pending Forfeit');
  
  const readyForRetail = inventory.filter(i => i.status === 'Vault Hold' && i.acquisitionType === 'Forfeited');

  const todayTotals = {
    sales: dailySales.length,
    salesValue: dailySales.reduce((sum, s) => sum + s.total, 0),
    buys: dailyBuys.length,
    pawns: dailyPawns.length,
    payouts: dailyBuys.reduce((sum, i) => sum + (i.costBasis || 0), 0) + dailyPawns.reduce((sum, l) => sum + l.principal, 0)
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#F5F6F8] no-scrollbar">
      {/* 1. TOP BAR: IDENTITY & STATUS */}
      <header className="px-6 lg:px-8 py-3.5 bg-white border-b border-gray-200 flex items-center justify-between sticky top-0 z-20 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-9 h-9 rounded-xl bg-[#FDF0EA] text-[#C85A32] flex items-center justify-center font-bold">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900 leading-tight">LocalMarket Operations Hub</h1>
            <p className="text-[11px] text-gray-500">{shopProfile.shop_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-5">
          <div className="text-right hidden sm:block">
            <p className="text-[11px] font-medium text-gray-500">Active Cashier</p>
            <p className="text-xs font-semibold text-gray-800">{user?.user_metadata?.full_name || 'Staff Member'}</p>
          </div>
          <div className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
            <span className="text-[11px] font-semibold text-emerald-700">Terminal Ready</span>
          </div>
        </div>
      </header>

      <div className="p-6 lg:p-8 max-w-[1500px] mx-auto space-y-8">
        
        {/* 2. MAIN QUICK ACTIONS: REFINED CARDS */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* ACTION 1: SELL ITEM */}
          <button 
            onClick={() => setActiveTab('sell')}
            className="group p-6 rounded-2xl bg-white border border-gray-200 hover:border-[#C85A32] hover:shadow-md transition-all flex flex-col items-center justify-center text-center gap-3.5 cursor-pointer"
          >
            <div className="w-14 h-14 rounded-2xl bg-[#FDF0EA] text-[#C85A32] flex items-center justify-center group-hover:scale-105 transition-transform">
              <ShoppingBag className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 group-hover:text-[#C85A32] transition-colors">
                Point of Sale
              </h2>
              <p className="text-gray-500 text-xs mt-0.5">Retail checkout and instant barcode scan</p>
            </div>
          </button>

          {/* ACTION 2: ADD STOCK / BUY */}
          <button 
            onClick={() => setActiveTab('buy-pawn')}
            className="group p-6 rounded-2xl bg-white border border-gray-200 hover:border-[#C85A32] hover:shadow-md transition-all flex flex-col items-center justify-center text-center gap-3.5 cursor-pointer"
          >
            <div className="w-14 h-14 rounded-2xl bg-orange-50 text-[#C85A32] flex items-center justify-center group-hover:scale-105 transition-transform">
              <Package className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 group-hover:text-[#C85A32] transition-colors">
                Add Stock & Intake
              </h2>
              <p className="text-gray-500 text-xs mt-0.5">Existing stock onboarding or seller purchase</p>
            </div>
          </button>

          {/* ACTION 3: PAWN COLLATERAL */}
          <button 
            onClick={() => setActiveTab('buy-pawn')}
            className="group p-6 rounded-2xl bg-white border border-gray-200 hover:border-blue-500 hover:shadow-md transition-all flex flex-col items-center justify-center text-center gap-3.5 cursor-pointer"
          >
            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Lock className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                Pawn Pledge Loan
              </h2>
              <p className="text-gray-500 text-xs mt-0.5">30-day secured credit advance</p>
            </div>
          </button>
        </section>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* 3. OPERATIONAL ATTENTION CENTER (LEFT) */}
          <div className="xl:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-[#C85A32]" />
                Operational Priorities
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Critical: Overdue & Expiring */}
              <div className="p-6 rounded-2xl bg-white border border-gray-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-orange-50 text-[#C85A32] flex items-center justify-center">
                    <Clock className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-bold text-[#C85A32] bg-[#FDF0EA] px-2.5 py-0.5 rounded-full">
                    Pledge Expirations
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Pawn Term Pipeline</h3>
                  <p className="text-xs text-gray-500">NCR Act 34 Statutory 30-Day Contracts</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-red-50 p-3.5 rounded-xl border border-red-100">
                    <p className="text-2xl font-bold text-red-700 font-mono">{overdueLoans.length}</p>
                    <p className="text-[11px] text-red-600 font-medium mt-0.5">Overdue</p>
                  </div>
                  <div className="bg-amber-50 p-3.5 rounded-xl border border-amber-100">
                    <p className="text-2xl font-bold text-amber-700 font-mono">{expiringSoon.length}</p>
                    <p className="text-[11px] text-amber-600 font-medium mt-0.5">Due in 3 Days</p>
                  </div>
                </div>
                <button 
                  onClick={() => setActiveTab('customers')}
                  className="w-full py-2.5 bg-gray-900 text-white rounded-xl text-xs font-semibold hover:bg-gray-800 transition"
                >
                  Manage Pawn Ledger
                </button>
              </div>

              {/* Approval & Pipeline */}
              <div className="p-6 rounded-2xl bg-white border border-gray-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <User className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full">
                    Stock Flow
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Manager Pipeline</h3>
                  <p className="text-xs text-gray-500">Vault & floor stock transitions</p>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200/60">
                    <span className="font-medium text-gray-700">Pending Forfeitures</span>
                    <span className="font-bold text-gray-900 font-mono">{pendingApproval.length}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200/60">
                    <span className="font-medium text-gray-700">Ready for Retail Floor</span>
                    <span className="font-bold text-gray-900 font-mono">{readyForRetail.length}</span>
                  </div>
                </div>
                <button 
                  onClick={() => setActiveTab('inventory')}
                  className="w-full py-2.5 bg-[#C85A32] text-white rounded-xl text-xs font-semibold hover:bg-[#A94725] transition"
                >
                  View Floor Inventory
                </button>
              </div>
            </div>

            {/* Inventory Health Widget */}
            <div className="p-6 rounded-2xl bg-white border border-gray-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Inventory Health & Security</h3>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { label: 'Total In Stock', val: inventory.length, icon: Package, color: 'text-emerald-600' },
                  { label: 'Active Pawn Collateral', val: activeLoans.length, icon: Lock, color: 'text-blue-600' },
                  { label: 'Flagged / Restricted', val: inventory.filter(i => i.status === 'Flagged' || i.status === 'Reserved').length, icon: AlertCircle, color: 'text-amber-600' }
                ].map((stat, i) => (
                  <div key={i} className="p-4 rounded-xl bg-gray-50 border border-gray-200/60">
                    <div className="flex items-center gap-2 mb-1.5">
                      <stat.icon className={`w-3.5 h-3.5 ${stat.color}`} />
                      <span className="text-[11px] font-semibold text-gray-500">{stat.label}</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900 font-mono">{stat.val}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 4. TODAY'S BUSINESS SUMMARY (RIGHT) */}
          <aside className="space-y-4">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Today's Performance</h2>
            
            <div className="rounded-2xl bg-white border border-gray-200 shadow-xs overflow-hidden">
              <div className="p-6 space-y-5">
                <div>
                  <p className="text-xs font-medium text-gray-500">Net Retail Revenue</p>
                  <p className="text-3xl font-bold text-gray-900 font-mono mt-0.5">
                    R {todayTotals.salesValue.toLocaleString()}
                  </p>
                </div>

                <div className="h-px bg-gray-100" />

                <div className="space-y-3.5 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <TrendingUp className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">Retail Sales</p>
                        <p className="text-[10px] text-gray-400">Checkout Sessions</p>
                      </div>
                    </div>
                    <span className="font-bold text-gray-900 font-mono text-sm">{todayTotals.sales}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-orange-50 text-[#C85A32] flex items-center justify-center">
                        <ArrowRightLeft className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">Stock Inflow</p>
                        <p className="text-[10px] text-gray-400">Items Added</p>
                      </div>
                    </div>
                    <span className="font-bold text-gray-900 font-mono text-sm">{todayTotals.buys}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                        <Lock className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">Pawn Pledges</p>
                        <p className="text-[10px] text-gray-400">Pledges Initiated</p>
                      </div>
                    </div>
                    <span className="font-bold text-gray-900 font-mono text-sm">{todayTotals.pawns}</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200/60 space-y-1">
                  <span className="text-[11px] font-medium text-gray-500">Cash Payouts</span>
                  <p className="text-lg font-bold text-gray-900 font-mono">
                    R {todayTotals.payouts.toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="bg-[#F8F9FA] px-6 py-3.5 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500 font-medium">
                <span>Compliance Active</span>
                <span className="text-emerald-700 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  NCR & SAPS Verified
                </span>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};
