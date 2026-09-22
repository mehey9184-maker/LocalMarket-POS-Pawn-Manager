import React, { useState, useMemo } from 'react';
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
  Receipt
} from 'lucide-react';
import { LoansLedger } from './LoansLedger';
import { OutrightBuysLedger } from './OutrightBuysLedger';
import { SapsRegister } from './SapsRegister';

export const Customers: React.FC = () => {
  const { customers, pawnLoans, setActiveCustomer, setActiveTab } = useApp();
  const { sellers, getSellerTransactions } = useSellers();
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
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#121212]">
      {/* Navigation Bar */}
      <div className="px-8 py-6 bg-[#1A1A1A] border-b border-[#2A2A2A] space-y-6 shrink-0">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white font-headline tracking-tight">Customer Relations</h2>
            <p className="text-gray-500 text-sm mt-1">Identity vault, compliance records and transaction history.</p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setActiveTab('buy-pawn')}
              className="px-4 py-2 bg-[#C85A32] text-white rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-[#b04d29] transition shadow-lg"
            >
              <PlusCircle className="w-4 h-4" />
              <span>New Client</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-6 overflow-x-auto no-scrollbar">
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
              className={`flex items-center gap-2.5 pb-3 border-b-2 transition-all whitespace-nowrap text-xs font-bold uppercase tracking-widest ${
                mode === t.id 
                  ? 'border-[#C85A32] text-[#E87A5D]' 
                  : 'border-transparent text-gray-500 hover:text-gray-300'
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
            <div className="p-8 border-b border-[#2A2A2A] bg-[#141414] shrink-0">
              <div className="relative max-w-xl">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input 
                  type="text" 
                  placeholder="Filter active pawn customers..." 
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full bg-[#121212] border border-[#2A2A2A] rounded-2xl pl-12 pr-4 py-3.5 text-sm text-white focus:border-[#C85A32] outline-none transition-all"
                />
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 no-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6">
                {filteredCustomers.map(customer => {
                  const activePawns = pawnLoans.filter(l => l.customerIdNumber === customer.idNumber && l.status === 'Active').length;
                  return (
                    <motion.div
                      key={customer.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-3xl p-6 hover:border-[#C85A32]/40 transition-all group cursor-pointer"
                      onClick={() => { setActiveCustomer(customer); setActiveTab('buy-pawn'); }}
                    >
                      <div className="flex items-start justify-between mb-6">
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 rounded-2xl bg-[#C85A32]/10 border border-[#C85A32]/20 flex items-center justify-center text-[#E87A5D] font-black text-xl group-hover:scale-110 transition-transform">
                            {customer.fullName.charAt(0)}
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-white group-hover:text-[#E87A5D] transition-colors">{customer.fullName}</h3>
                            <p className="text-xs text-gray-500 font-mono mt-0.5">{customer.idNumber}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 text-[9px] font-black uppercase border border-emerald-800/30">Pawn Client</span>
                          <span className="text-[10px] text-gray-600 font-mono mt-2">ID Verified</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mb-6">
                        <div className="p-3 bg-[#121212] rounded-2xl border border-[#2A2A2A]">
                          <span className="text-[9px] text-gray-500 font-black uppercase tracking-widest block mb-1">Active Pledges</span>
                          <div className="flex items-center gap-2">
                            <History className="w-3.5 h-3.5 text-blue-400" />
                            <span className="text-sm font-bold text-white">{activePawns}</span>
                          </div>
                        </div>
                        <div className="p-3 bg-[#121212] rounded-2xl border border-[#2A2A2A]">
                          <span className="text-[9px] text-gray-500 font-black uppercase tracking-widest block mb-1">Risk Score</span>
                          <div className="flex items-center gap-2">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-sm font-bold text-white">Low</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs text-gray-500 group-hover:text-white transition-colors">
                        <span className="font-mono">{customer.mobile}</span>
                        <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {mode === 'sellers' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-8 border-b border-[#2A2A2A] bg-[#141414] shrink-0">
              <div className="relative max-w-xl">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input 
                  type="text" 
                  placeholder="Search outright sellers history..." 
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full bg-[#121212] border border-[#2A2A2A] rounded-2xl pl-12 pr-4 py-3.5 text-sm text-white focus:border-[#C85A32] outline-none transition-all"
                />
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 no-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6">
                {filteredSellers.map(seller => (
                  <motion.div
                    key={seller.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-3xl p-6 hover:border-emerald-500/40 transition-all group cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-6">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-black text-xl group-hover:scale-110 transition-transform">
                          {seller.fullName.charAt(0)}
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors">{seller.fullName}</h3>
                          <p className="text-xs text-gray-500 font-mono mt-0.5">{seller.idNumber}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="px-2 py-0.5 rounded bg-emerald-950/40 text-emerald-400 text-[9px] font-black uppercase border border-emerald-800/30">Outright Seller</span>
                        <span className="text-[10px] text-gray-600 font-mono mt-2">Compliance ID Saved</span>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <div className="flex items-center gap-2">
                          <Receipt className="w-3.5 h-3.5" />
                          <span>Transaction History</span>
                        </div>
                        <span className="font-mono text-gray-400">{seller.mobile}</span>
                      </div>
                      
                      <div className="p-3 bg-[#121212] rounded-2xl border border-[#2A2A2A] text-[10px] text-gray-400">
                        Historical seller data linked to SAPS compliance records.
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-6 text-xs text-gray-500 group-hover:text-white transition-colors border-t border-[#2A2A2A] pt-4">
                      <span className="font-mono uppercase tracking-widest text-[9px]">View Deals</span>
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
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
