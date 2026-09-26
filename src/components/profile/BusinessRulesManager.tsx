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
  Wallet,
  TrendingUp
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
    <div className="space-y-8 animate-in fade-in duration-500 text-stone-900">
      <div className="flex items-center gap-4 mb-2">
        <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200">
          <ShieldAlert className="w-6 h-6 text-[#C85A32]" />
        </div>
        <div>
          <h2 className="text-xl font-black text-stone-900 font-headline">Authoritative Shop Rules</h2>
          <p className="text-xs text-stone-500">Control interest rates, loan terms, and financial margins for this branch.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* SETTINGS FORM */}
        <div className="space-y-6">
          <div className="bg-white border border-stone-200 rounded-[2rem] p-8 space-y-8 shadow-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Interest Rate */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest flex items-center gap-1.5">
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
                    className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 text-stone-900 font-bold font-mono focus:border-[#C85A32] focus:outline-none disabled:opacity-50"
                  />
                  <span className="absolute right-4 top-3 text-stone-400 text-xs font-bold">%</span>
                </div>
                <p className="text-[10px] text-stone-400 font-normal">NCR Legal Cap: 5.0% for new agreements.</p>
              </div>

              {/* Storage & Admin Fee */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest flex items-center gap-1.5">
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
                    className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 text-stone-900 font-bold font-mono focus:border-[#C85A32] focus:outline-none disabled:opacity-50"
                  />
                  <span className="absolute right-4 top-3 text-stone-400 text-xs font-bold">%</span>
                </div>
                <p className="text-[10px] text-stone-400 font-normal">Standard insured vault rate: 5% - 10%.</p>
              </div>

              {/* Loan Term */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest flex items-center gap-1.5">
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
                    className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 text-stone-900 font-bold font-mono focus:border-[#C85A32] focus:outline-none disabled:opacity-50"
                  />
                  <span className="absolute right-4 top-3 text-stone-400 text-xs font-bold">Days</span>
                </div>
              </div>

              {/* Grace Period */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest flex items-center gap-1.5">
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
                    className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 text-stone-900 font-bold font-mono focus:border-[#C85A32] focus:outline-none disabled:opacity-50"
                  />
                  <span className="absolute right-4 top-3 text-stone-400 text-xs font-bold">Days</span>
                </div>
              </div>

              {/* Min Principal */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Wallet className="w-3 h-3" />
                  Minimum Loan Principal
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-3 text-[#C85A32] font-bold font-mono">R</span>
                  <input
                    type="number"
                    min="1"
                    disabled={!isOwner}
                    value={localRules.minLoanPrincipal}
                    onChange={e => handleChange('minLoanPrincipal', parseFloat(e.target.value) || 0)}
                    className="w-full bg-white border border-stone-200 rounded-xl pl-8 pr-4 py-3 text-stone-900 font-bold font-mono focus:border-[#C85A32] focus:outline-none disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Retail Multiplier */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest flex items-center gap-1.5">
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
                    className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 text-stone-900 font-bold font-mono focus:border-[#C85A32] focus:outline-none disabled:opacity-50"
                  />
                  <span className="absolute right-4 top-3 text-stone-400 text-xs font-bold">x</span>
                </div>
              </div>
            </div>

            {isOwner && (
              <div className="space-y-4 pt-4 border-t border-stone-100">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">Reason for change (Required for Audit)</label>
                  <textarea
                    value={changeReason}
                    onChange={e => setChangeReason(e.target.value)}
                    placeholder="e.g. Updating vault fees to reflect new insurance premiums..."
                    rows={2}
                    className="w-full bg-white border border-stone-200 rounded-2xl px-4 py-3 text-xs text-stone-900 placeholder:text-stone-300 focus:border-[#C85A32] focus:outline-none"
                  />
                </div>
                <button
                  onClick={handleSave}
                  disabled={isSaving || !changeReason.trim()}
                  className="w-full py-4 bg-[#C85A32] hover:bg-[#B84E27] text-white rounded-2xl text-sm font-black uppercase tracking-widest shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:grayscale cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? 'PERSISTING TO CLOUD...' : 'COMMIT CHANGES TO SERVER'}
                </button>
              </div>
            )}

            {!isOwner && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                <p className="text-[11px] text-amber-800 leading-relaxed font-normal">
                  <strong>Read-Only Mode:</strong> Managers may view these settings, but only the primary <strong>Shop Owner</strong> can authorize material changes to financial rules and interest rates.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* AUDIT LOGS */}
        <div className="space-y-6">
          <div className="bg-white border border-stone-200 rounded-[2rem] overflow-hidden shadow-xs flex flex-col h-[600px]">
            <div className="p-6 border-b border-stone-100 flex items-center justify-between bg-stone-50">
              <div className="flex items-center gap-3">
                <History className="w-5 h-5 text-stone-400" />
                <h3 className="text-xs font-black uppercase tracking-widest text-stone-700">Rule Audit History</h3>
              </div>
              <span className="text-[10px] font-mono text-stone-400">Immutable Ledger</span>
            </div>

            <div className="flex-1 overflow-y-auto p-2 no-scrollbar divide-y divide-stone-100">
              {isLoadingLogs ? (
                <div className="p-10 text-center space-y-4">
                  <div className="w-8 h-8 border-2 border-[#C85A32] border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-[10px] text-stone-400 font-mono uppercase tracking-widest animate-pulse">Fetching Audit Log...</p>
                </div>
              ) : auditLogs.length > 0 ? (
                auditLogs.map(log => (
                  <div key={log.id} className="p-4 hover:bg-stone-50 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-stone-100 flex items-center justify-center text-[10px] font-bold text-stone-600">
                          {log.actorName.charAt(0)}
                        </div>
                        <span className="text-xs font-bold text-stone-800">{log.actorName}</span>
                      </div>
                      <span className="text-[10px] font-mono text-stone-400">
                        {new Date(log.timestamp).toLocaleDateString()} {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs text-stone-500 font-medium italic mb-3">"{log.reason || 'No reason provided'}"</p>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2 bg-stone-50 rounded-lg border border-stone-200">
                        <span className="text-[9px] text-stone-400 uppercase block mb-1">Interest</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-stone-400 line-through">{(log.oldValues.pawnMonthlyInterestRate * 100).toFixed(1)}%</span>
                          <span className="text-xs font-bold text-emerald-600">{(log.newValues.pawnMonthlyInterestRate * 100).toFixed(1)}%</span>
                        </div>
                      </div>
                      <div className="p-2 bg-stone-50 rounded-lg border border-stone-200">
                        <span className="text-[9px] text-stone-400 uppercase block mb-1">Vault Fee</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-stone-400 line-through">{(log.oldValues.pawnStorageAdminFeeRate * 100).toFixed(1)}%</span>
                          <span className="text-xs font-bold text-emerald-600">{(log.newValues.pawnStorageAdminFeeRate * 100).toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-20 text-center space-y-4">
                  <Info className="w-12 h-12 text-stone-200 mx-auto" />
                  <p className="text-[10px] text-stone-400 font-black uppercase tracking-widest">No rule changes recorded yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
