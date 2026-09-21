import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  User, 
  Shield, 
  Clock, 
  TrendingUp, 
  Banknote, 
  Settings, 
  ChevronRight, 
  Lock, 
  History, 
  Award,
  Wallet,
  Zap
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const CashierProfile: React.FC = () => {
  const { salesHistory, showToast } = useApp();
  const [isChangingPin, setIsChangingPin] = useState(false);

  // Derive metrics for the current cashier (mocking "Cashier 01")
  const metrics = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const cashierSales = salesHistory.filter(s => s.cashier.includes('Cashier 01'));
    const todaySales = cashierSales.filter(s => s.timestamp.startsWith(today));
    
    const totalToday = todaySales.reduce((sum, s) => sum + s.total, 0);
    const cashToday = todaySales.filter(s => s.tenderMethod === 'cash').reduce((sum, s) => sum + s.total, 0);
    const volumeToday = todaySales.length;

    return {
      totalToday,
      cashToday,
      volumeToday,
      avgTicket: volumeToday > 0 ? totalToday / volumeToday : 0,
      recentActivity: cashierSales.slice(0, 5)
    };
  }, [salesHistory]);

  return (
    <div className="flex-1 h-full overflow-y-auto bg-[#0A0A0A] p-6 lg:p-10 custom-scrollbar">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* HEADER: IDENTITY CARD */}
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 p-8 bg-[#121212] border border-[#2A2A2A] rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#C85A32] opacity-[0.03] blur-[100px] pointer-events-none group-hover:opacity-[0.05] transition-opacity" />
          
          <div className="flex items-center gap-6 relative z-10">
            <div className="relative">
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-[#1E1E1E] to-[#0A0A0A] border-2 border-[#2A2A2A] flex items-center justify-center shadow-xl">
                <User className="w-12 h-12 text-[#E87A5D]" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-emerald-500 border-4 border-[#121212] flex items-center justify-center shadow-lg" title="Status: Online & Active">
                <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
              </div>
            </div>
            
            <div className="space-y-1">
              <h1 className="text-3xl font-black text-white font-headline tracking-tighter">Thabo Molefe</h1>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] px-2.5 py-1 rounded-lg bg-[#C85A32]/10 text-[#E87A5D] border border-[#C85A32]/20">
                  Senior Cashier
                </span>
                <span className="text-[10px] font-mono text-gray-500 bg-[#1A1A1A] px-2.5 py-1 rounded-lg border border-[#2A2A2A]">
                  ID: CSH-01-SOW
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 relative z-10">
            <div className="text-right hidden sm:block">
              <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Shift Session</p>
              <p className="text-sm font-bold text-gray-200">08:00 AM - 17:00 PM</p>
            </div>
            <button 
              onClick={() => showToast('Clock-Out Triggered', 'Session audit report is being compiled...', 'info')}
              className="px-6 py-3 bg-[#1A1A1A] hover:bg-red-950/20 text-gray-300 hover:text-red-400 border border-[#2A2A2A] hover:border-red-900/30 rounded-2xl text-xs font-black uppercase tracking-widest transition-all"
            >
              End Shift
            </button>
          </div>
        </header>

        {/* PERFORMANCE GRID */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Today\'s Yield', val: `R ${metrics.totalToday.toLocaleString()}`, icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-500/5' },
            { label: 'Cash in Drawer', val: `R ${metrics.cashToday.toLocaleString()}`, icon: Banknote, color: 'text-amber-400', bg: 'bg-amber-500/5' },
            { label: 'Transactions', val: metrics.volumeToday.toString(), icon: Zap, color: 'text-blue-400', bg: 'bg-blue-500/5' },
            { label: 'Avg Ticket', val: `R ${metrics.avgTicket.toFixed(0)}`, icon: Award, color: 'text-purple-400', bg: 'bg-purple-500/5' }
          ].map((stat, i) => (
            <div key={i} className="p-6 bg-[#121212] border border-[#2A2A2A] rounded-3xl space-y-3 shadow-lg hover:border-[#383838] transition-colors group">
              <div className={`w-10 h-10 rounded-2xl ${stat.bg} flex items-center justify-center border border-white/5`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div>
                <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest block">{stat.label}</span>
                <span className="text-xl font-black text-white font-mono">{stat.val}</span>
              </div>
            </div>
          ))}
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* SECURITY & DRAWER MANAGEMENT */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-[#121212] border border-[#2A2A2A] rounded-[2rem] overflow-hidden shadow-xl">
              <div className="p-6 border-b border-[#2A2A2A] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-[#C85A32]" />
                  <h2 className="text-sm font-black uppercase tracking-widest text-gray-200">Operational Security</h2>
                </div>
              </div>
              <div className="p-8 space-y-8">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-gray-100">Merchant Terminal Access</h3>
                    <p className="text-xs text-gray-500 max-w-sm leading-relaxed">Your 4-digit PIN is required for every POS transaction over R 5,000 and all vault overrides.</p>
                  </div>
                  <button 
                    onClick={() => setIsChangingPin(true)}
                    className="px-5 py-2.5 bg-[#1E1E1E] border border-[#2A2A2A] hover:border-[#C85A32] text-gray-300 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    Change PIN
                  </button>
                </div>

                <div className="h-[1px] bg-[#2A2A2A]" />

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-gray-100">Drawer Reconciliation</h3>
                    <p className="text-xs text-gray-500 max-w-sm leading-relaxed">Ensure physical cash matches terminal reporting before ending your session.</p>
                  </div>
                  <button 
                    onClick={() => showToast('Report Generated', 'Opening reconciliation audit for Drawer-01', 'success')}
                    className="px-5 py-2.5 bg-[#1E1E1E] border border-[#2A2A2A] hover:border-[#C85A32] text-gray-300 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2"
                  >
                    <Wallet className="w-3.5 h-3.5" />
                    Print X-Report
                  </button>
                </div>
              </div>
            </div>

            {/* RECENT SALES PERFORMANCE */}
            <div className="bg-[#121212] border border-[#2A2A2A] rounded-[2rem] overflow-hidden shadow-xl">
              <div className="p-6 border-b border-[#2A2A2A] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <History className="w-5 h-5 text-[#C85A32]" />
                  <h2 className="text-sm font-black uppercase tracking-widest text-gray-200">Recent Transactions</h2>
                </div>
                <button className="text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-[#E87A5D] transition">View All</button>
              </div>
              <div className="divide-y divide-[#2A2A2A]">
                {metrics.recentActivity.length > 0 ? metrics.recentActivity.map((sale) => (
                  <div key={sale.id} className="p-4 flex items-center justify-between hover:bg-[#1A1A1A] transition-colors group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-[#1E1E1E] border border-[#2A2A2A] flex items-center justify-center group-hover:border-[#C85A32]/30 transition-colors">
                        <Clock className="w-4 h-4 text-gray-500" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-200 uppercase tracking-tight">{sale.receiptNumber}</p>
                        <p className="text-[10px] text-gray-500 font-mono">{sale.timestamp}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-white font-mono">R {sale.total.toLocaleString()}</p>
                      <p className={`text-[9px] font-black uppercase tracking-widest ${sale.tenderMethod === 'cash' ? 'text-emerald-500' : 'text-blue-500'}`}>
                        {sale.tenderMethod}
                      </p>
                    </div>
                  </div>
                )) : (
                  <div className="p-12 text-center">
                    <History className="w-8 h-8 text-gray-700 mx-auto mb-3" />
                    <p className="text-[10px] text-gray-600 font-black uppercase tracking-widest">No Recent Sales</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* SIDEBAR: SYSTEM COMPLIANCE & HELP */}
          <div className="space-y-6">
            <div className="bg-[#121212] border border-[#2A2A2A] rounded-[2rem] p-8 space-y-6 shadow-xl">
              <div className="flex items-center gap-3">
                <Settings className="w-5 h-5 text-[#C85A32]" />
                <h2 className="text-sm font-black uppercase tracking-widest text-gray-200">Preferences</h2>
              </div>
              
              <div className="space-y-4">
                <button className="w-full flex items-center justify-between p-4 bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl hover:border-[#C85A32]/30 transition-all group">
                  <span className="text-xs font-bold text-gray-300 group-hover:text-white transition-colors">Language Settings</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-500 font-bold uppercase">English (SA)</span>
                    <ChevronRight className="w-4 h-4 text-gray-600" />
                  </div>
                </button>
                <button className="w-full flex items-center justify-between p-4 bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl hover:border-[#C85A32]/30 transition-all group">
                  <span className="text-xs font-bold text-gray-300 group-hover:text-white transition-colors">Terminal Hardware</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-emerald-500 font-bold uppercase">Connected</span>
                    <ChevronRight className="w-4 h-4 text-gray-600" />
                  </div>
                </button>
                <button className="w-full flex items-center justify-between p-4 bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl hover:border-[#C85A32]/30 transition-all group">
                  <span className="text-xs font-bold text-gray-300 group-hover:text-white transition-colors">NCR Compliance Guide</span>
                  <ChevronRight className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            </div>

            <div className="bg-[#1E1E1E] border border-[#C85A32]/30 rounded-[2rem] p-8 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Shield className="w-16 h-16 text-[#C85A32]" />
              </div>
              <h3 className="text-sm font-black text-white uppercase tracking-widest mb-2 relative z-10">Support Line</h3>
              <p className="text-xs text-gray-400 leading-relaxed mb-6 relative z-10">
                Emergency technical support or security override requests.
              </p>
              <button className="w-full py-4 bg-[#C85A32] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-[#C85A32]/20 hover:bg-[#b04d29] transition-all relative z-10">
                CALL MANAGER
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL: CHANGE PIN (Simplified Mock) */}
      {isChangingPin && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="w-full max-w-sm bg-[#121212] border border-[#2A2A2A] rounded-[2.5rem] p-10 space-y-8 shadow-2xl"
          >
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-3xl bg-[#C85A32]/10 border border-[#C85A32]/20 flex items-center justify-center mx-auto mb-4">
                <Lock className="w-8 h-8 text-[#E87A5D]" />
              </div>
              <h2 className="text-2xl font-black text-white font-headline">Change Terminal PIN</h2>
              <p className="text-xs text-gray-500">Security protocol requires a new 4-digit numeric code.</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Current PIN</label>
                <input type="password" maxLength={4} className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-2xl py-4 text-center text-2xl tracking-[1em] text-white focus:outline-none focus:border-[#C85A32]" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">New 4-Digit PIN</label>
                <input type="password" maxLength={4} className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-2xl py-4 text-center text-2xl tracking-[1em] text-white focus:outline-none focus:border-[#C85A32]" />
              </div>
            </div>

            <div className="flex gap-4">
              <button 
                onClick={() => setIsChangingPin(false)}
                className="flex-1 py-4 bg-[#1E1E1E] text-gray-400 hover:text-white rounded-2xl text-xs font-bold transition-all border border-[#2A2A2A]"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  setIsChangingPin(false);
                  showToast('PIN Updated', 'Your security credentials have been rotated successfully.', 'success');
                }}
                className="flex-1 py-4 bg-[#C85A32] text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-[#C85A32]/10"
              >
                Save
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
