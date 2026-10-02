import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Package, ShoppingBag, Lock, Repeat, CheckCircle2, ShieldAlert } from 'lucide-react';
import { Permissions } from '../../types';
import { TxType } from '../screens/buy-pawn/buyPawnTypes';

interface ChangeIntakeTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTxType: TxType;
  onSwitchTxType: (type: 'existing' | 'buy' | 'pawn') => void;
  hasPermission: (permission: keyof Permissions) => boolean;
  selectedIdentityName?: string | null;
}

export const ChangeIntakeTypeModal: React.FC<ChangeIntakeTypeModalProps> = ({
  isOpen,
  onClose,
  currentTxType,
  onSwitchTxType,
  hasPermission,
  selectedIdentityName,
}) => {
  if (!isOpen) return null;

  const handleSelect = (type: 'existing' | 'buy' | 'pawn') => {
    if (type === currentTxType) {
      onClose();
      return;
    }
    onSwitchTxType(type);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-stone-900/60 backdrop-blur-xs font-sans">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden"
        >
          {/* Header */}
          <div className="px-6 py-5 bg-gradient-to-r from-stone-900 to-stone-800 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#C85A32] text-white flex items-center justify-center font-bold">
                <Repeat className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white leading-tight">Change Intake Type</h3>
                <p className="text-xs text-stone-300">Reconsider transaction model for this item</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-5">
            {/* Reassuring Work-Preservation Notice */}
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-xs text-emerald-900 leading-relaxed">
                <p className="font-bold">Item Details & Photos Stay Safe</p>
                <p className="text-emerald-700 mt-0.5">
                  Item description, category, brand/model, serial/IMEI, and photos will remain preserved.
                  Mode-specific identity (Seller vs Borrower) and deal payout terms remain safely separated.
                </p>
              </div>
            </div>

            {selectedIdentityName && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-2.5 text-xs text-amber-900">
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Identity for <span className="font-bold">{selectedIdentityName}</span> will stay stored in{' '}
                  <span className="font-semibold">{currentTxType === 'buy' ? 'Seller' : 'Borrower'}</span> records and will not cross over to the new mode.
                </span>
              </div>
            )}

            {/* Options */}
            <div className="space-y-3 pt-1">
              {/* Option 1: Buy From Person */}
              {hasPermission('sellerAcquisitions') && (
                <button
                  type="button"
                  onClick={() => handleSelect('buy')}
                  className={`w-full p-4 rounded-xl border text-left flex items-center justify-between transition cursor-pointer ${
                    currentTxType === 'buy'
                      ? 'border-[#C85A32] bg-[#FDF0EA]/60 ring-2 ring-[#C85A32]/20'
                      : 'border-stone-200 hover:border-[#C85A32] hover:bg-stone-50'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                        currentTxType === 'buy'
                          ? 'bg-[#C85A32] text-white'
                          : 'bg-orange-50 text-[#C85A32]'
                      }`}
                    >
                      <ShoppingBag className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-stone-900">Buy From Person</span>
                        {currentTxType === 'buy' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#C85A32] text-white">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-stone-500 mt-0.5">
                        Purchase second-hand merchandise outright. Requires seller Form 21 record.
                      </p>
                    </div>
                  </div>
                </button>
              )}

              {/* Option 2: Pawn Loan */}
              {hasPermission('pawn') && (
                <button
                  type="button"
                  onClick={() => handleSelect('pawn')}
                  className={`w-full p-4 rounded-xl border text-left flex items-center justify-between transition cursor-pointer ${
                    currentTxType === 'pawn'
                      ? 'border-blue-500 bg-blue-50/60 ring-2 ring-blue-500/20'
                      : 'border-stone-200 hover:border-blue-500 hover:bg-stone-50'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                        currentTxType === 'pawn' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600'
                      }`}
                    >
                      <Lock className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-stone-900">Pawn Loan</span>
                        {currentTxType === 'pawn' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-stone-500 mt-0.5">
                        Issue secured loan against collateral. Requires borrower record & pledge terms.
                      </p>
                    </div>
                  </div>
                </button>
              )}

              {/* Option 3: Existing Stock */}
              {hasPermission('inventory') && (
                <button
                  type="button"
                  onClick={() => handleSelect('existing')}
                  className={`w-full p-4 rounded-xl border text-left flex items-center justify-between transition cursor-pointer ${
                    currentTxType === 'existing'
                      ? 'border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500/20'
                      : 'border-stone-200 hover:border-emerald-500 hover:bg-stone-50'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                        currentTxType === 'existing'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-emerald-50 text-emerald-600'
                      }`}
                    >
                      <Package className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-stone-900">Existing Stock</span>
                        {currentTxType === 'existing' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-stone-500 mt-0.5">
                        Add store merchandise directly to inventory without seller or borrower identity.
                      </p>
                    </div>
                  </div>
                </button>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-stone-50 border-t border-stone-200 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-stone-300 text-stone-700 hover:bg-stone-100 text-xs font-semibold transition cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
