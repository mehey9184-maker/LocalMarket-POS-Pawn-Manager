import React from 'react';
import { motion } from 'motion/react';
import {
  IdCard,
  Search,
  ChevronRight,
  ChevronLeft,
  UserPlus,
  UserCheck,
  CheckCircle2,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { Customer, Seller } from '../../../types';
import { TxType, NewIdentityDraft } from './buyPawnTypes';
import { SellerHistoryDisplay } from './SellerHistoryDisplay';

interface BuyPawnIdentityStepProps {
  txType: TxType;
  identitySearch: string;
  setIdentitySearch: (val: string) => void;
  filteredIdentities: (Customer | Seller)[];
  selectedIdentity: Customer | Seller | null;
  isCreatingIdentity: boolean;
  setIsCreatingIdentity: (val: boolean) => void;
  newIdentity: NewIdentityDraft;
  setNewIdentity: React.Dispatch<React.SetStateAction<NewIdentityDraft>>;
  onSelectIdentity: (identity: Customer | Seller) => void;
  onCreateIdentity: () => void;
  onExplicitVerifyIdentity: () => void;
  onClearSelectedIdentity: () => void;
  onBack: () => void;
  onNext: () => void;
}

export const BuyPawnIdentityStep: React.FC<BuyPawnIdentityStepProps> = ({
  txType,
  identitySearch,
  setIdentitySearch,
  filteredIdentities,
  selectedIdentity,
  isCreatingIdentity,
  setIsCreatingIdentity,
  newIdentity,
  setNewIdentity,
  onSelectIdentity,
  onCreateIdentity,
  onExplicitVerifyIdentity,
  onClearSelectedIdentity,
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
      <div className="flex items-center gap-3.5 mb-4">
        <div className="w-10 h-10 rounded-xl bg-[#FDF0EA] text-[#C85A32] flex items-center justify-center font-bold">
          <IdCard className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900">
            {txType === 'buy' ? 'Seller' : 'Customer'} Identification
          </h3>
          <p className="text-xs text-gray-500">
            {txType === 'buy'
              ? 'Second-Hand Goods Act Form 21 Compliance'
              : 'NCR Act 34 Regulated Borrower Record'}
          </p>
        </div>
      </div>

      {!selectedIdentity && !isCreatingIdentity && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs space-y-6">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={`Search previous ${
                txType === 'buy' ? 'sellers' : 'customers'
              } by name, ID number, or phone...`}
              value={identitySearch}
              onChange={(e) => setIdentitySearch(e.target.value)}
              className="w-full bg-[#F8F9FA] border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#C85A32] focus:bg-white focus:ring-2 focus:ring-[#C85A32]/10 transition-all"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            {filteredIdentities.length > 0 && (
              <p className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider px-1">
                Previous {txType === 'buy' ? 'seller' : 'customer'} found:
              </p>
            )}
            {filteredIdentities.map((c) => (
              <button
                key={c.id}
                onClick={() => onSelectIdentity(c)}
                className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 hover:border-[#C85A32] hover:bg-[#FDF0EA]/20 transition flex items-center justify-between group"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-gray-200 text-gray-700 flex items-center justify-center font-bold text-xs uppercase">
                    {c.fullName.charAt(0)}
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-gray-900">{c.fullName}</p>
                    <p className="text-xs text-gray-500 font-mono">
                      {c.idNumber} · {c.mobile}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-[#C85A32]" />
              </button>
            ))}
          </div>

          <div className="pt-2 border-t border-gray-100 flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => setIsCreatingIdentity(true)}
              className="flex-1 py-3 px-4 rounded-xl border border-dashed border-gray-300 hover:border-[#C85A32] hover:bg-[#FDF0EA]/20 text-gray-600 hover:text-[#C85A32] transition flex items-center justify-center gap-2 text-xs font-semibold"
            >
              <UserPlus className="w-4 h-4" />
              <span>Create New {txType === 'buy' ? 'Seller' : 'Customer'} Record</span>
            </button>
          </div>
        </div>
      )}

      {/* CREATE NEW IDENTITY FORM */}
      {isCreatingIdentity && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <h4 className="text-sm font-bold text-gray-900">
              New {txType === 'buy' ? 'Seller' : 'Customer'} Record
            </h4>
            <button
              onClick={() => setIsCreatingIdentity(false)}
              className="text-xs text-gray-500 hover:text-gray-900 font-medium"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">ID Document Type</label>
              <select
                value={newIdentity.idType}
                onChange={(e) => setNewIdentity({ ...newIdentity, idType: e.target.value as any })}
                className="w-full bg-[#F8F9FA] border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-800 focus:outline-none focus:border-[#C85A32]"
              >
                <option>RSA Smart ID</option>
                <option>Green ID Book</option>
                <option>Passport</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">ID / Passport Number</label>
              <input
                id="new-identity-id-input"
                type="text"
                placeholder="e.g. 890412 5240 08 8"
                value={newIdentity.idNumber}
                onChange={(e) => setNewIdentity({ ...newIdentity, idNumber: e.target.value })}
                className="w-full bg-[#F8F9FA] border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 font-mono focus:outline-none focus:border-[#C85A32]"
              />
            </div>

            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs font-medium text-gray-600">Full Legal Name</label>
              <input
                id="new-identity-name-input"
                type="text"
                placeholder="e.g. Siyabonga Mthembu"
                value={newIdentity.fullName}
                onChange={(e) => setNewIdentity({ ...newIdentity, fullName: e.target.value })}
                className="w-full bg-[#F8F9FA] border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 focus:outline-none focus:border-[#C85A32]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Mobile Phone</label>
              <input
                id="new-identity-mobile-input"
                type="text"
                placeholder="e.g. +27 72 419 8023"
                value={newIdentity.mobile}
                onChange={(e) => setNewIdentity({ ...newIdentity, mobile: e.target.value })}
                className="w-full bg-[#F8F9FA] border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 focus:outline-none focus:border-[#C85A32]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Physical Residential Address</label>
              <input
                id="new-identity-address-input"
                type="text"
                placeholder="e.g. 1428 Zone 4, Soweto"
                value={newIdentity.address}
                onChange={(e) => setNewIdentity({ ...newIdentity, address: e.target.value })}
                className="w-full bg-[#F8F9FA] border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 focus:outline-none focus:border-[#C85A32]"
              />
            </div>
          </div>

          <button
            onClick={onCreateIdentity}
            className="w-full py-3 bg-[#C85A32] text-white rounded-xl font-semibold text-xs hover:bg-[#A94725] transition shadow-xs flex items-center justify-center gap-2"
          >
            <UserCheck className="w-4 h-4" />
            <span>Save Identity</span>
          </button>
          <p className="text-[11px] text-gray-500 text-center">Status on save: Verification pending</p>
        </div>
      )}

      {/* SELECTED IDENTITY DISPLAY */}
      {selectedIdentity && (
        <div className="space-y-4">
          <div
            className={`p-5 rounded-2xl bg-white border-2 ${
              selectedIdentity.verified ? 'border-emerald-500/40' : 'border-amber-400/50'
            } shadow-xs flex items-center justify-between`}
          >
            <div className="flex items-center gap-3.5">
              <div
                className={`w-11 h-11 rounded-xl ${
                  selectedIdentity.verified
                    ? 'bg-emerald-50 text-emerald-600'
                    : 'bg-amber-50 text-amber-600'
                } flex items-center justify-center font-bold`}
              >
                {selectedIdentity.verified ? (
                  <CheckCircle2 className="w-6 h-6" />
                ) : (
                  <Clock className="w-6 h-6" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${
                      selectedIdentity.verified
                        ? 'text-emerald-700 bg-emerald-50'
                        : 'text-amber-700 bg-amber-50'
                    }`}
                  >
                    {selectedIdentity.verified
                      ? `Verified ${txType === 'buy' ? 'Seller' : 'Customer'}`
                      : `Verification Pending · ${txType === 'buy' ? 'Seller' : 'Customer'}`}
                  </span>
                </div>
                <h4 className="text-base font-bold text-gray-900 mt-0.5">
                  {selectedIdentity.fullName}
                </h4>
                <p className="text-xs text-gray-500 font-mono">
                  {selectedIdentity.idNumber} · {selectedIdentity.mobile}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!selectedIdentity.verified && (
                <button
                  type="button"
                  onClick={onExplicitVerifyIdentity}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-xs flex items-center gap-1.5 transition"
                  title="Verify against physical South African ID document or card"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Verify Physical ID</span>
                </button>
              )}
              <button
                onClick={onClearSelectedIdentity}
                className="text-xs text-gray-500 hover:text-gray-900 font-semibold px-2 py-1.5"
              >
                Change
              </button>
            </div>
          </div>

          {txType === 'buy' && <SellerHistoryDisplay sellerId={selectedIdentity.id} />}
        </div>
      )}

      <div className="flex gap-3 pt-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-5 py-3 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-100 transition text-xs font-semibold"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back</span>
        </button>
        <button
          onClick={onNext}
          disabled={!selectedIdentity}
          className="flex-1 py-3 px-6 bg-[#C85A32] disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-xl font-semibold text-xs flex items-center justify-center gap-2 shadow-xs hover:bg-[#A94725] transition"
        >
          <span>Item Details</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
};
