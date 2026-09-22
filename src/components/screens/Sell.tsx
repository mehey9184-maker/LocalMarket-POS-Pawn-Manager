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

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="p-3 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl flex items-center gap-3"
    >
      <div className="w-10 h-10 rounded-lg bg-black shrink-0 border border-gray-800 overflow-hidden">
        <img src={ci.item.imageUrl} className="w-full h-full object-cover" alt="" />
      </div>
      
      <div className="flex-1 min-w-0">
        <h4 className="text-xs font-bold text-white truncate">{ci.item.title}</h4>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[9px] font-mono text-gray-500 uppercase">{ci.item.sku}</span>
          {ci.item.acquisitionType && (
            <span className="text-[8px] px-1 bg-gray-800 text-gray-400 rounded-sm font-black uppercase tracking-tighter">
              {ci.item.acquisitionType === 'Buy' ? 'Direct Purchase' : 'Forfeited Pawn'}
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
              onChange={(e) => setTempPrice(e.target.value)}
              onBlur={handlePriceSubmit}
              className="w-16 bg-black border border-[#C85A32] rounded px-1 py-0.5 text-[10px] font-mono text-white text-right outline-none"
            />
          </form>
        ) : (
          <button
            onClick={() => setIsEditingPrice(true)}
            className={`text-xs font-black font-mono tracking-tight tabular-nums ${
              ci.overridePrice ? 'text-emerald-400' : 'text-white'
            }`}
          >
            R {(ci.overridePrice ?? ci.item.retailPrice).toFixed(2)}
          </button>
        )}
        <div className="flex items-center gap-2">
           <button 
            onClick={() => onRemove(ci.item.id)}
            className="text-gray-600 hover:text-red-500 transition"
           >
            <Trash2 className="w-3 h-3" />
           </button>
        </div>
      </div>
    </motion.div>
  );
};

