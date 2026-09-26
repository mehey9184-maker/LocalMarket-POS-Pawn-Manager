import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, 
  Building2,
  UserPlus,
  Sliders,
  HardDrive,
  TrendingUp, 
  Banknote, 
  ChevronRight, 
  Lock, 
  History, 
  Award,
  ArrowLeftRight,
  Zap,
  HelpCircle,
  FileText,
  RefreshCw,
  CheckCircle,
  LogOut,
  Upload,
  Phone,
  Mail,
  MapPin,
  Building,
  Save,
  ImageIcon
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useSales } from '../../context/SalesContext';
import { authApi } from '../../services/supabaseApi';
import { validateAndNormalizeSaPhone } from '../../utils/phoneValidator';
import { apiPost } from '../../utils/apiClient';
import { ShopProfileAndOfflineHub } from '../profile/ShopProfileAndOfflineHub';
import { BusinessRulesManager } from '../profile/BusinessRulesManager';
import { StaffAccessManager } from '../profile/StaffAccessManager';

type ProfileTab = 'account' | 'shop' | 'staff' | 'rules' | 'system';

const SA_PROVINCES = [
  'Eastern Cape',
  'Free State',
  'Gauteng',
  'KwaZulu-Natal',
  'Limpopo',
  'Mpumalanga',
  'North West',
  'Northern Cape',
  'Western Cape'
];

