import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useSync } from '../../context/SyncContext';
import { PaymentMethod, ReceiptDelivery, InventoryItem, CartItem } from '../../types';
import { validateAndNormalizeSaPhone } from '../../utils/phoneValidator';
import { normalizeScannerInput } from '../../utils/scannerNormalizer';
import { focusAndScrollErrorField } from '../../utils/errorNavigator';
import { motion, AnimatePresence } from 'motion/react';
import { humanizeErrorMessage } from '../../hooks/useOperationProgress';
import {
  Barcode,
  Search,
  Camera,
  Trash2,
  CreditCard,
  Banknote,
  CheckCircle2,
  X,
  Plus,
  Minus,
  ShoppingCart,
  Zap,
  Smartphone,
  Printer,
  AlertTriangle,
  Loader2,
  MapPin,
  RotateCcw
} from 'lucide-react';

export interface CartSnapshot {
  items: CartItem[];
  clearedAt: number;
}

export function createCartSnapshot(cart: CartItem[]): CartSnapshot {
  return {
    items: cart.map(ci => ({
      item: { ...ci.item },
      quantity: ci.quantity,
      overridePrice: ci.overridePrice
    })),
    clearedAt: Date.now()
  };
}

export function restoreCartFromSnapshot(snapshot: CartSnapshot): CartItem[] {
  return snapshot.items.map(ci => ({
    item: { ...ci.item },
    quantity: ci.quantity,
    overridePrice: ci.overridePrice
  }));
}

export interface CashPaymentState {
  status: 'still_due' | 'exact' | 'change';
  amount: number;
  stillDue: number;
  change: number;
  label: string;
  formattedText: string;
  isComplete: boolean;
}

export function getCashPaymentState(total: number, tendered: number): CashPaymentState {
  const safeTotal = Math.max(0, total);
  const safeTendered = Math.max(0, tendered);
  const diff = Math.round((safeTendered - safeTotal) * 100) / 100;

  if (diff < 0) {
    const stillDue = Math.abs(diff);
    return {
      status: 'still_due',
      amount: stillDue,
      stillDue,
      change: 0,
      label: 'Still Due',
      formattedText: `Still due R ${stillDue.toFixed(2)}`,
      isComplete: false
    };
  }

  if (diff === 0) {
    return {
      status: 'exact',
      amount: 0,
      stillDue: 0,
      change: 0,
      label: 'Payment Status',
      formattedText: 'Exact payment',
      isComplete: true
    };
  }

  return {
    status: 'change',
    amount: diff,
    stillDue: 0,
    change: diff,
    label: 'Change Due',
    formattedText: `Change R ${diff.toFixed(2)}`,
    isComplete: true
  };
}

