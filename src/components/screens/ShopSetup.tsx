import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { shopProfilesApi, authApi } from '../../services/supabaseApi';
import { validateAndNormalizeSaPhone } from '../../utils/phoneValidator';
import { apiPost } from '../../utils/apiClient';
import { 
  Loader2, 
  Store, 
  ChevronDown, 
  Phone, 
  Mail, 
  MapPin, 
  Building, 
  Hash, 
  ArrowRight,
  Upload,
  Image as ImageIcon,
  CheckCircle2
} from 'lucide-react';

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

export const ShopSetup: React.FC = () => {
  const { showToast } = useApp();
  const { user, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showOptional, setShowOptional] = useState(false);

  // Form State
  const [shopName, setShopName] = useState('');
  const [shopCode, setShopCode] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('Gauteng');
  const [postalCode, setPostalCode] = useState('');

  // Optional Legal Details
  const [tradingName, setTradingName] = useState('');
  const [regNumber, setRegNumber] = useState('');
  const [vatNumber, setVatNumber] = useState('');
  const [sapsLicense, setSapsLicense] = useState('');

  // Logo Upload State
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Validation Errors
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // Prefill email from authenticated user
  useEffect(() => {
    if (user?.email && !email) {
      setEmail(user.email);
    }
  }, [user, email]);

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

  const validate = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    // 1. Shop Name
    if (!shopName.trim()) {
      newErrors.shopName = 'Shop Name is required.';
    }

    // 2. Primary Phone (SA phone validation)
    const phoneResult = validateAndNormalizeSaPhone(phone);
    if (!phone.trim()) {
      newErrors.phone = 'Primary Shop Phone is required.';
    } else if (!phoneResult.isValid) {
      newErrors.phone = phoneResult.error || 'Please enter a valid South African phone number.';
    }

    // 3. Shop Email
    if (!email.trim()) {
      newErrors.email = 'Shop Email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = 'Please enter a valid email address.';
    }

    // 4. Physical Address
    if (!address.trim()) {
      newErrors.address = 'Physical Address is required.';
    }

    // 5. City
    if (!city.trim()) {
      newErrors.city = 'City is required.';
    }

    // 6. Province
    if (!province.trim()) {
      newErrors.province = 'Province is required.';
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      // Focus first error field
      const firstKey = Object.keys(newErrors)[0];
      const element = document.getElementById(firstKey);
      if (element) {
        element.focus();
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      showToast('Validation Error', 'Please correct the highlighted fields before continuing.', 'amber');
      return;
    }

    setLoading(true);

    try {
      let uploadedLogoUrl: string | undefined = undefined;

      // Upload logo if selected
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
            uploadedLogoUrl = uploadRes.data.imageUrl;
          }
        } catch (uploadErr) {
          console.warn('Logo upload warning (proceeding without logo):', uploadErr);
        }
      }

      const phoneResult = validateAndNormalizeSaPhone(phone);
      const normalizedPhone = phoneResult.normalizedNumber || phone.trim();

      const metadata: any = {};
      if (uploadedLogoUrl) {
        metadata.logo_url = uploadedLogoUrl;
      }
      if (tradingName.trim()) metadata.trading_name = tradingName.trim();
      if (regNumber.trim()) metadata.registration_number = regNumber.trim();
      if (vatNumber.trim()) metadata.vat_number = vatNumber.trim();
      if (sapsLicense.trim()) metadata.saps_dealer_license = sapsLicense.trim();

      const res = await shopProfilesApi.initializeNewShop({
        shop_name: shopName.trim(),
        shop_code: shopCode.trim().toUpperCase() || undefined,
        phone: normalizedPhone,
        email: email.trim(),
        address: address.trim(),
        city: city.trim(),
        province: province.trim(),
        postal_code: postalCode.trim() || undefined,
        metadata
      });

      if (res.success) {
        showToast('Shop Initialized', `${shopName.trim()} is set up and ready!`, 'success');
        await refreshProfile();
      } else {
        throw new Error(res.error || 'Failed to initialize shop profile');
      }
    } catch (err: any) {
      console.error('[ShopSetup] Error:', err);
      showToast('Setup Failed', err.message || 'Could not create shop profile', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getSubtleInputClass = (errorKey?: string) =>
    `w-full h-11 bg-white text-stone-900 placeholder:text-stone-400 text-sm rounded-xl px-3.5 border ${
      errorKey && errors[errorKey]
        ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
        : 'border-stone-200 focus:border-[#C85A32] focus:ring-[#C85A32]/20'
    } focus:ring-2 focus:outline-none transition-all duration-150`;

  return (
    <div className="relative min-h-screen flex flex-col justify-between font-sans text-stone-900 antialiased overflow-x-hidden selection:bg-[#FDF0EA] selection:text-[#C85A32]">
      {/* Subtle Animated Sky Atmosphere */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0 select-none" aria-hidden="true">
        <div className="absolute inset-0 bg-gradient-to-b from-[#EBF2F7] via-[#F6F5F2] to-[#F5ECE3]" />
        <div className="absolute -bottom-24 left-0 right-0 h-96 bg-gradient-to-t from-[#F8EDE1]/60 via-[#FDF9F4]/40 to-transparent" />
      </div>

      {/* Header */}
      <header className="relative z-10 w-full px-6 py-5 max-w-6xl mx-auto flex items-center justify-between animate-auth-fade">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#C85A32] text-white flex items-center justify-center shadow-sm shadow-[#C85A32]/25 font-bold text-sm">
            LM
          </div>
          <div>
            <span className="font-headline font-bold text-lg text-stone-900 tracking-tight block leading-tight">
              LocalMarket <span className="font-semibold text-[#C85A32] text-sm">POS</span>
            </span>
          </div>
        </div>

        <div className="text-xs font-medium text-stone-500 hidden sm:flex items-center gap-2">
          <span>Shop Registration &amp; Identity</span>
        </div>
      </header>

      {/* Main Form */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-8 sm:py-12">
        <div className="text-center mb-6 sm:mb-8 animate-auth-fade">
          <h1 className="font-headline font-bold text-3xl sm:text-4xl text-stone-900 tracking-tight">
            Establish Your Shop Identity
          </h1>
          <p className="text-stone-600 text-sm sm:text-base mt-2 font-normal">
            Enter your branch contact details and business location to begin.
          </p>
        </div>

        <div className="w-full max-w-[560px] animate-auth-card">
          <div className="bg-white/95 backdrop-blur-md border border-stone-200/90 rounded-3xl p-7 sm:p-9 shadow-xl shadow-stone-900/[0.04]">
            
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              
              {/* SHOP LOGO UPLOAD */}
              <div className="space-y-1.5 text-center sm:text-left">
                <label className="block text-xs font-semibold text-stone-700">
                  Shop Brand Logo <span className="text-stone-400 font-normal">(Optional)</span>
                </label>
                <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-2xl bg-stone-50 border border-stone-200">
                  <div className="w-16 h-16 rounded-2xl bg-white border border-stone-200 flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
                    {logoPreview ? (
                      <img src={logoPreview} alt="Shop Logo Preview" className="w-full h-full object-contain p-1" />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-stone-300" />
                    )}
                  </div>

                  <div className="flex-1 space-y-1 text-center sm:text-left">
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
                      className="px-3.5 py-1.5 rounded-xl bg-white border border-stone-200 hover:border-stone-300 text-stone-700 text-xs font-semibold transition flex items-center gap-2 cursor-pointer shadow-2xs mx-auto sm:mx-0"
                    >
                      <Upload className="w-3.5 h-3.5 text-[#C85A32]" />
                      <span>{logoPreview ? 'Change Logo' : 'Upload Shop Logo'}</span>
                    </button>
                    <p className="text-[11px] text-stone-400">PNG, JPG, WebP under 5MB. Displayed on receipts &amp; contracts.</p>
                  </div>
                </div>
              </div>

              {/* SHOP NAME */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="shopName" className="block text-xs font-semibold text-stone-900">
                    Shop Name <span className="text-[#C85A32]">*</span>
                  </label>
                  <span className="text-[11px] text-stone-400">Required</span>
                </div>

                <div className="relative">
                  <Store className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
                  <input 
                    id="shopName"
                    required
                    autoFocus
                    type="text"
                    value={shopName}
                    onChange={(e) => {
                      setShopName(e.target.value);
                      if (errors.shopName) setErrors(prev => ({ ...prev, shopName: '' }));
                    }}
                    placeholder="e.g. Downtown Pawn & Gold"
                    className={`w-full h-11 bg-white text-stone-900 placeholder:text-stone-400 text-sm font-medium rounded-xl pl-10 pr-4 border ${
                      errors.shopName
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
                        : 'border-stone-200 focus:border-[#C85A32] focus:ring-[#C85A32]/20'
                    } focus:ring-2 focus:outline-none transition-all duration-150`}
                  />
                </div>
                {errors.shopName && (
                  <p className="text-xs text-red-600 pl-1">{errors.shopName}</p>
                )}
              </div>

              {/* PRIMARY PHONE & EMAIL */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="phone" className="block text-xs font-semibold text-stone-900">
                    Primary Shop Phone <span className="text-[#C85A32]">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
                    <input 
                      id="phone"
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        if (errors.phone) setErrors(prev => ({ ...prev, phone: '' }));
                      }}
                      placeholder="011 123 4567"
                      className={`w-full h-11 bg-white text-stone-900 placeholder:text-stone-400 text-sm font-medium rounded-xl pl-10 pr-4 border ${
                        errors.phone
                          ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
                          : 'border-stone-200 focus:border-[#C85A32] focus:ring-[#C85A32]/20'
                      } focus:ring-2 focus:outline-none transition-all duration-150`}
                    />
                  </div>
                  {errors.phone && (
                    <p className="text-xs text-red-600 pl-1">{errors.phone}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="email" className="block text-xs font-semibold text-stone-900">
                    Shop Email <span className="text-[#C85A32]">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
                    <input 
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (errors.email) setErrors(prev => ({ ...prev, email: '' }));
                      }}
                      placeholder="shop@domain.co.za"
                      className={`w-full h-11 bg-white text-stone-900 placeholder:text-stone-400 text-sm font-medium rounded-xl pl-10 pr-4 border ${
                        errors.email
                          ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
                          : 'border-stone-200 focus:border-[#C85A32] focus:ring-[#C85A32]/20'
                      } focus:ring-2 focus:outline-none transition-all duration-150`}
                    />
                  </div>
                  {errors.email && (
                    <p className="text-xs text-red-600 pl-1">{errors.email}</p>
                  )}
                </div>
              </div>

              {/* PHYSICAL ADDRESS */}
              <div className="space-y-1.5">
                <label htmlFor="address" className="block text-xs font-semibold text-stone-900">
                  Physical Street Address <span className="text-[#C85A32]">*</span>
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3.5 top-3 w-4 h-4 text-stone-400 pointer-events-none" />
                  <textarea 
                    id="address"
                    required
                    value={address}
                    onChange={(e) => {
                      setAddress(e.target.value);
                      if (errors.address) setErrors(prev => ({ ...prev, address: '' }));
                    }}
                    placeholder="123 Main Street, Suite 4B..."
                    rows={2}
                    className={`w-full bg-white text-stone-900 placeholder:text-stone-400 text-sm rounded-xl pl-10 pr-3.5 py-2.5 border ${
                      errors.address
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
                        : 'border-stone-200 focus:border-[#C85A32] focus:ring-[#C85A32]/20'
                    } focus:ring-2 focus:outline-none transition-all duration-150 resize-none`}
                  />
                </div>
                {errors.address && (
                  <p className="text-xs text-red-600 pl-1">{errors.address}</p>
                )}
              </div>

              {/* CITY & PROVINCE */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="city" className="block text-xs font-semibold text-stone-900">
                    City / Town <span className="text-[#C85A32]">*</span>
                  </label>
                  <div className="relative">
                    <Building className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
                    <input 
                      id="city"
                      type="text"
                      required
                      value={city}
                      onChange={(e) => {
                        setCity(e.target.value);
                        if (errors.city) setErrors(prev => ({ ...prev, city: '' }));
                      }}
                      placeholder="Johannesburg"
                      className={`w-full h-11 bg-white text-stone-900 placeholder:text-stone-400 text-sm font-medium rounded-xl pl-10 pr-4 border ${
                        errors.city
                          ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
                          : 'border-stone-200 focus:border-[#C85A32] focus:ring-[#C85A32]/20'
                      } focus:ring-2 focus:outline-none transition-all duration-150`}
                    />
                  </div>
                  {errors.city && (
                    <p className="text-xs text-red-600 pl-1">{errors.city}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="province" className="block text-xs font-semibold text-stone-900">
                    Province <span className="text-[#C85A32]">*</span>
                  </label>
                  <select
                    id="province"
                    required
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                    className="w-full h-11 bg-white text-stone-900 text-sm font-medium rounded-xl px-3.5 border border-stone-200 focus:border-[#C85A32] focus:ring-2 focus:ring-[#C85A32]/20 focus:outline-none transition-all duration-150"
                  >
                    {SA_PROVINCES.map((prov) => (
                      <option key={prov} value={prov}>{prov}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* COLLAPSIBLE LEGAL / OPTIONAL DETAILS */}
              <div className="pt-2">
                <button 
                  type="button"
                  onClick={() => setShowOptional(!showOptional)}
                  className="w-full py-2.5 px-3.5 rounded-xl border border-dashed border-stone-200 hover:border-stone-300 bg-stone-50/60 hover:bg-stone-50 text-left flex items-center justify-between transition-colors group cursor-pointer"
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-stone-700 group-hover:text-stone-900">
                      {showOptional ? 'Hide optional legal details' : 'Add legal & VAT details (Optional)'}
                    </span>
                    <span className="text-[11px] text-stone-400">
                      Postal Code, CIPC Registration, SARS VAT, SAPS License
                    </span>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-stone-400 group-hover:text-stone-600 transition-transform duration-200 ${showOptional ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {showOptional && (
                <div className="space-y-3.5 pt-1 animate-auth-fade">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="space-y-1">
                      <label htmlFor="shopCode" className="block text-xs font-semibold text-stone-700">Shop Code</label>
                      <input 
                        id="shopCode"
                        type="text"
                        value={shopCode}
                        onChange={(e) => setShopCode(e.target.value.toUpperCase())}
                        placeholder="Auto-generated if blank"
                        className={getSubtleInputClass()}
                      />
                    </div>

                    <div className="space-y-1">
                      <label htmlFor="postalCode" className="block text-xs font-semibold text-stone-700">Postal Code</label>
                      <input 
                        id="postalCode"
                        type="text"
                        value={postalCode}
                        onChange={(e) => setPostalCode(e.target.value)}
                        placeholder="2000"
                        className={getSubtleInputClass()}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="space-y-1">
                      <label htmlFor="tradingName" className="block text-xs font-semibold text-stone-700">Legal Trading Name</label>
                      <input 
                        id="tradingName"
                        type="text"
                        value={tradingName}
                        onChange={(e) => setTradingName(e.target.value)}
                        placeholder="e.g. Acme Pawnbrokers (Pty) Ltd"
                        className={getSubtleInputClass()}
                      />
                    </div>

                    <div className="space-y-1">
                      <label htmlFor="regNumber" className="block text-xs font-semibold text-stone-700">CIPC Reg Number</label>
                      <input 
                        id="regNumber"
                        type="text"
                        value={regNumber}
                        onChange={(e) => setRegNumber(e.target.value)}
                        placeholder="2024/123456/07"
                        className={getSubtleInputClass()}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="space-y-1">
                      <label htmlFor="vatNumber" className="block text-xs font-semibold text-stone-700">SARS VAT Number</label>
                      <input 
                        id="vatNumber"
                        type="text"
                        value={vatNumber}
                        onChange={(e) => setVatNumber(e.target.value)}
                        placeholder="4123456789"
                        className={getSubtleInputClass()}
                      />
                    </div>

                    <div className="space-y-1">
                      <label htmlFor="sapsLicense" className="block text-xs font-semibold text-stone-700">SAPS Dealer License</label>
                      <input 
                        id="sapsLicense"
                        type="text"
                        value={sapsLicense}
                        onChange={(e) => setSapsLicense(e.target.value)}
                        placeholder="SHG-2024-987"
                        className={getSubtleInputClass()}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <div className="pt-3">
                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full h-13 bg-[#C85A32] hover:bg-[#B84E27] active:scale-[0.99] text-white font-semibold text-sm sm:text-base rounded-xl flex items-center justify-center gap-2.5 shadow-sm shadow-[#C85A32]/25 transition-all duration-150 disabled:opacity-50 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Initializing shop profile...</span>
                    </>
                  ) : (
                    <>
                      <span>Complete Shop Setup</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

              <div className="text-center pt-1">
                <p className="text-xs text-stone-400">
                  Shop identity and contact details can be updated anytime in Settings.
                </p>
              </div>
            </form>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full py-5 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-center text-center">
          <p className="text-[11px] font-medium text-stone-400 tracking-wider">
            Powered by LocalMarket
          </p>
        </div>
      </footer>
    </div>
  );
};
