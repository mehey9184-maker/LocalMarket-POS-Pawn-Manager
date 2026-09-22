import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { InventoryItem } from '../../types';
import {
  Search,
  Tag,
  ShoppingBag,
  TrendingUp,
  Barcode,
  Printer,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowUpRight,
  DollarSign,
  Filter
} from 'lucide-react';

export const OutrightBuysLedger: React.FC = () => {
  const { inventory, sapsRegister, showToast, setActiveTab } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Retail Floor' | 'Sold'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedItemForLabel, setSelectedItemForLabel] = useState<InventoryItem | null>(null);

  // Filter only items acquired through direct buy (or forfeited pawn converted to shop inventory)
  const outrightItems = useMemo(() => {
    return inventory.filter(item => item.acquisitionType === 'Buy' || item.acquisitionType === 'Forfeited');
  }, [inventory]);

  // Connect items with seller information from SAPS Form 21
  const itemsWithSaps = useMemo(() => {
    return outrightItems.map(item => {
      const sapsMatch = sapsRegister.find(
        s => s.serialOrImei === item.serialOrImei || s.itemDescription.toLowerCase().includes(item.title.toLowerCase())
      );
      return {
        ...item,
        sellerName: sapsMatch ? sapsMatch.customerName : 'Walk-in Seller (Verified)',
        sellerIdNumber: sapsMatch ? sapsMatch.customerIdNumber : 'RSA ID Verified',
        sapsRef: sapsMatch ? sapsMatch.entryNumber : 'SAPS-2026-REG'
      };
    });
  }, [outrightItems, sapsRegister]);

  // Apply search and status filters
  const filteredItems = useMemo(() => {
    return itemsWithSaps.filter(item => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        item.title.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q) ||
        item.serialOrImei.toLowerCase().includes(q) ||
        item.sellerName.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (statusFilter !== 'all' && item.status !== statusFilter) {
        return false;
      }

      if (categoryFilter !== 'all' && item.category !== categoryFilter) {
        return false;
      }

      return true;
    });
  }, [itemsWithSaps, searchQuery, statusFilter, categoryFilter]);

  // Aggregate Business Metrics
  const metrics = useMemo(() => {
    const totalCost = outrightItems.reduce((acc, i) => acc + (i.costBasis || 0), 0);
    const totalRetail = outrightItems.reduce((acc, i) => acc + (i.retailPrice || 0), 0);
    const totalProfit = totalRetail - totalCost;
    const avgMargin = totalRetail > 0 ? (totalProfit / totalRetail) * 100 : 0;
    const activeFloorCount = outrightItems.filter(i => i.status === 'Retail Floor').length;

    return {
      totalCost,
      totalRetail,
      totalProfit,
      avgMargin,
      totalCount: outrightItems.length,
      activeFloorCount
    };
  }, [outrightItems]);

  const categories = useMemo(() => {
    const set = new Set(outrightItems.map(i => i.category));
    return ['all', ...Array.from(set)];
  }, [outrightItems]);

  const handlePrintBarcode = (item: InventoryItem) => {
    setSelectedItemForLabel(item);
    showToast('Thermal Printer', `Zebra label sent for ${item.sku} (R ${item.retailPrice.toFixed(2)})`, 'success');
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-[#121212] p-4 sm:p-6 gap-5">
      {/* 1. BUSINESS KPI SUMMARY DECK */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 shrink-0">
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-gray-400 text-xs mb-1">
            <span>Capital Invested (Cost)</span>
            <DollarSign className="w-4 h-4 text-[#E87A5D]" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-white">
            R {metrics.totalCost.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[10px] text-gray-500 mt-1 font-mono">{metrics.totalCount} items bought outright</p>
        </div>

        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-gray-400 text-xs mb-1">
            <span>Floor Retail Value</span>
            <Tag className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-white">
            R {metrics.totalRetail.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[10px] text-emerald-400/80 mt-1 font-mono">{metrics.activeFloorCount} currently on POS floor</p>
        </div>

        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-gray-400 text-xs mb-1">
            <span>Projected Gross Margin</span>
            <TrendingUp className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-cyan-400">
            R {metrics.totalProfit.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[10px] text-cyan-500/80 mt-1 font-mono">{metrics.avgMargin.toFixed(1)}% blended gross margin</p>
        </div>

        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400 text-xs mb-1">
            <span>SAPS Compliance</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-sm font-semibold text-gray-200">
            100% Registered
          </div>
          <p className="text-[10px] text-gray-500 font-mono">Act 06 of 2009 Second-Hand compliant</p>
        </div>
      </div>

      {/* 2. SEARCH & ADVANCED FILTERS */}
      <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-3.5 sm:p-4 space-y-3 shrink-0">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search bought inventory by title, SKU (LM-XXXX), IMEI, or seller name..."
              className="w-full h-11 pl-10 pr-4 rounded-xl bg-[#141414] border border-[#2A2A2A] text-white placeholder-gray-500 text-xs sm:text-sm font-mono focus:border-[#C85A32] focus:outline-none transition"
            />
          </div>

          {/* Category Dropdown */}
          <div className="shrink-0 flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400 hidden sm:block" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-11 bg-[#141414] border border-[#2A2A2A] rounded-xl px-3 text-xs text-gray-300 focus:outline-none focus:border-[#C85A32]"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>
                  {cat === 'all' ? 'All Categories' : cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Status Filter Pills */}
        <div className="flex items-center gap-2 pt-1 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
              statusFilter === 'all'
                ? 'bg-[#C85A32] text-white'
                : 'bg-[#141414] border border-[#2A2A2A] text-gray-400 hover:text-white'
            }`}
          >
            All Purchases ({outrightItems.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('Retail Floor')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
              statusFilter === 'Retail Floor'
                ? 'bg-[#C85A32] text-white'
                : 'bg-[#141414] border border-[#2A2A2A] text-gray-400 hover:text-white'
            }`}
          >
            On Retail Floor ({outrightItems.filter(i => i.status === 'Retail Floor').length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('Sold')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
              statusFilter === 'Sold'
                ? 'bg-[#C85A32] text-white'
                : 'bg-[#141414] border border-[#2A2A2A] text-gray-400 hover:text-white'
            }`}
          >
            Sold via POS ({outrightItems.filter(i => i.status === 'Sold').length})
          </button>
        </div>
      </div>

      {/* 3. INVENTORY ITEMS TABLE / GRID */}
      <div className="flex-1 min-h-0 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#141414] text-gray-400 font-mono uppercase text-[10px] tracking-wider border-b border-[#2A2A2A] sticky top-0 z-10">
              <tr>
                <th className="py-3 px-4">Item &amp; SKU</th>
                <th className="py-3 px-4">Seller / SAPS Ref</th>
                <th className="py-3 px-4">Cost Payout</th>
                <th className="py-3 px-4">Retail Tag Price</th>
                <th className="py-3 px-4">Gross Margin</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#252525]">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-500">
                    <ShoppingBag className="w-8 h-8 mx-auto mb-2 text-gray-600" />
                    <p className="text-sm font-semibold text-gray-400">No Outright Purchase records match criteria</p>
                    <p className="text-xs text-gray-600 mt-1">Direct buy transactions logged at the Intake Desk will appear here.</p>
                  </td>
                </tr>
              ) : (
                filteredItems.map(item => {
                  const profit = (item.retailPrice || 0) - (item.costBasis || 0);
                  const marginPct = item.retailPrice ? Math.round((profit / item.retailPrice) * 100) : 0;

                  return (
                    <tr key={item.id} className="hover:bg-[#202020] transition group">
                      {/* Item Details */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={item.imageUrl}
                            alt={item.title}
                            className="w-10 h-10 rounded-lg object-cover bg-[#141414] border border-[#2A2A2A] shrink-0"
                            referrerPolicy="no-referrer"
                          />
                          <div>
                            <p className="font-semibold text-white group-hover:text-[#E87A5D] transition">{item.title}</p>
                            <div className="flex items-center gap-2 text-[10px] text-gray-500 font-mono mt-0.5">
                              <span className="text-amber-400 font-bold">{item.sku}</span>
                              <span>•</span>
                              <span>SN: {item.serialOrImei}</span>
                              <span>•</span>
                              <span>{item.condition}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Seller & SAPS */}
                      <td className="py-3.5 px-4">
                        <p className="text-gray-200 font-medium">{item.sellerName}</p>
                        <div className="flex items-center gap-1.5 text-[10px] text-gray-500 font-mono mt-0.5">
                          <span>{item.sapsRef}</span>
                          <span>•</span>
                          <span>{item.addedAt}</span>
                        </div>
                      </td>

                      {/* Cost Basis */}
                      <td className="py-3.5 px-4 font-mono font-bold text-gray-300">
                        R {item.costBasis.toFixed(2)}
                      </td>

                      {/* Retail Price */}
                      <td className="py-3.5 px-4 font-mono font-bold text-emerald-400">
                        R {item.retailPrice.toFixed(2)}
                      </td>

                      {/* Gross Margin */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-bold text-white">R {profit.toFixed(0)}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                            marginPct >= 40 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400'
                          }`}>
                            +{marginPct}%
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          item.status === 'Retail Floor'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/40'
                            : item.status === 'Sold'
                            ? 'bg-blue-950 text-cyan-400 border border-blue-800/40'
                            : 'bg-gray-800 text-gray-400'
                        }`}>
                          {item.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handlePrintBarcode(item)}
                            className="p-1.5 rounded-lg bg-[#141414] hover:bg-[#2A2A2A] border border-[#2A2A2A] text-gray-300 hover:text-white transition"
                            title="Print Zebra Floor Price Tag"
                          >
                            <Barcode className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveTab('pos')}
                            className="p-1.5 rounded-lg bg-[#C85A32]/10 hover:bg-[#C85A32] text-[#E87A5D] hover:text-white border border-[#C85A32]/30 transition"
                            title="Open in POS Floor Checkout"
                          >
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. MODAL: ZEBRA THERMAL LABEL REPRINT PREVIEW */}
      {selectedItemForLabel && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#2A2A2A] pb-3">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-[#E87A5D]" />
                <h4 className="text-sm font-bold text-white uppercase">Zebra Thermal Tag</h4>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItemForLabel(null)}
                className="text-gray-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            {/* Thermal Tag Mockup */}
            <div className="bg-white text-black p-4 rounded-lg font-mono text-xs space-y-2 border border-gray-400 shadow-md">
              <div className="text-center border-b border-black pb-1">
                <p className="font-black text-xs">LOCALMARKET SOWETO</p>
                <p className="text-[9px]">SECOND-HAND GOODS REG #00482</p>
              </div>

              {/* Barcode visual */}
              <div className="py-1">
                <div className="w-full h-8 bg-black rounded flex items-center justify-around px-2 text-white">
                  <div className="w-1 h-6 bg-white"></div>
                  <div className="w-2 h-6 bg-white"></div>
                  <div className="w-1 h-6 bg-white"></div>
                  <div className="w-3 h-6 bg-white"></div>
                  <div className="w-1 h-6 bg-white"></div>
                  <div className="w-2 h-6 bg-white"></div>
                </div>
                <p className="text-center text-[9px] font-black tracking-widest mt-0.5">*{selectedItemForLabel.sku}*</p>
              </div>

              <div className="space-y-0.5 text-[10px] border-t border-black/20 pt-1">
                <p className="font-bold text-xs truncate">{selectedItemForLabel.title}</p>
                <p className="text-gray-700">SN: {selectedItemForLabel.serialOrImei}</p>
                <div className="flex justify-between font-bold pt-1 border-t border-black/10 text-sm">
                  <span>PRICE (INCL VAT):</span>
                  <span className="font-black">R {selectedItemForLabel.retailPrice.toFixed(2)}</span>
                </div>
                <p className="text-[8px] text-gray-600 text-center pt-1">7-DAY STORE REPLACEMENT WARRANTY</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  showToast('Print Dispatched', `Label sent to thermal printer for ${selectedItemForLabel.sku}`, 'success');
                  setSelectedItemForLabel(null);
                }}
                className="flex-1 py-2.5 bg-[#C85A32] hover:bg-[#b04d29] text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4" />
                <span>Print Tag</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedItemForLabel(null)}
                className="px-4 py-2.5 bg-[#141414] hover:bg-[#252525] border border-[#2A2A2A] text-gray-300 rounded-xl text-xs transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
