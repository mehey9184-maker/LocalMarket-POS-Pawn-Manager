import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { ProfileRow } from '../../types/supabase';
import { 
  User, 
  Shield, 
  Clock, 
  ChevronRight, 
  UserPlus, 
  Mail, 
  Phone, 
  CheckCircle, 
  XCircle,
  Calendar,
  Lock,
  ArrowLeft,
  Loader2
} from 'lucide-react';

export const StaffAccessManager: React.FC = () => {
  const { users, updateStaffProfile, provisionStaff, isOwner, isManager } = useAuth();
  const { showToast } = useApp();
  const [selectedStaff, setSelectedStaff] = useState<ProfileRow | null>(null);
  const [isAddingStaff, setIsAddingStaff] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Filter out owners if the current user is just a manager
  const manageableStaff = useMemo(() => {
    if (isOwner) return users;
    return users.filter(u => u.role !== 'owner' && u.role !== 'admin');
  }, [users, isOwner]);

  const handleUpdatePermissions = async (field: string, value: boolean) => {
    if (!selectedStaff) return;
    const currentPerms = (selectedStaff.permissions as any) || {};
    const newPerms = { ...currentPerms, [field]: value };
    
    setIsSaving(true);
    const res = await updateStaffProfile(selectedStaff.id, { permissions: newPerms });
    if (res.success) {
      setSelectedStaff({ ...selectedStaff, permissions: newPerms });
      showToast('Permissions Updated', `Access for ${selectedStaff.full_name} has been modified.`, 'success');
    } else {
      showToast('Update Failed', res.error || 'Could not update permissions.', 'error');
    }
    setIsSaving(false);
  };

  const handleResetPin = async () => {
    if (!selectedStaff) return;
    const newPin = window.prompt('Enter new 6-digit PIN:');
    if (!newPin || !/^\d{6}$/.test(newPin)) {
      showToast('Invalid PIN', 'PIN must be exactly 6 numeric digits.', 'error');
      return;
    }
    
    setIsSaving(true);
    const res = await updateStaffProfile(selectedStaff.id, { pinCode: newPin }, 'PIN reset by authorized user');
    if (res.success) {
      showToast('PIN Updated', 'Staff PIN has been reset.', 'success');
    } else {
      showToast('Reset Failed', res.error || 'Could not reset PIN.', 'error');
    }
    setIsSaving(false);
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
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors group"
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
          <div>
            <h2 className="text-2xl font-bold text-white">{selectedStaff.full_name}</h2>
            <p className="text-gray-500 font-mono text-xs uppercase tracking-widest mt-1">{selectedStaff.role.replace('_', ' ')} · {selectedStaff.cashier_code}</p>
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
                { id: 'sales', label: 'Sales & Register', desc: 'Allow processing retail sales and receipts' },
                { id: 'inventory', label: 'Inventory Management', desc: 'Add, edit, or delete shop stock' },
                { id: 'pawn', label: 'Pawn Operations', desc: 'Create and manage pawn loan contracts' },
                { id: 'sellerAcquisitions', label: 'Seller Intake', desc: 'Process outright second-hand buys' },
                { id: 'refunds', label: 'Authorize Refunds', desc: 'Approve or reject customer refund requests' },
                { id: 'pricing', label: 'Price Management', desc: 'Modify retail prices and markup rules' },
                { id: 'reports', label: 'View Reports', desc: 'Access financial and performance analytics' },
                { id: 'staff', label: 'Staff Management', desc: 'Manage other staff accounts and access' },
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

          {/* SCHEDULE SECTION */}
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
                        onClick={() => toggleDay(i)}
                        className={`w-10 h-10 rounded-xl font-bold text-xs transition-all border ${
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
                      onChange={(e) => handleUpdateSchedule({ earlyLoginMinutes: parseInt(e.target.value) })}
                      className="w-full bg-[#1A1A1A] border border-[#282828] rounded-xl px-4 py-3 text-sm text-white focus:border-amber-500 outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-red-500/5 border border-red-500/10 rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-3 text-red-400">
                <Lock className="w-5 h-5" />
                <h3 className="text-sm font-bold uppercase tracking-widest">Account Security</h3>
              </div>
              <p className="text-[11px] text-gray-500 leading-relaxed">
                Deactivating an account will immediately invalidate all active terminal sessions for this staff member.
              </p>
              <button 
                onClick={async () => {
                  const confirmed = window.confirm(`Are you sure you want to ${selectedStaff.is_active ? 'deactivate' : 'activate'} this staff account?`);
                  if (confirmed) {
                    const res = await updateStaffProfile(selectedStaff.id, { is_active: !selectedStaff.is_active });
                    if (res.success) {
                      setSelectedStaff({ ...selectedStaff, is_active: !selectedStaff.is_active });
                      showToast('Status Updated', 'Account status has been changed successfully.', 'success');
                    }
                  }
                }}
                className={`w-full py-3 rounded-xl text-xs font-bold border transition-colors ${
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
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-headline font-bold text-white tracking-tight">Staff & Access</h2>
          <p className="text-gray-500 text-sm mt-1">Manage shop personnel, permissions, and terminal schedules</p>
        </div>
        <button 
          onClick={() => setIsAddingStaff(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#C85A32] hover:bg-[#A94725] text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-[#C85A32]/20"
        >
          <UserPlus className="w-4 h-4" />
          <span>Provision Staff</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {manageableStaff.map(staff => (
          <button
            key={staff.id}
            onClick={() => setSelectedStaff(staff)}
            className="group relative bg-[#121212] border border-[#282828] rounded-[2rem] p-6 flex items-center gap-5 transition-all hover:border-[#C85A32] hover:bg-[#1A1A1A] text-left"
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
                    : 'bg-gray-500/10 text-gray-400 border-gray-500/20'
                }`}>
                  {staff.role.replace('_', ' ')}
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
  const { provisionStaff } = useAuth();
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
        <button onClick={onBack} className="p-2 bg-[#1A1A1A] border border-[#282828] rounded-xl hover:text-white transition-colors">
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
                className="w-full h-12 bg-[#1A1A1A] border border-[#282828] rounded-xl pl-11 pr-4 text-sm text-white focus:border-[#C85A32] outline-none transition-all appearance-none"
              >
                <option value="cashier">Cashier</option>
                <option value="senior_cashier">Senior Cashier</option>
                <option value="manager">Manager</option>
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
            className="px-8 py-3 text-sm font-bold text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isProvisioning}
            className="px-10 py-3 bg-[#C85A32] hover:bg-[#A94725] text-white text-sm font-bold rounded-xl transition-all shadow-xl shadow-[#C85A32]/20 disabled:opacity-50"
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

