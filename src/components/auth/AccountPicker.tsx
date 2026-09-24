import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { authApi } from '../../services/supabaseApi';
import { ProfileRow } from '../../types/supabase';
import { Loader2, ArrowLeft, Key, User, ShieldCheck } from 'lucide-react';

export const AccountPicker: React.FC = () => {
  const { 
    users, 
    profile: currentProfile, 
    logout, 
    isAccountPickerOpen, 
    setIsAccountPickerOpen
  } = useAuth();

  const { showToast } = useApp();
  
  const [selectedStaff, setSelectedStaff] = useState<ProfileRow | null>(null);
  const [pin, setPin] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isAccountPickerOpen) return null;

  const handleSelectStaff = (staff: ProfileRow) => {
    if (staff.id === currentProfile?.id) {
      setIsAccountPickerOpen(false);
      return;
    }
    setSelectedStaff(staff);
    setPin('');
    setError(null);
  };

  const handleBack = () => {
    setSelectedStaff(null);
    setPin('');
    setError(null);
  };

  const handleLogin = async () => {
    if (!selectedStaff || pin.length < 4) return;

    setIsAuthenticating(true);
    setError(null);

    try {
      const res = await authApi.loginWithPin(selectedStaff.cashier_code, pin);
      
      if (!res.success) {
        setError(res.error || 'Authentication failed');
        return;
      }

      showToast('Welcome Back', `Logged in as ${selectedStaff.full_name}`, 'success');
      setIsAccountPickerOpen(false);
      setSelectedStaff(null);
      setPin('');
    } catch (err: any) {
      setError(err.message || 'Connection error');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#121212]/95 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="w-full max-w-2xl px-6">
        {!selectedStaff ? (
          <div className="text-center">
            <h1 className="font-headline font-bold text-4xl text-[#e5e2e1] mb-2 tracking-tight">Welcome back</h1>
            <p className="text-[#a58b83] mb-12">Who is using this terminal?</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {users.filter(u => u.is_active).map((staff) => (
                <button
                  key={staff.id}
                  onClick={() => handleSelectStaff(staff)}
                  className={`group relative bg-[#181717] border border-[#282727] rounded-2xl p-6 flex flex-col items-center gap-4 transition-all hover:border-[#c85a32] hover:bg-[#1f1e1e] hover:shadow-2xl hover:shadow-[#c85a32]/10 ${
                    staff.id === currentProfile?.id ? 'ring-2 ring-[#c85a32] border-transparent' : ''
                  }`}
                >
                  <div className="w-16 h-16 rounded-full bg-[#1f1e1e] border-2 border-[#282727] flex items-center justify-center group-hover:border-[#c85a32]/50 transition-colors overflow-hidden">
                    {staff.avatar_url ? (
                      <img src={staff.avatar_url} alt={staff.full_name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xl font-bold text-[#a58b83] group-hover:text-[#e5e2e1] transition-colors">
                        {getInitials(staff.full_name)}
                      </span>
                    )}
                  </div>
                  
                  <div className="text-center">
                    <p className="font-bold text-[#e5e2e1] truncate max-w-[140px]">{staff.full_name}</p>
                    <p className="text-xs text-[#a58b83] uppercase tracking-widest mt-1 font-mono">{staff.role}</p>
                  </div>

                  {staff.id === currentProfile?.id && (
                    <div className="absolute top-3 right-3 flex items-center gap-1 bg-[#c85a32]/10 px-2 py-0.5 rounded-full border border-[#c85a32]/20">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#c85a32] animate-pulse"></div>
                      <span className="text-[9px] font-bold text-[#c85a32] uppercase">Active</span>
                    </div>
                  )}
                </button>
              ))}
            </div>

            <button
              onClick={() => setIsAccountPickerOpen(false)}
              className="mt-12 text-sm text-[#a58b83] hover:text-[#e5e2e1] transition-colors"
            >
              Cancel and return to terminal
            </button>
          </div>
        ) : (
          <div className="max-w-md mx-auto bg-[#181717] border border-[#282727] rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 duration-200">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 text-sm text-[#a58b83] hover:text-[#e5e2e1] transition-colors mb-8 group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              <span>Back to staff list</span>
            </button>

            <div className="flex flex-col items-center text-center mb-10">
              <div className="w-20 h-20 rounded-full bg-[#1f1e1e] border-2 border-[#282727] flex items-center justify-center mb-4 overflow-hidden shadow-xl">
                {selectedStaff.avatar_url ? (
                  <img src={selectedStaff.avatar_url} alt={selectedStaff.full_name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl font-bold text-[#e5e2e1]">{getInitials(selectedStaff.full_name)}</span>
                )}
              </div>
              <h2 className="font-headline font-bold text-2xl text-[#e5e2e1] tracking-tight">{selectedStaff.full_name}</h2>
              <p className="text-sm text-[#a58b83] mt-1">Please enter your 6-digit terminal PIN</p>
            </div>

            <div className="space-y-6">
              <div className="relative">
                <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#a58b83]" />
                <input
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').substring(0, 6))}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  placeholder="6-Digit PIN"
                  autoFocus
                  className="w-full h-14 bg-[#1f1e1e] border border-[#282727] rounded-xl pl-12 pr-4 text-center text-2xl tracking-[0.5em] font-mono text-[#e5e2e1] focus:border-[#c85a32] focus:ring-1 focus:ring-[#c85a32] outline-none transition-all placeholder:text-[#a58b83]/30 placeholder:tracking-normal placeholder:text-sm"
                />
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3 animate-shake">
                  <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[10px] font-bold text-white">!</span>
                  </div>
                  <p className="text-xs text-red-400 font-medium leading-relaxed">{error}</p>
                </div>
              )}

              <button
                onClick={handleLogin}
                disabled={isAuthenticating || pin.length !== 6}
                className="w-full h-14 bg-[#c85a32] hover:bg-[#b84e27] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl flex items-center justify-center gap-3 shadow-lg shadow-[#c85a32]/20 transition-all active:scale-[0.98]"
              >
                {isAuthenticating ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <ShieldCheck className="w-5 h-5" />
                    <span>Authorize Terminal</span>
                  </>
                )}
              </button>
              
              <div className="flex justify-center gap-1 mt-4">
                {[...Array(6)].map((_, i) => (
                  <div
                    key={i}
                    className={`w-3 h-3 rounded-full border transition-all duration-200 ${
                      i < pin.length ? 'bg-[#c85a32] border-[#c85a32] scale-110' : 'bg-transparent border-[#282727]'
                    }`}
                  ></div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
