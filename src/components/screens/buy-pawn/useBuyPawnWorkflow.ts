import { useState, useEffect, useMemo, useCallback } from 'react';
import { useApp } from '../../../context/AppContext';
import { useAuth } from '../../../context/AuthContext';
import { useInventory } from '../../../context/InventoryContext';
import { useLoans } from '../../../context/LoanContext';
import { useCustomers } from '../../../context/CustomerContext';
import { useSellers } from '../../../context/SellerContext';
import {
  ItemCondition,
  InventoryItem,
  PawnLoan,
  Customer,
  Seller,
  ItemStatus,
  SapsEntry,
} from '../../../types';
import { roundRetailPrice, calculatePawnFees } from '../../../utils/pricingRules';
import {
  generateUniqueSku,
  generateUniqueTransactionNumber,
  generateUniquePawnTicket,
} from '../../../utils/identifierGenerator';
import { parseAndValidateRsaId } from '../../../utils/rsaIdValidator';
import { validateAndNormalizeSaPhone } from '../../../utils/phoneValidator';
import { focusAndScrollErrorField, formatUserFriendlyError } from '../../../utils/errorNavigator';
import { db } from '../../../db';
import { isSupabaseConfigured } from '../../../services/supabase';
import { sellerTransactionsApi, pawnLoansApi } from '../../../services/supabaseApi';
import {
  WorkflowStep,
  TxType,
  ItemDraft,
  NewIdentityDraft,
  BatchItem,
  CompletionResult,
  StepperStep,
  normalizeStepForTransactionType,
} from './buyPawnTypes';
import { useBuyPawnImages } from './useBuyPawnImages';
import { useBuyPawnDrafts } from './useBuyPawnDrafts';
import { useBuyPawnMarketCheck } from './useBuyPawnMarketCheck';
import { useOperationProgress } from '../../../hooks/useOperationProgress';

const INITIAL_ITEM_DATA: ItemDraft = {
  title: '',
  category: 'Phones & Tech',
  brand: '',
  model: '',
  serialOrImei: '',
  condition: 'Good',
  imageUrl: '',
  stockLocation: 'Main Floor Display',
  internalNote: '',
  sourceNote: '',
};

const INITIAL_NEW_IDENTITY: NewIdentityDraft = {
  fullName: '',
  idNumber: '',
  mobile: '',
  address: '',
  idType: 'RSA Smart ID',
};

export function isIgnoredSerialNumber(val: string): boolean {
  const clean = val.trim().toLowerCase();
  const ignored = ['n/a', 'na', 'none', 'unknown', 'nil', 'null', '-', '--', 'no serial', 'n.a', 'n.a.'];
  return !clean || clean.length < 4 || ignored.includes(clean);
}

export function shouldRecalculateShelfPrice(isEdited: boolean): boolean {
  return !isEdited;
}

export function getNextItemShelfState(): { suggestedRetail: number; isShelfPriceEdited: boolean } {
  return { suggestedRetail: 0, isShelfPriceEdited: false };
}

