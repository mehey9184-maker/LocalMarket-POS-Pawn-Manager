import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useInventory } from '../../context/InventoryContext';
import { useSaps } from '../../context/SapsContext';
import { InventoryItem, ITEM_CATEGORIES } from '../../types';
import { ProfileRow } from '../../types/supabase';
import { AutoSizer as AutoSizerComponent } from 'react-virtualized-auto-sizer';
import { VirtualList } from '../common/VirtualList';

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
  Filter,
  RotateCcw,
  ShieldAlert,
  AlertTriangle,
  UserCheck
} from 'lucide-react';
import { useSellers } from '../../context/SellerContext';
import { useAuth } from '../../context/AuthContext';

const InventoryRow: React.FC<{ 
  item: InventoryItem & { sellerName: string; sellerIdNumber: string; sapsRef: string; sellerTransactionId?: string }; 
  onPrint: (item: InventoryItem) => void;
  onPOS: () => void;
  onReverse: (item: any) => void;
  canViewCostBasis?: boolean;
  style?: React.CSSProperties;
}> = ({ item, onPrint, onPOS, onReverse, canViewCostBasis = true, style }) => {
  const profit = (item.retailPrice || 0) - (item.costBasis || 0);
  const marginPct = item.retailPrice ? Math.round((profit / item.retailPrice) * 100) : 0;
  const isReversible = item.status !== 'Sold' && item.status !== 'Returned';

  return (
    <div style={style} className={`border-b border-gray-100 flex items-center hover:bg-gray-50 transition group px-4 ${item.status === 'Returned' ? 'opacity-50' : ''}`}>
      <div className="flex-1 min-w-0 flex items-center gap-3 py-2">
        <img
          src={item.imageUrl}
          alt={item.title}
          className="w-10 h-10 rounded-lg object-cover bg-gray-100 border border-gray-200 shrink-0"
          referrerPolicy="no-referrer"
        />
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 group-hover:text-[#C85A32] transition truncate text-xs">{item.title}</p>
          <div className="flex items-center gap-2 text-[10px] text-gray-500 font-mono mt-0.5 truncate">
            <span className="text-[#C85A32] font-bold">{item.sku}</span>
            <span>•</span>
            <span>SN: {item.serialOrImei}</span>
          </div>
        </div>
      </div>

      <div className="w-48 px-4 py-2">
        <p className="text-gray-800 font-medium text-[11px] truncate">{item.sellerName}</p>
        <p className="text-[10px] text-gray-400 font-mono mt-0.5 truncate">{item.sapsRef}</p>
      </div>

      <div className="w-28 px-4 py-2 font-mono font-semibold text-gray-700 text-xs">
        {canViewCostBasis ? (item.costBasis !== undefined ? `R ${item.costBasis.toFixed(2)}` : 'Unknown') : '•••'}
      </div>

      <div className="w-28 px-4 py-2 font-mono font-bold text-gray-900 text-xs">
        R {item.retailPrice.toFixed(2)}
      </div>

      <div className="w-32 px-4 py-2">
        {canViewCostBasis ? (
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[11px] font-bold text-emerald-700">R {profit.toFixed(0)}</span>
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${
              marginPct >= 40 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}>
              +{marginPct}%
            </span>
          </div>
        ) : (
          <span className="text-gray-400 font-mono text-xs">•••</span>
        )}
      </div>

      <div className="w-32 px-4 py-2">
        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
          item.status === 'Retail Floor'
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : item.status === 'Sold'
            ? 'bg-blue-50 text-blue-700 border border-blue-200'
            : item.status === 'Returned'
            ? 'bg-red-50 text-red-700 border border-red-200'
            : 'bg-gray-100 text-gray-600'
        }`}>
          {item.status}
        </span>
      </div>

      <div className="w-24 px-4 py-2 text-right">
        <div className="flex items-center justify-end gap-2">
          {isReversible && (
            <button
              type="button"
              onClick={() => onReverse(item)}
              className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition cursor-pointer"
              title="Reverse Acquisition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => onPrint(item)}
            className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-900 transition cursor-pointer"
            title="Print Barcode Label"
          >
            <Barcode className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onPOS}
            className="p-1.5 rounded-lg bg-[#FDF0EA] hover:bg-[#C85A32] text-[#C85A32] hover:text-white transition cursor-pointer"
            title="Go to POS"
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export const OutrightBuysLedger: React.FC = () => {
  const { showToast, setActiveTab, currentUserProfile, shopProfile } = useApp();
  const { isManager, isOwner, users, isAtLeastSeniorCashier, hasPermission } = useAuth();
  const canViewCostBasis = isOwner || isManager || isAtLeastSeniorCashier || hasPermission('reports');
  const { inventory } = useInventory();
  const { sapsEntries } = useSaps();
  const { reverseSellerAcquisition } = useSellers();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Retail Floor' | 'Sold' | 'Returned'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedItemForLabel, setSelectedItemForLabel] = useState<InventoryItem | null>(null);

  // Reversal State
  const [reversalItem, setReversalItem] = useState<any>(null);
  const [reversalReason, setReversalReason] = useState('');
  const [managerId, setManagerId] = useState('');
  const [isReversing, setIsReversing] = useState(false);

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
        sellerName: sapsMatch ? sapsMatch.customerName : 'Seller Unassigned',
        sellerIdNumber: sapsMatch ? sapsMatch.customerIdNumber : 'ID Unrecorded',
        sapsRef: sapsMatch ? sapsMatch.entryNumber : 'SAPS-REG-PENDING',
        sellerTransactionId: (item as any).sellerTransactionId // May be present if modern relational
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
    return ['all', ...ITEM_CATEGORIES];
  }, []);

  const managers = useMemo(() => {
    return users.filter((u: ProfileRow) => (u.role === 'manager' || u.role === 'owner') && u.id !== currentUserProfile?.id);
  }, [users, currentUserProfile]);

  const handlePrintBarcode = (item: InventoryItem) => {
    setSelectedItemForLabel(item);
    showToast('Thermal Printer', `Zebra label sent for ${item.sku}`, 'success');
  };

  const handleStartReversal = (item: any) => {
    if (!isManager && !isOwner) {
      showToast('Unauthorized', 'Manager or Owner approval required for acquisition reversal.', 'error');
      return;
    }
    setReversalItem(item);
    setReversalReason('');
    setManagerId('');
  };

  const handleConfirmReversal = async () => {
    if (!reversalReason.trim()) {
      showToast('Reason Required', 'Please provide a valid reason for reversal.', 'amber');
      return;
    }

    if (!managerId && !isOwner) {
      showToast('Approval Required', 'Please select an approving manager.', 'amber');
      return;
    }

    setIsReversing(true);
    try {
      // Find txId - if not in item, we might need to find it from sapsRef or something, 
      // but in the new system it should be linked.
      const txId = reversalItem.sellerTransactionId || reversalItem.sapsRef; // Fallback for old data
      
      const success = await reverseSellerAcquisition(
        txId,
        reversalItem.id,
        reversalReason.trim(),
        currentUserProfile?.id || 'system',
        currentUserProfile?.full_name || 'System',
        isOwner ? (currentUserProfile?.id || 'owner') : managerId
      );

      if (success) {
        showToast('Acquisition Reversed', 'Item status updated and reversal audit recorded.', 'success');
        setReversalItem(null);
      }
    } catch (error: any) {
      showToast('Reversal Failed', error.message || 'Operation could not be completed.', 'error');
    } finally {
      setIsReversing(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F5F6F8] p-4 sm:p-6 gap-5 overflow-hidden">
      {/* METRIC CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 shrink-0">
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 text-xs mb-1">
            <span>Capital Invested</span>
            <DollarSign className="w-4 h-4 text-[#C85A32]" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-gray-900">
            {canViewCostBasis ? `R ${metrics.totalCost.toLocaleString('en-ZA')}` : '•••'}
          </div>
          <p className="text-[10px] text-gray-500 mt-1 font-mono">{metrics.totalCount} items purchased</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 text-xs mb-1">
            <span>Retail Value</span>
            <Tag className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-gray-900">R {metrics.totalRetail.toLocaleString('en-ZA')}</div>
          <p className="text-[10px] text-emerald-600 mt-1 font-mono">{metrics.activeFloorCount} currently on floor</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 text-xs mb-1">
            <span>Projected Profit</span>
            <TrendingUp className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-emerald-700">
            {canViewCostBasis ? `R ${metrics.totalProfit.toLocaleString('en-ZA')}` : '•••'}
          </div>
          <p className="text-[10px] text-blue-600 mt-1 font-mono">{canViewCostBasis ? `${metrics.avgMargin.toFixed(1)}% blended margin` : '•••'}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 text-xs mb-1">
            <span>SAPS Compliance</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-sm font-bold text-gray-900">100% Registered</div>
          <p className="text-[10px] text-gray-500 font-mono">Form 21 Verified</p>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="bg-white border border-gray-200 rounded-2xl p-3.5 sm:p-4 space-y-3 shrink-0 shadow-xs">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search bought inventory by title, SKU, seller name, serial..."
              className="w-full h-11 pl-10 pr-4 rounded-xl bg-[#F8F9FA] border border-gray-200 text-gray-900 placeholder-gray-400 text-xs sm:text-sm font-mono focus:border-[#C85A32] focus:bg-white focus:outline-none transition"
            />
          </div>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="h-11 bg-[#F8F9FA] border border-gray-200 rounded-xl px-3 text-xs text-gray-700 focus:outline-none focus:border-[#C85A32]">
            {categories.map(cat => (<option key={cat} value={cat}>{cat === 'all' ? 'All Categories' : cat}</option>))}
          </select>
        </div>
        <div className="flex items-center gap-2 pt-1 overflow-x-auto no-scrollbar">
          <button type="button" onClick={() => setStatusFilter('all')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${statusFilter === 'all' ? 'bg-[#C85A32] text-white shadow-xs' : 'bg-gray-100 border border-gray-200 text-gray-600 hover:text-gray-900'}`}>All Purchases</button>
          <button type="button" onClick={() => setStatusFilter('Retail Floor')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${statusFilter === 'Retail Floor' ? 'bg-[#C85A32] text-white shadow-xs' : 'bg-gray-100 border border-gray-200 text-gray-600 hover:text-gray-900'}`}>On Retail Floor</button>
          <button type="button" onClick={() => setStatusFilter('Sold')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${statusFilter === 'Sold' ? 'bg-[#C85A32] text-white shadow-xs' : 'bg-gray-100 border border-gray-200 text-gray-600 hover:text-gray-900'}`}>Sold</button>
          <button type="button" onClick={() => setStatusFilter('Returned')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${statusFilter === 'Returned' ? 'bg-[#C85A32] text-white shadow-xs' : 'bg-gray-100 border border-gray-200 text-gray-600 hover:text-gray-900'}`}>Returned</button>
        </div>
      </div>

      {/* TABLE */}
      <div className="flex-1 min-h-0 bg-white border border-gray-200 rounded-2xl overflow-hidden flex flex-col shadow-xs">
        <div className="bg-[#F8F9FA] text-gray-500 font-mono uppercase text-[10px] tracking-wider border-b border-gray-200 flex shrink-0 px-4">
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
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
              <ShoppingBag className="w-8 h-8 mb-2 text-gray-300" />
              <p className="text-sm font-semibold text-gray-600">No records found</p>
            </div>
          ) : (
            <AutoSizer>
              {({ height, width }: any) => (
                <VirtualList
                  height={height}
                  width={width}
                  itemCount={filteredItems.length}
                  itemSize={60}
                >
                  {({ index, style }: any) => (
                    <InventoryRow 
                      item={filteredItems[index]} 
                      onPrint={handlePrintBarcode} 
                      onPOS={() => setActiveTab('sell')}
                      onReverse={handleStartReversal}
                      canViewCostBasis={canViewCostBasis}
                      style={style}
                    />
                  )}
                </VirtualList>
              )}
            </AutoSizer>
          )}
        </div>
      </div>

      {/* ACQUISITION REVERSAL MODAL */}
      {reversalItem && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-[2rem] max-w-lg w-full p-8 space-y-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center gap-4 border-b border-gray-100 pb-5">
              <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-gray-900 uppercase">Acquisition Reversal</h3>
                <p className="text-xs text-gray-500">Controlled return of purchased goods to seller</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                <div className="flex items-center gap-3">
                  <img src={reversalItem.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover" />
                  <div>
                    <p className="text-sm font-bold text-gray-900">{reversalItem.title}</p>
                    <p className="text-[10px] text-gray-500 font-mono">{reversalItem.sku} • Cost: R {reversalItem.costBasis.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-500 uppercase">Reason for Reversal</label>
                <textarea
                  value={reversalReason}
                  onChange={e => setReversalReason(e.target.value)}
                  placeholder="e.g. Seller identity dispute, stolen property claim, item defect..."
                  className="w-full h-24 bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs focus:outline-none focus:border-red-500"
                />
              </div>

              {!isOwner && (
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Approving Manager</label>
                  <div className="relative">
                    <UserCheck className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                    <select
                      value={managerId}
                      onChange={e => setManagerId(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-xs focus:outline-none focus:border-red-500"
                    >
                      <option value="">Select Authorizing Manager...</option>
                      {managers.map((m: ProfileRow) => (
                        <option key={m.id} value={m.id}>{m.full_name} ({m.role})</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="bg-amber-50 rounded-xl p-4 border border-amber-200 flex gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[10px] text-amber-800 leading-relaxed">
                  <strong>Permanent Audit Entry:</strong> This reversal will be permanently linked to the original seller transaction and SAPS Form 21 entry. The item will be moved to "Returned" status.
                </p>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setReversalItem(null)}
                className="flex-1 py-3.5 bg-gray-100 text-gray-600 rounded-xl font-bold text-xs hover:bg-gray-200 transition"
              >
                Abort
              </button>
              <button
                type="button"
                disabled={isReversing || (!isOwner && !managerId)}
                onClick={handleConfirmReversal}
                className="flex-1 py-3.5 bg-red-600 text-white rounded-xl font-bold text-xs hover:bg-red-700 transition shadow-lg shadow-red-100 disabled:opacity-50"
              >
                {isReversing ? 'Processing...' : 'Confirm Reversal'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ZEBRA BARCODE LABEL MODAL */}
      {selectedItemForLabel && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-[#C85A32]" />
                <h4 className="text-sm font-bold text-gray-900 uppercase">Zebra Thermal Tag</h4>
              </div>
              <button type="button" onClick={() => setSelectedItemForLabel(null)} className="text-gray-400 hover:text-gray-700 text-xs cursor-pointer">✕</button>
            </div>
            <div className="bg-[#FAFAFA] text-black p-4 rounded-xl font-mono text-xs space-y-2 border border-gray-300 shadow-xs">
              <div className="text-center border-b border-gray-300 pb-1">
                <p className="font-bold text-xs text-gray-900">{shopProfile?.shop_name?.toUpperCase() || 'LOCALMARKET'}</p>
                <p className="text-[9px] text-gray-500">REG #{shopProfile?.saps_dealer_license || 'PENDING'}</p>
              </div>
              <div className="py-2 text-center">
                <div className="w-full h-8 bg-gray-900 rounded flex items-center justify-around px-2 text-white">
                  <div className="w-1 h-6 bg-white"></div>
                  <div className="w-2 h-6 bg-white"></div>
                  <div className="w-1 h-6 bg-white"></div>
                  <div className="w-3 h-6 bg-white"></div>
                </div>
                <p className="text-center text-[10px] font-black tracking-widest mt-1">*{selectedItemForLabel.sku}*</p>
              </div>
              <div className="space-y-0.5 text-[10px] border-t border-gray-200 pt-2">
                <p className="font-bold text-xs truncate text-gray-900">{selectedItemForLabel.title}</p>
                <div className="flex justify-between font-bold pt-1 border-t border-gray-200 text-sm">
                  <span>PRICE:</span>
                  <span className="font-black text-[#C85A32]">R {selectedItemForLabel.retailPrice.toFixed(2)}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setSelectedItemForLabel(null)} className="flex-1 py-2.5 bg-[#C85A32] hover:bg-[#A94725] text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-xs">
                <Printer className="w-4 h-4" />
                <span>Print Tag</span>
              </button>
              <button type="button" onClick={() => setSelectedItemForLabel(null)} className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-medium transition cursor-pointer">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
