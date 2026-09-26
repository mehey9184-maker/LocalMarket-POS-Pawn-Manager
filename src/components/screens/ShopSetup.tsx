import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { shopProfilesApi } from '../../services/supabaseApi';
import { Loader2, Store, ChevronDown, Phone, Mail, MapPin, Building, Hash, ArrowRight } from 'lucide-react';

export const ShopSetup: React.FC = () => {
  const { showToast } = useApp();
  const { refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showOptional, setShowOptional] = useState(false);

  // Form State
  const [shopName, setShopName] = useState('');
  const [shopCode, setShopCode] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [postalCode, setPostalCode] = useState('');

  // Local Validation State
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = shopName.trim();
    if (!trimmedName) {
      setError('Please enter your shop name.');
      showToast('Shop Name Required', 'Please enter your shop name to continue.', 'amber');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await shopProfilesApi.initializeNewShop({
        shop_name: trimmedName,
        shop_code: shopCode.trim().toUpperCase() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        city: city.trim() || undefined,
        province: province.trim() || undefined,
        postal_code: postalCode.trim() || undefined
      });

      if (res.success) {
        showToast('Shop Ready', 'Your shop has been set up successfully.', 'success');
        await refreshProfile();
        // The App.tsx navigation effect will smoothly transition to 'home'
      } else {
        throw new Error(res.error || 'Failed to initialize shop');
      }
    } catch (err: any) {
      console.error('[ShopSetup] Error:', err);
      showToast('Setup Failed', err.message || 'Could not create shop profile', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getSubtleInputClass = () =>
    'w-full h-11 bg-white text-stone-900 placeholder:text-stone-400 text-sm rounded-xl px-3.5 border border-stone-200 focus:border-[#C85A32] focus:ring-2 focus:ring-[#C85A32]/20 focus:outline-none transition-all duration-150';

  return (
    <div className="relative min-h-screen flex flex-col justify-between font-sans text-stone-900 antialiased overflow-x-hidden selection:bg-[#FDF0EA] selection:text-[#C85A32]">
      {/* Subtle Animated Sky & Cloud Atmosphere (Inherited from Auth experience) */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0 select-none" aria-hidden="true">
        {/* Soft morning horizon sky */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#EBF2F7] via-[#F6F5F2] to-[#F5ECE3]" />
        
        {/* Gentle dawn warmth horizon glow */}
        <div className="absolute -bottom-24 left-0 right-0 h-96 bg-gradient-to-t from-[#F8EDE1]/60 via-[#FDF9F4]/40 to-transparent" />

        {/* Ambient morning light sheen */}
        <div className="absolute -top-32 right-[-10%] w-[560px] h-[560px] rounded-full bg-gradient-to-br from-[#FFF7EA]/40 via-[#FFF1D6]/20 to-transparent filter blur-3xl" />

        {/* Cloud Layer 1: High subtle drifts */}
        <div className="cloud-layer-1 absolute -top-12 -left-20 w-[140%] h-[55%] opacity-40 filter blur-3xl">
          <div className="absolute top-[8%] left-[12%] w-[480px] h-[220px] rounded-full bg-white/90" />
          <div className="absolute top-[3%] left-[45%] w-[580px] h-[260px] rounded-full bg-white/80" />
          <div className="absolute top-[12%] left-[72%] w-[420px] h-[190px] rounded-full bg-white/75" />
        </div>

        {/* Cloud Layer 2: Mid atmosphere billows */}
        <div className="cloud-layer-2 absolute top-[16%] -left-32 w-[150%] h-[60%] opacity-50 filter blur-[46px]">
          <div className="absolute top-[12%] left-[6%] w-[540px] h-[240px] rounded-full bg-gradient-to-tr from-white via-white/95 to-[#FFFBF5]" />
          <div className="absolute top-[22%] left-[34%] w-[640px] h-[270px] rounded-full bg-white/90" />
          <div className="absolute top-[8%] left-[64%] w-[500px] h-[220px] rounded-full bg-gradient-to-br from-white to-[#F0F6FB]" />
          <div className="absolute top-[26%] left-[82%] w-[400px] h-[190px] rounded-full bg-white/80" />
        </div>

        {/* Cloud Layer 3: Lower soft expanse */}
        <div className="cloud-layer-3 absolute bottom-[6%] -left-20 w-[140%] h-[50%] opacity-45 filter blur-[56px]">
          <div className="absolute bottom-[8%] left-[8%] w-[620px] h-[260px] rounded-full bg-white/90" />
          <div className="absolute bottom-[16%] left-[46%] w-[720px] h-[300px] rounded-full bg-gradient-to-t from-white via-[#FCF9F5] to-white/70" />
          <div className="absolute bottom-[4%] left-[78%] w-[520px] h-[230px] rounded-full bg-white/85" />
        </div>
      </div>

      {/* Top Header */}
      <header className="relative z-10 w-full px-6 py-5 max-w-6xl mx-auto flex items-center justify-between animate-auth-fade">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#C85A32] text-white flex items-center justify-center shadow-sm shadow-[#C85A32]/25">
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 9l2-5h14l2 5" />
              <path d="M21 9v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9" />
              <path d="M9 21V12h6v9" />
              <path d="M3 9h18" />
            </svg>
          </div>
          <div>
            <span className="font-headline font-bold text-lg text-stone-900 tracking-tight block leading-tight">
              LocalMarket <span className="font-semibold text-[#C85A32] text-sm">POS</span>
            </span>
          </div>
        </div>

        <div className="text-xs font-medium text-stone-500 hidden sm:flex items-center gap-2">
          <span>First-time setup</span>
        </div>
      </header>

      {/* Main Centered Content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-8 sm:py-12">
        {/* Reassuring Hero Area */}
        <div className="text-center mb-6 sm:mb-8 animate-auth-fade">
          <h1 className="font-headline font-bold text-3xl sm:text-4xl text-stone-900 tracking-tight">
            Let’s get your shop ready
          </h1>
          <p className="text-stone-600 text-sm sm:text-base mt-2 font-normal">
            Just the basics for now. You can add the rest later.
          </p>
        </div>

        {/* Card */}
        <div className="w-full max-w-[500px] animate-auth-card">
          <div className="bg-white/95 backdrop-blur-md border border-stone-200/90 rounded-2xl p-7 sm:p-9 shadow-xl shadow-stone-900/[0.04]">
            
            <form onSubmit={handleSubmit} className="space-y-6" noValidate>
              {/* Primary Focus: Shop Name */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="shopName" className="block text-sm font-semibold text-stone-900">
                    Shop Name <span className="text-[#C85A32] font-normal">*</span>
                  </label>
                  <span className="text-xs text-stone-400">Required</span>
                </div>

                <div className="relative">
                  <Store className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400 pointer-events-none" />
                  <input 
                    id="shopName"
                    required
                    autoFocus
                    type="text"
                    value={shopName}
                    onChange={(e) => {
                      setShopName(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="e.g. Downtown Pawn & Gold"
                    aria-invalid={!!error}
                    aria-describedby={error ? "shopName-error" : undefined}
                    className={`w-full h-14 bg-white text-stone-900 placeholder:text-stone-400 text-base sm:text-lg font-medium rounded-xl pl-12 pr-4 border ${
                      error
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
                        : 'border-stone-200 focus:border-[#C85A32] focus:ring-[#C85A32]/20'
                    } focus:ring-2 focus:outline-none shadow-xs transition-all duration-150`}
                  />
                </div>
                {error && (
                  <p id="shopName-error" role="alert" className="text-xs text-red-600 pl-1 pt-0.5">
                    {error}
                  </p>
                )}
              </div>

              {/* Optional Details Toggle Button */}
              <div className="pt-1">
                <button 
                  type="button"
                  onClick={() => setShowOptional(!showOptional)}
                  aria-expanded={showOptional}
                  aria-controls="optional-details-panel"
                  className="w-full py-2.5 px-3 rounded-xl border border-dashed border-stone-200 hover:border-stone-300 bg-stone-50/60 hover:bg-stone-50 text-left flex items-center justify-between transition-colors group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85A32]"
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-stone-700 group-hover:text-stone-900 transition-colors">
                      {showOptional ? 'Hide extra details' : 'Add more details now'}
                    </span>
                    <span className="text-[11px] text-stone-400">
                      Optional — you can do this later in settings
                    </span>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-stone-400 group-hover:text-stone-600 transition-transform duration-200 shrink-0 ${showOptional ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {/* Collapsible Optional Fields */}
              {showOptional && (
                <div 
                  id="optional-details-panel" 
                  className="space-y-4 pt-1 animate-auth-fade"
                >
                  {/* Shop Code & Store Phone */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="space-y-1.5">
                      <label htmlFor="shopCode" className="block text-xs font-semibold text-stone-700 flex items-center gap-1.5">
                        <Hash className="w-3.5 h-3.5 text-stone-400" />
                        <span>Shop Code</span>
                      </label>
                      <input 
                        id="shopCode"
                        type="text"
                        value={shopCode}
                        onChange={(e) => setShopCode(e.target.value.toUpperCase())}
                        placeholder="Auto-generated if empty"
                        className={`${getSubtleInputClass()} font-mono uppercase`}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="phone" className="block text-xs font-semibold text-stone-700 flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-stone-400" />
                        <span>Store Phone</span>
                      </label>
                      <input 
                        id="phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="011 123 4567"
                        className={getSubtleInputClass()}
                      />
                    </div>
                  </div>

                  {/* Store Email */}
                  <div className="space-y-1.5">
                    <label htmlFor="storeEmail" className="block text-xs font-semibold text-stone-700 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-stone-400" />
                      <span>Store Email</span>
                    </label>
                    <input 
                      id="storeEmail"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="shop@store.co.za"
                      className={getSubtleInputClass()}
                    />
                  </div>

                  {/* Physical Address */}
                  <div className="space-y-1.5">
                    <label htmlFor="address" className="block text-xs font-semibold text-stone-700 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-stone-400" />
                      <span>Physical Address</span>
                    </label>
                    <textarea 
                      id="address"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Street address..."
                      rows={2}
                      className="w-full bg-white text-stone-900 placeholder:text-stone-400 text-sm rounded-xl p-3 border border-stone-200 focus:border-[#C85A32] focus:ring-2 focus:ring-[#C85A32]/20 focus:outline-none transition-all duration-150 resize-none"
                    />
                  </div>

                  {/* City, Province, Postal Code */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <label htmlFor="city" className="block text-xs font-semibold text-stone-700 flex items-center gap-1.5">
                        <Building className="w-3 h-3 text-stone-400" />
                        <span>City</span>
                      </label>
                      <input 
                        id="city"
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="Johannesburg"
                        className={getSubtleInputClass()}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="province" className="block text-xs font-semibold text-stone-700">
                        Province
                      </label>
                      <input 
                        id="province"
                        type="text"
                        value={province}
                        onChange={(e) => setProvince(e.target.value)}
                        placeholder="Gauteng"
                        className={getSubtleInputClass()}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="postalCode" className="block text-xs font-semibold text-stone-700">
                        Postal Code
                      </label>
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
                </div>
              )}

              {/* Primary Action Button */}
              <div className="pt-2">
                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full h-13 bg-[#C85A32] hover:bg-[#B84E27] active:scale-[0.99] text-white font-semibold text-sm sm:text-base rounded-xl flex items-center justify-center gap-2.5 shadow-sm shadow-[#C85A32]/25 transition-all duration-150 disabled:opacity-50 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85A32] focus-visible:ring-offset-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Setting up shop...</span>
                    </>
                  ) : (
                    <>
                      <span>Set up my shop</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

              {/* Reassuring Note */}
              <div className="pt-1 text-center">
                <p className="text-xs text-stone-400">
                  You can update receipts, contact numbers, and address at any time in settings.
                </p>
              </div>
            </form>
          </div>
        </div>
      </main>

      {/* Subtle Footer */}
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
