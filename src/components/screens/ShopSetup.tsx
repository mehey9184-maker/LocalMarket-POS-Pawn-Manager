import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { shopProfilesApi } from '../../services/supabaseApi';
import { Loader2, Store, MapPin, Phone, Mail, Globe, CheckCircle2 } from 'lucide-react';

export const ShopSetup: React.FC = () => {
  const { showToast, setActiveTab } = useApp();
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopName.trim()) {
      showToast('Required Field', 'Please enter your shop name.', 'amber');
      return;
    }

    setLoading(true);

    try {
      const res = await shopProfilesApi.initializeNewShop({
        shop_name: shopName.trim(),
        shop_code: shopCode.trim().toUpperCase() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        city: city.trim() || undefined,
        province: province.trim() || undefined,
        postal_code: postalCode.trim() || undefined
      });

      if (res.success) {
        showToast('Shop Initialized', 'Your shop has been set up successfully.', 'success');
        await refreshProfile();
        // The App.tsx useEffect will handle redirection to home once shop_id is detected in profile
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

  return (
    <div className="flex-1 min-h-screen bg-[#F5F6F8] flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="bg-white border border-gray-200 rounded-3xl p-8 sm:p-12 shadow-sm">
          
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-16 h-16 bg-[#FDF0EA] rounded-2xl flex items-center justify-center mb-5">
              <Store className="w-8 h-8 text-[#c85a32]" />
            </div>
            <h1 className="font-bold text-2xl text-gray-900 tracking-tight">
              Let's get your shop ready
            </h1>
            <p className="text-sm text-gray-500 mt-2 max-w-xs leading-relaxed">
              Just the basics for now. You can add more business details later in settings.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="space-y-6">
              {/* Primary Field */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest pl-1">Shop Name</label>
                <input 
                  required
                  autoFocus
                  type="text"
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  placeholder="e.g. Downtown Pawn & Gold"
                  className="w-full h-14 bg-white border border-gray-300 rounded-2xl px-6 text-lg font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#c85a32]/20 focus:border-[#c85a32] transition-all placeholder:text-gray-400 shadow-sm"
                />
              </div>

              {/* Toggle Optional Fields */}
              <button 
                type="button"
                onClick={() => setShowOptional(!showOptional)}
                className="text-sm font-bold text-[#c85a32] hover:text-[#b84e27] flex items-center gap-2 transition-colors pl-1"
              >
                {showOptional ? 'Hide optional details' : 'Add location & contact details (optional)'}
                <Globe className={`w-4 h-4 transition-transform duration-300 ${showOptional ? 'rotate-180' : ''}`} />
              </button>

              {showOptional && (
                <div className="space-y-6 pt-2 animate-in fade-in zoom-in-95 duration-300">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest pl-1">Shop Code</label>
                      <input 
                        type="text"
                        value={shopCode}
                        onChange={(e) => setShopCode(e.target.value.toUpperCase())}
                        placeholder="Auto-generated if empty"
                        className="w-full h-11 bg-white border border-gray-300 rounded-xl px-4 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#c85a32] transition-all font-mono placeholder:text-gray-400"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest pl-1">Store Phone</label>
                      <input 
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="011 123 4567"
                        className="w-full h-11 bg-white border border-gray-300 rounded-xl px-4 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#c85a32] transition-all placeholder:text-gray-400"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest pl-1">Physical Address</label>
                    <textarea 
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Street address..."
                      rows={2}
                      className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#c85a32] transition-all resize-none placeholder:text-gray-400"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest pl-1">City</label>
                      <input 
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className="w-full h-11 bg-white border border-gray-300 rounded-xl px-4 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#c85a32] transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest pl-1">Province</label>
                      <input 
                        type="text"
                        value={province}
                        onChange={(e) => setProvince(e.target.value)}
                        className="w-full h-11 bg-white border border-gray-300 rounded-xl px-4 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#c85a32] transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest pl-1">Postal</label>
                      <input 
                        type="text"
                        value={postalCode}
                        onChange={(e) => setPostalCode(e.target.value)}
                        className="w-full h-11 bg-white border border-gray-300 rounded-xl px-4 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#c85a32] transition-all"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full h-14 bg-[#c85a32] hover:bg-[#b84e27] text-white font-bold rounded-2xl flex items-center justify-center gap-3 transition-all disabled:opacity-50 mt-6 shadow-lg shadow-[#c85a32]/10 active:scale-[0.98]"
            >
              {loading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Set up my shop</span>
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] text-gray-400 mt-8 uppercase tracking-[0.2em]">
          Powered by LocalMarket
        </p>
      </div>
    </div>
  );
};
