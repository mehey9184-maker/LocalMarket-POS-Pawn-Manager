import React from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, Printer, FileText, Smartphone, Plus } from 'lucide-react';
import { Customer, Seller, PawnLoan } from '../../../types';
import { TxType, CompletionResult } from './buyPawnTypes';
import { thermalPrinter } from '../../../services/thermalPrinter';

interface BuyPawnCompletionProps {
  result: CompletionResult;
  txType: TxType;
  agreedOffer: number;
  businessRules: any;
  selectedIdentity: Customer | Seller | null;
  showToast: (title: string, message: string, type?: 'success' | 'error' | 'info' | 'amber') => void;
  setActiveContractModal: (loan: PawnLoan) => void;
  onReset: () => void;
}

export const BuyPawnCompletion: React.FC<BuyPawnCompletionProps> = ({
  result,
  txType,
  agreedOffer,
  businessRules,
  selectedIdentity,
  showToast,
  setActiveContractModal,
  onReset,
}) => {
  const handlePrintAssetTag = async () => {
    try {
      await thermalPrinter.printAssetTag({
        ticketNo: result.ticketNumber || result.assetTag,
        itemTitle: result.item?.title || 'Inventory Item',
        serialNo: (result.item as any)?.serialOrImei || 'N/A',
        vaultShelf: (result.item as any)?.vaultLocation || (result.item as any)?.stockLocation || 'Main Floor',
        pledgorName: selectedIdentity?.fullName || 'Store Merchandise',
        expiryDate: result.loan?.expiryDate || 'N/A',
        amount: txType === 'existing' ? result.item?.retailPrice || 0 : agreedOffer,
      });
      showToast('Asset Label Dispatched', `Label for ${result.assetTag} sent to printer.`, 'info');
    } catch (err) {
      console.error('Print label error:', err);
      window.print();
      showToast('Print Dispatched', `Dispatched asset label ${result.assetTag} to print driver.`, 'info');
    }
  };

  const handleWhatsApp = () => {
    const rawMobile = selectedIdentity?.mobile?.trim();
    if (!rawMobile) {
      showToast('No Mobile Provided', 'No customer mobile number was captured for this transaction.', 'amber');
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

    const msg = encodeURIComponent(
      `LocalMarket Transaction Receipt #${result.assetTag} - ${
        result.item?.title || 'Transaction'
      }. Thank you!`
    );
    const url = `https://wa.me/${cleanNum}?text=${msg}`;

    try {
      const win = window.open(url, '_blank', 'noopener,noreferrer');
      if (win) {
        showToast('Opening WhatsApp', `Connecting to +${cleanNum}...`, 'info');
      } else {
        showToast('Popup Blocked', 'Please allow popups to open WhatsApp.', 'amber');
      }
    } catch {
      showToast('Handoff Failed', 'Could not open WhatsApp window.', 'error');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-xl mx-auto py-6 space-y-6"
    >
      <div className="text-center space-y-2">
        <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-2 border border-emerald-200">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h3 className="text-2xl font-bold text-gray-900">Intake Complete</h3>
        <p className="text-xs text-gray-500">
          Asset <span className="font-mono font-bold text-gray-800">{result.assetTag}</span> has been
          logged to inventory.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs space-y-5">
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <p className="text-gray-400 font-medium">SKU / Asset Tag</p>
            <p className="text-base font-bold text-gray-900 font-mono mt-0.5">{result.assetTag}</p>
          </div>

          {result.ticketNumber && (
            <div>
              <p className="text-gray-400 font-medium">Pawn Ticket</p>
              <p className="text-base font-bold text-blue-600 font-mono mt-0.5">
                {result.ticketNumber}
              </p>
            </div>
          )}

          <div>
            <p className="text-gray-400 font-medium">
              {txType === 'existing' ? 'Retail Price' : 'Payout Amount'}
            </p>
            <p className="text-base font-bold text-emerald-600 font-mono mt-0.5">
              R{' '}
              {txType === 'existing'
                ? result.item.retailPrice.toLocaleString()
                : agreedOffer.toLocaleString()}
            </p>
          </div>

          <div>
            <p className="text-gray-400 font-medium">Location</p>
            <p className="text-base font-bold text-gray-900 mt-0.5">
              {result.item.stockLocation ||
                (txType === 'buy' ? 'Retail Floor' : businessRules.defaultVaultShelf)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-gray-100">
          <button
            type="button"
            onClick={handlePrintAssetTag}
            className="py-3 px-4 rounded-xl bg-gray-900 text-white font-semibold text-xs flex items-center justify-center gap-2 hover:bg-gray-800 transition shadow-xs cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print Asset Label</span>
          </button>

          {txType === 'pawn' && result.loan && (
            <button
              type="button"
              onClick={() => setActiveContractModal(result.loan!)}
              className="py-3 px-4 rounded-xl border border-gray-200 text-gray-800 font-semibold text-xs flex items-center justify-center gap-2 hover:bg-gray-50 transition shadow-xs cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              <span>Print Pawn Contract</span>
            </button>
          )}

          {txType !== 'existing' && (
            <button
              type="button"
              onClick={handleWhatsApp}
              className="py-3 px-4 rounded-xl border border-gray-200 text-gray-800 font-semibold text-xs flex items-center justify-center gap-2 hover:bg-gray-50 transition shadow-xs sm:col-span-2 cursor-pointer"
            >
              <Smartphone className="w-4 h-4" />
              <span>Send WhatsApp Notification</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex justify-center pt-2">
        <button
          type="button"
          onClick={onReset}
          className="flex items-center gap-2 px-6 py-3 bg-[#C85A32] text-white rounded-xl font-semibold text-xs shadow-xs hover:bg-[#A94725] transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Start New Intake</span>
        </button>
      </div>
    </motion.div>
  );
};
