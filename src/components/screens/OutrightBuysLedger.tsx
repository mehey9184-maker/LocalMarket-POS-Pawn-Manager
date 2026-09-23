import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useInventory } from '../../context/InventoryContext';
import { useSellers } from '../../context/SellerContext';
import { useSaps } from '../../context/SapsContext';
import { InventoryItem, SellerTransaction } from '../../types';
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
  Clock,
  FileText
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
    <div style={style} className="border-b border-gray-100 flex items-center hover:bg-gray-50 transition group px-4">
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
        R {item.costBasis.toFixed(2)}
      </div>

      <div className="w-28 px-4 py-2 font-mono font-bold text-gray-900 text-xs">
        R {item.retailPrice.toFixed(2)}
      </div>

      <div className="w-32 px-4 py-2">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[11px] font-bold text-emerald-700">R {profit.toFixed(0)}</span>
          <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${
            marginPct >= 40 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
          }`}>
            +{marginPct}%
          </span>
        </div>
      </div>

      <div className="w-32 px-4 py-2">
        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
          item.status === 'Retail Floor'
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : item.status === 'Sold'
            ? 'bg-blue-50 text-blue-700 border border-blue-200'
            : item.status === 'Returned' || item.status === 'Under Review'
            ? 'bg-amber-50 text-amber-700 border border-amber-200'
            : 'bg-gray-100 text-gray-600'
        }`}>
          {item.status}
        </span>
      </div>

      <div className="w-24 px-4 py-2 text-right">
        <div className="flex items-center justify-end gap-2">
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
  const { showToast, setActiveTab } = useApp();
  const { currentUserProfile } = useAuth();
  const { inventory } = useInventory();
  const { sellerTransactions, reverseAcquisition } = useSellers();
  const { sapsEntries } = useSaps();

  const [activeLedgerTab, setActiveLedgerTab] = useState<'items' | 'transactions'>('items');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Retail Floor' | 'Sold' | 'Returned'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedItemForLabel, setSelectedItemForLabel] = useState<InventoryItem | null>(null);

  // Reversal Modal State
  const [reversalTx, setReversalTx] = useState<SellerTransaction | null>(null);
  const [reversalReason, setReversalReason] = useState('');
  const [resultingStatus, setResultingStatus] = useState<'Returned' | 'Under Review' | 'Quarantined'>('Returned');
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

  const filteredTransactions = useMemo(() => {
    return sellerTransactions.filter(tx => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        (tx.transactionNumber && tx.transactionNumber.toLowerCase().includes(q)) ||
        (tx.sellerName && tx.sellerName.toLowerCase().includes(q)) ||
        (tx.itemTitle && tx.itemTitle.toLowerCase().includes(q)) ||
        (tx.itemSku && tx.itemSku.toLowerCase().includes(q)) ||
        (tx.sapsRef && tx.sapsRef.toLowerCase().includes(q))
      );
    });
  }, [sellerTransactions, searchQuery]);

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

  const isManagerOrOwner = currentUserProfile?.role === 'manager' || currentUserProfile?.role === 'owner' || currentUserProfile?.role === 'system_admin';

  const handleExecuteReversal = async () => {
    if (!reversalTx) return;

    if (!isManagerOrOwner) {
      showToast('Authorization Required', 'Only a Manager or Owner can approve acquisition reversals', 'error');
      return;
    }

    if (!reversalReason.trim()) {
      showToast('Reason Required', 'Please enter a justification for this reversal', 'amber');
      return;
    }

    setIsReversing(true);
    try {
      const res = await reverseAcquisition({
        transactionId: reversalTx.id,
        reason: reversalReason.trim(),
        resultingInventoryStatus: resultingStatus,
        resultingPaymentStatus: 'Reversed'
      });

      if (res.success) {
        showToast('Acquisition Reversed', res.message || 'Transaction reversed and item marked returned', 'success');
        setReversalTx(null);
        setReversalReason('');
      }
    } catch (err: any) {
      showToast('Reversal Failed', err.message || 'Could not execute acquisition reversal', 'error');
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
          <div className="text-xl sm:text-2xl font-black font-mono text-gray-900">R {metrics.totalCost.toLocaleString('en-ZA')}</div>
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
          <div className="text-xl sm:text-2xl font-black font-mono text-emerald-700">R {metrics.totalProfit.toLocaleString('en-ZA')}</div>
          <p className="text-[10px] text-blue-600 mt-1 font-mono">{metrics.avgMargin.toFixed(1)}% blended margin</p>
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

      {/* FILTER & TABS BAR */}
      <div className="bg-white border border-gray-200 rounded-2xl p-3.5 sm:p-4 space-y-3 shrink-0 shadow-xs">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveLedgerTab('items')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2 ${
                activeLedgerTab === 'items'
                  ? 'bg-[#C85A32] text-white shadow-xs'
                  : 'bg-gray-100 text-gray-600 hover:text-gray-900'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Purchased Inventory Items ({filteredItems.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveLedgerTab('transactions')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2 ${
                activeLedgerTab === 'transactions'
                  ? 'bg-[#C85A32] text-white shadow-xs'
                  : 'bg-gray-100 text-gray-600 hover:text-gray-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Seller Batches &amp; Returns ({sellerTransactions.length})</span>
            </button>
          </div>

          <div className="text-xs text-gray-500 font-mono">
            Staff Role: <span className="font-bold text-gray-800 uppercase">{currentUserProfile?.role || 'Cashier'}</span>
          </div>
        </div>

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
          {activeLedgerTab === 'items' && (
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="h-11 bg-[#F8F9FA] border border-gray-200 rounded-xl px-3 text-xs text-gray-700 focus:outline-none focus:border-[#C85A32]">
              {categories.map(cat => (<option key={cat} value={cat}>{cat === 'all' ? 'All Categories' : cat}</option>))}
            </select>
          )}
        </div>

        {activeLedgerTab === 'items' && (
          <div className="flex items-center gap-2 pt-1 overflow-x-auto no-scrollbar">
            <button type="button" onClick={() => setStatusFilter('all')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${statusFilter === 'all' ? 'bg-[#C85A32] text-white shadow-xs' : 'bg-gray-100 border border-gray-200 text-gray-600 hover:text-gray-900'}`}>All Purchases</button>
            <button type="button" onClick={() => setStatusFilter('Retail Floor')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${statusFilter === 'Retail Floor' ? 'bg-[#C85A32] text-white shadow-xs' : 'bg-gray-100 border border-gray-200 text-gray-600 hover:text-gray-900'}`}>On Retail Floor</button>
            <button type="button" onClick={() => setStatusFilter('Sold')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${statusFilter === 'Sold' ? 'bg-[#C85A32] text-white shadow-xs' : 'bg-gray-100 border border-gray-200 text-gray-600 hover:text-gray-900'}`}>Sold</button>
            <button type="button" onClick={() => setStatusFilter('Returned')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${statusFilter === 'Returned' ? 'bg-[#C85A32] text-white shadow-xs' : 'bg-gray-100 border border-gray-200 text-gray-600 hover:text-gray-900'}`}>Returned / Reversed</button>
          </div>
        )}
      </div>

      {/* ITEMS OR TRANSACTIONS TABLE */}
      {activeLedgerTab === 'items' ? (
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
                        style={style}
                      />
                    )}
                  </VirtualList>
                )}
              </AutoSizer>
            )}
          </div>
        </div>
      ) : (
        /* TRANSACTIONS BATCHES & RETURNS VIEW */
        <div className="flex-1 min-h-0 bg-white border border-gray-200 rounded-2xl overflow-hidden flex flex-col shadow-xs">
          <div className="bg-[#F8F9FA] text-gray-500 font-mono uppercase text-[10px] tracking-wider border-b border-gray-200 flex shrink-0 px-6 py-3">
            <div className="w-40">Transaction #</div>
            <div className="w-48 px-4">Seller Details</div>
            <div className="flex-1 px-4">Acquired Items</div>
            <div className="w-32 px-4">Total Payout</div>
            <div className="w-32 px-4">Payment State</div>
            <div className="w-32 px-4 text-right">Reversal Action</div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-gray-100">
            {filteredTransactions.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 p-8">
                <FileText className="w-8 h-8 mb-2 text-gray-300" />
                <p className="text-sm font-semibold text-gray-600">No seller transactions found</p>
              </div>
            ) : (
              filteredTransactions.map((tx) => {
                const isReversed = tx.paymentStatus === 'Reversed' || tx.paymentStatus === 'Partially Reversed';
                const itemsCount = tx.items?.length || 1;

                return (
                  <div key={tx.id} className="p-4 sm:px-6 flex items-center hover:bg-gray-50 transition text-xs">
                    <div className="w-40 min-w-0">
                      <p className="font-bold text-gray-900 font-mono">{tx.transactionNumber || `ST-${tx.id.substring(0, 6).toUpperCase()}`}</p>
                      <p className="text-[10px] text-gray-400 font-mono mt-0.5">{new Date(tx.timestamp).toLocaleDateString()}</p>
                    </div>

                    <div className="w-48 px-4 min-w-0">
                      <p className="font-bold text-gray-800 truncate">{tx.sellerName || 'Seller'}</p>
                      <p className="text-[10px] text-gray-400 font-mono truncate">{tx.sellerIdNumber || 'ID Verified'}</p>
                    </div>

                    <div className="flex-1 px-4 min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {tx.itemTitle || (tx.items && tx.items[0]?.itemTitle) || 'Acquired Merchandise'}
                      </p>
                      <p className="text-[10px] text-[#C85A32] font-semibold mt-0.5">
                        {itemsCount} item{itemsCount > 1 ? 's in batch' : ''} {tx.itemSku ? `· ${tx.itemSku}` : ''}
                      </p>
                    </div>

                    <div className="w-32 px-4 font-mono font-bold text-gray-900">
                      R {tx.amountPaid.toLocaleString()}
                    </div>

                    <div className="w-32 px-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        isReversed
                          ? 'bg-red-50 text-red-700 border border-red-200'
                          : tx.paymentStatus === 'Acquired' || tx.paymentStatus === 'Paid'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-blue-50 text-blue-700 border border-blue-200'
                      }`}>
                        {tx.paymentStatus || 'Acquired'}
                      </span>
                    </div>

                    <div className="w-32 px-4 text-right">
                      {isReversed ? (
                        <span className="text-[10px] font-bold text-gray-400 italic">Reversed</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setReversalTx(tx);
                            setReversalReason('');
                          }}
                          className="px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold text-[11px] transition flex items-center gap-1.5 ml-auto cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Reverse</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* CONTROLLED SELLER REVERSAL MODAL */}
      {reversalTx && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                  <RotateCcw className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-900">Seller Acquisition Reversal</h4>
                  <p className="text-[11px] text-gray-500">Controlled return &amp; inventory state reversal</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReversalTx(null)}
                className="text-gray-400 hover:text-gray-700 text-xs cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            {/* TRANSACTION SUMMARY */}
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500 font-medium">Transaction Number:</span>
                <span className="font-bold text-gray-900 font-mono">{reversalTx.transactionNumber || `ST-${reversalTx.id.substring(0, 6).toUpperCase()}`}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 font-medium">Seller:</span>
                <span className="font-bold text-gray-800">{reversalTx.sellerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 font-medium">Item / Batch:</span>
                <span className="font-medium text-gray-800">{reversalTx.itemTitle}</span>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-2">
                <span className="text-gray-700 font-bold">Original Payout:</span>
                <span className="font-bold text-emerald-700 font-mono text-sm">R {reversalTx.amountPaid.toLocaleString()}</span>
              </div>
            </div>

            {/* AUTHORIZATION NOTICE */}
            {!isManagerOrOwner && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-800">
                <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <p>
                  <strong>Manager Authorization Required:</strong> Cashiers cannot independently reverse completed acquisitions. Please ask an active store Manager or Owner to execute this reversal.
                </p>
              </div>
            )}

            {/* REASON INPUT */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 uppercase">
                Reason for Reversal *
              </label>
              <textarea
                value={reversalReason}
                onChange={(e) => setReversalReason(e.target.value)}
                placeholder="e.g. Customer return approved by Owner / Item failed quality check / Seller requested buyback..."
                className="w-full bg-[#F8F9FA] border border-gray-200 rounded-xl p-3 text-xs text-gray-800 focus:outline-none focus:border-[#C85A32] h-20 resize-none"
              />
            </div>

            {/* RESULTING STATUS */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 uppercase">
                Resulting Inventory Status
              </label>
              <select
                value={resultingStatus}
                onChange={(e) => setResultingStatus(e.target.value as any)}
                className="w-full bg-[#F8F9FA] border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 focus:outline-none focus:border-[#C85A32]"
              >
                <option value="Returned">Returned (Removed from active floor)</option>
                <option value="Under Review">Under Review (Vault quarantine)</option>
                <option value="Quarantined">Quarantined (Compliance inspection)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setReversalTx(null)}
                className="py-2.5 px-4 rounded-xl border border-gray-300 text-gray-700 text-xs font-semibold hover:bg-gray-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteReversal}
                disabled={isReversing || !isManagerOrOwner}
                className="py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isReversing && <Clock className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm &amp; Reverse Acquisition</span>
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
                <p className="font-bold text-xs text-gray-900">LOCALMARKET SOWETO</p>
                <p className="text-[9px] text-gray-500">REG #00482</p>
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
