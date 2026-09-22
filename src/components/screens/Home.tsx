import React, { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useInventory } from '../../context/InventoryContext';
import { useLoans } from '../../context/LoanContext';
import { useSales } from '../../context/SalesContext';
import { motion } from 'motion/react';
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
  AlertTriangle
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
  const dailyBuys = useMemo(() => inventory.filter(i => i.acquisitionType === 'Buy' && i.addedAt.startsWith(today)), [inventory, today]);
  const dailyPawns = useMemo(() => loans.filter(l => l.startDate.startsWith(today)), [loans, today]);

  const activeLoans = loans.filter(l => l.status === 'Active');
  const expiringSoon = activeLoans.filter(l => l.expiryDate <= expiryThreshold && l.expiryDate >= today);
  const overdueLoans = activeLoans.filter(l => l.expiryDate < today);
  const pendingApproval = loans.filter(l => l.status === 'Pending Forfeit');
  
  // Items that are technically "expired" but haven't been processed to floor yet
  const readyForRetail = inventory.filter(i => i.status === 'Vault Hold' && i.acquisitionType === 'Forfeited');

  const todayTotals = {
    sales: dailySales.length,
    salesValue: dailySales.reduce((sum, s) => sum + s.total, 0),
    buys: dailyBuys.length,
    pawns: dailyPawns.length,
    payouts: dailyBuys.reduce((sum, i) => sum + i.costBasis, 0) + dailyPawns.reduce((sum, l) => sum + l.principal, 0)
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#0F0F0F] no-scrollbar">
      {/* 1. TOP BAR: IDENTITY & STATUS */}
      <header className="px-8 py-4 bg-[#141414] border-b border-[#222] flex items-center justify-between sticky top-0 z-20 backdrop-blur-md bg-opacity-90">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-[#C85A32] flex items-center justify-center text-white shadow-lg shadow-[#C85A32]/10">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-sm font-black uppercase tracking-[0.2em] text-white">LocalMarket</h1>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{shopProfile.shop_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Current Cashier</p>
            <p className="text-xs font-bold text-white">{user?.user_metadata?.full_name || 'Operator 01'}</p>
          </div>
          <div className="px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Shift Active</span>
          </div>
        </div>
      </header>

      <div className="p-8 lg:p-12 max-w-[1600px] mx-auto space-y-12">
        
        {/* 2. MAIN QUICK ACTIONS: LARGE TILES */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <button 
            onClick={() => setActiveTab('sell')}
            className="group p-8 rounded-[32px] bg-[#C85A32] hover:bg-[#b04d29] transition-all flex flex-col items-center justify-center text-center gap-4 shadow-2xl shadow-[#C85A32]/20 active:scale-[0.98]"
          >
            <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
              <ShoppingBag className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white uppercase tracking-tight">SELL ITEM</h2>
              <p className="text-white/60 text-xs font-bold mt-1 uppercase tracking-widest">Retail Checkout Terminal</p>
            </div>
          </button>

          <button 
            onClick={() => setActiveTab('buy-pawn')}
            className="group p-8 rounded-[32px] bg-[#1A1A1A] border border-[#333] hover:border-[#E87A5D]/50 transition-all flex flex-col items-center justify-center text-center gap-4 shadow-xl active:scale-[0.98]"
          >
            <div className="w-16 h-16 rounded-2xl bg-[#E87A5D]/10 flex items-center justify-center group-hover:scale-110 transition-transform">
              <ArrowRightLeft className="w-8 h-8 text-[#E87A5D]" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white uppercase tracking-tight">BUY ITEM</h2>
              <p className="text-gray-500 text-xs font-bold mt-1 uppercase tracking-widest">Direct Cash Purchase</p>
            </div>
          </button>

          <button 
            onClick={() => setActiveTab('buy-pawn')}
            className="group p-8 rounded-[32px] bg-[#1A1A1A] border border-[#333] hover:border-blue-500/50 transition-all flex flex-col items-center justify-center text-center gap-4 shadow-xl active:scale-[0.98]"
          >
            <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Lock className="w-8 h-8 text-blue-400" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white uppercase tracking-tight">PAWN ITEM</h2>
              <p className="text-gray-500 text-xs font-bold mt-1 uppercase tracking-widest">30-Day Cash Advance</p>
            </div>
          </button>
        </section>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-12">
          {/* 3. OPERATIONAL ATTENTION CENTER (LEFT) */}
          <div className="xl:col-span-2 space-y-10">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-black text-gray-500 uppercase tracking-[0.3em] flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#C85A32]" />
                Operational Priority
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Critical: Overdue & Expiring */}
              <div className="p-8 rounded-[2rem] bg-[#1A1412] border border-[#C85A32]/20 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="p-3 bg-[#C85A32]/10 rounded-xl">
                    <Clock className="w-6 h-6 text-[#E87A5D]" />
                  </div>
                  <span className="text-xs font-black text-[#E87A5D] uppercase tracking-widest">Urgent</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white tracking-tight">Pledge Expirations</h3>
                  <p className="text-xs text-gray-500 mt-1 uppercase tracking-wider">NCR 30-Day Contracts</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-black/20 p-4 rounded-2xl border border-white/5">
                    <p className="text-2xl font-black text-white">{overdueLoans.length}</p>
                    <p className="text-[10px] text-red-400 font-bold uppercase mt-1">Overdue</p>
                  </div>
                  <div className="bg-black/20 p-4 rounded-2xl border border-white/5">
                    <p className="text-2xl font-black text-white">{expiringSoon.length}</p>
                    <p className="text-[10px] text-amber-500 font-bold uppercase mt-1">Due Soon</p>
                  </div>
                </div>
                <button 
                  onClick={() => setActiveTab('customers')}
                  className="w-full py-3 bg-[#C85A32] text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[#b04d29] transition"
                >
                  Manage Ledger
                </button>
              </div>

              {/* Approval & Pipeline */}
              <div className="p-8 rounded-[2rem] bg-[#14161A] border border-blue-500/20 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="p-3 bg-blue-500/10 rounded-xl">
                    <User className="w-6 h-6 text-blue-400" />
                  </div>
                  <span className="text-xs font-black text-blue-400 uppercase tracking-widest">Approvals</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white tracking-tight">Manager Pipeline</h3>
                  <p className="text-xs text-gray-500 mt-1 uppercase tracking-wider">Stock Transitions</p>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 bg-black/20 rounded-2xl border border-white/5">
                    <span className="text-xs font-bold text-gray-300">Pending Forfeits</span>
                    <span className="text-sm font-black text-white">{pendingApproval.length}</span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-black/20 rounded-2xl border border-white/5">
                    <span className="text-xs font-bold text-gray-300">Ready for Retail</span>
                    <span className="text-sm font-black text-white">{readyForRetail.length}</span>
                  </div>
                </div>
                <button 
                  onClick={() => setActiveTab('inventory')}
                  className="w-full py-3 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-500 transition"
                >
                  Approve Stock
                </button>
              </div>
            </div>

            {/* Inventory Attention */}
            <div className="p-8 rounded-[2rem] bg-[#1A1A1A] border border-[#2A2A2A] space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em]">Inventory Health</h3>
                <AlertTriangle className="w-4 h-4 text-amber-500" />
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { label: 'Total In Stock', val: inventory.length, icon: Package, color: 'text-emerald-400' },
                  { label: 'Active Pawns', val: activeLoans.length, icon: Lock, color: 'text-blue-400' },
                  { label: 'Flagged / Hold', val: inventory.filter(i => i.status === 'Flagged' || i.status === 'Reserved').length, icon: AlertCircle, color: 'text-red-400' }
                ].map((stat, i) => (
                  <div key={i} className="p-5 rounded-2xl bg-black/20 border border-white/5">
                    <div className="flex items-center gap-2 mb-2">
                      <stat.icon className={`w-3 h-3 ${stat.color}`} />
                      <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">{stat.label}</span>
                    </div>
                    <p className="text-xl font-black text-white tabular-nums">{stat.val}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 4. TODAY'S BUSINESS SUMMARY (RIGHT) */}
          <aside className="space-y-10">
            <h2 className="text-xs font-black text-gray-500 uppercase tracking-[0.3em]">Today's Performance</h2>
            
            <div className="rounded-[2.5rem] bg-[#1A1A1A] border border-[#2A2A2A] overflow-hidden shadow-2xl">
              <div className="p-8 space-y-8">
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Net Retail Revenue</p>
                  <p className="text-4xl font-black text-[#E87A5D] font-mono tracking-tighter">R {todayTotals.salesValue.toLocaleString()}</p>
                </div>

                <div className="h-px bg-gradient-to-r from-transparent via-[#333] to-transparent" />

                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white">Retail Sales</p>
                        <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Checkout Sessions</p>
                      </div>
                    </div>
                    <span className="text-lg font-black text-white tabular-nums">{todayTotals.sales}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                        <ArrowRightLeft className="w-5 h-5 text-blue-400" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white">Asset Buys</p>
                        <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Inventory Inflow</p>
                      </div>
                    </div>
                    <span className="text-lg font-black text-white tabular-nums">{todayTotals.buys}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                        <Lock className="w-5 h-5 text-purple-400" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white">Pawn Loans</p>
                        <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Pledges Created</p>
                      </div>
                    </div>
                    <span className="text-lg font-black text-white tabular-nums">{todayTotals.pawns}</span>
                  </div>
                </div>

                <div className="p-6 rounded-2xl bg-black/40 border border-white/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Cash Payouts</span>
                    <TrendingUp className="w-3 h-3 text-red-400 rotate-180" />
                  </div>
                  <p className="text-xl font-black text-white font-mono">R {todayTotals.payouts.toLocaleString()}</p>
                </div>
              </div>

              <div className="bg-[#141414] p-6 border-t border-[#2A2A2A]">
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-gray-500 mb-4">
                  <span>System Integrity</span>
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="px-2 py-1 rounded bg-black/40 border border-white/5 text-[9px] font-bold text-gray-400">NCR COMPLIANT</span>
                  <span className="px-2 py-1 rounded bg-black/40 border border-white/5 text-[9px] font-bold text-gray-400">SAPS FORM 21</span>
                  <span className="px-2 py-1 rounded bg-black/40 border border-white/5 text-[9px] font-bold text-gray-400">VAULT SYNC</span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

