import React from 'react';
import { useApp } from '../../context/AppContext';
import { motion } from 'motion/react';
import { 
  TrendingUp, 
  Users, 
  Package, 
  AlertCircle, 
  ArrowUpRight, 
  Clock, 
  PlusCircle, 
  ShoppingBag,
  MessageSquare,
  ChevronRight,
  ExternalLink
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { 
    inventory, 
    customers, 
    pawnLoans, 
    salesHistory, 
    setActiveTab,
    showToast
  } = useApp();

  const totalSales = salesHistory.reduce((sum, s) => sum + s.total, 0);
  const activeLoansCount = pawnLoans.filter(l => l.status === 'Active').length;
  const overdueLoansCount = pawnLoans.filter(l => l.daysRemaining < 0 && l.status === 'Active').length;
  const itemsOnFloor = inventory.filter(i => i.status === 'Retail Floor').length;

  const stats = [
    { label: 'Total Sales (MDR)', value: `R ${totalSales.toLocaleString()}`, icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-400/10', target: 'pos' },
    { label: 'Active Pawns', value: activeLoansCount, icon: Clock, color: 'text-blue-400', bg: 'bg-blue-400/10', target: 'registry' },
    { label: 'Retail Stock', value: itemsOnFloor, icon: Package, color: 'text-[#C85A32]', bg: 'bg-[#C85A32]/10', target: 'vault' },
    { label: 'Total Customers', value: customers.length, icon: Users, color: 'text-purple-400', bg: 'bg-purple-400/10', target: 'registry' },
  ];

  const handleNotifyOverdue = () => {
    showToast('Batch Notification Sent', `WhatsApp reminders sent to ${overdueLoansCount} customers`, 'success');
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#121212] p-6 space-y-8 no-scrollbar">
      {/* 1. WELCOME HEADER */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white font-headline tracking-tight">Dashboard</h1>
          <p className="text-gray-400 text-sm">Overview for Soweto Main Branch • Sept 21, 2026</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setActiveTab('buy-pawn')}
            className="flex items-center gap-2 px-4 py-2 bg-[#C85A32] text-white rounded-xl text-sm font-bold shadow-lg shadow-[#C85A32]/20 hover:bg-[#b04d29] transition"
          >
            <PlusCircle className="w-4 h-4" />
            <span>New Intake</span>
          </button>
          <button 
            onClick={() => setActiveTab('sell')}
            className="flex items-center gap-2 px-4 py-2 bg-[#1E1E1E] border border-[#2A2A2A] text-gray-100 rounded-xl text-sm font-bold hover:bg-[#252525] transition"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Open POS</span>
          </button>
        </div>
      </header>

      {/* 2. CORE METRICS GRID (HIGH-DENSITY) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            onClick={() => setActiveTab(stat.target as any)}
            className="p-4 rounded-2xl bg-[#1E1E1E] border border-[#2A2A2A] flex items-center gap-4 hover:border-[#383838] transition-all cursor-pointer group"
          >
            <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-white tabular-nums tracking-tight">{stat.value}</h3>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{stat.label}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-700 group-hover:text-gray-400 transition-colors" />
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 3. CENTER FEED (FACEBOOK STYLE) */}
        <section className="lg:col-span-2 space-y-6">
          <div className="space-y-4">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-[0.2em] flex items-center gap-2 px-1">
              <Clock className="w-3.5 h-3.5" />
              Priority Feed
            </h2>
            
            {/* Overdue Alert Card */}
            {overdueLoansCount > 0 && (
              <motion.div 
                whileHover={{ y: -2 }}
                className="p-5 rounded-3xl bg-amber-500/5 border border-amber-500/20 shadow-lg shadow-amber-950/10"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center shrink-0">
                    <AlertCircle className="w-6 h-6 text-amber-500" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-base font-bold text-amber-100">{overdueLoansCount} Overdue Contracts</h4>
                    <p className="text-sm text-amber-400/70 mt-1 max-w-md">Statutory hold periods have expired. Items are eligible for floor transfer.</p>
                    <div className="flex flex-wrap gap-2 mt-4">
                      <button 
                        onClick={() => setActiveTab('inventory')}
                        className="px-4 py-2 bg-amber-500 text-black rounded-xl text-xs font-bold hover:bg-amber-400 transition flex items-center gap-2"
                      >
                        <span>Transfer to Floor</span>
                      </button>
                      <button 
                        onClick={handleNotifyOverdue}
                        className="px-4 py-2 bg-white/5 text-amber-100 rounded-xl text-xs font-bold hover:bg-white/10 transition border border-white/10 flex items-center gap-2"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Notify Pledgors</span>
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* General Activity Feed */}
            <div className="p-1.5 space-y-3">
              {[
                { title: 'New Customer Verified', time: '12m ago', desc: 'Thabo Mbeki added to registry via RSA ID Scan.', type: 'info', action: 'Chat' },
                { title: 'SAPS Export Ready', time: '1h ago', desc: 'Daily statutory register ready for Form 21 download.', type: 'success', action: 'Download' },
              ].map((item, idx) => (
                <div key={idx} className="p-4 rounded-2xl bg-[#1A1A1A] border border-[#2A2A2A] flex items-center gap-4 group hover:bg-[#1E1E1E] transition">
                  <div className="w-10 h-10 rounded-xl bg-[#121212] flex items-center justify-center shrink-0 border border-[#2A2A2A] group-hover:border-[#C85A32]/30 transition">
                    <Users className="w-4 h-4 text-gray-400 group-hover:text-[#E87A5D] transition" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-gray-200">{item.title}</h4>
                      <span className="text-[10px] text-gray-600 font-mono">{item.time}</span>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1">{item.desc}</p>
                  </div>
                  <button className="px-3 py-1.5 bg-[#121212] border border-[#2A2A2A] rounded-lg text-[10px] font-bold text-gray-400 opacity-0 group-hover:opacity-100 transition-all hover:text-white hover:border-gray-600">
                    {item.action}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 4. RECENT SALES & PERFORMANCE */}
        <section className="space-y-4">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-[0.2em] px-1">Performance</h2>
          <div className="bg-[#1E1E1E] rounded-3xl border border-[#2A2A2A] overflow-hidden shadow-xl">
            <div className="p-6 space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-gray-500 font-bold uppercase">Daily Goal</span>
                  <span className="text-xs text-emerald-400 font-mono">82%</span>
                </div>
                <div className="h-2 w-full bg-[#121212] rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: '82%' }} />
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <h4 className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Top Acquisitions</h4>
                {inventory.slice(0, 3).map(item => (
                  <div key={item.id} className="flex items-center gap-3">
                    <img src={item.imageUrl} className="w-10 h-10 rounded-lg object-cover bg-black" alt="" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-gray-200 truncate">{item.title}</p>
                      <p className="text-[10px] text-gray-500">{item.category}</p>
                    </div>
                    <span className="text-xs font-mono text-gray-300">R{item.retailPrice.toFixed(0)}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <button 
              onClick={() => setActiveTab('customers')}
              className="w-full py-4 bg-[#141414] border-t border-[#2A2A2A] text-[10px] font-bold text-gray-400 hover:text-white hover:bg-[#1E1E1E] transition flex items-center justify-center gap-2"
            >
              FULL ANALYTICS
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};
