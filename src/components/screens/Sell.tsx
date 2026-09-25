import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { PaymentMethod, ReceiptDelivery, InventoryItem } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import {
  Barcode,
  Search,
  Camera,
  Trash2,
  CreditCard,
  Banknote,
  CheckCircle2,
  X,
  ChevronRight,
  Plus,
  Minus,
  ShoppingCart,
  Zap,
  Info,
  Smartphone,
  Printer
} from 'lucide-react';

const CartItemRow: React.FC<{ 
  ci: any; 
  onRemove: (id: string) => void; 
  onUpdatePrice: (id: string, price: number) => void;
  onUpdateQuantity: (id: string, qty: number) => void;
}> = ({ ci, onRemove, onUpdatePrice, onUpdateQuantity }) => {
  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [tempPrice, setTempPrice] = useState((ci.overridePrice ?? ci.item.retailPrice).toString());

  const handlePriceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const p = parseFloat(tempPrice);
    if (!isNaN(p)) {
      onUpdatePrice(ci.item.id, p);
    }
    setIsEditingPrice(false);
  };

  const getBadgeStyle = () => {
    switch (ci.item.acquisitionType) {
      case 'Existing Stock':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Buy':
        return 'bg-orange-50 text-[#C85A32] border-[#C85A32]/20';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="p-3 bg-[#F8F9FA] border border-gray-200 rounded-xl flex items-center gap-3"
    >
      <div className="w-11 h-11 rounded-lg bg-gray-100 shrink-0 border border-gray-200 overflow-hidden">
        <img src={ci.item.imageUrl} className="w-full h-full object-cover" alt="" />
      </div>
      
      <div className="flex-1 min-w-0">
        <h4 className="text-xs font-semibold text-gray-900 truncate">{ci.item.title}</h4>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] font-mono text-gray-500 font-semibold">{ci.item.sku}</span>
          {ci.item.acquisitionType && (
            <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold border ${getBadgeStyle()}`}>
              {ci.item.acquisitionType}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col items-end gap-1">
        {isEditingPrice ? (
          <form onSubmit={handlePriceSubmit}>
            <input
              autoFocus
              type="number"
              value={tempPrice}
              onChange={e => setTempPrice(e.target.value)}
              onBlur={handlePriceSubmit}
              className="w-18 bg-white border border-[#C85A32] text-xs font-bold text-gray-900 px-1 py-0.5 rounded text-right outline-none font-mono"
            />
          </form>
        ) : (
          <div 
            onClick={() => setIsEditingPrice(true)}
            className="text-xs font-bold text-gray-900 font-mono cursor-pointer hover:text-[#C85A32] transition"
            title="Click to override price"
          >
            R {((ci.overridePrice ?? ci.item.retailPrice) * ci.quantity).toLocaleString()}
          </div>
        )}

        {ci.item.acquisitionType ? (
          <span className="text-[10px] font-mono font-bold text-gray-500 bg-white border border-gray-200 px-2 py-0.5 rounded-lg" title="Unique item — quantity is 1">
            Qty: 1
          </span>
        ) : (
          <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-1 py-0.5">
            <button 
              onClick={() => onUpdateQuantity(ci.item.id, ci.quantity - 1)}
              className="text-gray-400 hover:text-gray-700 p-0.5"
            >
              <Minus className="w-2.5 h-2.5" />
            </button>
            <span className="text-[11px] font-bold text-gray-800 font-mono px-1">{ci.quantity}</span>
            <button 
              onClick={() => onUpdateQuantity(ci.item.id, ci.quantity + 1)}
              className="text-gray-400 hover:text-gray-700 p-0.5"
            >
              <Plus className="w-2.5 h-2.5" />
            </button>
          </div>
        )}
      </div>

      <button 
        onClick={() => onRemove(ci.item.id)}
        className="p-1.5 text-gray-400 hover:text-red-500 transition"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
};

export const Sell: React.FC = () => {
  const { 
    inventory, 
    cart, 
    addToCart, 
    removeFromCart, 
    updateCartItemPrice, 
    updateCartQuantity, 
    clearCart,
    completeCheckout,
    showToast,
    setIsScannerModalOpen
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTender, setSelectedTender] = useState<PaymentMethod>('cash');
  const [cashTendered, setCashTendered] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [receiptType, setReceiptType] = useState<ReceiptDelivery>('thermal');
  const [isInputFocused, setIsInputFocused] = useState(true);
  const isSubmittingRef = useRef(false);
  
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  const floorItems = useMemo(() => {
    return inventory.filter(item => 
      item.status === 'Retail Floor' || 
      item.status === 'Reserved'
    );
  }, [inventory]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return floorItems.slice(0, 16);

    return floorItems.filter(item => 
      item.title.toLowerCase().includes(q) ||
      item.sku.toLowerCase().includes(q) ||
      (item.serialOrImei && item.serialOrImei.toLowerCase().includes(q))
    ).slice(0, 24);
  }, [floorItems, searchQuery]);

  const total = useMemo(() => {
    return cart.reduce((sum, ci) => sum + (ci.overridePrice ?? ci.item.retailPrice) * ci.quantity, 0);
  }, [cart]);

  const numTendered = parseFloat(cashTendered) || 0;
  const changeDue = Math.max(0, numTendered - total);

  const handleBarcodeSearchSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const cleanQuery = searchQuery.trim();
    if (!cleanQuery || isSubmittingRef.current) return;

    isSubmittingRef.current = true;

    const exactMatch = floorItems.find(
      item =>
        item.sku.toLowerCase() === cleanQuery.toLowerCase() ||
        (item.serialOrImei && item.serialOrImei.toLowerCase() === cleanQuery.toLowerCase()) ||
        (item.pawnTicketId && item.pawnTicketId.toLowerCase() === `#${cleanQuery.toLowerCase()}`)
    );

    if (exactMatch) {
      addToCart(exactMatch);
      setSearchQuery('');
      showToast('Item Scanned', `Added ${exactMatch.title} (${exactMatch.sku}) to basket.`, 'success');
    } else if (filteredItems.length === 1) {
      addToCart(filteredItems[0]);
      setSearchQuery('');
      showToast('Item Scanned', `Added ${filteredItems[0].title} (${filteredItems[0].sku}) to basket.`, 'success');
    } else if (filteredItems.length === 0) {
      showToast('Item Not Found', `No available stock matching "${cleanQuery}"`, 'error');
    }
    
    setTimeout(() => {
      isSubmittingRef.current = false;
      searchInputRef.current?.focus();
    }, 100);
  };

  const handleCompleteSale = () => {
    if (cart.length === 0) return;
    
    if (selectedTender === 'cash' && numTendered < total) {
      showToast('Payment Incomplete', `Cash tendered (R${numTendered}) is less than total R${total}`, 'amber');
      return;
    }

    setIsProcessing(true);
    setTimeout(() => {
      completeCheckout(
        selectedTender, 
        selectedTender === 'cash' ? numTendered : total, 
        receiptType
      );
      setCashTendered('');
      setIsProcessing(false);
      setSearchQuery('');
      searchInputRef.current?.focus();
    }, 400);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') { e.preventDefault(); setSelectedTender('cash'); }
      if (e.key === 'F2') { e.preventDefault(); setSelectedTender('card'); }
      if (e.key === 'F3') { e.preventDefault(); setSelectedTender('eft'); }
      if (e.key === 'Escape') { e.preventDefault(); clearCart(); }
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleCompleteSale(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, selectedTender, numTendered, total, receiptType]);

  return (
    <div className="flex-1 flex flex-col lg:flex-row bg-[#F5F6F8] overflow-hidden">
      {/* LEFT AREA: SEARCH & PRODUCT SELECTION */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-gray-200">
        {/* Search Header */}
        <div className="p-5 bg-white border-b border-gray-200 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#FDF0EA] flex items-center justify-center text-[#C85A32]">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900 leading-tight">Sell</h2>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsScannerModalOpen(true)}
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition flex items-center gap-2 text-xs font-semibold"
                title="Open Camera Scanner"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Scanner</span>
              </button>
            </div>
          </div>

          <form onSubmit={handleBarcodeSearchSubmit} className="relative">
            <Barcode className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsInputFocused(true)}
              onBlur={() => setIsInputFocused(false)}
              placeholder="Scan item or search by name / SKU..."
              className="w-full bg-[#F8F9FA] border border-gray-200 focus:border-[#C85A32] focus:bg-white rounded-xl pl-11 pr-4 py-3 text-sm text-gray-900 font-mono placeholder:text-gray-400 transition-all outline-none"
            />
          </form>
        </div>

        {/* Results Grid */}
        <div className="flex-1 overflow-y-auto p-5 no-scrollbar">
          {filteredItems.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => { addToCart(item); setSearchQuery(''); searchInputRef.current?.focus(); }}
                  className="bg-white border border-gray-200 hover:border-[#C85A32] rounded-xl p-3.5 flex flex-col text-left transition group shadow-xs hover:shadow-sm active:scale-98 cursor-pointer"
                >
                  <div className="aspect-square rounded-lg bg-gray-100 mb-2.5 overflow-hidden border border-gray-100">
                    <img src={item.imageUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform" alt="" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xs font-semibold text-gray-900 truncate">{item.title}</h3>
                    <p className="text-[10px] font-mono text-gray-400 font-semibold">{item.sku}</p>
                  </div>
                  <div className="pt-2 border-t border-gray-100 flex items-center justify-between mt-2">
                    <span className="text-sm font-bold text-gray-900 font-mono">
                      R {item.retailPrice.toLocaleString()}
                    </span>
                    <Plus className="w-4 h-4 text-[#C85A32]" />
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-2 py-12">
              <Search className="w-8 h-8 opacity-40" />
              <p className="text-xs font-medium">No items match your search</p>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT AREA: CART & CHECKOUT */}
      <div className="w-full lg:w-[420px] flex flex-col bg-white border-l border-gray-200 shadow-sm">
        {/* Cart Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-[#F8F9FA]">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-gray-500" />
            <h2 className="text-xs font-bold text-gray-800 uppercase tracking-wider">Sale Basket</h2>
          </div>
          <span className="px-2 py-0.5 rounded bg-gray-200/70 text-[11px] font-mono font-semibold text-gray-700">
            {cart.length} {cart.length === 1 ? 'item' : 'items'}
          </span>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 no-scrollbar min-h-[220px]">
          <AnimatePresence mode="popLayout">
            {cart.map(ci => (
              <CartItemRow 
                key={ci.item.id} 
                ci={ci} 
                onRemove={removeFromCart} 
                onUpdatePrice={updateCartItemPrice}
                onUpdateQuantity={updateCartQuantity}
              />
            ))}
          </AnimatePresence>
          {cart.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-2 py-12">
              <div className="w-12 h-12 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center">
                <Barcode className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-xs text-gray-500 text-center font-medium">
                Scan or click stock items to begin checkout
              </p>
            </div>
          )}
        </div>

        {/* Checkout Controls */}
        <div className="p-5 bg-[#F8F9FA] border-t border-gray-200 space-y-4">
          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-baseline text-gray-500">
              <span>Subtotal (excl. VAT)</span>
              <span className="font-mono font-semibold text-gray-800">
                R {(total / 1.15).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between items-baseline text-gray-500">
              <span>VAT (15%)</span>
              <span className="font-mono font-semibold text-gray-800">
                R {(total - (total / 1.15)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between items-baseline pt-2 border-t border-gray-200">
              <span className="text-sm font-bold text-gray-900">Total Due</span>
              <span className="text-2xl font-bold text-[#C85A32] font-mono">
                R {total.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            {/* Tender selector */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'cash', icon: Banknote, label: 'Cash [F1]' },
                { id: 'card', icon: CreditCard, label: 'Card [F2]' },
                { id: 'eft', icon: Smartphone, label: 'EFT [F3]' }
              ].map(method => (
                <button
                  key={method.id}
                  onClick={() => setSelectedTender(method.id as any)}
                  className={`py-2.5 rounded-xl border flex flex-col items-center gap-1 transition ${
                    selectedTender === method.id 
                      ? 'border-[#C85A32] bg-[#FDF0EA] text-[#C85A32] font-bold shadow-xs' 
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <method.icon className="w-4 h-4" />
                  <span className="text-[10px] uppercase font-semibold">{method.label}</span>
                </button>
              ))}
            </div>

            {selectedTender === 'cash' && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                className="space-y-2 overflow-hidden"
              >
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-gray-500 uppercase">Tendered</label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 font-mono text-xs">R</span>
                      <input 
                        type="number" 
                        value={cashTendered}
                        onChange={e => setCashTendered(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-white border border-gray-300 rounded-lg pl-6 pr-2.5 py-1.5 text-sm font-bold text-gray-900 font-mono focus:border-[#C85A32] outline-none"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-gray-500 uppercase">Change Due</label>
                    <div className="w-full bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5 flex items-center justify-end">
                      <span className="text-sm font-bold text-emerald-700 font-mono">
                        R {changeDue.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            <div className="flex items-center gap-1.5 p-1 bg-white rounded-xl border border-gray-200">
               {[
                { id: 'thermal', label: 'Thermal Print', icon: Printer },
                { id: 'whatsapp', label: 'WhatsApp', icon: Smartphone },
                { id: 'none', label: 'No Receipt', icon: X }
               ].map(rt => (
                 <button
                  key={rt.id}
                  onClick={() => setReceiptType(rt.id as any)}
                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-semibold flex items-center justify-center gap-1.5 transition ${
                    receiptType === rt.id ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-800'
                  }`}
                 >
                   <rt.icon className="w-3 h-3" />
                   {rt.label}
                 </button>
               ))}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button 
              onClick={clearCart}
              className="p-3 rounded-xl border border-gray-200 text-gray-500 hover:text-red-500 hover:border-red-300 transition"
              title="Clear Basket [Esc]"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button 
              onClick={handleCompleteSale}
              disabled={isProcessing || cart.length === 0}
              className="flex-1 py-3 rounded-xl bg-[#C85A32] disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold text-xs shadow-xs hover:bg-[#A94725] transition flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Finalise Sale</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
