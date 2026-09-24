import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useInventory } from '../../context/InventoryContext';
import { useLoans } from '../../context/LoanContext';
import { useCustomers } from '../../context/CustomerContext';
import { useSellers } from '../../context/SellerContext';
import { useSaps } from '../../context/SapsContext';
import { ItemCondition, InventoryItem, PawnLoan, Customer, Seller, ItemStatus } from '../../types';
import { roundRetailPrice, calculatePawnFees } from '../../utils/pricingRules';
import { generateUniqueSku, generateUniqueTransactionNumber, generateUniquePawnTicket } from '../../utils/identifierGenerator';
import { marketIntelligenceApi } from '../../services/marketIntelligenceApi';
import { parseAndValidateRsaId } from '../../utils/rsaIdValidator';
import { validateAndNormalizeSaPhone } from '../../utils/phoneValidator';
import { getProductSuggestion } from '../../utils/suggestionEngine';
import { focusAndScrollErrorField, formatUserFriendlyError } from '../../utils/errorNavigator';
import { db } from '../../db';
import { isSupabaseConfigured } from '../../services/supabase';
import { sellerTransactionsApi, pawnLoansApi } from '../../services/supabaseApi';
import { MarketCheckCard } from '../common/MarketCheckCard';
import { MarketCheckResult } from '../../types/marketIntelligence';
import { motion, AnimatePresence } from 'motion/react';
import { draftService } from '../../services/draftService';
import { DraftRecoveryModal } from '../modals/DraftRecoveryModal';
import { WorkflowDraft } from '../../types';
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
  TrendingUp,
  History,
  Package,
  MapPin,
  Tag,
  AlertTriangle,
  Clock,
  UserCheck
} from 'lucide-react';

export type WorkflowStep = 'mode' | 'customer' | 'item' | 'valuation' | 'location' | 'deal' | 'completion';
export type TxType = 'existing' | 'buy' | 'pawn' | null;

