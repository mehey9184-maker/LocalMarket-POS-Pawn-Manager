import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useSellers } from '../../context/SellerContext';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Search, 
  History, 
  ShieldCheck, 
  ShoppingBag,
  CreditCard,
  PlusCircle,
  ChevronRight,
  ExternalLink,
  Store,
  UserCheck,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { LoansLedger } from './LoansLedger';
import { OutrightBuysLedger } from './OutrightBuysLedger';
import { SapsRegister } from './SapsRegister';
import { useAuth } from '../../context/AuthContext';

export const Customers: React.FC = () => {
  const { customers, pawnLoans, setActiveCustomer, setActiveTab, refreshCustomers, customerSyncStatus } = useApp();
  const { shopId } = useAuth();
  const { sellers } = useSellers();
  const [mode, setMode] = useState<'list' | 'sellers' | 'loans' | 'buys' | 'saps'>('list');
  const [search, setSearch] = useState('');

  const filteredCustomers = customers.filter(c => 
    c.fullName.toLowerCase().includes(search.toLowerCase()) || 
    c.idNumber.includes(search)
  );

  const filteredSellers = sellers.filter(s => 
    s.fullName.toLowerCase().includes(search.toLowerCase()) || 
    s.idNumber.includes(search)
  );

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#F5F6F8]">
      {/* Navigation Bar */}
      <div className="px-6 lg:px-8 py-5 bg-white border-b border-gray-200 space-y-4 shrink-0 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">Customer & Seller Relations</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Verified identity register, pawn borrowers, outright sellers, and SAPS Form 21 records.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setActiveTab('buy-pawn')}
              className="px-4 py-2 bg-[#C85A32] text-white rounded-xl text-xs font-semibold flex items-center gap-2 hover:bg-[#A94725] transition shadow-xs"
            >
              <PlusCircle className="w-4 h-4" />
              <span>New Client Intake</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4 overflow-x-auto no-scrollbar border-t border-gray-100 pt-3">
          {[
            { id: 'list', label: 'Pawn Customers', icon: UserCheck },
            { id: 'sellers', label: 'Seller Directory', icon: Store },
            { id: 'loans', label: 'Pawn Ledger (NCR)', icon: History },
            { id: 'buys', label: 'Buy Registry', icon: ShoppingBag },
            { id: 'saps', label: 'SAPS Form 21', icon: ShieldCheck }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setMode(t.id as any)}
              className={`flex items-center gap-2 pb-2.5 border-b-2 transition-all whitespace-nowrap text-xs font-semibold ${
                mode === t.id 
                  ? 'border-[#C85A32] text-[#C85A32]' 
                  : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
            >
              <t.icon className="w-4 h-4" />
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {mode === 'list' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-5 border-b border-gray-200 bg-white shrink-0">
              <div className="relative max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Search pawn customers by name or ID..." 
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full bg-[#F8F9FA] border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-gray-900 focus:border-[#C85A32] focus:bg-white outline-none transition-all"
                />
              </div>
            </div>

            {!shopId && (
              <div className="p-4 mx-6 lg:mx-8 mt-5 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-between text-xs text-amber-800 shrink-0">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>No shop branch assigned to this profile. Please switch to an authorized shop branch.</span>
                </div>
              </div>
            )}

            {customerSyncStatus.error && (
              <div className="p-4 mx-6 lg:mx-8 mt-5 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-between text-xs text-red-800 shrink-0">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>Cloud sync note: {customerSyncStatus.error}</span>
                </div>
                <button
                  type="button"
                  onClick={() => refreshCustomers()}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry</span>
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-6 lg:p-8 no-scrollbar">
              {customerSyncStatus.isLoading && customers.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-8 text-center text-gray-500">
                  <RefreshCw className="w-8 h-8 text-[#C85A32] animate-spin mb-3" />
                  <p className="font-bold text-sm text-gray-800">Restoring Customer Directory</p>
                  <p className="text-xs text-gray-500 mt-1">Hydrating pawn client records from Supabase cloud...</p>
                </div>
              ) : filteredCustomers.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-8 text-center text-gray-400">
                  <UserCheck className="w-12 h-12 text-gray-300 mb-3" />
                  <p className="font-bold text-sm text-gray-700">No Customers Found</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {search ? `No customer matches "${search}"` : 'No pawn clients registered for this shop branch yet.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-5">
                  {filteredCustomers.map(customer => {
                    const activePawns = pawnLoans.filter(l => l.customerIdNumber === customer.idNumber && l.status === 'Active').length;
                    return (
                      <motion.div
                        key={customer.id}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="bg-white border border-gray-200 rounded-2xl p-5 hover:border-[#C85A32] hover:shadow-md transition-all group cursor-pointer flex flex-col justify-between"
                        onClick={() => { setActiveCustomer(customer); setActiveTab('buy-pawn'); }}
                      >
                        <div>
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-xl bg-[#FDF0EA] text-[#C85A32] flex items-center justify-center font-bold text-lg group-hover:scale-105 transition-transform">
                                {customer.fullName.charAt(0)}
                              </div>
                              <div>
                                <h3 className="text-sm font-bold text-gray-900 group-hover:text-[#C85A32] transition-colors">{customer.fullName}</h3>
                                <p className="text-xs text-gray-500 font-mono mt-0.5">{customer.idNumber}</p>
                              </div>
                            </div>
                            <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-semibold border border-blue-200">
                              Pawn Client
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-3 mb-4">
                            <div className="p-3 bg-[#F8F9FA] rounded-xl border border-gray-100">
                              <span className="text-[10px] text-gray-400 font-semibold uppercase block mb-0.5">Active Pledges</span>
                              <div className="flex items-center gap-1.5">
                                <History className="w-3.5 h-3.5 text-blue-600" />
                                <span className="text-xs font-bold text-gray-800">{activePawns}</span>
                              </div>
                            </div>
                            <div className="p-3 bg-[#F8F9FA] rounded-xl border border-gray-100">
                              <span className="text-[10px] text-gray-400 font-semibold uppercase block mb-0.5">Compliance</span>
                              <div className="flex items-center gap-1.5">
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                                <span className="text-xs font-bold text-emerald-700">Verified</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs text-gray-500 pt-3 border-t border-gray-100">
                          <span className="font-mono text-[11px]">{customer.mobile}</span>
                          <div className="flex items-center gap-1 text-[#C85A32] font-semibold text-xs group-hover:translate-x-0.5 transition-transform">
                            <span>Open Profile</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {mode === 'sellers' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-5 border-b border-gray-200 bg-white shrink-0">
              <div className="relative max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Search outright sellers by name or ID..." 
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full bg-[#F8F9FA] border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-gray-900 focus:border-[#C85A32] focus:bg-white outline-none transition-all"
                />
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 lg:p-8 no-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-5">
                {filteredSellers.map(seller => (
                  <motion.div
                    key={seller.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="bg-white border border-gray-200 rounded-2xl p-5 hover:border-[#C85A32] hover:shadow-md transition-all group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-orange-50 text-[#C85A32] flex items-center justify-center font-bold text-lg group-hover:scale-105 transition-transform">
                            {seller.fullName.charAt(0)}
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-gray-900 group-hover:text-[#C85A32] transition-colors">{seller.fullName}</h3>
                            <p className="text-xs text-gray-500 font-mono mt-0.5">{seller.idNumber}</p>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-orange-50 text-[#C85A32] text-[10px] font-semibold border border-orange-200">
                          Outright Seller
                        </span>
                      </div>

                      <div className="p-3 bg-[#F8F9FA] rounded-xl border border-gray-100 space-y-1 text-xs mb-4">
                        <div className="flex items-center justify-between text-gray-600">
                          <span>Phone:</span>
                          <span className="font-mono text-gray-800">{seller.mobile}</span>
                        </div>
                        <div className="flex items-center justify-between text-gray-600">
                          <span>Address:</span>
                          <span className="truncate max-w-[180px] text-gray-800">{seller.address}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-gray-100 text-xs">
                      <span className="text-[11px] text-gray-400 font-semibold uppercase">Form 21 Registered</span>
                      <div className="flex items-center gap-1 text-[#C85A32] font-semibold group-hover:translate-x-0.5 transition-transform">
                        <span>New Deal</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        )}

        {mode === 'loans' && <div className="flex-1 overflow-hidden"><LoansLedger /></div>}
        {mode === 'buys' && <div className="flex-1 overflow-hidden"><OutrightBuysLedger /></div>}
        {mode === 'saps' && <div className="flex-1 overflow-hidden"><SapsRegister /></div>}
      </div>
    </div>
  );
};
