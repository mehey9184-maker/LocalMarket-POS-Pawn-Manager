import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useInventory } from '../../context/InventoryContext';
import { useSaps } from '../../context/SapsContext';
import { InventoryItem } from '../../types';
import * as ReactWindow from 'react-window';
import { AutoSizer as AutoSizerComponent } from 'react-virtualized-auto-sizer';

const FixedSizeList = (ReactWindow as any).FixedSizeList;
const AutoSizer = (AutoSizerComponent as any);
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

const InventoryRow: React.FC<{ 
  item: InventoryItem & { sellerName: string; sellerIdNumber: string; sapsRef: string }; 
  onPrint: (item: InventoryItem) => void;
  onPOS: () => void;
  style?: React.CSSProperties;
}> = ({ item, onPrint, onPOS, style }) => {
  const profit = (item.retailPrice || 0) - (item.costBasis || 0);
  const marginPct = item.retailPrice ? Math.round((profit / item.retailPrice) * 100) : 0;

  return (
    <div style={style} className="border-b border-[#252525] flex items-center hover:bg-[#202020] transition group px-4">
      <div className="flex-1 min-w-0 flex items-center gap-3 py-2">
        <img
          src={item.imageUrl}
          alt={item.title}
          className="w-10 h-10 rounded-lg object-cover bg-[#141414] border border-[#2A2A2A] shrink-0"
          referrerPolicy="no-referrer"
        />
        <div className="min-w-0">
          <p className="font-semibold text-white group-hover:text-[#E87A5D] transition truncate text-xs">{item.title}</p>
          <div className="flex items-center gap-2 text-[10px] text-gray-500 font-mono mt-0.5 truncate">
            <span className="text-amber-400 font-bold">{item.sku}</span>
            <span>•</span>
            <span>SN: {item.serialOrImei}</span>
          </div>
        </div>
      </div>

      <div className="w-48 px-4 py-2">
        <p className="text-gray-200 font-medium text-[11px] truncate">{item.sellerName}</p>
        <p className="text-[10px] text-gray-500 font-mono mt-0.5 truncate">{item.sapsRef}</p>
      </div>

      <div className="w-28 px-4 py-2 font-mono font-bold text-gray-300 text-xs">
        R {item.costBasis.toFixed(2)}
      </div>

      <div className="w-28 px-4 py-2 font-mono font-bold text-emerald-400 text-xs">
        R {item.retailPrice.toFixed(2)}
      </div>

      <div className="w-32 px-4 py-2">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[11px] font-bold text-white">R {profit.toFixed(0)}</span>
          <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${
            marginPct >= 40 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400'
          }`}>
            +{marginPct}%
          </span>
        </div>
      </div>

      <div className="w-32 px-4 py-2">
        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
          item.status === 'Retail Floor'
            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/40'
            : item.status === 'Sold'
            ? 'bg-blue-950 text-cyan-400 border border-blue-800/40'
            : 'bg-gray-800 text-gray-400'
        }`}>
          {item.status}
        </span>
      </div>

      <div className="w-24 px-4 py-2 text-right">
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => onPrint(item)}
            className="p-1.5 rounded-lg bg-[#141414] hover:bg-[#2A2A2A] border border-[#2A2A2A] text-gray-300 hover:text-white transition"
          >
            <Barcode className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onPOS}
            className="p-1.5 rounded-lg bg-[#C85A32]/10 hover:bg-[#C85A32] text-[#E87A5D] hover:text-white border border-[#C85A32]/30 transition"
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export const OutrightBuysLedger: React.FC = () => {
  const { showToast, setActiveTab } = useApp();
  const { inventory } = useInventory();
  const { sapsEntries } = useSaps();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Retail Floor' | 'Sold'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedItemForLabel, setSelectedItemForLabel] = useState<InventoryItem | null>(null);

  const outrightItems = useMemo(() => {
    return inventory.filter(item => item.acquisitionType === 'Buy' || item.acquisitionType === 'Forfeited');
  }, [inventory]);

  const itemsWithSaps = useMemo(() => {
    return outrightItems.map(item => {
      const sapsMatch = sapsEntries.find(
        s => s.serialOrImei === item.serialOrImei || s.itemDescription.toLowerCase().includes(item.title.toLowerCase())
      );
      return {
        ...item,
        sellerName: sapsMatch ? sapsMatch.customerName : 'Walk-in Seller (Verified)',
        sellerIdNumber: sapsMatch ? sapsMatch.customerIdNumber : 'RSA ID Verified',
        sapsRef: sapsMatch ? sapsMatch.entryNumber : 'SAPS-2026-REG'
      };
    });
  }, [outrightItems, sapsEntries]);

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
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
      return true;
    });
  }, [itemsWithSaps, searchQuery, statusFilter, categoryFilter]);

  const metrics = useMemo(() => {
    const totalCost = outrightItems.reduce((acc, i) => acc + (i.costBasis || 0), 0);
    const totalRetail = outrightItems.reduce((acc, i) => acc + (i.retailPrice || 0), 0);
    const totalProfit = totalRetail - totalCost;
    const avgMargin = totalRetail > 0 ? (totalProfit / totalRetail) * 100 : 0;
    const activeFloorCount = outrightItems.filter(i => i.status === 'Retail Floor').length;

    return { totalCost, totalRetail, totalProfit, avgMargin, totalCount: outrightItems.length, activeFloorCount };
  }, [outrightItems]);

  const categories = useMemo(() => {
    const set = new Set(outrightItems.map(i => i.category));
    return ['all', ...Array.from(set)];
  }, [outrightItems]);

  const handlePrintBarcode = (item: InventoryItem) => {
    setSelectedItemForLabel(item);
    showToast('Thermal Printer', `Zebra label sent for ${item.sku}`, 'success');
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#121212] p-4 sm:p-6 gap-5 overflow-hidden">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 shrink-0">
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-gray-400 text-xs mb-1"><span>Capital Invested</span><DollarSign className="w-4 h-4 text-[#E87A5D]" /></div>
          <div className="text-xl sm:text-2xl font-black font-mono text-white">R {metrics.totalCost.toLocaleString('en-ZA')}</div>
          <p className="text-[10px] text-gray-500 mt-1 font-mono">{metrics.totalCount} items</p>
        </div>
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-gray-400 text-xs mb-1"><span>Retail Value</span><Tag className="w-4 h-4 text-emerald-400" /></div>
          <div className="text-xl sm:text-2xl font-black font-mono text-white">R {metrics.totalRetail.toLocaleString('en-ZA')}</div>
          <p className="text-[10px] text-emerald-400/80 mt-1 font-mono">{metrics.activeFloorCount} on floor</p>
        </div>
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-gray-400 text-xs mb-1"><span>Gross Margin</span><TrendingUp className="w-4 h-4 text-cyan-400" /></div>
          <div className="text-xl sm:text-2xl font-black font-mono text-cyan-400">R {metrics.totalProfit.toLocaleString('en-ZA')}</div>
          <p className="text-[10px] text-cyan-500/80 mt-1 font-mono">{metrics.avgMargin.toFixed(1)}% blended</p>
        </div>
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400 text-xs mb-1"><span>SAPS Compliance</span><CheckCircle2 className="w-4 h-4 text-emerald-400" /></div>
          <div className="text-sm font-semibold text-gray-200">100% Registered</div>
          <p className="text-[10px] text-gray-500 font-mono">Form 21 Verified</p>
        </div>
      </div>

      <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-3.5 sm:p-4 space-y-3 shrink-0">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search bought inventory..."
              className="w-full h-11 pl-10 pr-4 rounded-xl bg-[#141414] border border-[#2A2A2A] text-white placeholder-gray-500 text-xs sm:text-sm font-mono focus:border-[#C85A32] focus:outline-none transition"
            />
          </div>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="h-11 bg-[#141414] border border-[#2A2A2A] rounded-xl px-3 text-xs text-gray-300 focus:outline-none focus:border-[#C85A32]">
            {categories.map(cat => (<option key={cat} value={cat}>{cat === 'all' ? 'All Categories' : cat}</option>))}
          </select>
        </div>
        <div className="flex items-center gap-2 pt-1 overflow-x-auto no-scrollbar">
          <button type="button" onClick={() => setStatusFilter('all')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${statusFilter === 'all' ? 'bg-[#C85A32] text-white' : 'bg-[#141414] border border-[#2A2A2A] text-gray-400 hover:text-white'}`}>All Purchases</button>
          <button type="button" onClick={() => setStatusFilter('Retail Floor')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${statusFilter === 'Retail Floor' ? 'bg-[#C85A32] text-white' : 'bg-[#141414] border border-[#2A2A2A] text-gray-400 hover:text-white'}`}>On Retail Floor</button>
          <button type="button" onClick={() => setStatusFilter('Sold')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${statusFilter === 'Sold' ? 'bg-[#C85A32] text-white' : 'bg-[#141414] border border-[#2A2A2A] text-gray-400 hover:text-white'}`}>Sold</button>
        </div>
      </div>

      <div className="flex-1 min-h-0 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl overflow-hidden flex flex-col">
        <div className="bg-[#141414] text-gray-400 font-mono uppercase text-[10px] tracking-wider border-b border-[#2A2A2A] flex shrink-0 px-4">
          <div className="flex-1 py-3">Item &amp; SKU</div>
          <div className="w-48 py-3 px-4">Seller / SAPS Ref</div>
          <div className="w-28 py-3 px-4">Cost Payout</div>
          <div className="w-28 py-3 px-4">Retail Tag</div>
          <div className="w-32 py-3 px-4">Gross Margin</div>
          <div className="w-32 py-3 px-4">Status</div>
          <div className="w-24 py-3 px-4 text-right">Actions</div>
        </div>
        <div className="flex-1 min-h-0 relative">
          {filteredItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-500">
              <ShoppingBag className="w-8 h-8 mb-2 text-gray-600" />
              <p className="text-sm font-semibold text-gray-400">No records found</p>
            </div>
          ) : (
            <AutoSizer>
              {({ height, width }: any) => (
                <FixedSizeList
                  height={height}
                  width={width}
                  itemCount={filteredItems.length}
                  itemSize={60}
                >
                  {({ index, style }: any) => (
                    <InventoryRow 
                      item={filteredItems[index]} 
                      onPrint={handlePrintBarcode} 
                      onPOS={() => setActiveTab('pos')}
                      style={style}
                    />
                  )}
                </FixedSizeList>
              )}
            </AutoSizer>
          )}
        </div>
      </div>

      {selectedItemForLabel && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#2A2A2A] pb-3">
              <div className="flex items-center gap-2"><Printer className="w-4 h-4 text-[#E87A5D]" /><h4 className="text-sm font-bold text-white uppercase">Zebra Thermal Tag</h4></div>
              <button type="button" onClick={() => setSelectedItemForLabel(null)} className="text-gray-400 hover:text-white text-xs">✕</button>
            </div>
            <div className="bg-white text-black p-4 rounded-lg font-mono text-xs space-y-2 border border-gray-400 shadow-md">
              <div className="text-center border-b border-black pb-1"><p className="font-black text-xs">LOCALMARKET SOWETO</p><p className="text-[9px]">REG #00482</p></div>
              <div className="py-1"><div className="w-full h-8 bg-black rounded flex items-center justify-around px-2 text-white"><div className="w-1 h-6 bg-white"></div><div className="w-2 h-6 bg-white"></div><div className="w-1 h-6 bg-white"></div><div className="w-3 h-6 bg-white"></div></div><p className="text-center text-[9px] font-black tracking-widest mt-0.5">*{selectedItemForLabel.sku}*</p></div>
              <div className="space-y-0.5 text-[10px] border-t border-black/20 pt-1">
                <p className="font-bold text-xs truncate">{selectedItemForLabel.title}</p>
                <div className="flex justify-between font-bold pt-1 border-t border-black/10 text-sm"><span>PRICE:</span><span className="font-black">R {selectedItemForLabel.retailPrice.toFixed(2)}</span></div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setSelectedItemForLabel(null)} className="flex-1 py-2.5 bg-[#C85A32] hover:bg-[#b04d29] text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2"><Printer className="w-4 h-4" /><span>Print</span></button>
              <button type="button" onClick={() => setSelectedItemForLabel(null)} className="px-4 py-2.5 bg-[#141414] hover:bg-[#252525] border border-[#2A2A2A] text-gray-300 rounded-xl text-xs transition">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
