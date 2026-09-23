import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Package, 
  Lock, 
  Search, 
  AlertTriangle,
  ChevronRight,
  Filter,
  Plus,
  Archive,
  Info,
  MapPin,
  X,
  Tag,
  CheckCircle2,
  Calendar,
  Layers
} from 'lucide-react';
import { InventoryItem, AcquisitionType } from '../../types';

export const Inventory: React.FC = () => {
  const { inventory, setActiveTab, showToast } = useApp();
  const [tab, setTab] = useState<'floor' | 'vault' | 'pending'>('floor');
  const [acquisitionFilter, setAcquisitionFilter] = useState<'All' | AcquisitionType>('All');
  const [search, setSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);

  const floorItems = inventory.filter(i => i.status === 'Retail Floor');
  const vaultItems = inventory.filter(i => i.status === 'Vault Hold' || i.status === 'Forfeited');
  const pendingItems = inventory.filter(i => i.status === 'Reserved' || i.status === 'Flagged');

  const activeCategoryList = tab === 'floor' ? floorItems : tab === 'vault' ? vaultItems : pendingItems;

  const filteredItems = activeCategoryList
    .filter(i => {
      if (acquisitionFilter !== 'All' && i.acquisitionType !== acquisitionFilter) {
        return false;
      }
      const q = search.toLowerCase();
      return (
        i.title.toLowerCase().includes(q) ||
        i.sku.toLowerCase().includes(q) ||
        (i.serialOrImei && i.serialOrImei.toLowerCase().includes(q)) ||
        (i.brand && i.brand.toLowerCase().includes(q)) ||
        (i.category && i.category.toLowerCase().includes(q))
      );
    });

  const getAcquisitionBadge = (type: AcquisitionType) => {
    switch (type) {
      case 'Existing Stock':
        return {
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          label: 'Existing Stock'
        };
      case 'Buy':
        return {
          bg: 'bg-[#FDF0EA] text-[#C85A32] border-[#C85A32]/20',
          label: 'Buy (Seller)'
        };
      case 'Pawn':
        return {
          bg: 'bg-blue-50 text-blue-700 border-blue-200',
          label: 'Pawn Pledge'
        };
      case 'Forfeited':
      case 'Forfeit':
        return {
          bg: 'bg-purple-50 text-purple-700 border-purple-200',
          label: 'Forfeited Pawn'
        };
      default:
        return {
          bg: 'bg-gray-100 text-gray-700 border-gray-200',
          label: type
        };
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#F5F6F8]">
      {/* Header Bar */}
      <div className="px-6 lg:px-8 py-5 bg-white border-b border-gray-200 shrink-0 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">Stock & Asset Management</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Live inventory of retail merchandise, existing stock, and vaulted collateral.
            </p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* SEARCH */}
            <div className="relative flex-1 sm:w-72">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search SKU, Title, Serial..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-[#F8F9FA] border border-gray-200 rounded-xl pl-9 pr-3.5 py-2 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#C85A32] focus:bg-white transition-all"
              />
            </div>

            {/* ADD STOCK BUTTON */}
            <button
              onClick={() => setActiveTab('buy-pawn')}
              className="flex items-center gap-2 px-4 py-2 bg-[#C85A32] text-white rounded-xl text-xs font-semibold shadow-xs hover:bg-[#A94725] transition shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Add Stock</span>
            </button>
          </div>
        </div>

        {/* STATUS TABS & PROVENANCE FILTER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 bg-[#F3F4F6] p-1 rounded-xl border border-gray-200/80 self-start">
            {[
              { id: 'floor', label: 'Retail Floor', count: floorItems.length, icon: Package },
              { id: 'vault', label: 'Secure Vault', count: vaultItems.length, icon: Lock },
              { id: 'pending', label: 'Flagged / Review', count: pendingItems.length, icon: AlertTriangle }
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id as any)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-all ${
                  tab === t.id 
                    ? 'bg-white text-gray-900 font-semibold shadow-xs border border-gray-200/60' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                }`}
              >
                <t.icon className="w-3.5 h-3.5 text-gray-500" />
                <span>{t.label}</span>
                <span className="font-mono text-[11px] text-gray-400">({t.count})</span>
              </button>
            ))}
          </div>

          {/* Acquisition Filter */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-gray-500 flex items-center gap-1">
              <Filter className="w-3 h-3 text-gray-400" />
              Source:
            </span>
            <select
              value={acquisitionFilter}
              onChange={e => setAcquisitionFilter(e.target.value as any)}
              className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-700 font-medium focus:outline-none focus:border-[#C85A32]"
            >
              <option value="All">All Provenance ({activeCategoryList.length})</option>
              <option value="Existing Stock">Existing Stock</option>
              <option value="Buy">Buy From Person</option>
              <option value="Pawn">Pawn Collateral</option>
              <option value="Forfeited">Forfeited Pawn</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grid Content */}
      <div className="flex-1 overflow-y-auto p-6 lg:p-8 no-scrollbar">
        {filteredItems.length === 0 ? (
          <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center p-8 bg-white border border-gray-200 rounded-2xl">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 mb-3">
              <Archive className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-gray-800">No stock found</p>
            <p className="text-xs text-gray-500 mt-1 max-w-sm">
              No items match your active filters or search criteria.
            </p>
            <button
              onClick={() => setActiveTab('buy-pawn')}
              className="mt-4 flex items-center gap-1.5 px-4 py-2 bg-[#C85A32] text-white rounded-xl text-xs font-semibold hover:bg-[#A94725] transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Stock Now</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
            {filteredItems.map(item => {
              const badge = getAcquisitionBadge(item.acquisitionType);
              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => setSelectedItem(item)}
                  className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:border-[#C85A32]/60 hover:shadow-md transition-all group cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    {/* Image Preview & Badges */}
                    <div className="aspect-video relative overflow-hidden bg-gray-100">
                      <img 
                        src={item.imageUrl} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                        alt={item.title} 
                      />
                      <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-md bg-white/90 backdrop-blur-xs text-[10px] font-bold text-gray-800 font-mono shadow-xs">
                          {item.sku}
                        </span>
                      </div>

                      <div className="absolute top-2.5 right-2.5">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border backdrop-blur-xs shadow-xs ${badge.bg}`}>
                          {badge.label}
                        </span>
                      </div>

                      {item.status === 'Flagged' && (
                        <div className="absolute bottom-2 left-2.5 px-2 py-0.5 rounded bg-red-600 text-white text-[9px] font-bold uppercase shadow-sm">
                          SAPS Flagged
                        </div>
                      )}
                    </div>

                    {/* Card Body */}
                    <div className="p-4 space-y-2">
                      <div className="flex items-center justify-between text-[11px] text-gray-400 font-medium">
                        <span>{item.category}</span>
                        <span className="font-mono">{item.condition}</span>
                      </div>

                      <h3 className="text-sm font-semibold text-gray-900 line-clamp-1 group-hover:text-[#C85A32] transition-colors">
                        {item.title}
                      </h3>

                      <div className="text-[11px] text-gray-500 flex items-center justify-between">
                        <span className="font-mono truncate max-w-[140px]">
                          {item.serialOrImei ? `SN: ${item.serialOrImei}` : 'No serial recorded'}
                        </span>
                        {item.stockLocation && (
                          <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                            <MapPin className="w-2.5 h-2.5" />
                            {item.stockLocation}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card Footer: Price & Details Action */}
                  <div className="px-4 py-3 bg-[#F8F9FA] border-t border-gray-100 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase font-semibold block">Retail Price</span>
                      <span className="text-sm font-bold text-gray-900 font-mono">
                        R {item.retailPrice.toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-xs font-semibold text-[#C85A32] group-hover:translate-x-0.5 transition-transform">
                      <span>View</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* DETAIL MODAL WITH FULL PROVENANCE */}
      <AnimatePresence>
        {selectedItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-gray-200 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl space-y-0"
            >
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-[#F8F9FA]">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-900 font-mono">{selectedItem.sku}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${getAcquisitionBadge(selectedItem.acquisitionType).bg}`}>
                    {selectedItem.acquisitionType}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
                <div className="flex gap-4">
                  <div className="w-24 h-24 rounded-xl bg-gray-100 overflow-hidden shrink-0 border border-gray-200">
                    <img src={selectedItem.imageUrl} alt={selectedItem.title} className="w-full h-full object-cover" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-gray-900 leading-snug">{selectedItem.title}</h3>
                    <p className="text-xs text-gray-500">{selectedItem.category} · {selectedItem.condition} condition</p>
                    <p className="text-xs font-mono text-gray-600 mt-1">Serial / IMEI: {selectedItem.serialOrImei || 'N/A'}</p>
                  </div>
                </div>

                {/* PROVENANCE CARD */}
                <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-2 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-gray-800">
                    <Info className="w-4 h-4 text-[#C85A32]" />
                    <span>Provenance & Acquisition Source</span>
                  </div>
                  <p className="text-gray-600 leading-relaxed">
                    {selectedItem.sourceNote || 
                     (selectedItem.acquisitionType === 'Existing Stock' 
                       ? 'Item was already owned by the shop before LocalMarket onboarding. No fabricated seller identity.' 
                       : `Acquired via ${selectedItem.acquisitionType} transaction.`)}
                  </p>
                  {selectedItem.internalNote && (
                    <p className="text-gray-500 italic pt-1 border-t border-gray-200">
                      Internal note: {selectedItem.internalNote}
                    </p>
                  )}
                </div>

                {/* FINANCIAL METRICS */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-[#F8F9FA] border border-gray-200">
                    <span className="text-gray-400 block font-medium">Retail Selling Price</span>
                    <span className="text-base font-bold text-gray-900 font-mono mt-0.5 block">
                      R {selectedItem.retailPrice.toLocaleString()}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-[#F8F9FA] border border-gray-200">
                    <span className="text-gray-400 block font-medium">Cost Basis</span>
                    <span className="text-base font-bold text-gray-700 font-mono mt-0.5 block">
                      R {selectedItem.costBasis ? selectedItem.costBasis.toLocaleString() : '0.00'}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-[#F8F9FA] border border-gray-200">
                    <span className="text-gray-400 block font-medium">Current Status</span>
                    <span className="text-xs font-bold text-gray-800 mt-0.5 block">
                      {selectedItem.status}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-[#F8F9FA] border border-gray-200">
                    <span className="text-gray-400 block font-medium">Storage Location</span>
                    <span className="text-xs font-bold text-gray-800 mt-0.5 block">
                      {selectedItem.stockLocation || selectedItem.vaultLocation || 'Main Display'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="px-6 py-3.5 border-t border-gray-100 bg-[#F8F9FA] flex justify-end">
                <button
                  onClick={() => setSelectedItem(null)}
                  className="px-4 py-2 bg-gray-900 text-white rounded-xl text-xs font-semibold hover:bg-gray-800 transition"
                >
                  Close Details
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