const SellerHistoryDisplay: React.FC<{ sellerId: string }> = ({ sellerId }) => {
  const { getSellerTransactions } = useSellers();
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    getSellerTransactions(sellerId).then(setHistory);
  }, [sellerId, getSellerTransactions]);

  if (history.length === 0) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs">
      <div className="flex items-center gap-2 mb-4">
        <History className="w-4 h-4 text-[#C85A32]" />
        <h5 className="text-xs font-semibold text-gray-800">Previous Seller Transactions</h5>
      </div>
      <div className="space-y-3 divide-y divide-gray-100">
        {history.map(tx => (
          <div key={tx.id} className="flex items-center justify-between pt-2.5 first:pt-0">
            <div>
              <p className="text-xs font-medium text-gray-800">{tx.itemTitle}</p>
              <p className="text-[11px] text-gray-400 font-mono">{new Date(tx.timestamp).toLocaleDateString()}</p>
            </div>
            <span className="text-xs font-bold text-gray-900 font-mono">R {tx.amountPaid.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const BuyPawn: React.FC = () => {
  const { showToast, businessRules, shopProfile, setActiveContractModal, capturedRsaIdScan } = useApp();
  const { user } = useAuth();
  const { addItem, inventory } = useInventory();
  const { createLoan, loans: pawnLoans } = useLoans();
  const { customers, addCustomer, updateCustomer } = useCustomers();
  const { sellers, addSeller, updateSeller, addSellerTransaction } = useSellers();
  const { addSapsEntry } = useSaps();

  // Basket for multi-item seller batches
  const [basketItems, setBasketItems] = useState<any[]>([]);
  const [step, setStep] = useState<WorkflowStep>('mode');
  const [txType, setTxType] = useState<TxType>(null);

  // Identity State (Buy / Pawn only)
  const [identitySearch, setIdentitySearch] = useState('');
  const [selectedIdentity, setSelectedIdentity] = useState<Customer | Seller | null>(null);
  const [isCreatingIdentity, setIsCreatingIdentity] = useState(false);
  const [newIdentity, setNewIdentity] = useState({
    fullName: '',
    idNumber: '',
    mobile: '',
    address: '',
    idType: 'RSA Smart ID' as 'RSA Smart ID' | 'Green ID Book' | 'Passport'
  });

  // Item Details State (Common to all flows)
  const [itemData, setItemData] = useState({
    title: '',
    category: 'Phones & Tech' as InventoryItem['category'],
    brand: '',
    model: '',
    serialOrImei: '',
    condition: 'Good' as ItemCondition,
    imageUrl: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&q=80&w=300&h=300',
    stockLocation: 'Main Floor Display',
    internalNote: '',
    sourceNote: 'Item was already owned by the shop before LocalMarket onboarding'
  });

  // Valuation & Pricing State
  const [agreedOffer, setAgreedOffer] = useState<number>(0); // Payout / Principal
  const [costBasisInput, setCostBasisInput] = useState<string>('0');
  const [retailPriceInput, setRetailPriceInput] = useState<string>('0');
  const [suggestedRetail, setSuggestedRetail] = useState<number>(0);
  const [existingStockStatus, setExistingStockStatus] = useState<ItemStatus>('Retail Floor');

  // Synchronize captured RSA ID scan with customer selection/creation
  useEffect(() => {
    if (!capturedRsaIdScan || step !== 'customer') return;

    const scannedIdClean = capturedRsaIdScan.idNumber.replace(/\s+/g, '');

    if (txType === 'buy') {
      const match = sellers.find(s => s.idNumber.replace(/\s+/g, '') === scannedIdClean);
      if (match) {
        setSelectedIdentity(match);
        setIsCreatingIdentity(false);
        showToast('Previous Seller Found', `Matched existing seller by ID #${scannedIdClean}: ${match.fullName}`, 'info');
        return;
      }
    } else if (txType === 'pawn') {
      const match = customers.find(c => c.idNumber.replace(/\s+/g, '') === scannedIdClean);
      if (match) {
        setSelectedIdentity(match);
        setIsCreatingIdentity(false);
        showToast('Previous Customer Found', `Matched existing customer by ID #${scannedIdClean}: ${match.fullName}`, 'info');
        return;
      }
    }

    // If no existing record matched, pre-fill captured ID number and open identity creation (NO fabricated name)
    setIsCreatingIdentity(true);
    setNewIdentity(prev => ({
      ...prev,
      idNumber: capturedRsaIdScan.idNumber,
      idType: 'RSA Smart ID',
      fullName: '', // NEVER FABRICATE A NAME
    }));
    showToast('ID Decoded', `ID #${capturedRsaIdScan.idNumber} decoded — identity still needs verification.`, 'info');
  }, [capturedRsaIdScan, step, txType, customers, sellers, showToast]);

  // --- DRAFT CONTINUITY ---
  const [activeDrafts, setActiveDrafts] = useState<WorkflowDraft[]>([]);
  const [draftId, setDraftId] = useState<string>(() => crypto.randomUUID());

  useEffect(() => {
    if (user) {
      draftService.getActiveDrafts(user.id).then(drafts => {
        const relevant = drafts.filter(d => d.workflowType === 'buy' || d.workflowType === 'pawn');
        setActiveDrafts(relevant);
      });
    }
  }, [user]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (step !== 'completion' && txType && user) {
        draftService.saveDraft({
          id: draftId,
          userId: user.id,
          workflowType: txType,
          step: step,
          payload: { itemData, newIdentity, selectedIdentity, txType }
        });
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [step, txType, itemData, newIdentity, selectedIdentity, draftId, user]);

  const handleContinueDraft = (draft: WorkflowDraft) => {
    setDraftId(draft.id);
    setTxType(draft.workflowType);
    setStep(draft.step as WorkflowStep);
    setItemData(draft.payload.itemData);
    setNewIdentity(draft.payload.newIdentity);
    setSelectedIdentity(draft.payload.selectedIdentity);
    setActiveDrafts([]);
    showToast('Draft Restored', 'Your previous work has been restored.', 'info');
  };

  const handleDiscardDraft = (id: string) => {
    draftService.discardDraft(id);
    setActiveDrafts(activeDrafts.filter(d => d.id !== id));
  };
  // ------------------------

  // Item Details State (Common to all flows)


  // Market Intelligence State
  const [marketCheckData, setMarketCheckData] = useState<MarketCheckResult | null>(null);
  const [isMarketLoading, setIsMarketLoading] = useState<boolean>(false);
  const [marketError, setMarketError] = useState<string | null>(null);

  const handleRunMarketCheck = async () => {
    if (!itemData.title) return;
    setIsMarketLoading(true);
    setMarketError(null);
    const res = await marketIntelligenceApi.fetchMarketCheck({
      barcode: itemData.serialOrImei,
      title: itemData.title,
      category: itemData.category,
      condition: itemData.condition
    });
    setIsMarketLoading(false);
    if (res.success && res.data) {
      setMarketCheckData(res.data);
    } else {
      setMarketError(res.error || 'Insufficient market data');
    }
  };

  // Completion Result State
  const [result, setResult] = useState<{
    assetTag: string;
    ticketNumber?: string;
    item: InventoryItem;
    loan?: PawnLoan;
  } | null>(null);

  // Derived Values for Pawn
  const pawnCalculations = useMemo(() => {
    if (txType !== 'pawn') return null;
    const { interest, storage, total } = calculatePawnFees(agreedOffer, businessRules);
    
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + businessRules.defaultLoanTermDays);

    return {
      interest,
      adminFee: storage,
      totalRedemption: total,
      expiryDate: expiry.toISOString().split('T')[0]
    };
  }, [txType, agreedOffer, businessRules]);

  // Serial Number / IMEI duplicate check across store inventory
  const duplicateSerialMatch = useMemo(() => {
    const sn = itemData.serialOrImei.trim();
    if (!sn || sn.toUpperCase() === 'N/A' || sn.length < 4) return null;
    return inventory.find(i => i.serialOrImei && i.serialOrImei.toLowerCase() === sn.toLowerCase());
  }, [itemData.serialOrImei, inventory]);

  // Dynamic Stepper Configuration
  const workflowSteps = useMemo(() => {
    if (txType === 'existing') {
      return [
        { id: 'mode', label: 'Intake Type' },
        { id: 'item', label: 'Item Details' },
        { id: 'valuation', label: 'Retail Price' },
        { id: 'location', label: 'Stock Location' }
      ];
    }
    if (txType === 'buy') {
      return [
        { id: 'mode', label: 'Intake Type' },
        { id: 'customer', label: 'Seller Info' },
        { id: 'item', label: 'Item Details' },
        { id: 'valuation', label: 'Valuation' },
        { id: 'deal', label: 'Deal Review' }
      ];
    }
    if (txType === 'pawn') {
      return [
        { id: 'mode', label: 'Intake Type' },
        { id: 'customer', label: 'Customer Info' },
        { id: 'item', label: 'Item Details' },
        { id: 'valuation', label: 'Loan Terms' },
        { id: 'deal', label: 'Pledge Terms' }
      ];
    }
    return [
      { id: 'mode', label: 'Intake Type' },
      { id: 'item', label: 'Details' },
      { id: 'valuation', label: 'Pricing' }
    ];
  }, [txType]);

  const currentStepIndex = useMemo(() => {
    const idx = workflowSteps.findIndex(s => s.id === step);
    return idx >= 0 ? idx : 0;
  }, [workflowSteps, step]);

  // Handlers
  const handleSelectTxType = (type: 'existing' | 'buy' | 'pawn') => {
    setTxType(type);
    setSelectedIdentity(null);
    setIsCreatingIdentity(false);

    if (type === 'existing') {
      // Existing stock skips identity verification completely
      setStep('item');
    } else {
      setStep('customer');
    }
  };

  const handleNext = () => {
    if (step === 'mode') {
      // should select via card
      return;
    }

    if (step === 'customer') {
      if (!selectedIdentity) {
        showToast(
          `${txType === 'buy' ? 'Seller' : 'Customer'} Required`,
          `Please select or create a ${txType === 'buy' ? 'seller' : 'customer'} record before proceeding`,
          'amber'
        );
        return;
      }
      setStep('item');
      return;
    }

    if (step === 'item') {
      if (!itemData.title.trim()) {
        showToast('Title Required', 'Please enter an item description or title', 'amber');
        return;
      }

      if (duplicateSerialMatch) {
        const activeStatuses = ['Retail Floor', 'Vault Hold', 'InStock', 'Reserved', 'Pawned'];
        if (activeStatuses.includes(duplicateSerialMatch.status)) {
          showToast('Duplicate Serial', 'This serial/IMEI already belongs to active inventory.', 'error');
          return;
        }
        if (duplicateSerialMatch.status === 'Flagged') {
          showToast('Compliance Flag', 'This serial/IMEI is flagged under compliance review.', 'error');
          return;
        }
      }

      if (txType === 'existing') {
        // Suggested retail placeholder if not set
        if (Number(retailPriceInput) === 0) {
          const defaultPrice = itemData.category === 'Fine Jewelry & Gold' ? 3500 : 1500;
          setRetailPriceInput(String(defaultPrice));
          setCostBasisInput(String(Math.round(defaultPrice * 0.5)));
        }
        setStep('valuation');
      } else {
        // Buy or Pawn valuation suggestion
        const base = itemData.category === 'Fine Jewelry & Gold' ? 2000 : 1000;
        setAgreedOffer(base);
        setSuggestedRetail(roundRetailPrice(base * businessRules.defaultRetailMarkupMultiplier, businessRules.retailRoundingMode));
        setStep('valuation');
      }
      return;
    }

    if (step === 'valuation') {
      if (txType === 'existing') {
        const retailVal = parseFloat(retailPriceInput);
        if (isNaN(retailVal) || retailVal <= 0) {
          showToast('Invalid Price', 'Please enter a valid retail selling price', 'amber');
          return;
        }
        setStep('location');
      } else {
        if (agreedOffer <= 0) {
          showToast('Invalid Offer', 'Please specify a negotiated offer amount', 'amber');
          return;
        }
        setStep('deal');
      }
      return;
    }

    if (step === 'location') {
      // Finalize Existing Stock
      handleFinalizeExistingStock();
      return;
    }
  };

  const handleBack = () => {
    if (step === 'customer') {
      setStep('mode');
      setTxType(null);
    } else if (step === 'item') {
      if (txType === 'existing') {
        setStep('mode');
        setTxType(null);
      } else {
        setStep('customer');
      }
    } else if (step === 'valuation') {
      setStep('item');
    } else if (step === 'location') {
      setStep('valuation');
    } else if (step === 'deal') {
      setStep('valuation');
    }
  };

  const selectIdentity = (identity: Customer | Seller) => {
    setSelectedIdentity(identity);
    setIsCreatingIdentity(false);
    showToast(
      `Previous ${txType === 'buy' ? 'Seller' : 'Customer'} Found`,
      `Matched record: ${identity.fullName} (${identity.verified ? 'Verified' : 'Verification pending'})`,
      'info'
    );
  };

  const handleCreateIdentity = async () => {
    if (!newIdentity.fullName.trim() || !newIdentity.idNumber.trim()) {
      showToast('Validation Error', 'Full name and ID number are required', 'error');
      const idEl = document.getElementById('new-identity-id-input');
      if (idEl) focusAndScrollErrorField(idEl);
      return;
    }

    if (newIdentity.idType === 'RSA Smart ID' || newIdentity.idType === 'Green ID Book') {
      const idCheck = parseAndValidateRsaId(newIdentity.idNumber);
      if (!idCheck.isValid) {
        showToast('ID Validation Failed', idCheck.error || 'Please check the ID number.', 'error');
        const idEl = document.getElementById('new-identity-id-input');
        if (idEl) focusAndScrollErrorField(idEl);
        return;
      }
    }

    let finalMobile = newIdentity.mobile.trim();
    if (finalMobile) {
      const phoneCheck = validateAndNormalizeSaPhone(finalMobile);
      if (!phoneCheck.isValid) {
        showToast('Phone Validation Failed', phoneCheck.error || 'Please check the mobile phone number.', 'error');
        const phoneEl = document.getElementById('new-identity-mobile-input');
        if (phoneEl) focusAndScrollErrorField(phoneEl);
        return;
      }
      if (phoneCheck.normalizedNumber) {
        finalMobile = phoneCheck.displayNumber || phoneCheck.normalizedNumber;
      }
    }

    try {
      if (txType === 'buy') {
        const id = await addSeller({
          fullName: newIdentity.fullName.trim(),
          idNumber: newIdentity.idNumber.trim(),
          idType: newIdentity.idType,
          mobile: finalMobile,
          address: newIdentity.address.trim(),
          verified: false
        });
        const created: Seller = {
          id,
          fullName: newIdentity.fullName.trim(),
          idNumber: newIdentity.idNumber.trim(),
          idType: newIdentity.idType,
          mobile: finalMobile,
          address: newIdentity.address.trim(),
          createdAt: new Date().toISOString(),
          verified: false
        };
        setSelectedIdentity(created);
      } else {
        // Pawn customer: honest values without fake DOB or fake gender
        const id = await addCustomer({
          fullName: newIdentity.fullName.trim(),
          idNumber: newIdentity.idNumber.trim(),
          idType: newIdentity.idType,
          mobile: finalMobile,
          address: newIdentity.address.trim(),
          verified: false
        });
        const created: Customer = {
          id,
          fullName: newIdentity.fullName.trim(),
          idNumber: newIdentity.idNumber.trim(),
          idType: newIdentity.idType,
          mobile: finalMobile,
          address: newIdentity.address.trim(),
          createdAt: new Date().toISOString(),
          verified: false
        };
        setSelectedIdentity(created);
      }

      setIsCreatingIdentity(false);
      showToast(`${txType === 'buy' ? 'Seller' : 'Customer'} Saved`, `${newIdentity.fullName} (Verification pending)`, 'info');
    } catch (err: any) {
      showToast('Save Failed', formatUserFriendlyError(err?.message || 'Failed to save record.'), 'error');
    }
  };

  const handleExplicitVerifyIdentity = async () => {
    if (!selectedIdentity) return;
    if (txType === 'buy') {
      await updateSeller(selectedIdentity.id, { verified: true });
      setSelectedIdentity(prev => prev ? ({ ...prev, verified: true }) : null);
      showToast('Identity Verified', `Seller ${selectedIdentity.fullName} verified against physical ID document.`, 'success');
    } else {
      await updateCustomer(selectedIdentity.id, { verified: true });
      setSelectedIdentity(prev => prev ? ({ ...prev, verified: true }) : null);
      showToast('Identity Verified', `Customer ${selectedIdentity.fullName} verified against physical ID document.`, 'success');
    }
  };

  // 1. FINALISE EXISTING STOCK (No Seller, No Customer, No SAPS Form 21, No Pawn Loan)
  const handleFinalizeExistingStock = async () => {
    const sku = generateUniqueSku(s => inventory.some(i => i.sku === s));
    const costBasisNum = parseFloat(costBasisInput) || 0;
    const retailPriceNum = parseFloat(retailPriceInput) || 0;

    const newItemPayload: Omit<InventoryItem, 'id' | 'addedAt'> = {
      sku,
      title: itemData.title.trim(),
      category: itemData.category,
      brand: itemData.brand.trim() || undefined,
      model: itemData.model.trim() || undefined,
      serialOrImei: itemData.serialOrImei.trim() || 'N/A',
      condition: itemData.condition,
      acquisitionType: 'Existing Stock',
      costBasis: costBasisNum,
      retailPrice: retailPriceNum,
      status: existingStockStatus,
      stockLocation: itemData.stockLocation.trim() || 'Main Floor Display',
      imageUrl: itemData.imageUrl,
      specs: [itemData.brand, itemData.model].filter(Boolean).join(' • ') || undefined,
      sourceType: 'existing_stock',
      sourceStatus: 'unknown',
      sourceNote: itemData.sourceNote || 'Item was already owned by the shop before LocalMarket onboarding',
      internalNote: itemData.internalNote.trim() || undefined
    };

    const itemId = await addItem(newItemPayload);

    const createdItem: InventoryItem = {
      id: itemId,
      addedAt: new Date().toISOString(),
      ...newItemPayload
    };

    setResult({
      assetTag: sku,
      item: createdItem
    });

    setStep('completion');
    showToast('Stock Added', `${createdItem.title} added to ${existingStockStatus}`, 'success');
  };

  // 2. FINALISE BUY FROM PERSON OR PAWN (Real Identities, Compliance & Transactions)
  const handleAddToBatch = () => {
    if (!itemData.title.trim()) {
      showToast('Title Required', 'Please enter an item title', 'amber');
      return;
    }

    const newItem = {
      ...itemData,
      id: crypto.randomUUID(),
      agreedOffer,
      suggestedRetail
    };

    setBasketItems([...basketItems, newItem]);
    
    // Reset item data for next entry
    setItemData({
      title: '',
      category: 'Phones & Tech',
      brand: '',
      model: '',
      serialOrImei: '',
      condition: 'Good',
      imageUrl: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&q=80&w=300&h=300',
      stockLocation: 'Main Floor Display',
      internalNote: '',
      sourceNote: 'Item was already owned by the shop before LocalMarket onboarding'
    });
    setAgreedOffer(0);
    setRetailPriceInput('0');
    
    showToast('Item Added to Batch', 'You can now add another item or finalize the transaction.', 'success');
    setStep('item'); // Go back to item step for next item
  };

  const handleFinalize = async () => {
    if (!selectedIdentity || !txType) return;

    // If there's a current item not in basket, add it first or validate it
    let finalBasket = [...basketItems];
    if (itemData.title.trim()) {
      finalBasket.push({
        ...itemData,
        id: crypto.randomUUID(),
        agreedOffer,
        suggestedRetail
      });
    }

    if (finalBasket.length === 0) {
      showToast('No Items', 'Please add at least one item to the transaction', 'amber');
      return;
    }

    const transactionId = crypto.randomUUID();
    const existingTxList = await db.sellerTransactions.toArray();
    const existingTxSet = new Set(existingTxList.map(t => t.transactionNumber));
    const transactionNumber = generateUniqueTransactionNumber(tn => existingTxSet.has(tn));
    const totalPayout = finalBasket.reduce((sum, i) => sum + i.agreedOffer, 0);
    const nowIso = new Date().toISOString();

    if (txType === 'buy') {
      const seller = selectedIdentity as Seller;
      const complianceStatus = seller.verified ? 'VERIFIED' : 'PENDING';
      const inventoryItemsToAdd: InventoryItem[] = [];
      const transactionItemsToAdd: any[] = [];
      const sapsEntriesToAdd: any[] = [];
      const rpcItemsPayload: any[] = [];

      const currentInventory = await db.inventory.toArray();
      const existingSkuSet = new Set(currentInventory.map(i => i.sku));

      for (const bItem of finalBasket) {
        const itemId = bItem.id || crypto.randomUUID();
        const sku = generateUniqueSku(s => existingSkuSet.has(s));
        existingSkuSet.add(sku);

        const sapsId = crypto.randomUUID();
        const sapsEntryNo = `SAPS-${new Date().getFullYear()}-${sapsId.slice(0, 8).toUpperCase()}`;

        const invItem: InventoryItem = {
          id: itemId,
          sku,
          title: bItem.title,
          category: bItem.category,
          brand: bItem.brand?.trim() || undefined,
          model: bItem.model?.trim() || undefined,
          serialOrImei: bItem.serialOrImei?.trim() || 'N/A',
          condition: bItem.condition,
          acquisitionType: 'Buy',
          costBasis: bItem.agreedOffer,
          retailPrice: bItem.suggestedRetail,
          status: 'Retail Floor',
          stockLocation: 'Retail Floor',
          imageUrl: bItem.imageUrl,
          specs: [bItem.brand, bItem.model].filter(Boolean).join(' • ') || undefined,
          sourceType: 'seller',
          sourceStatus: seller.verified ? 'verified' : 'pending',
          sourceNote: `Purchased from ${seller.fullName} (${seller.idNumber})`,
          internalNote: bItem.internalNote?.trim() || undefined,
          addedAt: nowIso
        };
        inventoryItemsToAdd.push(invItem);

        transactionItemsToAdd.push({
          id: crypto.randomUUID(),
          sellerTransactionId: transactionId,
          shopId: shopProfile.id,
          itemId,
          itemSku: sku,
          itemTitle: bItem.title,
          amountPaid: bItem.agreedOffer,
          retailPrice: bItem.suggestedRetail,
          serialOrImei: bItem.serialOrImei?.trim() || 'N/A',
          condition: bItem.condition,
          createdAt: nowIso
        });

        sapsEntriesToAdd.push({
          id: sapsId,
          entryNumber: sapsEntryNo,
          timestamp: nowIso,
          customerId: seller.id,
          customerName: seller.fullName,
          customerIdNumber: seller.idNumber,
          customerAddress: seller.address,
          customerPhone: seller.mobile,
          itemDescription: bItem.title,
          category: bItem.category,
          serialOrImei: bItem.serialOrImei?.trim() || 'N/A',
          condition: bItem.condition,
          acquisitionType: 'Buy',
          considerationPaid: bItem.agreedOffer,
          officerName: user?.user_metadata?.full_name || user?.email || 'System Operator',
          policeStationRef: shopProfile.saps_dealer_license || 'SAPS License',
          verificationStatus: complianceStatus,
          barcodeRef: sku
        });

        rpcItemsPayload.push({
          id: itemId,
          sku,
          title: bItem.title,
          category: bItem.category,
          brand: bItem.brand?.trim() || null,
          model: bItem.model?.trim() || null,
          serial_or_imei: bItem.serialOrImei?.trim() || 'N/A',
          condition: bItem.condition,
          amount_paid: bItem.agreedOffer,
          retail_price: bItem.suggestedRetail,
          image_url: bItem.imageUrl,
          specs: [bItem.brand, bItem.model].filter(Boolean).join(' • ') || null,
          stock_location: 'Retail Floor',
          internal_note: bItem.internalNote?.trim() || null,
          saps_entry_id: sapsId,
          saps_entry_number: sapsEntryNo
        });
      }

      const txRecord = {
        id: transactionId,
        shopId: shopProfile.id || 'default-shop',
        sellerId: seller.id,
        transactionNumber,
        totalProposedPayout: totalPayout,
        totalApprovedPayout: totalPayout,
        paymentStatus: 'Paid' as const,
        status: 'Acquired' as const,
        complianceStatus: complianceStatus as any,
        timestamp: nowIso,
        items: transactionItemsToAdd,
        sapsRef: transactionNumber
      };

      const buyPayload = {
        transactionId,
        transactionNumber,
        sellerId: seller.id,
        items: rpcItemsPayload,
        totalAmount: totalPayout,
        paymentMethod: 'cash',
        paymentStatus: 'Paid',
        transactionStatus: 'Acquired',
        complianceStatus,
        sapsRef: transactionNumber,
        officerName: user?.user_metadata?.full_name || user?.email || 'System Operator',
        policeStationRef: shopProfile.saps_dealer_license || '',
        shopId: shopProfile.id
      };

      let syncLogStatus: 'completed' | 'pending' = 'pending';
      let syncedAt: string | undefined = undefined;

      // 1. ATOMIC SERVER RPC FIRST IF ONLINE
      if (isSupabaseConfigured() && navigator.onLine) {
        try {
          const rpcRes = await sellerTransactionsApi.completeBuyAcquisitionRpc(buyPayload);
          if (rpcRes.success) {
            syncLogStatus = 'completed';
            syncedAt = new Date().toISOString();
          } else {
            const isNetworkError = (msg?: string) => {
              if (!msg) return false;
              const lower = msg.toLowerCase();
              return lower.includes('failed to fetch') || lower.includes('network') || lower.includes('timeout') || lower.includes('aborted');
            };

            if (!isNetworkError(rpcRes.error)) {
              // Explicit server rejection - ABORT IMMEDIATELY, do not write fake local data
              showToast('Acquisition Rejected', rpcRes.error || 'Server rejected acquisition.', 'error');
              return;
            }
            console.warn('Network timeout during buy acquisition, saving locally for offline sync:', rpcRes.error);
          }
        } catch (err: any) {
          console.warn('Network error during online buy acquisition, saving locally for offline sync:', err?.message);
        }
      }

      // 2. ATOMIC LOCAL DEXIE COMMIT (Reflecting server success or durable offline outbox)
      await db.transaction('rw', [db.inventory, db.sellerTransactions, db.sellerTransactionItems, db.saps, db.syncLogs], async () => {
        await db.inventory.bulkAdd(inventoryItemsToAdd);
        await db.sellerTransactionItems.bulkAdd(transactionItemsToAdd);
        await db.sellerTransactions.add(txRecord);
        await db.saps.bulkAdd(sapsEntriesToAdd);

        await db.syncLogs.add({
          entityType: 'buyAcquisition',
          entityId: transactionId,
          action: 'create',
          payload: buyPayload,
          status: syncLogStatus,
          syncedAt,
          createdAt: nowIso,
          retryCount: 0
        });
      });

      setResult({
        assetTag: transactionNumber,
        item: { title: `${finalBasket.length} Items`, sku: transactionNumber } as any
      });

      await draftService.closeDraft(draftId);
      setStep('completion');
      if (syncLogStatus === 'completed') {
        showToast('Batch Purchase Complete', `${finalBasket.length} items acquired atomically and logged to SAPS`, 'success');
      } else {
        showToast('Saved Offline', `${finalBasket.length} items saved locally and queued for sync`, 'amber');
      }
      return;
    }

    if (txType === 'pawn' && pawnCalculations) {
      const pCustomer = selectedIdentity as Customer;
      const allLoans = await db.loans.toArray();
      const ticketNumber = generateUniquePawnTicket(t => allLoans.some(l => l.ticketNumber === t));
      const currentInventory = await db.inventory.toArray();
      const sku = generateUniqueSku(s => currentInventory.some(i => i.sku === s));

      const loanId = crypto.randomUUID();
      const itemId = crypto.randomUUID();
      const sapsId = crypto.randomUUID();
      const sapsEntryNo = `SAPS-${new Date().getFullYear()}-${sapsId.slice(0, 8).toUpperCase()}`;
      const qrToken = `TKN-${loanId.slice(0, 8).toUpperCase()}`;
      const verificationStatus = pCustomer.verified ? 'VERIFIED' : 'PENDING';

      const invItem: InventoryItem = {
        id: itemId,
        sku,
        title: itemData.title,
        category: itemData.category,
        brand: itemData.brand?.trim() || undefined,
        model: itemData.model?.trim() || undefined,
        serialOrImei: itemData.serialOrImei?.trim() || 'N/A',
        condition: itemData.condition,
        acquisitionType: 'Pawn',
        costBasis: agreedOffer,
        retailPrice: Math.round(agreedOffer * 1.85),
        status: 'Vault Hold',
        vaultLocation: businessRules.defaultVaultShelf,
        stockLocation: businessRules.defaultVaultShelf,
        pawnTicketId: ticketNumber,
        imageUrl: itemData.imageUrl,
        specs: [itemData.brand, itemData.model].filter(Boolean).join(' • ') || undefined,
        sourceType: 'pawn',
        sourceStatus: pCustomer.verified ? 'verified' : 'pending',
        sourceNote: `Pawned by ${pCustomer.fullName} under Ticket ${ticketNumber}`,
        internalNote: itemData.internalNote?.trim() || undefined,
        addedAt: nowIso
      };

      const loanRecord: PawnLoan = {
        id: loanId,
        ticketNumber,
        customerId: pCustomer.id,
        customerName: pCustomer.fullName,
        customerIdNumber: pCustomer.idNumber,
        customerMobile: pCustomer.mobile,
        customerAddress: pCustomer.address,
        itemId: itemId,
        itemTitle: itemData.title,
        itemCategory: itemData.category,
        serialOrImei: itemData.serialOrImei?.trim() || 'N/A',
        condition: itemData.condition,
        itemImageUrl: itemData.imageUrl,
        principal: agreedOffer,
        ncrMonthlyRate: businessRules.pawnMonthlyInterestRate,
        monthlyInterest: pawnCalculations.interest,
        monthlyStorageAdminFee: pawnCalculations.adminFee,
        totalRedemptionAmount: pawnCalculations.totalRedemption,
        extensionFee: pawnCalculations.adminFee + pawnCalculations.interest,
        startDate: nowIso.split('T')[0],
        expiryDate: pawnCalculations.expiryDate,
        daysRemaining: businessRules.defaultLoanTermDays,
        daysElapsed: 0,
        vaultShelf: businessRules.defaultVaultShelf,
        status: 'Active',
        qrToken,
        history: [{
          date: nowIso,
          action: 'Created',
          amount: agreedOffer,
          note: 'Pawn loan initiated'
        }]
      };

      const sapsRecord = {
        id: sapsId,
        entryNumber: sapsEntryNo,
        timestamp: nowIso,
        customerId: pCustomer.id,
        customerName: pCustomer.fullName,
        customerIdNumber: pCustomer.idNumber,
        customerAddress: pCustomer.address,
        customerPhone: pCustomer.mobile,
        itemDescription: itemData.title,
        category: itemData.category,
        serialOrImei: itemData.serialOrImei?.trim() || 'N/A',
        condition: itemData.condition,
        acquisitionType: 'Pawn' as const,
        considerationPaid: agreedOffer,
        officerName: user?.user_metadata?.full_name || user?.email || 'System Operator',
        policeStationRef: shopProfile.saps_dealer_license || 'SAPS License',
        verificationStatus: verificationStatus as any,
        barcodeRef: sku
      };

      const pawnPayload = {
        loanId,
        ticketNumber,
        customerId: pCustomer.id,
        itemId,
        itemSku: sku,
        itemTitle: itemData.title,
        itemCategory: itemData.category,
        itemBrand: itemData.brand?.trim() || undefined,
        itemModel: itemData.model?.trim() || undefined,
        serialOrImei: itemData.serialOrImei?.trim() || 'N/A',
        condition: itemData.condition,
        itemImageUrl: itemData.imageUrl,
        specs: [itemData.brand, itemData.model].filter(Boolean).join(' • ') || undefined,
        stockLocation: businessRules.defaultVaultShelf,
        internalNote: itemData.internalNote?.trim() || undefined,
        principal: agreedOffer,
        ncrMonthlyRate: businessRules.pawnMonthlyInterestRate,
        monthlyInterest: pawnCalculations.interest,
        monthlyStorageAdminFee: pawnCalculations.adminFee,
        totalRedemptionAmount: pawnCalculations.totalRedemption,
        extensionFee: pawnCalculations.adminFee + pawnCalculations.interest,
        startDate: nowIso.split('T')[0],
        expiryDate: pawnCalculations.expiryDate,
        daysRemaining: businessRules.defaultLoanTermDays,
        vaultShelf: businessRules.defaultVaultShelf,
        qrToken,
        officerName: user?.user_metadata?.full_name || user?.email || 'System Operator',
        policeStationRef: shopProfile.saps_dealer_license || '',
        sapsEntryId: sapsId,
        sapsEntryNumber: sapsEntryNo,
        history: loanRecord.history,
        shopId: shopProfile.id
      };

      let syncLogStatus: 'completed' | 'pending' = 'pending';
      let syncedAt: string | undefined = undefined;

      // 1. ATOMIC SERVER RPC FIRST IF ONLINE
      if (isSupabaseConfigured() && navigator.onLine) {
        try {
          const rpcRes = await pawnLoansApi.completePawnIntakeRpc(pawnPayload);
          if (rpcRes.success) {
            syncLogStatus = 'completed';
            syncedAt = new Date().toISOString();
          } else {
            const isNetworkError = (msg?: string) => {
              if (!msg) return false;
              const lower = msg.toLowerCase();
              return lower.includes('failed to fetch') || lower.includes('network') || lower.includes('timeout') || lower.includes('aborted');
            };

            if (!isNetworkError(rpcRes.error)) {
              // Explicit server rejection - ABORT IMMEDIATELY, do not write fake local data
              showToast('Pawn Intake Rejected', rpcRes.error || 'Server rejected pawn intake.', 'error');
              return;
            }
            console.warn('Network timeout during pawn intake, saving locally for offline sync:', rpcRes.error);
          }
        } catch (err: any) {
          console.warn('Network error during online pawn intake, saving locally for offline sync:', err?.message);
        }
      }

      // 2. ATOMIC LOCAL DEXIE COMMIT (Reflecting server success or durable offline outbox)
      await db.transaction('rw', [db.inventory, db.loans, db.saps, db.syncLogs], async () => {
        await db.inventory.add(invItem);
        await db.loans.add(loanRecord);
        await db.saps.add(sapsRecord);

        await db.syncLogs.add({
          entityType: 'pawnIntake',
          entityId: loanId,
          action: 'create',
          payload: pawnPayload,
          status: syncLogStatus,
          syncedAt,
          createdAt: nowIso,
          retryCount: 0
        });
      });

      setResult({
        assetTag: sku,
        ticketNumber,
        item: { id: itemId, title: itemData.title, sku } as any,
        loan: { id: loanId, ticketNumber } as any
      });

      await draftService.closeDraft(draftId);
      setStep('completion');
      if (syncLogStatus === 'completed') {
        showToast('Pawn Finalized', `Ticket ${ticketNumber} created and asset vaulted atomically`, 'success');
      } else {
        showToast('Saved Offline', `Ticket ${ticketNumber} saved locally and queued for sync`, 'amber');
      }
    }
  };

  const filteredIdentities = useMemo(() => {
    if (!identitySearch) return [];
    const q = identitySearch.toLowerCase();
    const source = txType === 'buy' ? sellers : customers;
    return source.filter(c =>
      c.fullName.toLowerCase().includes(q) ||
      c.idNumber.includes(q) ||
      c.mobile.includes(q)
    ).slice(0, 5);
  }, [txType, customers, sellers, identitySearch]);

  const resetWorkflow = () => {
    setDraftId(crypto.randomUUID());
    setStep('mode');
    setTxType(null);
    setSelectedIdentity(null);
    setIsCreatingIdentity(false);
    setAgreedOffer(0);
    setCostBasisInput('0');
    setRetailPriceInput('0');
    setExistingStockStatus('Retail Floor');
    setResult(null);
    setItemData({
      title: '',
      category: 'Phones & Tech',
      brand: '',
      model: '',
      serialOrImei: '',
      condition: 'Good',
      imageUrl: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&q=80&w=300&h=300',
      stockLocation: 'Main Floor Display',
      internalNote: '',
      sourceNote: 'Item was already owned by the shop before LocalMarket onboarding'
    });
  };

  return (
    <div className="flex-1 flex flex-col bg-[#F5F6F8] overflow-hidden">
      {/* Header bar */}
      <div className="px-8 py-5 bg-white border-b border-gray-200 shrink-0 shadow-xs">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#FDF0EA] text-[#C85A32] flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 leading-tight">Add Stock & Intake Hub</h2>
              <p className="text-xs text-gray-500">
                {txType === 'existing'
                  ? 'Adding existing store inventory (No seller record required)'
                  : txType === 'buy'
                  ? 'Purchasing second-hand goods from outright seller'
                  : txType === 'pawn'
                  ? 'Issuing secured pledge loan under NCR Act 34'
                  : 'Select the intake source to begin'}
              </p>
            </div>
          </div>
          {step !== 'mode' && step !== 'completion' && (
            <button
              onClick={resetWorkflow}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition"
            >
              <X className="w-3.5 h-3.5" />
              <span>Cancel Intake</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 md:p-8 no-scrollbar">
        <div className="max-w-4xl mx-auto">
          {/* Progress Indicator */}
          {step !== 'completion' && step !== 'mode' && (
            <div className="flex items-center gap-2 mb-8 px-2">
              {workflowSteps.map((s, i) => {
                const isActive = i === currentStepIndex;
                const isPast = i < currentStepIndex;
                return (
                  <React.Fragment key={s.id}>
                    <div className={`flex items-center gap-2 ${isActive ? 'text-[#C85A32]' : isPast ? 'text-emerald-600' : 'text-gray-400'}`}>
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border transition ${
                          isActive
                            ? 'border-[#C85A32] bg-[#FDF0EA] text-[#C85A32]'
                            : isPast
                            ? 'border-emerald-600 bg-emerald-50 text-emerald-600'
                            : 'border-gray-300 bg-white text-gray-400'
                        }`}
                      >
                        {isPast ? <Check className="w-3 h-3 stroke-[3]" /> : i + 1}
                      </div>
                      <span className="text-xs font-semibold hidden sm:inline">{s.label}</span>
                    </div>
                    {i < workflowSteps.length - 1 && (
                      <div className={`flex-1 h-0.5 ${i < currentStepIndex ? 'bg-emerald-500' : 'bg-gray-200'}`} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          )}

          <AnimatePresence mode="wait">
            {/* ============================================================
                STEP 0: INTAKE SELECTION (3 Distinct Options)
               ============================================================ */}
            {step === 'mode' && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="space-y-6 py-4"
              >
                <div className="text-center max-w-xl mx-auto mb-6">
                  <h3 className="text-2xl font-bold text-gray-900 tracking-tight">How is this item being acquired?</h3>
                  <p className="text-sm text-gray-500 mt-1.5">
                    Select the intake pathway below. Existing store stock does not require seller identification.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* OPTION 1: EXISTING STOCK */}
                  <div
                    onClick={() => handleSelectTxType('existing')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSelectTxType('existing'); }}
                    className="p-7 rounded-2xl bg-white border-2 border-gray-200 hover:border-[#C85A32] transition-all text-left space-y-5 shadow-xs hover:shadow-md cursor-pointer group flex flex-col justify-between"
                  >
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="w-12 h-12 rounded-xl bg-[#FDF0EA] text-[#C85A32] flex items-center justify-center group-hover:scale-105 transition-transform">
                          <Package className="w-6 h-6" />
                        </div>
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wide bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Shop Owned
                        </span>
                      </div>
                      <div>
                        <h4 className="text-lg font-bold text-gray-900 group-hover:text-[#C85A32] transition-colors">
                          Existing Stock
                        </h4>
                        <p className="text-xs font-medium text-gray-500 mt-0.5">
                          Already owned by the shop
                        </p>
                        <p className="text-xs text-gray-600 mt-2.5 leading-relaxed">
                          Items already in your store prior to onboarding, retail restock, or supplier merchandise. No seller or customer ID needed.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs font-semibold text-[#C85A32] pt-4 border-t border-gray-100">
                      <span>Add Existing Stock</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>

                  {/* OPTION 2: BUY FROM PERSON */}
                  <div
                    onClick={() => handleSelectTxType('buy')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSelectTxType('buy'); }}
                    className="p-7 rounded-2xl bg-white border-2 border-gray-200 hover:border-[#C85A32] transition-all text-left space-y-5 shadow-xs hover:shadow-md cursor-pointer group flex flex-col justify-between"
                  >
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="w-12 h-12 rounded-xl bg-orange-50 text-[#C85A32] flex items-center justify-center group-hover:scale-105 transition-transform">
                          <ShoppingBag className="w-6 h-6" />
                        </div>
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wide bg-blue-50 text-blue-700 border border-blue-200">
                          SHG Act 06
                        </span>
                      </div>
                      <div>
                        <h4 className="text-lg font-bold text-gray-900 group-hover:text-[#C85A32] transition-colors">
                          Buy From Person
                        </h4>
                        <p className="text-xs font-medium text-gray-500 mt-0.5">
                          Purchase an item from a seller
                        </p>
                        <p className="text-xs text-gray-600 mt-2.5 leading-relaxed">
                          Outright purchase from an individual. Verifies RSA ID or Passport, logs Form 21 register, and creates seller ledger.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs font-semibold text-[#C85A32] pt-4 border-t border-gray-100">
                      <span>Start Seller Purchase</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>

                  {/* OPTION 3: PAWN */}
                  <div
                    onClick={() => handleSelectTxType('pawn')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSelectTxType('pawn'); }}
                    className="p-7 rounded-2xl bg-white border-2 border-gray-200 hover:border-[#C85A32] transition-all text-left space-y-5 shadow-xs hover:shadow-md cursor-pointer group flex flex-col justify-between"
                  >
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                          <Lock className="w-6 h-6" />
                        </div>
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wide bg-purple-50 text-purple-700 border border-purple-200">
                          NCR Act 34
                        </span>
                      </div>
                      <div>
                        <h4 className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                          Pawn
                        </h4>
                        <p className="text-xs font-medium text-gray-500 mt-0.5">
                          Collateral for a loan
                        </p>
                        <p className="text-xs text-gray-600 mt-2.5 leading-relaxed">
                          30-day secured credit agreement. Item vaulted securely. Customer retains statutory redemption rights.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 pt-4 border-t border-gray-100">
                      <span>Start Pawn Loan</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ============================================================
                STEP 1: IDENTITY (BUY OR PAWN ONLY)
               ============================================================ */}
            {step === 'customer' && (
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
                      {txType === 'buy' ? 'Second-Hand Goods Act Form 21 Compliance' : 'NCR Act 34 Regulated Borrower Record'}
                    </p>
                  </div>
                </div>

                {!selectedIdentity && !isCreatingIdentity && (
                  <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs space-y-6">
                    <div className="relative">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder={`Search previous ${txType === 'buy' ? 'sellers' : 'customers'} by name, ID number, or phone...`}
                        value={identitySearch}
                        onChange={e => setIdentitySearch(e.target.value)}
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
                      {filteredIdentities.map(c => (
                        <button
                          key={c.id}
                          onClick={() => selectIdentity(c)}
                          className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 hover:border-[#C85A32] hover:bg-[#FDF0EA]/20 transition flex items-center justify-between group"
                        >
                          <div className="flex items-center gap-3.5">
                            <div className="w-9 h-9 rounded-xl bg-gray-200 text-gray-700 flex items-center justify-center font-bold text-xs uppercase">
                              {c.fullName.charAt(0)}
                            </div>
                            <div className="text-left">
                              <p className="text-sm font-semibold text-gray-900">{c.fullName}</p>
                              <p className="text-xs text-gray-500 font-mono">{c.idNumber} · {c.mobile}</p>
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
                      <button onClick={() => setIsCreatingIdentity(false)} className="text-xs text-gray-500 hover:text-gray-900 font-medium">
                        Cancel
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-600">ID Document Type</label>
                        <select
                          value={newIdentity.idType}
                          onChange={e => setNewIdentity({ ...newIdentity, idType: e.target.value as any })}
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
                          onChange={e => setNewIdentity({ ...newIdentity, idNumber: e.target.value })}
                          className="w-full bg-[#F8F9FA] border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 font-mono focus:outline-none focus:border-[#C85A32]"
                        />
                      </div>

                      <div className="sm:col-span-2 space-y-1">
                        <label className="text-xs font-medium text-gray-600">Full Legal Name</label>
                        <input
                          type="text"
                          placeholder="e.g. Siyabonga Mthembu"
                          value={newIdentity.fullName}
                          onChange={e => setNewIdentity({ ...newIdentity, fullName: e.target.value })}
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
                          onChange={e => setNewIdentity({ ...newIdentity, mobile: e.target.value })}
                          className="w-full bg-[#F8F9FA] border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 focus:outline-none focus:border-[#C85A32]"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-600">Physical Residential Address</label>
                        <input
                          type="text"
                          placeholder="e.g. 1428 Zone 4, Soweto"
                          value={newIdentity.address}
                          onChange={e => setNewIdentity({ ...newIdentity, address: e.target.value })}
                          className="w-full bg-[#F8F9FA] border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 focus:outline-none focus:border-[#C85A32]"
                        />
                      </div>
                    </div>

                    <button
                      onClick={handleCreateIdentity}
                      className="w-full py-3 bg-[#C85A32] text-white rounded-xl font-semibold text-xs hover:bg-[#A94725] transition shadow-xs flex items-center justify-center gap-2"
                    >
                      <UserCheck className="w-4 h-4" />
                      <span>Save Identity</span>
                    </button>
                    <p className="text-[11px] text-gray-500 text-center">
                      Status on save: Verification pending
                    </p>
                  </div>
                )}

                {/* SELECTED IDENTITY DISPLAY */}
                {selectedIdentity && (
                  <div className="space-y-4">
                    <div className={`p-5 rounded-2xl bg-white border-2 ${selectedIdentity.verified ? 'border-emerald-500/40' : 'border-amber-400/50'} shadow-xs flex items-center justify-between`}>
                      <div className="flex items-center gap-3.5">
                        <div className={`w-11 h-11 rounded-xl ${selectedIdentity.verified ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'} flex items-center justify-center font-bold`}>
                          {selectedIdentity.verified ? <CheckCircle2 className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${selectedIdentity.verified ? 'text-emerald-700 bg-emerald-50' : 'text-amber-700 bg-amber-50'}`}>
                              {selectedIdentity.verified ? `Verified ${txType === 'buy' ? 'Seller' : 'Customer'}` : `Verification Pending · ${txType === 'buy' ? 'Seller' : 'Customer'}`}
                            </span>
                          </div>
                          <h4 className="text-base font-bold text-gray-900 mt-0.5">{selectedIdentity.fullName}</h4>
                          <p className="text-xs text-gray-500 font-mono">{selectedIdentity.idNumber} · {selectedIdentity.mobile}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!selectedIdentity.verified && (
                          <button
                            type="button"
                            onClick={handleExplicitVerifyIdentity}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-xs flex items-center gap-1.5 transition"
                            title="Verify against physical South African ID document or card"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Verify Physical ID</span>
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedIdentity(null)}
                          className="text-xs text-gray-500 hover:text-gray-900 font-semibold px-2 py-1.5"
                        >
                          Change
                        </button>
                      </div>
                    </div>

                    {txType === 'buy' && (
                      <SellerHistoryDisplay sellerId={selectedIdentity.id} />
                    )}
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleBack}
                    className="flex items-center gap-1.5 px-5 py-3 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-100 transition text-xs font-semibold"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Back</span>
                  </button>
                  <button
                    onClick={handleNext}
                    disabled={!selectedIdentity}
                    className="flex-1 py-3 px-6 bg-[#C85A32] disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-xl font-semibold text-xs flex items-center justify-center gap-2 shadow-xs hover:bg-[#A94725] transition"
                  >
                    <span>Item Details</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* ============================================================
                STEP 2: ITEM DETAILS (ALL FLOWS)
               ============================================================ */}
            {step === 'item' && (
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
                          type="text"
                          placeholder="e.g. Samsung Galaxy S23 256GB - Phantom Black"
                          value={itemData.title}
                          onChange={e => setItemData({ ...itemData, title: e.target.value })}
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
                            onChange={e => setItemData({ ...itemData, category: e.target.value as any })}
                            className="w-full bg-[#F8F9FA] border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 focus:outline-none focus:border-[#C85A32]"
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
                          <label className="text-xs font-semibold text-gray-700">Serial Number / IMEI</label>
                          <input
                            type="text"
                            placeholder="Optional or N/A"
                            value={itemData.serialOrImei}
                            onChange={e => setItemData({ ...itemData, serialOrImei: e.target.value })}
                            className="w-full bg-[#F8F9FA] border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 font-mono focus:outline-none focus:border-[#C85A32]"
                          />
                          {duplicateSerialMatch && (
                            <div className={`mt-2 p-2.5 rounded-xl border text-xs flex items-start gap-2 ${
                              ['Retail Floor', 'Vault Hold', 'InStock', 'Reserved', 'Pawned'].includes(duplicateSerialMatch.status)
                                ? 'bg-red-50 border-red-300 text-red-900'
                                : duplicateSerialMatch.status === 'Flagged'
                                ? 'bg-purple-50 border-purple-300 text-purple-900'
                                : 'bg-amber-50 border-amber-300 text-amber-900'
                            }`}>
                              <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${
                                ['Retail Floor', 'Vault Hold', 'InStock', 'Reserved', 'Pawned', 'Flagged'].includes(duplicateSerialMatch.status)
                                  ? 'text-red-600'
                                  : 'text-amber-600'
                              }`} />
                              <div className="min-w-0">
                                <p className="font-bold text-[11px] leading-tight">
                                  {['Retail Floor', 'Vault Hold', 'InStock', 'Reserved', 'Pawned'].includes(duplicateSerialMatch.status)
                                    ? 'This serial/IMEI already belongs to active inventory.'
                                    : duplicateSerialMatch.status === 'Flagged'
                                    ? 'This serial/IMEI is flagged under compliance review.'
                                    : 'This serial/IMEI was previously sold. Verify that this is the same physical item.'}
                                </p>
                                <p className="text-[10px] opacity-90 mt-0.5 leading-snug">
                                  Matches item <span className="font-mono font-bold">{duplicateSerialMatch.sku}</span> ("{duplicateSerialMatch.title}") currently marked as <span className="font-semibold">{duplicateSerialMatch.status}</span>.
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
                            onChange={e => setItemData({ ...itemData, brand: e.target.value })}
                            className="w-full bg-[#F8F9FA] border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 focus:outline-none focus:border-[#C85A32]"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-gray-700">Model</label>
                          <input
                            type="text"
                            placeholder="e.g. S23 5G, GSB 18V-50"
                            value={itemData.model}
                            onChange={e => setItemData({ ...itemData, model: e.target.value })}
                            className="w-full bg-[#F8F9FA] border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 focus:outline-none focus:border-[#C85A32]"
                          />
                        </div>
                      </div>

                      {/* CONDITION SELECTOR */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-gray-700">Condition</label>
                        <div className="flex flex-wrap gap-2">
                          {(['Mint', 'Excellent', 'Good', 'Fair', 'Damaged'] as ItemCondition[]).map(c => (
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
                            onChange={e => setItemData({ ...itemData, sourceNote: e.target.value })}
                            className="w-full bg-[#F8F9FA] border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-700 focus:outline-none focus:border-[#C85A32]"
                          />
                          <p className="text-[11px] text-gray-400">
                            Clear note explaining that this item was already shop-owned prior to system setup.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* PHOTO PREVIEW */}
                    <div className="space-y-2 flex flex-col">
                      <label className="text-xs font-semibold text-gray-700">Photo / Image</label>
                      <div className="flex-1 rounded-2xl bg-gray-50 border-2 border-dashed border-gray-200 flex flex-col items-center justify-center p-4 overflow-hidden relative min-h-[180px]">
                        {itemData.imageUrl ? (
                          <img
                            src={itemData.imageUrl}
                            alt="Preview"
                            className="w-full h-full object-cover rounded-xl"
                          />
                        ) : (
                          <div className="text-center text-gray-400 space-y-1">
                            <Camera className="w-8 h-8 mx-auto" />
                            <p className="text-xs">No image attached</p>
                          </div>
                        )}
                      </div>
                      <input
                        type="text"
                        placeholder="Image URL..."
                        value={itemData.imageUrl}
                        onChange={e => setItemData({ ...itemData, imageUrl: e.target.value })}
                        className="w-full bg-[#F8F9FA] border border-gray-200 rounded-xl px-3 py-1.5 text-[11px] text-gray-600 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleBack}
                    className="flex items-center gap-1.5 px-5 py-3 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-100 transition text-xs font-semibold"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Back</span>
                  </button>
                  <button
                    onClick={handleNext}
                    className="flex-1 py-3 px-6 bg-[#C85A32] text-white rounded-xl font-semibold text-xs flex items-center justify-center gap-2 shadow-xs hover:bg-[#A94725] transition"
                  >
                    <span>{txType === 'existing' ? 'Set Retail Pricing' : 'Valuation Review'}</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* ============================================================
                STEP 3: VALUATION & PRICING
               ============================================================ */}
            {step === 'valuation' && (
              <motion.div
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-3.5 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-[#FDF0EA] text-[#C85A32] flex items-center justify-center font-bold">
                    <Scale className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">
                      {txType === 'existing' ? 'Retail Price & Cost Basis' : 'Fair Market Valuation'}
                    </h3>
                    <p className="text-xs text-gray-500">
                      {txType === 'existing'
                        ? 'Define shelf retail selling price and optional historical cost'
                        : `Determining ${txType === 'buy' ? 'cash payout' : 'pawn loan principal'}`}
                    </p>
                  </div>
                </div>

                {/* Market Intelligence Guidance Card */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-700">LocalMarket Valuation Intelligence</span>
                    <button
                      type="button"
                      onClick={handleRunMarketCheck}
                      className="px-3 py-1 bg-[#C85A32] text-white hover:bg-[#A94725] rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
                    >
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span>{marketCheckData ? 'Refresh Market Check' : 'Run Market Check'}</span>
                    </button>
                  </div>

                  {(marketCheckData || isMarketLoading || marketError) && (
                    <MarketCheckCard
                      data={marketCheckData}
                      loading={isMarketLoading}
                      error={marketError}
                      onRefresh={handleRunMarketCheck}
                      onApplySuggestedRetail={(retailVal) => {
                        setRetailPriceInput(String(retailVal));
                      }}
                      onApplySuggestedBuy={(buyLow, buyHigh) => {
                        const midBuy = Math.round((buyLow + buyHigh) / 2);
                        setAgreedOffer(midBuy);
                      }}
                    />
                  )}
                </div>

                {/* 3A. VALUATION FOR EXISTING STOCK */}
                {txType === 'existing' ? (
                  <div className="bg-white border border-gray-200 rounded-2xl p-7 shadow-xs space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* RETAIL PRICE */}
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Retail Floor Price (ZAR) *
                        </label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-[#C85A32]">R</span>
                          <input
                            type="number"
                            value={retailPriceInput}
                            onChange={e => setRetailPriceInput(e.target.value)}
                            className="w-full bg-[#F8F9FA] border-2 border-gray-200 focus:border-[#C85A32] focus:bg-white rounded-xl pl-9 pr-4 py-3 text-2xl font-bold text-gray-900 font-mono outline-none transition"
                            placeholder="0.00"
                            autoFocus
                          />
                        </div>
                        <p className="text-xs text-gray-500">The customer price that will appear in Front POS.</p>
                      </div>

                      {/* OPTIONAL COST BASIS */}
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Cost Basis (ZAR, Optional)
                        </label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-gray-400">R</span>
                          <input
                            type="number"
                            value={costBasisInput}
                            onChange={e => setCostBasisInput(e.target.value)}
                            className="w-full bg-[#F8F9FA] border-2 border-gray-200 focus:border-gray-400 focus:bg-white rounded-xl pl-9 pr-4 py-3 text-2xl font-bold text-gray-800 font-mono outline-none transition"
                            placeholder="0.00"
                          />
                        </div>
                        <p className="text-xs text-gray-500">Historical acquisition cost if known, or leave 0.</p>
                      </div>
                    </div>

                    {/* MARGIN CALCULATION BANNER */}
                    {parseFloat(retailPriceInput) > 0 && parseFloat(costBasisInput) > 0 && (
                      <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <TrendingUp className="w-5 h-5 text-emerald-600" />
                          <div>
                            <p className="text-xs font-bold text-emerald-800">Estimated Gross Margin</p>
                            <p className="text-xs text-emerald-600">
                              Spread: R {(parseFloat(retailPriceInput) - parseFloat(costBasisInput)).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <span className="text-base font-bold text-emerald-700 font-mono">
                          {(
                            ((parseFloat(retailPriceInput) - parseFloat(costBasisInput)) /
                              parseFloat(retailPriceInput)) *
                            100
                          ).toFixed(1)}
                          %
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  /* 3B. VALUATION FOR BUY OR PAWN */
                  <div className="bg-white border border-gray-200 rounded-2xl p-7 shadow-xs space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <div className="p-5 rounded-xl bg-gray-50 border border-gray-200 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-gray-500">Recommended Payout</span>
                            <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[11px] font-semibold border border-emerald-200">
                              <TrendingUp className="w-3 h-3" />
                              <span>Fair Estimate</span>
                            </div>
                          </div>
                          <p className="text-3xl font-bold text-gray-900 font-mono">
                            R {agreedOffer.toLocaleString()}
                          </p>
                          <p className="text-xs text-gray-500 border-t border-gray-200 pt-2">
                            Based on {itemData.condition} condition for {itemData.category}
                          </p>
                        </div>

                        {txType === 'buy' && (
                          <div className="p-4 rounded-xl bg-[#FDF0EA] border border-[#C85A32]/20 flex items-center justify-between">
                            <div>
                              <span className="text-xs font-semibold text-gray-700">Projected Retail Selling Price</span>
                              <p className="text-xs text-gray-500">Calculated with standard markup</p>
                            </div>
                            <span className="text-lg font-bold text-[#C85A32] font-mono">
                              R {suggestedRetail.toLocaleString()}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="space-y-4">
                        <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Negotiated Final Amount (ZAR)
                        </label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-[#C85A32]">R</span>
                          <input
                            type="number"
                            value={agreedOffer}
                            onChange={e => {
                              const val = Number(e.target.value);
                              setAgreedOffer(val);
                              if (txType === 'buy') {
                                setSuggestedRetail(
                                  roundRetailPrice(
                                    val * businessRules.defaultRetailMarkupMultiplier,
                                    businessRules.retailRoundingMode
                                  )
                                );
                              }
                            }}
                            className="w-full bg-white border-2 border-[#C85A32] rounded-xl pl-10 pr-4 py-3.5 text-3xl font-bold text-gray-900 font-mono outline-none shadow-xs"
                          />
                        </div>
                        <p className="text-xs text-gray-500 italic">
                          Confirm serial and asset state before proceeding to deal terms.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleBack}
                    className="flex items-center gap-1.5 px-5 py-3 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-100 transition text-xs font-semibold"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Back</span>
                  </button>
                  <button
                    onClick={handleNext}
                    className="flex-1 py-3 px-6 bg-[#C85A32] text-white rounded-xl font-semibold text-xs flex items-center justify-center gap-2 shadow-xs hover:bg-[#A94725] transition"
                  >
                    <span>{txType === 'existing' ? 'Choose Stock Location' : 'Review Deal Terms'}</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* ============================================================
                STEP 4A: STOCK LOCATION (EXISTING STOCK ONLY)
               ============================================================ */}
            {step === 'location' && txType === 'existing' && (
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
                        onChange={e => setItemData({ ...itemData, stockLocation: e.target.value })}
                        className="w-full bg-[#F8F9FA] border border-gray-200 rounded-xl px-4 py-2.5 text-xs text-gray-800 focus:outline-none focus:border-[#C85A32]"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-gray-700">Initial Stock Status</label>
                      <select
                        value={existingStockStatus}
                        onChange={e => setExistingStockStatus(e.target.value as ItemStatus)}
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
                        onChange={e => setItemData({ ...itemData, internalNote: e.target.value })}
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
                    onClick={handleBack}
                    className="flex items-center gap-1.5 px-5 py-3 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-100 transition text-xs font-semibold"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Back</span>
                  </button>
                  <button
                    onClick={handleNext}
                    className="flex-1 py-3 px-6 bg-emerald-600 text-white rounded-xl font-semibold text-xs flex items-center justify-center gap-2 shadow-xs hover:bg-emerald-700 transition"
                  >
                    <Check className="w-4 h-4" />
                    <span>Complete Intake & Add Stock</span>
                  </button>
                </div>
              </motion.div>
            )}

            {/* ============================================================
                STEP 4B: DEAL REVIEW (BUY OR PAWN ONLY)
               ============================================================ */}
            {step === 'deal' && (txType === 'buy' || txType === 'pawn') && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-3.5 mb-2">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${txType === 'buy' ? 'bg-[#FDF0EA] text-[#C85A32]' : 'bg-blue-50 text-blue-600'}`}>
                    {txType === 'buy' ? <ShoppingBag className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">
                      {txType === 'buy' ? 'Review Seller Batch' : 'Review Pledge Terms'}
                    </h3>
                    <p className="text-xs text-gray-500">
                      {txType === 'buy' ? 'Statutory Second-Hand Goods Purchase' : 'Regulated Secured Credit Agreement'}
                    </p>
                  </div>
                </div>

                {/* Batch Summary (if Buy) */}
                {txType === 'buy' && basketItems.length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-xs mb-6">
                    <div className="bg-gray-50 px-5 py-3 border-b border-gray-200 flex items-center justify-between">
                      <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Batch Items ({basketItems.length})</h4>
                      <span className="text-xs font-bold text-gray-900">Total Payout: R {basketItems.reduce((sum, i) => sum + i.agreedOffer, 0).toLocaleString()}</span>
                    </div>
                    <div className="divide-y divide-gray-100 max-h-48 overflow-y-auto">
                      {basketItems.map((item, idx) => (
                        <div key={idx} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50 transition">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500">#{idx+1}</div>
                            <div>
                              <p className="text-xs font-semibold text-gray-900">{item.title}</p>
                              <p className="text-[10px] text-gray-500 font-mono">{item.serialOrImei || 'No Serial'}</p>
                            </div>
                          </div>
                          <span className="text-xs font-bold text-gray-900">R {item.agreedOffer.toLocaleString()}</span>
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
                          {txType === 'buy' ? 'Direct Purchase (Outright)' : '30-Day Pawn Loan'}
                        </span>
                      </div>
                      <div className="flex justify-between py-1.5">
                        <span className="text-gray-500">{txType === 'buy' ? 'Seller' : 'Customer'}</span>
                        <div className="text-right">
                          <span className="font-semibold text-gray-900">{selectedIdentity?.fullName}</span>
                          <span className={`block text-[10px] font-semibold ${selectedIdentity?.verified ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {selectedIdentity?.verified ? 'Verified' : 'Verification pending'}
                          </span>
                        </div>
                      </div>
                      <div className="flex justify-between py-1.5">
                        <span className="text-gray-500">ID Number</span>
                        <span className="font-mono font-medium text-gray-800">{selectedIdentity?.idNumber}</span>
                      </div>
                      <div className="flex justify-between py-1.5">
                        <span className="text-gray-500">Asset</span>
                        <span className="font-semibold text-gray-900">{itemData.title}</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-gray-200 space-y-3">
                      <div className="flex justify-between items-baseline">
                        <span className="text-xs font-bold text-gray-700">Negotiated Payout</span>
                        <span className="text-2xl font-bold text-gray-900 font-mono">
                          R {agreedOffer.toLocaleString()}
                        </span>
                      </div>

                      {txType === 'pawn' && pawnCalculations && (
                        <div className="space-y-1.5 pt-2 border-t border-gray-100 text-xs">
                          <div className="flex justify-between text-gray-500">
                            <span>Monthly Interest ({Math.round(businessRules.pawnMonthlyInterestRate * 100)}%)</span>
                            <span className="font-mono">R {pawnCalculations.interest.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-gray-500">
                            <span>Vault Storage & Admin Fee ({Math.round(businessRules.pawnStorageAdminFeeRate * 100)}%)</span>
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
                        <h4 className="text-xs font-bold text-gray-900">SAPS Form 21 Ready</h4>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Finalizing will assign asset tags, record the transaction in the statutory register, and print receipts.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {txType === 'buy' && (
                        <button
                          onClick={handleAddToBatch}
                          className="w-full flex items-center justify-center gap-2 bg-white border-2 border-gray-200 text-gray-700 py-3.5 rounded-xl font-bold hover:bg-gray-50 hover:border-[#C85A32] hover:text-[#C85A32] transition group"
                        >
                          <Plus className="w-5 h-5 text-gray-400 group-hover:text-[#C85A32]" />
                          Add Another Item to Batch
                        </button>
                      )}

                      <button
                        onClick={handleFinalize}
                        className={`w-full py-4 rounded-xl text-white font-bold text-sm shadow-xs transition ${
                          txType === 'buy'
                            ? 'bg-[#C85A32] hover:bg-[#A94725]'
                            : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                      >
                        {txType === 'buy' ? (basketItems.length > 0 ? `Finalize Batch (${basketItems.length + 1} Items)` : 'Complete Purchase & Payout') : 'Finalise Pawn Loan Agreement'}
                      </button>

                      <button
                        onClick={handleBack}
                        className="w-full text-xs text-gray-500 hover:text-gray-900 font-semibold text-center py-1"
                      >
                        Modify Terms
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ============================================================
                STEP 5: COMPLETION
               ============================================================ */}
            {step === 'completion' && result && (
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
                    Asset <span className="font-mono font-bold text-gray-800">{result.assetTag}</span> has been logged to inventory.
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
                        <p className="text-base font-bold text-blue-600 font-mono mt-0.5">{result.ticketNumber}</p>
                      </div>
                    )}

                    <div>
                      <p className="text-gray-400 font-medium">
                        {txType === 'existing' ? 'Retail Price' : 'Payout Amount'}
                      </p>
                      <p className="text-base font-bold text-emerald-600 font-mono mt-0.5">
                        R {txType === 'existing' ? result.item.retailPrice.toLocaleString() : agreedOffer.toLocaleString()}
                      </p>
                    </div>

                    <div>
                      <p className="text-gray-400 font-medium">Location</p>
                      <p className="text-base font-bold text-gray-900 mt-0.5">
                        {result.item.stockLocation || (txType === 'buy' ? 'Retail Floor' : businessRules.defaultVaultShelf)}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => showToast('Label Sent', `Asset label ${result.assetTag} printed`, 'success')}
                      className="py-3 px-4 rounded-xl bg-gray-900 text-white font-semibold text-xs flex items-center justify-center gap-2 hover:bg-gray-800 transition shadow-xs"
                    >
                      <Printer className="w-4 h-4" />
                      <span>Print Asset Label</span>
                    </button>

                    {txType === 'pawn' && (
                      <button
                        onClick={() => setActiveContractModal(result.loan!)}
                        className="py-3 px-4 rounded-xl border border-gray-200 text-gray-800 font-semibold text-xs flex items-center justify-center gap-2 hover:bg-gray-50 transition shadow-xs"
                      >
                        <FileText className="w-4 h-4" />
                        <span>Print Pawn Contract</span>
                      </button>
                    )}

                    <button
                      onClick={() => showToast('Digital Receipt Sent', 'Receipt sent via WhatsApp', 'info')}
                      className="py-3 px-4 rounded-xl border border-gray-200 text-gray-800 font-semibold text-xs flex items-center justify-center gap-2 hover:bg-gray-50 transition shadow-xs sm:col-span-2"
                    >
                      <Smartphone className="w-4 h-4" />
                      <span>Send WhatsApp Notification</span>
                    </button>
                  </div>
                </div>

                <div className="flex justify-center pt-2">
                  <button
                    onClick={resetWorkflow}
                    className="flex items-center gap-2 px-6 py-3 bg-[#C85A32] text-white rounded-xl font-semibold text-xs shadow-xs hover:bg-[#A94725] transition"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Start New Intake</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        {activeDrafts.length > 0 && (
          <DraftRecoveryModal
            drafts={activeDrafts}
            onContinue={handleContinueDraft}
            onDiscard={handleDiscardDraft}
          />
        )}
      </div>
    </div>
  );
};
