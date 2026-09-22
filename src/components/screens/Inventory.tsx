import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { motion } from 'motion/react';
import { 
  Package, 
  Lock, 
  Search, 
  ArrowRightLeft, 
  AlertTriangle,
  ChevronRight,
  Filter,
  Layers,
  Archive
} from 'lucide-react';

export const Inventory: React.FC = () => {
  const { inventory, showToast } = useApp();
  const [tab, setTab] = useState<'floor' | 'vault' | 'pending'>('floor');
  const [search, setSearch] = useState('');

  const floorItems = inventory.filter(i => i.status === 'Retail Floor');
  const vaultItems = inventory.filter(i => i.status === 'Vault Hold' || i.status === 'Forfeited');
  const pendingItems = inventory.filter(i => i.status === 'Reserved' || i.status === 'Flagged');

  const filteredItems = (tab === 'floor' ? floorItems : tab === 'vault' ? vaultItems : pendingItems)
    .filter(i => i.title.toLowerCase().includes(search.toLowerCase()) || i.sku.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#121212]">
      {/* Header & Tabs */}
      <div className="px-8 py-6 bg-[#1A1A1A] border-b border-[#2A2A2A] flex flex-col gap-6 shrink-0">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white font-headline tracking-tight">Stock & Asset Management</h2>
            <p className="text-gray-500 text-sm mt-1">Global registry of retail stock, collateral, and restricted assets.</p>
          </div>
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input 
              type="text" 
              placeholder="Search by SKU, Serial or Title..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-[#121212] border border-[#2A2A2A] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:border-[#C85A32] outline-none transition-all"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 bg-[#121212] p-1 rounded-xl border border-[#2A2A2A] self-start">
          {[
            { id: 'floor', label: 'Retail Floor', count: floorItems.length, icon: Package },
            { id: 'vault', label: 'Secure Vault', count: vaultItems.length, icon: Lock },
            { id: 'pending', label: 'Admin Review', count: pendingItems.length, icon: AlertTriangle }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className={`px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-widest flex items-center gap-2.5 transition-all ${
                tab === t.id 
                  ? 'bg-[#C85A32] text-white shadow-lg shadow-[#C85A32]/20' 
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <t.icon className="w-3.5 h-3.5" />
              <span>{t.label}</span>
              <span className="opacity-40 font-mono">[{t.count}]</span>
            </button>
          ))}
        </div>
      </div>

      {/* Grid Content */}
      <div className="flex-1 overflow-y-auto p-8 no-scrollbar">
        {filteredItems.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center opacity-30">
            <Archive className="w-16 h-16 mb-4" />
            <p className="text-lg font-bold">No assets found</p>
            <p className="text-sm">Try broadening your search or switching tabs.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
            {filteredItems.map(item => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl overflow-hidden hover:border-[#383838] transition-all group"
              >
                <div className="aspect-video relative overflow-hidden bg-black/40">
                  <img src={item.imageUrl} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt="" />
                  <div className="absolute top-3 left-3 flex gap-2">
                    <span className="px-2 py-0.5 rounded bg-black/60 backdrop-blur-md text-[9px] font-bold text-gray-300 border border-white/10 uppercase tracking-tighter">#{item.sku}</span>
                  </div>
                  {item.status === 'Flagged' && (
                    <div className="absolute top-3 right-3 px-2 py-0.5 rounded bg-red-600 text-white text-[9px] font-black uppercase shadow-lg">SAPS ALERT</div>
                  )}
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-gray-100 truncate">{item.title}</h3>
                    <p className="text-[11px] text-gray-500 mt-0.5 font-mono">{item.serialOrImei}</p>
                  </div>
                  
                  <div className="flex items-center justify-between pt-4 border-t border-[#2A2A2A]">
                    <div className="space-y-0.5">
                      <span className="text-[10px] text-gray-500 uppercase font-black tracking-tighter block">Retail Price</span>
                      <span className="text-sm font-bold text-[#E87A5D] font-mono">R {item.retailPrice.toLocaleString()}</span>
                    </div>
                    <button className="p-2 rounded-xl bg-[#121212] border border-[#2A2A2A] text-gray-500 hover:text-white hover:border-[#C85A32] transition">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
