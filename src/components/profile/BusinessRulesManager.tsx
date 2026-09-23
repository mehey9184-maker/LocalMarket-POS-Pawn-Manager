import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { BusinessRules, BusinessRuleAuditLog } from '../../types';
import { shopProfilesApi } from '../../services/supabaseApi';
import { 
  ShieldAlert, 
  Clock, 
  Banknote, 
  Lock, 
  Percent, 
  History, 
  AlertTriangle,
  Save,
  Info,
  Calendar,
  Wallet
} from 'lucide-react';

export const BusinessRulesManager: React.FC = () => {
  const { businessRules, updateBusinessRules, showToast, shopProfile } = useApp();
  const { role, isOwner } = useAuth();
  
  const [localRules, setLocalRules] = useState<BusinessRules>(businessRules);
  const [changeReason, setChangeReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [auditLogs, setAuditLogs] = useState<BusinessRuleAuditLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  useEffect(() => {
    setLocalRules(businessRules);
  }, [businessRules]);

  useEffect(() => {
    if (shopProfile.id) {
      setIsLoadingLogs(true);
      shopProfilesApi.getBusinessRuleAuditLogs(shopProfile.id)
        .then(logs => setAuditLogs(logs as any))
        .finally(() => setIsLoadingLogs(false));
    }
  }, [shopProfile.id]);

  const handleSave = async () => {
    if (!isOwner) {
      showToast('Unauthorized', 'Only the Shop Owner can modify material financial rules.', 'error');
      return;
    }

    if (!changeReason.trim()) {
      showToast('Reason Required', 'Please provide a brief reason for changing the business rules for the audit log.', 'amber');
      return;
    }

    setIsSaving(true);
    try {
      await updateBusinessRules(localRules, changeReason);
      setChangeReason('');
      
      // Refresh audit logs
      if (shopProfile.id) {
        const logs = await shopProfilesApi.getBusinessRuleAuditLogs(shopProfile.id);
        setAuditLogs(logs as any);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (field: keyof BusinessRules, value: any) => {
    setLocalRules(prev => ({ ...prev, [field]: value }));
  };

  if (role !== 'owner' && role !== 'manager' && role !== 'admin') {
    return null;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-4 mb-2">
        <div className="p-3 bg-amber-500/10 rounded-2xl border border-amber-500/20">
          <ShieldAlert className="w-6 h-6 text-amber-500" />
        </div>
        <div>
          <h2 className="text-xl font-black text-white font-headline">Authoritative Shop Rules</h2>
          <p className="text-xs text-gray-500">Control interest rates, loan terms, and financial margins for this branch.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* SETTINGS FORM */}
        <div className="space-y-6">
          <div className="bg-[#121212] border border-[#2A2A2A] rounded-[2rem] p-8 space-y-8 shadow-xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Interest Rate */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                  <Percent className="w-3 h-3" />
                  Monthly Interest Rate (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="30"
                    disabled={!isOwner}
                    value={Math.round(localRules.pawnMonthlyInterestRate * 100 * 10) / 10}
                    onChange={e => handleChange('pawnMonthlyInterestRate', (parseFloat(e.target.value) || 0) / 100)}
                    className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl px-4 py-3 text-white font-bold font-mono focus:border-amber-500/50 focus:outline-none disabled:opacity-50"
                  />
                  <span className="absolute right-4 top-3 text-gray-500 text-xs font-bold">%</span>
                </div>
                <p className="text-[10px] text-gray-500">NCR Legal Cap: 5.0% for new agreements.</p>
              </div>

              {/* Storage & Admin Fee */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                  <Lock className="w-3 h-3" />
                  Vault Storage & Admin Fee (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="50"
                    disabled={!isOwner}
                    value={Math.round(localRules.pawnStorageAdminFeeRate * 100 * 10) / 10}
                    onChange={e => handleChange('pawnStorageAdminFeeRate', (parseFloat(e.target.value) || 0) / 100)}
                    className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl px-4 py-3 text-white font-bold font-mono focus:border-amber-500/50 focus:outline-none disabled:opacity-50"
                  />
                  <span className="absolute right-4 top-3 text-gray-500 text-xs font-bold">%</span>
                </div>
                <p className="text-[10px] text-gray-500">Standard insured vault rate: 5% - 10%.</p>
              </div>

              {/* Loan Term */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                  <Clock className="w-3 h-3" />
                  Default Loan Term (Days)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max="365"
                    disabled={!isOwner}
                    value={localRules.defaultLoanTermDays}
                    onChange={e => handleChange('defaultLoanTermDays', parseInt(e.target.value) || 30)}
                    className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl px-4 py-3 text-white font-bold font-mono focus:border-amber-500/50 focus:outline-none disabled:opacity-50"
                  />
                  <span className="absolute right-4 top-3 text-gray-500 text-xs font-bold">Days</span>
                </div>
              </div>

              {/* Grace Period */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                  <Calendar className="w-3 h-3" />
                  Grace Period (Days)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="90"
                    disabled={!isOwner}
                    value={localRules.gracePeriodDays}
                    onChange={e => handleChange('gracePeriodDays', parseInt(e.target.value) || 0)}
                    className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl px-4 py-3 text-white font-bold font-mono focus:border-amber-500/50 focus:outline-none disabled:opacity-50"
                  />
                  <span className="absolute right-4 top-3 text-gray-500 text-xs font-bold">Days</span>
                </div>
              </div>

              {/* Min Principal */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                  <Wallet className="w-3 h-3" />
                  Minimum Loan Principal
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-3 text-amber-500 font-bold font-mono">R</span>
                  <input
                    type="number"
                    min="1"
                    disabled={!isOwner}
                    value={localRules.minLoanPrincipal}
                    onChange={e => handleChange('minLoanPrincipal', parseFloat(e.target.value) || 0)}
                    className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl pl-8 pr-4 py-3 text-white font-bold font-mono focus:border-amber-500/50 focus:outline-none disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Retail Multiplier */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                  <TrendingUp className="w-3 h-3" />
                  Retail Markup Multiplier
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    disabled={!isOwner}
                    value={localRules.defaultRetailMarkupMultiplier}
                    onChange={e => handleChange('defaultRetailMarkupMultiplier', parseFloat(e.target.value) || 1.8)}
                    className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl px-4 py-3 text-white font-bold font-mono focus:border-amber-500/50 focus:outline-none disabled:opacity-50"
                  />
                  <span className="absolute right-4 top-3 text-gray-500 text-xs font-bold">x</span>
                </div>
              </div>
            </div>

            {isOwner && (
              <div className="space-y-4 pt-4 border-t border-[#2A2A2A]">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Reason for change (Required for Audit)</label>
                  <textarea
                    value={changeReason}
                    onChange={e => setChangeReason(e.target.value)}
                    placeholder="e.g. Updating vault fees to reflect new insurance premiums..."
                    rows={2}
                    className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl px-4 py-3 text-xs text-white placeholder:text-gray-700 focus:border-amber-500/50 focus:outline-none"
                  />
                </div>
                <button
                  onClick={handleSave}
                  disabled={isSaving || !changeReason.trim()}
                  className="w-full py-4 bg-amber-600 hover:bg-amber-500 text-white rounded-2xl text-sm font-black uppercase tracking-widest shadow-xl shadow-amber-900/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:grayscale"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? 'PERSISTING TO CLOUD...' : 'COMMIT CHANGES TO SERVER'}
                </button>
              </div>
            )}

            {!isOwner && (
              <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl flex gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                <p className="text-[11px] text-amber-200/80 leading-relaxed">
                  <strong>Read-Only Mode:</strong> Managers may view these settings, but only the primary <strong>Shop Owner</strong> can authorize material changes to financial rules and interest rates.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* AUDIT LOGS */}
        <div className="space-y-6">
          <div className="bg-[#121212] border border-[#2A2A2A] rounded-[2rem] overflow-hidden shadow-2xl flex flex-col h-[600px]">
            <div className="p-6 border-b border-[#2A2A2A] flex items-center justify-between bg-[#161616]">
              <div className="flex items-center gap-3">
                <History className="w-5 h-5 text-gray-500" />
                <h3 className="text-xs font-black uppercase tracking-widest text-gray-300">Rule Audit History</h3>
              </div>
              <span className="text-[10px] font-mono text-gray-500">Immutable Ledger</span>
            </div>

            <div className="flex-1 overflow-y-auto p-2 no-scrollbar divide-y divide-[#2A2A2A]">
              {isLoadingLogs ? (
                <div className="p-10 text-center space-y-4">
                  <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-[10px] text-gray-500 font-mono uppercase tracking-widest">Fetching Audit Log...</p>
                </div>
              ) : auditLogs.length > 0 ? (
                auditLogs.map(log => (
                  <div key={log.id} className="p-4 hover:bg-[#1A1A1A] transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-[#2A2A2A] flex items-center justify-center text-[10px] font-bold text-gray-400">
                          {log.actorName.charAt(0)}
                        </div>
                        <span className="text-xs font-bold text-gray-200">{log.actorName}</span>
                      </div>
                      <span className="text-[10px] font-mono text-gray-500">
                        {new Date(log.timestamp).toLocaleDateString()} {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 font-medium italic mb-3">"{log.reason || 'No reason provided'}"</p>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2 bg-black/30 rounded-lg border border-[#2A2A2A]">
                        <span className="text-[9px] text-gray-600 uppercase block mb-1">Interest</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-gray-500 line-through">{(log.oldValues.pawnMonthlyInterestRate * 100).toFixed(1)}%</span>
                          <span className="text-xs font-bold text-emerald-400">{(log.newValues.pawnMonthlyInterestRate * 100).toFixed(1)}%</span>
                        </div>
                      </div>
                      <div className="p-2 bg-black/30 rounded-lg border border-[#2A2A2A]">
                        <span className="text-[9px] text-gray-600 uppercase block mb-1">Vault Fee</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-gray-500 line-through">{(log.oldValues.pawnStorageAdminFeeRate * 100).toFixed(1)}%</span>
                          <span className="text-xs font-bold text-emerald-400">{(log.newValues.pawnStorageAdminFeeRate * 100).toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-20 text-center space-y-4">
                  <Info className="w-12 h-12 text-gray-800 mx-auto opacity-20" />
                  <p className="text-[10px] text-gray-600 font-black uppercase tracking-widest">No rule changes recorded yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
