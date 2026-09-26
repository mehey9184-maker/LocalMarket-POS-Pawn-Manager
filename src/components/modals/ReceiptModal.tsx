import React from 'react';
import { useApp } from '../../context/AppContext';
import { Printer, MessageSquare, X, CheckCircle } from 'lucide-react';
import { thermalPrinter } from '../../services/thermalPrinter';

export const ReceiptModal: React.FC = () => {
  const { activeReceiptModal, setActiveReceiptModal, showToast, shopProfile } = useApp();

  if (!activeReceiptModal) return null;

  const sale = activeReceiptModal;

  const handlePrint = async () => {
    try {
      // Attempt hardware connection if not already established
      await thermalPrinter.connectUSB();
      
      await thermalPrinter.printReceipt({
        ticketNo: sale.receiptNumber,
        items: sale.items.map(ci => ({
          title: ci.item.title,
          price: (ci.overridePrice ?? ci.item.retailPrice) * ci.quantity,
          sn: ci.item.sku // Using SKU as placeholder for SN if not explicit
        })),
        subtotal: sale.total - sale.vatAmount,
        vat: sale.vatAmount,
        total: sale.total,
        paymentMethod: sale.tenderMethod,
        cashTendered: sale.amountTendered,
        changeDue: sale.change
      });
      
      showToast('Thermal Print Dispatched', 'Queued to POS Thermal Slip Printer', 'success');
    } catch (err) {
      console.error('Printing failed:', err);
      // Fallback to window.print() is already in sendRaw but we can also trigger it here
      window.print();
      showToast('Print Dispatched', 'Falling back to system print driver', 'info');
    }
  };

  const handleWhatsApp = () => {
    const rawMobile = sale.customerMobile?.trim();
    if (!rawMobile) {
      showToast('No Mobile Provided', 'No customer mobile number was captured for this sale.', 'amber');
      return;
    }

    let cleanNum = rawMobile.replace(/\D/g, '');
    if (cleanNum.startsWith('0')) {
      cleanNum = '27' + cleanNum.slice(1);
    }

    if (cleanNum.length < 10) {
      showToast('Invalid Mobile', 'Customer phone number is too short for WhatsApp handoff.', 'amber');
      return;
    }

    const storeName = shopProfile?.shop_name || 'LocalMarket';
    const isVatRegistered = Boolean(shopProfile?.vat_number && shopProfile.vat_number.trim().length > 0);
    const itemsList = sale.items
      .map(ci => {
        const effectivePrice = ci.overridePrice ?? ci.item.retailPrice;
        return `• ${ci.item.title} (x${ci.quantity}) - R ${(effectivePrice * ci.quantity).toFixed(2)}`;
      })
      .join('\n');

    const message = 
      `*${storeName.toUpperCase()} — ${isVatRegistered ? 'TAX INVOICE' : 'RECEIPT'}*\n` +
      `Receipt No: ${sale.receiptNumber}\n` +
      `Date: ${sale.timestamp}\n` +
      `Cashier: ${sale.cashier}\n\n` +
      `*ITEMS PURCHASED:*\n${itemsList}\n\n` +
      (isVatRegistered ? `Subtotal (excl. VAT): R ${(sale.total - sale.vatAmount).toFixed(2)}\nVAT (15%): R ${sale.vatAmount.toFixed(2)}\n` : `Subtotal: R ${sale.total.toFixed(2)}\n`) +
      `*TOTAL PAID: R ${sale.total.toFixed(2)}*\n` +
      `Tender Method: ${sale.tenderMethod.toUpperCase()}\n` +
      `${sale.change > 0 ? `Change Given: R ${sale.change.toFixed(2)}\n` : ''}\n` +
      `Thank you for shopping at ${storeName}!`;

    const waUrl = `https://wa.me/${cleanNum}?text=${encodeURIComponent(message)}`;

    try {
      const win = window.open(waUrl, '_blank', 'noopener,noreferrer');
      if (win) {
        showToast('Opening WhatsApp', `Connecting to +${cleanNum}...`, 'info');
      } else {
        showToast('Popup Blocked', 'Please allow popups or open WhatsApp link directly.', 'amber');
      }
    } catch {
      showToast('Handoff Failed', 'Could not open WhatsApp window.', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 my-8">
        {/* Header */}
        <div className="p-3.5 border-b border-[#2A2A2A] flex items-center justify-between bg-[#161616]">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-sm text-white font-headline">
              Sale Tender Complete — Receipt
            </h3>
          </div>
          <button
            onClick={() => setActiveReceiptModal(null)}
            className="p-1 rounded-lg text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* White Thermal Receipt Slip Mockup */}
        <div className="p-5 flex justify-center bg-[#141414]">
          <div className="w-full bg-white text-black p-5 rounded-lg shadow-xl font-mono text-xs space-y-3 border border-gray-300">
            {/* Store Banner */}
            <div className="text-center border-b border-black/20 pb-2 space-y-0.5">
              <h2 className="font-black text-sm uppercase tracking-wider">{shopProfile?.shop_name?.toUpperCase() || 'LOCALMARKET'}</h2>
              <p className="text-[10px] text-gray-700">Official POS Terminal</p>
              <p className="text-[9px] text-gray-600">{shopProfile?.address || 'Address Pending'}</p>
              <p className="text-[9px] text-gray-600">SHG Reg: {shopProfile?.saps_dealer_license || 'PENDING'}</p>
              <p className="text-[9px] font-bold text-black uppercase mt-1">
                {shopProfile?.vat_number ? 'TAX INVOICE / KWITANSI' : 'OFFICIAL RECEIPT / KWITANSI'}
              </p>
            </div>

            {/* Slip Meta */}
            <div className="text-[10px] space-y-0.5 border-b border-black/20 pb-2 text-gray-800">
              <div className="flex justify-between">
                <span>Receipt:</span>
                <span className="font-bold font-mono">{sale.receiptNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>Date:</span>
                <span>{sale.timestamp}</span>
              </div>
              <div className="flex justify-between">
                <span>Cashier:</span>
                <span>{sale.cashier}</span>
              </div>
              <div className="flex justify-between">
                <span>Tender:</span>
                <span className="font-bold uppercase">{sale.tenderMethod}</span>
              </div>
            </div>

            {/* Line Items */}
            <div className="space-y-1.5 border-b border-black/20 pb-2">
              <div className="flex justify-between text-[10px] font-bold text-gray-600 uppercase">
                <span>Item</span>
                <span>Total</span>
              </div>
              {sale.items.map(ci => {
                const effectivePrice = ci.overridePrice ?? ci.item.retailPrice;
                return (
                  <div key={ci.item.id} className="text-[11px] leading-tight">
                    <div className="flex justify-between">
                      <span className="font-bold truncate max-w-[200px]">{ci.item.title}</span>
                      <span className="font-bold">
                        R {(effectivePrice * ci.quantity).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-[9px] text-gray-600">
                      <span>SKU: {ci.item.sku} ({ci.quantity} x R {effectivePrice.toFixed(2)})</span>
                      <span>{ci.item.acquisitionType === 'Forfeited' ? 'Pawn Forfeit' : 'Second-Hand'}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Totals */}
            <div className="space-y-1 text-xs border-b border-black/20 pb-2">
              {sale.vatAmount > 0 ? (
                <>
                  <div className="flex justify-between text-gray-700">
                    <span>Subtotal (Excl. VAT):</span>
                    <span>R {(sale.total - sale.vatAmount).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-gray-700">
                    <span>RSA VAT (15% Included):</span>
                    <span>R {sale.vatAmount.toFixed(2)}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between text-gray-700">
                  <span>Subtotal:</span>
                  <span>R {sale.total.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-black text-black pt-1 border-t border-black/20">
                <span>TOTAL PAID:</span>
                <span>R {sale.total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[10px] text-gray-700 pt-0.5">
                <span>Tendered:</span>
                <span>R {sale.amountTendered.toFixed(2)}</span>
              </div>
              {sale.change > 0 && (
                <div className="flex justify-between text-xs font-bold text-black">
                  <span>CHANGE GIVEN:</span>
                  <span>R {sale.change.toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Footnote & Barcode */}
            <div className="text-center pt-1 space-y-1.5">
              <p className="text-[9px] text-gray-700">
                Thank you for shopping at LocalMarket!
                <br />
                Goods verified clean under SA Second-Hand Goods Act.
                <br />
                7-Day Warranty on Tested Electronics.
              </p>

              {/* Barcode */}
              <div className="w-full h-8 bg-black rounded flex items-center justify-around px-2 text-white">
                <div className="w-1 h-6 bg-white"></div>
                <div className="w-2 h-6 bg-white"></div>
                <div className="w-0.5 h-6 bg-white"></div>
                <div className="w-1.5 h-6 bg-white"></div>
                <div className="w-3 h-6 bg-white"></div>
                <div className="w-1 h-6 bg-white"></div>
                <div className="w-0.5 h-6 bg-white"></div>
                <div className="w-2 h-6 bg-white"></div>
                <div className="w-1 h-6 bg-white"></div>
              </div>
              <p className="text-[8px] font-bold tracking-widest text-black">
                *{sale.receiptNumber}*
              </p>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="p-4 bg-[#161616] border-t border-[#2A2A2A] flex gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 py-2.5 rounded-xl bg-[#2A2A2A] hover:bg-[#383838] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition"
          >
            <Printer className="w-4 h-4 text-[#E87A5D]" />
            <span>Print Thermal Slip</span>
          </button>

          <button
            type="button"
            onClick={handleWhatsApp}
            className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow transition"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Open WhatsApp</span>
          </button>
        </div>
      </div>
    </div>
  );
};
