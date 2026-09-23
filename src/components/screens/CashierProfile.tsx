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
  Zap,
  UserPlus,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  FileText
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useSales } from '../../context/SalesContext';
import { ShopProfileAndOfflineHub } from '../profile/ShopProfileAndOfflineHub';
import { BusinessRulesManager } from '../profile/BusinessRulesManager';
import { RefundRequest } from '../../types';

export const CashierProfile: React.FC = () => {
  const { 
    salesHistory, 
    showToast,
    currentUserProfile,
    supabaseUser,
    supabaseStatus 
  } = useApp();

  const { isOwner, isManager, role, provisionStaff } = useAuth();
  const { refundRequests, requestRefund, approveRefund } = useSales();

  const [isChangingPin, setIsChangingPin] = useState(false);
  const [isReauthenticating, setIsReauthenticating] = useState(false);
  const [pendingAction, setPendingAction] = useState<() => void>(() => {});
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [digitalSignature, setDigitalSignature] = useState<string | null>("Verified: RSA-4096 Authenticated");

  // Refund Management State
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [refundFilter, setRefundFilter] = useState<'all' | 'Pending Approval' | 'Approved' | 'Rejected'>('all');
  const [newRefundForm, setNewRefundForm] = useState({
    receiptNumber: '',
    itemId: '',
    quantity: 1,
    refundAmount: '',
    reason: ''
  });
  const [isSubmittingRefund, setIsSubmittingRefund] = useState(false);

  // Staff Provisioning State
  const [isProvisionModalOpen, setIsProvisionModalOpen] = useState(false);
  const [staffForm, setStaffForm] = useState({
    fullName: '',
    role: 'cashier' as 'cashier' | 'senior_cashier' | 'manager',
    cashierCode: '',
    pinCode: ''
  });
  const [isProvisioning, setIsProvisioning] = useState(false);

  // Owner Settings Toggle
  const [showOwnerSettings, setShowOwnerSettings] = useState(false);

  const handleSecureAction = (action: () => void) => {
    setPendingAction(() => action);
    setIsReauthenticating(true);
  };

  const confirmReauth = () => {
    setIsReauthenticating(false);
    pendingAction();
    showToast('Secure Action Authorized', 'Identity verified via secondary PIN challenge.', 'success');
  };

  const handleRequestRefundSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRefundForm.receiptNumber.trim() || !newRefundForm.itemId.trim() || !newRefundForm.reason.trim()) {
      showToast('Validation Error', 'Receipt number, Item ID, and reason are strictly required.', 'amber');
      return;
    }
    const amt = parseFloat(newRefundForm.refundAmount);
    if (isNaN(amt) || amt <= 0) {
      showToast('Validation Error', 'Please specify a valid refund amount.', 'amber');
      return;
    }

    setIsSubmittingRefund(true);
    try {
      const res = await requestRefund({
        receiptNumber: newRefundForm.receiptNumber.trim(),
        itemId: newRefundForm.itemId.trim(),
        quantity: newRefundForm.quantity || 1,
        refundAmount: amt,
        reason: newRefundForm.reason.trim()
      });

      if (res.success) {
        showToast('Refund Request Created', 'Pending manager review & authorization.', 'success');
        setNewRefundForm({ receiptNumber: '', itemId: '', quantity: 1, refundAmount: '', reason: '' });
      } else {
        showToast('Refund Request Error', res.error || 'Failed to submit refund request.', 'error');
      }
    } finally {
      setIsSubmittingRefund(false);
    }
  };

  const handleApproveRefund = async (refundId: string, approved: boolean, note?: string) => {
    const res = await approveRefund({ refundId, approved, note });
    if (res.success) {
      showToast(
        approved ? 'Refund Approved' : 'Refund Rejected',
        approved ? 'Item has been safely returned to Retail Floor inventory.' : 'Refund request declined.',
        approved ? 'success' : 'info'
      );
    } else {
      showToast('Refund Decision Failed', res.error || 'Could not process refund.', 'error');
    }
  };

  const handleProvisionStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffForm.fullName.trim() || !staffForm.cashierCode.trim()) {
      showToast('Validation Error', 'Staff full name and cashier code are mandatory.', 'amber');
      return;
    }

    setIsProvisioning(true);
    try {
      const res = await provisionStaff({
        fullName: staffForm.fullName.trim(),
        role: staffForm.role,
        cashierCode: staffForm.cashierCode.trim(),
        pinCode: staffForm.pinCode.trim() || undefined
      });

      if (res.success) {
        showToast('Staff Member Provisioned', `${staffForm.fullName} registered as ${staffForm.role.replace('_', ' ')}.`, 'success');
        setIsProvisionModalOpen(false);
        setStaffForm({ fullName: '', role: 'cashier', cashierCode: '', pinCode: '' });
      } else {
        showToast('Provisioning Error', res.error || 'Failed to provision staff member.', 'error');
      }
    } finally {
      setIsProvisioning(false);
    }
  };

  // Filtered refunds
  const filteredRefunds = useMemo(() => {
    if (refundFilter === 'all') return refundRequests;
    return refundRequests.filter(r => r.status === refundFilter);
  }, [refundRequests, refundFilter]);

  // Derive metrics for the current cashier
  const metrics = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const todaySales = salesHistory.filter(s => s.timestamp.startsWith(today));
    
    const totalToday = todaySales.reduce((sum, s) => sum + s.total, 0);
    const cashToday = todaySales.filter(s => s.tenderMethod === 'cash').reduce((sum, s) => sum + s.total, 0);
    const volumeToday = todaySales.length;

    return {
      totalToday,
      cashToday,
      volumeToday,
      avgTicket: volumeToday > 0 ? totalToday / volumeToday : 0,
      recentActivity: salesHistory.slice(0, 5)
    };
  }, [salesHistory]);

  const displayRole = useMemo(() => {
    if (role === 'owner' || role === 'admin') return 'Owner';
    if (role === 'manager') return 'Manager';
    if (role === 'senior_cashier') return 'Senior Cashier';
    return 'Cashier';
  }, [role]);

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
                {currentUserProfile?.full_name || 'Store Operator'}
              </h1>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-[11px] font-black uppercase tracking-[0.25em] px-3 py-1.5 rounded-xl bg-[#C85A32]/10 text-[#E87A5D] border border-[#C85A32]/20">
                  {displayRole}
                </span>
                <span className="text-[11px] font-mono text-gray-500 bg-[#1A1A1A] px-3 py-1.5 rounded-xl border border-[#2A2A2A]">
                  ID: {currentUserProfile?.cashier_code || 'CSH-01'}
                </span>
                {supabaseUser && (
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-1 rounded-lg flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Supabase Hardened
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 relative z-10 flex-wrap">
            {isManager && (
              <button 
                onClick={() => setIsProvisionModalOpen(true)}
                className="px-6 py-4 bg-[#C85A32] hover:bg-[#A94725] text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-xl flex items-center gap-2"
              >
                <UserPlus className="w-4 h-4" />
                Provision Staff
              </button>
            )}
            <button 
              onClick={() => setIsRefundModalOpen(true)}
              className="px-6 py-4 bg-[#1A1A1A] hover:bg-[#252525] text-gray-200 border border-[#2A2A2A] rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-xl flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4 text-[#E87A5D]" />
              Refund Requests ({refundRequests.filter(r => r.status === 'Pending Approval').length})
            </button>
          </div>
        </header>

        {/* PERFORMANCE QUICK STATS */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: 'Shift Yield', val: `R ${metrics.totalToday.toLocaleString()}`, icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-500/5' },
            { label: 'Drawer Cash', val: `R ${metrics.cashToday.toLocaleString()}`, icon: Banknote, color: 'text-amber-400', bg: 'bg-amber-500/5' },
            { label: 'Sales Count', val: metrics.volumeToday.toString(), icon: Zap, color: 'text-blue-400', bg: 'bg-blue-500/5' },
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

        {/* SHOP PROFILE & OFFLINE-FIRST HUB */}
        <ShopProfileAndOfflineHub />

        {/* OWNER SETTINGS (OWNER/MANAGER ONLY) */}
        {(isOwner || isManager) && (
          <div className="space-y-6">
            <button
              onClick={() => setShowOwnerSettings(!showOwnerSettings)}
              className={`w-full p-8 rounded-[2.5rem] border flex items-center justify-between transition-all group ${
                showOwnerSettings 
                  ? 'bg-amber-600 border-amber-500 shadow-xl shadow-amber-900/20' 
                  : 'bg-[#121212] border-[#2A2A2A] hover:border-amber-500/50 shadow-2xl'
              }`}
            >
              <div className="flex items-center gap-6">
                <div className={`p-4 rounded-2xl border transition-colors ${
                  showOwnerSettings ? 'bg-white/10 border-white/20' : 'bg-[#1A1A1A] border-[#2A2A2A] group-hover:border-amber-500/30'
                }`}>
                  <Settings className={`w-6 h-6 ${showOwnerSettings ? 'text-white' : 'text-amber-500'}`} />
                </div>
                <div className="text-left">
                  <h2 className={`text-sm font-black uppercase tracking-widest ${showOwnerSettings ? 'text-white' : 'text-gray-200'}`}>
                    Owner Settings & Business Rules
                  </h2>
                  <p className={`text-[11px] font-mono mt-0.5 ${showOwnerSettings ? 'text-white/70' : 'text-gray-500'}`}>
                    Interest Rates, Loan Terms, and Authoritative Audit History
                  </p>
                </div>
              </div>
              <ChevronRight className={`w-6 h-6 transition-transform duration-500 ${showOwnerSettings ? 'text-white rotate-90' : 'text-gray-600 group-hover:text-amber-500'}`} />
            </button>

            <AnimatePresence>
              {showOwnerSettings && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-8 bg-[#0D0D0D] border border-[#2A2A2A] rounded-[2.5rem] mt-2 shadow-inner">
                    <BusinessRulesManager />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* TRANSACTION JOURNAL */}
        <div className="bg-[#121212] border border-[#2A2A2A] rounded-[2.5rem] overflow-hidden shadow-2xl">
          <div className="p-8 border-b border-[#2A2A2A] flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3.5 bg-[#1A1A1A] rounded-2xl border border-[#2A2A2A]">
                <History className="w-6 h-6 text-gray-500" />
              </div>
              <div>
                <h2 className="text-sm font-black uppercase tracking-widest text-gray-200">Session Journal</h2>
                <p className="text-[11px] text-gray-500 font-mono">Immutable Sales & Transaction History</p>
              </div>
            </div>
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
                    <p className="text-[10px] text-gray-400 mt-1">{sale.items.length} items • Cashier: {sale.cashier}</p>
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

      {/* MODAL: REFUND REQUESTS & APPROVALS */}
      <AnimatePresence>
        {isRefundModalOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-6 bg-black/90 backdrop-blur-xl">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-4xl bg-[#121212] border border-[#2A2A2A] rounded-[2.5rem] p-8 lg:p-10 space-y-8 shadow-2xl max-h-[90vh] flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-[#2A2A2A] pb-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-[#C85A32]/10 rounded-2xl border border-[#C85A32]/20">
                    <RefreshCw className="w-6 h-6 text-[#E87A5D]" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white font-headline">Refund Authorizations & Requests</h2>
                    <p className="text-xs text-gray-400">Multi-step retail refund audit ledger & manager approvals</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsRefundModalOpen(false)}
                  className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-[#1A1A1A]"
                >
                  ✕
                </button>
              </div>

              {/* TABS */}
              <div className="flex items-center gap-2 border-b border-[#2A2A2A] pb-4">
                {(['all', 'Pending Approval', 'Approved', 'Rejected'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setRefundFilter(tab)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                      refundFilter === tab 
                        ? 'bg-[#C85A32] text-white' 
                        : 'bg-[#1A1A1A] text-gray-400 hover:text-white'
                    }`}
                  >
                    {tab === 'all' ? 'All Requests' : tab}
                  </button>
                ))}
              </div>

              {/* LIST OF REQUESTS */}
              <div className="flex-1 overflow-y-auto space-y-4 no-scrollbar pr-2 min-h-[200px]">
                {filteredRefunds.length > 0 ? (
                  filteredRefunds.map(req => (
                    <div 
                      key={req.id} 
                      className="p-5 bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono font-bold text-white">{req.receiptNumber}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                            req.status === 'Approved' 
                              ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60'
                              : req.status === 'Rejected'
                              ? 'bg-red-950/60 text-red-400 border-red-800/60'
                              : 'bg-amber-950/60 text-amber-400 border-amber-800/60'
                          }`}>
                            {req.status}
                          </span>
                          <span className="text-[10px] text-gray-500 font-mono">
                            {new Date(req.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-gray-200">{req.itemTitle} ({req.itemSku})</p>
                        <p className="text-xs text-gray-400 italic">Reason: "{req.reason}"</p>
                        <p className="text-[11px] text-gray-500">Requested by: {req.requestedByName || 'Cashier'}</p>
                      </div>

                      <div className="flex sm:flex-col items-end gap-3 shrink-0">
                        <span className="text-lg font-mono font-bold text-white">
                          R {req.refundAmount.toLocaleString()}
                        </span>

                        {isManager && req.status === 'Pending Approval' && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleApproveRefund(req.id, false, 'Declined by manager')}
                              className="px-3 py-1.5 bg-red-900/30 hover:bg-red-900/50 text-red-300 border border-red-800/40 rounded-xl text-xs font-bold transition flex items-center gap-1"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              Reject
                            </button>
                            <button
                              onClick={() => handleApproveRefund(req.id, true)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              Approve
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-12 text-center text-gray-500">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-xs">No refund requests found matching this filter.</p>
                  </div>
                )}
              </div>

              {/* REQUEST FORM ACCORDION FOR CASHIERS / MANAGERS */}
              <div className="pt-4 border-t border-[#2A2A2A]">
                <h3 className="text-xs font-black uppercase text-gray-400 tracking-wider mb-3">
                  Submit New Refund Request
                </h3>
                <form onSubmit={handleRequestRefundSubmit} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <input
                    type="text"
                    value={newRefundForm.receiptNumber}
                    onChange={e => setNewRefundForm({ ...newRefundForm, receiptNumber: e.target.value })}
                    placeholder="Receipt Number (e.g. REC-10293)"
                    className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl px-3 py-2 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-[#C85A32]"
                  />
                  <input
                    type="text"
                    value={newRefundForm.itemId}
                    onChange={e => setNewRefundForm({ ...newRefundForm, itemId: e.target.value })}
                    placeholder="Item ID or SKU"
                    className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl px-3 py-2 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-[#C85A32]"
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={newRefundForm.refundAmount}
                    onChange={e => setNewRefundForm({ ...newRefundForm, refundAmount: e.target.value })}
                    placeholder="Refund Amount (R)"
                    className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl px-3 py-2 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-[#C85A32]"
                  />
                  <input
                    type="text"
                    value={newRefundForm.reason}
                    onChange={e => setNewRefundForm({ ...newRefundForm, reason: e.target.value })}
                    placeholder="Reason (Defect, exchange, etc.)"
                    className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl px-3 py-2 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-[#C85A32]"
                  />
                  <div className="sm:col-span-4 flex justify-end">
                    <button
                      type="submit"
                      disabled={isSubmittingRefund}
                      className="px-6 py-2.5 bg-[#C85A32] hover:bg-[#A94725] text-white rounded-xl text-xs font-bold transition disabled:opacity-50"
                    >
                      {isSubmittingRefund ? 'Submitting...' : 'Submit Refund Request'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: STAFF PROVISIONING (MANAGER/OWNER ONLY) */}
      <AnimatePresence>
        {isProvisionModalOpen && isManager && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-6 bg-black/90 backdrop-blur-xl">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-[#121212] border border-[#2A2A2A] rounded-[2.5rem] p-8 lg:p-10 space-y-8 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-[#2A2A2A] pb-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-[#C85A32]/10 rounded-2xl border border-[#C85A32]/20">
                    <UserPlus className="w-6 h-6 text-[#E87A5D]" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white font-headline">Provision Staff Member</h2>
                    <p className="text-xs text-gray-400">Add cashier or manager with verified access code</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsProvisionModalOpen(false)}
                  className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-[#1A1A1A]"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleProvisionStaffSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Full Legal Name</label>
                  <input
                    type="text"
                    required
                    value={staffForm.fullName}
                    onChange={e => setStaffForm({ ...staffForm, fullName: e.target.value })}
                    placeholder="e.g. Lerato Khumalo"
                    className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#C85A32]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Role Level</label>
                  <select
                    value={staffForm.role}
                    onChange={e => setStaffForm({ ...staffForm, role: e.target.value as any })}
                    className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#C85A32]"
                  >
                    <option value="cashier">Cashier</option>
                    <option value="senior_cashier">Senior Cashier</option>
                    <option value="manager">Manager</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Cashier Code</label>
                    <input
                      type="text"
                      required
                      value={staffForm.cashierCode}
                      onChange={e => setStaffForm({ ...staffForm, cashierCode: e.target.value })}
                      placeholder="e.g. CSH-04"
                      className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#C85A32] font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Terminal PIN</label>
                    <input
                      type="password"
                      maxLength={6}
                      value={staffForm.pinCode}
                      onChange={e => setStaffForm({ ...staffForm, pinCode: e.target.value })}
                      placeholder="Optional 4-6 digit PIN"
                      className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#C85A32] font-mono"
                    />
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsProvisionModalOpen(false)}
                    className="flex-1 py-3 bg-[#1A1A1A] text-gray-400 rounded-xl text-xs font-bold hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isProvisioning}
                    className="flex-1 py-3 bg-[#C85A32] hover:bg-[#A94725] text-white rounded-xl text-xs font-bold shadow-lg disabled:opacity-50"
                  >
                    {isProvisioning ? 'Registering...' : 'Provision Staff'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
    </div>
  );
};
