import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { PawnLoan } from '../../types';
import { ShieldCheck, Printer, MessageSquare, X, ChevronDown, ChevronUp, FileText } from 'lucide-react';

export const ContractModal: React.FC = () => {
  const { activeContractModal, setActiveContractModal, showToast, shopProfile, currentUserProfile } = useApp();
  const [showFullTerms, setShowFullTerms] = useState(false);

  if (!activeContractModal) return null;

  const loan = activeContractModal;

  const handlePrint = () => {
    window.print();
    showToast('Contract Printed', `NCR Statutory Agreement printed for ticket ${loan.ticketNumber}`, 'success');
  };

  const handleWhatsApp = () => {
    const cleanNum = loan.customerMobile?.replace(/\D/g, '') || '';
    const text = encodeURIComponent(`LocalMarket Statutory Agreement for Ticket ${loan.ticketNumber}. Amount: R${loan.principal}. Expiry: ${loan.expiryDate}`);
    const url = cleanNum ? `https://wa.me/${cleanNum}?text=${text}` : `https://wa.me/?text=${text}`;
    const win = window.open(url, '_blank');
    if (win) {
      showToast('Opening WhatsApp', `Launching WhatsApp handoff for ticket ${loan.ticketNumber}...`, 'info');
    } else {
      showToast('Popup Blocked', 'Please allow popups to open WhatsApp.', 'amber');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 my-8">
        {/* Header */}
        <div className="p-4 border-b border-[#2A2A2A] flex items-center justify-between bg-[#161616]">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#E87A5D]" />
            <h3 className="font-bold text-sm text-white font-headline">
              Statutory 30-Day Collateral Pledge Contract
            </h3>
          </div>
          <button
            onClick={() => setActiveContractModal(null)}
            className="p-1 rounded-lg text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Legal Paper Mockup */}
        <div className="p-6 bg-[#141414] overflow-y-auto max-h-[70vh]">
          <div className="bg-white text-black p-6 rounded-xl shadow-2xl font-serif text-xs space-y-4 border border-gray-300">
            {/* Header */}
            <div className="text-center border-b-2 border-black pb-3 space-y-1">
              <h2 className="font-black text-base uppercase tracking-wider font-sans">{shopProfile?.shop_name || 'Not configured'}</h2>
              <p className="text-[10px] text-gray-700 font-sans">
                {shopProfile?.registration_number ? `Reg: ${shopProfile.registration_number}` : 'Business Registration: Not configured'} 
                {shopProfile?.saps_dealer_license ? ` • SAPS License: ${shopProfile.saps_dealer_license}` : ' • SAPS Registration: Not configured'}
              </p>
              <h3 className="font-bold text-xs uppercase font-sans tracking-wide pt-1">
                COLLATERAL PLEDGE &amp; SHORT-TERM CREDIT AGREEMENT
              </h3>
              <p className="text-[9px] text-gray-600 font-sans">
                Form 20.1 in compliance with the National Credit Act (Act 34 of 2005) &amp; Second-Hand Goods Act (Act 6 of 2009)
              </p>
            </div>

            {/* Ticket & Dates */}
            <div className="grid grid-cols-2 gap-2 text-[11px] font-sans border-b border-gray-200 pb-2">
              <div>
                <span className="text-gray-600">Pledge Ticket Ref:</span>
                <span className="font-bold font-mono ml-1 text-black">{loan.ticketNumber}</span>
              </div>
              <div>
                <span className="text-gray-600">Vault Location:</span>
                <span className="font-bold font-mono ml-1">{loan.vaultShelf}</span>
              </div>
              <div>
                <span className="text-gray-600">Commencement Date:</span>
                <span className="font-medium ml-1">{loan.startDate}</span>
              </div>
              <div>
                <span className="text-gray-600">Maturity / Expiry Date:</span>
                <span className="font-bold text-red-700 ml-1">{loan.expiryDate} (30 Days)</span>
              </div>
            </div>

            {/* Part 1: Pledgor Identification */}
            <div className="space-y-1 text-[11px] font-sans border-b border-gray-200 pb-2">
              <h4 className="font-bold uppercase text-[10px] text-gray-600 tracking-wider">
                1. Consumer / Pledgor Identification
              </h4>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                <p><span className="text-gray-600">Full Name:</span> <strong>{loan.customerName}</strong></p>
                <p><span className="text-gray-600">RSA ID / Passport:</span> <strong className="font-mono">{loan.customerIdNumber}</strong></p>
                <p><span className="text-gray-600">Mobile Phone:</span> <strong>{loan.customerMobile}</strong></p>
                <p><span className="text-gray-600">Physical Domicile:</span> {loan.customerAddress}</p>
              </div>
            </div>

            {/* Part 2: Collateral Description */}
            <div className="space-y-1 text-[11px] font-sans border-b border-gray-200 pb-2">
              <h4 className="font-bold uppercase text-[10px] text-gray-600 tracking-wider">
                2. Pledged Collateral Specification
              </h4>
              <p><strong>Item Description:</strong> {loan.itemTitle}</p>
              <div className="grid grid-cols-2 gap-2">
                <p><span className="text-gray-600">Serial / IMEI:</span> <strong className="font-mono">{loan.serialOrImei}</strong></p>
                <p><span className="text-gray-600">Inspected Condition:</span> <strong>{loan.condition} Grade</strong></p>
              </div>
            </div>

            {/* Part 3: Financial Calculations */}
            <div className="space-y-1.5 text-[11px] font-sans border-b border-gray-200 pb-2">
              <h4 className="font-bold uppercase text-[10px] text-gray-600 tracking-wider">
                3. Financial Schedule &amp; Statutory Charges
              </h4>
              <div className="space-y-1 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span>Loan Principal Disbursed in Cash:</span>
                  <strong>R {loan.principal.toFixed(2)}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Permitted Monthly Interest (5.00% NCR Cap):</span>
                  <span>R {loan.monthlyInterest.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Monthly Vault Storage &amp; Admin Service Charge:</span>
                  <span>R {loan.monthlyStorageAdminFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-xs pt-1 border-t border-gray-300">
                  <span>TOTAL REDEMPTION DUE ON OR BEFORE EXPIRY:</span>
                  <span className="text-red-700">R {loan.totalRedemptionAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[10px] text-gray-600">
                  <span>Optional 30-Day Extension Fee (Interest Only):</span>
                  <span>R {loan.extensionFee.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Terms and Statutory Rights (Progressive Disclosure) */}
            <div className="border border-gray-200 rounded-lg p-2.5 bg-gray-50/70 text-[10px] font-sans">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-gray-800 font-bold">
                  <FileText className="w-3.5 h-3.5 text-[#E87A5D]" />
                  <span>National Credit Act &amp; Statutory Terms</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowFullTerms(prev => !prev)}
                  className="text-[10px] text-blue-700 hover:text-blue-900 font-semibold flex items-center gap-0.5 underline cursor-pointer"
                >
                  {showFullTerms ? (
                    <>
                      <span>Hide Detailed Clauses</span>
                      <ChevronUp className="w-3 h-3" />
                    </>
                  ) : (
                    <>
                      <span>View Full Clauses (NCA Act 34)</span>
                      <ChevronDown className="w-3 h-3" />
                    </>
                  )}
                </button>
              </div>

              {showFullTerms ? (
                <div className="mt-2 text-[9px] text-gray-700 space-y-1.5 leading-relaxed pt-2 border-t border-gray-200 animate-in fade-in">
                  <p>
                    <strong>1. Legal Warranty:</strong> The consumer warrants unencumbered lawful ownership of the pledged collateral. The merchant agrees to store and secure the item in designated vault storage facilities.
                  </p>
                  <p>
                    <strong>2. Statutory Redemption Window:</strong> The consumer holds unconditional right of redemption for 30 consecutive calendar days from contract commencement upon settlement of principal and regulated credit fees.
                  </p>
                  <p>
                    <strong>3. Forfeiture &amp; Realisation:</strong> In accordance with Section 21 of the Second-Hand Goods Act and National Credit Act guidelines, unredeemed contracts after 30 days are subject to lawful retail liquidation to recover outstanding principal.
                  </p>
                </div>
              ) : (
                <p className="text-[9px] text-gray-500 mt-1">
                  Standard 30-day statutory pledge terms apply. Ownership retained by consumer until Day 30 maturity.
                </p>
              )}
            </div>

            {/* Signatures */}
            <div className="pt-3 flex justify-between items-end text-[10px] font-sans border-t border-black">
              <div>
                <p className="font-bold">CONSUMER SIGNATURE / BIOMETRIC:</p>
                <div className="mt-1 w-36 border-b border-black text-gray-600 italic">
                  [Verified NFC / ID Signature]
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold">CREDIT PROVIDER DESK OFFICER:</p>
                <p className="text-gray-700">{currentUserProfile?.full_name || 'System Authorized Officer'}</p>
                <p className="text-[9px] text-emerald-800 font-bold uppercase">SAPS Dealer License: {shopProfile?.saps_dealer_license || 'Not configured'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 bg-[#161616] border-t border-[#2A2A2A] flex gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 py-2.5 rounded-xl bg-[#2A2A2A] hover:bg-[#383838] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition"
          >
            <Printer className="w-4 h-4 text-[#E87A5D]" />
            <span>Print Legal Agreement</span>
          </button>

          <button
            type="button"
            onClick={handleWhatsApp}
            className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow transition"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Send to Customer WhatsApp</span>
          </button>
        </div>
      </div>
    </div>
  );
};
