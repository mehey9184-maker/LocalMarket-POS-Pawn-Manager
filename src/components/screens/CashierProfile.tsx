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
  ImageIcon,
  AlertTriangle
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useSales } from '../../context/SalesContext';
import { authApi } from '../../services/supabaseApi';
import { validateAndNormalizeSaPhone } from '../../utils/phoneValidator';
import { createLogoImage } from '../../utils/imageProcessor';
import { storageService } from '../../services/storageService';
import { apiPost } from '../../utils/apiClient';
import { ShopProfileAndOfflineHub } from '../profile/ShopProfileAndOfflineHub';
import { BusinessRulesManager } from '../profile/BusinessRulesManager';
import { StaffAccessManager } from '../profile/StaffAccessManager';
import { useOperationProgress } from '../../hooks/useOperationProgress';
import { OperationProgressScreen } from '../common/OperationProgressScreen';

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
    updateShopProfile,
    isOnline
  } = useApp();

  const { 
    isOwner, 
    isManager,
    isAtLeastManager,
    hasPermission,
    role, 
    logout, 
    setIsAccountPickerOpen,
    profile 
  } = useAuth();
  
  const { refundRequests } = useSales();
  const shopProgress = useOperationProgress();

  const [activeTab, setActiveTab] = useState<ProfileTab>('account');
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);

  // Unsaved changes state for staff access and schedule
  const [hasUnsavedStaffChanges, setHasUnsavedStaffChanges] = useState(false);
  const [unsavedTabTarget, setUnsavedTabTarget] = useState<ProfileTab | null>(null);
  const saveChangesRef = useRef<(() => Promise<boolean>) | null>(null);

  const handleTabChange = (nextTab: ProfileTab) => {
    if (activeTab === 'staff' && hasUnsavedStaffChanges) {
      setUnsavedTabTarget(nextTab);
      return;
    }
    setActiveTab(nextTab);
  };

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
    { id: 'shop', label: 'Shop Profile', icon: Building2, show: isOwner },
    { id: 'staff', label: 'Staff & Security', icon: UserPlus, show: isOwner || isManager },
    { id: 'rules', label: 'Business Rules & Legal', icon: Sliders, show: isOwner },
    { id: 'system', label: 'Device & Backup', icon: HardDrive, show: true },
  ];

  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to log out of the terminal?')) {
      await logout();
    }
  };

  const handleLogoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

    try {
      const processed = await createLogoImage(file, { size: 512, quality: 0.85 });
      setLogoFile(processed.file);
      setLogoPreview(processed.dataUrl);
      showToast('Logo Processed', 'Logo normalized to 512×512 square asset.', 'info');
    } catch (err: any) {
      console.error('Logo normalization error:', err);
      showToast('Error', 'Could not process logo image.', 'error');
    }
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

    const hasNewLogo = Boolean(logoPreview && logoFile);

    // Derive meaningful changed fields dynamically
    const changedItems: { id: string; label: string; detail?: string }[] = [];

    if (shopForm.shop_name.trim() !== (shopProfile.shop_name || '').trim()) {
      changedItems.push({
        id: 'name',
        label: 'Shop name changed',
        detail: shopForm.shop_name.trim()
      });
    }

    if (shopForm.trading_name.trim() !== (shopProfile.trading_name || '').trim()) {
      changedItems.push({
        id: 'trading',
        label: 'Trading name updated',
        detail: shopForm.trading_name.trim() || 'Cleared'
      });
    }

    if (shopForm.phone.trim() !== (shopProfile.phone || '').trim()) {
      changedItems.push({
        id: 'phone',
        label: 'Primary phone updated',
        detail: shopForm.phone.trim()
      });
    }

    if (shopForm.email.trim() !== (shopProfile.email || '').trim()) {
      changedItems.push({
        id: 'email',
        label: 'Email address updated',
        detail: shopForm.email.trim()
      });
    }

    if (
      shopForm.address.trim() !== (shopProfile.address || '').trim() ||
      shopForm.city.trim() !== (shopProfile.city || '').trim() ||
      shopForm.province.trim() !== (shopProfile.province || '').trim() ||
      shopForm.postal_code.trim() !== (shopProfile.postal_code || '').trim()
    ) {
      changedItems.push({
        id: 'address',
        label: 'Branch address updated',
        detail: [shopForm.address.trim(), shopForm.city.trim(), shopForm.province.trim(), shopForm.postal_code.trim()].filter(Boolean).join(', ')
      });
    }

    if (shopForm.vat_number.trim() !== (shopProfile.vat_number || '').trim()) {
      changedItems.push({
        id: 'vat',
        label: 'VAT details updated',
        detail: shopForm.vat_number.trim() || 'Cleared'
      });
    }

    if (shopForm.saps_dealer_license.trim() !== (shopProfile.saps_dealer_license || '').trim()) {
      changedItems.push({
        id: 'saps',
        label: 'SAPS licence details updated',
        detail: shopForm.saps_dealer_license.trim() || 'Cleared'
      });
    }

    if (shopForm.registration_number.trim() !== (shopProfile.registration_number || '').trim()) {
      changedItems.push({
        id: 'reg',
        label: 'Registration number updated',
        detail: shopForm.registration_number.trim() || 'Cleared'
      });
    }

    if (hasNewLogo) {
      changedItems.push({
        id: 'branding',
        label: 'Shop branding updated',
        detail: 'New store logo asset prepared'
      });
    }

    const steps = [
      { id: 'prep', label: 'Preparing your shop changes' },
      ...changedItems.map(item => ({
        id: item.id,
        label: item.label,
        detail: item.detail
      })),
      { id: 'save', label: isOnline ? 'Saving shop profile' : 'Saving shop profile locally' },
      { id: 'confirm', label: 'Confirming your changes' },
      { id: 'finish', label: 'Finishing' }
    ];

    await shopProgress.runSequence({
      title: 'Saving Shop Profile',
      subtitle: "We're taking care of your changes.",
      isOffline: !isOnline,
      offlineNotice: 'Changes will be saved locally on this device and queued for cloud sync.',
      steps,
      execute: async (runner) => {
        // 1. Preparation & changed items become active and complete immediately
        runner.startStep('prep');
        runner.completeStep('prep');

        for (const item of changedItems) {
          runner.startStep(item.id);
          runner.completeStep(item.id);
        }

        // 2. Real async logo preparation if needed (without fake timers)
        let finalLogoUrl = shopForm.logo_url;
        if (hasNewLogo && logoPreview && logoFile) {
          try {
            localStorage.setItem(`shop_logo_local_${shopProfile.id}`, logoPreview);
          } catch {}

          try {
            const uploadRes = await storageService.uploadLogoImage(logoPreview, shopProfile.id, logoFile.name);
            if (
              uploadRes.imageUrl &&
              !uploadRes.imageUrl.startsWith('data:image/') &&
              !uploadRes.storageKey?.startsWith('local/')
            ) {
              finalLogoUrl = uploadRes.imageUrl;
            }
          } catch (uploadErr) {
            console.warn('Logo upload warning (preserved locally):', uploadErr);
          }
        }

        // 3. Real persistence step
        runner.startStep('save');
        const res = await updateShopProfile({
          ...shopForm,
          logo_url: finalLogoUrl?.startsWith('data:image/') ? (shopProfile.logo_url || '') : finalLogoUrl,
          metadata: {
            ...(shopProfile.metadata as any || {}),
            ...(finalLogoUrl && !finalLogoUrl.startsWith('data:image/') ? { logo_url: finalLogoUrl } : {})
          }
        });

        if (!res.success) {
          throw new Error(res.error || 'Failed to save shop profile.');
        }
        runner.completeStep('save');

        // 4. Confirming changes truthfully
        runner.startStep('confirm');
        if (res.persistence === 'cloud') {
          runner.updateStepDetail('confirm', 'Changes saved and confirmed on server');
        } else {
          runner.updateStepDetail('confirm', 'Saved on this computer · Cloud sync queued');
        }
        runner.completeStep('confirm');

        // 5. Finishing
        runner.startStep('finish');
        runner.completeStep('finish');

        return res;
      },
      successTitle: (res) => (res?.persistence === 'cloud' ? 'Shop Profile Saved' : 'Saved on This Computer'),
      successMessage: (res) => (res?.persistence === 'cloud' 
        ? `${shopForm.shop_name} settings are active and confirmed.`
        : `${shopForm.shop_name} settings saved on this computer. Cloud sync queued.`),
      onSuccess: () => {
        setIsSavingShop(false);
        setActiveTab('account'); // Auto-return to parent Profile context
      },
      onError: () => {
        setIsSavingShop(false);
      },
      onClose: () => {
        setIsSavingShop(false);
      }
    });
  };

  return (
    <div className="flex-1 h-full overflow-hidden bg-stone-50/60 flex flex-col md:flex-row text-stone-900">
      {/* SIDEBAR NAVIGATION */}
      <aside className="w-full md:w-72 bg-white border-r border-stone-200 flex flex-col shrink-0">
        <div className="p-8 border-b border-stone-200">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-[#C85A32]/10 border border-[#C85A32]/20 flex items-center justify-center text-[#E87A5D] shrink-0 overflow-hidden">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <User className="w-6 h-6 text-[#C85A32]" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-stone-900 truncate">{profile?.full_name}</p>
              <p className="text-[10px] text-stone-500 font-mono uppercase tracking-widest">{displayRole}</p>
            </div>
          </div>

          <button
            onClick={() => setIsAccountPickerOpen(true)}
            className="w-full flex items-center justify-between p-3.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-700 hover:text-[#C85A32] hover:bg-stone-100 transition-all group cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <ArrowLeftRight className="w-4 h-4 text-[#E87A5D] group-hover:rotate-180 transition-transform duration-500" />
              <span className="text-[11px] font-bold uppercase tracking-wider">Switch Account</span>
            </div>
            <ChevronRight className="w-4 h-4 text-stone-400" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto no-scrollbar">
          {sidebarItems.filter(item => item.show).map(item => (
            <button
              key={item.id}
              onClick={() => handleTabChange(item.id as ProfileTab)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                activeTab === item.id 
                  ? 'bg-[#C85A32] text-white shadow-lg shadow-[#C85A32]/10' 
                  : 'text-stone-500 hover:text-stone-900 hover:bg-stone-50'
              }`}
            >
              <item.icon className="w-4 h-4" />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-stone-200 space-y-2">
          <button
            onClick={() => setIsRefundModalOpen(true)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[11px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-all cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refunds ({refundRequests.filter(r => r.status === 'Pending Approval').length})</span>
          </button>
          
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[11px] font-bold uppercase tracking-wider text-red-600 hover:bg-red-50 transition-all cursor-pointer"
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
                    <h1 className="text-3xl sm:text-4xl font-headline font-black text-stone-900 tracking-tight">My Account</h1>
                    <p className="text-stone-500 text-sm mt-1">Personal terminal session &amp; operator performance metrics</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Operator Role</p>
                      <p className="text-lg font-black text-stone-900 font-headline">{displayRole}</p>
                    </div>
                    <div className="w-14 h-14 rounded-2xl bg-white border border-stone-200 flex items-center justify-center text-[#C85A32] shadow-xs">
                      <User className="w-7 h-7" />
                    </div>
                  </div>
                </div>

                {/* METRICS GRID */}
                <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  {[
                    { label: 'Shift Yield', val: `R ${metrics.totalToday.toLocaleString()}`, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                    { label: 'Drawer Cash', val: `R ${metrics.cashToday.toLocaleString()}`, icon: Banknote, color: 'text-amber-600', bg: 'bg-amber-50' },
                    { label: 'Sales Count', val: metrics.volumeToday.toString(), icon: Zap, color: 'text-blue-600', bg: 'bg-blue-50' },
                    { label: 'Avg Ticket', val: `R ${metrics.avgTicket.toFixed(0)}`, icon: Award, color: 'text-purple-600', bg: 'bg-purple-50' }
                  ].map((stat, i) => (
                    <div key={i} className="p-6 bg-white border border-stone-200 rounded-2xl space-y-3 shadow-xs">
                      <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center border border-stone-100`}>
                        <stat.icon className={`w-5 h-5 ${stat.color}`} />
                      </div>
                      <div>
                        <span className="text-[10px] text-stone-400 uppercase font-black tracking-widest block mb-1">{stat.label}</span>
                        <span className="text-xl font-black text-stone-900 font-mono">{stat.val}</span>
                      </div>
                    </div>
                  ))}
                </section>

                {/* SECURITY & SHIFT ACTIVITY */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 text-[#C85A32]">
                      <Lock className="w-4 h-4" />
                      <h3 className="text-xs font-bold uppercase tracking-widest">Terminal Security &amp; PIN</h3>
                    </div>
                    <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-5 shadow-xs">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold text-stone-900">Terminal PIN Code</p>
                          <p className="text-xs text-stone-500 mt-0.5">Used for terminal switching and elevation</p>
                        </div>
                        <button 
                          onClick={() => showToast('Manager Elevation Required', 'Ask your Owner or Manager to reset your PIN under Staff Settings.', 'amber')}
                          className="px-3.5 py-1.5 bg-stone-100 border border-stone-200 rounded-xl text-[10px] font-bold uppercase tracking-widest text-stone-700 hover:text-stone-900 hover:bg-stone-200 transition-all cursor-pointer"
                        >
                          Change PIN
                        </button>
                      </div>
                      <div className="flex items-center justify-between pt-4 border-t border-stone-100">
                        <div>
                          <p className="text-sm font-bold text-stone-900">Digital Signature</p>
                          <p className="text-xs text-stone-500 mt-0.5">RSA-4096 signature for statutory receipts &amp; contracts</p>
                        </div>
                        <div className="flex items-center gap-2 text-emerald-600">
                          <CheckCircle className="w-4 h-4" />
                          <span className="text-[10px] font-bold uppercase tracking-widest">Active</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-3 text-blue-600">
                      <History className="w-4 h-4" />
                      <h3 className="text-xs font-bold uppercase tracking-widest">Recent Shift Activity</h3>
                    </div>
                    <div className="bg-white border border-stone-200 rounded-2xl divide-y divide-stone-100 overflow-hidden shadow-xs">
                      {metrics.recentActivity.length > 0 ? metrics.recentActivity.map((sale) => (
                        <div key={sale.id} className="p-4 flex items-center justify-between hover:bg-stone-50 transition-colors">
                          <div>
                            <p className="text-xs font-bold text-stone-800">{sale.receiptNumber}</p>
                            <p className="text-[10px] text-stone-400 font-mono mt-0.5">{new Date(sale.timestamp).toLocaleTimeString()}</p>
                          </div>
                          <p className="text-sm font-bold text-stone-900 font-mono">R {sale.total.toLocaleString()}</p>
                        </div>
                      )) : (
                        <div className="p-8 text-center text-stone-400">
                          <History className="w-6 h-6 mx-auto mb-2 opacity-30 text-stone-300" />
                          <p className="text-[10px] uppercase font-bold tracking-widest text-stone-400">No Sales in Current Shift</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* 2. SHOP PROFILE */}
            {activeTab === 'shop' && (
              isOwner ? (
                <motion.div
                  key="shop"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-8"
                >
                <div>
                  <h1 className="text-3xl sm:text-4xl font-headline font-black text-stone-900 tracking-tight">Shop Profile</h1>
                  <p className="text-stone-500 text-sm mt-1">Manage shop branding, logo, contact information and location</p>
                </div>

                <form onSubmit={handleSaveShopProfile} className="bg-white border border-stone-200 rounded-3xl p-6 lg:p-8 space-y-6 shadow-xs">
                  {/* LOGO UPLOAD & BRAND PREVIEW */}
                  <div className="space-y-2 pb-6 border-b border-stone-100">
                    <h3 className="text-xs font-bold text-stone-600 uppercase tracking-widest">Shop Logo &amp; Branding</h3>
                    <div className="flex flex-col sm:flex-row items-center gap-6 p-5 rounded-2xl bg-stone-50 border border-stone-200">
                      <div className="w-20 h-20 rounded-2xl bg-white border border-stone-200 flex items-center justify-center overflow-hidden shrink-0">
                        {logoPreview ? (
                          <img src={logoPreview} alt="Shop Logo" className="w-full h-full object-contain p-1.5" />
                        ) : (
                          <ImageIcon className="w-10 h-10 text-stone-300" />
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
                          className="px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-200 text-xs font-bold transition flex items-center gap-2 cursor-pointer mx-auto sm:mx-0"
                        >
                          <Upload className="w-4 h-4 text-[#C85A32]" />
                          <span>{logoPreview ? 'Change Shop Logo' : 'Upload Brand Logo'}</span>
                        </button>
                        <p className="text-xs text-stone-400">Supported: PNG, JPG, WebP under 5MB. Rendered on receipts, contracts &amp; headers.</p>
                      </div>
                    </div>
                  </div>

                  {/* SHOP IDENTITY & CONTACT */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">Shop Name *</label>
                      <input 
                        type="text"
                        required
                        value={shopForm.shop_name}
                        onChange={e => setShopForm({ ...shopForm, shop_name: e.target.value })}
                        className="w-full h-11 bg-white border border-stone-200 rounded-xl px-4 text-xs text-stone-900 focus:border-[#C85A32] outline-none"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">Branch Code</label>
                      <input 
                        type="text"
                        value={shopForm.shop_code}
                        onChange={e => setShopForm({ ...shopForm, shop_code: e.target.value.toUpperCase() })}
                        className="w-full h-11 bg-white border border-stone-200 rounded-xl px-4 text-xs text-stone-900 font-mono focus:border-[#C85A32] outline-none uppercase"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">Primary Store Phone *</label>
                      <input 
                        type="tel"
                        required
                        value={shopForm.phone}
                        onChange={e => {
                          setShopForm({ ...shopForm, phone: e.target.value });
                          if (phoneError) setPhoneError(null);
                        }}
                        placeholder="011 123 4567"
                        className="w-full h-11 bg-white border border-stone-200 rounded-xl px-4 text-xs text-stone-900 focus:border-[#C85A32] outline-none"
                      />
                      {phoneError && <p className="text-xs text-red-500 mt-1">{phoneError}</p>}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">Store Email *</label>
                      <input 
                        type="email"
                        required
                        value={shopForm.email}
                        onChange={e => setShopForm({ ...shopForm, email: e.target.value })}
                        placeholder="shop@store.co.za"
                        className="w-full h-11 bg-white border border-stone-200 rounded-xl px-4 text-xs text-stone-900 focus:border-[#C85A32] outline-none"
                      />
                    </div>
                  </div>

                  {/* LOCATION */}
                  <div className="space-y-5 pt-4 border-t border-stone-100">
                    <h3 className="text-xs font-bold text-stone-700 uppercase tracking-widest">Physical Location</h3>
                    
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">Street Address *</label>
                      <input 
                        type="text"
                        required
                        value={shopForm.address}
                        onChange={e => setShopForm({ ...shopForm, address: e.target.value })}
                        placeholder="123 Main Street..."
                        className="w-full h-11 bg-white border border-stone-200 rounded-xl px-4 text-xs text-stone-900 focus:border-[#C85A32] outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">City *</label>
                        <input 
                          type="text"
                          required
                          value={shopForm.city}
                          onChange={e => setShopForm({ ...shopForm, city: e.target.value })}
                          className="w-full h-11 bg-white border border-stone-200 rounded-xl px-4 text-xs text-stone-900 focus:border-[#C85A32] outline-none"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">Province *</label>
                        <select
                          required
                          value={shopForm.province}
                          onChange={e => setShopForm({ ...shopForm, province: e.target.value })}
                          className="w-full h-11 bg-white border border-stone-200 rounded-xl px-4 text-xs text-stone-900 focus:border-[#C85A32] outline-none"
                        >
                          {SA_PROVINCES.map(prov => (
                            <option key={prov} value={prov} className="bg-white text-stone-900">{prov}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">Postal Code</label>
                        <input 
                          type="text"
                          value={shopForm.postal_code}
                          onChange={e => setShopForm({ ...shopForm, postal_code: e.target.value })}
                          placeholder="2000"
                          className="w-full h-11 bg-white border border-stone-200 rounded-xl px-4 text-xs text-stone-900 focus:border-[#C85A32] outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4 border-t border-stone-100">
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
            ) : (
              <div className="p-12 text-center bg-white border border-stone-200 rounded-3xl space-y-3 shadow-xs">
                <Building2 className="w-10 h-10 text-stone-300 mx-auto" />
                <h3 className="text-base font-bold text-stone-900">Owner Access Required</h3>
                <p className="text-xs text-stone-500 max-w-sm mx-auto">
                  Shop Profile settings and statutory legal compliance registrations can only be modified by the Shop Owner.
                </p>
              </div>
            ))}

            {/* 3. STAFF & SECURITY */}
            {activeTab === 'staff' && (
              <motion.div
                key="staff"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <StaffAccessManager 
                  onUnsavedChangesChange={setHasUnsavedStaffChanges}
                  onSaveChangesRef={saveChangesRef}
                />
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
                  <h1 className="text-3xl sm:text-4xl font-headline font-black text-stone-900 tracking-tight">Business Rules &amp; Legal</h1>
                  <p className="text-stone-500 text-sm mt-1">Configure NCR loan interest caps, resale markups, and statutory registration numbers</p>
                </div>
                <div className="p-8 lg:p-10 bg-white border border-stone-200 rounded-3xl shadow-sm relative overflow-hidden">
                  <BusinessRulesManager onSuccess={() => setActiveTab('account')} />
                </div>
              </motion.div>
            )}

            {/* 5. DEVICE & BACKUP */}
            {activeTab === 'system' && (
              <motion.div
                key="system"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div>
                  <h1 className="text-3xl sm:text-4xl font-headline font-black text-stone-900 tracking-tight">Device &amp; Backup</h1>
                  <p className="text-stone-500 text-sm mt-1">Keep this computer ready for work, manage saved data, and create or restore a backup.</p>
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

       {/* SHOP SETTINGS OPERATION PROGRESS SCREEN */}
      <OperationProgressScreen state={shopProgress.state} />

      {/* LIGHTWEIGHT CONFIRMATION FOR UNSAVED CHANGES WHEN SWITCHING TABS */}
      {unsavedTabTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-stone-900/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white border border-stone-200 rounded-3xl p-8 shadow-2xl relative space-y-6 text-stone-900">
            <div className="flex items-center gap-3 text-amber-600">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-bold text-lg text-stone-900">Unsaved changes</h3>
            </div>

            <p className="text-xs text-stone-500 leading-relaxed">
              You have changes that haven't been saved yet.
            </p>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setUnsavedTabTarget(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-stone-500 hover:text-stone-700 transition-colors cursor-pointer"
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={() => {
                  setHasUnsavedStaffChanges(false);
                  setActiveTab(unsavedTabTarget);
                  setUnsavedTabTarget(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (saveChangesRef.current) {
                    const ok = await saveChangesRef.current();
                    if (ok) {
                      setHasUnsavedStaffChanges(false);
                      setActiveTab(unsavedTabTarget);
                      setUnsavedTabTarget(null);
                    }
                  }
                }}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#C85A32] hover:bg-[#A94725] text-white transition-all cursor-pointer shadow-md shadow-[#C85A32]/10"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
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
  const { showToast, isOnline } = useApp();
  const [filter, setFilter] = useState<'all' | 'Pending Approval' | 'Approved' | 'Rejected'>('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const refundProgress = useOperationProgress();
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
    await refundProgress.runSequence({
      title: 'Submitting Refund Request',
      subtitle: "We're taking care of your request.",
      isOffline: !isOnline,
      steps: [
        { id: 'prep', label: `Validating receipt #${form.receiptNumber}` },
        { id: 'calc', label: `Calculating refund amount: R ${amt.toLocaleString()}` },
        { id: 'save', label: isOnline ? 'Submitting authorization request' : 'Saving refund request on this device' },
        { id: 'finish', label: 'Finishing refund registration' }
      ],
      execute: async (runner) => {
        runner.startStep('prep');
        runner.completeStep('prep');

        runner.startStep('calc');
        runner.completeStep('calc');

        runner.startStep('save');
        const res = await requestRefund({
          ...form,
          refundAmount: amt
        });
        if (!res.success) {
          throw new Error(res.error || 'Refund request submission failed.');
        }
        runner.completeStep('save');

        runner.startStep('finish');
        runner.completeStep('finish');

        return res;
      },
      successTitle: 'Refund Request Submitted',
      successMessage: `Request for receipt ${form.receiptNumber} is pending manager review.`,
      onSuccess: () => {
        setForm({ receiptNumber: '', itemId: '', quantity: 1, refundAmount: '', reason: '' });
        setIsSubmitting(false);
      },
      onError: () => {
        setIsSubmitting(false);
      }
    });
  };

  const handleApproveOrReject = async (refundId: string, approved: boolean, receiptNum: string) => {
    await refundProgress.runSequence({
      title: approved ? 'Approving Refund' : 'Rejecting Refund',
      subtitle: "We're processing your authorization.",
      isOffline: !isOnline,
      steps: [
        { id: 'auth', label: 'Verifying manager authorization' },
        { id: 'ledger', label: approved ? `Authorizing refund for #${receiptNum}` : `Rejecting refund request #${receiptNum}` },
        { id: 'save', label: isOnline ? 'Updating refund ledger' : 'Saving status on this computer' },
        { id: 'finish', label: 'Finalizing authorization' }
      ],
      execute: async (runner) => {
        runner.startStep('auth');
        runner.completeStep('auth');

        runner.startStep('ledger');
        const res = await approveRefund({ refundId, approved });
        if (!res.success) {
          throw new Error(res.error || 'Failed to update refund status.');
        }
        runner.completeStep('ledger');

        runner.startStep('save');
        runner.completeStep('save');

        runner.startStep('finish');
        runner.completeStep('finish');

        return approved;
      },
      successTitle: approved ? 'Refund Approved' : 'Refund Rejected',
      successMessage: approved 
        ? `Refund for #${receiptNum} approved and updated in ledger.`
        : `Refund for #${receiptNum} marked as rejected.`
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-stone-900/60 backdrop-blur-md animate-auth-fade">
      <div className="w-full max-w-5xl bg-white border border-stone-200 rounded-3xl p-8 lg:p-10 flex flex-col max-h-[90vh] shadow-2xl text-stone-900">
        <div className="flex items-center justify-between mb-6 border-b border-stone-100 pb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-[#C85A32]">
              <RefreshCw className="w-6 h-6 animate-spin-slow" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-stone-900 font-headline tracking-tight">Refund Authorizations</h2>
              <p className="text-xs text-stone-500">Statutory retail refund ledger and manager overrides</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-700 transition-colors cursor-pointer">✕</button>
        </div>

        <div className="flex flex-col md:flex-row gap-8 flex-1 overflow-hidden">
          {/* LEFT: LIST */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar pb-2">
              {(['all', 'Pending Approval', 'Approved', 'Rejected'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setFilter(t)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    filter === t ? 'bg-[#C85A32] text-white' : 'bg-stone-50 text-stone-500 hover:text-stone-950 border border-stone-200'
                  }`}
                >
                  {t === 'all' ? 'All Ledger' : t}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
              {filtered.map(req => (
                <div key={req.id} className="p-5 bg-stone-50 border border-stone-200 rounded-2xl flex items-center justify-between group">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono font-bold text-stone-900">{req.receiptNumber}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${
                        req.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        req.status === 'Rejected' ? 'bg-red-50 text-red-700 border-red-200' :
                        'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>{req.status}</span>
                    </div>
                    <p className="text-sm font-bold text-stone-800">{req.itemTitle}</p>
                    <p className="text-[11px] text-stone-500 italic truncate max-w-[200px]">"{req.reason}"</p>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-black font-mono text-stone-900">R {req.refundAmount.toLocaleString()}</p>
                    {hasApprovalAuthority && req.status === 'Pending Approval' && (
                      <div className="flex gap-2 mt-2">
                        <button 
                          onClick={() => handleApproveOrReject(req.id, false, req.receiptNumber)}
                          className="px-2.5 py-1 bg-red-50 hover:bg-red-600 text-red-600 hover:text-white rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer border border-red-200"
                        >Reject</button>
                        <button 
                          onClick={() => handleApproveOrReject(req.id, true, req.receiptNumber)}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer"
                        >Approve</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="p-16 text-center text-stone-400">
                  <FileText className="w-10 h-10 text-stone-300 mx-auto mb-3 opacity-50" />
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400">Ledger Empty</p>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: FORM */}
          <div className="w-full md:w-72 space-y-4 shrink-0">
            <div className="p-6 bg-stone-50 border border-stone-200 rounded-2xl space-y-4 shadow-xs">
              <h3 className="text-xs font-black uppercase tracking-widest text-[#C85A32]">Create Request</h3>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-stone-500 uppercase">Receipt #</label>
                  <input 
                    required
                    value={form.receiptNumber}
                    onChange={e => setForm({...form, receiptNumber: e.target.value})}
                    className="w-full bg-white border border-stone-200 rounded-xl px-3 py-1.5 text-xs text-stone-900 focus:border-[#C85A32] outline-none font-mono"
                    placeholder="REC-12345"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-stone-500 uppercase">Item ID / SKU</label>
                  <input 
                    required
                    value={form.itemId}
                    onChange={e => setForm({...form, itemId: e.target.value})}
                    className="w-full bg-white border border-stone-200 rounded-xl px-3 py-1.5 text-xs text-stone-900 focus:border-[#C85A32] outline-none font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-stone-500 uppercase">Amount (R)</label>
                  <input 
                    required
                    type="number"
                    value={form.refundAmount}
                    onChange={e => setForm({...form, refundAmount: e.target.value})}
                    className="w-full bg-white border border-stone-200 rounded-xl px-3 py-1.5 text-xs text-stone-900 focus:border-[#C85A32] outline-none font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-stone-500 uppercase">Reason</label>
                  <textarea 
                    required
                    value={form.reason}
                    onChange={e => setForm({...form, reason: e.target.value})}
                    rows={2}
                    className="w-full bg-white border border-stone-200 rounded-xl px-3 py-1.5 text-xs text-stone-900 focus:border-[#C85A32] outline-none resize-none"
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

      {/* REFUND PROGRESS SCREEN */}
      <OperationProgressScreen state={refundProgress.state} />
    </div>
  );
};
