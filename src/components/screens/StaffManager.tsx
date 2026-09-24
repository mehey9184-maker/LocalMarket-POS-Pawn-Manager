import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { Plus, Users, User, ShieldCheck, X, Check, Edit2, Archive } from 'lucide-react';
import { ProfileRow } from '../../types/supabase';

export const StaffManager: React.FC = () => {
  const { users, provisionStaff, updateStaffProfile, showToast, refreshProfile } = useAuth();
  const [isAdding, setIsAdding] = useState(false);
  const [editingStaff, setEditingStaff] = useState<ProfileRow | null>(null);

  // Filter out the current user (Owner/Admin) if needed, or show all
  const staff = useMemo(() => users.filter(u => u.role !== 'owner' && u.role !== 'admin'), [users]);

  const handleDeactivate = async (staffMember: ProfileRow) => {
    if (!window.confirm(`Are you sure you want to ${staffMember.is_active ? 'deactivate' : 'reactivate'} ${staffMember.full_name}?`)) return;
    
    const res = await updateStaffProfile(staffMember.id, { is_active: !staffMember.is_active }, `Staff ${staffMember.is_active ? 'deactivated' : 'reactivated'}`);
    if (res.success) {
      showToast('Staff updated', 'Success', 'success');
      refreshProfile();
    } else {
      showToast('Update failed', res.error || 'Error', 'error');
    }
  };

  return (
    <div className="flex-1 p-6 bg-[#F5F6F8] space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Staff Management</h2>
          <p className="text-xs text-gray-500">Manage shop staff members, roles, and terminal access.</p>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#C85A32] text-white rounded-xl text-xs font-semibold shadow-xs hover:bg-[#A94725] transition"
        >
          <Plus className="w-4 h-4" />
          <span>Add Staff</span>
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-xs overflow-hidden">
        <table className="w-full text-xs text-left">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-6 py-3 font-bold text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 font-bold text-gray-500 uppercase">Role</th>
              <th className="px-6 py-3 font-bold text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 font-bold text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {staff.map(s => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-semibold text-gray-900">{s.full_name}</td>
                <td className="px-6 py-4 capitalize">{s.role.replace('_', ' ')}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${s.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                    {s.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 flex gap-2">
                  <button onClick={() => handleDeactivate(s)} className={`px-2 py-1 rounded text-[10px] font-bold ${s.is_active ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                    {s.is_active ? 'Deactivate' : 'Reactivate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Add/Edit Modal (simplification: could be a full form later) */}
    </div>
  );
};
