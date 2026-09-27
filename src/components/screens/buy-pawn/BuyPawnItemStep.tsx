import React from 'react';
import { motion } from 'motion/react';
import {
  Barcode,
  AlertTriangle,
  Trash2,
  Loader2,
  Upload,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { InventoryItem, ItemCondition } from '../../../types';
import { getProductSuggestion } from '../../../utils/suggestionEngine';
import { formatBytes } from '../../../utils/imageProcessor';
import { ItemDraft, TxType, PhotoUploadStatus, PhotoMeta } from './buyPawnTypes';

interface BuyPawnItemStepProps {
  itemData: ItemDraft;
  setItemData: React.Dispatch<React.SetStateAction<ItemDraft>>;
  txType: TxType;
  duplicateSerialMatch: InventoryItem | null | undefined;
  photoUploadStatus: PhotoUploadStatus;
  photoMeta: PhotoMeta | null;
  photoFileInputRef: React.RefObject<HTMLInputElement | null>;
  onPhotoFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenCamera: () => void;
  onRemovePhoto: () => void;
  onBack: () => void;
  onNext: () => void;
}

export const BuyPawnItemStep: React.FC<BuyPawnItemStepProps> = ({
  itemData,
  setItemData,
  txType,
  duplicateSerialMatch,
  photoUploadStatus,
  photoMeta,
  photoFileInputRef,
  onPhotoFileSelect,
  onOpenCamera,
  onRemovePhoto,
  onBack,
  onNext,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: 15 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -15 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-[#FDF0EA] text-[#C85A32] flex items-center justify-center font-bold">
            <Barcode className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Item Specifications</h3>
            <p className="text-xs text-gray-500">
              {txType === 'existing'
                ? 'Capture details for existing store merchandise'
                : txType === 'buy'
                ? 'Catalog item for direct purchase'
                : 'Register pawn loan collateral'}
            </p>
          </div>
        </div>
        {txType === 'existing' && (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Existing Stock Mode
          </span>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {/* TITLE */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-700">Item Description / Title *</label>
              <input
                id="item-title-input"
                type="text"
                placeholder="e.g. Samsung Galaxy S23 256GB - Phantom Black"
                value={itemData.title}
                onChange={(e) => setItemData({ ...itemData, title: e.target.value })}
                className="w-full bg-[#F8F9FA] border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-[#C85A32] focus:bg-white"
                autoFocus
              />
              {(() => {
                const suggestion = getProductSuggestion(itemData.title);
                if (!suggestion.suggestedText) return null;
                return (
                  <div className="flex items-center justify-between bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl text-xs text-amber-800 mt-1">
                    <span>{suggestion.message}</span>
                    <button
                      type="button"
                      onClick={() => setItemData({ ...itemData, title: suggestion.suggestedText! })}
                      className="font-semibold text-[#C85A32] hover:underline cursor-pointer"
                    >
                      Accept Suggestion
                    </button>
                  </div>
                );
              })()}
            </div>

            {/* CATEGORY & CONDITION */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700">Category *</label>
                <select
                  value={itemData.category}
                  onChange={(e) => setItemData({ ...itemData, category: e.target.value as any })}
                  className="w-full bg-[#F8F9FA] border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 focus:outline-none focus:border-[#C85A32]"
                >
                  <option>Phones & Tech</option>
                  <option>Computing & Laptops</option>
                  <option>Power Tools</option>
                  <option>Audio & Visual</option>
                  <option>Musical Instruments & Gear</option>
                  <option>Generators & Power Systems</option>
                  <option>Fine Jewelry & Gold</option>
                  <option>Watches & Luxury Goods</option>
                  <option>Gaming Consoles</option>
                  <option>Appliances</option>
                  <option>Sporting Goods & Bicycles</option>
                  <option>General Goods</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700">Serial Number / IMEI</label>
                <input
                  type="text"
                  placeholder="Optional or N/A"
                  value={itemData.serialOrImei}
                  onChange={(e) => setItemData({ ...itemData, serialOrImei: e.target.value })}
                  className="w-full bg-[#F8F9FA] border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 font-mono focus:outline-none focus:border-[#C85A32]"
                />
                {duplicateSerialMatch && (
                  <div
                    className={`mt-2 p-2.5 rounded-xl border text-xs flex items-start gap-2 ${
                      ['Retail Floor', 'Vault Hold', 'InStock', 'Reserved', 'Pawned'].includes(
                        duplicateSerialMatch.status
                      )
                        ? 'bg-red-50 border-red-300 text-red-900'
                        : duplicateSerialMatch.status === 'Flagged'
                        ? 'bg-purple-50 border-purple-300 text-purple-900'
                        : 'bg-amber-50 border-amber-300 text-amber-900'
                    }`}
                  >
                    <AlertTriangle
                      className={`w-4 h-4 shrink-0 mt-0.5 ${
                        ['Retail Floor', 'Vault Hold', 'InStock', 'Reserved', 'Pawned', 'Flagged'].includes(
                          duplicateSerialMatch.status
                        )
                          ? 'text-red-600'
                          : 'text-amber-600'
                      }`}
                    />
                    <div className="min-w-0">
                      <p className="font-bold text-[11px] leading-tight">
                        {['Retail Floor', 'Vault Hold', 'InStock', 'Reserved', 'Pawned'].includes(
                          duplicateSerialMatch.status
                        )
                          ? 'This serial/IMEI already belongs to active inventory.'
                          : duplicateSerialMatch.status === 'Flagged'
                          ? 'This serial/IMEI is flagged under compliance review.'
                          : 'This serial/IMEI was previously sold. Verify that this is the same physical item.'}
                      </p>
                      <p className="text-[10px] opacity-90 mt-0.5 leading-snug">
                        Matches item{' '}
                        <span className="font-mono font-bold">{duplicateSerialMatch.sku}</span> ("
                        {duplicateSerialMatch.title}") currently marked as{' '}
                        <span className="font-semibold">{duplicateSerialMatch.status}</span>.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* BRAND & MODEL */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700">Brand</label>
                <input
                  type="text"
                  placeholder="e.g. Samsung, Bosch, Apple"
                  value={itemData.brand}
                  onChange={(e) => setItemData({ ...itemData, brand: e.target.value })}
                  className="w-full bg-[#F8F9FA] border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 focus:outline-none focus:border-[#C85A32]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700">Model</label>
                <input
                  type="text"
                  placeholder="e.g. S23 5G, GSB 18V-50"
                  value={itemData.model}
                  onChange={(e) => setItemData({ ...itemData, model: e.target.value })}
                  className="w-full bg-[#F8F9FA] border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 focus:outline-none focus:border-[#C85A32]"
                />
              </div>
            </div>

            {/* CONDITION SELECTOR */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700">Condition</label>
              <div className="flex flex-wrap gap-2">
                {(['Mint', 'Excellent', 'Good', 'Fair', 'Damaged'] as ItemCondition[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setItemData({ ...itemData, condition: c })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                      itemData.condition === c
                        ? 'border-[#C85A32] bg-[#FDF0EA] text-[#C85A32] font-semibold'
                        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* EXISTING STOCK NOTE */}
            {txType === 'existing' && (
              <div className="space-y-1 pt-2">
                <label className="text-xs font-semibold text-gray-700">Provenance / Source Note</label>
                <input
                  type="text"
                  value={itemData.sourceNote}
                  onChange={(e) => setItemData({ ...itemData, sourceNote: e.target.value })}
                  className="w-full bg-[#F8F9FA] border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-700 focus:outline-none focus:border-[#C85A32]"
                />
                <p className="text-[11px] text-gray-400">
                  Clear note explaining that this item was already shop-owned prior to system setup.
                </p>
              </div>
            )}
          </div>

          {/* PHOTO UPLOAD & PREVIEW */}
          <div className="space-y-2 flex flex-col">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-gray-700">Item Photo</label>
              {itemData.imageUrl && (
                <button
                  type="button"
                  onClick={onRemovePhoto}
                  className="text-[11px] text-red-600 hover:text-red-700 flex items-center gap-1 font-medium transition cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Remove</span>
                </button>
              )}
            </div>

            {/* Hidden File Input */}
            <input
              ref={photoFileInputRef as any}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onPhotoFileSelect}
            />

            <div
              onClick={() => photoUploadStatus !== 'optimizing' && photoFileInputRef.current?.click()}
              className={`flex-1 rounded-2xl bg-gray-50 border-2 border-dashed ${
                itemData.imageUrl ? 'border-emerald-300' : 'border-gray-200 hover:border-[#C85A32]'
              } flex flex-col items-center justify-center p-3 overflow-hidden relative min-h-[180px] cursor-pointer transition group`}
            >
              {photoUploadStatus === 'optimizing' ? (
                <div className="flex flex-col items-center gap-2 text-[#C85A32]">
                  <Loader2 className="w-7 h-7 animate-spin" />
                  <span className="text-xs font-semibold">Optimizing photograph...</span>
                </div>
              ) : itemData.imageUrl ? (
                <div className="relative w-full h-full min-h-[160px]">
                  <img
                    src={itemData.imageUrl}
                    alt="Item Intake Preview"
                    className="w-full h-full object-cover rounded-xl"
                  />
                  {/* Visual status pills */}
                  <div className="absolute top-2 left-2 flex flex-col gap-1">
                    {photoUploadStatus === 'uploading' ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-black/70 backdrop-blur-md text-amber-300 border border-amber-300/30 shadow-xs flex items-center gap-1">
                        <Loader2 className="w-2.5 h-2.5 animate-spin" />
                        <span>Syncing to B2 in background</span>
                      </span>
                    ) : photoUploadStatus === 'synced' ||
                      (!itemData.imageUrl.startsWith('data:image/') &&
                        !itemData.imageUrl.includes('local/') &&
                        (itemData.imageUrl.startsWith('http://') || itemData.imageUrl.startsWith('https://'))) ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600/90 backdrop-blur-md text-white shadow-xs flex items-center gap-1">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        <span>Cloud Asset</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-700/90 backdrop-blur-md text-white shadow-xs">
                        Local Operational Photo
                      </span>
                    )}
                  </div>

                  {/* Compression savings badge */}
                  {photoMeta?.compressedSize && (
                    <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-lg text-[10px] font-mono font-medium bg-black/75 backdrop-blur-md text-stone-200">
                      {formatBytes(photoMeta.compressedSize)}
                      {photoMeta.originalSize && photoMeta.originalSize > photoMeta.compressedSize && (
                        <span className="text-emerald-400 ml-1">
                          (-
                          {Math.round(
                            (1 - photoMeta.compressedSize / photoMeta.originalSize) * 100
                          )}
                          %)
                        </span>
                      )}
                    </div>
                  )}

                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center text-white text-xs font-semibold gap-1.5">
                    <Upload className="w-4 h-4" />
                    <span>Replace photo</span>
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-400 space-y-2 p-2">
                  <div className="w-10 h-10 rounded-full bg-stone-100 text-stone-500 flex items-center justify-center mx-auto group-hover:scale-105 group-hover:text-[#C85A32] group-hover:bg-[#FDF0EA] transition">
                    <Camera className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-stone-700">Click to upload photo</p>
                    <p className="text-[10px] text-stone-400 mt-0.5">Optimized instantly to WebP</p>
                  </div>
                </div>
              )}
            </div>

            {/* Photo Action Buttons */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => photoFileInputRef.current?.click()}
                disabled={photoUploadStatus === 'optimizing'}
                className="flex-1 py-2 px-2.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs"
              >
                <Upload className="w-3.5 h-3.5 text-[#C85A32]" />
                <span>Upload File</span>
              </button>
              <button
                type="button"
                onClick={onOpenCamera}
                disabled={photoUploadStatus === 'optimizing'}
                className="flex-1 py-2 px-2.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs"
              >
                <Camera className="w-3.5 h-3.5 text-[#C85A32]" />
                <span>Live Camera</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-5 py-3 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-100 transition text-xs font-semibold"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back</span>
        </button>
        <button
          onClick={onNext}
          className="flex-1 py-3 px-6 bg-[#C85A32] text-white rounded-xl font-semibold text-xs flex items-center justify-center gap-2 shadow-xs hover:bg-[#A94725] transition"
        >
          <span>{txType === 'existing' ? 'Set Retail Pricing' : 'Valuation Review'}</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
};
