import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { shopProfilesApi } from '../../services/supabaseApi';
import { Loader2, Store, MapPin, Phone, Mail, Globe, CheckCircle2 } from 'lucide-react';

export const ShopSetup: React.FC = () => {
  const { showToast, setActiveTab } = useApp();
  const { refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);

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
    setLoading(true);

    try {
      const newShop = await shopProfilesApi.createShopProfile({
        shop_name: shopName,
        shop_code: shopCode.toUpperCase() || shopName.slice(0, 3).toUpperCase(),
        phone,
        email,
        address,
        city,
        province,
        postal_code: postalCode,
        currency: 'ZAR', // Default for now
        is_active: true,
        metadata: {}
      });

      if (newShop) {
        showToast('Shop Created', 'Your shop has been set up successfully.', 'success');
        await refreshProfile();
        setActiveTab('home');
      }
    } catch (err: any) {
      console.error('[ShopSetup] Error:', err);
      showToast('Setup Failed', err.message || 'Failed to create shop profile', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 min-h-screen bg-[#F5F6F8] flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="bg-white border border-gray-200 rounded-2xl p-8 sm:p-10 shadow-sm">
          
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-16 h-16 bg-[#FDF0EA] rounded-full flex items-center justify-center mb-4">
              <Store className="w-8 h-8 text-[#c85a32]" />
            </div>
            <h1 className="font-bold text-2xl text-gray-900 tracking-tight">
              Set up your shop
            </h1>
            <p className="text-sm text-gray-500 mt-2 max-w-md">
              Welcome to LocalMarket! Let's get your store details recorded. You can update these later in settings.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Shop Identity */}
              <div className="space-y-4 sm:col-span-2">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Store Identity</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-gray-500">Shop Name</label>
                    <input 
                      required
                      type="text"
                      value={shopName}
                      onChange={(e) => setShopName(e.target.value)}
                      placeholder="e.g. Downtown Pawn & Gold"
                      className="w-full h-11 bg-white border border-gray-300 rounded-lg px-4 text-sm focus:outline-none focus:ring-1 focus:ring-[#c85a32] focus:border-[#c85a32] transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-gray-500">Shop Code (Unique ID)</label>
                    <input 
                      required
                      type="text"
                      value={shopCode}
                      onChange={(e) => setShopCode(e.target.value.toUpperCase())}
                      placeholder="e.g. DT01"
                      className="w-full h-11 bg-white border border-gray-300 rounded-lg px-4 text-sm focus:outline-none focus:ring-1 focus:ring-[#c85a32] focus:border-[#c85a32] transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div className="space-y-4 sm:col-span-2 pt-4 border-t border-gray-100">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Contact Details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-gray-500">Phone Number</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input 
                        required
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="011 123 4567"
                        className="w-full h-11 bg-white border border-gray-300 rounded-lg pl-10 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-[#c85a32] focus:border-[#c85a32] transition-colors"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-gray-500">Store Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input 
                        required
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="contact@store.co.za"
                        className="w-full h-11 bg-white border border-gray-300 rounded-lg pl-10 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-[#c85a32] focus:border-[#c85a32] transition-colors"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Address */}
              <div className="space-y-4 sm:col-span-2 pt-4 border-t border-gray-100">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Store Location</h3>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-gray-500">Physical Address</label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                      <textarea 
                        required
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="123 Main Street, Central District"
                        rows={2}
                        className="w-full bg-white border border-gray-300 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#c85a32] focus:border-[#c85a32] transition-colors resize-none"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-gray-500">City</label>
                      <input 
                        required
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="Johannesburg"
                        className="w-full h-11 bg-white border border-gray-300 rounded-lg px-4 text-sm focus:outline-none focus:ring-1 focus:ring-[#c85a32] focus:border-[#c85a32] transition-colors"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-gray-500">Province</label>
                      <input 
                        required
                        type="text"
                        value={province}
                        onChange={(e) => setProvince(e.target.value)}
                        placeholder="Gauteng"
                        className="w-full h-11 bg-white border border-gray-300 rounded-lg px-4 text-sm focus:outline-none focus:ring-1 focus:ring-[#c85a32] focus:border-[#c85a32] transition-colors"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-gray-500">Postal Code</label>
                      <input 
                        required
                        type="text"
                        value={postalCode}
                        onChange={(e) => setPostalCode(e.target.value)}
                        placeholder="2000"
                        className="w-full h-11 bg-white border border-gray-300 rounded-lg px-4 text-sm focus:outline-none focus:ring-1 focus:ring-[#c85a32] focus:border-[#c85a32] transition-colors"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-[#c85a32] hover:bg-[#b84e27] text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50 mt-4 shadow-sm"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Complete Setup</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
