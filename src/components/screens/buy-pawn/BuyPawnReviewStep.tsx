import React from 'react';
import { motion } from 'motion/react';
import { ShoppingBag, Lock, FileText, Plus, Loader2 } from 'lucide-react';
import { Customer, Seller } from '../../../types';
import { TxType, ItemDraft, PawnCalculations } from './buyPawnTypes';

interface BuyPawnReviewStepProps {
  txType: TxType;
  itemData: ItemDraft;
  selectedIdentity: Customer | Seller | null;
  basketItems: any[];
  agreedOffer: number;
  isAgreedOfferFromMarketCheck?: boolean;
  pawnCalculations: PawnCalculations | null;
  businessRules: any;
  isFinalizing: boolean;
  onAddToBatch: () => void;
  onFinalize: () => void;
  onBack: () => void;
}

export const BuyPawnReviewStep: React.FC<BuyPawnReviewStepProps> = ({
  txType,
  itemData,
  selectedIdentity,
  basketItems,
  agreedOffer,
  isAgreedOfferFromMarketCheck = false,
  pawnCalculations,
  businessRules,
  isFinalizing,
  onAddToBatch,
  onFinalize,
  onBack,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.02 }}
      className="space-y-6"
    >
      <div className="flex items-center gap-3.5 mb-2">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
            txType === 'buy' ? 'bg-[#FDF0EA] text-[#C85A32]' : 'bg-blue-50 text-blue-600'
          }`}
        >
          {txType === 'buy' ? <ShoppingBag className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900">
            {txType === 'buy' ? 'Review Seller Batch' : 'Review Pledge Terms'}
          </h3>
          <p className="text-xs text-gray-500">
            {txType === 'buy'
              ? 'Statutory Second-Hand Goods Purchase'
              : 'Regulated Secured Credit Agreement'}
          </p>
        </div>
      </div>

      {/* Batch Summary (if Buy) */}
      {txType === 'buy' && basketItems.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-xs mb-6">
          <div className="bg-gray-50 px-5 py-3 border-b border-gray-200 flex items-center justify-between">
            <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
              Batch Items ({basketItems.length})
            </h4>
            <span className="text-xs font-bold text-gray-900">
              Total Payout: R{' '}
              {basketItems.reduce((sum, i) => sum + i.agreedOffer, 0).toLocaleString()}
            </span>
          </div>
          <div className="divide-y divide-gray-100 max-h-48 overflow-y-auto">
            {basketItems.map((item, idx) => (
              <div
                key={idx}
                className="px-5 py-3 flex items-center justify-between hover:bg-gray-50 transition"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500">
                    #{idx + 1}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-900">{item.title}</p>
                    <p className="text-[10px] text-gray-500 font-mono">
                      {item.serialOrImei || 'No Serial'}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold text-gray-900">
                  R {item.agreedOffer.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-6 rounded-2xl bg-white border border-gray-200 shadow-xs space-y-4">
          <div className="space-y-2 text-xs divide-y divide-gray-100">
            <div className="flex justify-between py-1.5">
              <span className="text-gray-500">Transaction Type</span>
              <span className="font-semibold text-gray-900">
                {txType === 'buy' ? 'Direct Purchase (Outright)' : `${businessRules?.defaultLoanTermDays ?? 30}-Day Pawn Loan`}
              </span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-gray-500">{txType === 'buy' ? 'Seller' : 'Customer'}</span>
              <div className="text-right">
                <span className="font-semibold text-gray-900">{selectedIdentity?.fullName}</span>
                <span
                  className={`block text-[10px] font-semibold ${
                    selectedIdentity?.verified ? 'text-emerald-600' : 'text-amber-600'
                  }`}
                >
                  {selectedIdentity?.verified ? 'Verified' : 'Verification pending'}
                </span>
              </div>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-gray-500">ID Number</span>
              <span className="font-mono font-medium text-gray-800">
                {selectedIdentity?.idNumber}
              </span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-gray-500">Asset</span>
              <span className="font-semibold text-gray-900">{itemData.title}</span>
            </div>
          </div>

          <div className="pt-2 border-t border-gray-200 space-y-3">
            <div className="flex justify-between items-baseline">
              <span className="text-xs font-bold text-gray-700">
                {txType === 'pawn' ? 'Agreed Loan Amount' : 'Negotiated Payout'}
              </span>
              <div className="text-right">
                <span className="text-2xl font-bold text-gray-900 font-mono">
                  R {agreedOffer.toLocaleString()}
                </span>
                {isAgreedOfferFromMarketCheck && (
                  <span className="block text-[10px] text-emerald-600 font-semibold font-sans">
                    From Market Check
                  </span>
                )}
              </div>
            </div>

            {txType === 'pawn' && pawnCalculations && (
              <div className="space-y-1.5 pt-2 border-t border-gray-100 text-xs">
                <div className="flex justify-between text-gray-500">
                  <span>
                    Monthly Interest ({Math.round(businessRules.pawnMonthlyInterestRate * 100)}%)
                  </span>
                  <span className="font-mono">R {pawnCalculations.interest.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>
                    Vault Storage & Admin Fee (
                    {Math.round(businessRules.pawnStorageAdminFeeRate * 100)}%)
                  </span>
                  <span className="font-mono">R {pawnCalculations.adminFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-blue-700 pt-1 border-t border-gray-100">
                  <span>Total Redemption Due</span>
                  <span className="font-mono text-sm">
                    R {pawnCalculations.totalRedemption.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-gray-400 text-[11px]">
                  <span>Pawn Term Expiry</span>
                  <span>{pawnCalculations.expiryDate}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col justify-between space-y-4">
          <div className="p-6 rounded-2xl bg-white border border-gray-200 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gray-100 text-gray-600 flex items-center justify-center shrink-0">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-gray-900">
                {txType === 'buy' ? 'Statutory Register Intake' : 'Regulated Pledge Record'}
              </h4>
              <p className="text-xs text-gray-500 mt-0.5">
                {txType === 'buy'
                  ? 'Finalizing assigns asset tags, records the transaction in the statutory register, and generates transaction documentation.'
                  : 'Finalizing assigns asset tags, records the loan and collateral in the statutory register, and generates pawn contract documentation.'}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {txType === 'buy' && (
              <button
                onClick={onAddToBatch}
                disabled={isFinalizing}
                className="w-full flex items-center justify-center gap-2 bg-white border-2 border-gray-200 disabled:opacity-50 text-gray-700 py-3.5 rounded-xl font-bold hover:bg-gray-50 hover:border-[#C85A32] hover:text-[#C85A32] transition group cursor-pointer"
              >
                <Plus className="w-5 h-5 text-gray-400 group-hover:text-[#C85A32]" />
                Add Another Item to Batch
              </button>
            )}

            <button
              onClick={onFinalize}
              disabled={isFinalizing}
              className={`w-full py-4 rounded-xl text-white font-bold text-sm shadow-xs transition flex items-center justify-center gap-2 disabled:bg-stone-200 disabled:text-stone-400 cursor-pointer ${
                isFinalizing
                  ? 'bg-stone-300'
                  : txType === 'buy'
                  ? 'bg-[#C85A32] hover:bg-[#A94725]'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isFinalizing ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
              <span>
                {isFinalizing
                  ? txType === 'buy'
                    ? basketItems.length > 0
                      ? `Finalising ${basketItems.length + 1} items…`
                      : 'Completing purchase…'
                    : 'Finalising pawn loan…'
                  : txType === 'buy'
                  ? basketItems.length > 0
                    ? `Finalize Batch (${basketItems.length + 1} Items)`
                    : 'Complete Purchase & Payout'
                  : 'Finalise Pawn Loan Agreement'}
              </span>
            </button>

            <button
              onClick={onBack}
              disabled={isFinalizing}
              className="w-full text-xs text-gray-500 hover:text-gray-900 disabled:opacity-50 font-semibold text-center py-1 cursor-pointer"
            >
              Modify Terms
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
