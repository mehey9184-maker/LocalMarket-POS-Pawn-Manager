import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { PaymentMethod, ReceiptDelivery, InventoryItem } from '../../types';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'motion/react';
import {
  Barcode,
  Search,
  Camera,
  ShoppingBag,
  Trash2,
  Printer,
  MessageSquare,
  CreditCard,
  Banknote,
  SendHorizontal,
  CheckCircle2,
  Check,
  Split,
  Layers,
  Store,
  X,
  Fingerprint,
  Calendar,
  User,
  Tag,
  ShieldCheck,
  Cpu,
  History,
  Edit3
} from 'lucide-react';

const CartItemRow: React.FC<{ ci: any; onRemove: (id: string) => void; onUpdatePrice: (id: string, price: number) => void }> = ({ ci, onRemove, onUpdatePrice }) => {
  const x = useMotionValue(0);
  const [hasVibrated, setHasVibrated] = React.useState(false);
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

  // Dynamic transforms for visual feedback
  const iconScale = useTransform(x, [0, -60, -100], [0.6, 1.1, 1.3]);
  const bgOpacity = useTransform(x, [0, -40], [0, 1]);
  const overlayOpacity = useTransform(x, [0, -100], [0, 0.5]);
  const buttonOpacity = useTransform(x, [0, -30, -60], [0, 0, 1]);
  const buttonX = useTransform(x, [0, -60], [20, 0]);

  // Haptic Feedback Simulation (Visual Pulse + Browser Vibration)
  React.useEffect(() => {
    return x.on('change', (latest) => {
      if (latest < -60 && !hasVibrated) {
        if ('vibrate' in navigator) navigator.vibrate(15);
        setHasVibrated(true);
      } else if (latest > -50 && hasVibrated) {
        setHasVibrated(false);
      }
    });
  }, [x, hasVibrated]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -100 }}
      className="relative group overflow-hidden rounded-2xl h-[80px]"
    >
      {/* Swipe Background (Action reveal) */}
      <motion.div 
        style={{ opacity: bgOpacity }}
        className="absolute inset-0 bg-red-600 flex items-center justify-end px-4 rounded-xl border border-red-500/30"
      >
        <motion.div 
          style={{ x: buttonX, opacity: buttonOpacity }}
          className="flex items-center gap-2"
        >
          <span className="text-[10px] font-bold text-white uppercase tracking-wider font-mono">Delete Item</span>
          <motion.div style={{ scale: iconScale }} className="p-2 bg-white/10 rounded-lg">
            <Trash2 className="w-5 h-5 text-white" />
          </motion.div>
        </motion.div>
      </motion.div>

      <motion.div
        drag="x"
        dragConstraints={{ left: -100, right: 0 }}
        dragSnapToOrigin
        style={{ x }}
        onDragEnd={(_, info) => {
          if (info.offset.x < -60) {
            onRemove(ci.item.id);
          }
        }}
        whileDrag={{ 
          scale: 0.98,
          transition: { type: "spring", stiffness: 400, damping: 25 } 
        }}
        animate={hasVibrated ? { scale: 0.97, transition: { duration: 0.1 } } : { scale: 1 }}
        className="p-4 rounded-2xl bg-[#1A1A1A] border border-[#2A2A2A] flex items-center justify-between gap-4 transition hover:border-[#383838] relative z-10 cursor-grab active:cursor-grabbing shadow-xl"
      >
        {/* Tactile Overlay */}
        <motion.div 
          style={{ opacity: overlayOpacity }}
          className="absolute inset-0 bg-black/60 pointer-events-none rounded-xl"
        />

        {/* Left side: Item Title + minimal serial number snippet */}
        <div className="min-w-0 flex-1 relative z-20">
          <p className="text-sm font-medium text-gray-100 truncate">{ci.item.title}</p>
          <p className="text-[10px] text-gray-500 font-mono tracking-tighter truncate">
            {ci.item.sku}
          </p>
        </div>

        {/* Right side: Price and single trash bin icon */}
        <div className="flex items-center gap-2 shrink-0 relative z-20">
          {isEditingPrice ? (
            <form onSubmit={handlePriceSubmit}>
              <input
                autoFocus
                type="number"
                value={tempPrice}
                onChange={(e) => setTempPrice(e.target.value)}
                onBlur={handlePriceSubmit}
                className="w-16 bg-[#1E1E1E] border border-[#C85A32] rounded px-1 py-0.5 text-xs font-mono text-white text-right focus:outline-none"
              />
            </form>
          ) : (
            <button
              onClick={() => setIsEditingPrice(true)}
              className={`text-xs font-mono font-bold tabular-nums tracking-tight px-1 rounded transition ${
                ci.overridePrice ? 'text-emerald-400 bg-emerald-400/10' : 'text-white hover:bg-white/5'
              }`}
            >
              R {(ci.overridePrice ?? ci.item.retailPrice).toFixed(2)}
            </button>
          )}
          <button
            type="button"
            onClick={() => onRemove(ci.item.id)}
            className="p-1 rounded text-gray-500 hover:text-red-400 hover:bg-[#2A2A2A] transition"
            title="Remove item"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export const PosTerminal: React.FC = () => {
  const {
    inventory,
    cart,
    addToCart,
    removeFromCart,
    clearCart,
    completeCheckout,
    updateCartItemPrice,
    setIsScannerModalOpen,
    showToast
  } = useApp();

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPill, setFilterPill] = useState<'all' | 'forfeited' | 'buy' | 'general'>('all');

  // Tender & Checkout state
  const [selectedTender, setSelectedTender] = useState<PaymentMethod>('cash');
  const [isSplitMode, setIsSplitMode] = useState(false);
  const [splitCashAmount, setSplitCashAmount] = useState<number>(0);
  const [receiptType, setReceiptType] = useState<ReceiptDelivery>('thermal');

  // UI Animation Triggers
  const [lastCartCount, setLastCartCount] = useState(cart.length);
  const [pulseKey, setPulseKey] = useState(0);

  // TRIGGER BOUNCE EFFECT ON ITEM ADDITION
  React.useEffect(() => {
    if (cart.length > lastCartCount) {
      setPulseKey(prev => prev + 1);
    }
    setLastCartCount(cart.length);
  }, [cart.length, lastCartCount]);
  const [customerMobile, setCustomerMobile] = useState('+27 82 491 0023');
  const [cashTendered, setCashTendered] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedItemForDetail, setSelectedItemForDetail] = useState<InventoryItem | null>(null);

  // Available floor inventory
  const floorItems = useMemo(() => {
    return inventory.filter(item => item.status === 'Retail Floor');
  }, [inventory]);

  // Counts for pills
  const counts = useMemo(() => {
    return {
      all: floorItems.length,
      forfeited: floorItems.filter(i => i.acquisitionType === 'Forfeited').length,
      buy: floorItems.filter(i => i.acquisitionType === 'Buy').length,
      general: floorItems.filter(i => i.category === 'Appliances' || i.category === 'Power Tools').length
    };
  }, [floorItems]);

  // Filter items
  const filteredItems = useMemo(() => {
    return floorItems.filter(item => {
      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        item.title.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q) ||
        item.serialOrImei.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q);

      if (!matchQuery) return false;

      if (filterPill === 'forfeited') return item.acquisitionType === 'Forfeited';
      if (filterPill === 'buy') return item.acquisitionType === 'Buy';
      if (filterPill === 'general') return item.category === 'Appliances' || item.category === 'Power Tools';

      return true;
    });
  }, [floorItems, searchQuery, filterPill]);

  // Financial Totals
  const subtotal = useMemo(() => {
    return cart.reduce((sum, ci) => sum + (ci.overridePrice ?? ci.item.retailPrice) * ci.quantity, 0);
  }, [cart]);

  const vatAmount = subtotal * (15 / 115); // 15% RSA VAT inclusive
  const total = subtotal;

  const numTendered = parseFloat(cashTendered) || total;
  const changeDue = Math.max(0, numTendered - total);

  // Split calculations
  const splitCardAmount = Math.max(0, total - (splitCashAmount || 0));

  const handleBarcodeSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
    } else {
      showToast('Scan Filter', `Matching floor items filtered: "${searchQuery}"`, 'info');
    }
  };

  const handleCompleteSale = () => {
    if (cart.length === 0) {
      showToast('Cart Empty', 'Select or scan items before tendering sale', 'amber');
      return;
    }

    if (selectedTender === 'cash' && !isSplitMode && cashTendered && parseFloat(cashTendered) < total) {
      showToast('Insufficient Cash', `Tendered R ${parseFloat(cashTendered).toFixed(2)} is less than total R ${total.toFixed(2)}`, 'amber');
      return;
    }

    setIsProcessing(true);
    setTimeout(() => {
      const finalTender = isSplitMode ? 'card' : selectedTender;
      const amount = isSplitMode ? total : (selectedTender === 'cash' ? numTendered : total);

      completeCheckout(
        finalTender,
        amount,
        receiptType,
        receiptType === 'whatsapp' ? customerMobile : undefined
      );

      setCashTendered('');
      setIsSplitMode(false);
      setIsProcessing(false);
    }, 500);
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-full w-full overflow-hidden bg-[#121212]">
      {/* ============================================================
          LEFT PANE: HIGH-VELOCITY COMMAND CENTER (DYNAMIC WIDTH)
         ============================================================ */}
      <motion.section 
        layout
        initial={false}
        animate={{ width: cart.length === 0 ? '100%' : '60%' }}
        transition={{ duration: 0.3, ease: "circOut" }}
        className="flex flex-col h-full overflow-hidden border-r border-[#2A2A2A] bg-[#0A0A0A]"
      >
        {/* HERO COMMAND BAR: SEARCH IS THE MAIN CHARACTER */}
        <div className="p-6 bg-[#121212] border-b border-[#2A2A2A] space-y-6 shrink-0 shadow-2xl z-20">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Checkout Terminal</h2>
              <p className="text-xs text-gray-500">Scan items or lookup inventory to begin</p>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsScannerModalOpen(true)}
                className="p-2.5 rounded-xl bg-[#1E1E1E] border border-[#2A2A2A] text-gray-400 hover:text-[#E87A5D] transition"
                title="Open Scanner"
              >
                <Camera className="w-5 h-5" />
              </button>
              {cart.length === 0 && (
                <div className="flex items-center gap-2 px-3 py-2 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl text-[10px] font-bold text-gray-500 uppercase tracking-widest animate-pulse">
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>Tray Empty</span>
                </div>
              )}
            </div>
          </div>

          <form onSubmit={handleBarcodeSearchSubmit} className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#C85A32]">
              <Barcode className="w-6 h-6" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="START SCANNING OR SEARCH SKU..."
              className="w-full pl-12 pr-4 py-4 bg-[#141414] border-2 border-[#2A2A2A] focus:border-[#C85A32] rounded-2xl text-lg text-white placeholder-gray-700 font-mono transition-all shadow-2xl focus:ring-4 focus:ring-[#C85A32]/10"
              autoFocus
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 hidden md:flex items-center gap-2">
              <kbd className="px-2 py-1 bg-[#1E1E1E] border border-[#2A2A2A] rounded text-[10px] text-gray-500 font-mono">F1</kbd>
              <kbd className="px-2 py-1 bg-[#1E1E1E] border border-[#2A2A2A] rounded text-[10px] text-gray-500 font-mono">ENTER</kbd>
            </div>
          </form>

          {/* COMPACT FILTER PILLS */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {[
              { id: 'all', label: 'All Stock', count: counts.all },
              { id: 'forfeited', label: 'Forfeited', count: counts.forfeited },
              { id: 'buy', label: 'Direct Buys', count: counts.buy },
              { id: 'general', label: 'General', count: counts.general }
            ].map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => setFilterPill(p.id as any)}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition whitespace-nowrap flex items-center gap-2 border ${
                  filterPill === p.id
                    ? 'bg-[#C85A32] text-white border-[#C85A32] shadow-md shadow-[#C85A32]/10'
                    : 'bg-[#141414] text-gray-500 border-[#2A2A2A] hover:text-gray-300 hover:border-[#383838]'
                }`}
              >
                <span>{p.label}</span>
                <span className="opacity-60 font-mono">[{p.count}]</span>
              </button>
            ))}
          </div>
        </div>

        {/* VISUAL PRODUCT CARDS GRID */}
        <div className="flex-1 overflow-y-auto p-3.5 lg:p-4">
          {filteredItems.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-gray-500">
              <Search className="w-10 h-10 text-[#2A2A2A] mb-2" />
              <p className="text-sm font-medium text-gray-400">No matching floor stock found</p>
              <p className="text-xs text-gray-500 mt-1">Try resetting the filter or scanning an item barcode</p>
            </div>
          ) : (
            <div className={`grid gap-3 transition-all duration-300 ${
              cart.length === 0 
                ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6' 
                : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3'
            }`}>
              {filteredItems.map(item => {
                const inCart = cart.some(c => c.item.id === item.id);
                return (
                  <article
                    key={item.id}
                    onClick={() => setSelectedItemForDetail(item)}
                    className={`bg-[#1E1E1E] border rounded-xl p-3 flex flex-col justify-between transition cursor-pointer group ${
                      inCart
                        ? 'border-[#C85A32] bg-[#221714]'
                        : 'border-[#2A2A2A] hover:border-[#C85A32]'
                    }`}
                  >
                    <div>
                      {/* Acquisition Badge & SKU */}
                      <div className="flex items-center justify-between mb-2">
                        {item.acquisitionType === 'Forfeited' ? (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-950/70 text-amber-400 border border-amber-800/40 font-mono">
                            Forfeited Pawn
                          </span>
                        ) : (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-950/70 text-blue-400 border border-blue-800/40 font-mono">
                            Direct Buy
                          </span>
                        )}
                        <span className="text-[10px] text-gray-500 font-mono">#{item.sku}</span>
                      </div>

                      {/* Thumbnail & Title */}
                      <div className="flex gap-2.5 items-center">
                        <div className="w-14 h-14 rounded-lg overflow-hidden bg-[#121212] border border-[#2A2A2A] shrink-0">
                          <img
                            src={item.imageUrl}
                            alt={item.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            loading="lazy"
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <h3 className="text-xs font-semibold text-gray-100 group-hover:text-white line-clamp-1">
                            {item.title}
                          </h3>
                          <p className="text-[10px] text-gray-400 mt-0.5 truncate">
                            Cond: <span className="text-gray-300 font-medium">{item.condition}</span>
                          </p>
                          <p className="text-[10px] text-gray-500 font-mono mt-0.5 truncate">
                            SN: {item.serialOrImei}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Price & Add indicator */}
                    <div className="mt-2.5 pt-2 border-t border-[#2A2A2A] flex items-center justify-between">
                      <span className="text-sm font-bold text-[#C85A32] font-mono tabular-nums tracking-tight">
                        R {item.retailPrice.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                      </span>

                      {inCart ? (
                        <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium">
                          <Check className="w-3 h-3" />
                          <span>In Cart</span>
                        </span>
                      ) : (
                        <span className="text-[11px] text-gray-400 group-hover:text-white transition">
                          + Add
                        </span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </motion.section>

      {/* ============================================================
          RIGHT PANE: ACTIVE ORDER TRAY & CHECKOUT PANEL (40% WIDTH)
         ============================================================ */}
      <AnimatePresence mode="wait">
        {cart.length > 0 ? (
          <motion.section 
            key="active-tray"
            initial={{ x: 20, opacity: 0, width: 0 }}
            animate={{ x: 0, opacity: 1, width: '40%' }}
            exit={{ x: 20, opacity: 0, width: 0 }}
            transition={{ duration: 0.3, ease: "circOut" }}
            className="hidden lg:flex flex-col h-full overflow-hidden bg-[#1E1E1E] border-l border-[#2A2A2A]"
          >
            {/* HEADER: CURRENT ORDER TRAY */}
            <div className="px-6 py-4 bg-[#1A1A1A] border-b border-[#2A2A2A] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#252525] rounded-xl border border-[#333333]">
                  <ShoppingBag className="w-4 h-4 text-[#E87A5D]" />
                </div>
                <div>
                  <h2 className="text-[11px] font-black text-gray-400 uppercase tracking-widest">
                    Active Session
                  </h2>
                  <p className="text-xs font-bold text-gray-100 font-headline">
                    {cart.reduce((n, c) => n + c.quantity, 0)} {cart.length === 1 ? 'Product' : 'Products'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={clearCart}
                className="p-2 text-gray-500 hover:text-red-400 transition bg-[#141414] hover:bg-red-900/10 rounded-lg border border-[#2A2A2A] hover:border-red-900/30"
                title="Clear all items from tray"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* SCROLLABLE ORDER LIST */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
              <AnimatePresence initial={false}>
                {cart.map(ci => (
                  <CartItemRow 
                    key={ci.item.id} 
                    ci={ci} 
                    onRemove={removeFromCart} 
                    onUpdatePrice={updateCartItemPrice}
                  />
                ))}
              </AnimatePresence>
            </div>

            {/* ============================================================
                INTEGRATED CHECKOUT & PAYMENT DOCK (STICKY BOTTOM PANEL)
               ============================================================ */}
            <div className="p-6 bg-[#161616] border-t border-[#2A2A2A] space-y-6 shrink-0 shadow-2xl">
              {/* Financial Summary */}
              <div className="flex items-end justify-between">
                <div className="space-y-1">
                  <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest block">Total Payable</span>
                  <span className="text-3xl font-black font-mono text-[#E87A5D]">
                    R {total.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => setIsSplitMode(!isSplitMode)}
                    className={`flex items-center gap-1.5 transition text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg border ${
                      isSplitMode 
                        ? 'bg-[#E87A5D] border-[#E87A5D] text-white' 
                        : 'bg-[#1E1E1E] border-[#2A2A2A] text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    <Split className="w-3 h-3" />
                    <span>Split Pay</span>
                  </button>
                </div>
              </div>

              {/* Payment Methods Grid - Streamlined */}
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'cash', icon: Banknote, label: 'Cash', color: 'text-emerald-400' },
                    { id: 'card', icon: CreditCard, label: 'Card', color: 'text-blue-400' },
                    { id: 'eft', icon: SendHorizontal, label: 'EFT', color: 'text-amber-400' }
                  ].map((method) => (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => {
                        setSelectedTender(method.id as any);
                        setIsSplitMode(false);
                      }}
                      className={`py-3 px-2 rounded-2xl border flex flex-col items-center justify-center gap-2 transition-all ${
                        selectedTender === method.id && !isSplitMode
                          ? 'bg-[#1E1E1E] border-[#C85A32] text-white shadow-lg'
                          : 'bg-[#121212] border-[#2A2A2A] text-gray-500 hover:bg-[#1A1A1A] hover:text-gray-300'
                      }`}
                    >
                      <method.icon className={`w-5 h-5 ${selectedTender === method.id ? method.color : 'opacity-40'}`} />
                      <span className="text-[10px] font-black uppercase tracking-widest">{method.label}</span>
                    </button>
                  ))}
                </div>

                {/* Conditional Inputs (Split or Cash) */}
                <AnimatePresence mode="popLayout">
                  {isSplitMode && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 bg-[#121212] rounded-2xl border border-[#2A2A2A] space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Cash Portion</span>
                        <div className="relative w-32">
                          <span className="absolute left-3 top-2 text-gray-600 font-mono text-xs">R</span>
                          <input
                            type="number"
                            value={splitCashAmount || ''}
                            onChange={(e) => setSplitCashAmount(Number(e.target.value))}
                            className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl pl-7 pr-3 py-2 text-right font-mono text-sm text-white focus:outline-none focus:border-[#C85A32]"
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-[#1E1E1E]">
                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Card Portion</span>
                        <span className="text-sm font-bold text-white font-mono">R {splitCardAmount.toFixed(2)}</span>
                      </div>
                    </motion.div>
                  )}

                  {selectedTender === 'cash' && !isSplitMode && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 bg-[#121212] rounded-2xl border border-[#2A2A2A] space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Cash Tendered</span>
                        <div className="relative w-32">
                          <span className="absolute left-3 top-2 text-gray-600 font-mono text-xs">R</span>
                          <input
                            type="number"
                            value={cashTendered}
                            onChange={(e) => setCashTendered(e.target.value)}
                            className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl pl-7 pr-3 py-2 text-right font-mono text-sm text-white focus:outline-none focus:border-[#C85A32]"
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-[#1E1E1E]">
                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Change Due</span>
                        <span className="text-lg font-black text-emerald-400 font-mono">R {changeDue.toFixed(2)}</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Receipt Options - Mini Toggles */}
              <div className="flex items-center justify-center gap-6 py-2 border-y border-[#2A2A2A]/50">
                <button 
                  onClick={() => setReceiptType('thermal')}
                  className={`flex items-center gap-2 transition ${receiptType === 'thermal' ? 'text-gray-100' : 'text-gray-600'}`}
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Slip</span>
                </button>
                <div className="w-[1px] h-3 bg-[#2A2A2A]" />
                <button 
                  onClick={() => setReceiptType('whatsapp')}
                  className={`flex items-center gap-2 transition ${receiptType === 'whatsapp' ? 'text-emerald-400' : 'text-gray-600'}`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-black uppercase tracking-widest">WhatsApp</span>
                </button>
              </div>

              {receiptType === 'whatsapp' && (
                <motion.input
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  type="text"
                  value={customerMobile}
                  onChange={(e) => setCustomerMobile(e.target.value)}
                  placeholder="Recipient Mobile..."
                  className="w-full bg-[#121212] border border-[#2A2A2A] rounded-xl px-4 py-3 text-xs text-white font-mono focus:border-emerald-500 focus:outline-none shadow-inner"
                />
              )}

              {/* Final Transaction Trigger */}
              <button
                type="button"
                disabled={cart.length === 0 || isProcessing}
                onClick={handleCompleteSale}
                className={`w-full py-5 rounded-2xl text-xs font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 shadow-2xl transition active:scale-[0.99] ${
                  cart.length === 0 || isProcessing
                    ? 'bg-[#2A2A2A] text-gray-600 cursor-not-allowed'
                    : 'bg-[#C85A32] hover:bg-[#b04d29] text-white shadow-[#C85A32]/20'
                }`}
              >
                {isProcessing ? (
                  <span className="animate-pulse">Finalizing Transaction...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    <span>Process Session</span>
                  </>
                )}
              </button>
            </div>
          </motion.section>
        ) : (
          <motion.section
            key="empty-tray"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="hidden lg:flex flex-col h-full bg-[#121212] border-l border-[#2A2A2A] items-center justify-center p-8 text-center"
            style={{ width: 0, overflow: 'hidden' }}
          >
            <div className="opacity-20 flex flex-col items-center">
              <ShoppingBag className="w-12 h-12 text-gray-400 mb-4" />
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500">Cart Empty</p>
              <p className="text-[10px] text-gray-600 mt-2 max-w-[200px]">Select items to begin transaction flow</p>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* ============================================================
          PRODUCT DETAIL MODAL (OVERLAY)
         ============================================================ */}
      <AnimatePresence>
        {selectedItemForDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedItemForDetail(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-[#1E1E1E] border border-[#2A2A2A] rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              {/* Product Header / Image */}
              <div className="relative h-64 bg-[#121212] shrink-0">
                <img 
                  src={selectedItemForDetail.imageUrl} 
                  alt={selectedItemForDetail.title}
                  className="w-full h-full object-cover opacity-80"
                />
                <button
                  onClick={() => setSelectedItemForDetail(null)}
                  className="absolute top-4 right-4 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white transition backdrop-blur-md z-10"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="absolute inset-0 bg-gradient-to-t from-[#1E1E1E] via-[#1E1E1E]/40 to-transparent"></div>
                <div className="absolute bottom-0 left-0 right-0 p-8">
                  <div className="flex items-center gap-3 mb-3">
                    <span className={`text-[10px] px-2.5 py-1 rounded-lg font-black uppercase tracking-widest ${
                      selectedItemForDetail.acquisitionType === 'Forfeited' 
                        ? 'bg-amber-500 text-black' 
                        : 'bg-blue-500 text-white'
                    }`}>
                      {selectedItemForDetail.acquisitionType}
                    </span>
                    <span className="text-[10px] text-gray-300 font-mono bg-black/40 px-2 py-1 rounded-lg border border-white/10 backdrop-blur-md">
                      SKU: {selectedItemForDetail.sku}
                    </span>
                  </div>
                  <h3 className="text-3xl font-black text-white font-headline leading-tight tracking-tighter">
                    {selectedItemForDetail.title}
                  </h3>
                </div>
              </div>

              {/* Scrollable Content Area */}
              <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                {/* Core Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest flex items-center gap-2">
                      <Calendar className="w-3 h-3 text-[#C85A32]" />
                      Acquired
                    </span>
                    <p className="text-sm text-gray-100 font-mono font-bold">
                      {new Date(selectedItemForDetail.addedAt).toLocaleDateString('en-ZA')}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest flex items-center gap-2">
                      <User className="w-3 h-3 text-[#C85A32]" />
                      Source
                    </span>
                    <p className="text-sm text-gray-100 font-bold truncate">
                      {selectedItemForDetail.acquisitionType === 'Forfeited' ? 'Vault Liquidation' : 'Walk-in Intake'}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest flex items-center gap-2">
                      <Tag className="w-3 h-3 text-[#C85A32]" />
                      Floor Price
                    </span>
                    <p className="text-xl font-black text-[#E87A5D] font-mono">
                      R {selectedItemForDetail.retailPrice.toLocaleString('en-ZA')}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest flex items-center gap-2">
                      <ShieldCheck className="w-3 h-3 text-[#C85A32]" />
                      Grade
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                      <p className="text-sm text-gray-100 font-black uppercase italic">{selectedItemForDetail.condition}</p>
                    </div>
                  </div>
                </div>

                {/* Technical Specs & Metadata */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div className="p-5 bg-[#141414] border border-[#2A2A2A] rounded-2xl space-y-3 shadow-inner">
                      <h4 className="text-[10px] text-[#C85A32] uppercase font-black tracking-widest flex items-center gap-2">
                        <Cpu className="w-3.5 h-3.5" />
                        Technical Specifications
                      </h4>
                      <p className="text-xs text-gray-300 leading-relaxed font-medium">
                        {selectedItemForDetail.specs || "Standard manufacturer specifications apply for this inventory model. Verified for retail resale compliance."}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 p-4 bg-[#1A1A1A] rounded-xl border border-[#2A2A2A]">
                      <Fingerprint className="w-5 h-5 text-gray-500" />
                      <div>
                        <span className="text-[9px] text-gray-600 uppercase font-bold block">Asset Serial / IMEI</span>
                        <span className="text-xs text-gray-300 font-mono tracking-wider">{selectedItemForDetail.serialOrImei}</span>
                      </div>
                    </div>
                  </div>

                  {/* Audit / History Timeline */}
                  <div className="space-y-4">
                    <h4 className="text-[10px] text-gray-400 uppercase font-black tracking-widest flex items-center gap-2 px-1">
                      <History className="w-3.5 h-3.5" />
                      Lifecycle Audit
                    </h4>
                    <div className="space-y-4 relative before:absolute before:left-2 before:top-2 before:bottom-2 before:w-[1px] before:bg-[#2A2A2A]">
                      {[
                        { date: '2026-09-10', event: 'Initial Intake', status: 'Completed', detail: 'ID Verified & Appraised' },
                        { date: '2026-09-11', event: 'Vault Transfer', status: 'Stored', detail: 'Unit Secure in Bay-12' },
                        { date: '2026-09-21', event: 'Retail Listing', status: 'Active', detail: 'Moved to Sales Floor' }
                      ].map((h, i) => (
                        <div key={i} className="relative pl-7 group">
                          <div className="absolute left-[3px] top-1.5 w-2 h-2 rounded-full bg-[#C85A32] border-2 border-[#1E1E1E] z-10"></div>
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-[11px] font-bold text-gray-200">{h.event}</p>
                              <p className="text-[10px] text-gray-500">{h.detail}</p>
                            </div>
                            <span className="text-[9px] font-mono text-gray-600">{h.date}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Power-Footer */}
              <div className="p-8 bg-[#161616] border-t border-[#2A2A2A] flex gap-4 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    addToCart(selectedItemForDetail);
                    setSelectedItemForDetail(null);
                  }}
                  className="flex-1 py-5 bg-[#C85A32] hover:bg-[#b04d29] text-white rounded-2xl text-xs font-black uppercase tracking-[0.1em] transition flex items-center justify-center gap-3 shadow-xl shadow-[#C85A32]/20 active:scale-[0.98]"
                >
                  <ShoppingBag className="w-6 h-6" />
                  <span>PROCESS SALE (ADD TO CART)</span>
                </button>
                
                <button
                  type="button"
                  onClick={() => {
                    showToast('Edit Mode Enabled', `Adjusting inventory metadata for ${selectedItemForDetail.sku}`, 'info');
                  }}
                  className="px-8 py-5 bg-[#2A2A2A] hover:bg-[#383838] text-white rounded-2xl text-xs font-black uppercase tracking-[0.1em] transition flex items-center justify-center gap-3 active:scale-[0.98]"
                >
                  <Edit3 className="w-6 h-6" />
                  <span>EDIT RECORD</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
