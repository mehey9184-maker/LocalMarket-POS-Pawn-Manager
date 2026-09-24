import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useInventory } from '../../context/InventoryContext';
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
  Layers,
  Edit2,
  Check
} from 'lucide-react';
import { InventoryItem, AcquisitionType } from '../../types';

export const Inventory: React.FC = () => {
  const { inventory, setActiveTab, showToast } = useApp();
  const { isManager, isOwner } = useAuth();
  const { changePermanentRetailPrice } = useInventory();

  const [tab, setTab] = useState<'floor' | 'vault' | 'pending'>('floor');
  const [acquisitionFilter, setAcquisitionFilter] = useState<'All' | AcquisitionType>('All');
  const [search, setSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);

  // Price alteration state
  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [newPriceValue, setNewPriceValue] = useState('');
  const [priceChangeReason, setPriceChangeReason] = useState('');
  const [isSavingPrice, setIsSavingPrice] = useState(false);

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

  const handleOpenItem = (item: InventoryItem) => {
    setSelectedItem(item);
    setIsEditingPrice(false);
    setNewPriceValue(item.retailPrice.toString());
    setPriceChangeReason('');
  };

  const handleSavePriceChange = async () => {
    if (!selectedItem) return;
    const p = parseFloat(newPriceValue);
    if (isNaN(p) || p < 0) {
      showToast('Invalid Price', 'Please provide a valid non-negative retail price.', 'amber');
      return;
    }

    setIsSavingPrice(true);
    try {
      const res = await changePermanentRetailPrice(
        selectedItem.id,
        p,
        priceChangeReason || 'Manager Price Adjustment'
      );

      if (res.success) {
        showToast('Retail Price Updated', `New price: R ${p.toLocaleString()}`, 'success');
        setSelectedItem({ ...selectedItem, retailPrice: p });
        setIsEditingPrice(false);
      } else {
        showToast('Price Update Failed', res.error || 'Unauthorized or RPC error.', 'error');
      }
    } finally {
      setIsSavingPrice(false);
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

            {/* VAULT MANAGER BUTTON */}
            <button
              onClick={() => setActiveTab('vault')}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-xl text-xs font-semibold shadow-xs hover:bg-amber-500 transition shrink-0"
            >
              <Lock className="w-4 h-4" />
              <span>Vault Manager</span>
            </button>

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
          <div className="flex items-center gap-1.5 p-1 bg-[#F5F6F8] rounded-xl border border-gray-200/80 w-fit">
            <button
              onClick={() => setTab('floor')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85A32] focus-visible:ring-offset-2 ${
                tab === 'floor' 
                  ? 'bg-white text-gray-900' 
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <Package className="w-3.5 h-3.5 text-[#C85A32]" />
              <span>Retail Floor</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-gray-100 font-mono text-gray-600">
                {floorItems.length}
              </span>
            </button>

            <button
              onClick={() => setTab('vault')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85A32] focus-visible:ring-offset-2 ${
                tab === 'vault' 
                  ? 'bg-white text-gray-900' 
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <Lock className="w-3.5 h-3.5 text-blue-600" />
              <span>Vault / Pledged</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-gray-100 font-mono text-gray-600">
                {vaultItems.length}
              </span>
            </button>

            <button
              onClick={() => setTab('pending')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85A32] focus-visible:ring-offset-2 ${
                tab === 'pending' 
                  ? 'bg-white text-gray-900' 
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              <span>Reserved / Flagged</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-gray-100 font-mono text-gray-600">
                {pendingItems.length}
              </span>
            </button>
          </div>

          {/* Acquisition Provenance Filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider pl-1 mr-1">Source:</span>
            {(['All', 'Existing Stock', 'Buy', 'Pawn', 'Forfeited'] as const).map(acq => (
              <button
                key={acq}
                onClick={() => setAcquisitionFilter(acq as any)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition whitespace-nowrap ${
                  acquisitionFilter === acq
                    ? 'bg-gray-900 text-white font-semibold'
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {acq}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Item List Grid */}
      <div className="flex-1 overflow-y-auto p-6 lg:p-8">
        {filteredItems.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <Package className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-sm font-semibold text-gray-800">No stock items found</p>
            <p className="text-xs text-gray-400 mt-1 max-w-sm">
              No inventory entries match your active category and acquisition filter.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredItems.map(item => {
              const badge = getAcquisitionBadge(item.acquisitionType);
              return (
                <motion.div
                  key={item.id}
                  layout
                  onClick={() => handleOpenItem(item)}
                  className="bg-white border border-gray-200 hover:border-[#C85A32] rounded-2xl p-4 flex flex-col justify-between transition cursor-pointer group shadow-xs hover:shadow-md"
                >
                  <div className="space-y-3">
                    <div className="aspect-square rounded-xl bg-gray-100 overflow-hidden relative border border-gray-100">
                      <img 
                        src={item.imageUrl} 
                        alt={item.title} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                      />
                      <span className={`absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-bold border backdrop-blur-xs ${badge.bg}`}>
                        {badge.label}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-mono text-gray-400 font-semibold">{item.sku}</span>
                      <h3 className="text-xs font-bold text-gray-900 line-clamp-1 mt-0.5">{item.title}</h3>
                      <p className="text-[11px] text-gray-500 mt-0.5">{item.category} • {item.condition}</p>
                    </div>
                  </div>

                  <div className="pt-3 mt-3 border-t border-gray-100 flex items-center justify-between">
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

      {/* DETAIL MODAL WITH FULL PROVENANCE & PERMANENT PRICE MODIFICATION */}
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

                {/* FINANCIAL METRICS & PRICE EDIT */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-[#F8F9FA] border border-gray-200">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 block font-medium">Retail Selling Price</span>
                      {(isManager || isOwner) && !isEditingPrice && (
                        <button
                          onClick={() => setIsEditingPrice(true)}
                          className="text-[10px] text-[#C85A32] hover:underline font-bold flex items-center gap-0.5"
                        >
                          <Edit2 className="w-3 h-3" /> Edit
                        </button>
                      )}
                    </div>
                    {isEditingPrice ? (
                      <div className="mt-2 space-y-2">
                        <input
                          type="number"
                          value={newPriceValue}
                          onChange={e => setNewPriceValue(e.target.value)}
                          className="w-full bg-white border border-[#C85A32] rounded-lg px-2 py-1 text-sm font-bold font-mono outline-none"
                        />
                        <input
                          type="text"
                          value={priceChangeReason}
                          onChange={e => setPriceChangeReason(e.target.value)}
                          placeholder="Reason for change..."
                          className="w-full bg-white border border-gray-300 rounded-lg px-2 py-1 text-[10px] outline-none"
                        />
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => setIsEditingPrice(false)}
                            className="flex-1 py-1 bg-gray-200 text-gray-700 rounded text-[10px] font-bold"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleSavePriceChange}
                            disabled={isSavingPrice}
                            className="flex-1 py-1 bg-[#C85A32] text-white rounded text-[10px] font-bold flex items-center justify-center gap-1"
                          >
                            <Check className="w-3 h-3" /> Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <span className="text-base font-bold text-gray-900 font-mono mt-0.5 block">
                        R {selectedItem.retailPrice.toLocaleString()}
                      </span>
                    )}
                  </div>

                  <div className="p-3 rounded-xl bg-[#F8F9FA] border border-gray-200">
                    <span className="text-gray-400 block font-medium">Cost Basis (Immutable)</span>
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
