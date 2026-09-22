import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
  Fingerprint,
  Key,
  Activity,
  Layers,
  Database,
  Terminal,
  Save,
  PenTool,
  Wallet,
  Zap
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ShopProfileAndOfflineHub } from '../profile/ShopProfileAndOfflineHub';

export const CashierProfile: React.FC = () => {
  const { 
    salesHistory, 
    showToast,
    currentUserProfile,
    supabaseUser,
    supabaseStatus 
  } = useApp();
  const [isChangingPin, setIsChangingPin] = useState(false);
  const [isReauthenticating, setIsReauthenticating] = useState(false);
  const [pendingAction, setPendingAction] = useState<() => void>(() => {});
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [digitalSignature, setDigitalSignature] = useState<string | null>("Verified: T. Molefe (RSA-4096)");

  const handleSecureAction = (action: () => void) => {
    setPendingAction(() => action);
    setIsReauthenticating(true);
  };

  const confirmReauth = () => {
    setIsReauthenticating(false);
    pendingAction();
    showToast('Secure Action Authorized', 'Identity verified via secondary PIN challenge.', 'success');
  };

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
      <div className="max-w-6xl mx-auto space-y-10">
        
        {/* HEADER: IDENTITY CARD */}
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 p-8 lg:p-10 bg-[#121212] border border-[#2A2A2A] rounded-[3rem] shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-[40rem] h-[40rem] bg-[#C85A32] opacity-[0.02] blur-[120px] pointer-events-none group-hover:opacity-[0.04] transition-opacity duration-1000" />
          
          <div className="flex items-center gap-8 relative z-10">
            <div className="relative">
              <div className="w-28 h-28 rounded-[2rem] bg-gradient-to-br from-[#1E1E1E] to-[#0A0A0A] border-2 border-[#2A2A2A] flex items-center justify-center shadow-2xl group-hover:border-[#C85A32]/30 transition-colors duration-500">
                <User className="w-14 h-14 text-[#E87A5D]" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-10 h-10 rounded-full bg-emerald-500 border-4 border-[#121212] flex items-center justify-center shadow-lg" title="Status: Online & Active">
                <div className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
              </div>
            </div>
            
            <div className="space-y-2">
              <h1 className="text-4xl font-black text-white font-headline tracking-tighter">
                {currentUserProfile?.full_name || 'Thabo Molefe'}
              </h1>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-[11px] font-black uppercase tracking-[0.25em] px-3 py-1.5 rounded-xl bg-[#C85A32]/10 text-[#E87A5D] border border-[#C85A32]/20">
                  {currentUserProfile?.role?.replace('_', ' ') || 'Senior Cashier'}
                </span>
                <span className="text-[11px] font-mono text-gray-500 bg-[#1A1A1A] px-3 py-1.5 rounded-xl border border-[#2A2A2A]">
                  ID: {currentUserProfile?.cashier_code || 'CSH-01-SOW'}
                </span>
                {supabaseUser && (
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-1 rounded-lg flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Supabase Connected
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6 relative z-10">
            <div className="text-right hidden xl:block">
              <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">Shift Duration</p>
              <div className="flex items-center gap-2 text-sm font-bold text-gray-200">
                <Clock className="w-4 h-4 text-[#C85A32]" />
                08h 14m Active
              </div>
            </div>
            <button 
              onClick={() => showToast('Clock-Out Initiated', 'Compiling secure session handover report...', 'info')}
              className="px-8 py-4 bg-[#1A1A1A] hover:bg-red-950/30 text-gray-300 hover:text-red-400 border border-[#2A2A2A] hover:border-red-900/30 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-xl"
            >
              Close Session
            </button>
          </div>
        </header>

        {/* PERFORMANCE QUICK STATS */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: 'Shift Yield', val: `R ${metrics.totalToday.toLocaleString()}`, icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-500/5' },
            { label: 'Drawer Cash', val: `R ${metrics.cashToday.toLocaleString()}`, icon: Banknote, color: 'text-amber-400', bg: 'bg-amber-500/5' },
            { label: 'Volume', val: metrics.volumeToday.toString(), icon: Zap, color: 'text-blue-400', bg: 'bg-blue-500/5' },
            { label: 'Avg Ticket', val: `R ${metrics.avgTicket.toFixed(0)}`, icon: Award, color: 'text-purple-400', bg: 'bg-purple-500/5' }
          ].map((stat, i) => (
            <div key={i} className="p-8 bg-[#121212] border border-[#2A2A2A] rounded-[2.5rem] space-y-4 shadow-xl hover:border-[#383838] transition-all group relative overflow-hidden">
              <div className={`w-12 h-12 rounded-2xl ${stat.bg} flex items-center justify-center border border-white/5 relative z-10`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
              <div className="relative z-10">
                <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest block mb-1">{stat.label}</span>
                <span className="text-2xl font-black text-white font-mono">{stat.val}</span>
              </div>
              <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 blur-3xl rounded-full -mr-12 -mt-12 group-hover:bg-white/10 transition-colors" />
            </div>
          ))}
        </section>

        {/* SHOP PROFILE & WHATSAPP-STYLE LOCAL DEVICE PERSISTENCE HUB */}
        <ShopProfileAndOfflineHub />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT COLUMN: PERFORMANCE & JOURNAL */}
          <div className="lg:col-span-7 space-y-8">
            
            {/* PERFORMANCE INTELLIGENCE */}
            <div className="bg-[#121212] border border-[#2A2A2A] rounded-[2.5rem] overflow-hidden shadow-2xl">
              <div className="p-8 border-b border-[#2A2A2A] flex items-center justify-between bg-gradient-to-r from-[#121212] to-[#1A1A1A]">
                <div className="flex items-center gap-4">
                  <div className="p-3.5 bg-[#C85A32]/10 rounded-2xl border border-[#C85A32]/20">
                    <Activity className="w-6 h-6 text-[#E87A5D]" />
                  </div>
                  <div>
                    <h2 className="text-sm font-black uppercase tracking-widest text-gray-200">Intelligence Matrix</h2>
                    <p className="text-[11px] text-gray-500 font-mono">Real-time Productivity Benchmarks</p>
                  </div>
                </div>
              </div>
              
              <div className="p-10 grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Shift Quota Progress</span>
                    <span className="text-sm font-mono text-emerald-400">84%</span>
                  </div>
                  <div className="h-2.5 bg-[#1A1A1A] rounded-full overflow-hidden border border-white/5 shadow-inner">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: '84%' }}
                      className="h-full bg-gradient-to-r from-[#C85A32] to-emerald-500"
                    />
                  </div>
                  <div className="flex items-start gap-3 p-4 bg-[#0A0A0A] rounded-2xl border border-[#2A2A2A]">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                    <p className="text-[11px] text-gray-500 leading-relaxed italic">
                      Outstanding yield performance. You are currently R 2,400 ahead of the branch average for this shift.
                    </p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">CSAT Score (Verified)</span>
                    <span className="text-sm font-mono text-blue-400">4.92/5</span>
                  </div>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map(star => (
                      <Award key={star} className={`w-5 h-5 ${star === 5 ? 'text-gray-800' : 'text-blue-500 fill-blue-500/20'}`} />
                    ))}
                  </div>
                  <div className="flex items-start gap-3 p-4 bg-[#0A0A0A] rounded-2xl border border-[#2A2A2A]">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                    <p className="text-[11px] text-gray-500 leading-relaxed italic">
                      Customer feedback notes exceptional professionalism during appraisal sessions.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* TRANSACTION JOURNAL */}
            <div className="bg-[#121212] border border-[#2A2A2A] rounded-[2.5rem] overflow-hidden shadow-2xl">
              <div className="p-8 border-b border-[#2A2A2A] flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3.5 bg-[#1A1A1A] rounded-2xl border border-[#2A2A2A]">
                    <History className="w-6 h-6 text-gray-500" />
                  </div>
                  <div>
                    <h2 className="text-sm font-black uppercase tracking-widest text-gray-200">Session Journal</h2>
                    <p className="text-[11px] text-gray-500 font-mono">Immutable Audit Logs</p>
                  </div>
                </div>
                <button className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-500 hover:text-[#E87A5D] transition py-2.5 px-5 rounded-xl border border-[#2A2A2A] hover:bg-[#1A1A1A]">
                  FULL EXPORT
                </button>
              </div>
              <div className="divide-y divide-[#2A2A2A]">
                {metrics.recentActivity.length > 0 ? metrics.recentActivity.map((sale) => (
                  <div key={sale.id} className="p-8 flex items-center justify-between hover:bg-[#1A1A1A] transition-all group">
                    <div className="flex items-center gap-6">
                      <div className="w-14 h-14 rounded-2xl bg-[#1E1E1E] border border-[#2A2A2A] flex items-center justify-center group-hover:border-[#C85A32]/40 transition-all shadow-inner">
                        <Clock className="w-6 h-6 text-gray-700" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-100 uppercase tracking-tight">{sale.receiptNumber}</p>
                        <p className="text-[11px] text-gray-500 font-mono mt-0.5">{sale.timestamp}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-black text-white font-mono leading-none">R {sale.total.toLocaleString()}</p>
                      <div className="flex items-center justify-end gap-2.5 mt-2">
                        <div className={`w-2 h-2 rounded-full ${sale.tenderMethod === 'cash' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.3)]'}`} />
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                          {sale.tenderMethod}
                        </p>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="p-20 text-center">
                    <History className="w-16 h-16 text-gray-800 mx-auto mb-6 opacity-30" />
                    <p className="text-[11px] text-gray-600 font-black uppercase tracking-widest">No Operational History Found</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: SECURITY & MANAGER TOOLS */}
          <div className="lg:col-span-5 space-y-8">
            
            {/* SECURE SESSION MANAGEMENT */}
            <div className="bg-[#121212] border border-[#2A2A2A] rounded-[2.5rem] p-10 space-y-10 shadow-2xl relative overflow-hidden">
              <div className="flex items-center gap-4">
                <div className="p-3.5 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
                  <Fingerprint className="w-6 h-6 text-emerald-500" />
                </div>
                <h2 className="text-sm font-black uppercase tracking-widest text-gray-200">Identity & Handover</h2>
              </div>

              <div className="space-y-8">
                <div className="space-y-4 p-6 bg-[#0A0A0A] rounded-[2.5rem] border border-[#2A2A2A] shadow-inner">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] text-gray-500 font-black uppercase tracking-[0.25em]">Digital Signature</span>
                    <button 
                      onClick={() => setIsSignatureModalOpen(true)}
                      className="text-[10px] font-black uppercase text-[#E87A5D] hover:opacity-80 transition"
                    >
                      Update
                    </button>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-[#1A1A1A] border border-[#2A2A2A] flex items-center justify-center">
                      <PenTool className="w-6 h-6 text-gray-600" />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className="text-xs font-mono text-gray-300 truncate">
                        {digitalSignature || "Credentials Required"}
                      </p>
                      <p className="text-[9px] text-emerald-500 font-bold uppercase tracking-widest mt-1">Authorized Legal Witness</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <button 
                    onClick={() => handleSecureAction(() => setIsChangingPin(true))}
                    className="w-full flex items-center justify-between p-6 bg-[#1A1A1A] border border-[#2A2A2A] rounded-[2rem] hover:border-[#C85A32]/40 transition-all group"
                  >
                    <div className="flex items-center gap-5">
                      <div className="w-10 h-10 rounded-xl bg-[#222] flex items-center justify-center group-hover:bg-[#C85A32]/20 transition-colors">
                        <Key className="w-5 h-5 text-gray-500 group-hover:text-[#E87A5D]" />
                      </div>
                      <span className="text-xs font-bold text-gray-300 group-hover:text-white">Pin Rotation Protocol</span>
                    </div>
                    <Lock className="w-4 h-4 text-gray-700 group-hover:text-gray-500" />
                  </button>
                  
                  <button 
                    onClick={() => handleSecureAction(() => showToast('Audit Report Compiled', 'X-Report generated and synced.', 'success'))}
                    className="w-full flex items-center justify-between p-6 bg-[#1A1A1A] border border-[#2A2A2A] rounded-[2rem] hover:border-[#C85A32]/40 transition-all group"
                  >
                    <div className="flex items-center gap-5">
                      <div className="w-10 h-10 rounded-xl bg-[#222] flex items-center justify-center group-hover:bg-[#C85A32]/20 transition-colors">
                        <Wallet className="w-5 h-5 text-gray-500 group-hover:text-[#E87A5D]" />
                      </div>
                      <span className="text-xs font-bold text-gray-300 group-hover:text-white">Drawer Reconciliation</span>
                    </div>
                    <Lock className="w-4 h-4 text-gray-700 group-hover:text-gray-500" />
                  </button>
                </div>
              </div>
            </div>

            {/* MANAGER TOOLS SECTION */}
            <div className="bg-[#121212] border border-[#2A2A2A] rounded-[2.5rem] p-10 space-y-10 shadow-2xl">
              <div className="flex items-center gap-4">
                <div className="p-3.5 bg-[#C85A32]/10 rounded-2xl border border-[#C85A32]/20">
                  <Shield className="w-6 h-6 text-[#C85A32]" />
                </div>
                <h2 className="text-sm font-black uppercase tracking-widest text-gray-200">Terminal Authority</h2>
              </div>
              
              <div className="space-y-8">
                <div className="space-y-4">
                  <span className="text-[10px] text-gray-500 font-black uppercase tracking-[0.25em] px-1">Access Privileges</span>
                  <div className="flex flex-wrap gap-2.5">
                    {['POS_FULL', 'VAULT_READ', 'SAPS_FILING', 'INTAKE_LEVEL_2', 'NCR_COMPLIANCE'].map(perm => (
                      <span key={perm} className="text-[10px] font-mono font-bold px-3 py-1.5 rounded-xl bg-[#1A1A1A] border border-[#2A2A2A] text-gray-400">
                        {perm}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="h-[1px] bg-[#2A2A2A] mx-1" />

                <div className="space-y-4">
                  <button className="w-full flex items-center justify-between p-5 bg-[#1A1A1A] border border-[#2A2A2A] rounded-[1.5rem] hover:border-[#C85A32]/40 transition-all group">
                    <div className="flex items-center gap-4">
                      <Database className="w-5 h-5 text-gray-600 group-hover:text-[#C85A32]" />
                      <span className="text-xs font-bold text-gray-300 group-hover:text-white">Local Persistence Engine</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-700" />
                  </button>
                  <button className="w-full flex items-center justify-between p-5 bg-[#1A1A1A] border border-[#2A2A2A] rounded-[1.5rem] hover:border-[#C85A32]/40 transition-all group">
                    <div className="flex items-center gap-4">
                      <Terminal className="w-5 h-5 text-gray-600 group-hover:text-[#C85A32]" />
                      <span className="text-xs font-bold text-gray-300 group-hover:text-white">Hardware Identifier</span>
                    </div>
                    <span className="text-[11px] text-emerald-500 font-mono font-black px-3 py-1.5 rounded-xl bg-emerald-500/5">TRM-402</span>
                  </button>
                </div>

                <button 
                  onClick={() => handleSecureAction(() => showToast('System Purge', 'Terminal hardware reset initiated.', 'amber'))}
                  className="w-full py-5 bg-[#1A1A1A] text-red-400 border border-red-900/20 hover:bg-red-900/10 rounded-[2rem] text-[11px] font-black uppercase tracking-[0.3em] transition-all shadow-xl"
                >
                  Factory Reset Hub
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL: RE-AUTHENTICATION (PIN CHALLENGE) */}
      <AnimatePresence>
        {isReauthenticating && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-6 bg-black/95 backdrop-blur-2xl">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              className="w-full max-w-sm bg-[#121212] border border-[#2A2A2A] rounded-[3.5rem] p-12 lg:p-14 space-y-10 shadow-[0_0_100px_rgba(0,0,0,0.8)] text-center relative overflow-hidden"
            >
              <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-transparent via-[#C85A32] to-transparent opacity-30" />
              
              <div className="space-y-6">
                <div className="w-24 h-24 rounded-[2.5rem] bg-[#C85A32]/10 border border-[#C85A32]/20 flex items-center justify-center mx-auto mb-8 shadow-inner relative group">
                  <div className="absolute inset-0 bg-[#C85A32]/10 blur-2xl rounded-full scale-150 opacity-50" />
                  <Lock className="w-12 h-12 text-[#E87A5D] relative z-10" />
                </div>
                <h2 className="text-2xl font-black text-white font-headline tracking-tight">Challenge Required</h2>
                <p className="text-xs text-gray-500 leading-relaxed px-2">Secondary verification is mandatory for this operation. Input your 4-digit master PIN.</p>
              </div>

              <div className="flex justify-center gap-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="w-14 h-20 rounded-2xl bg-[#0A0A0A] border-2 border-[#2A2A2A] flex items-center justify-center shadow-inner">
                    <div className="w-3 h-3 rounded-full bg-gray-800 animate-pulse" />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setIsReauthenticating(false)}
                  className="py-5 bg-[#1E1E1E] text-gray-400 hover:text-white rounded-[2rem] text-[11px] font-black uppercase tracking-widest transition-all border border-[#2A2A2A]"
                >
                  ABORT
                </button>
                <button 
                  onClick={confirmReauth}
                  className="py-5 bg-[#C85A32] text-white rounded-[2rem] text-[11px] font-black uppercase tracking-widest shadow-2xl shadow-[#C85A32]/30 active:scale-95 transition-all"
                >
                  VERIFY
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: DIGITAL SIGNATURE POLICY */}
      <AnimatePresence>
        {isSignatureModalOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-6 bg-black/95 backdrop-blur-2xl">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              className="w-full max-w-xl bg-[#121212] border border-[#2A2A2A] rounded-[3.5rem] p-12 lg:p-14 space-y-12 shadow-[0_0_100px_rgba(0,0,0,0.8)]"
            >
              <div className="text-center space-y-6">
                <div className="w-24 h-24 rounded-[2.5rem] bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-8 shadow-inner">
                  <PenTool className="w-12 h-12 text-emerald-500" />
                </div>
                <h2 className="text-3xl font-black text-white font-headline tracking-tight">Legal Signature Policy</h2>
                <p className="text-xs text-gray-500 leading-relaxed px-12">
                  This identifier is cryptographically linked to your session. It will be appended to all SAPS Form-A filings and financial contracts.
                </p>
              </div>

              <div className="space-y-8">
                <div className="p-12 bg-[#0A0A0A] border-2 border-dashed border-[#2A2A2A] rounded-[2.5rem] h-48 flex items-center justify-center relative overflow-hidden group">
                  <div className="absolute inset-0 bg-emerald-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity" />
                  <span className="text-[10px] text-gray-800 italic font-mono uppercase tracking-[0.5em] relative z-10">Capture Input on Hardware-Pad</span>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] ml-2">Verified Identifier</label>
                  <input 
                    type="text" 
                    value={digitalSignature || ""} 
                    onChange={(e) => setDigitalSignature(e.target.value)}
                    placeholder="Verified: T. Molefe"
                    className="w-full bg-[#0A0A0A] border-2 border-[#2A2A2A] rounded-[1.5rem] py-5 px-8 text-sm font-mono text-white focus:outline-none focus:border-emerald-500/50 transition-all shadow-inner placeholder:text-gray-800" 
                  />
                </div>
              </div>

              <div className="flex gap-6">
                <button 
                  onClick={() => setIsSignatureModalOpen(false)}
                  className="flex-1 py-5 bg-[#1E1E1E] text-gray-400 hover:text-white rounded-[2rem] text-[11px] font-black uppercase tracking-widest transition-all border border-[#2A2A2A]"
                >
                  DISCARD
                </button>
                <button 
                  onClick={() => {
                    setIsSignatureModalOpen(false);
                    showToast('Signature Updated', 'Digital legal credentials have been rotated.', 'success');
                  }}
                  className="flex-1 py-5 bg-emerald-600 text-white rounded-[2rem] text-[11px] font-black uppercase tracking-widest shadow-2xl shadow-emerald-900/30 active:scale-95 transition-all"
                >
                  COMMIT SIGNATURE
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: CHANGE PIN */}
      <AnimatePresence>
        {isChangingPin && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-6 bg-black/95 backdrop-blur-2xl">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              className="w-full max-w-md bg-[#121212] border border-[#2A2A2A] rounded-[3.5rem] p-12 lg:p-14 space-y-12 shadow-[0_0_100px_rgba(0,0,0,0.8)]"
            >
              <div className="text-center space-y-4">
                <div className="w-20 h-20 rounded-[2rem] bg-[#C85A32]/10 border border-[#C85A32]/20 flex items-center justify-center mx-auto mb-6">
                  <Lock className="w-10 h-10 text-[#E87A5D]" />
                </div>
                <h2 className="text-2xl font-black text-white font-headline">Credential Rotation</h2>
                <p className="text-xs text-gray-500">Rotate your 4-digit terminal access PIN.</p>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Old PIN</label>
                  <input type="password" maxLength={4} className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-2xl py-5 text-center text-3xl tracking-[1.2em] text-white focus:outline-none focus:border-[#C85A32]" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">New PIN</label>
                  <input type="password" maxLength={4} className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-2xl py-5 text-center text-3xl tracking-[1.2em] text-white focus:outline-none focus:border-[#C85A32]" />
                </div>
              </div>

              <div className="flex gap-6">
                <button 
                  onClick={() => setIsChangingPin(false)}
                  className="flex-1 py-5 bg-[#1E1E1E] text-gray-400 hover:text-white rounded-[2rem] text-[11px] font-black uppercase tracking-widest transition-all"
                >
                  CANCEL
                </button>
                <button 
                  onClick={() => {
                    setIsChangingPin(false);
                    showToast('PIN Rotated', 'Your security credentials have been updated.', 'success');
                  }}
                  className="flex-1 py-5 bg-[#C85A32] text-white rounded-[2rem] text-[11px] font-black uppercase tracking-widest shadow-2xl"
                >
                  ROTATE PIN
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
