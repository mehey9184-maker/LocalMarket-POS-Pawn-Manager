import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { ItemCondition } from '../../types';
import {
  ShieldCheck,
  IdCard,
  CheckCircle2,
  Barcode,
  Sparkles,
  Printer,
  MessageSquare,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  Check,
  Plus,
  Minus
} from 'lucide-react';

export const IntakeDesk: React.FC = () => {
  const {
    customers,
    createIntakeTransaction,
    showToast,
    setIsScannerModalOpen,
    setActiveContractModal,
    pawnLoans,
    activeCustomer,
    setActiveCustomer
  } = useApp();

  // Guided Wizard Step: 1, 2, or 3
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Step 1: Customer Compliance
  const [customerName, setCustomerName] = useState(activeCustomer ? activeCustomer.fullName : 'Sipho Ndlovu');
  const [customerIdNumber, setCustomerIdNumber] = useState(activeCustomer ? activeCustomer.idNumber : '920414 5082 08 9');
  const [customerMobile, setCustomerMobile] = useState(activeCustomer ? activeCustomer.mobile : '+27 82 491 0023');
  const [customerAddress, setCustomerAddress] = useState(activeCustomer ? activeCustomer.address : '1442 Orlando West, Soweto, Johannesburg, 1804');
  const [isEditingCustomer, setIsEditingCustomer] = useState(false);

  // Automatically synchronize with globally active customer
  useEffect(() => {
    if (activeCustomer) {
      setCustomerName(activeCustomer.fullName);
      setCustomerIdNumber(activeCustomer.idNumber);
      setCustomerMobile(activeCustomer.mobile);
      setCustomerAddress(activeCustomer.address);
    }
  }, [activeCustomer]);

  // Step 2: Item & Valuation Engine
  const [txType, setTxType] = useState<'pawn' | 'buy'>('pawn');
  const [category, setCategory] = useState<'Phones & Tech' | 'Power Tools' | 'Audio & Visual' | 'Fine Jewelry & Gold' | 'Gaming Consoles' | 'Appliances'>('Phones & Tech');
  const [title, setTitle] = useState('Apple iPhone 12 128GB Black');
  const [serialOrImei, setSerialOrImei] = useState('354892019948210');
  const [condition, setCondition] = useState<ItemCondition>('Good');
  const [vaultShelf, setVaultShelf] = useState('BIN-B14');
  const [agreedOffer, setAgreedOffer] = useState<number>(2500);

  // Success / Completed State
  const [completedTx, setCompletedTx] = useState<{
    ticketNumber: string;
    isPawn: boolean;
    title: string;
    customerName: string;
    principal: number;
    vaultShelf: string;
    expiryDate: string;
  } | null>(null);

  // Dynamic NCR calculations (Statutory 5% cap + 8% storage/admin)
  const ncrInterest = agreedOffer * 0.05;
  const ncrAdminStorage = Math.round(agreedOffer * 0.08);
  const totalRedemptionDue = agreedOffer + ncrInterest + ncrAdminStorage;

  // 30-Day expiry calculation
  const getFormattedExpiryDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const expiryFormatted = getFormattedExpiryDate();

  // Quick select an existing customer
  const handleSelectCustomer = (c: typeof customers[0]) => {
    setActiveCustomer(c);
    setCustomerName(c.fullName);
    setCustomerIdNumber(c.idNumber);
    setCustomerMobile(c.mobile);
    setCustomerAddress(c.address);
    setIsEditingCustomer(false);
    showToast('Customer Loaded', `${c.fullName} • RSA ID Verified & Pinned`, 'info');
  };

  // Simulate scanning a new RSA Smart ID
  const handleSimulateIdScan = () => {
    setIsScannerModalOpen(true);
    // After quick simulation, set verified customer
    setTimeout(() => {
      const scannedCustomer: typeof customers[0] = {
        id: 'cust-scanned-01',
        fullName: 'Thabo Mokoena',
        idNumber: '881023 5142 08 1',
        idType: 'RSA Smart ID',
        mobile: '+27 83 204 9918',
        address: '419 Pimville Zone 2, Soweto, 1809',
        dob: '1988-10-23',
        gender: 'Male',
        verified: true,
        createdAt: '2026-01-15'
      };
      setActiveCustomer(scannedCustomer);
      setCustomerName(scannedCustomer.fullName);
      setCustomerIdNumber(scannedCustomer.idNumber);
      setCustomerMobile(scannedCustomer.mobile);
      setCustomerAddress(scannedCustomer.address);
      setIsScannerModalOpen(false);
      showToast('RSA ID Scanned', 'Smart Card Optical Check Validated & Pinned', 'success');
    }, 900);
  };

  const handleAdjustOffer = (delta: number) => {
    setAgreedOffer(prev => Math.max(100, prev + delta));
  };

  // Step 1 Validation
  const handleProceedToStep2 = () => {
    if (!customerName.trim() || !customerIdNumber.trim()) {
      showToast('Incomplete Compliance', 'Please verify customer name and SA ID number', 'amber');
      return;
    }
    setCurrentStep(2);
  };

  // Step 2 Validation
  const handleProceedToStep3 = () => {
    if (!title.trim()) {
      showToast('Missing Description', 'Please enter item title and specifications', 'amber');
      return;
    }
    if (agreedOffer <= 0) {
      showToast('Invalid Valuation', 'Please specify an agreed cash principal', 'amber');
      return;
    }
    setCurrentStep(3);
  };

  // Final Commit Transaction
  const handleFinalizeTransaction = () => {
    createIntakeTransaction({
      customer: {
        fullName: customerName,
        idNumber: customerIdNumber,
        mobile: customerMobile,
        address: customerAddress,
        idType: 'RSA Smart ID',
        gender: 'Not Specified',
        dob: '1992-04-14',
        verified: true
      },
      isPawn: txType === 'pawn',
      title,
      category,
      serialOrImei,
      condition,
      agreedOffer,
      vaultShelf: txType === 'pawn' ? vaultShelf : undefined,
      retailPriceEstimate: Math.round(agreedOffer * 1.85)
    });

    const generatedTicket = txType === 'pawn' ? `#PWN-${Math.floor(1000 + Math.random() * 9000)}` : `LM-${Math.floor(8000 + Math.random() * 1000)}`;
    setCompletedTx({
      ticketNumber: generatedTicket,
      isPawn: txType === 'pawn',
      title,
      customerName,
      principal: agreedOffer,
      vaultShelf: txType === 'pawn' ? vaultShelf : 'FLOOR-A01',
      expiryDate: expiryFormatted
    });
  };

  const handleStartNextIntake = () => {
    setCompletedTx(null);
    setCurrentStep(1);
    setTitle('Makita 18V Cordless Drill Kit');
    setSerialOrImei(`SN-${Math.floor(10000000 + Math.random() * 90000000)}`);
    setAgreedOffer(1400);
    setCondition('Good');
    setCategory('Power Tools');
    setVaultShelf('BIN-C08');
    showToast('New Intake Session', 'Ready for next customer assessment', 'info');
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#121212]">
      {/* 1. STEP PROGRESS HEADER */}
      <div className="bg-[#1E1E1E] border-b border-[#2A2A2A] px-4 lg:px-8 py-3.5 shrink-0">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#E87A5D]" />
            <div>
              <h2 className="text-sm font-semibold text-gray-100 font-headline">Buy / Pawn Intake Desk</h2>
              <p className="text-[11px] text-gray-400">South African Second-Hand Goods &amp; NCR Compliance</p>
            </div>
          </div>

          {/* Clean 3-Step Horizontal Indicator */}
          <div className="flex items-center gap-2 sm:gap-4 text-xs">
            {/* Step 1 */}
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition ${
                currentStep === 1
                  ? 'bg-[#C85A32] text-white font-medium shadow-sm'
                  : currentStep > 1
                  ? 'bg-[#161616] text-emerald-400 border border-[#2A2A2A]'
                  : 'bg-[#161616] text-gray-500'
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                currentStep === 1 ? 'bg-white/20 text-white' : currentStep > 1 ? 'bg-emerald-950 text-emerald-400' : 'bg-[#2A2A2A] text-gray-400'
              }`}>
                {currentStep > 1 ? <Check className="w-3 h-3" /> : '1'}
              </span>
              <span className="hidden sm:inline">1. Customer Compliance</span>
            </button>

            <span className="text-gray-600 hidden sm:inline">→</span>

            {/* Step 2 */}
            <button
              type="button"
              onClick={() => { if (customerName) setCurrentStep(2); }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition ${
                currentStep === 2
                  ? 'bg-[#C85A32] text-white font-medium shadow-sm'
                  : currentStep > 2
                  ? 'bg-[#161616] text-emerald-400 border border-[#2A2A2A]'
                  : 'bg-[#161616] text-gray-500'
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                currentStep === 2 ? 'bg-white/20 text-white' : currentStep > 2 ? 'bg-emerald-950 text-emerald-400' : 'bg-[#2A2A2A] text-gray-400'
              }`}>
                {currentStep > 2 ? <Check className="w-3 h-3" /> : '2'}
              </span>
              <span className="hidden sm:inline">2. Item &amp; Valuation</span>
            </button>

            <span className="text-gray-600 hidden sm:inline">→</span>

            {/* Step 3 */}
            <button
              type="button"
              onClick={() => { if (customerName && title) setCurrentStep(3); }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition ${
                currentStep === 3
                  ? 'bg-[#C85A32] text-white font-medium shadow-sm'
                  : 'bg-[#161616] text-gray-500'
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                currentStep === 3 ? 'bg-white/20 text-white' : 'bg-[#2A2A2A] text-gray-400'
              }`}>
                3
              </span>
              <span className="hidden sm:inline">3. Print Tag &amp; Finalize</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. MAIN WIZARD VIEWPORT */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-6 flex justify-center">
        <div className="w-full max-w-4xl space-y-6">

          {/* ============================================================
              COMPLETED CONFIRMATION SCREEN (IF FINALIZED)
             ============================================================ */}
          {completedTx ? (
            <div className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-2xl p-6 lg:p-8 shadow-xl text-center space-y-6 animate-in fade-in zoom-in-95">
              <div className="w-14 h-14 rounded-full bg-emerald-950/80 border border-emerald-600/50 flex items-center justify-center mx-auto text-emerald-400">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/40">
                  Transaction Successfully Logged
                </span>
                <h3 className="text-xl font-bold text-white mt-2 font-headline">
                  {completedTx.isPawn ? '30-Day Collateral Pledge Active' : 'Direct Buy-In Completed'}
                </h3>
                <p className="text-sm text-gray-400 mt-1">
                  Ticket <span className="font-mono text-white font-bold">{completedTx.ticketNumber}</span> has been dispatched to thermal printer and recorded in the SAPS Form 21 register.
                </p>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
                <div className="p-3 rounded-xl bg-[#141414] border border-[#2A2A2A]">
                  <span className="text-[10px] text-gray-400 uppercase font-mono block">Customer Pledgor</span>
                  <p className="text-sm font-semibold text-white truncate">{completedTx.customerName}</p>
                </div>
                <div className="p-3 rounded-xl bg-[#141414] border border-[#2A2A2A]">
                  <span className="text-[10px] text-gray-400 uppercase font-mono block">Collateral Item</span>
                  <p className="text-sm font-semibold text-white truncate">{completedTx.title}</p>
                </div>
                <div className="p-3 rounded-xl bg-[#141414] border border-[#2A2A2A]">
                  <span className="text-[10px] text-gray-400 uppercase font-mono block">Cash Principal Disbursed</span>
                  <p className="text-sm font-mono font-bold text-[#E87A5D]">R {completedTx.principal.toFixed(2)}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                {completedTx.isPawn && (
                  <button
                    type="button"
                    onClick={() => {
                      const loan = pawnLoans.find(l => l.ticketNumber === completedTx.ticketNumber) || pawnLoans[0];
                      if (loan) setActiveContractModal(loan);
                    }}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#2A2A2A] hover:bg-[#383838] text-white text-xs font-semibold flex items-center justify-center gap-2 transition"
                  >
                    <ShieldCheck className="w-4 h-4 text-[#E87A5D]" />
                    <span>View NCR Form 20.1 Contract</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleStartNextIntake}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#C85A32] hover:bg-[#b04d29] text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-lg transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>Start Next Customer Intake</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* ============================================================
                  STEP 1: CUSTOMER COMPLIANCE (DE-CLUTTERED)
                 ============================================================ */}
              {currentStep === 1 && (
                <div className="space-y-5 animate-in fade-in duration-200">
                  {/* Step Banner & Quick Actions */}
                  <div className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-2xl p-5 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-base font-bold text-white font-headline">Step 1: Customer Compliance Verification</h3>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Statutory identification required by the SA Second-Hand Goods Act (Act 6 of 2009).
                      </p>
                    </div>

                    {/* Action Trigger: Scan RSA ID */}
                    <button
                      type="button"
                      onClick={handleSimulateIdScan}
                      className="px-4 py-2.5 bg-[#C85A32] hover:bg-[#b04d29] text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow transition active:scale-95 shrink-0"
                    >
                      <IdCard className="w-4 h-4" />
                      <span>Scan RSA ID / Smart Card</span>
                    </button>
                  </div>

                  {/* Customer Selection Quick Pills */}
                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                    <span className="text-[11px] text-gray-400 font-mono shrink-0">Recent Verified Customers:</span>
                    {customers.slice(0, 3).map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleSelectCustomer(c)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-mono transition whitespace-nowrap border ${
                          customerIdNumber === c.idNumber
                            ? 'bg-[#291813] border-[#C85A32] text-white'
                            : 'bg-[#161616] border-[#2A2A2A] text-gray-300 hover:text-white'
                        }`}
                      >
                        {c.fullName}
                      </button>
                    ))}
                  </div>

                  {/* IDENTITY TRUST SCORECARD (UBER STYLE) */}
                  {activeCustomer && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in slide-in-from-top-2">
                      <div className="bg-[#141414] border border-[#2A2A2A] p-4 rounded-2xl flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                          <ShieldCheck className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Compliance Status</p>
                          <p className="text-sm font-bold text-white">RSA ID VERIFIED</p>
                        </div>
                      </div>
                      
                      <div className="bg-[#141414] border border-[#2A2A2A] p-4 rounded-2xl flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#C85A32]/10 flex items-center justify-center text-[#E87A5D]">
                          <RotateCcw className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Active Pledges</p>
                          <p className="text-sm font-bold text-white">
                            {pawnLoans.filter(l => l.customerIdNumber === activeCustomer.idNumber && l.status === 'Active').length} Active
                          </p>
                        </div>
                      </div>

                      <div className="bg-[#141414] border border-[#2A2A2A] p-4 rounded-2xl flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400">
                          <CheckCircle2 className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Trust Rating</p>
                          <p className="text-sm font-bold text-white">PLATINUM (100%)</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* RECENT PLEDGES CAROUSEL (FACEBOOK STYLE) */}
                  {activeCustomer && pawnLoans.filter(l => l.customerIdNumber === activeCustomer.idNumber).length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest px-1">Repeat Intake (Clone Previous Item)</p>
                      <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-2">
                        {pawnLoans
                          .filter(l => l.customerIdNumber === activeCustomer.idNumber)
                          .slice(0, 4)
                          .map(loan => (
                            <button
                              key={loan.id}
                              onClick={() => {
                                setTitle(loan.itemTitle);
                                setCategory(loan.itemCategory as any);
                                setSerialOrImei(loan.serialOrImei);
                                setCondition(loan.condition as any);
                                setAgreedOffer(loan.principal);
                                showToast('Item Cloned', `Metadata copied for ${loan.itemTitle}`, 'info');
                                setCurrentStep(2);
                              }}
                              className="shrink-0 w-48 bg-[#141414] border border-[#2A2A2A] hover:border-[#C85A32] rounded-xl p-3 text-left transition group"
                            >
                              <p className="text-xs font-bold text-gray-100 line-clamp-1 group-hover:text-[#E87A5D]">{loan.itemTitle}</p>
                              <div className="flex items-center justify-between mt-2">
                                <span className="text-[10px] text-gray-500 font-mono">Last: R {loan.principal}</span>
                                <Plus className="w-3.5 h-3.5 text-gray-600 group-hover:text-[#C85A32]" />
                              </div>
                            </button>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Verified Customer Data Card */}
                  <div className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-2xl p-5 shadow-md space-y-4">
                    <div className="flex items-center justify-between border-b border-[#2A2A2A] pb-3">
                      <div className="flex items-center gap-2">
                        <IdCard className="w-4 h-4 text-[#E87A5D]" />
                        <span className="text-xs font-semibold text-gray-200 uppercase tracking-wider">
                          Identity Verification Record
                        </span>
                      </div>

                      {/* De-cluttering Rule: Single high-contrast green badge */}
                      <span className="px-2.5 py-1 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-700/50 text-xs font-medium flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>SAPS &amp; ID Verified</span>
                      </span>
                    </div>

                    {/* 2-Column Key-Value Verified Data Grid */}
                    {isEditingCustomer ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-1">
                        <div>
                          <label className="block text-gray-400 mb-1">SA ID Number / Passport</label>
                          <input
                            type="text"
                            value={customerIdNumber}
                            onChange={(e) => setCustomerIdNumber(e.target.value)}
                            className="w-full bg-[#121212] border border-[#2A2A2A] rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-[#C85A32]"
                          />
                        </div>
                        <div>
                          <label className="block text-gray-400 mb-1">Full Legal Name</label>
                          <input
                            type="text"
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            className="w-full bg-[#121212] border border-[#2A2A2A] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#C85A32]"
                          />
                        </div>
                        <div>
                          <label className="block text-gray-400 mb-1">Mobile Contact (WhatsApp Enabled)</label>
                          <input
                            type="text"
                            value={customerMobile}
                            onChange={(e) => setCustomerMobile(e.target.value)}
                            className="w-full bg-[#121212] border border-[#2A2A2A] rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-[#C85A32]"
                          />
                        </div>
                        <div>
                          <label className="block text-gray-400 mb-1">Residential Domicile Address</label>
                          <input
                            type="text"
                            value={customerAddress}
                            onChange={(e) => setCustomerAddress(e.target.value)}
                            className="w-full bg-[#121212] border border-[#2A2A2A] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#C85A32]"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                        <div className="p-3 rounded-xl bg-[#141414] border border-[#2A2A2A]">
                          <span className="text-[10px] text-gray-400 uppercase font-mono block">SA ID Number</span>
                          <span className="text-sm font-mono font-semibold text-white">{customerIdNumber}</span>
                        </div>

                        <div className="p-3 rounded-xl bg-[#141414] border border-[#2A2A2A]">
                          <span className="text-[10px] text-gray-400 uppercase font-mono block">Full Legal Name</span>
                          <span className="text-sm font-semibold text-white">{customerName}</span>
                        </div>

                        <div className="p-3 rounded-xl bg-[#141414] border border-[#2A2A2A]">
                          <span className="text-[10px] text-gray-400 uppercase font-mono block">Mobile Contact</span>
                          <span className="text-sm font-mono font-medium text-gray-200">{customerMobile}</span>
                        </div>

                        <div className="p-3 rounded-xl bg-[#141414] border border-[#2A2A2A]">
                          <span className="text-[10px] text-gray-400 uppercase font-mono block">Residential Domicile</span>
                          <span className="text-xs text-gray-300 line-clamp-1">{customerAddress}</span>
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => setIsEditingCustomer(!isEditingCustomer)}
                        className="text-xs text-gray-400 hover:text-white underline underline-offset-4 transition"
                      >
                        {isEditingCustomer ? 'Save Details' : 'Edit Customer Fields'}
                      </button>
                    </div>
                  </div>

                  {/* Step 1 Footer Action */}
                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={handleProceedToStep2}
                      className="px-6 py-3 bg-[#C85A32] hover:bg-[#b04d29] text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-lg transition active:scale-[0.98]"
                    >
                      <span>Continue to Item Assessment</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* ============================================================
                  STEP 2: ITEM ASSESSMENT & VALUATION ENGINE
                 ============================================================ */}
              {currentStep === 2 && (
                <div className="space-y-5 animate-in fade-in duration-200">
                  {/* Deal Type Toggle */}
                  <div className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-2xl p-4 shadow-md flex items-center justify-between gap-4">
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase font-mono block">Intake Agreement Type</span>
                      <span className="text-xs font-semibold text-gray-200">Select whether item is pledged for loan or sold outright:</span>
                    </div>

                    <div className="flex p-1 bg-[#121212] rounded-xl border border-[#2A2A2A] shrink-0">
                      <button
                        type="button"
                        onClick={() => setTxType('pawn')}
                        className={`px-4 py-2 rounded-lg text-xs font-medium transition ${
                          txType === 'pawn'
                            ? 'bg-[#C85A32] text-white shadow-sm'
                            : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        30-Day Pawn Loan
                      </button>
                      <button
                        type="button"
                        onClick={() => setTxType('buy')}
                        className={`px-4 py-2 rounded-lg text-xs font-medium transition ${
                          txType === 'buy'
                            ? 'bg-[#C85A32] text-white shadow-sm'
                            : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        Outright Buy
                      </button>
                    </div>
                  </div>

                  {/* Essential Details Form */}
                  <div className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-2xl p-5 shadow-md space-y-4">
                    <h3 className="text-xs font-semibold text-gray-200 uppercase tracking-wider border-b border-[#2A2A2A] pb-2.5">
                      Collateral Specification
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      {/* Asset Category */}
                      <div>
                        <label className="block text-gray-400 mb-1.5 font-medium">Asset Category</label>
                        <select
                          value={category}
                          onChange={(e) => setCategory(e.target.value as any)}
                          className="w-full bg-[#141414] border border-[#2A2A2A] rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-[#C85A32]"
                        >
                          <option value="Phones & Tech">Phones &amp; Tech</option>
                          <option value="Power Tools">Power Tools</option>
                          <option value="Audio & Visual">Audio &amp; Visual</option>
                          <option value="Fine Jewelry & Gold">Fine Jewelry &amp; Gold</option>
                          <option value="Gaming Consoles">Gaming Consoles</option>
                          <option value="Appliances">Appliances</option>
                        </select>
                      </div>

                      {/* Designated Vault Shelf */}
                      <div>
                        <label className="block text-gray-400 mb-1.5 font-medium">Designated Vault Shelf</label>
                        <select
                          value={vaultShelf}
                          onChange={(e) => setVaultShelf(e.target.value)}
                          className="w-full bg-[#141414] border border-[#2A2A2A] rounded-xl px-3 py-2.5 text-white font-mono focus:outline-none focus:border-[#C85A32]"
                        >
                          <option value="BIN-B14">BIN-B14 (High-Value Tech Locker)</option>
                          <option value="BIN-A02">BIN-A02 (General Vault Shelving)</option>
                          <option value="BIN-C08">BIN-C08 (Power Tool Cage)</option>
                          <option value="SAFE-01">SAFE-01 (Jewelry &amp; Bullion Safe)</option>
                        </select>
                      </div>

                      {/* Item Title / Specs */}
                      <div className="sm:col-span-2">
                        <label className="block text-gray-400 mb-1.5 font-medium">Item Title &amp; Configuration</label>
                        <input
                          type="text"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          placeholder="e.g. Apple iPhone 12 128GB Black or Makita Cordless Drill..."
                          className="w-full bg-[#141414] border border-[#2A2A2A] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-[#C85A32]"
                        >
                        </input>
                      </div>

                      {/* Serial / IMEI Number */}
                      <div className="sm:col-span-2">
                        <label className="block text-gray-400 mb-1.5 font-medium">Serial / IMEI Number</label>
                        <div className="relative">
                          <input
                            type="text"
                            value={serialOrImei}
                            onChange={(e) => setSerialOrImei(e.target.value)}
                            placeholder="Physical serial number or 15-digit IMEI..."
                            className="w-full bg-[#141414] border border-[#2A2A2A] rounded-xl px-3.5 py-2.5 text-white font-mono focus:outline-none focus:border-[#C85A32]"
                          />
                          <span className="absolute right-3 top-2.5 text-[10px] text-gray-500 font-mono">
                            Checked against SAPS Stolen Registry
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Condition Selector */}
                    <div>
                      <label className="block text-gray-400 mb-1.5 text-xs font-medium">Inspected Condition</label>
                      <div className="grid grid-cols-4 gap-2">
                        {(['Mint', 'Good', 'Fair', 'Damaged'] as ItemCondition[]).map(cond => (
                          <button
                            key={cond}
                            type="button"
                            onClick={() => setCondition(cond)}
                            className={`py-2 rounded-xl text-xs font-medium transition border ${
                              condition === cond
                                ? 'bg-[#291813] border-[#C85A32] text-white shadow-sm'
                                : 'bg-[#141414] border-[#2A2A2A] text-gray-400 hover:text-white'
                            }`}
                          >
                            {cond}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* AI Valuation Panel */}
                  <div className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-2xl p-5 shadow-md space-y-4">
                    <div className="flex items-center justify-between border-b border-[#2A2A2A] pb-2.5">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-[#E87A5D]" />
                        <h3 className="text-xs font-semibold text-gray-200 uppercase tracking-wider">
                          Valuation &amp; Cash Offer Engine
                        </h3>
                      </div>
                      <span className="text-[10px] text-emerald-400 font-mono">Algorithmic Floor Model Active</span>
                    </div>

                    {/* Unified "Recommended Offer" card */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <button
                        type="button"
                        onClick={() => setAgreedOffer(Math.round(agreedOffer * 0.85))}
                        className="p-3 rounded-xl bg-[#141414] border border-[#2A2A2A] hover:border-amber-500/50 text-left transition"
                      >
                        <span className="text-[10px] text-gray-400 uppercase font-mono block">Conservative (30% RMV)</span>
                        <span className="text-sm font-mono text-gray-300">R {(agreedOffer * 0.85).toFixed(2)}</span>
                      </button>

                      <div className="p-3 rounded-xl bg-[#291813] border border-[#C85A32]/60">
                        <span className="text-[10px] text-[#E87A5D] uppercase font-mono font-medium block">Active Negotiation</span>
                        <span className="text-base font-mono font-bold text-white">R {agreedOffer.toFixed(2)}</span>
                        <div className="mt-1 h-1 w-full bg-[#1A1A1A] rounded-full overflow-hidden">
                           <div className="h-full bg-[#C85A32]" style={{ width: `${Math.min(100, (agreedOffer / 5000) * 100)}%` }} />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setAgreedOffer(Math.round(agreedOffer * 1.15))}
                        className="p-3 rounded-xl bg-[#141414] border border-[#2A2A2A] hover:border-emerald-500/50 text-left transition"
                      >
                        <span className="text-[10px] text-gray-400 uppercase font-mono block">High Conviction (55% RMV)</span>
                        <span className="text-sm font-mono text-emerald-400">R {(agreedOffer * 1.15).toFixed(2)}</span>
                      </button>
                    </div>

                    {/* Large, Clear Number Input for Agreed Offer */}
                    <div className="p-4 rounded-xl bg-[#141414] border border-[#2A2A2A] flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div>
                        <label className="text-xs font-semibold text-white block">
                          {txType === 'pawn' ? 'Agreed Cash Loan Principal (R)' : 'Agreed Purchase Price (R)'}
                        </label>
                        <p className="text-[11px] text-gray-400">Cash disbursed to customer immediately upon signing.</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleAdjustOffer(-100)}
                          className="p-2 rounded-lg bg-[#2A2A2A] hover:bg-[#383838] text-white transition"
                          title="Decrease R100"
                        >
                          <Minus className="w-4 h-4" />
                        </button>

                        <div className="relative w-36">
                          <span className="absolute left-3 top-2.5 text-xs text-gray-400 font-mono">R</span>
                          <input
                            type="number"
                            value={agreedOffer}
                            onChange={(e) => setAgreedOffer(Math.max(100, Number(e.target.value)))}
                            className="w-full bg-[#1E1E1E] border border-[#2A2A2A] rounded-xl pl-8 pr-3 py-2 text-sm font-mono font-bold text-white text-right focus:outline-none focus:border-[#C85A32]"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => handleAdjustOffer(100)}
                          className="p-2 rounded-lg bg-[#2A2A2A] hover:bg-[#383838] text-white transition"
                          title="Increase R100"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Live NCR Calculation Card (For 30-Day Pawn) */}
                    {txType === 'pawn' && (
                      <div className="p-4 rounded-xl bg-[#161616] border border-[#2A2A2A] space-y-2 text-xs">
                        <div className="flex items-center justify-between text-gray-400">
                          <span>Permitted Monthly Interest (5.00% NCR Cap):</span>
                          <span className="font-mono text-gray-200">R {ncrInterest.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between text-gray-400">
                          <span>Storage &amp; Administration Fee:</span>
                          <span className="font-mono text-gray-200">R {ncrAdminStorage.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-[#2A2A2A] font-semibold text-white">
                          <div>
                            <span>30-Day Total Redemption Due:</span>
                            <span className="text-[10px] text-gray-400 font-normal block">Matures {expiryFormatted}</span>
                          </div>
                          <span className="text-base font-mono font-bold text-[#C85A32]">
                            R {totalRedemptionDue.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Step 2 Footer Actions */}
                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={() => setCurrentStep(1)}
                      className="px-5 py-2.5 bg-[#1E1E1E] hover:bg-[#2A2A2A] border border-[#2A2A2A] text-gray-300 hover:text-white rounded-xl text-xs font-medium flex items-center gap-2 transition"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Back to Customer</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleProceedToStep3}
                      className="px-6 py-2.5 bg-[#C85A32] hover:bg-[#b04d29] text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-lg transition active:scale-[0.98]"
                    >
                      <span>Proceed to Final Review</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* ============================================================
                  STEP 3: PRINT TAG & FINALIZE
                 ============================================================ */}
              {currentStep === 3 && (
                <div className="space-y-5 animate-in fade-in duration-200">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {/* Left Column: Concise Deal Summary */}
                    <div className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-2xl p-5 shadow-md space-y-4 flex flex-col justify-between">
                      <div>
                        <h3 className="text-xs font-semibold text-gray-200 uppercase tracking-wider border-b border-[#2A2A2A] pb-2.5">
                          Intake Summary Review
                        </h3>

                        <div className="space-y-3 pt-3 text-xs">
                          {/* Customer */}
                          <div className="p-3 rounded-xl bg-[#141414] border border-[#2A2A2A]">
                            <span className="text-[10px] text-gray-400 uppercase font-mono block">Customer Pledgor</span>
                            <p className="font-semibold text-white">{customerName}</p>
                            <p className="text-[11px] text-gray-400 font-mono mt-0.5">ID: {customerIdNumber} • Tel: {customerMobile}</p>
                          </div>

                          {/* Item */}
                          <div className="p-3 rounded-xl bg-[#141414] border border-[#2A2A2A]">
                            <span className="text-[10px] text-gray-400 uppercase font-mono block">Assessed Collateral</span>
                            <p className="font-semibold text-white">{title}</p>
                            <div className="flex items-center gap-2 text-[11px] text-gray-400 mt-0.5">
                              <span>SN: {serialOrImei}</span>
                              <span>•</span>
                              <span>Grade: {condition}</span>
                              <span>•</span>
                              <span className="text-emerald-400">{vaultShelf}</span>
                            </div>
                          </div>

                          {/* Financials */}
                          <div className="p-3 rounded-xl bg-[#291813] border border-[#C85A32]/50 space-y-1">
                            <div className="flex justify-between items-baseline">
                              <span className="text-gray-300">Immediate Cash Payout:</span>
                              <span className="text-base font-mono font-bold text-[#C85A32]">R {agreedOffer.toFixed(2)}</span>
                            </div>
                            {txType === 'pawn' ? (
                              <div className="flex justify-between items-baseline text-[11px] text-gray-400 border-t border-white/10 pt-1">
                                <span>30-Day Redemption Total:</span>
                                <span className="text-white font-mono font-semibold">R {totalRedemptionDue.toFixed(2)}</span>
                              </div>
                            ) : (
                              <p className="text-[11px] text-gray-400 border-t border-white/10 pt-1">
                                Outright Purchase: Released to Retail Floor with 7-day test warranty.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 text-[11px] text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>Ready to register with SAPS Form 21 &amp; generate NCR ticket.</span>
                      </div>
                    </div>

                    {/* Right Column: Clean Zebra Thermal Asset Tag Preview */}
                    <div className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-2xl p-5 shadow-md flex flex-col items-center justify-center">
                      <span className="text-[10px] text-gray-400 uppercase font-mono mb-2 self-start">
                        Zebra Thermal Asset Tag Preview
                      </span>

                      {/* White Label Representation */}
                      <div className="w-full max-w-[280px] bg-white text-black p-4 rounded-lg shadow-xl font-mono text-[11px] space-y-2 border border-gray-300 select-none">
                        <div className="text-center border-b border-black pb-1.5">
                          <p className="font-black text-xs uppercase tracking-wider">LOCALMARKET SOWETO</p>
                          <p className="text-[9px] text-gray-700">NCRCP 12948 • SHG 00482</p>
                        </div>

                        {/* Simulated Zebra Barcode */}
                        <div className="py-1">
                          <div className="w-full h-8 bg-black rounded flex items-center justify-around px-2 text-white">
                            <div className="w-1 h-6 bg-white"></div>
                            <div className="w-2 h-6 bg-white"></div>
                            <div className="w-0.5 h-6 bg-white"></div>
                            <div className="w-1.5 h-6 bg-white"></div>
                            <div className="w-3 h-6 bg-white"></div>
                            <div className="w-1 h-6 bg-white"></div>
                            <div className="w-2 h-6 bg-white"></div>
                            <div className="w-1 h-6 bg-white"></div>
                          </div>
                          <p className="text-center text-[8px] font-bold mt-0.5 tracking-widest">
                            *PWN-{Math.floor(1000 + Math.random() * 9000)}*
                          </p>
                        </div>

                        <div className="space-y-0.5 text-[9px] border-t border-black/20 pt-1.5">
                          <p className="font-bold truncate text-[10px]">{title}</p>
                          <p className="text-gray-700 truncate">SN: {serialOrImei}</p>
                          <div className="flex justify-between font-bold pt-1">
                            <span>LOC: {vaultShelf}</span>
                            <span>{condition.toUpperCase()}</span>
                          </div>
                          <div className="flex justify-between pt-0.5 border-t border-black/10">
                            <span>PRINCIPAL:</span>
                            <span className="font-black">R {agreedOffer.toFixed(2)}</span>
                          </div>
                          <p className="text-[8px] text-gray-600 text-center pt-1">
                            HOLD TILL: {expiryFormatted}
                          </p>
                        </div>
                      </div>

                      <p className="text-[10px] text-gray-500 font-mono mt-3 text-center">
                        Auto-routed to Zebra Direct Thermal Printer #02
                      </p>
                    </div>
                  </div>

                  {/* Primary Fulfillment Action Area: Big Tech High-Velocity Pattern */}
                  <div className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-2xl p-6 shadow-xl space-y-4">
                    <div className="flex flex-col sm:flex-row items-center gap-3">
                      <button
                        type="button"
                        onClick={handleFinalizeTransaction}
                        className="flex-1 w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-tighter transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20 active:scale-[0.98]"
                      >
                        <MessageSquare className="w-5 h-5" />
                        <span>FINALIZE & SEND WHATSAPP RECEIPT</span>
                      </button>
                      
                      <button
                        type="button"
                        onClick={handleFinalizeTransaction}
                        className="flex-1 w-full py-4 bg-[#C85A32] hover:bg-[#b04d29] text-white rounded-xl text-xs font-black uppercase tracking-tighter transition flex items-center justify-center gap-2 shadow-lg shadow-[#C85A32]/20 active:scale-[0.98]"
                      >
                        <Printer className="w-5 h-5" />
                        <span>FINALIZE & PRINT THERMAL TAG</span>
                      </button>
                    </div>

                    <div className="flex items-center justify-center gap-6 pt-2">
                       <button
                        type="button"
                        onClick={() => setCurrentStep(2)}
                        className="text-[11px] text-gray-500 hover:text-white transition flex items-center gap-1.5"
                      >
                        <ArrowLeft className="w-3 h-3" />
                        <span>Back to Assessment</span>
                      </button>
                      <div className="h-4 w-px bg-[#2A2A2A]" />
                      <button
                        type="button"
                        onClick={() => { setCompletedTx(null); setCurrentStep(1); }}
                        className="text-[11px] text-gray-500 hover:text-red-400 transition flex items-center gap-1.5"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Reset Intake</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
