import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useInventory } from '../../context/InventoryContext';
import { useLoans } from '../../context/LoanContext';
import { useCustomers } from '../../context/CustomerContext';
import { useSaps } from '../../context/SapsContext';
import { ItemCondition, InventoryItem, PawnLoan, Customer } from '../../types';
import { roundRetailPrice } from '../../utils/pricingRules';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShieldCheck,
  IdCard,
  CheckCircle2,
  Barcode,
  Printer,
  ArrowRight,
  Check,
  Plus,
  Lock,
  ShoppingBag,
  Scale,
  Search,
  Camera,
  Smartphone,
  UserPlus,
  Info,
  ChevronRight,
  ChevronLeft,
  X,
  FileText,
  TrendingUp
} from 'lucide-react';

type WorkflowStep = 'mode' | 'customer' | 'item' | 'valuation' | 'deal' | 'completion';

export const BuyPawn: React.FC = () => {
  const { showToast, businessRules, shopProfile, setActiveContractModal } = useApp();
  const { user } = useAuth();
  const { addItem } = useInventory();
  const { createLoan } = useLoans();
  const { customers, addCustomer } = useCustomers();
  const { addSapsEntry } = useSaps();

  // State
  const [step, setStep] = useState<WorkflowStep>('mode');
  const [txType, setTxType] = useState<'buy' | 'pawn' | null>(null);
  
  // Step 1: Customer State
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    fullName: '',
    idNumber: '',
    mobile: '',
    address: '',
    idType: 'RSA Smart ID' as any
  });

  // Step 2: Item State
  const [itemData, setItemData] = useState({
    title: '',
    category: 'Phones & Tech' as any,
    brand: '',
    model: '',
    serialOrImei: '',
    condition: 'Good' as ItemCondition,
    imageUrl: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&q=80&w=300&h=300'
  });

  // Step 3: Valuation State
  const [agreedOffer, setAgreedOffer] = useState<number>(0);
  const [suggestedRetail, setSuggestedRetail] = useState<number>(0);

  // Step 4: Completion State
  const [result, setResult] = useState<{
    assetTag: string;
    ticketNumber?: string;
    item: InventoryItem;
    loan?: PawnLoan;
  } | null>(null);

  // Derived Values for Pawn
  const pawnCalculations = useMemo(() => {
    if (txType !== 'pawn') return null;
    const interest = agreedOffer * businessRules.pawnMonthlyInterestRate;
    const adminFee = agreedOffer * businessRules.pawnStorageAdminFeeRate;
    const totalRedemption = agreedOffer + interest + adminFee;
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + businessRules.defaultLoanTermDays);
    
    return {
      interest,
      adminFee,
      totalRedemption,
      expiryDate: expiry.toISOString().split('T')[0]
    };
  }, [txType, agreedOffer, businessRules]);

  // Handlers
  const handleNext = () => {
    if (step === 'mode') setStep('customer');
    else if (step === 'customer') {
      if (!selectedCustomer) {
        showToast('Customer Required', 'Please select or create a customer first', 'amber');
        return;
      }
      setStep('item');
    }
    else if (step === 'item') {
      if (!itemData.title) {
        showToast('Details Missing', 'Item title is required', 'amber');
        return;
      }
      // Calculate suggested valuation
      const base = itemData.category === 'Fine Jewelry & Gold' ? 2000 : 1000;
      setAgreedOffer(base);
      setSuggestedRetail(roundRetailPrice(base * businessRules.defaultRetailMarkupMultiplier, businessRules.retailRoundingMode));
      setStep('valuation');
    }
    else if (step === 'valuation') setStep('deal');
  };

  const handleBack = () => {
    if (step === 'customer') setStep('mode');
    else if (step === 'item') setStep('customer');
    else if (step === 'valuation') setStep('item');
    else if (step === 'deal') setStep('valuation');
  };

  const selectCustomer = (c: Customer) => {
    setSelectedCustomer(c);
    setIsCreatingCustomer(false);
    showToast('Customer Verified', `${c.fullName} selected`, 'success');
  };

  const handleCreateCustomer = async () => {
    if (!newCustomer.fullName || !newCustomer.idNumber) {
      showToast('Error', 'Full name and ID number are required', 'error');
      return;
    }
    const id = await addCustomer({
      ...newCustomer,
      dob: '1990-01-01', // Placeholder
      gender: 'Other', // Placeholder
      verified: true
    });
    const created = { ...newCustomer, id, createdAt: new Date().toISOString(), verified: true, dob: '1990-01-01', gender: 'Other' } as Customer;
    setSelectedCustomer(created);
    setIsCreatingCustomer(false);
    showToast('Customer Created', created.fullName, 'success');
  };

  const handleFinalize = async () => {
    if (!selectedCustomer || !txType) return;

    const sku = `SKU-${Math.floor(Math.random() * 90000 + 10000)}`;
    
    // 1. Create Inventory Item
    const itemId = await addItem({
      sku,
      title: itemData.title,
      category: itemData.category,
      serialOrImei: itemData.serialOrImei,
      condition: itemData.condition,
      acquisitionType: txType === 'buy' ? 'Buy' : 'Pawn',
      costBasis: agreedOffer,
      retailPrice: txType === 'buy' ? suggestedRetail : Math.round(agreedOffer * 1.85),
      status: txType === 'buy' ? 'Retail Floor' : 'Vault Hold',
      imageUrl: itemData.imageUrl,
      specs: `${itemData.brand} ${itemData.model}`,
      vaultLocation: txType === 'pawn' ? businessRules.defaultVaultShelf : undefined
    });

    const item = { 
      id: itemId, 
      sku, 
      ...itemData, 
      acquisitionType: txType === 'buy' ? 'Buy' : 'Pawn',
      costBasis: agreedOffer,
      retailPrice: txType === 'buy' ? suggestedRetail : Math.round(agreedOffer * 1.85),
      status: txType === 'buy' ? 'Retail Floor' : 'Vault Hold',
      addedAt: new Date().toISOString()
    } as InventoryItem;

    let loan: PawnLoan | undefined;

    // 2. If Pawn, create Loan
    if (txType === 'pawn' && pawnCalculations) {
      const ticketNumber = `PWN-${Math.floor(Math.random() * 9000 + 1000)}`;
      const loanId = await createLoan({
        ticketNumber,
        customerId: selectedCustomer.id,
        customerName: selectedCustomer.fullName,
        customerIdNumber: selectedCustomer.idNumber,
        customerMobile: selectedCustomer.mobile,
        customerAddress: selectedCustomer.address,
        itemId: itemId,
        itemTitle: itemData.title,
        itemCategory: itemData.category,
        serialOrImei: itemData.serialOrImei,
        condition: itemData.condition,
        itemImageUrl: itemData.imageUrl,
        principal: agreedOffer,
        ncrMonthlyRate: businessRules.pawnMonthlyInterestRate,
        monthlyInterest: pawnCalculations.interest,
        monthlyStorageAdminFee: pawnCalculations.adminFee,
        totalRedemptionAmount: pawnCalculations.totalRedemption,
        extensionFee: pawnCalculations.adminFee + pawnCalculations.interest,
        startDate: new Date().toISOString().split('T')[0],
        expiryDate: pawnCalculations.expiryDate,
        daysRemaining: businessRules.defaultLoanTermDays,
        daysElapsed: 0,
        vaultShelf: businessRules.defaultVaultShelf,
        status: 'Active',
        qrToken: Math.random().toString(36).substring(7),
        history: [{
          date: new Date().toISOString(),
          action: 'Created',
          amount: agreedOffer,
          note: 'Loan initiated'
        }]
      });
      loan = { id: loanId, ticketNumber, ...pawnCalculations, ...selectedCustomer, ...itemData, status: 'Active' } as any;
    }

    // 3. Record SAPS Entry
    await addSapsEntry({
      timestamp: new Date().toISOString(),
      customerId: selectedCustomer.id,
      customerName: selectedCustomer.fullName,
      customerIdNumber: selectedCustomer.idNumber,
      customerAddress: selectedCustomer.address,
      customerPhone: selectedCustomer.mobile,
      itemDescription: itemData.title,
      category: itemData.category,
      serialOrImei: itemData.serialOrImei,
      condition: itemData.condition,
      acquisitionType: txType === 'buy' ? 'Buy' : 'Pawn',
      considerationPaid: agreedOffer,
      officerName: user?.user_metadata?.full_name || 'System Operator',
      policeStationRef: shopProfile.saps_dealer_license,
      verificationStatus: 'VERIFIED',
      barcodeRef: sku
    });

    setResult({
      assetTag: sku,
      ticketNumber: loan?.ticketNumber,
      item,
      loan
    });
    setStep('completion');
    showToast('Intake Complete', txType === 'buy' ? 'Item added to floor' : 'Loan created and item vaulted', 'success');
  };

  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return [];
    const q = customerSearch.toLowerCase();
    return customers.filter(c => 
      c.fullName.toLowerCase().includes(q) || 
      c.idNumber.includes(q) || 
      c.mobile.includes(q)
    ).slice(0, 5);
  }, [customers, customerSearch]);

  const resetWorkflow = () => {
    setStep('mode');
    setTxType(null);
    setSelectedCustomer(null);
    setIsCreatingCustomer(false);
    setAgreedOffer(0);
    setResult(null);
    setItemData({
      title: '',
      category: 'Phones & Tech',
      brand: '',
      model: '',
      serialOrImei: '',
      condition: 'Good',
      imageUrl: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&q=80&w=300&h=300'
    });
  };

  // UI Components
  const ProgressBar = () => (
    <div className="flex items-center gap-2 mb-8 px-2">
      {['Mode', 'Customer', 'Item', 'Valuation', 'Deal'].map((s, i) => {
        const stepMap: Record<WorkflowStep, number> = { mode: 0, customer: 1, item: 2, valuation: 3, deal: 4, completion: 5 };
        const isActive = stepMap[step] === i;
        const isPast = stepMap[step] > i;
        return (
          <React.Fragment key={s}>
            <div className={`flex items-center gap-2 ${isActive ? 'text-[#E87A5D]' : isPast ? 'text-emerald-500' : 'text-gray-600'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border ${
                isActive ? 'border-[#C85A32] bg-[#C85A32]/10' : isPast ? 'border-emerald-500 bg-emerald-500/10' : 'border-gray-700 bg-transparent'
              }`}>
                {isPast ? <Check className="w-3 h-3" /> : i + 1}
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">{s}</span>
            </div>
            {i < 4 && <div className={`flex-1 h-px ${isPast ? 'bg-emerald-500/30' : 'bg-gray-800'}`} />}
          </React.Fragment>
        );
      })}
    </div>
  );

  return (
    <div className="flex-1 flex flex-col bg-[#121212] overflow-hidden">
      {/* Header */}
      <div className="px-8 py-6 bg-[#1A1A1A] border-b border-[#2A2A2A] shrink-0">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#C85A32]/10 flex items-center justify-center text-[#E87A5D]">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white uppercase tracking-tight">Counter Intake</h2>
              <p className="text-xs text-gray-500 uppercase font-bold tracking-widest">Statutory Buy & Pawn Workflow</p>
            </div>
          </div>
          {step !== 'mode' && step !== 'completion' && (
            <button onClick={resetWorkflow} className="p-2 text-gray-500 hover:text-white transition">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 no-scrollbar">
        <div className="max-w-4xl mx-auto">
          {step !== 'completion' && <ProgressBar />}

          <AnimatePresence mode="wait">
            {/* START: MODE SELECTION */}
            {step === 'mode' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-8 py-10"
              >
                <button 
                  onClick={() => { setTxType('buy'); handleNext(); }}
                  className="group p-10 rounded-[2.5rem] bg-[#1A1A1A] border border-[#2A2A2A] hover:border-[#E87A5D]/50 transition-all text-left space-y-6 shadow-2xl"
                >
                  <div className="w-16 h-16 rounded-2xl bg-[#E87A5D]/10 flex items-center justify-center text-[#E87A5D] group-hover:scale-110 transition-transform">
                    <ShoppingBag className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-3xl font-black text-white uppercase tracking-tight">Buy Item</h3>
                    <p className="text-gray-500 text-sm mt-2 leading-relaxed">Direct purchase for retail stock. Ownership transfers immediately. Best for high-demand consumer electronics and tools.</p>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-black text-[#E87A5D] uppercase tracking-[0.2em] pt-4">
                    <span>Start Purchase Flow</span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </button>

                <button 
                  onClick={() => { setTxType('pawn'); handleNext(); }}
                  className="group p-10 rounded-[2.5rem] bg-[#1A1A1A] border border-[#2A2A2A] hover:border-blue-500/50 transition-all text-left space-y-6 shadow-2xl"
                >
                  <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                    <Lock className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-3xl font-black text-white uppercase tracking-tight">Pawn Item</h3>
                    <p className="text-gray-500 text-sm mt-2 leading-relaxed">30-day collateralized loan. Item is vaulted. Subject to NCR Act 34. Customer retains right of redemption.</p>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] pt-4">
                    <span>Start Pawn Flow</span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </button>
              </motion.div>
            )}

            {/* STEP 1: CUSTOMER */}
            {step === 'customer' && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-[#C85A32]/10 flex items-center justify-center text-[#E87A5D]">
                    <IdCard className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white uppercase tracking-tight">Identity Verification</h3>
                    <p className="text-xs text-gray-500 uppercase font-bold tracking-widest">Compliance Requirement: Second Hand Goods Act</p>
                  </div>
                </div>

                {!selectedCustomer && !isCreatingCustomer && (
                  <div className="space-y-6">
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                      <input 
                        type="text" 
                        placeholder="SEARCH BY NAME, RSA ID, OR MOBILE..." 
                        value={customerSearch}
                        onChange={e => setCustomerSearch(e.target.value)}
                        className="w-full bg-[#1A1A1A] border-2 border-[#2A2A2A] rounded-2xl pl-12 pr-4 py-4 text-white font-mono focus:border-[#C85A32] outline-none"
                        autoFocus
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      {filteredCustomers.map(c => (
                        <button 
                          key={c.id} 
                          onClick={() => selectCustomer(c)}
                          className="p-4 rounded-2xl bg-[#1A1A1A] border border-[#2A2A2A] hover:border-[#C85A32] transition flex items-center justify-between group"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-gray-800 flex items-center justify-center text-gray-400 font-bold uppercase">
                              {c.fullName.charAt(0)}
                            </div>
                            <div className="text-left">
                              <p className="text-sm font-bold text-white">{c.fullName}</p>
                              <p className="text-[10px] text-gray-500 font-mono">{c.idNumber}</p>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-700 group-hover:text-[#E87A5D]" />
                        </button>
                      ))}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-gray-800">
                      <button 
                        onClick={() => setIsCreatingCustomer(true)}
                        className="flex-1 p-6 rounded-[2rem] bg-[#1A1A1A] border-2 border-dashed border-[#333] hover:border-[#C85A32]/50 transition flex flex-col items-center gap-3 text-gray-400 hover:text-white"
                      >
                        <UserPlus className="w-8 h-8" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Manual New Entry</span>
                      </button>
                      <button className="flex-1 p-6 rounded-[2rem] bg-[#1A1A1A] border-2 border-dashed border-[#333] hover:border-blue-500/50 transition flex flex-col items-center gap-3 text-gray-400 hover:text-white">
                        <Smartphone className="w-8 h-8" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Request Mobile Link</span>
                      </button>
                    </div>
                  </div>
                )}

                {isCreatingCustomer && (
                  <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-3xl p-8 space-y-6">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-black text-white uppercase tracking-widest">New Identity Record</h4>
                      <button onClick={() => setIsCreatingCustomer(false)} className="text-xs text-gray-500 hover:text-white">Cancel</button>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">ID Type</label>
                        <select 
                          value={newCustomer.idType}
                          onChange={e => setNewCustomer({...newCustomer, idType: e.target.value as any})}
                          className="w-full bg-[#121212] border border-[#2A2A2A] rounded-xl px-4 py-3 text-white focus:border-[#C85A32] outline-none"
                        >
                          <option>RSA Smart ID</option>
                          <option>Green ID Book</option>
                          <option>Passport</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">RSA ID / Passport Number</label>
                        <input 
                          type="text" 
                          value={newCustomer.idNumber}
                          onChange={e => setNewCustomer({...newCustomer, idNumber: e.target.value})}
                          className="w-full bg-[#121212] border border-[#2A2A2A] rounded-xl px-4 py-3 text-white font-mono focus:border-[#C85A32] outline-none"
                        />
                      </div>
                      <div className="sm:col-span-2 space-y-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Legal Full Name</label>
                        <input 
                          type="text" 
                          value={newCustomer.fullName}
                          onChange={e => setNewCustomer({...newCustomer, fullName: e.target.value})}
                          className="w-full bg-[#121212] border border-[#2A2A2A] rounded-xl px-4 py-3 text-white focus:border-[#C85A32] outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Mobile Number</label>
                        <input 
                          type="text" 
                          value={newCustomer.mobile}
                          onChange={e => setNewCustomer({...newCustomer, mobile: e.target.value})}
                          className="w-full bg-[#121212] border border-[#2A2A2A] rounded-xl px-4 py-3 text-white focus:border-[#C85A32] outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Address</label>
                        <input 
                          type="text" 
                          value={newCustomer.address}
                          onChange={e => setNewCustomer({...newCustomer, address: e.target.value})}
                          className="w-full bg-[#121212] border border-[#2A2A2A] rounded-xl px-4 py-3 text-white focus:border-[#C85A32] outline-none"
                        />
                      </div>
                    </div>

                    <button 
                      onClick={handleCreateCustomer}
                      className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-emerald-600/20 hover:bg-emerald-500 transition"
                    >
                      Verify & Create Record
                    </button>
                  </div>
                )}

                {selectedCustomer && (
                  <div className="p-8 rounded-[2rem] bg-emerald-950/20 border border-emerald-500/30 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                        <CheckCircle2 className="w-8 h-8" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Verified Identity</p>
                        <h4 className="text-xl font-bold text-white">{selectedCustomer.fullName}</h4>
                        <p className="text-xs text-gray-500 font-mono mt-0.5">{selectedCustomer.idNumber}</p>
                      </div>
                    </div>
                    <button onClick={() => setSelectedCustomer(null)} className="text-xs text-gray-500 hover:text-white uppercase font-black tracking-widest">Change</button>
                  </div>
                )}

                <div className="flex gap-4 pt-6">
                  <button onClick={handleBack} className="flex items-center gap-2 px-6 py-4 text-gray-500 hover:text-white transition">
                    <ChevronLeft className="w-4 h-4" />
                    <span className="text-xs font-black uppercase tracking-widest">Back</span>
                  </button>
                  <button 
                    onClick={handleNext}
                    disabled={!selectedCustomer}
                    className="flex-1 py-4 bg-[#C85A32] disabled:bg-gray-800 disabled:text-gray-500 text-white rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl shadow-[#C85A32]/20"
                  >
                    <span>Item Assessment</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 2: ITEM */}
            {step === 'item' && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-[#C85A32]/10 flex items-center justify-center text-[#E87A5D]">
                    <Barcode className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white uppercase tracking-tight">Asset Capture</h3>
                    <p className="text-xs text-gray-500 uppercase font-bold tracking-widest">Registering item to {txType === 'buy' ? 'Floor' : 'Vault'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 space-y-6">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Item Description (Primary Title)</label>
                      <input 
                        type="text" 
                        placeholder="e.g. iPhone 15 Pro 256GB - Blue Titanium" 
                        value={itemData.title}
                        onChange={e => setItemData({...itemData, title: e.target.value})}
                        className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl px-6 py-4 text-lg text-white focus:border-[#C85A32] outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Category</label>
                        <select 
                          value={itemData.category}
                          onChange={e => setItemData({...itemData, category: e.target.value as any})}
                          className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl px-4 py-3 text-white focus:border-[#C85A32] outline-none"
                        >
                          <option>Phones & Tech</option>
                          <option>Power Tools</option>
                          <option>Audio & Visual</option>
                          <option>Fine Jewelry & Gold</option>
                          <option>Gaming Consoles</option>
                          <option>Appliances</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Serial / IMEI</label>
                        <div className="relative">
                          <input 
                            type="text" 
                            value={itemData.serialOrImei}
                            onChange={e => setItemData({...itemData, serialOrImei: e.target.value})}
                            className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl pl-4 pr-10 py-3 text-white font-mono focus:border-[#C85A32] outline-none"
                          />
                          <button className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                            <Camera className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Condition</label>
                        <div className="flex flex-wrap gap-2">
                          {(['Mint', 'Excellent', 'Good', 'Fair'] as ItemCondition[]).map(c => (
                            <button
                              key={c}
                              onClick={() => setItemData({...itemData, condition: c})}
                              className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border transition ${
                                itemData.condition === c ? 'border-[#C85A32] bg-[#C85A32]/10 text-[#E87A5D]' : 'border-[#2A2A2A] text-gray-500'
                              }`}
                            >
                              {c}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Brand / Model (Optional)</label>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            placeholder="Brand" 
                            value={itemData.brand}
                            onChange={e => setItemData({...itemData, brand: e.target.value})}
                            className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl px-4 py-2 text-xs text-white outline-none" 
                          />
                          <input 
                            type="text" 
                            placeholder="Model" 
                            value={itemData.model}
                            onChange={e => setItemData({...itemData, model: e.target.value})}
                            className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl px-4 py-2 text-xs text-white outline-none" 
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Asset Documentation</label>
                    <div className="aspect-square rounded-3xl bg-[#1A1A1A] border-2 border-dashed border-[#2A2A2A] flex flex-col items-center justify-center gap-4 text-gray-500 group cursor-pointer overflow-hidden">
                      {itemData.imageUrl ? (
                        <img src={itemData.imageUrl} className="w-full h-full object-cover" />
                      ) : (
                        <>
                          <Camera className="w-10 h-10 group-hover:text-white transition" />
                          <span className="text-[9px] font-black uppercase tracking-widest">Capture Proof</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 pt-6">
                  <button onClick={handleBack} className="flex items-center gap-2 px-6 py-4 text-gray-500 hover:text-white transition">
                    <ChevronLeft className="w-4 h-4" />
                    <span className="text-xs font-black uppercase tracking-widest">Back</span>
                  </button>
                  <button 
                    onClick={handleNext}
                    className="flex-1 py-4 bg-[#C85A32] text-white rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl shadow-[#C85A32]/20"
                  >
                    <span>Valuation Review</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 3: VALUATION */}
            {step === 'valuation' && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-10"
              >
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-[#C85A32]/10 flex items-center justify-center text-[#E87A5D]">
                    <Scale className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white uppercase tracking-tight">Fair Market Valuation</h3>
                    <p className="text-xs text-gray-500 uppercase font-bold tracking-widest">Determining {txType === 'buy' ? 'Payout' : 'Principal'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                  <div className="space-y-8">
                    <div className="p-8 rounded-[2rem] bg-[#1A1A1A] border border-[#2A2A2A] space-y-6">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Suggested Payout</span>
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20">
                          <TrendingUp className="w-3 h-3 text-emerald-400" />
                          <span className="text-[9px] font-black text-emerald-400">Target Range</span>
                        </div>
                      </div>
                      <p className="text-5xl font-black text-white font-mono tracking-tighter">R {agreedOffer.toLocaleString()}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-500 border-t border-gray-800 pt-4">
                        <Info className="w-4 h-4" />
                        <span>Based on {itemData.condition} condition for {itemData.category}</span>
                      </div>
                    </div>

                    {txType === 'buy' && (
                      <div className="p-8 rounded-[2rem] bg-emerald-950/20 border border-emerald-500/20 space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Target Retail</span>
                          <span className="text-lg font-black text-white font-mono">R {suggestedRetail.toLocaleString()}</span>
                        </div>
                        <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500" style={{ width: '45%' }} />
                        </div>
                        <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Projected Margin: 55% after tax</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-8">
                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Negotiated Final Offer (ZAR)</label>
                      <div className="relative group">
                        <span className="absolute left-6 top-1/2 -translate-y-1/2 text-3xl font-black text-[#E87A5D]">R</span>
                        <input 
                          type="number" 
                          value={agreedOffer}
                          onChange={e => {
                            const val = Number(e.target.value);
                            setAgreedOffer(val);
                            if (txType === 'buy') {
                              setSuggestedRetail(roundRetailPrice(val * businessRules.defaultRetailMarkupMultiplier, businessRules.retailRoundingMode));
                            }
                          }}
                          className="w-full bg-[#1A1A1A] border-2 border-[#C85A32] rounded-[2rem] pl-14 pr-8 py-10 text-5xl font-black text-white font-mono outline-none shadow-2xl shadow-[#C85A32]/10"
                        />
                      </div>
                    </div>

                    <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-6">
                      <p className="text-xs text-gray-400 leading-relaxed italic">"Operator must visually confirm serial number and item state matches capture documentation before moving to final deal sign-off."</p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 pt-6">
                  <button onClick={handleBack} className="flex items-center gap-2 px-6 py-4 text-gray-500 hover:text-white transition">
                    <ChevronLeft className="w-4 h-4" />
                    <span className="text-xs font-black uppercase tracking-widest">Back</span>
                  </button>
                  <button 
                    onClick={handleNext}
                    className="flex-1 py-4 bg-[#C85A32] text-white rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl shadow-[#C85A32]/20"
                  >
                    <span>Final Deal Summary</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 4: DEAL */}
            {step === 'deal' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                className="space-y-10"
              >
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white uppercase tracking-tight">Final Confirmation</h3>
                    <p className="text-xs text-gray-500 uppercase font-bold tracking-widest">Verify all terms before committing to SAPS Register</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                  <div className="space-y-6">
                    <div className="p-8 rounded-[2.5rem] bg-[#1A1A1A] border border-[#2A2A2A] space-y-8">
                      <div className="space-y-4">
                        <div className="flex justify-between text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
                          <span>Transaction Model</span>
                          <span className="text-white">{txType === 'buy' ? 'DIRECT PURCHASE' : '30-DAY PAWN LOAN'}</span>
                        </div>
                        <div className="flex justify-between text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
                          <span>Verified Customer</span>
                          <span className="text-white">{selectedCustomer?.fullName}</span>
                        </div>
                        <div className="flex justify-between text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
                          <span>Collateral Asset</span>
                          <span className="text-white">{itemData.title}</span>
                        </div>
                      </div>

                      <div className="h-px bg-gray-800" />

                      <div className="space-y-4">
                        <div className="flex justify-between items-end">
                          <span className="text-sm font-bold text-gray-400">{txType === 'buy' ? 'Immediate Cash Payout' : 'Principal Payout'}</span>
                          <span className="text-2xl font-black text-white font-mono">R {agreedOffer.toLocaleString()}</span>
                        </div>
                        {txType === 'pawn' && pawnCalculations && (
                          <>
                            <div className="flex justify-between items-end">
                              <span className="text-xs text-gray-500">Monthly Interest (5%)</span>
                              <span className="text-sm font-bold text-gray-300 font-mono">R {pawnCalculations.interest.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-end">
                              <span className="text-xs text-gray-500">Admin & Storage Fee</span>
                              <span className="text-sm font-bold text-gray-300 font-mono">R {pawnCalculations.adminFee.toFixed(2)}</span>
                            </div>
                            <div className="pt-4 flex justify-between items-end border-t border-gray-800">
                              <span className="text-xs font-black text-blue-400 uppercase tracking-widest">Total Redemption Due</span>
                              <span className="text-xl font-black text-blue-400 font-mono">R {pawnCalculations.totalRedemption.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-end text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                              <span>Term Expiry</span>
                              <span>{pawnCalculations.expiryDate}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-8 flex flex-col justify-center">
                    <div className="p-8 rounded-[2rem] bg-[#1A1A1A] border border-[#2A2A2A] flex items-center gap-6">
                      <div className="w-16 h-16 rounded-2xl bg-gray-900 border border-gray-800 flex items-center justify-center shrink-0">
                        <FileText className="w-8 h-8 text-gray-600" />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-white uppercase tracking-widest">Compliance Ready</h4>
                        <p className="text-xs text-gray-500 mt-1 leading-relaxed">Proceeding will auto-log this transaction to the SAPS Form 21 register and generate a unique asset tracking tag.</p>
                      </div>
                    </div>

                    <button 
                      onClick={handleFinalize}
                      className={`w-full py-6 rounded-[2rem] text-white font-black uppercase tracking-[0.2em] text-sm shadow-2xl transition-all ${
                        txType === 'buy' 
                          ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20' 
                          : 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/20'
                      }`}
                    >
                      {txType === 'buy' ? 'COMPLETE PURCHASE' : 'FINALISE PAWN LOAN'}
                    </button>

                    <button onClick={handleBack} className="text-xs text-gray-500 hover:text-white uppercase font-black tracking-widest text-center">Modify Deal Terms</button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 5: COMPLETION */}
            {step === 'completion' && result && (
              <motion.div
                initial={{ opacity: 0, zoom: 0.9 }}
                animate={{ opacity: 1, zoom: 1 }}
                className="max-w-2xl mx-auto py-10 space-y-10"
              >
                <div className="text-center space-y-4">
                  <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mx-auto mb-6">
                    <CheckCircle2 className="w-12 h-12" />
                  </div>
                  <h3 className="text-3xl font-black text-white uppercase tracking-tight">Transaction Successful</h3>
                  <p className="text-gray-500 uppercase font-bold tracking-widest text-sm">Asset {result.assetTag} Logged & Verified</p>
                </div>

                <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-[2.5rem] p-8 space-y-8">
                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Asset Tracking Tag</p>
                      <p className="text-xl font-black text-white font-mono">{result.assetTag}</p>
                    </div>
                    {result.ticketNumber && (
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Pawn Ticket</p>
                        <p className="text-xl font-black text-blue-400 font-mono">{result.ticketNumber}</p>
                      </div>
                    )}
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Payout Amount</p>
                      <p className="text-xl font-black text-emerald-400 font-mono">R {agreedOffer.toLocaleString()}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Storage Loc</p>
                      <p className="text-xl font-black text-white uppercase">{txType === 'buy' ? 'RETAIL FLOOR' : businessRules.defaultVaultShelf}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                    <button className="p-5 rounded-2xl bg-white text-black font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-3 hover:bg-gray-200 transition">
                      <Printer className="w-4 h-4" />
                      Print Asset Label
                    </button>
                    {txType === 'pawn' && (
                      <button 
                        onClick={() => setActiveContractModal(result.loan!)}
                        className="p-5 rounded-2xl bg-[#1A1A1A] border border-[#2A2A2A] text-white font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-3 hover:bg-[#222] transition"
                      >
                        <FileText className="w-4 h-4" />
                        Print Pawn Contract
                      </button>
                    )}
                    <button className="p-5 rounded-2xl bg-[#1A1A1A] border border-[#2A2A2A] text-white font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-3 hover:bg-[#222] transition sm:col-span-2">
                      <Smartphone className="w-4 h-4" />
                      Send Digital Receipt (WhatsApp)
                    </button>
                  </div>
                </div>

                <div className="flex justify-center">
                  <button 
                    onClick={resetWorkflow}
                    className="flex items-center gap-3 px-8 py-4 bg-[#C85A32] text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-2xl shadow-[#C85A32]/20 hover:bg-[#b04d29] transition"
                  >
                    <Plus className="w-5 h-5" />
                    New Counter Session
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
