import React from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, Printer, FileText, Smartphone, Plus } from 'lucide-react';
import { Customer, Seller, PawnLoan } from '../../../types';
import { TxType, CompletionResult } from './buyPawnTypes';

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
            onClick={() =>
              showToast('Label Sent', `Asset label ${result.assetTag} printed`, 'success')
            }
            className="py-3 px-4 rounded-xl bg-gray-900 text-white font-semibold text-xs flex items-center justify-center gap-2 hover:bg-gray-800 transition shadow-xs cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print Asset Label</span>
          </button>

          {txType === 'pawn' && result.loan && (
            <button
              onClick={() => setActiveContractModal(result.loan!)}
              className="py-3 px-4 rounded-xl border border-gray-200 text-gray-800 font-semibold text-xs flex items-center justify-center gap-2 hover:bg-gray-50 transition shadow-xs cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              <span>Print Pawn Contract</span>
            </button>
          )}

          <button
            onClick={() => {
              const mobile = selectedIdentity?.mobile?.replace(/\D/g, '') || '';
              const msg = encodeURIComponent(
                `LocalMarket Transaction Receipt #${result.assetTag} - ${
                  result.item?.title || 'Transaction'
                }. Thank you!`
              );
              const url = mobile ? `https://wa.me/${mobile}?text=${msg}` : `https://wa.me/?text=${msg}`;
              const win = window.open(url, '_blank');
              if (win) {
                showToast('Opening WhatsApp', 'Launching WhatsApp handoff...', 'info');
              } else {
                showToast('Popup Blocked', 'Please allow popups to open WhatsApp.', 'amber');
              }
            }}
            className="py-3 px-4 rounded-xl border border-gray-200 text-gray-800 font-semibold text-xs flex items-center justify-center gap-2 hover:bg-gray-50 transition shadow-xs sm:col-span-2 cursor-pointer"
          >
            <Smartphone className="w-4 h-4" />
            <span>Send WhatsApp Notification</span>
          </button>
        </div>
      </div>

      <div className="flex justify-center pt-2">
        <button
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