export const Sell: React.FC = () => {
  const {
    inventory,
    cart,
    addToCart,
    removeFromCart,
    clearCart,
    completeCheckout,
    updateCartItemPrice,
    updateCartQuantity,
    setIsScannerModalOpen,
    showToast
  } = useApp();

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTender, setSelectedTender] = useState<PaymentMethod>('cash');
  const [cashTendered, setCashTendered] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [receiptType, setReceiptType] = useState<ReceiptDelivery>('thermal');
  
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus search on mount and after actions
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
    if (!q) return floorItems.slice(0, 12); // Show recent/popular if no search

    return floorItems.filter(item => 
      item.title.toLowerCase().includes(q) ||
      item.sku.toLowerCase().includes(q) ||
      item.serialOrImei.toLowerCase().includes(q)
    ).slice(0, 20);
  }, [floorItems, searchQuery]);

  const total = useMemo(() => {
    return cart.reduce((sum, ci) => sum + (ci.overridePrice ?? ci.item.retailPrice) * ci.quantity, 0);
  }, [cart]);

  const numTendered = parseFloat(cashTendered) || 0;
  const changeDue = Math.max(0, numTendered - total);

  const handleBarcodeSearchSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!searchQuery.trim()) return;

    const exactMatch = floorItems.find(
      item =>
        item.sku.toLowerCase() === searchQuery.trim().toLowerCase() ||
        item.serialOrImei.toLowerCase() === searchQuery.trim().toLowerCase()
    );

    if (exactMatch) {
      addToCart(exactMatch);
      setSearchQuery('');
    } else if (filteredItems.length === 1) {
      addToCart(filteredItems[0]);
      setSearchQuery('');
    } else if (filteredItems.length === 0) {
      showToast('Item Not Found', `No stock matching "${searchQuery}"`, 'error');
    }
    
    searchInputRef.current?.focus();
  };

  const handleCompleteSale = () => {
    if (cart.length === 0) return;
    
    if (selectedTender === 'cash' && numTendered < total) {
      showToast('Payment Incomplete', `Cash tendered (R${numTendered}) is less than total`, 'amber');
      return;
    }

    setIsProcessing(true);
    // Simulate slight delay for professional feel
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

  // Keyboard Shortcuts
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
    <div className="flex-1 flex flex-col lg:flex-row bg-[#121212] overflow-hidden">
      {/* LEFT AREA: SEARCH & PRODUCT SELECTION */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-[#2A2A2A]">
        {/* Search Header */}
        <div className="p-6 bg-[#1A1A1A] border-b border-[#2A2A2A] space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#C85A32]/10 flex items-center justify-center text-[#E87A5D]">
                <Zap className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-black text-white uppercase tracking-tight">Retail POS</h2>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Active Shift: Terminal 01</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsScannerModalOpen(true)}
                className="p-3 rounded-xl bg-[#252525] border border-gray-800 text-gray-400 hover:text-white transition"
                title="Open Camera Scanner"
              >
                <Camera className="w-5 h-5" />
              </button>
            </div>
          </div>

          <form onSubmit={handleBarcodeSearchSubmit} className="relative">
            <Barcode className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-[#C85A32]" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="SCAN BARCODE OR TYPE SEARCH..."
              className="w-full bg-[#0A0A0A] border-2 border-[#2A2A2A] focus:border-[#C85A32] rounded-2xl pl-14 pr-4 py-5 text-xl text-white font-mono placeholder-gray-800 transition-all outline-none"
            />
          </form>
        </div>

        {/* Results Grid */}
        <div className="flex-1 overflow-y-auto p-6 no-scrollbar">
          {filteredItems.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => { addToCart(item); setSearchQuery(''); searchInputRef.current?.focus(); }}
                  className="bg-[#1A1A1A] border border-[#2A2A2A] hover:border-[#C85A32] rounded-2xl p-4 flex flex-col text-left transition group active:scale-95"
                >
                  <div className="aspect-square rounded-xl bg-black mb-3 overflow-hidden border border-gray-800">
                    <img src={item.imageUrl} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition" alt="" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-mono text-gray-500 uppercase mb-1">{item.sku}</p>
                    <h3 className="text-xs font-bold text-white truncate mb-1">{item.title}</h3>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-[8px] px-1.5 py-0.5 rounded-sm bg-emerald-500/10 text-emerald-400 font-black uppercase tracking-tighter border border-emerald-500/20">
                        {item.status}
                      </span>
                      {item.acquisitionType && (
                        <span className="text-[8px] font-bold text-gray-600 uppercase tracking-widest">{item.acquisitionType}</span>
                      )}
                    </div>
                  </div>
                  <div className="pt-3 border-t border-[#2A2A2A] flex items-center justify-between">
                    <span className="text-sm font-black text-[#E87A5D] font-mono">R {item.retailPrice.toLocaleString()}</span>
                    <Plus className="w-4 h-4 text-gray-700 group-hover:text-[#E87A5D]" />
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-600 space-y-4">
              <Search className="w-12 h-12 opacity-20" />
              <p className="text-xs font-black uppercase tracking-[0.2em]">No Items Matching Search</p>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT AREA: CART & CHECKOUT */}
      <div className="w-full lg:w-[450px] flex flex-col bg-[#0A0A0A]">
        {/* Cart Header */}
        <div className="p-6 border-b border-[#2A2A2A] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-gray-500" />
            <h2 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em]">Current Basket</h2>
          </div>
          <span className="px-2 py-1 rounded bg-[#1A1A1A] text-[10px] font-mono text-gray-500">{cart.length} ITEMS</span>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3 no-scrollbar">
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
            <div className="h-full flex flex-col items-center justify-center text-gray-700 space-y-3 py-10 opacity-30">
              <div className="w-16 h-16 rounded-full border-2 border-dashed border-gray-700 flex items-center justify-center">
                <Barcode className="w-8 h-8" />
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-center">Scan items to<br/>populate basket</p>
            </div>
          )}
        </div>

        {/* Checkout Controls */}
        <div className="p-6 bg-[#121212] border-t border-[#2A2A2A] space-y-6 shadow-[0_-10px_40px_rgba(0,0,0,0.4)]">
          <div className="space-y-4">
            <div className="flex justify-between items-end border-b border-gray-800 pb-4">
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Subtotal</span>
              <span className="text-xl font-bold text-gray-300 font-mono">R {(total / 1.15).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between items-end border-b border-gray-800 pb-4">
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">VAT (15%)</span>
              <span className="text-xl font-bold text-gray-300 font-mono">R {(total - (total / 1.15)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between items-end">
              <span className="text-xs font-black text-white uppercase tracking-[0.3em]">Total Amount</span>
              <span className="text-4xl font-black text-[#E87A5D] font-mono">R {total.toLocaleString()}</span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'cash', icon: Banknote, label: 'Cash [F1]' },
                { id: 'card', icon: CreditCard, label: 'Card [F2]' },
                { id: 'eft', icon: Smartphone, label: 'EFT [F3]' }
              ].map(method => (
                <button
                  key={method.id}
                  onClick={() => setSelectedTender(method.id as any)}
                  className={`py-4 rounded-2xl border flex flex-col items-center gap-2 transition ${
                    selectedTender === method.id 
                      ? 'border-[#C85A32] bg-[#C85A32]/10 text-[#E87A5D]' 
                      : 'border-gray-800 text-gray-600 hover:border-gray-700'
                  }`}
                >
                  <method.icon className="w-5 h-5" />
                  <span className="text-[8px] font-black uppercase tracking-widest">{method.label}</span>
                </button>
              ))}
            </div>

            {selectedTender === 'cash' && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                className="space-y-4 overflow-hidden"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Tendered</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-mono text-sm">R</span>
                      <input 
                        type="number" 
                        value={cashTendered}
                        onChange={e => setCashTendered(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-black border border-gray-800 rounded-xl pl-8 pr-4 py-3 text-lg font-black text-white font-mono focus:border-[#C85A32] outline-none"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Change Due</label>
                    <div className="w-full bg-[#1A1A1A] border border-emerald-500/20 rounded-xl px-4 py-3 flex items-center justify-end">
                      <span className="text-xl font-black text-emerald-400 font-mono">R {changeDue.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            <div className="flex items-center gap-2 p-2 bg-[#1A1A1A] rounded-xl border border-gray-800">
               {[
                { id: 'thermal', label: 'Thermal Print', icon: Printer },
                { id: 'whatsapp', label: 'Digital WA', icon: Smartphone },
                { id: 'none', label: 'No Receipt', icon: X }
               ].map(rt => (
                 <button
                  key={rt.id}
                  onClick={() => setReceiptType(rt.id as any)}
                  className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-tighter flex items-center justify-center gap-2 transition ${
                    receiptType === rt.id ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'
                  }`}
                 >
                   <rt.icon className="w-3 h-3" />
                   {rt.label}
                 </button>
               ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button 
              onClick={clearCart}
              className="p-5 rounded-2xl border border-gray-800 text-gray-500 hover:text-red-500 hover:border-red-500/30 transition active:scale-95"
              title="Clear Basket [Esc]"
            >
              <Trash2 className="w-6 h-6" />
            </button>
            <button 
              onClick={handleCompleteSale}
              disabled={isProcessing || cart.length === 0}
              className="flex-1 py-5 rounded-2xl bg-[#C85A32] disabled:bg-gray-800 disabled:text-gray-500 text-white font-black uppercase tracking-[0.2em] shadow-2xl shadow-[#C85A32]/20 hover:bg-[#b04d29] transition active:scale-[0.98] flex items-center justify-center gap-3"
            >
              {isProcessing ? (
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
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