export const CashierProfile: React.FC = () => {
  const { 
    salesHistory, 
    showToast,
    shopProfile,
    updateShopProfile
  } = useApp();

  const { 
    isOwner, 
    isAtLeastManager,
    hasPermission,
    role, 
    logout, 
    setIsAccountPickerOpen,
    profile 
  } = useAuth();
  
  const { refundRequests } = useSales();

  const [activeTab, setActiveTab] = useState<ProfileTab>('account');
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);

  // Shop Profile Editor Form State
  const [shopForm, setShopForm] = useState({
    shop_name: shopProfile.shop_name || '',
    shop_code: shopProfile.shop_code || '',
    trading_name: shopProfile.trading_name || '',
    phone: shopProfile.phone || '',
    email: shopProfile.email || '',
    address: shopProfile.address || '',
    city: shopProfile.city || '',
    province: shopProfile.province || 'Gauteng',
    postal_code: shopProfile.postal_code || '',
    saps_dealer_license: shopProfile.saps_dealer_license || '',
    vat_number: shopProfile.vat_number || '',
    registration_number: shopProfile.registration_number || '',
    logo_url: shopProfile.logo_url || (shopProfile.metadata as any)?.logo_url || ''
  });

  const [logoPreview, setLogoPreview] = useState<string | null>(
    shopProfile.logo_url || (shopProfile.metadata as any)?.logo_url || null
  );
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [isSavingShop, setIsSavingShop] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

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

  const sidebarItems = [
    { id: 'account', label: 'My Account', icon: User, show: true },
    { id: 'shop', label: 'Shop Profile', icon: Building2, show: true },
    { id: 'staff', label: 'Staff & Security', icon: UserPlus, show: hasPermission('staff') },
    { id: 'rules', label: 'Business Rules & Legal', icon: Sliders, show: isOwner },
    { id: 'system', label: 'System & Audit', icon: HardDrive, show: true },
  ];

  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to log out of the terminal?')) {
      await logout();
    }
  };

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Invalid File', 'Please select an image file (PNG, JPG, WebP).', 'amber');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast('File Too Large', 'Logo image must be under 5MB.', 'amber');
      return;
    }

    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setLogoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveShopProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError(null);

    if (!shopForm.shop_name.trim()) {
      showToast('Name Required', 'Please enter a shop name.', 'amber');
      return;
    }

    if (shopForm.phone.trim()) {
      const phoneRes = validateAndNormalizeSaPhone(shopForm.phone);
      if (!phoneRes.isValid) {
        setPhoneError(phoneRes.error || 'Invalid phone number');
        showToast('Invalid Phone', phoneRes.error || 'Please enter a valid South African phone number.', 'amber');
        return;
      }
    }

    setIsSavingShop(true);

    try {
      let finalLogoUrl = shopForm.logo_url;

      // Upload new logo if selected
      if (logoPreview && logoFile) {
        try {
          const session = await authApi.getSession();
          const token = session?.access_token;
          const uploadRes = await apiPost<{ imageUrl: string }>(
            '/api/storage/upload',
            { image: logoPreview, itemId: 'logo' },
            token
          );
          if (uploadRes.ok && uploadRes.data?.imageUrl) {
            finalLogoUrl = uploadRes.data.imageUrl;
          }
        } catch (uploadErr) {
          console.warn('Logo upload warning:', uploadErr);
        }
      }

      await updateShopProfile({
        ...shopForm,
        logo_url: finalLogoUrl,
        metadata: {
          ...(shopProfile.metadata as any || {}),
          logo_url: finalLogoUrl
        }
      });

      showToast('Store Profile Updated', 'Shop identity and branding saved.', 'success');
    } catch (err: any) {
      showToast('Save Failed', err.message || 'Could not update shop profile.', 'error');
    } finally {
      setIsSavingShop(false);
    }
  };

  return (
    <div className="flex-1 h-full overflow-hidden bg-[#0A0A0A] flex flex-col md:flex-row">
      {/* SIDEBAR NAVIGATION */}
      <aside className="w-full md:w-72 bg-[#121212] border-r border-[#2A2A2A] flex flex-col shrink-0">
        <div className="p-8 border-b border-[#2A2A2A]">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-[#C85A32]/10 border border-[#C85A32]/20 flex items-center justify-center text-[#E87A5D] shrink-0 overflow-hidden">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <User className="w-6 h-6" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-white truncate">{profile?.full_name}</p>
              <p className="text-[10px] text-gray-500 font-mono uppercase tracking-widest">{displayRole}</p>
            </div>
          </div>

          <button
            onClick={() => setIsAccountPickerOpen(true)}
            className="w-full flex items-center justify-between p-3.5 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl text-gray-300 hover:text-white hover:bg-[#222] transition-all group cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <ArrowLeftRight className="w-4 h-4 text-[#E87A5D] group-hover:rotate-180 transition-transform duration-500" />
              <span className="text-[11px] font-bold uppercase tracking-wider">Switch Account</span>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto no-scrollbar">
          {sidebarItems.filter(item => item.show).map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as ProfileTab)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                activeTab === item.id 
                  ? 'bg-[#C85A32] text-white shadow-lg shadow-[#C85A32]/10' 
                  : 'text-gray-500 hover:text-white hover:bg-[#1A1A1A]'
              }`}
            >
              <item.icon className="w-4 h-4" />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-[#2A2A2A] space-y-2">
          <button
            onClick={() => setIsRefundModalOpen(true)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[11px] font-bold uppercase tracking-wider text-amber-500 bg-amber-500/5 border border-amber-500/10 hover:bg-amber-500/10 transition-all cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refunds ({refundRequests.filter(r => r.status === 'Pending Approval').length})</span>
          </button>
          
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[11px] font-bold uppercase tracking-wider text-red-500 hover:bg-red-500/5 transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout Terminal</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 h-full overflow-y-auto p-6 lg:p-12 custom-scrollbar relative">
        <div className="max-w-5xl mx-auto">
          <AnimatePresence mode="wait">
            
            {/* 1. MY ACCOUNT */}
            {activeTab === 'account' && (
              <motion.div
                key="account"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-10"
              >
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                  <div>
                    <h1 className="text-3xl sm:text-4xl font-headline font-black text-white tracking-tight">My Account</h1>
                    <p className="text-gray-500 text-sm mt-1">Personal terminal session &amp; operator performance metrics</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Operator Role</p>
                      <p className="text-lg font-black text-white font-headline">{displayRole}</p>
                    </div>
                    <div className="w-14 h-14 rounded-2xl bg-[#1E1E1E] border border-[#2A2A2A] flex items-center justify-center text-[#E87A5D]">
                      <User className="w-7 h-7" />
                    </div>
                  </div>
                </div>

                {/* METRICS GRID */}
                <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  {[
                    { label: 'Shift Yield', val: `R ${metrics.totalToday.toLocaleString()}`, icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-500/5' },
                    { label: 'Drawer Cash', val: `R ${metrics.cashToday.toLocaleString()}`, icon: Banknote, color: 'text-amber-400', bg: 'bg-amber-500/5' },
                    { label: 'Sales Count', val: metrics.volumeToday.toString(), icon: Zap, color: 'text-blue-400', bg: 'bg-blue-500/5' },
                    { label: 'Avg Ticket', val: `R ${metrics.avgTicket.toFixed(0)}`, icon: Award, color: 'text-purple-400', bg: 'bg-purple-500/5' }
                  ].map((stat, i) => (
                    <div key={i} className="p-6 bg-[#121212] border border-[#2A2A2A] rounded-2xl space-y-3 shadow-xl">
                      <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center border border-white/5`}>
                        <stat.icon className={`w-5 h-5 ${stat.color}`} />
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest block mb-1">{stat.label}</span>
                        <span className="text-xl font-black text-white font-mono">{stat.val}</span>
                      </div>
                    </div>
                  ))}
                </section>

                {/* SECURITY & SHIFT ACTIVITY */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 text-[#E87A5D]">
                      <Lock className="w-4 h-4" />
                      <h3 className="text-xs font-bold uppercase tracking-widest">Terminal Security &amp; PIN</h3>
                    </div>
                    <div className="bg-[#121212] border border-[#2A2A2A] rounded-2xl p-6 space-y-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold text-white">Terminal PIN Code</p>
                          <p className="text-xs text-gray-500 mt-0.5">Used for terminal switching and elevation</p>
                        </div>
                        <button 
                          onClick={() => showToast('Manager Elevation Required', 'Ask your Owner or Manager to reset your PIN under Staff Settings.', 'amber')}
                          className="px-3.5 py-1.5 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl text-[10px] font-bold uppercase tracking-widest text-gray-300 hover:text-white transition-all cursor-pointer"
                        >
                          Change PIN
                        </button>
                      </div>
                      <div className="flex items-center justify-between pt-4 border-t border-[#2A2A2A]">
                        <div>
                          <p className="text-sm font-bold text-white">Digital Signature</p>
                          <p className="text-xs text-gray-500 mt-0.5">RSA-4096 signature for statutory receipts &amp; contracts</p>
                        </div>
                        <div className="flex items-center gap-2 text-emerald-400">
                          <CheckCircle className="w-4 h-4" />
                          <span className="text-[10px] font-bold uppercase tracking-widest">Active</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-3 text-blue-400">
                      <History className="w-4 h-4" />
                      <h3 className="text-xs font-bold uppercase tracking-widest">Recent Shift Activity</h3>
                    </div>
                    <div className="bg-[#121212] border border-[#2A2A2A] rounded-2xl divide-y divide-[#2A2A2A] overflow-hidden">
                      {metrics.recentActivity.length > 0 ? metrics.recentActivity.map((sale) => (
                        <div key={sale.id} className="p-4 flex items-center justify-between hover:bg-[#1A1A1A] transition-colors">
                          <div>
                            <p className="text-xs font-bold text-gray-100">{sale.receiptNumber}</p>
                            <p className="text-[10px] text-gray-500 font-mono mt-0.5">{new Date(sale.timestamp).toLocaleTimeString()}</p>
                          </div>
                          <p className="text-sm font-bold text-white font-mono">R {sale.total.toLocaleString()}</p>
                        </div>
                      )) : (
                        <div className="p-8 text-center text-gray-600">
                          <History className="w-6 h-6 mx-auto mb-2 opacity-30" />
                          <p className="text-[10px] uppercase font-bold tracking-widest">No Sales in Current Shift</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* 2. SHOP PROFILE */}
            {activeTab === 'shop' && (
              <motion.div
                key="shop"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <div>
                  <h1 className="text-3xl sm:text-4xl font-headline font-black text-white tracking-tight">Shop Profile</h1>
                  <p className="text-gray-500 text-sm mt-1">Manage shop branding, logo, contact information and location</p>
                </div>

                <form onSubmit={handleSaveShopProfile} className="bg-[#121212] border border-[#2A2A2A] rounded-3xl p-6 lg:p-8 space-y-6">
                  {/* LOGO UPLOAD & BRAND PREVIEW */}
                  <div className="space-y-2 pb-6 border-b border-[#2A2A2A]">
                    <h3 className="text-xs font-bold text-gray-300 uppercase tracking-widest">Shop Logo &amp; Branding</h3>
                    <div className="flex flex-col sm:flex-row items-center gap-6 p-5 rounded-2xl bg-[#1A1A1A] border border-[#2A2A2A]">
                      <div className="w-20 h-20 rounded-2xl bg-[#0A0A0A] border border-[#333] flex items-center justify-center overflow-hidden shrink-0">
                        {logoPreview ? (
                          <img src={logoPreview} alt="Shop Logo" className="w-full h-full object-contain p-1.5" />
                        ) : (
                          <ImageIcon className="w-10 h-10 text-gray-600" />
                        )}
                      </div>

                      <div className="flex-1 space-y-2 text-center sm:text-left">
                        <input 
                          type="file" 
                          ref={logoInputRef} 
                          onChange={handleLogoSelect} 
                          accept="image/png,image/jpeg,image/webp" 
                          className="hidden" 
                        />
                        <button
                          type="button"
                          onClick={() => logoInputRef.current?.click()}
                          className="px-4 py-2 rounded-xl bg-[#252525] hover:bg-[#333] text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer mx-auto sm:mx-0"
                        >
                          <Upload className="w-4 h-4 text-[#E87A5D]" />
                          <span>{logoPreview ? 'Change Shop Logo' : 'Upload Brand Logo'}</span>
                        </button>
                        <p className="text-xs text-gray-500">Supported: PNG, JPG, WebP under 5MB. Rendered on receipts, contracts &amp; headers.</p>
                      </div>
                    </div>
                  </div>

                  {/* SHOP IDENTITY & CONTACT */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Shop Name *</label>
                      <input 
                        type="text"
                        required
                        value={shopForm.shop_name}
                        onChange={e => setShopForm({ ...shopForm, shop_name: e.target.value })}
                        className="w-full h-11 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl px-4 text-xs text-white focus:border-[#C85A32] outline-none"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Branch Code</label>
                      <input 
                        type="text"
                        value={shopForm.shop_code}
                        onChange={e => setShopForm({ ...shopForm, shop_code: e.target.value.toUpperCase() })}
                        className="w-full h-11 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl px-4 text-xs text-white font-mono focus:border-[#C85A32] outline-none uppercase"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Primary Store Phone *</label>
                      <input 
                        type="tel"
                        required
                        value={shopForm.phone}
                        onChange={e => {
                          setShopForm({ ...shopForm, phone: e.target.value });
                          if (phoneError) setPhoneError(null);
                        }}
                        placeholder="011 123 4567"
                        className="w-full h-11 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl px-4 text-xs text-white focus:border-[#C85A32] outline-none"
                      />
                      {phoneError && <p className="text-xs text-red-500 mt-1">{phoneError}</p>}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Store Email *</label>
                      <input 
                        type="email"
                        required
                        value={shopForm.email}
                        onChange={e => setShopForm({ ...shopForm, email: e.target.value })}
                        placeholder="shop@store.co.za"
                        className="w-full h-11 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl px-4 text-xs text-white focus:border-[#C85A32] outline-none"
                      />
                    </div>
                  </div>

                  {/* LOCATION */}
                  <div className="space-y-5 pt-4 border-t border-[#2A2A2A]">
                    <h3 className="text-xs font-bold text-gray-300 uppercase tracking-widest">Physical Location</h3>
                    
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Street Address *</label>
                      <input 
                        type="text"
                        required
                        value={shopForm.address}
                        onChange={e => setShopForm({ ...shopForm, address: e.target.value })}
                        placeholder="123 Main Street..."
                        className="w-full h-11 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl px-4 text-xs text-white focus:border-[#C85A32] outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">City *</label>
                        <input 
                          type="text"
                          required
                          value={shopForm.city}
                          onChange={e => setShopForm({ ...shopForm, city: e.target.value })}
                          className="w-full h-11 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl px-4 text-xs text-white focus:border-[#C85A32] outline-none"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Province *</label>
                        <select
                          required
                          value={shopForm.province}
                          onChange={e => setShopForm({ ...shopForm, province: e.target.value })}
                          className="w-full h-11 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl px-4 text-xs text-white focus:border-[#C85A32] outline-none"
                        >
                          {SA_PROVINCES.map(prov => (
                            <option key={prov} value={prov} className="bg-[#121212]">{prov}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Postal Code</label>
                        <input 
                          type="text"
                          value={shopForm.postal_code}
                          onChange={e => setShopForm({ ...shopForm, postal_code: e.target.value })}
                          placeholder="2000"
                          className="w-full h-11 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl px-4 text-xs text-white focus:border-[#C85A32] outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4 border-t border-[#2A2A2A]">
                    <button
                      type="submit"
                      disabled={isSavingShop}
                      className="flex items-center gap-2 px-6 py-3 bg-[#C85A32] hover:bg-[#A94725] text-white rounded-xl text-xs font-bold transition shadow-lg shadow-[#C85A32]/20 cursor-pointer disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      <span>{isSavingShop ? 'Saving Profile...' : 'Save Shop Profile'}</span>
                    </button>
                  </div>
                </form>
              </motion.div>
            )}

            {/* 3. STAFF & SECURITY */}
            {activeTab === 'staff' && (
              <motion.div
                key="staff"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <StaffAccessManager />
              </motion.div>
            )}

            {/* 4. BUSINESS RULES & LEGAL */}
            {activeTab === 'rules' && (
              <motion.div
                key="rules"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="space-y-8"
              >
                <div>
                  <h1 className="text-3xl sm:text-4xl font-headline font-black text-white tracking-tight">Business Rules &amp; Legal</h1>
                  <p className="text-gray-500 text-sm mt-1">Configure NCR loan interest caps, resale markups, and statutory registration numbers</p>
                </div>
                <div className="p-8 lg:p-10 bg-[#121212] border border-[#2A2A2A] rounded-3xl shadow-2xl relative overflow-hidden">
                  <BusinessRulesManager />
                </div>
              </motion.div>
            )}

            {/* 5. SYSTEM & AUDIT */}
            {activeTab === 'system' && (
              <motion.div
                key="system"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div>
                  <h1 className="text-3xl sm:text-4xl font-headline font-black text-white tracking-tight">System &amp; Audit</h1>
                  <p className="text-gray-500 text-sm mt-1">Local device storage status, offline sync outbox, and backup/restore</p>
                </div>
                <ShopProfileAndOfflineHub />
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </main>

      {/* SHARED REFUND MODAL */}
      <RefundModal 
        isOpen={isRefundModalOpen} 
        onClose={() => setIsRefundModalOpen(false)} 
        hasApprovalAuthority={hasPermission('refunds')}
      />
    </div>
  );
};

interface RefundModalProps {
  isOpen: boolean;
  onClose: () => void;
  hasApprovalAuthority: boolean;
}

const RefundModal: React.FC<RefundModalProps> = ({ isOpen, onClose, hasApprovalAuthority }) => {
  const { refundRequests, approveRefund, requestRefund } = useSales();
  const { showToast } = useApp();
  const [filter, setFilter] = useState<'all' | 'Pending Approval' | 'Approved' | 'Rejected'>('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    receiptNumber: '',
    itemId: '',
    quantity: 1,
    refundAmount: '',
    reason: ''
  });

  const filtered = useMemo(() => {
    if (filter === 'all') return refundRequests;
    return refundRequests.filter(r => r.status === filter);
  }, [refundRequests, filter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(form.refundAmount);
    if (!form.receiptNumber || !form.itemId || isNaN(amt)) return;

    setIsSubmitting(true);
    const res = await requestRefund({
      ...form,
      refundAmount: amt
    });
    if (res.success) {
      showToast('Request Sent', 'Refund request is pending approval.', 'success');
      setForm({ receiptNumber: '', itemId: '', quantity: 1, refundAmount: '', reason: '' });
    } else {
      showToast('Error', res.error || 'Submission failed.', 'error');
    }
    setIsSubmitting(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/95 backdrop-blur-2xl animate-auth-fade">
      <div className="w-full max-w-5xl bg-[#121212] border border-[#2A2A2A] rounded-3xl p-8 lg:p-10 flex flex-col max-h-[90vh] shadow-2xl">
        <div className="flex items-center justify-between mb-6 border-b border-[#2A2A2A] pb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-500/10 rounded-2xl border border-amber-500/20 text-amber-500">
              <RefreshCw className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white font-headline tracking-tight">Refund Authorizations</h2>
              <p className="text-xs text-gray-500">Statutory retail refund ledger and manager overrides</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white transition-colors cursor-pointer">✕</button>
        </div>

        <div className="flex gap-8 flex-1 overflow-hidden">
          {/* LEFT: LIST */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar pb-2">
              {(['all', 'Pending Approval', 'Approved', 'Rejected'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setFilter(t)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    filter === t ? 'bg-[#C85A32] text-white' : 'bg-[#1A1A1A] text-gray-500 hover:text-white'
                  }`}
                >
                  {t === 'all' ? 'All Ledger' : t}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
              {filtered.map(req => (
                <div key={req.id} className="p-5 bg-[#181717] border border-[#282828] rounded-2xl flex items-center justify-between group">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono font-bold text-white">{req.receiptNumber}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${
                        req.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        req.status === 'Rejected' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                        'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }`}>{req.status}</span>
                    </div>
                    <p className="text-sm font-bold text-gray-200">{req.itemTitle}</p>
                    <p className="text-[11px] text-gray-500 italic truncate max-w-[200px]">"{req.reason}"</p>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-black font-mono text-white">R {req.refundAmount.toLocaleString()}</p>
                    {hasApprovalAuthority && req.status === 'Pending Approval' && (
                      <div className="flex gap-2 mt-2">
                        <button 
                          onClick={() => approveRefund({ refundId: req.id, approved: false })}
                          className="px-2.5 py-1 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer"
                        >Reject</button>
                        <button 
                          onClick={() => approveRefund({ refundId: req.id, approved: true })}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer"
                        >Approve</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="p-16 text-center">
                  <FileText className="w-10 h-10 text-gray-800 mx-auto mb-3 opacity-30" />
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-600">Ledger Empty</p>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: FORM */}
          <div className="w-72 space-y-4 shrink-0">
            <div className="p-6 bg-[#181717] border border-[#282828] rounded-2xl space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-[#E87A5D]">Create Request</h3>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-500 uppercase">Receipt #</label>
                  <input 
                    required
                    value={form.receiptNumber}
                    onChange={e => setForm({...form, receiptNumber: e.target.value})}
                    className="w-full bg-[#0A0A0A] border border-[#282828] rounded-xl px-3 py-1.5 text-xs text-white focus:border-[#C85A32] outline-none font-mono"
                    placeholder="REC-12345"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-500 uppercase">Item ID / SKU</label>
                  <input 
                    required
                    value={form.itemId}
                    onChange={e => setForm({...form, itemId: e.target.value})}
                    className="w-full bg-[#0A0A0A] border border-[#282828] rounded-xl px-3 py-1.5 text-xs text-white focus:border-[#C85A32] outline-none font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-500 uppercase">Amount (R)</label>
                  <input 
                    required
                    type="number"
                    value={form.refundAmount}
                    onChange={e => setForm({...form, refundAmount: e.target.value})}
                    className="w-full bg-[#0A0A0A] border border-[#282828] rounded-xl px-3 py-1.5 text-xs text-white focus:border-[#C85A32] outline-none font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-500 uppercase">Reason</label>
                  <textarea 
                    required
                    value={form.reason}
                    onChange={e => setForm({...form, reason: e.target.value})}
                    rows={2}
                    className="w-full bg-[#0A0A0A] border border-[#282828] rounded-xl px-3 py-1.5 text-xs text-white focus:border-[#C85A32] outline-none resize-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 bg-[#C85A32] hover:bg-[#A94725] text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md shadow-[#C85A32]/20 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Sending...' : 'Submit Request'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
