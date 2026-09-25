import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { ProfileRow } from '../../types/supabase';
import { 
  User, 
  Shield, 
  ChevronRight, 
  UserPlus, 
  Mail, 
  CheckCircle, 
  XCircle,
  Calendar,
  Lock,
  ArrowLeft,
  Loader2,
  Key,
  History,
  Eye,
  EyeOff,
  AlertTriangle,
  X
} from 'lucide-react';

export const StaffAccessManager: React.FC = () => {
  const { users, updateStaffProfile, resetStaffPin, isOwner, isManager } = useAuth();
  const { showToast } = useApp();
  const [selectedStaff, setSelectedStaff] = useState<ProfileRow | null>(null);
  const [isAddingStaff, setIsAddingStaff] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // In-modal dialog state for PIN Reset
  const [isResetPinModalOpen, setIsResetPinModalOpen] = useState(false);
  const [newPinValue, setNewPinValue] = useState('');
  const [showNewPin, setShowNewPin] = useState(false);
  const [resetPinError, setResetPinError] = useState<string | null>(null);

  // In-modal dialog state for Role & Deactivation Confirmation
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    actionLabel: string;
    isDanger?: boolean;
    onConfirm: () => Promise<void>;
  } | null>(null);

  // Manageable staff filter:
  // - Owners can manage Managers, Senior Cashiers, and Cashiers (Technical admin hidden from normal business UI)
  // - Managers can manage Cashiers and Senior Cashiers only (cannot manage other Managers or Owners)
  const manageableStaff = useMemo(() => {
    if (isOwner) {
      return users.filter(u => u.role !== 'admin');
    }
    // Managers can only manage cashiers and senior cashiers
    return users.filter(u => u.role === 'cashier' || u.role === 'senior_cashier');
  }, [users, isOwner]);

  const availableRolesForTarget = useMemo(() => {
    if (isOwner) {
      return [
        { value: 'cashier', label: 'Cashier' },
        { value: 'senior_cashier', label: 'Senior Cashier' },
        { value: 'manager', label: 'Manager' },
      ];
    }
    // Managers can only assign Cashier or Senior Cashier
    return [
      { value: 'cashier', label: 'Cashier' },
      { value: 'senior_cashier', label: 'Senior Cashier' },
    ];
  }, [isOwner]);

  const loadAuditLogs = async (staffId: string) => {
    setIsLoadingLogs(true);
    try {
      const { staffApi } = await import('../../services/supabaseApi');
      const logs = await staffApi.getStaffAuditLogs(staffId);
      setAuditLogs(logs);
    } catch (err) {
      console.warn('Failed to load staff audit logs:', err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const handleUpdatePermissions = async (field: string, value: boolean) => {
    if (!selectedStaff) return;
    const currentPerms = (selectedStaff.permissions as any) || {};
    const newPerms = { ...currentPerms, [field]: value };
    
    setIsSaving(true);
    const res = await updateStaffProfile(selectedStaff.id, { permissions: newPerms }, `Permissions updated: ${field}=${value}`);
    if (res.success) {
      setSelectedStaff({ ...selectedStaff, permissions: newPerms });
      showToast('Permissions Updated', `Access for ${selectedStaff.full_name} has been modified.`, 'success');
      await loadAuditLogs(selectedStaff.id);
    } else {
      showToast('Update Failed', res.error || 'Could not update permissions.', 'error');
    }
    setIsSaving(false);
  };

  const handleUpdateSchedule = async (updates: any) => {
    if (!selectedStaff) return;
    const currentSchedule = (selectedStaff.schedule as any) || {};
    const newSchedule = { ...currentSchedule, ...updates };
    
    setIsSaving(true);
    const res = await updateStaffProfile(selectedStaff.id, { schedule: newSchedule }, 'Work schedule modified');
    if (res.success) {
      setSelectedStaff({ ...selectedStaff, schedule: newSchedule });
      showToast('Schedule Updated', `Working hours for ${selectedStaff.full_name} modified.`, 'success');
      await loadAuditLogs(selectedStaff.id);
    } else {
      showToast('Update Failed', res.error || 'Could not update schedule.', 'error');
    }
    setIsSaving(false);
  };

  const handleUpdateRole = (newRole: string) => {
    if (!selectedStaff || newRole === selectedStaff.role) return;

    const displayTarget = newRole === 'senior_cashier' ? 'Senior Cashier' : newRole.charAt(0).toUpperCase() + newRole.slice(1);
    
    setConfirmDialog({
      isOpen: true,
      title: 'Change Operator Role',
      message: `Are you sure you want to promote/change ${selectedStaff.full_name}'s role to ${displayTarget}? This immediately updates their operational permissions.`,
      actionLabel: 'Confirm Role Change',
      onConfirm: async () => {
        setIsSaving(true);
        const res = await updateStaffProfile(selectedStaff.id, { role: newRole as any }, `Role changed to ${newRole}`);
        if (res.success) {
          setSelectedStaff({ ...selectedStaff, role: newRole as any });
          showToast('Role Updated', `Profile role updated to ${displayTarget}.`, 'success');
          await loadAuditLogs(selectedStaff.id);
        } else {
          showToast('Update Failed', res.error || 'Could not update role.', 'error');
        }
        setIsSaving(false);
        setConfirmDialog(null);
      }
    });
  };

  const handleConfirmResetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff) return;

    if (!/^\d{6}$/.test(newPinValue)) {
      setResetPinError('Terminal PIN must be exactly 6 numeric digits.');
      return;
    }

    setIsSaving(true);
    setResetPinError(null);

    const res = await resetStaffPin(selectedStaff.id, newPinValue, 'Terminal PIN reset by authorized administrator');
    if (res.success) {
      showToast('PIN Reset Successfully', `New 6-digit terminal PIN active for ${selectedStaff.full_name}.`, 'success');
      setIsResetPinModalOpen(false);
      setNewPinValue('');
      await loadAuditLogs(selectedStaff.id);
    } else {
      setResetPinError(res.error || 'Failed to reset terminal PIN.');
      showToast('Reset Failed', res.error || 'Could not reset PIN.', 'error');
    }
    setIsSaving(false);
  };

  const handleToggleActive = () => {
    if (!selectedStaff) return;
    const willDeactivate = selectedStaff.is_active;

    setConfirmDialog({
      isOpen: true,
      title: willDeactivate ? 'Deactivate Staff Account' : 'Reactivate Staff Account',
      message: willDeactivate
        ? `Are you sure you want to deactivate ${selectedStaff.full_name}'s terminal access? They will be locked out immediately.`
        : `Reactivate terminal account for ${selectedStaff.full_name}?`,
      actionLabel: willDeactivate ? 'Deactivate Account' : 'Reactivate Account',
      isDanger: willDeactivate,
      onConfirm: async () => {
        setIsSaving(true);
        const res = await updateStaffProfile(
          selectedStaff.id, 
          { is_active: !willDeactivate }, 
          willDeactivate ? 'Staff account deactivated' : 'Staff account reactivated'
        );
        if (res.success) {
          setSelectedStaff({ ...selectedStaff, is_active: !willDeactivate });
          showToast('Status Updated', `Account status changed successfully.`, 'success');
          await loadAuditLogs(selectedStaff.id);
        } else {
          showToast('Update Failed', res.error || 'Could not change status.', 'error');
        }
        setIsSaving(false);
        setConfirmDialog(null);
      }
    });
  };

  const toggleDay = (day: number) => {
    if (!selectedStaff) return;
    const schedule = (selectedStaff.schedule as any) || {};
    const days = schedule.workingDays || [];
    const newDays = days.includes(day) 
      ? days.filter((d: number) => d !== day)
      : [...days, day].sort();
    handleUpdateSchedule({ workingDays: newDays });
  };

  const handleSelectStaff = async (staff: ProfileRow) => {
    setSelectedStaff(staff);
    await loadAuditLogs(staff.id);
  };

  if (isAddingStaff) {
    return <StaffProvisioner onBack={() => setIsAddingStaff(false)} />;
  }

  if (selectedStaff) {
    const perms = (selectedStaff.permissions as any) || {};
    const schedule = (selectedStaff.schedule as any) || {};
    
    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
        <div className="flex items-center justify-between">
          <button 
            onClick={() => setSelectedStaff(null)}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors group cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span>Back to Staff List</span>
          </button>
          
          <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${
            selectedStaff.is_active ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'
          }`}>
            {selectedStaff.is_active ? 'Active' : 'Deactivated'}
          </div>
        </div>

        <div className="flex items-center gap-6 pb-8 border-b border-[#282828]">
          <div className="w-20 h-20 rounded-2xl bg-[#1A1A1A] border border-[#282828] flex items-center justify-center overflow-hidden">
            {selectedStaff.avatar_url ? (
              <img src={selectedStaff.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <User className="w-10 h-10 text-gray-600" />
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-4">
              <h2 className="text-2xl font-bold text-white">{selectedStaff.full_name}</h2>
              <select
                value={selectedStaff.role}
                onChange={(e) => handleUpdateRole(e.target.value)}
                disabled={isSaving}
                className="bg-[#1A1A1A] border border-[#282828] rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[#C85A32] focus:border-[#C85A32] outline-none transition-all cursor-pointer"
              >
                {availableRolesForTarget.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            <p className="text-gray-500 font-mono text-xs uppercase tracking-widest mt-1">Operator ID: {selectedStaff.cashier_code} · {selectedStaff.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* PERMISSIONS SECTION */}
          <div className="space-y-6">
            <div className="flex items-center gap-3 text-emerald-400">
              <Shield className="w-5 h-5" />
              <h3 className="text-sm font-bold uppercase tracking-widest">Access Control</h3>
            </div>
            
            <div className="bg-[#121212] border border-[#282828] rounded-2xl overflow-hidden divide-y divide-[#282828]">
              {[
                { id: 'sales', label: 'Sales & Register', desc: 'Process checkout, sales, and receipts' },
                { id: 'inventory', label: 'Inventory Management', desc: 'Add, edit, or adjust shop stock' },
                { id: 'pawn', label: 'Pawn Operations', desc: 'Create and manage pawn loan contracts' },
                { id: 'sellerAcquisitions', label: 'Seller Intake', desc: 'Process outright second-hand buys' },
                { id: 'refunds', label: 'Authorize Refunds', desc: 'Approve or reject customer refund requests' },
                { id: 'pricing', label: 'Price Management', desc: 'Modify retail prices and markup rules' },
                { id: 'reports', label: 'View Reports', desc: 'Access financial and performance analytics' },
                ...(isOwner ? [{ id: 'staff', label: 'Staff Management', desc: 'Manage other staff accounts and access' }] : [])
              ].map(item => (
                <div key={item.id} className="p-5 flex items-center justify-between group hover:bg-[#1A1A1A] transition-colors">
                  <div className="max-w-[70%]">
                    <p className="text-sm font-bold text-gray-200">{item.label}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{item.desc}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer"
                      checked={perms[item.id] ?? false}
                      onChange={(e) => handleUpdatePermissions(item.id, e.target.checked)}
                      disabled={isSaving}
                    />
                    <div className="w-11 h-6 bg-[#282828] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-400 after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600 peer-checked:after:bg-white"></div>
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* SCHEDULE & CREDENTIALS SECTION */}
          <div className="space-y-8">
            <div className="space-y-6">
              <div className="flex items-center gap-3 text-amber-500">
                <Calendar className="w-5 h-5" />
                <h3 className="text-sm font-bold uppercase tracking-widest">Work Schedule</h3>
              </div>
              
              <div className="bg-[#121212] border border-[#282828] rounded-2xl p-6 space-y-8">
                {/* Working Days */}
                <div className="space-y-4">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Scheduled Days</p>
                  <div className="flex justify-between gap-1">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => toggleDay(i)}
                        className={`w-10 h-10 rounded-xl font-bold text-xs transition-all border cursor-pointer ${
                          (schedule.workingDays || []).includes(i)
                            ? 'bg-amber-600 border-amber-500 text-white shadow-lg shadow-amber-900/20'
                            : 'bg-[#1A1A1A] border-[#282828] text-gray-500 hover:border-gray-600'
                        }`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Shift Hours */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Shift Starts</label>
                    <input 
                      type="time" 
                      value={schedule.startTime || "08:00"}
                      onChange={(e) => handleUpdateSchedule({ startTime: e.target.value })}
                      className="w-full bg-[#1A1A1A] border border-[#282828] rounded-xl px-4 py-3 text-sm text-white focus:border-amber-500 outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Shift Ends</label>
                    <input 
                      type="time" 
                      value={schedule.endTime || "17:00"}
                      onChange={(e) => handleUpdateSchedule({ endTime: e.target.value })}
                      className="w-full bg-[#1A1A1A] border border-[#282828] rounded-xl px-4 py-3 text-sm text-white focus:border-amber-500 outline-none"
                    />
                  </div>
                </div>

                {/* Other Settings */}
                <div className="space-y-4 pt-4 border-t border-[#282828]">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-gray-200">Overnight Shift</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">Allows login past midnight until shift end</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={schedule.overnight ?? false}
                        onChange={(e) => handleUpdateSchedule({ overnight: e.target.checked })}
                      />
                      <div className="w-11 h-6 bg-[#282828] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-400 after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                    </label>
                  </div>

                  <div className="space-y-2 pt-2">
                    <label className="text-[11px] font-bold text-gray-200">Early Login Allowance (Minutes)</label>
                    <input 
                      type="number" 
                      value={schedule.earlyLoginMinutes ?? 10}
                      onChange={(e) => handleUpdateSchedule({ earlyLoginMinutes: parseInt(e.target.value) || 0 })}
                      className="w-full bg-[#1A1A1A] border border-[#282828] rounded-xl px-4 py-3 text-sm text-white focus:border-amber-500 outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ACCOUNT SECURITY CARD */}
            <div className="bg-red-500/5 border border-red-500/10 rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-3 text-red-400">
                <Lock className="w-5 h-5" />
                <h3 className="text-sm font-bold uppercase tracking-widest">Account Security</h3>
              </div>
              <p className="text-[11px] text-gray-500 leading-relaxed">
                Terminal credentials are authenticated via salted PBKDF2 hashes. Plaintext PINs are never stored or exposed.
              </p>
              
              <div className="flex flex-col gap-3">
                <button 
                  type="button"
                  onClick={() => {
                    setResetPinError(null);
                    setNewPinValue('');
                    setIsResetPinModalOpen(true);
                  }}
                  disabled={isSaving}
                  className="w-full py-3 rounded-xl text-xs font-bold border border-red-500/20 text-red-500 hover:bg-red-500/10 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>Reset Terminal PIN</span>
                </button>

                <button 
                  type="button"
                  onClick={handleToggleActive}
                  disabled={isSaving}
                  className={`w-full py-3 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                    selectedStaff.is_active 
                      ? 'border-red-500/20 text-red-500 hover:bg-red-500/10' 
                      : 'border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/10'
                  }`}
                >
                  {selectedStaff.is_active ? 'Deactivate Account' : 'Reactivate Account'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* AUDIT HISTORY SECTION */}
        <div className="space-y-6 pt-10 border-t border-[#282828]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-blue-400">
              <History className="w-5 h-5" />
              <h3 className="text-sm font-bold uppercase tracking-widest">Administrative Audit Trail</h3>
            </div>
            {isLoadingLogs && <Loader2 className="w-4 h-4 animate-spin text-gray-500" />}
          </div>

          <div className="bg-[#121212] border border-[#282828] rounded-2xl overflow-hidden divide-y divide-[#282828]">
            {auditLogs.length > 0 ? auditLogs.map((log) => {
              const eventBadgeStyle = () => {
                switch (log.event_type) {
                  case 'STAFF_PROVISIONED':
                    return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                  case 'PIN_RESET':
                  case 'PIN_CHANGED':
                  case 'PIN_MIGRATED':
                    return 'bg-red-500/10 text-red-400 border-red-500/20';
                  case 'ROLE_CHANGED':
                    return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
                  case 'SCHEDULE_CHANGED':
                    return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
                  case 'STAFF_DEACTIVATED':
                    return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
                  case 'STAFF_REACTIVATED':
                    return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                  default:
                    return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
                }
              };

              return (
                <div key={log.id} className="p-5 flex items-start justify-between hover:bg-[#1A1A1A] transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase tracking-widest ${eventBadgeStyle()}`}>
                        {log.event_type.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[10px] text-gray-500 font-mono">
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-gray-300">{log.reason || 'Administrative action recorded'}</p>
                  </div>
                  {log.actor_id && (
                    <div className="text-right">
                      <p className="text-[9px] text-gray-500 uppercase tracking-widest">Authorized By</p>
                      <p className="text-[10px] font-bold text-gray-400">{log.actor_name || 'Authorized Manager'}</p>
                    </div>
                  )}
                </div>
              );
            }) : (
              <div className="p-10 text-center text-gray-600">
                <p className="text-[10px] uppercase font-bold tracking-widest">No Administrative History Found</p>
              </div>
            )}
          </div>
        </div>

        {/* IN-MODAL PIN RESET DIALOG */}
        {isResetPinModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-[#161616] border border-[#2A2A2A] rounded-3xl p-8 shadow-2xl relative space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-red-400">
                  <Key className="w-5 h-5" />
                  <h3 className="font-bold text-lg text-white">Reset Terminal PIN</h3>
                </div>
                <button 
                  type="button"
                  onClick={() => setIsResetPinModalOpen(false)}
                  className="p-1 text-gray-500 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-gray-400 leading-relaxed">
                Enter a new 6-digit numeric PIN for <strong className="text-white">{selectedStaff.full_name}</strong>.
                The PIN is securely hashed on the server using PBKDF2-SHA512 before storage.
              </p>

              <form onSubmit={handleConfirmResetPin} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">New 6-Digit PIN</label>
                  <div className="relative">
                    <input 
                      type={showNewPin ? 'text' : 'password'}
                      maxLength={6}
                      autoFocus
                      required
                      value={newPinValue}
                      onChange={(e) => {
                        setNewPinValue(e.target.value.replace(/\D/g, '').substring(0, 6));
                        setResetPinError(null);
                      }}
                      placeholder="••••••"
                      className="w-full h-12 bg-[#1F1F1F] border border-[#2E2E2E] rounded-xl px-4 text-center font-mono text-xl tracking-[0.4em] text-white focus:border-[#C85A32] outline-none transition-all placeholder:tracking-normal placeholder:text-sm placeholder:text-gray-600"
                    />
                    <button 
                      type="button"
                      onClick={() => setShowNewPin(!showNewPin)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                    >
                      {showNewPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {resetPinError && (
                    <p className="text-xs text-red-400 flex items-center gap-1.5 mt-1">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>{resetPinError}</span>
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#2A2A2A]">
                  <button
                    type="button"
                    onClick={() => setIsResetPinModalOpen(false)}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold text-gray-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving || newPinValue.length !== 6}
                    className="px-6 py-2.5 rounded-xl text-xs font-bold bg-[#C85A32] hover:bg-[#A94725] text-white transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer shadow-lg shadow-[#C85A32]/20"
                  >
                    {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Confirm PIN Reset</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* IN-MODAL CONFIRMATION DIALOG */}
        {confirmDialog && confirmDialog.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-[#161616] border border-[#2A2A2A] rounded-3xl p-8 shadow-2xl relative space-y-6">
              <div className="flex items-center gap-3 text-amber-400">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="font-bold text-lg text-white">{confirmDialog.title}</h3>
              </div>

              <p className="text-xs text-gray-400 leading-relaxed">
                {confirmDialog.message}
              </p>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#2A2A2A]">
                <button
                  type="button"
                  onClick={() => setConfirmDialog(null)}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-gray-400 hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={confirmDialog.onConfirm}
                  className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer shadow-lg ${
                    confirmDialog.isDanger
                      ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-900/20'
                      : 'bg-[#C85A32] hover:bg-[#A94725] text-white shadow-[#C85A32]/20'
                  }`}
                >
                  {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{confirmDialog.actionLabel}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-headline font-bold text-white tracking-tight">Staff & Access</h2>
          <p className="text-gray-500 text-sm mt-1">Manage shop personnel, role permissions, and terminal credentials</p>
        </div>
        <button 
          onClick={() => setIsAddingStaff(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#C85A32] hover:bg-[#A94725] text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-[#C85A32]/20 cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>Provision Staff</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {manageableStaff.map(staff => (
          <button
            key={staff.id}
            onClick={() => handleSelectStaff(staff)}
            className="group relative bg-[#121212] border border-[#282828] rounded-[2rem] p-6 flex items-center gap-5 transition-all hover:border-[#C85A32] hover:bg-[#1A1A1A] text-left cursor-pointer"
          >
            <div className="w-14 h-14 rounded-2xl bg-[#1A1A1A] border border-[#282828] flex items-center justify-center shrink-0 group-hover:border-[#C85A32]/30 transition-colors">
              {staff.avatar_url ? (
                <img src={staff.avatar_url} alt="" className="w-full h-full object-cover rounded-xl" />
              ) : (
                <User className="w-7 h-7 text-gray-700 group-hover:text-[#C85A32]/60 transition-colors" />
              )}
            </div>
            
            <div className="min-w-0 flex-1">
              <p className="font-bold text-white truncate">{staff.full_name}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md border ${
                  staff.role === 'manager' 
                    ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' 
                    : staff.role === 'senior_cashier'
                    ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                    : staff.role === 'owner' || staff.role === 'admin'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'bg-gray-500/10 text-gray-400 border-gray-500/20'
                }`}>
                  {staff.role === 'senior_cashier' ? 'Senior Cashier' : staff.role.replace('_', ' ')}
                </span>
                <span className="text-[9px] font-mono text-gray-600 uppercase tracking-widest">{staff.cashier_code}</span>
              </div>
            </div>

            <div className="absolute top-4 right-4">
              <div className={`w-2 h-2 rounded-full ${staff.is_active ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500'}`} />
            </div>

            <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all">
              <ChevronRight className="w-5 h-5 text-[#C85A32]" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

const StaffProvisioner: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { provisionStaff, isOwner } = useAuth();
  const { showToast } = useApp();
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    role: 'cashier' as 'cashier' | 'senior_cashier' | 'manager',
    cashierCode: '',
    pinCode: '',
    email: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName.trim() || !formData.cashierCode.trim()) return;

    if (formData.pinCode && !/^\d{6}$/.test(formData.pinCode.trim())) {
      showToast('Invalid PIN', 'Terminal PIN must be exactly 6 numeric digits.', 'error');
      return;
    }

    setIsProvisioning(true);
    try {
      const res = await provisionStaff({
        fullName: formData.fullName.trim(),
        role: formData.role,
        cashierCode: formData.cashierCode.trim(),
        pinCode: formData.pinCode.trim() || undefined,
        email: formData.email.trim() || undefined,
      });

      if (res.success) {
        showToast('Provisioning Successful', `Staff account for ${formData.fullName} created.`, 'success');
        onBack();
      } else {
        showToast('Provisioning Failed', res.error || 'Failed to create account.', 'error');
      }
    } finally {
      setIsProvisioning(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-left-4 duration-300">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 bg-[#1A1A1A] border border-[#282828] rounded-xl hover:text-white transition-colors cursor-pointer">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-2xl font-headline font-bold text-white tracking-tight">Provision New Staff</h2>
          <p className="text-gray-500 text-sm">Register a new terminal operator with secure credentials</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-[#121212] border border-[#282828] rounded-[2.5rem] p-10 space-y-8 shadow-2xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Full Legal Name</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
              <input 
                required
                type="text" 
                value={formData.fullName}
                onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                placeholder="e.g. Sipho Mokoena"
                className="w-full h-12 bg-[#1A1A1A] border border-[#282828] rounded-xl pl-11 pr-4 text-sm text-white focus:border-[#C85A32] outline-none transition-all"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Operator Role</label>
            <div className="relative">
              <Shield className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
              <select 
                value={formData.role}
                onChange={e => setFormData({ ...formData, role: e.target.value as any })}
                className="w-full h-12 bg-[#1A1A1A] border border-[#282828] rounded-xl pl-11 pr-4 text-sm text-white focus:border-[#C85A32] outline-none transition-all appearance-none cursor-pointer"
              >
                <option value="cashier">Cashier</option>
                <option value="senior_cashier">Senior Cashier</option>
                {isOwner && <option value="manager">Manager</option>}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Staff / Cashier Code</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 font-bold text-xs uppercase">Code</span>
              <input 
                required
                type="text" 
                value={formData.cashierCode}
                onChange={e => setFormData({ ...formData, cashierCode: e.target.value.toUpperCase() })}
                placeholder="e.g. CSH-05"
                className="w-full h-12 bg-[#1A1A1A] border border-[#282828] rounded-xl pl-16 pr-4 text-sm text-white font-mono focus:border-[#C85A32] outline-none transition-all"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Terminal PIN (Exactly 6 Digits)</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
              <input 
                required
                type="password" 
                maxLength={6}
                value={formData.pinCode}
                onChange={e => setFormData({ ...formData, pinCode: e.target.value.replace(/\D/g, '') })}
                placeholder="••••••"
                className="w-full h-12 bg-[#1A1A1A] border border-[#282828] rounded-xl pl-11 pr-4 text-sm text-white font-mono tracking-widest focus:border-[#C85A32] outline-none transition-all"
              />
            </div>
          </div>

          <div className="md:col-span-2 space-y-2">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Work Email (Optional)</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
              <input 
                type="email" 
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                placeholder="staff@localmarketpos.co.za"
                className="w-full h-12 bg-[#1A1A1A] border border-[#282828] rounded-xl pl-11 pr-4 text-sm text-white focus:border-[#C85A32] outline-none transition-all"
              />
            </div>
            <p className="text-[10px] text-gray-500 px-1 italic">If omitted, a generic system email will be assigned based on cashier code.</p>
          </div>
        </div>

        <div className="pt-6 flex justify-end gap-4">
          <button
            type="button"
            onClick={onBack}
            className="px-8 py-3 text-sm font-bold text-gray-400 hover:text-white transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isProvisioning}
            className="px-10 py-3 bg-[#C85A32] hover:bg-[#A94725] text-white text-sm font-bold rounded-xl transition-all shadow-xl shadow-[#C85A32]/20 disabled:opacity-50 cursor-pointer"
          >
            {isProvisioning ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Registering...
              </span>
            ) : (
              'Create Staff Account'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
