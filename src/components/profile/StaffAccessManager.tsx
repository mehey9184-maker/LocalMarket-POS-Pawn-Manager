import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { ProfileRow } from '../../types/supabase';
import { useOperationProgress } from '../../hooks/useOperationProgress';
import { OperationProgressScreen } from '../common/OperationProgressScreen';
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
  X,
  Crown,
  ShieldCheck
} from 'lucide-react';

export const StaffAccessManager: React.FC = () => {
  const { users, profile, user, updateStaffProfile, resetStaffPin, isOwner, isManager } = useAuth();
  const { showToast, isOnline } = useApp();
  const staffProgress = useOperationProgress();
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

  // Identify the shop owner / primary account
  const ownerProfile = useMemo(() => {
    return users.find(u => u.role === 'owner') || (profile?.role === 'owner' ? profile : null);
  }, [users, profile]);

  // Manageable ordinary staff filter (excludes owner and admin)
  const manageableStaff = useMemo(() => {
    if (isOwner) {
      return users.filter(u => u.role !== 'admin' && u.role !== 'owner' && u.id !== profile?.id);
    }
    return users.filter(u => (u.role === 'cashier' || u.role === 'senior_cashier') && u.id !== profile?.id);
  }, [users, isOwner, profile?.id]);

  const availableRolesForTarget = useMemo(() => {
    if (isOwner) {
      return [
        { value: 'cashier', label: 'Cashier' },
        { value: 'senior_cashier', label: 'Senior Cashier' },
        { value: 'manager', label: 'Manager' },
      ];
    }
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
    await staffProgress.runSequence({
      title: 'Updating Permissions',
      subtitle: `Modifying operational access for ${selectedStaff.full_name}`,
      isOffline: !isOnline,
      steps: [
        { id: 'prep', label: 'Preparing access policy' },
        { id: 'policy', label: `Setting ${field} to ${value ? 'granted' : 'revoked'}` },
        { id: 'save', label: isOnline ? 'Applying permissions on server' : 'Saving permissions locally' },
        { id: 'finish', label: 'Finalizing access control' }
      ],
      execute: async (runner) => {
        runner.startStep('prep');
        runner.completeStep('prep');

        runner.startStep('policy');
        runner.completeStep('policy');

        runner.startStep('save');
        const res = await updateStaffProfile(selectedStaff.id, { permissions: newPerms }, `Permissions updated: ${field}=${value}`);
        if (!res.success) throw new Error(res.error || 'Could not update permissions.');
        runner.completeStep('save');

        runner.startStep('finish');
        setSelectedStaff({ ...selectedStaff, permissions: newPerms });
        try {
          await loadAuditLogs(selectedStaff.id);
        } catch (refreshErr) {
          console.warn('Non-critical audit refresh failed:', refreshErr);
          runner.updateStepDetail('finish', isOnline ? 'Permissions saved successfully · history refresh pending' : 'Saved on this computer');
        }
        runner.completeStep('finish');
        return true;
      },
      successTitle: 'Permissions Updated',
      successMessage: `Access rules for ${selectedStaff.full_name} are active.`,
      onSuccess: () => setIsSaving(false),
      onError: () => setIsSaving(false),
      onClose: () => setIsSaving(false),
    });
  };

  const handleUpdateSchedule = async (updates: any) => {
    if (!selectedStaff) return;
    const currentSchedule = (selectedStaff.schedule as any) || {};
    const newSchedule = { ...currentSchedule, ...updates };
    
    setIsSaving(true);
    await staffProgress.runSequence({
      title: 'Updating Schedule',
      subtitle: `Modifying work shifts for ${selectedStaff.full_name}`,
      isOffline: !isOnline,
      steps: [
        { id: 'prep', label: 'Calculating shift timetable' },
        { id: 'sched', label: 'Applying weekly working hours' },
        { id: 'save', label: isOnline ? 'Saving schedule to server' : 'Saving schedule on this device' },
        { id: 'finish', label: 'Finalizing schedule updates' }
      ],
      execute: async (runner) => {
        runner.startStep('prep');
        runner.completeStep('prep');

        runner.startStep('sched');
        runner.completeStep('sched');

        runner.startStep('save');
        const res = await updateStaffProfile(selectedStaff.id, { schedule: newSchedule }, 'Work schedule modified');
        if (!res.success) throw new Error(res.error || 'Could not update schedule.');
        runner.completeStep('save');

        runner.startStep('finish');
        setSelectedStaff({ ...selectedStaff, schedule: newSchedule });
        try {
          await loadAuditLogs(selectedStaff.id);
        } catch (refreshErr) {
          console.warn('Non-critical audit refresh failed:', refreshErr);
          runner.updateStepDetail('finish', isOnline ? 'Schedule saved successfully · history refresh pending' : 'Saved on this computer');
        }
        runner.completeStep('finish');
        return true;
      },
      successTitle: 'Schedule Updated',
      successMessage: `Working hours for ${selectedStaff.full_name} have been updated.`,
      onSuccess: () => setIsSaving(false),
      onError: () => setIsSaving(false),
      onClose: () => setIsSaving(false),
    });
  };

  const handleUpdateRole = (newRole: string) => {
    if (!selectedStaff || newRole === selectedStaff.role) return;

    if (selectedStaff.role === 'owner' || (selectedStaff.id === profile?.id && isOwner)) {
      showToast('Protected Account', 'Your Owner account cannot be changed to a staff role.', 'error');
      return;
    }

    const displayTarget = newRole === 'senior_cashier' ? 'Senior Cashier' : newRole.charAt(0).toUpperCase() + newRole.slice(1);
    
    setConfirmDialog({
      isOpen: true,
      title: 'Change Operator Role',
      message: `Are you sure you want to promote/change ${selectedStaff.full_name}'s role to ${displayTarget}? This immediately updates their operational permissions.`,
      actionLabel: 'Confirm Role Change',
      onConfirm: async () => {
        setConfirmDialog(null);
        setIsSaving(true);
        await staffProgress.runSequence({
          title: 'Updating Staff Role',
          subtitle: `Changing role for ${selectedStaff.full_name}`,
          isOffline: !isOnline,
          steps: [
            { id: 'prep', label: 'Validating role transition' },
            { id: 'role', label: `Assigning role: ${displayTarget}` },
            { id: 'save', label: isOnline ? 'Updating role authorization on server' : 'Saving role change locally' },
            { id: 'finish', label: 'Finalizing role assignment' }
          ],
          execute: async (runner) => {
            runner.startStep('prep');
            runner.completeStep('prep');

            runner.startStep('role');
            runner.completeStep('role');

            runner.startStep('save');
            const res = await updateStaffProfile(selectedStaff.id, { role: newRole as any }, `Role changed to ${newRole}`);
            if (!res.success) throw new Error(res.error || 'Could not update role.');
            runner.completeStep('save');

            runner.startStep('finish');
            setSelectedStaff({ ...selectedStaff, role: newRole as any });
            try {
              await loadAuditLogs(selectedStaff.id);
            } catch (refreshErr) {
              console.warn('Non-critical audit refresh failed:', refreshErr);
              runner.updateStepDetail('finish', isOnline ? 'Role updated successfully · history refresh pending' : 'Saved on this computer');
            }
            runner.completeStep('finish');
            return true;
          },
          successTitle: 'Role Updated',
          successMessage: `${selectedStaff.full_name} is now designated as ${displayTarget}.`,
          onSuccess: () => setIsSaving(false),
          onError: () => setIsSaving(false),
          onClose: () => setIsSaving(false),
        });
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

    setResetPinError(null);
    setIsResetPinModalOpen(false);
    setIsSaving(true);

    await staffProgress.runSequence({
      title: 'Resetting Terminal PIN',
      subtitle: `Securing access credentials for ${selectedStaff.full_name}`,
      isOffline: !isOnline,
      steps: [
        { id: 'prep', label: 'Verifying administrator authorization' },
        { id: 'pin', label: 'Securing new 6-digit PIN' },
        { id: 'save', label: isOnline ? 'Saving credentials securely' : 'Saving PIN securely on this device' },
        { id: 'finish', label: 'Finalizing security credentials' }
      ],
      execute: async (runner) => {
        runner.startStep('prep');
        runner.completeStep('prep');

        runner.startStep('pin');
        runner.completeStep('pin');

        runner.startStep('save');
        const res = await resetStaffPin(selectedStaff.id, newPinValue, 'Terminal PIN reset by authorized administrator');
        if (!res.success) throw new Error(res.error || 'Could not reset PIN.');
        runner.completeStep('save');

        runner.startStep('finish');
        setNewPinValue('');
        try {
          await loadAuditLogs(selectedStaff.id);
        } catch (refreshErr) {
          console.warn('Non-critical audit refresh failed:', refreshErr);
          runner.updateStepDetail('finish', isOnline ? 'PIN reset successfully · history refresh pending' : 'Saved on this computer');
        }
        runner.completeStep('finish');
        return true;
      },
      successTitle: 'PIN Reset Successfully',
      successMessage: `New 6-digit terminal PIN active for ${selectedStaff.full_name}.`,
      onSuccess: () => setIsSaving(false),
      onError: () => setIsSaving(false),
      onClose: () => setIsSaving(false),
    });
  };

  const handleToggleActive = () => {
    if (!selectedStaff) return;

    if (selectedStaff.role === 'owner' || (selectedStaff.id === profile?.id && isOwner)) {
      showToast('Protected Account', 'The Shop Owner account cannot be deactivated from Staff Management.', 'error');
      return;
    }

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
        setConfirmDialog(null);
        setIsSaving(true);

        await staffProgress.runSequence({
          title: willDeactivate ? 'Deactivating Account' : 'Reactivating Account',
          subtitle: `Updating terminal access for ${selectedStaff.full_name}`,
          isOffline: !isOnline,
          steps: [
            { id: 'prep', label: 'Checking access policy' },
            { id: 'status', label: willDeactivate ? 'Revoking login authorizations' : 'Restoring login authorizations' },
            { id: 'save', label: isOnline ? 'Updating status on server' : 'Saving status on this computer' },
            { id: 'finish', label: 'Finalizing account status' }
          ],
          execute: async (runner) => {
            runner.startStep('prep');
            runner.completeStep('prep');

            runner.startStep('status');
            runner.completeStep('status');

            runner.startStep('save');
            const res = await updateStaffProfile(
              selectedStaff.id, 
              { is_active: !willDeactivate }, 
              willDeactivate ? 'Staff account deactivated' : 'Staff account reactivated'
            );
            if (!res.success) throw new Error(res.error || 'Could not change status.');
            runner.completeStep('save');

            runner.startStep('finish');
            setSelectedStaff({ ...selectedStaff, is_active: !willDeactivate });
            try {
              await loadAuditLogs(selectedStaff.id);
            } catch (refreshErr) {
              console.warn('Non-critical audit refresh failed:', refreshErr);
              runner.updateStepDetail('finish', isOnline ? 'Status updated successfully · history refresh pending' : 'Saved on this computer');
            }
            runner.completeStep('finish');
            return true;
          },
          successTitle: 'Status Updated',
          successMessage: willDeactivate 
            ? `${selectedStaff.full_name}'s account has been deactivated.`
            : `${selectedStaff.full_name}'s account is now active.`,
          onSuccess: () => setIsSaving(false),
          onError: () => setIsSaving(false),
          onClose: () => setIsSaving(false),
        });
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
      <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300 text-stone-900">
        <div className="flex items-center justify-between">
          <button 
            onClick={() => setSelectedStaff(null)}
            className="flex items-center gap-2 text-sm text-stone-400 hover:text-stone-700 transition-colors group cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span>Back to Staff List</span>
          </button>
          
          <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${
            selectedStaff.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'
          }`}>
            {selectedStaff.is_active ? 'Active' : 'Deactivated'}
          </div>
        </div>

        <div className="flex items-center gap-6 pb-8 border-b border-stone-200">
          <div className="w-20 h-20 rounded-2xl bg-stone-100 border border-stone-200 flex items-center justify-center overflow-hidden">
            {selectedStaff.avatar_url ? (
              <img src={selectedStaff.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <User className="w-10 h-10 text-stone-400" />
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-4">
              <h2 className="text-2xl font-bold text-stone-900">{selectedStaff.full_name}</h2>
              {selectedStaff.role === 'owner' ? (
                <span className="bg-amber-50 text-amber-800 border border-amber-300 px-3 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-2xs">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                  <span>Owner (Protected Account)</span>
                </span>
              ) : (
                <select
                  value={selectedStaff.role}
                  onChange={(e) => handleUpdateRole(e.target.value)}
                  disabled={isSaving}
                  className="bg-white border border-stone-200 rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[#C85A32] focus:border-[#C85A32] outline-none transition-all cursor-pointer"
                >
                  {availableRolesForTarget.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              )}
            </div>
            <p className="text-stone-500 font-mono text-xs uppercase tracking-widest mt-1">Operator ID: {selectedStaff.cashier_code} · {selectedStaff.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* PERMISSIONS SECTION */}
          <div className="space-y-6">
            <div className="flex items-center gap-3 text-emerald-600">
              <Shield className="w-5 h-5" />
              <h3 className="text-sm font-bold uppercase tracking-widest">Access Control</h3>
            </div>
            
            <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden divide-y divide-stone-100 shadow-xs">
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
                <div key={item.id} className="p-5 flex items-center justify-between group hover:bg-stone-50 transition-colors">
                  <div className="max-w-[70%]">
                    <p className="text-sm font-bold text-stone-800">{item.label}</p>
                    <p className="text-[11px] text-stone-500 mt-0.5 leading-relaxed">{item.desc}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer"
                      checked={perms[item.id] ?? false}
                      onChange={(e) => handleUpdatePermissions(item.id, e.target.checked)}
                      disabled={isSaving}
                    />
                    <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600 peer-checked:after:bg-white"></div>
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* SCHEDULE & CREDENTIALS SECTION */}
          <div className="space-y-8">
            <div className="space-y-6">
              <div className="flex items-center gap-3 text-amber-600">
                <Calendar className="w-5 h-5" />
                <h3 className="text-sm font-bold uppercase tracking-widest">Work Schedule</h3>
              </div>
              
              <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-8 shadow-xs">
                {/* Working Days */}
                <div className="space-y-4">
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Scheduled Days</p>
                  <div className="flex justify-between gap-1">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => toggleDay(i)}
                        disabled={isSaving}
                        className={`w-10 h-10 rounded-xl font-bold text-xs transition-all border cursor-pointer disabled:opacity-50 ${
                          (schedule.workingDays || []).includes(i)
                            ? 'bg-amber-600 border-amber-500 text-white shadow-md'
                            : 'bg-stone-50 border-stone-200 text-stone-500 hover:border-stone-400'
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
                    <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Shift Starts</label>
                    <input 
                      type="time" 
                      value={schedule.startTime || "08:00"}
                      disabled={isSaving}
                      onChange={(e) => handleUpdateSchedule({ startTime: e.target.value })}
                      className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-900 focus:border-amber-500 outline-none disabled:opacity-50"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Shift Ends</label>
                    <input 
                      type="time" 
                      value={schedule.endTime || "17:00"}
                      disabled={isSaving}
                      onChange={(e) => handleUpdateSchedule({ endTime: e.target.value })}
                      className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-900 focus:border-amber-500 outline-none disabled:opacity-50"
                    />
                  </div>
                </div>

                {/* Other Settings */}
                <div className="space-y-4 pt-4 border-t border-stone-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-stone-800">Overnight Shift</p>
                      <p className="text-[11px] text-stone-500 mt-0.5">Allows login past midnight until shift end</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={schedule.overnight ?? false}
                        disabled={isSaving}
                        onChange={(e) => handleUpdateSchedule({ overnight: e.target.checked })}
                      />
                      <div className="w-11 h-6 bg-stone-200 peer-disabled:opacity-50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                    </label>
                  </div>

                  <div className="space-y-2 pt-2">
                    <label className="text-[11px] font-bold text-stone-800">Early Login Allowance (Minutes)</label>
                    <input 
                      type="number" 
                      value={schedule.earlyLoginMinutes ?? 10}
                      disabled={isSaving}
                      onChange={(e) => handleUpdateSchedule({ earlyLoginMinutes: parseInt(e.target.value) || 0 })}
                      className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-900 focus:border-amber-500 outline-none disabled:opacity-50"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ACCOUNT SECURITY CARD */}
            <div className="bg-stone-50 border border-stone-200 rounded-2xl p-6 space-y-4 shadow-2xs">
              <div className="flex items-center gap-3 text-stone-700">
                <Lock className="w-5 h-5 text-[#C85A32]" />
                <h3 className="text-sm font-bold uppercase tracking-widest text-stone-900">Account Security</h3>
              </div>
              <p className="text-[11px] text-stone-500 leading-relaxed">
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
                  className="w-full py-3 rounded-xl text-xs font-bold border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                >
                  <Key className="w-3.5 h-3.5 text-stone-500" />
                  <span>Reset Terminal PIN</span>
                </button>

                {selectedStaff.role === 'owner' ? (
                  <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-center">
                    <p className="text-[11px] font-medium text-amber-900">
                      The Shop Owner account is protected and cannot be deactivated from Staff Management.
                    </p>
                  </div>
                ) : (
                  <button 
                    type="button"
                    onClick={handleToggleActive}
                    disabled={isSaving}
                    className={`w-full py-3 rounded-xl text-xs font-bold border disabled:opacity-50 transition-colors cursor-pointer bg-white ${
                      selectedStaff.is_active 
                        ? 'border-red-200 text-red-600 hover:bg-red-50' 
                        : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                    }`}
                  >
                    {selectedStaff.is_active ? 'Deactivate Account' : 'Reactivate Account'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* AUDIT HISTORY SECTION */}
        <div className="space-y-6 pt-10 border-t border-stone-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-blue-600">
              <History className="w-5 h-5" />
              <h3 className="text-sm font-bold uppercase tracking-widest">Administrative Audit Trail</h3>
            </div>
            {isLoadingLogs && <Loader2 className="w-4 h-4 animate-spin text-stone-500" />}
          </div>

          <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden divide-y divide-stone-100 shadow-xs">
            {isLoadingLogs ? (
              <div className="space-y-4 p-5 animate-pulse">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="space-y-2 pb-4 border-b border-stone-100 last:border-none">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-28 bg-stone-200 rounded" />
                        <div className="h-3.5 w-32 bg-stone-100 rounded" />
                      </div>
                      <div className="h-3 w-20 bg-stone-100 rounded" />
                    </div>
                    <div className="h-3.5 w-2/3 bg-stone-100 rounded mt-1" />
                  </div>
                ))}
              </div>
            ) : auditLogs.length > 0 ? auditLogs.map((log) => {
              const eventBadgeStyle = () => {
                switch (log.event_type) {
                  case 'STAFF_PROVISIONED':
                    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
                  case 'PIN_RESET':
                  case 'PIN_CHANGED':
                  case 'PIN_MIGRATED':
                    return 'bg-red-50 text-red-700 border-red-200';
                  case 'ROLE_CHANGED':
                    return 'bg-purple-50 text-purple-700 border-purple-200';
                  case 'SCHEDULE_CHANGED':
                    return 'bg-amber-50 text-amber-700 border-amber-200';
                  case 'STAFF_DEACTIVATED':
                    return 'bg-rose-50 text-rose-700 border-rose-200';
                  case 'STAFF_REACTIVATED':
                    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
                  default:
                    return 'bg-blue-50 text-blue-700 border-blue-200';
                }
              };

              return (
                <div key={log.id} className="p-5 flex items-start justify-between hover:bg-stone-50 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase tracking-widest ${eventBadgeStyle()}`}>
                        {log.event_type.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[10px] text-stone-400 font-mono">
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-stone-600">{log.reason || 'Administrative action recorded'}</p>
                  </div>
                  {log.actor_id && (
                    <div className="text-right">
                      <p className="text-[9px] text-stone-400 uppercase tracking-widest">Authorized By</p>
                      <p className="text-[10px] font-bold text-stone-700">{log.actor_name || 'Authorized Manager'}</p>
                    </div>
                  )}
                </div>
              );
            }) : (
              <div className="p-10 text-center text-stone-400">
                <p className="text-[10px] uppercase font-bold tracking-widest text-stone-400">No Administrative History Found</p>
              </div>
            )}
          </div>
        </div>

        {/* IN-MODAL PIN RESET DIALOG */}
        {isResetPinModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-white border border-stone-200 rounded-3xl p-8 shadow-2xl relative space-y-6 text-stone-900">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-red-600">
                  <Key className="w-5 h-5" />
                  <h3 className="font-bold text-lg text-stone-900">Reset Terminal PIN</h3>
                </div>
                <button 
                  type="button"
                  onClick={() => setIsResetPinModalOpen(false)}
                  className="p-1 text-stone-400 hover:text-stone-700 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-stone-500 leading-relaxed">
                Enter a new 6-digit numeric PIN for <strong className="text-stone-800">{selectedStaff.full_name}</strong>.
                The PIN is securely hashed on the server using PBKDF2-SHA512 before storage.
              </p>

              <form onSubmit={handleConfirmResetPin} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400">New 6-Digit PIN</label>
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
                      className="w-full h-12 bg-stone-50 border border-stone-200 rounded-xl px-4 text-center font-mono text-xl tracking-[0.4em] text-stone-900 focus:border-[#C85A32] outline-none transition-all placeholder:tracking-normal placeholder:text-sm placeholder:text-stone-400"
                    />
                    <button 
                      type="button"
                      onClick={() => setShowNewPin(!showNewPin)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                    >
                      {showNewPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {resetPinError && (
                    <p className="text-xs text-red-600 flex items-center gap-1.5 mt-1">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>{resetPinError}</span>
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-100">
                  <button
                    type="button"
                    onClick={() => setIsResetPinModalOpen(false)}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold text-stone-500 hover:text-stone-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving || newPinValue.length !== 6}
                    className="px-6 py-2.5 rounded-xl text-xs font-bold bg-[#C85A32] hover:bg-[#A94725] text-white transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer shadow-md shadow-[#C85A32]/10"
                  >
                    {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{isSaving ? 'Saving…' : 'Confirm PIN Reset'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* IN-MODAL CONFIRMATION DIALOG */}
        {confirmDialog && confirmDialog.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-white border border-stone-200 rounded-3xl p-8 shadow-2xl relative space-y-6 text-stone-900">
              <div className="flex items-center gap-3 text-amber-600">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="font-bold text-lg text-stone-900">{confirmDialog.title}</h3>
              </div>

              <p className="text-xs text-stone-500 leading-relaxed">
                {confirmDialog.message}
              </p>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setConfirmDialog(null)}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-stone-500 hover:text-stone-700 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={confirmDialog.onConfirm}
                  className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer shadow-md ${
                    confirmDialog.isDanger
                      ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-100'
                      : 'bg-[#C85A32] hover:bg-[#A94725] text-white shadow-[#C85A32]/10'
                  }`}
                >
                  {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isSaving ? 'Saving…' : confirmDialog.actionLabel}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* OPERATION PROGRESS SCREEN FOR SELECTED STAFF */}
        <OperationProgressScreen state={staffProgress.state} />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 text-stone-900">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-headline font-bold text-stone-900 tracking-tight">Staff & Access</h2>
          <p className="text-stone-500 text-sm mt-1">Manage shop personnel, role permissions, and terminal credentials</p>
        </div>
        <button 
          onClick={() => setIsAddingStaff(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#C85A32] hover:bg-[#A94725] text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-[#C85A32]/10 cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>Provision Staff</span>
        </button>
      </div>

      {/* SHOP OWNER / PRIMARY ACCOUNT CARD */}
      {ownerProfile && (
        <div className="bg-white border border-stone-200 rounded-3xl p-6 sm:p-7 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-stone-900 font-bold text-xs uppercase tracking-widest">
              <ShieldCheck className="w-4 h-4 text-amber-600" />
              <span>Shop Owner & Primary Account</span>
            </div>
            <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest bg-amber-50 text-amber-800 border border-amber-200">
              Protected Owner Account
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 bg-stone-50 rounded-2xl p-5 border border-stone-200/80">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-100 border border-amber-300 flex items-center justify-center shrink-0">
                {ownerProfile.avatar_url ? (
                  <img src={ownerProfile.avatar_url} alt="" className="w-full h-full object-cover rounded-2xl" />
                ) : (
                  <Crown className="w-7 h-7 text-amber-700" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h3 className="font-bold text-base text-stone-900">{ownerProfile.full_name}</h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-200/80 text-amber-900 uppercase tracking-wider">
                    Owner
                  </span>
                </div>
                <p className="text-stone-500 font-mono text-xs uppercase tracking-widest mt-0.5">
                  Operator ID: {ownerProfile.cashier_code} · {ownerProfile.email}
                </p>
                <p className="text-[11px] text-stone-500 mt-1">
                  Primary shop account with full administrative and financial authority.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={() => handleSelectStaff(ownerProfile)}
                className="px-4 py-2.5 bg-white hover:bg-stone-100 text-stone-800 rounded-xl text-xs font-bold border border-stone-200 transition-colors cursor-pointer shadow-2xs"
              >
                View Account Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ORDINARY STAFF SECTION */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-widest text-stone-400">
            Shop Staff & Operators ({manageableStaff.length})
          </h3>
        </div>

        {manageableStaff.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {manageableStaff.map(staff => (
              <button
                key={staff.id}
                onClick={() => handleSelectStaff(staff)}
                className="group relative bg-white border border-stone-200 rounded-[2rem] p-6 flex items-center gap-5 transition-all hover:border-[#C85A32] hover:shadow-md text-left cursor-pointer"
              >
                <div className="w-14 h-14 rounded-2xl bg-stone-50 border border-stone-200 flex items-center justify-center shrink-0 group-hover:border-[#C85A32]/30 transition-colors">
                  {staff.avatar_url ? (
                    <img src={staff.avatar_url} alt="" className="w-full h-full object-cover rounded-xl" />
                  ) : (
                    <User className="w-7 h-7 text-stone-400 group-hover:text-[#C85A32]/60 transition-colors" />
                  )}
                </div>
                
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-stone-900 truncate">{staff.full_name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md border ${
                      staff.role === 'manager' 
                        ? 'bg-purple-50 text-purple-700 border-purple-200' 
                        : staff.role === 'senior_cashier'
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : staff.role === 'owner' || staff.role === 'admin'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-stone-100 text-stone-600 border-stone-200'
                    }`}>
                      {staff.role === 'senior_cashier' ? 'Senior Cashier' : staff.role.replace('_', ' ')}
                    </span>
                    <span className="text-[9px] font-mono text-stone-400 uppercase tracking-widest">{staff.cashier_code}</span>
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
        ) : (
          <div className="bg-stone-50 border border-dashed border-stone-200 rounded-3xl p-10 text-center">
            <User className="w-10 h-10 text-stone-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-stone-700">No additional staff provisioned</p>
            <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
              Use the "Provision Staff" button above to add cashiers, senior cashiers, or managers to this shop branch.
            </p>
          </div>
        )}
      </div>

      {/* OPERATION PROGRESS SCREEN FOR MAIN STAFF LIST */}
      <OperationProgressScreen state={staffProgress.state} />
    </div>
  );
};

const StaffProvisioner: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { provisionStaff, isOwner } = useAuth();
  const { showToast, isOnline } = useApp();
  const provisionProgress = useOperationProgress();
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
    if (!formData.fullName.trim()) return;

    if (formData.pinCode && !/^\d{6}$/.test(formData.pinCode.trim())) {
      showToast('Invalid PIN', 'Terminal PIN must be exactly 6 numeric digits.', 'error');
      return;
    }

    setIsProvisioning(true);
    const roleDisplay = formData.role === 'senior_cashier' ? 'Senior Cashier' : formData.role.charAt(0).toUpperCase() + formData.role.slice(1);

    await provisionProgress.runSequence({
      title: 'Creating Staff Account',
      subtitle: `Setting up terminal profile for ${formData.fullName}`,
      isOffline: !isOnline,
      steps: [
        { id: 'prep', label: 'Preparing operator credentials' },
        { id: 'account', label: `Creating ${roleDisplay} profile: ${formData.fullName}` },
        { id: 'perms', label: 'Allocating branch sequence code & permissions' },
        { id: 'pin', label: formData.pinCode ? 'Securing 6-digit terminal PIN' : 'Configuring default security PIN' },
        { id: 'save', label: isOnline ? 'Saving account on server' : 'Saving account locally on this terminal' },
        { id: 'finish', label: 'Finishing staff setup' }
      ],
      execute: async (runner) => {
        runner.startStep('prep');
        runner.completeStep('prep');

        runner.startStep('account');
        runner.completeStep('account');

        runner.startStep('perms');
        runner.completeStep('perms');

        runner.startStep('pin');
        runner.completeStep('pin');

        runner.startStep('save');
        const res = await provisionStaff({
          fullName: formData.fullName.trim(),
          role: formData.role,
          pinCode: formData.pinCode.trim() || undefined,
          email: formData.email.trim() || undefined,
        });

        if (!res.success) {
          throw new Error(res.error || 'Failed to create staff account.');
        }
        runner.completeStep('save');

        runner.startStep('finish');
        runner.completeStep('finish');

        return res;
      },
      successTitle: 'Staff Account Created',
      successMessage: `${formData.fullName}'s account is ready to use.`,
      onSuccess: () => {
        setIsProvisioning(false);
        onBack();
      },
      onError: () => {
        setIsProvisioning(false);
      },
      onClose: () => {
        setIsProvisioning(false);
      }
    });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-left-4 duration-300 text-stone-900">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 bg-stone-50 border border-stone-200 rounded-xl hover:text-[#C85A32] transition-colors cursor-pointer">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-2xl font-headline font-bold text-stone-900 tracking-tight">Provision New Staff</h2>
          <p className="text-stone-500 text-sm">Register a new terminal operator with secure credentials</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white border border-stone-200 rounded-[2.5rem] p-10 space-y-8 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Full Legal Name</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input 
                required
                type="text" 
                value={formData.fullName}
                onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                placeholder="e.g. Sipho Mokoena"
                className="w-full h-12 bg-white border border-stone-200 rounded-xl pl-11 pr-4 text-sm text-stone-900 focus:border-[#C85A32] outline-none transition-all"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Operator Role</label>
            <div className="relative">
              <Shield className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <select 
                value={formData.role}
                onChange={e => setFormData({ ...formData, role: e.target.value as any })}
                className="w-full h-12 bg-white border border-stone-200 rounded-xl pl-11 pr-4 text-sm text-stone-900 focus:border-[#C85A32] outline-none transition-all appearance-none cursor-pointer"
              >
                <option value="cashier">Cashier</option>
                <option value="senior_cashier">Senior Cashier</option>
                {isOwner && <option value="manager">Manager</option>}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Staff / Cashier Code</label>
            <div className="h-12 bg-stone-50 border border-stone-200 rounded-xl px-4 flex items-center text-xs font-mono text-stone-600 font-medium">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-2.5"></span>
              Auto-allocated per branch sequence (e.g. SOW-CH-01)
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Terminal PIN (Exactly 6 Digits)</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input 
                required
                type="password" 
                maxLength={6}
                value={formData.pinCode}
                onChange={e => setFormData({ ...formData, pinCode: e.target.value.replace(/\D/g, '') })}
                placeholder="••••••"
                className="w-full h-12 bg-white border border-stone-200 rounded-xl pl-11 pr-4 text-sm text-stone-900 font-mono tracking-widest focus:border-[#C85A32] outline-none transition-all"
              />
            </div>
          </div>

          <div className="md:col-span-2 space-y-2">
            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Work Email (Optional)</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input 
                type="email" 
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                placeholder="staff@localmarketpos.co.za"
                className="w-full h-12 bg-white border border-stone-200 rounded-xl pl-11 pr-4 text-sm text-stone-900 focus:border-[#C85A32] outline-none transition-all"
              />
            </div>
            <p className="text-[10px] text-stone-400 px-1 italic">If omitted, a generic system email will be assigned based on cashier code.</p>
          </div>
        </div>

        <div className="pt-6 flex justify-end gap-4">
          <button
            type="button"
            onClick={onBack}
            className="px-8 py-3 text-sm font-bold text-stone-400 hover:text-stone-700 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isProvisioning}
            className="px-10 py-3 bg-[#C85A32] hover:bg-[#A94725] text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-[#C85A32]/10 disabled:opacity-50 cursor-pointer"
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

      {/* PROVISIONING OPERATION PROGRESS SCREEN */}
      <OperationProgressScreen state={provisionProgress.state} />
    </div>
  );
};