const CartItemRow: React.FC<{ 
  ci: any; 
  onRemove: (id: string) => void; 
  onUpdatePrice: (id: string, price: number) => void;
  onUpdateQuantity: (id: string, qty: number) => void;
  canEditPrice: boolean;
}> = ({ ci, onRemove, onUpdatePrice, onUpdateQuantity, canEditPrice }) => {
  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [tempPrice, setTempPrice] = useState((ci.overridePrice ?? ci.item.retailPrice).toString());

  const handlePriceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditPrice) {
      setIsEditingPrice(false);
      return;
    }
    const p = parseFloat(tempPrice);
    if (!isNaN(p) && p >= 0) {
      onUpdatePrice(ci.item.id, p);
    }
    setIsEditingPrice(false);
  };

  const effectivePrice = (ci.overridePrice ?? ci.item.retailPrice) * ci.quantity;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className={`p-3 rounded-xl flex items-center gap-3 border ${
        ci.item.status === 'Reserved' 
          ? 'bg-amber-50/70 border-amber-300' 
          : 'bg-[#F8F9FA] border-gray-200'
      }`}
    >
      <div className="w-11 h-11 rounded-lg bg-gray-100 shrink-0 border border-gray-200 overflow-hidden">
        <img src={ci.item.imageUrl} className="w-full h-full object-cover" alt="" />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <h4 className="text-xs font-semibold text-gray-900 truncate">{ci.item.title}</h4>
          {ci.item.status === 'Reserved' && (
            <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-amber-200 text-amber-900 border border-amber-300 shrink-0">
              Reserved
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] font-mono text-gray-500 font-semibold">{ci.item.sku}</span>
        </div>
      </div>

      <div className="flex flex-col items-end gap-1">
        {isEditingPrice && canEditPrice ? (
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
            onClick={() => canEditPrice && setIsEditingPrice(true)}
            className={`text-xs font-bold text-gray-900 font-mono transition ${
              canEditPrice ? 'cursor-pointer hover:text-[#C85A32]' : 'cursor-default'
            }`}
            title={canEditPrice ? 'Click to override retail price (Manager / Pricing permission)' : 'Retail Selling Price (Fixed)'}
          >
            R {effectivePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        )}

        {!ci.item.acquisitionType && (
          <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-1 py-0.5">
            <button 
              onClick={() => onUpdateQuantity(ci.item.id, ci.quantity - 1)}
              className="text-gray-400 hover:text-gray-700 p-0.5 cursor-pointer"
            >
              <Minus className="w-2.5 h-2.5" />
            </button>
            <span className="text-[11px] font-bold text-gray-800 font-mono px-1">{ci.quantity}</span>
            <button 
              onClick={() => onUpdateQuantity(ci.item.id, ci.quantity + 1)}
              className="text-gray-400 hover:text-gray-700 p-0.5 cursor-pointer"
            >
              <Plus className="w-2.5 h-2.5" />
            </button>
          </div>
        )}
      </div>

      <button 
        onClick={() => onRemove(ci.item.id)}
        className="p-1.5 text-gray-400 hover:text-red-500 transition cursor-pointer"
        title="Remove item"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
};

export const Sell: React.FC = () => {
  const { 
    activeTab,
    inventory, 
    cart, 
    addToCart, 
    removeFromCart, 
    updateCartItemPrice, 
    updateCartQuantity, 
    clearCart,
    restoreCart,
    completeCheckout,
    showToast,
    setIsScannerModalOpen,
    shopProfile,
    setIsBusy
  } = useApp();

  const { hasPermission, isOwner, isManager, role } = useAuth();
  const { isOnline, syncStatus } = useSync();
  const canEditPrice = hasPermission('pricing') || isOwner || isManager;
  const canSellReserved = role !== 'cashier';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTender, setSelectedTender] = useState<PaymentMethod>('cash');
  const [cashTendered, setCashTendered] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [receiptType, setReceiptType] = useState<ReceiptDelivery>('thermal');
  const [customerMobile, setCustomerMobile] = useState<string>('');
  const [mobileError, setMobileError] = useState<string | null>(null);

  useEffect(() => {
    setIsBusy(isProcessing);
  }, [isProcessing, setIsBusy]);

  // Undo Recovery State for "Clear Basket"
  const [undoSnapshot, setUndoSnapshot] = useState<CartSnapshot | null>(null);
  const undoTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const isCheckingOutRef = useRef(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const cashInputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const lastScanRef = useRef<{ query: string; time: number }>({ query: '', time: 0 });

  const dismissPendingUndo = () => {
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    setUndoSnapshot(null);
  };

  const handleClearCart = () => {
    if (cart.length === 0 || isProcessing) return;

    // 1. Capture complete current cart snapshot
    const snapshot = createCartSnapshot(cart);
    setUndoSnapshot(snapshot);

    // 2. Clear basket immediately
    clearCart();

    // 3. Reset finite timer (~6 seconds)
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
    }
    undoTimerRef.current = setTimeout(() => {
      setUndoSnapshot(null);
      undoTimerRef.current = null;
    }, 6000);
  };

  const handleUndoClear = () => {
    if (!undoSnapshot || isProcessing) return;

    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }

    const restoredItems = restoreCartFromSnapshot(undoSnapshot);
    restoreCart(restoredItems);
    setUndoSnapshot(null);

    showToast('Basket Restored', `${restoredItems.length} ${restoredItems.length === 1 ? 'item' : 'items'} restored to basket`, 'success');
  };

  const handleDismissUndo = () => {
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    setUndoSnapshot(null);
  };

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) {
        clearTimeout(undoTimerRef.current);
      }
    };
  }, []);

  const handleProtectedPriceUpdate = (itemId: string, newPrice: number) => {
    if (!canEditPrice) {
      showToast('Unauthorized Override', 'Only managers or operators with pricing permission can adjust retail prices.', 'amber');
      return;
    }
    updateCartItemPrice(itemId, newPrice);
  };

  useEffect(() => {
    if (activeTab === 'sell') {
      searchInputRef.current?.focus();
    }
  }, [activeTab]);

  const floorItems = useMemo(() => {
    return inventory.filter(item => 
      item.status === 'Retail Floor' || 
      item.status === 'Reserved'
    );
  }, [inventory]);

  const filteredItems = useMemo(() => {
    const q = normalizeScannerInput(searchQuery).toLowerCase();
    if (!q) return floorItems.slice(0, 16);

    const queryWords = q.split(/\s+/);

    return floorItems.filter(item => {
      const targetText = [
        item.title,
        item.sku,
        item.serialOrImei || '',
        item.brand || '',
        item.model || ''
      ].join(' ').toLowerCase();

      return queryWords.every(word => targetText.includes(word));
    }).slice(0, 24);
  }, [floorItems, searchQuery]);

  const total = useMemo(() => {
    return cart.reduce((sum, ci) => sum + (ci.overridePrice ?? ci.item.retailPrice) * ci.quantity, 0);
  }, [cart]);

  const numTendered = parseFloat(cashTendered) || 0;
  const cashPaymentState = useMemo(() => getCashPaymentState(total, numTendered), [total, numTendered]);
  const changeDue = cashPaymentState.change;

  const isVatRegistered = Boolean(shopProfile?.vat_number && shopProfile.vat_number.trim().length > 0);
  const vatRate = isVatRegistered ? 0.15 : 0;
  const vatAmount = isVatRegistered ? (total - (total / (1 + vatRate))) : 0;
  const subtotal = total - vatAmount;

  const handleTileClick = (item: InventoryItem) => {
    dismissPendingUndo();
    if (item.status === 'Reserved' && !canSellReserved) {
      showToast('Reserved Stock', 'Reserved stock needs Manager or Owner approval.', 'amber');
      return;
    }
    addToCart(item);
    setSearchQuery('');
    searchInputRef.current?.focus();
  };

  const handleBarcodeSearchSubmit = (eOrQuery?: React.FormEvent | string) => {
    dismissPendingUndo();
    if (typeof eOrQuery === 'object' && eOrQuery !== null && 'preventDefault' in eOrQuery) {
      eOrQuery.preventDefault();
    }

    const rawQuery = typeof eOrQuery === 'string' ? eOrQuery : searchQuery;
    const cleanQuery = normalizeScannerInput(rawQuery);
    if (!cleanQuery || isCheckingOutRef.current) return;

    const now = Date.now();
    if (lastScanRef.current.query.toLowerCase() === cleanQuery.toLowerCase() && now - lastScanRef.current.time < 300) {
      return;
    }
    lastScanRef.current = { query: cleanQuery, time: now };

    // Check across all inventory for exact SKU, serial, or pawn ticket
    const anyExactMatch = inventory.find(
      item =>
        item.sku.toLowerCase() === cleanQuery.toLowerCase() ||
        (item.serialOrImei && item.serialOrImei.toLowerCase() === cleanQuery.toLowerCase()) ||
        (item.pawnTicketId && item.pawnTicketId.toLowerCase() === `#${cleanQuery.toLowerCase()}`) ||
        (item.pawnTicketId && item.pawnTicketId.toLowerCase() === cleanQuery.toLowerCase())
    );

    if (anyExactMatch) {
      if (anyExactMatch.status === 'Sold' || anyExactMatch.status === 'Redeemed') {
        showToast('Item Unavailable', `Item found (${anyExactMatch.title}) — currently Sold.`, 'amber');
      } else if (anyExactMatch.status === 'Vault Hold') {
        showToast('Item Unavailable', `Item found (${anyExactMatch.title}) — currently in Vault.`, 'amber');
      } else if (anyExactMatch.status === 'Reserved') {
        if (!canSellReserved) {
          showToast('Reserved Stock', 'Reserved stock needs Manager or Owner approval.', 'amber');
        } else {
          addToCart(anyExactMatch);
          setSearchQuery('');
        }
      } else if (anyExactMatch.status === 'Retail Floor') {
        addToCart(anyExactMatch);
        setSearchQuery('');
      } else {
        showToast('Item Unavailable', `Item found (${anyExactMatch.title}) — currently ${anyExactMatch.status}.`, 'amber');
      }
    } else if (filteredItems.length === 1) {
      const item = filteredItems[0];
      if (item.status === 'Reserved' && !canSellReserved) {
        showToast('Reserved Stock', 'Reserved stock needs Manager or Owner approval.', 'amber');
      } else {
        addToCart(item);
        setSearchQuery('');
      }
    } else if (filteredItems.length > 1) {
      showToast('Multiple Matches', `${filteredItems.length} matches — choose one.`, 'info');
    } else {
      showToast('Item Not Found', `No available stock matching "${cleanQuery}"`, 'error');
    }

    searchInputRef.current?.focus();
  };

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    if (rawVal.includes('\r') || rawVal.includes('\n')) {
      const cleanVal = normalizeScannerInput(rawVal);
      setSearchQuery(cleanVal);
      if (cleanVal) {
        handleBarcodeSearchSubmit(cleanVal);
      }
      return;
    }
    setSearchQuery(rawVal);
  };

  const handleCompleteSale = async () => {
    if (isCheckingOutRef.current || cart.length === 0 || isProcessing) return;
    
    if (selectedTender === 'cash' && numTendered < total) {
      showToast('Payment Incomplete', `Cash tendered (R ${numTendered.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) is less than total R ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'amber');
      if (cashInputRef.current) {
        focusAndScrollErrorField(cashInputRef.current);
      }
      return;
    }

    let normalizedPhone: string | undefined = undefined;

    if (receiptType === 'whatsapp') {
      const rawMobile = customerMobile.trim();
      if (!rawMobile) {
        setMobileError('Customer WhatsApp mobile number is required.');
        showToast('Mobile Number Required', 'Please enter customer mobile number for WhatsApp slip.', 'amber');
        if (mobileInputRef.current) focusAndScrollErrorField(mobileInputRef.current);
        return;
      }

      const phoneCheck = validateAndNormalizeSaPhone(rawMobile);
      if (!phoneCheck.isValid) {
        setMobileError(phoneCheck.error || 'Please enter a valid South African mobile number.');
        showToast('Invalid Phone Number', phoneCheck.error || 'Check customer mobile format.', 'amber');
        if (mobileInputRef.current) focusAndScrollErrorField(mobileInputRef.current);
        return;
      }

      normalizedPhone = phoneCheck.normalizedNumber || rawMobile;
      setMobileError(null);
    }

    isCheckingOutRef.current = true;
    setIsProcessing(true);

    const finalAmount = selectedTender === 'cash' ? numTendered : total;

    try {
      const sale = await completeCheckout(
        selectedTender, 
        finalAmount, 
        receiptType,
        normalizedPhone
      );

      const changeStr = sale.change > 0 ? ` Change: R ${sale.change.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.` : '';
      const receiptStr = receiptType === 'whatsapp' ? ' WhatsApp receipt queued.' : receiptType === 'thermal' ? ' Receipt ready to print.' : ' Sale complete.';
      
      showToast(
        'Sale Complete', 
        `R ${sale.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} received.${changeStr}${receiptStr}`, 
        'success'
      );

      dismissPendingUndo();
      setCashTendered('');
      setCustomerMobile('');
      setMobileError(null);
      setSearchQuery('');
      searchInputRef.current?.focus();
    } catch (err: any) {
      showToast('Checkout Failed', humanizeErrorMessage(err), 'error');
    } finally {
      isCheckingOutRef.current = false;
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    if (activeTab !== 'sell') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') { e.preventDefault(); setSelectedTender('cash'); }
      if (e.key === 'F2') { e.preventDefault(); setSelectedTender('card'); }
      if (e.key === 'F3') { e.preventDefault(); setSelectedTender('eft'); }
      // Escape no longer clears basket per safety requirements
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { 
        e.preventDefault(); 
        if (!isCheckingOutRef.current && !isProcessing) {
          handleCompleteSale(); 
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, cart, selectedTender, numTendered, total, receiptType, customerMobile, isProcessing]);

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
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition flex items-center gap-2 text-xs font-semibold cursor-pointer"
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
              onChange={handleSearchInputChange}
              placeholder="Scan item or search by name, SKU, brand, model..."
              className="w-full bg-[#F8F9FA] border border-gray-200 focus:border-[#C85A32] focus:bg-white rounded-xl pl-11 pr-4 py-3 text-sm text-gray-900 font-mono placeholder:text-gray-400 transition-all outline-none"
            />
          </form>
          {filteredItems.length > 1 && searchQuery.trim() !== '' && (
            <p className="text-[11px] text-gray-500 font-medium px-1">
              {filteredItems.length} matches — choose one or press Enter for exact match.
            </p>
          )}
        </div>

        {/* Results Grid */}
        <div className="flex-1 overflow-y-auto p-5 no-scrollbar">
          {filteredItems.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredItems.map(item => {
                const isReserved = item.status === 'Reserved';
                const itemLocation = item.stockLocation || item.vaultLocation;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleTileClick(item)}
                    className={`bg-white border rounded-xl p-3.5 flex flex-col text-left transition group shadow-xs hover:shadow-sm active:scale-98 cursor-pointer ${
                      isReserved ? 'border-amber-300 bg-amber-50/40 hover:border-amber-500' : 'border-gray-200 hover:border-[#C85A32]'
                    }`}
                  >
                    <div className="aspect-square rounded-lg bg-gray-100 mb-2.5 overflow-hidden border border-gray-100 relative">
                      <img src={item.imageUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform" alt="" />
                      {isReserved && (
                        <span className="absolute top-2 right-2 text-[9px] px-1.5 py-0.5 rounded font-bold bg-amber-200 text-amber-900 border border-amber-300 shadow-xs">
                          Reserved
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xs font-semibold text-gray-900 truncate">{item.title}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-mono text-gray-400 font-semibold">{item.sku}</span>
                      </div>
                      {itemLocation && (
                        <div className="flex items-center gap-1 text-[10px] text-gray-500 mt-1">
                          <MapPin className="w-3 h-3 text-gray-400 shrink-0" />
                          <span className="truncate">{itemLocation}</span>
                        </div>
                      )}
                    </div>
                    <div className="pt-2 border-t border-gray-100 flex items-center justify-between mt-2">
                      <span className="text-sm font-bold text-gray-900 font-mono">
                        R {item.retailPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <Plus className="w-4 h-4 text-[#C85A32]" />
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-2 py-12">
              <Search className="w-8 h-8 opacity-40" />
              <p className="text-xs font-medium">No items match your search</p>
            </div>
          )}
        </div>

        {/* Keyboard Shortcuts Discoverability Bar */}
        <div className="px-5 py-2.5 bg-white border-t border-gray-200 flex flex-wrap items-center justify-between gap-3 text-[11px] text-gray-500 shrink-0">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-1.5"><kbd className="bg-gray-100 border border-gray-300 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold text-gray-700 shadow-2xs">F1</kbd> Cash</span>
            <span className="flex items-center gap-1.5"><kbd className="bg-gray-100 border border-gray-300 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold text-gray-700 shadow-2xs">F2</kbd> Card</span>
            <span className="flex items-center gap-1.5"><kbd className="bg-gray-100 border border-gray-300 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold text-gray-700 shadow-2xs">F3</kbd> EFT</span>
          </div>
          <span className="flex items-center gap-1.5"><kbd className="bg-gray-100 border border-gray-300 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold text-gray-700 shadow-2xs">Ctrl+Enter</kbd> Finalise</span>
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
          <div className="flex items-center gap-3">
            <span className="px-2 py-0.5 rounded bg-gray-200/70 text-[11px] font-mono font-semibold text-gray-700">
              {cart.length} {cart.length === 1 ? 'item' : 'items'}
            </span>
            {cart.length > 0 && (
              <button
                onClick={handleClearCart}
                disabled={isProcessing}
                className="text-xs font-medium text-gray-500 hover:text-red-600 transition flex items-center gap-1 cursor-pointer"
                title="Clear Basket"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            )}
          </div>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 no-scrollbar min-h-[220px]">
          {/* Basket Cleared Undo Recovery Banner */}
          <AnimatePresence>
            {undoSnapshot && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                className="p-3 bg-stone-900 text-white rounded-xl shadow-lg border border-stone-800 flex items-center justify-between gap-3 mb-2"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-stone-800 flex items-center justify-center text-stone-300 shrink-0">
                    <Trash2 className="w-3.5 h-3.5 text-stone-300" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white font-headline leading-tight">Basket cleared</p>
                    <p className="text-[11px] text-stone-300 leading-snug">
                      {undoSnapshot.items.length} {undoSnapshot.items.length === 1 ? 'item' : 'items'} removed.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleUndoClear}
                    className="px-3 py-1.5 bg-[#C85A32] hover:bg-[#A94725] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-xs active:scale-95 flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Undo</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDismissUndo}
                    className="p-1 text-stone-400 hover:text-white transition cursor-pointer"
                    title="Dismiss"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="popLayout">
            {cart.map(ci => (
              <CartItemRow 
                key={ci.item.id} 
                ci={ci} 
                onRemove={removeFromCart} 
                onUpdatePrice={handleProtectedPriceUpdate}
                onUpdateQuantity={updateCartQuantity}
                canEditPrice={canEditPrice}
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
          {/* Quiet Offline / Sync Status */}
          {(!isOnline || syncStatus.isSyncing || syncStatus.pendingCount > 0) && (
            <div className={`p-2 rounded-lg text-[11px] flex items-center gap-2 border ${
              !isOnline 
                ? 'bg-amber-50 border-amber-200 text-amber-800' 
                : syncStatus.isSyncing 
                  ? 'bg-blue-50 border-blue-200 text-blue-800' 
                  : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}>
              <span className={`w-2 h-2 rounded-full shrink-0 ${!isOnline ? 'bg-amber-500 animate-pulse' : syncStatus.isSyncing ? 'bg-blue-500 animate-pulse' : 'bg-amber-500'}`} />
              <span>
                {!isOnline 
                  ? 'Working offline — sales are saved on this computer and will sync automatically.' 
                  : syncStatus.isSyncing 
                    ? 'Syncing…' 
                    : `${syncStatus.pendingCount} change${syncStatus.pendingCount > 1 ? 's' : ''} waiting to sync.`}
              </span>
            </div>
          )}

          <div className="space-y-2 text-xs">
            {isVatRegistered && (
              <>
                <div className="flex justify-between items-baseline text-gray-500">
                  <span>Subtotal (excl. VAT)</span>
                  <span className="font-mono font-semibold text-gray-800">
                    R {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-baseline text-gray-500">
                  <span>VAT (15%)</span>
                  <span className="font-mono font-semibold text-gray-800">
                    R {vatAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </>
            )}
            <div className="flex justify-between items-baseline pt-2 border-t border-gray-200">
              <span className="text-sm font-bold text-gray-900">Total Due</span>
              <span className="text-2xl font-bold text-[#C85A32] font-mono">
                R {total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                  className={`py-2.5 rounded-xl border flex flex-col items-center gap-1 transition cursor-pointer ${
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
                className="space-y-2.5 overflow-hidden"
              >
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-gray-500 uppercase">Tendered</label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 font-mono text-xs">R</span>
                      <input 
                        ref={cashInputRef}
                        type="number" 
                        value={cashTendered}
                        onChange={e => setCashTendered(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-white border border-gray-300 rounded-lg pl-6 pr-2.5 py-1.5 text-sm font-bold text-gray-900 font-mono focus:border-[#C85A32] outline-none"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className={`text-[10px] font-semibold uppercase flex items-center justify-between ${
                      cashPaymentState.status === 'still_due'
                        ? 'text-amber-800'
                        : 'text-emerald-800'
                    }`}>
                      <span>{cashPaymentState.label}</span>
                    </label>
                    <div className={`w-full rounded-lg px-3 py-1.5 flex items-center justify-end border ${
                      cashPaymentState.status === 'still_due'
                        ? 'bg-amber-50/70 border-amber-300/80 text-amber-900'
                        : cashPaymentState.status === 'exact'
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    }`}>
                      {cashPaymentState.status === 'exact' ? (
                        <span className="text-xs font-bold font-sans flex items-center gap-1.5 py-0.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Exact payment</span>
                        </span>
                      ) : (
                        <span className="text-sm font-bold font-mono">
                          R {cashPaymentState.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-1.5 pt-1">
                  <button
                    type="button"
                    disabled={cart.length === 0 || isProcessing}
                    onClick={() => setCashTendered(total > 0 ? total.toString() : '')}
                    className="py-2 rounded-lg bg-white border border-stone-200 hover:border-[#C85A32] hover:bg-[#FDF0EA] text-xs font-mono font-bold text-stone-800 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-center"
                  >
                    Exact
                  </button>
                  <button
                    type="button"
                    disabled={cart.length === 0 || isProcessing}
                    onClick={() => setCashTendered('50')}
                    className="py-2 rounded-lg bg-white border border-stone-200 hover:border-[#C85A32] hover:bg-[#FDF0EA] text-xs font-mono font-bold text-[#C85A32] transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-center"
                  >
                    R50
                  </button>
                  <button
                    type="button"
                    disabled={cart.length === 0 || isProcessing}
                    onClick={() => setCashTendered('100')}
                    className="py-2 rounded-lg bg-white border border-stone-200 hover:border-[#C85A32] hover:bg-[#FDF0EA] text-xs font-mono font-bold text-[#C85A32] transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-center"
                  >
                    R100
                  </button>
                  <button
                    type="button"
                    disabled={cart.length === 0 || isProcessing}
                    onClick={() => setCashTendered('200')}
                    className="py-2 rounded-lg bg-white border border-stone-200 hover:border-[#C85A32] hover:bg-[#FDF0EA] text-xs font-mono font-bold text-[#C85A32] transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-center"
                  >
                    R200
                  </button>
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
                  onClick={() => {
                    setReceiptType(rt.id as any);
                    if (rt.id !== 'whatsapp') setMobileError(null);
                  }}
                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    receiptType === rt.id ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-800'
                  }`}
                 >
                   <rt.icon className="w-3 h-3" />
                   {rt.label}
                 </button>
               ))}
            </div>

            {/* Optional Customer WhatsApp Phone Field */}
            {receiptType === 'whatsapp' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                className="space-y-1.5 overflow-hidden pt-1"
              >
                <div className="flex items-center justify-between text-[10px]">
                  <label htmlFor="customer-mobile-input" className="font-bold text-gray-700 uppercase">
                    Customer WhatsApp Number *
                  </label>
                  <span className="text-gray-400 font-normal">No account created</span>
                </div>
                <div className="relative">
                  <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    id="customer-mobile-input"
                    ref={mobileInputRef}
                    type="tel"
                    value={customerMobile}
                    onChange={e => {
                      setCustomerMobile(e.target.value);
                      if (mobileError) setMobileError(null);
                    }}
                    placeholder="e.g. 082 123 4567 or +27..."
                    className={`w-full bg-white border ${
                      mobileError ? 'border-red-400 focus:border-red-500' : 'border-gray-300 focus:border-[#C85A32]'
                    } rounded-lg pl-8 pr-3 py-1.5 text-xs font-mono text-gray-900 outline-none transition`}
                  />
                </div>
                {mobileError && (
                  <p className="text-[10px] text-red-600 font-medium flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    <span>{mobileError}</span>
                  </p>
                )}
              </motion.div>
            )}
          </div>

          <div className="space-y-2 pt-1">
            {cart.length > 0 && selectedTender === 'cash' && !cashPaymentState.isComplete && (
              <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200/80 rounded-lg px-2.5 py-1.5 text-center font-medium flex items-center justify-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Still due R {cashPaymentState.stillDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} — enter cash tendered</span>
              </p>
            )}
            <button 
              onClick={handleCompleteSale}
              disabled={isProcessing || cart.length === 0}
              className="w-full py-3 rounded-xl bg-[#C85A32] disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold text-xs shadow-xs hover:bg-[#A94725] transition flex items-center justify-center gap-2 cursor-pointer"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Finalising sale…</span>
                </>
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