export function useBuyPawnWorkflow() {
  const { showToast, businessRules, shopProfile, setActiveContractModal, capturedRsaIdScan, isOnline } =
    useApp();
  const { user, hasPermission } = useAuth();
  const { addItem, inventory } = useInventory();
  const { customers, addCustomer, updateCustomer } = useCustomers();
  const { sellers, addSeller, updateSeller } = useSellers();
  const finalizeProgress = useOperationProgress();

  // Workflow Core State
  const [basketItems, setBasketItems] = useState<BatchItem[]>([]);
  const [step, setStep] = useState<WorkflowStep>('mode');
  const [txType, setTxType] = useState<TxType>(null);
  const [isFinalizing, setIsFinalizing] = useState(false);

  // Identity State (Buy / Pawn only)
  const [identitySearch, setIdentitySearch] = useState('');
  const [selectedIdentity, setSelectedIdentity] = useState<Customer | Seller | null>(null);
  const [isCreatingIdentity, setIsCreatingIdentity] = useState(false);
  const [newIdentity, setNewIdentity] = useState<NewIdentityDraft>(INITIAL_NEW_IDENTITY);

  // Mode-Isolated Identity & Pricing State (Fluid Buy ↔ Pawn preservation)
  const [buySelectedIdentity, setBuySelectedIdentity] = useState<Seller | null>(null);
  const [pawnSelectedIdentity, setPawnSelectedIdentity] = useState<Customer | null>(null);
  const [buyAgreedOffer, setBuyAgreedOffer] = useState<number>(0);
  const [buyIsAgreedOfferFromMarketCheck, setBuyIsAgreedOfferFromMarketCheck] = useState<boolean>(false);
  const [pawnAgreedOffer, setPawnAgreedOffer] = useState<number>(0);
  const [pawnIsAgreedOfferFromMarketCheck, setPawnIsAgreedOfferFromMarketCheck] = useState<boolean>(false);

  // Item Details State (Common to all flows)
  const [itemData, setItemData] = useState<ItemDraft>(INITIAL_ITEM_DATA);

  // Valuation & Pricing State — No invented/guessed starting money
  const [agreedOffer, setAgreedOffer] = useState<number>(0); // Payout / Principal
  const [isAgreedOfferFromMarketCheck, setIsAgreedOfferFromMarketCheck] = useState<boolean>(false);
  const [costBasisInput, setCostBasisInput] = useState<string>('');
  const [retailPriceInput, setRetailPriceInput] = useState<string>('');
  const [isRetailPriceFromMarketCheck, setIsRetailPriceFromMarketCheck] = useState<boolean>(false);
  const [suggestedRetail, setSuggestedRetail] = useState<number>(0);
  const [isShelfPriceEdited, setIsShelfPriceEdited] = useState<boolean>(false);
  const [existingStockStatus, setExistingStockStatus] = useState<ItemStatus>('Retail Floor');

  // Completion Result State
  const [result, setResult] = useState<CompletionResult | null>(null);

  // Integrated Sub-Hooks
  const images = useBuyPawnImages({
    itemData,
    setItemData,
    shopId: shopProfile?.id,
    showToast,
  });

  const drafts = useBuyPawnDrafts({
    user,
    shopId: shopProfile?.id,
    step,
    txType,
    itemData,
    newIdentity,
    selectedIdentity,
    buySelectedIdentity,
    pawnSelectedIdentity,
    agreedOffer,
    buyAgreedOffer,
    pawnAgreedOffer,
    isAgreedOfferFromMarketCheck,
    suggestedRetail,
    isShelfPriceEdited,
    retailPriceInput,
    isRetailPriceFromMarketCheck,
    costBasisInput,
    existingStockStatus,
    basketItems,
    setItemData,
    setNewIdentity,
    setSelectedIdentity,
    setBuySelectedIdentity,
    setPawnSelectedIdentity,
    setAgreedOffer,
    setBuyAgreedOffer,
    setPawnAgreedOffer,
    setIsAgreedOfferFromMarketCheck,
    setSuggestedRetail,
    setIsShelfPriceEdited,
    setRetailPriceInput,
    setIsRetailPriceFromMarketCheck,
    setCostBasisInput,
    setExistingStockStatus,
    setBasketItems,
    setStep,
    setTxType,
    hasPermission,
    showToast,
  });

  const marketCheck = useBuyPawnMarketCheck(itemData);

  // Synchronize captured RSA ID scan with customer selection/creation
  useEffect(() => {
    if (!capturedRsaIdScan || step !== 'customer') return;

    const scannedIdClean = capturedRsaIdScan.idNumber.replace(/\s+/g, '');

    if (txType === 'buy') {
      const match = sellers.find((s) => s.idNumber.replace(/\s+/g, '') === scannedIdClean);
      if (match) {
        setSelectedIdentity(match);
        setIsCreatingIdentity(false);
        showToast(
          'Previous Seller Found',
          `Matched existing seller by ID #${scannedIdClean}: ${match.fullName}`,
          'info'
        );
        return;
      }
    } else if (txType === 'pawn') {
      const match = customers.find((c) => c.idNumber.replace(/\s+/g, '') === scannedIdClean);
      if (match) {
        setSelectedIdentity(match);
        setIsCreatingIdentity(false);
        showToast(
          'Previous Customer Found',
          `Matched existing customer by ID #${scannedIdClean}: ${match.fullName}`,
          'info'
        );
        return;
      }
    }

    // If no existing record matched, pre-fill captured ID number and open identity creation (NO fabricated name)
    setIsCreatingIdentity(true);
    setNewIdentity((prev) => ({
      ...prev,
      idNumber: capturedRsaIdScan.idNumber,
      idType: 'RSA Smart ID',
      fullName: '', // NEVER FABRICATE A NAME
    }));
    showToast(
      'ID Decoded',
      `ID #${capturedRsaIdScan.idNumber} decoded — identity still needs verification.`,
      'info'
    );
  }, [capturedRsaIdScan, step, txType, customers, sellers, showToast]);

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
      expiryDate: expiry.toISOString().split('T')[0],
    };
  }, [txType, agreedOffer, businessRules]);

  // Serial Number / IMEI duplicate check across store inventory (normalized for non-values)
  const duplicateSerialMatch = useMemo(() => {
    const sn = itemData.serialOrImei.trim();
    if (isIgnoredSerialNumber(sn)) return null;
    return inventory.find(
      (i) => i.serialOrImei && !isIgnoredSerialNumber(i.serialOrImei) && i.serialOrImei.toLowerCase() === sn.toLowerCase()
    );
  }, [itemData.serialOrImei, inventory]);

  // Dynamic Stepper Configuration
  const workflowSteps: StepperStep[] = useMemo(() => {
    if (txType === 'existing') {
      return [
        { id: 'mode', label: 'Intake Type' },
        { id: 'item', label: 'Item Details' },
        { id: 'valuation', label: 'Retail Price' },
        { id: 'location', label: 'Stock Location' },
      ];
    }
    if (txType === 'buy') {
      return [
        { id: 'mode', label: 'Intake Type' },
        { id: 'item', label: 'Evaluate Item' },
        { id: 'valuation', label: 'Valuation & Price' },
        { id: 'customer', label: 'Seller Info' },
        { id: 'deal', label: 'Review & Record' },
      ];
    }
    if (txType === 'pawn') {
      return [
        { id: 'mode', label: 'Intake Type' },
        { id: 'customer', label: 'Borrower Info' },
        { id: 'item', label: 'Collateral Item' },
        { id: 'valuation', label: 'Loan Terms' },
        { id: 'deal', label: 'Review & Pledge' },
      ];
    }
    return [
      { id: 'mode', label: 'Intake Type' },
      { id: 'item', label: 'Details' },
      { id: 'valuation', label: 'Pricing' },
    ];
  }, [txType]);

  const currentStepIndex = useMemo(() => {
    const idx = workflowSteps.findIndex((s) => s.id === step);
    return idx >= 0 ? idx : 0;
  }, [workflowSteps, step]);

  const filteredIdentities = useMemo(() => {
    if (!identitySearch.trim()) return [];
    const rawQ = identitySearch.trim().toLowerCase();
    const cleanDigits = rawQ.replace(/\D/g, '');
    const cleanId = rawQ.replace(/\s+/g, '');
    const source = txType === 'buy' ? sellers : customers;

    return source
      .filter((c) => {
        // Name search
        if (c.fullName.toLowerCase().includes(rawQ)) return true;

        // ID number search (ignoring whitespace)
        const cIdClean = c.idNumber.replace(/\s+/g, '').toLowerCase();
        if (cIdClean.includes(cleanId)) return true;

        // Phone search (normalize SA 0XXXXXXXXX and +27XXXXXXXXX)
        if (cleanDigits.length >= 4) {
          const cPhoneDigits = c.mobile.replace(/\D/g, '');
          const qSignificant = cleanDigits.startsWith('27')
            ? cleanDigits.slice(2)
            : cleanDigits.startsWith('0')
            ? cleanDigits.slice(1)
            : cleanDigits;
          const cSignificant = cPhoneDigits.startsWith('27')
            ? cPhoneDigits.slice(2)
            : cPhoneDigits.startsWith('0')
            ? cPhoneDigits.slice(1)
            : cPhoneDigits;
          if (cSignificant.includes(qSignificant) || qSignificant.includes(cSignificant)) return true;
        }

        return false;
      })
      .slice(0, 5);
  }, [txType, customers, sellers, identitySearch]);

  // Fluid Buy ↔ Pawn Mode Switcher Handler (Preserves Common Item & Photos, Isolates Identity & Pricing)
  const handleSwitchTxType = useCallback(
    (newType: 'existing' | 'buy' | 'pawn') => {
      if (newType === txType) return;

      if (newType === 'buy' && !hasPermission('sellerAcquisitions')) {
        showToast(
          'Permission Denied',
          'Senior Cashier or higher authority required for Buy From Person acquisitions.',
          'error'
        );
        return;
      }
      if (newType === 'pawn' && !hasPermission('pawn')) {
        showToast(
          'Permission Denied',
          'Senior Cashier or higher authority required for Pawn loans.',
          'error'
        );
        return;
      }

      // Snapshot current mode state into isolated mode memory before switching
      let currentBuyIdentity = buySelectedIdentity;
      let currentPawnIdentity = pawnSelectedIdentity;
      let currentBuyOffer = buyAgreedOffer;
      let currentBuyMC = buyIsAgreedOfferFromMarketCheck;
      let currentPawnOffer = pawnAgreedOffer;
      let currentPawnMC = pawnIsAgreedOfferFromMarketCheck;

      if (txType === 'buy') {
        currentBuyIdentity = selectedIdentity as Seller | null;
        currentBuyOffer = agreedOffer;
        currentBuyMC = isAgreedOfferFromMarketCheck;
        setBuySelectedIdentity(currentBuyIdentity);
        setBuyAgreedOffer(currentBuyOffer);
        setBuyIsAgreedOfferFromMarketCheck(currentBuyMC);
      } else if (txType === 'pawn') {
        currentPawnIdentity = selectedIdentity as Customer | null;
        currentPawnOffer = agreedOffer;
        currentPawnMC = isAgreedOfferFromMarketCheck;
        setPawnSelectedIdentity(currentPawnIdentity);
        setPawnAgreedOffer(currentPawnOffer);
        setPawnIsAgreedOfferFromMarketCheck(currentPawnMC);
      }

      // Switch active txType
      setTxType(newType);

      // Restore target mode identity & financial state
      let targetIdentity: Customer | Seller | null = null;
      let targetOffer = 0;
      let targetMC = false;

      if (newType === 'buy') {
        targetIdentity = currentBuyIdentity;
        targetOffer = currentBuyOffer;
        targetMC = currentBuyMC;
      } else if (newType === 'pawn') {
        targetIdentity = currentPawnIdentity;
        targetOffer = currentPawnOffer;
        targetMC = currentPawnMC;
      }

      setSelectedIdentity(targetIdentity);
      setAgreedOffer(targetOffer);
      setIsAgreedOfferFromMarketCheck(targetMC);
      setIsCreatingIdentity(false);

      // Deterministic cross-mode step normalization
      const nextStep = normalizeStepForTransactionType(
        step,
        newType,
        targetIdentity,
        targetOffer,
        retailPriceInput
      );
      setStep(nextStep);

      const modeLabel =
        newType === 'buy' ? 'Buy From Person' : newType === 'pawn' ? 'Pawn Loan' : 'Existing Stock';

      showToast(
        `Switched to ${modeLabel}`,
        `Item details & photos preserved.${
          targetIdentity
            ? ` Restored ${newType === 'buy' ? 'seller' : 'borrower'}: ${targetIdentity.fullName}`
            : newType === 'existing'
            ? ' No identity required.'
            : ` Please select ${newType === 'buy' ? 'seller' : 'borrower'} details.`
        }`,
        'info'
      );
    },
    [
      txType,
      step,
      selectedIdentity,
      agreedOffer,
      isAgreedOfferFromMarketCheck,
      buySelectedIdentity,
      pawnSelectedIdentity,
      buyAgreedOffer,
      buyIsAgreedOfferFromMarketCheck,
      pawnAgreedOffer,
      pawnIsAgreedOfferFromMarketCheck,
      hasPermission,
      showToast,
    ]
  );

  // Handlers
  const handleSelectTxType = useCallback(
    (type: 'existing' | 'buy' | 'pawn') => {
      handleSwitchTxType(type);
    },
    [handleSwitchTxType]
  );

  const selectIdentity = useCallback(
    (identity: Customer | Seller) => {
      setSelectedIdentity(identity);
      if (txType === 'buy') {
        setBuySelectedIdentity(identity as Seller);
      } else if (txType === 'pawn') {
        setPawnSelectedIdentity(identity as Customer);
      }
      setIsCreatingIdentity(false);
      showToast(
        `Previous ${txType === 'buy' ? 'Seller' : 'Customer'} Found`,
        `Matched record: ${identity.fullName} (${
          identity.verified ? 'Verified' : 'Verification pending'
        })`,
        'info'
      );
    },
    [txType, showToast]
  );

  const handleCreateIdentity = useCallback(async () => {
    if (!newIdentity.fullName.trim()) {
      showToast('Validation Error', 'Full legal name is required.', 'error');
      const nameEl = document.getElementById('new-identity-name-input');
      if (nameEl) focusAndScrollErrorField(nameEl);
      return;
    }

    if (!newIdentity.idNumber.trim()) {
      showToast('Validation Error', 'ID or Passport number is required.', 'error');
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
        showToast(
          'Phone Validation Failed',
          phoneCheck.error || 'Please check the mobile phone number.',
          'error'
        );
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
          verified: false,
        });
        const created: Seller = {
          id,
          fullName: newIdentity.fullName.trim(),
          idNumber: newIdentity.idNumber.trim(),
          idType: newIdentity.idType,
          mobile: finalMobile,
          address: newIdentity.address.trim(),
          createdAt: new Date().toISOString(),
          verified: false,
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
          verified: false,
        });
        const created: Customer = {
          id,
          fullName: newIdentity.fullName.trim(),
          idNumber: newIdentity.idNumber.trim(),
          idType: newIdentity.idType,
          mobile: finalMobile,
          address: newIdentity.address.trim(),
          createdAt: new Date().toISOString(),
          verified: false,
        };
        setSelectedIdentity(created);
      }

      setIsCreatingIdentity(false);
      showToast(
        `${txType === 'buy' ? 'Seller' : 'Customer'} Saved`,
        `${newIdentity.fullName} (Verification pending)`,
        'info'
      );
    } catch (err: any) {
      showToast('Save Failed', formatUserFriendlyError(err?.message || 'Failed to save record.'), 'error');
    }
  }, [newIdentity, txType, addSeller, addCustomer, showToast]);

  const handleExplicitVerifyIdentity = useCallback(async () => {
    if (!selectedIdentity) return;
    if (txType === 'buy') {
      await updateSeller(selectedIdentity.id, { verified: true });
      setSelectedIdentity((prev) => (prev ? { ...prev, verified: true } : null));
      showToast(
        'Identity Verified',
        `Seller ${selectedIdentity.fullName} verified against physical ID document.`,
        'success'
      );
    } else {
      await updateCustomer(selectedIdentity.id, { verified: true });
      setSelectedIdentity((prev) => (prev ? { ...prev, verified: true } : null));
      showToast(
        'Identity Verified',
        `Customer ${selectedIdentity.fullName} verified against physical ID document.`,
        'success'
      );
    }
  }, [selectedIdentity, txType, updateSeller, updateCustomer, showToast]);

  // 1. FINALISE EXISTING STOCK (No Seller, No Customer, No SAPS Form 21, No Pawn Loan)
  const handleFinalizeExistingStock = useCallback(async () => {
    setIsFinalizing(true);
    const sku = generateUniqueSku((s) => inventory.some((i) => i.sku === s));
    const rawCost = costBasisInput.trim();
    const costBasisNum =
      rawCost !== '' && !isNaN(parseFloat(rawCost)) ? parseFloat(rawCost) : undefined;
    const retailPriceNum = parseFloat(retailPriceInput) || 0;

    await finalizeProgress.runSequence({
      title: 'Adding Stock Item',
      subtitle: `Registering ${itemData.title.trim() || 'Inventory Item'}`,
      isOffline: !isOnline,
      holdDurationMs: 0,
      steps: [
        { id: 'prep', label: 'Preparing inventory record' },
        { id: 'media', label: itemData.imageUrl ? 'Preparing photography & catalog metadata' : 'Preparing catalog metadata' },
        { id: 'pricing', label: `Applying retail price: R ${retailPriceNum.toLocaleString()}` },
        { id: 'save', label: isOnline ? 'Adding item to active inventory' : 'Saving stock item on this device' },
        { id: 'confirm', label: 'Confirming inventory save' },
        { id: 'finish', label: 'Finishing inventory intake' }
      ],
      execute: async (runner) => {
        runner.startStep('prep');
        runner.completeStep('prep');

        runner.startStep('media');
        if (itemData.imageUrl?.startsWith('data:image/') && navigator.onLine) {
          try {
            const remoteUrl = await images.waitForCurrentUpload();
            if (remoteUrl) {
              itemData.imageUrl = remoteUrl;
              setItemData((prev) => ({ ...prev, imageUrl: remoteUrl }));
            }
          } catch {
            // Keep the optimized local image
          }
        }
        runner.completeStep('media');

        runner.startStep('pricing');
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
          sourceNote:
            itemData.sourceNote || 'Item was already owned by the shop before LocalMarket onboarding',
          internalNote: itemData.internalNote.trim() || undefined,
        };
        runner.completeStep('pricing');

        runner.startStep('save');
        const itemId = await addItem(newItemPayload);

        const createdItem: InventoryItem = {
          id: itemId,
          addedAt: new Date().toISOString(),
          ...newItemPayload,
        };

        setResult({
          assetTag: sku,
          item: createdItem,
        });

        if (shopProfile?.id) {
          await drafts.closeDraft(shopProfile.id);
        }
        runner.completeStep('save');

        runner.startStep('confirm');
        runner.completeStep('confirm');

        runner.startStep('finish');
        runner.completeStep('finish');

        return createdItem;
      },
      successTitle: 'Stock Added Successfully',
      successMessage: `${itemData.title.trim()} (${sku}) is ready for ${existingStockStatus}.`,
      onSuccess: (createdItem) => {
        setStep('completion');
        setIsFinalizing(false);
      },
      onError: () => {
        setIsFinalizing(false);
      },
      onClose: () => {
        setIsFinalizing(false);
      }
    });
  }, [
    inventory,
    costBasisInput,
    retailPriceInput,
    itemData,
    existingStockStatus,
    addItem,
    shopProfile?.id,
    drafts,
    images,
    finalizeProgress,
    isOnline,
  ]);

  // 2. FINALISE BUY FROM PERSON OR PAWN (Real Identities, Compliance & Transactions)
  const handleAddToBatch = useCallback(() => {
    if (!itemData.title.trim()) {
      showToast('Title Required', 'Please enter an item title', 'amber');
      return;
    }

    const newItem: BatchItem = {
      ...itemData,
      id: crypto.randomUUID(),
      agreedOffer,
      suggestedRetail,
    };

    setBasketItems((prev) => [...prev, newItem]);

    // Reset item data for next entry
    setItemData(INITIAL_ITEM_DATA);
    setAgreedOffer(0);
    setIsAgreedOfferFromMarketCheck(false);
    setRetailPriceInput('0');
    setIsRetailPriceFromMarketCheck(false);
    const nextShelfState = getNextItemShelfState();
    setSuggestedRetail(nextShelfState.suggestedRetail);
    setIsShelfPriceEdited(nextShelfState.isShelfPriceEdited);

    showToast(
      'Item Added to Batch',
      'You can now add another item or finalize the transaction.',
      'success'
    );
    setStep('item'); // Go back to item step for next item
  }, [itemData, agreedOffer, suggestedRetail, showToast]);

  const handleFinalize = useCallback(async () => {
    if (!selectedIdentity || !txType || isFinalizing) return;
    if (txType === 'buy' && !hasPermission('sellerAcquisitions')) {
      showToast(
        'Permission Denied',
        'Senior Cashier or higher authority required for Buy From Person acquisitions.',
        'error'
      );
      return;
    }
    if (txType === 'pawn' && !hasPermission('pawn')) {
      showToast(
        'Permission Denied',
        'Senior Cashier or higher authority required for Pawn loans.',
        'error'
      );
      return;
    }
    if (!shopProfile?.id) {
      showToast(
        'Missing Shop Context',
        'Unable to complete transaction without an active shop profile.',
        'error'
      );
      return;
    }
    const currentShopId = shopProfile.id;

    setIsFinalizing(true);

    const finalBasket = [...basketItems];
    if (itemData.title.trim()) {
      finalBasket.push({
        ...itemData,
        id: crypto.randomUUID(),
        agreedOffer,
        suggestedRetail,
      });
    }

    if (finalBasket.length === 0) {
      showToast('No Items', 'Please add at least one item to the transaction', 'amber');
      setIsFinalizing(false);
      return;
    }

    if (txType === 'buy') {
      const seller = selectedIdentity as Seller;
      const totalPayout = finalBasket.reduce((sum, i) => sum + i.agreedOffer, 0);

      await finalizeProgress.runSequence({
        title: 'Completing Acquisition',
        subtitle: `Purchasing from ${seller.fullName}`,
        isOffline: !isOnline,
        holdDurationMs: 0,
        steps: [
          { id: 'prep', label: 'Preparing acquisition & tags' },
          { id: 'compliance', label: `Preparing police compliance for ${seller.fullName}` },
          { id: 'items', label: `Cataloging ${finalBasket.length} item${finalBasket.length > 1 ? 's' : ''} for retail floor` },
          { id: 'save', label: isOnline ? 'Executing acquisition transaction' : 'Saving acquisition locally' },
          { id: 'confirm', label: 'Confirming persistence' },
          { id: 'finish', label: 'Finishing transaction' }
        ],
        execute: async (runner) => {
          runner.startStep('prep');
          if (itemData.imageUrl?.startsWith('data:image/') && navigator.onLine && isSupabaseConfigured()) {
            try {
              const remoteUrl = await images.waitForCurrentUpload();
              if (remoteUrl) {
                itemData.imageUrl = remoteUrl;
                setItemData((prev) => ({ ...prev, imageUrl: remoteUrl }));
              }
            } catch {
              // Preserve local-first behavior
            }
          }
          runner.completeStep('prep');

          runner.startStep('compliance');
          const transactionId = crypto.randomUUID();
          const existingTxList = await db.sellerTransactions.where('shopId').equals(currentShopId).toArray();
          const existingTxSet = new Set(existingTxList.map((t) => t.transactionNumber));
          const transactionNumber = generateUniqueTransactionNumber((tn) => existingTxSet.has(tn));
          const nowIso = new Date().toISOString();
          const complianceStatus = seller.verified ? 'VERIFIED' : 'PENDING';
          runner.completeStep('compliance');

          runner.startStep('items');
          const inventoryItemsToAdd: InventoryItem[] = [];
          const transactionItemsToAdd: any[] = [];
          const sapsEntriesToAdd: SapsEntry[] = [];
          const rpcItemsPayload: any[] = [];

          const currentInventory = await db.inventory.where('shopId').equals(currentShopId).toArray();
          const existingSkuSet = new Set(currentInventory.map((i) => i.sku));

          for (const bItem of finalBasket) {
            const itemId = bItem.id || crypto.randomUUID();
            const sku = generateUniqueSku((s) => existingSkuSet.has(s));
            existingSkuSet.add(sku);

            const sapsId = crypto.randomUUID();
            const sapsEntryNo = `SAPS-${new Date().getFullYear()}-${sapsId.slice(0, 8).toUpperCase()}`;

            const invItem: InventoryItem = {
              id: itemId,
              shopId: currentShopId,
              sku,
              title: bItem.title,
              category: bItem.category,
              brand: bItem.brand?.trim() || undefined,
              model: bItem.model?.trim() || undefined,
              serialOrImei: bItem.serialOrImei?.trim() || 'N/A',
              condition: bItem.condition,
              acquisitionType: 'Buy',
              costBasis: bItem.agreedOffer,
              retailPrice: bItem.suggestedRetail > 0 ? bItem.suggestedRetail : 0,
              status: 'Retail Floor',
              stockLocation: 'Retail Floor',
              imageUrl: bItem.imageUrl,
              specs: [bItem.brand, bItem.model].filter(Boolean).join(' • ') || undefined,
              sourceType: 'seller',
              sourceStatus: seller.verified ? 'verified' : 'pending',
              sourceNote: `Purchased from ${seller.fullName} (${seller.idNumber})`,
              internalNote: bItem.internalNote?.trim() || undefined,
              addedAt: nowIso,
            };
            inventoryItemsToAdd.push(invItem);

            transactionItemsToAdd.push({
              id: crypto.randomUUID(),
              sellerTransactionId: transactionId,
              shopId: currentShopId,
              itemId,
              itemSku: sku,
              itemTitle: bItem.title,
              amountPaid: bItem.agreedOffer,
              retailPrice: bItem.suggestedRetail > 0 ? bItem.suggestedRetail : 0,
              serialOrImei: bItem.serialOrImei?.trim() || 'N/A',
              condition: bItem.condition,
              createdAt: nowIso,
            });

            sapsEntriesToAdd.push({
              id: sapsId,
              shopId: currentShopId,
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
              verificationStatus: complianceStatus as any,
              barcodeRef: sku,
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
              retail_price: bItem.suggestedRetail > 0 ? bItem.suggestedRetail : null,
              image_url: bItem.imageUrl,
              specs: [bItem.brand, bItem.model].filter(Boolean).join(' • ') || null,
              stock_location: 'Retail Floor',
              internal_note: bItem.internalNote?.trim() || null,
              saps_entry_id: sapsId,
              saps_entry_number: sapsEntryNo,
            });
          }

          const txRecord = {
            id: transactionId,
            shopId: currentShopId,
            sellerId: seller.id,
            transactionNumber,
            totalProposedPayout: totalPayout,
            totalApprovedPayout: totalPayout,
            paymentStatus: 'Paid' as const,
            status: 'Acquired' as const,
            complianceStatus: complianceStatus as any,
            timestamp: nowIso,
            items: transactionItemsToAdd,
            sapsRef: transactionNumber,
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
            shopId: currentShopId,
          };

          runner.completeStep('items');

          runner.startStep('save');
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
                  return (
                    lower.includes('failed to fetch') ||
                    lower.includes('network') ||
                    lower.includes('timeout') ||
                    lower.includes('aborted')
                  );
                };

                if (!isNetworkError(rpcRes.error)) {
                  throw new Error(rpcRes.error || 'Server rejected acquisition.');
                }
                console.warn(
                  'Network timeout during buy acquisition, saving locally for offline sync:',
                  rpcRes.error
                );
              }
            } catch (err: any) {
              if (err?.message && !err.message.toLowerCase().includes('network') && !err.message.toLowerCase().includes('fetch')) {
                throw err;
              }
              console.warn(
                'Network error during online buy acquisition, saving locally for offline sync:',
                err?.message
              );
            }
          }

          // 2. ATOMIC LOCAL DEXIE COMMIT
          await db.transaction(
            'rw',
            [db.inventory, db.sellerTransactions, db.sellerTransactionItems, db.saps, db.syncLogs],
            async () => {
              await db.inventory.bulkAdd(inventoryItemsToAdd);
              await db.sellerTransactionItems.bulkAdd(transactionItemsToAdd);
              await db.sellerTransactions.add(txRecord);
              await db.saps.bulkAdd(sapsEntriesToAdd);

              await db.syncLogs.add({
                shopId: currentShopId,
                entityType: 'buyAcquisition',
                entityId: transactionId,
                action: 'create',
                payload: buyPayload,
                status: syncLogStatus,
                syncedAt,
                createdAt: nowIso,
                retryCount: 0,
              });
            }
          );

          runner.completeStep('save');

          runner.startStep('confirm');
          if (syncLogStatus === 'completed') {
            runner.updateStepDetail('confirm', 'Acquisition confirmed on server');
          } else {
            runner.updateStepDetail('confirm', 'Saved on this computer · Cloud sync queued');
          }
          runner.completeStep('confirm');

          runner.startStep('finish');
          setResult({
            assetTag: transactionNumber,
            item: { title: `${finalBasket.length} Items`, sku: transactionNumber } as any,
          });

          await drafts.closeDraft(currentShopId);
          runner.completeStep('finish');

          return { transactionNumber, syncLogStatus, count: finalBasket.length };
        },
        successTitle: (res) => (res?.syncLogStatus === 'completed' ? 'Purchase Completed' : 'Saved on This Computer'),
        successMessage: (res) => (res?.syncLogStatus === 'completed'
          ? `Acquired ${finalBasket.length} item${finalBasket.length > 1 ? 's' : ''} from ${seller.fullName}.`
          : `Acquisition saved on this computer. Cloud sync queued.`),
        onSuccess: (res) => {
          setStep('completion');
          setIsFinalizing(false);
        },
        onError: () => {
          setIsFinalizing(false);
        },
        onClose: () => {
          setIsFinalizing(false);
        }
      });
      return;
    }

    if (txType === 'pawn' && pawnCalculations) {
      const pCustomer = selectedIdentity as Customer;

      await finalizeProgress.runSequence({
        title: 'Finalizing Pawn Loan',
        subtitle: `Intake for ${pCustomer.fullName}`,
        isOffline: !isOnline,
        holdDurationMs: 0,
        steps: [
          { id: 'prep', label: 'Preparing loan agreement & vault tag' },
          { id: 'ncr', label: 'Applying business calculations & NCR rates' },
          { id: 'vault', label: `Allocating vault shelf: ${businessRules.defaultVaultShelf}` },
          { id: 'save', label: isOnline ? 'Executing pawn transaction' : 'Saving loan locally on this device' },
          { id: 'confirm', label: 'Confirming persistence' },
          { id: 'finish', label: 'Finishing pawn contract' }
        ],
        execute: async (runner) => {
          runner.startStep('prep');
          if (itemData.imageUrl?.startsWith('data:image/') && navigator.onLine && isSupabaseConfigured()) {
            try {
              const remoteUrl = await images.waitForCurrentUpload();
              if (remoteUrl) {
                itemData.imageUrl = remoteUrl;
                setItemData((prev) => ({ ...prev, imageUrl: remoteUrl }));
              }
            } catch {
              // Preserve local-first behavior
            }
          }
          const allLoans = await db.loans.where('shopId').equals(currentShopId).toArray();
          const ticketNumber = generateUniquePawnTicket((t) => allLoans.some((l) => l.ticketNumber === t));
          const currentInventory = await db.inventory.where('shopId').equals(currentShopId).toArray();
          const sku = generateUniqueSku((s) => currentInventory.some((i) => i.sku === s));

          const loanId = crypto.randomUUID();
          const itemId = crypto.randomUUID();
          const sapsId = crypto.randomUUID();
          const sapsEntryNo = `SAPS-${new Date().getFullYear()}-${sapsId.slice(0, 8).toUpperCase()}`;
          const qrToken = `TKN-${loanId.slice(0, 8).toUpperCase()}`;
          const verificationStatus = pCustomer.verified ? 'VERIFIED' : 'PENDING';
          const nowIso = new Date().toISOString();

          // Enforce shop pawn lending limits (minimum and optional maximum)
          const minPrincipal = businessRules.minLoanPrincipal || 100;
          if (agreedOffer < minPrincipal) {
            showToast(
              'Below Minimum Loan',
              `Minimum pawn amount is R ${minPrincipal.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`,
              'amber'
            );
            return;
          }

          if (businessRules.maxLoanPrincipal && businessRules.maxLoanPrincipal > 0 && agreedOffer > businessRules.maxLoanPrincipal) {
            showToast(
              'Above this shop’s pawn limit',
              `Maximum pawn amount: R ${businessRules.maxLoanPrincipal.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`,
              'amber'
            );
            return;
          }

          runner.completeStep('prep');

          runner.startStep('ncr');
          const invItem: InventoryItem = {
            id: itemId,
            shopId: currentShopId,
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
            addedAt: nowIso,
          };

          const loanRecord: PawnLoan = {
            id: loanId,
            shopId: currentShopId,
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
            history: [
              {
                date: nowIso,
                action: 'Created',
                amount: agreedOffer,
                note: 'Pawn loan initiated',
              },
            ],
          };
          runner.completeStep('ncr');

          runner.startStep('vault');
          const sapsRecord: SapsEntry = {
            id: sapsId,
            shopId: currentShopId,
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
            barcodeRef: sku,
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
            shopId: currentShopId,
          };
          runner.completeStep('vault');

          runner.startStep('save');
          let syncLogStatus: 'completed' | 'pending' = 'pending';
          let syncedAt: string | undefined = undefined;

          // 1. ATOMIC SERVER RPC FIRST IF ONLINE
          if (isSupabaseConfigured() && navigator.onLine) {
            try {
              const rpcRes = await pawnLoansApi.completePawnIntakeRpc(pawnPayload);
              if (rpcRes.success) {
                syncLogStatus = 'completed';
                syncedAt = new Date().toISOString();
                if (rpcRes.data) {
                  const serverLoan = Array.isArray(rpcRes.data) ? rpcRes.data[0] : rpcRes.data;
                  if (serverLoan && typeof serverLoan === 'object') {
                    if (serverLoan.monthly_interest !== undefined && serverLoan.monthly_interest !== null) {
                      loanRecord.monthlyInterest = Number(serverLoan.monthly_interest);
                    }
                    if (
                      serverLoan.monthly_storage_admin_fee !== undefined &&
                      serverLoan.monthly_storage_admin_fee !== null
                    ) {
                      loanRecord.monthlyStorageAdminFee = Number(serverLoan.monthly_storage_admin_fee);
                    }
                    if (
                      serverLoan.total_redemption_amount !== undefined &&
                      serverLoan.total_redemption_amount !== null
                    ) {
                      loanRecord.totalRedemptionAmount = Number(serverLoan.total_redemption_amount);
                    }
                    if (serverLoan.expiry_date) {
                      loanRecord.expiryDate = String(serverLoan.expiry_date);
                    }
                    if (
                      serverLoan.days_remaining !== undefined &&
                      serverLoan.days_remaining !== null
                    ) {
                      loanRecord.daysRemaining = Number(serverLoan.days_remaining);
                    }
                  }
                }
              } else {
                const isNetworkError = (msg?: string) => {
                  if (!msg) return false;
                  const lower = msg.toLowerCase();
                  return (
                    lower.includes('failed to fetch') ||
                    lower.includes('network') ||
                    lower.includes('timeout') ||
                    lower.includes('aborted')
                  );
                };

                if (!isNetworkError(rpcRes.error)) {
                  throw new Error(rpcRes.error || 'Server rejected pawn intake.');
                }
                console.warn(
                  'Network timeout during pawn intake, saving locally for offline sync:',
                  rpcRes.error
                );
              }
            } catch (err: any) {
              if (err?.message && !err.message.toLowerCase().includes('network') && !err.message.toLowerCase().includes('fetch')) {
                throw err;
              }
              console.warn(
                'Network error during online pawn intake, saving locally for offline sync:',
                err?.message
              );
            }
          }

          // 2. ATOMIC LOCAL DEXIE COMMIT
          await db.transaction('rw', [db.inventory, db.loans, db.saps, db.syncLogs], async () => {
            await db.inventory.add(invItem);
            await db.loans.add(loanRecord);
            await db.saps.add(sapsRecord);

            await db.syncLogs.add({
              shopId: currentShopId,
              entityType: 'pawnIntake',
              entityId: loanId,
              action: 'create',
              payload: pawnPayload,
              status: syncLogStatus,
              syncedAt,
              createdAt: nowIso,
              retryCount: 0,
            });
          });

          runner.completeStep('save');

          runner.startStep('confirm');
          if (syncLogStatus === 'completed') {
            runner.updateStepDetail('confirm', 'Pawn agreement confirmed on server');
          } else {
            runner.updateStepDetail('confirm', 'Saved on this computer · Cloud sync queued');
          }
          runner.completeStep('confirm');

          runner.startStep('finish');
          setResult({
            assetTag: sku,
            ticketNumber,
            item: { id: itemId, title: itemData.title, sku } as any,
            loan: { id: loanId, ticketNumber } as any,
          });

          await drafts.closeDraft(currentShopId);
          runner.completeStep('finish');

          return { ticketNumber, syncLogStatus };
        },
        successTitle: (res) => (res?.syncLogStatus === 'completed' ? 'Pawn Loan Registered' : 'Saved on This Computer'),
        successMessage: (res) => (res?.syncLogStatus === 'completed'
          ? `Pawn Ticket created for ${pCustomer.fullName}.`
          : `Loan saved on this computer. Cloud sync queued.`),
        onSuccess: () => {
          setStep('completion');
          setIsFinalizing(false);
        },
        onError: () => {
          setIsFinalizing(false);
        },
        onClose: () => {
          setIsFinalizing(false);
        }
      });
    }
  }, [
    selectedIdentity,
    txType,
    isFinalizing,
    hasPermission,
    shopProfile?.id,
    shopProfile?.saps_dealer_license,
    basketItems,
    itemData,
    agreedOffer,
    suggestedRetail,
    user,
    drafts,
    images,
    pawnCalculations,
    businessRules,
    finalizeProgress,
    isOnline,
    showToast,
  ]);

  const handleNext = useCallback(() => {
    if (step === 'mode') {
      return;
    }

    if (step === 'customer') {
      if (!selectedIdentity) {
        showToast(
          `${txType === 'buy' ? 'Seller' : 'Customer'} Required`,
          `Please select or create a ${
            txType === 'buy' ? 'seller' : 'customer'
          } record before proceeding`,
          'amber'
        );
        return;
      }
      if (txType === 'buy') {
        // Seller captured -> proceed to Final Review
        setStep('deal');
      } else {
        // Borrower captured -> proceed to Collateral Item
        setStep('item');
      }
      return;
    }

    if (step === 'item') {
      if (!itemData.title.trim()) {
        showToast('Title Required', 'Please enter an item description or title', 'amber');
        const titleEl = document.getElementById('item-title-input');
        if (titleEl) focusAndScrollErrorField(titleEl);
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

      setStep('valuation');
      return;
    }

    if (step === 'valuation') {
      if (txType === 'existing') {
        const retailVal = parseFloat(retailPriceInput);
        if (isNaN(retailVal) || retailVal <= 0) {
          showToast('Invalid Price', 'Please enter a valid retail selling price', 'amber');
          const pEl = document.getElementById('valuation-retail-price-input');
          if (pEl) focusAndScrollErrorField(pEl);
          return;
        }
        setStep('location');
      } else if (txType === 'buy') {
        if (agreedOffer <= 0) {
          showToast('Amount Required', 'Please enter the negotiated payout amount', 'amber');
          const oEl = document.getElementById('valuation-agreed-offer-input');
          if (oEl) focusAndScrollErrorField(oEl);
          return;
        }
        // Item & Price evaluated -> proceed to Seller Identity capture
        setStep('customer');
      } else {
        if (agreedOffer <= 0) {
          showToast('Amount Required', 'Please enter the agreed loan principal', 'amber');
          const oEl = document.getElementById('valuation-agreed-offer-input');
          if (oEl) focusAndScrollErrorField(oEl);
          return;
        }

        if (txType === 'pawn') {
          const minPrincipal = businessRules.minLoanPrincipal || 100;
          if (agreedOffer < minPrincipal) {
            showToast(
              'Below Minimum Loan',
              `Minimum pawn amount is R ${minPrincipal.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`,
              'amber'
            );
            const oEl = document.getElementById('valuation-agreed-offer-input');
            if (oEl) focusAndScrollErrorField(oEl);
            return;
          }

          if (businessRules.maxLoanPrincipal && businessRules.maxLoanPrincipal > 0 && agreedOffer > businessRules.maxLoanPrincipal) {
            showToast(
              'Above this shop’s pawn limit',
              `Maximum pawn amount: R ${businessRules.maxLoanPrincipal.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`,
              'amber'
            );
            const oEl = document.getElementById('valuation-agreed-offer-input');
            if (oEl) focusAndScrollErrorField(oEl);
            return;
          }
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
  }, [
    step,
    selectedIdentity,
    txType,
    itemData,
    duplicateSerialMatch,
    retailPriceInput,
    agreedOffer,
    businessRules,
    handleFinalizeExistingStock,
    showToast,
  ]);

  const handleBack = useCallback(() => {
    if (step === 'customer') {
      if (txType === 'buy') {
        // Back from seller identity goes to valuation
        setStep('valuation');
      } else {
        // Back from borrower identity goes to intake mode
        setStep('mode');
        setTxType(null);
      }
    } else if (step === 'item') {
      if (txType === 'existing' || txType === 'buy') {
        // Back from item details goes to intake mode
        setStep('mode');
        setTxType(null);
      } else {
        // Back from pawn item details goes to borrower identity
        setStep('customer');
      }
    } else if (step === 'valuation') {
      setStep('item');
    } else if (step === 'location') {
      setStep('valuation');
    } else if (step === 'deal') {
      if (txType === 'buy') {
        setStep('customer');
      } else {
        setStep('valuation');
      }
    }
  }, [step, txType]);

  const resetWorkflow = useCallback(() => {
    drafts.setDraftId(crypto.randomUUID());
    setStep('mode');
    setTxType(null);
    setSelectedIdentity(null);
    setBuySelectedIdentity(null);
    setPawnSelectedIdentity(null);
    setIsCreatingIdentity(false);
    setAgreedOffer(0);
    setBuyAgreedOffer(0);
    setPawnAgreedOffer(0);
    setIsAgreedOfferFromMarketCheck(false);
    setBuyIsAgreedOfferFromMarketCheck(false);
    setPawnIsAgreedOfferFromMarketCheck(false);
    setCostBasisInput('');
    setRetailPriceInput('0');
    setIsRetailPriceFromMarketCheck(false);
    setSuggestedRetail(0);
    setIsShelfPriceEdited(false);
    setExistingStockStatus('Retail Floor');
    setResult(null);
    setBasketItems([]);
    setItemData(INITIAL_ITEM_DATA);
    images.resetImages();
    marketCheck.resetMarketCheck();
  }, [drafts, images, marketCheck]);

  return {
    // State
    step,
    setStep,
    txType,
    basketItems,
    isFinalizing,
    identitySearch,
    setIdentitySearch,
    selectedIdentity,
    setSelectedIdentity,
    buySelectedIdentity,
    pawnSelectedIdentity,
    buyAgreedOffer,
    pawnAgreedOffer,
    isCreatingIdentity,
    setIsCreatingIdentity,
    newIdentity,
    setNewIdentity,
    itemData,
    setItemData,
    agreedOffer,
    setAgreedOffer,
    isAgreedOfferFromMarketCheck,
    setIsAgreedOfferFromMarketCheck,
    costBasisInput,
    setCostBasisInput,
    retailPriceInput,
    setRetailPriceInput,
    isRetailPriceFromMarketCheck,
    setIsRetailPriceFromMarketCheck,
    suggestedRetail,
    setSuggestedRetail,
    isShelfPriceEdited,
    setIsShelfPriceEdited,
    existingStockStatus,
    setExistingStockStatus,
    result,
    pawnCalculations,
    duplicateSerialMatch,
    workflowSteps,
    currentStepIndex,
    filteredIdentities,

    // Sub-hook states & actions
    images,
    drafts,
    marketCheck,

    // Context & Rules
    businessRules,
    hasPermission,
    showToast,
    setActiveContractModal,
    finalizeProgress,

    // Workflow actions
    actions: {
      selectTxType: handleSelectTxType,
      switchTxType: handleSwitchTxType,
      next: handleNext,
      back: handleBack,
      selectIdentity,
      createIdentity: handleCreateIdentity,
      explicitVerifyIdentity: handleExplicitVerifyIdentity,
      clearSelectedIdentity: () => {
        setSelectedIdentity(null);
        if (txType === 'buy') setBuySelectedIdentity(null);
        if (txType === 'pawn') setPawnSelectedIdentity(null);
      },
      addToBatch: handleAddToBatch,
      finalizeExistingStock: handleFinalizeExistingStock,
      finalize: handleFinalize,
      reset: resetWorkflow,
    },
  };
}
