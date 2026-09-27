import React from 'react';
import { motion } from 'motion/react';
import { MapPin, ChevronLeft, Check, Loader2 } from 'lucide-react';
import { ItemStatus } from '../../../types';
import { ItemDraft } from './buyPawnTypes';

interface BuyPawnLocationStepProps {
  itemData: ItemDraft;
  setItemData: React.Dispatch<React.SetStateAction<ItemDraft>>;
  existingStockStatus: ItemStatus;
  setExistingStockStatus: (status: ItemStatus) => void;
  retailPriceInput: string;
  isFinalizing: boolean;
  onBack: () => void;
  onFinalize: () => void;
}

export const BuyPawnLocationStep: React.FC<BuyPawnLocationStepProps> = ({
  itemData,
  setItemData,
  existingStockStatus,
  setExistingStockStatus,
  retailPriceInput,
  isFinalizing,
  onBack,
  onFinalize,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: 15 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -15 }}
      className="space-y-6"
    >
      <div className="flex items-center gap-3.5 mb-2">
        <div className="w-10 h-10 rounded-xl bg-[#FDF0EA] text-[#C85A32] flex items-center justify-center font-bold">
          <MapPin className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900">Stock Location & Placement</h3>
          <p className="text-xs text-gray-500">
            Specify where the item is stored or placed in the shop
          </p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-7 shadow-xs space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-700">Display Location / Shelf</label>
            <input
              type="text"
              placeholder="e.g. Main Floor Display Rack 2, Glass Showcase A"
              value={itemData.stockLocation}
              onChange={(e) => setItemData({ ...itemData, stockLocation: e.target.value })}
              className="w-full bg-[#F8F9FA] border border-gray-200 rounded-xl px-4 py-2.5 text-xs text-gray-800 focus:outline-none focus:border-[#C85A32]"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-700">Initial Stock Status</label>
            <select
              value={existingStockStatus}
              onChange={(e) => setExistingStockStatus(e.target.value as ItemStatus)}
              className="w-full bg-[#F8F9FA] border border-gray-200 rounded-xl px-3 py-2.5 text-xs text-gray-800 focus:outline-none focus:border-[#C85A32]"
            >
              <option value="Retail Floor">Retail Floor (Immediate Sale)</option>
              <option value="Vault Hold">Vault Hold (Storage / High Value)</option>
              <option value="InStock">InStock (Backroom Inventory)</option>
            </select>
          </div>

          <div className="md:col-span-2 space-y-2">
            <label className="text-xs font-semibold text-gray-700">Internal Shop Note (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Received during store takeover, verified working"
              value={itemData.internalNote}
              onChange={(e) => setItemData({ ...itemData, internalNote: e.target.value })}
              className="w-full bg-[#F8F9FA] border border-gray-200 rounded-xl px-4 py-2 text-xs text-gray-800 focus:outline-none focus:border-[#C85A32]"
            />
          </div>
        </div>

        {/* SUMMARY BOX */}
        <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 text-xs space-y-2">
          <div className="flex justify-between font-semibold text-gray-800">
            <span>Item: {itemData.title}</span>
            <span>Retail: R {parseFloat(retailPriceInput || '0').toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-gray-500">
            <span>Category: {itemData.category}</span>
            <span>Condition: {itemData.condition}</span>
          </div>
          <p className="text-[11px] text-gray-400 italic pt-1 border-t border-gray-200">
            Provenance: {itemData.sourceNote}
          </p>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          onClick={onBack}
          disabled={isFinalizing}
          className="flex items-center gap-1.5 px-5 py-3 rounded-xl border border-gray-200 disabled:opacity-50 text-gray-600 hover:bg-gray-100 transition text-xs font-semibold cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back</span>
        </button>
        <button
          onClick={onFinalize}
          disabled={isFinalizing}
          className="flex-1 py-3 px-6 bg-emerald-600 disabled:bg-stone-200 disabled:text-stone-400 text-white rounded-xl font-semibold text-xs flex items-center justify-center gap-2 shadow-xs hover:bg-emerald-700 transition cursor-pointer"
        >
          {isFinalizing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Check className="w-4 h-4" />
          )}
          <span>{isFinalizing ? 'Saving stock…' : 'Complete Intake & Add Stock'}</span>
        </button>
      </div>
    </motion.div>
  );
};
