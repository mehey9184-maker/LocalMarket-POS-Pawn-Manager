import React from 'react';
import { motion } from 'motion/react';
import { Package, ShoppingBag, Lock, ArrowRight } from 'lucide-react';
import { Permissions } from '../../../types';

interface BuyPawnModeStepProps {
  onSelectTxType: (type: 'existing' | 'buy' | 'pawn') => void;
  hasPermission: (permission: keyof Permissions) => boolean;
}

export const BuyPawnModeStep: React.FC<BuyPawnModeStepProps> = ({
  onSelectTxType,
  hasPermission,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="space-y-6 py-2 sm:py-4"
    >
      {/* Heading Hierarchy */}
      <div className="text-center max-w-xl mx-auto mb-7 sm:mb-9">
        <span className="inline-block text-xs font-bold text-[#C85A32] uppercase tracking-widest mb-2">
          Add Stock
        </span>
        <h1 className="font-headline font-bold text-3xl sm:text-4xl text-stone-900 tracking-tight">
          What are you adding?
        </h1>
        <p className="text-stone-600 text-sm sm:text-base mt-2.5 font-normal leading-relaxed">
          Choose what best matches what’s happening at the counter.
        </p>
      </div>

      {/* The 3 Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* CARD 1: EXISTING STOCK */}
        {hasPermission('inventory') && (
          <div
            onClick={() => onSelectTxType('existing')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onSelectTxType('existing');
            }}
            className="group relative flex flex-col justify-between p-7 sm:p-8 rounded-2xl bg-white/95 backdrop-blur-xs border border-stone-200/90 hover:border-[#C85A32] hover:-translate-y-1 shadow-xs hover:shadow-md transition-all duration-150 cursor-pointer active:scale-[0.99] text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85A32]"
          >
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-[#FDF0EA] text-[#C85A32] flex items-center justify-center group-hover:scale-105 transition-transform shadow-2xs">
                  <Package className="w-6 h-6" />
                </div>
                <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide bg-emerald-50 text-emerald-700 border border-emerald-200/70">
                  Already yours
                </span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-stone-900 group-hover:text-[#C85A32] transition-colors">
                  Existing Stock
                </h2>
                <p className="text-sm text-stone-600 mt-2 leading-relaxed">
                  Already part of your shop? Add it without creating a seller or customer record.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#C85A32] pt-6 border-t border-stone-100 mt-6">
              <span>Add Existing Stock</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        )}

        {/* CARD 2: BUY FROM PERSON */}
        {hasPermission('sellerAcquisitions') && (
          <div
            onClick={() => onSelectTxType('buy')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onSelectTxType('buy');
            }}
            className="group relative flex flex-col justify-between p-7 sm:p-8 rounded-2xl bg-white/95 backdrop-blur-xs border border-stone-200/90 hover:border-[#C85A32] hover:-translate-y-1 shadow-xs hover:shadow-md transition-all duration-150 cursor-pointer active:scale-[0.99] text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85A32]"
          >
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-orange-50 text-[#C85A32] flex items-center justify-center group-hover:scale-105 transition-transform shadow-2xs">
                  <ShoppingBag className="w-6 h-6" />
                </div>
                <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide bg-orange-50 text-orange-700 border border-orange-200/70">
                  Buying second-hand
                </span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-stone-900 group-hover:text-[#C85A32] transition-colors">
                  Buy From Person
                </h2>
                <p className="text-sm text-stone-600 mt-2 leading-relaxed">
                  Buying an item from someone? We’ll keep the seller and required records together.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#C85A32] pt-6 border-t border-stone-100 mt-6">
              <span>Buy From Person</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        )}

        {/* CARD 3: PAWN */}
        {hasPermission('pawn') && (
          <div
            onClick={() => onSelectTxType('pawn')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onSelectTxType('pawn');
            }}
            className="group relative flex flex-col justify-between p-7 sm:p-8 rounded-2xl bg-white/95 backdrop-blur-xs border border-stone-200/90 hover:border-blue-600 hover:-translate-y-1 shadow-xs hover:shadow-md transition-all duration-150 cursor-pointer active:scale-[0.99] text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform shadow-2xs">
                  <Lock className="w-6 h-6" />
                </div>
                <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide bg-blue-50 text-blue-700 border border-blue-200/70">
                  Loan against an item
                </span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-stone-900 group-hover:text-blue-600 transition-colors">
                  Pawn
                </h2>
                <p className="text-sm text-stone-600 mt-2 leading-relaxed">
                  Taking an item as security for a loan? Start a new pawn.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 pt-6 border-t border-stone-100 mt-6">
              <span>Start Pawn Loan</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};
