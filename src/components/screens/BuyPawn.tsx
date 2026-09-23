import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useInventory } from '../../context/InventoryContext';
import { useLoans } from '../../context/LoanContext';
import { useCustomers } from '../../context/CustomerContext';
import { useSellers } from '../../context/SellerContext';
import { useSaps } from '../../context/SapsContext';
import { ItemCondition, InventoryItem, PawnLoan, Customer, Seller, ItemStatus } from '../../types';
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
  TrendingUp,
  History,
  Package,
  MapPin,
  Tag,
  AlertTriangle
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
  const { showToast, businessRules, shopProfile, setActiveContractModal } = useApp();
  const { user } = useAuth();
  const { addItem, inventory } = useInventory();
  const { createLoan } = useLoans();
  const { customers, addCustomer } = useCustomers();
  const { sellers, addSeller, addSellerTransaction } = useSellers();
  const { addSapsEntry } = useSaps();

  // Primary Workflow State
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

  // Multi-item Batch state for Outright Buys
  const [buyBatchItems, setBuyBatchItems] = useState<Array<{
    tempId: string;
    title: string;
    category: InventoryItem['category'];
    brand?: string;
    model?: string;
    serialOrImei: string;
    condition: ItemCondition;
    costBasis: number;
    retailPrice: number;
    imageUrl: string;
    internalNote?: string;
  }>>([]);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'eft' | 'card'>('cash');
  const [paymentStatus, setPaymentStatus] = useState<'Proposed' | 'Approved' | 'Paid' | 'Acquired'>('Acquired');

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

  // Completion Result State
  const [result, setResult] = useState<{
    assetTag: string;
    ticketNumber?: string;
    transactionNumber?: string;
    item: InventoryItem;
    batchItems?: InventoryItem[];
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
    showToast(`${txType === 'buy' ? 'Seller' : 'Customer'} Selected`, identity.fullName, 'success');
  };

  const handleCreateIdentity = async () => {
    if (!newIdentity.fullName.trim() || !newIdentity.idNumber.trim()) {
      showToast('Validation Error', 'Full name and ID number are required', 'error');
      return;
    }

    if (txType === 'buy') {
      const id = await addSeller({
        fullName: newIdentity.fullName.trim(),
        idNumber: newIdentity.idNumber.trim(),
        idType: newIdentity.idType,
        mobile: newIdentity.mobile.trim(),
        address: newIdentity.address.trim(),
        verified: true
      });
      const created: Seller = {
        id,
        fullName: newIdentity.fullName.trim(),
        idNumber: newIdentity.idNumber.trim(),
        idType: newIdentity.idType,
        mobile: newIdentity.mobile.trim(),
        address: newIdentity.address.trim(),
        createdAt: new Date().toISOString(),
        verified: true
      };
      setSelectedIdentity(created);
    } else {
      // Pawn customer: honest values without fake DOB or fake gender
      const id = await addCustomer({
        fullName: newIdentity.fullName.trim(),
        idNumber: newIdentity.idNumber.trim(),
        idType: newIdentity.idType,
        mobile: newIdentity.mobile.trim(),
        address: newIdentity.address.trim(),
        verified: true
      });
      const created: Customer = {
        id,
        fullName: newIdentity.fullName.trim(),
        idNumber: newIdentity.idNumber.trim(),
        idType: newIdentity.idType,
        mobile: newIdentity.mobile.trim(),
        address: newIdentity.address.trim(),
        createdAt: new Date().toISOString(),
        verified: true
      };
      setSelectedIdentity(created);
    }

    setIsCreatingIdentity(false);
    showToast(`${txType === 'buy' ? 'Seller' : 'Customer'} Created`, newIdentity.fullName, 'success');
  };

  // 1. FINALISE EXISTING STOCK (No Seller, No Customer, No SAPS Form 21, No Pawn Loan)
  const handleFinalizeExistingStock = async () => {
    const sku = `LM-${Math.floor(Math.random() * 90000 + 10000)}`;
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

  const handleAddItemToBatch = () => {
    if (!itemData.title.trim()) {
      showToast('Title Required', 'Please enter a description for this item before adding to batch', 'amber');
      return;
    }

    if (agreedOffer <= 0) {
      showToast('Offer Required', 'Please specify a negotiated offer amount for this item', 'amber');
      return;
    }

    const newItem = {
      tempId: crypto.randomUUID(),
      title: itemData.title.trim(),
      category: itemData.category,
      brand: itemData.brand.trim() || undefined,
      model: itemData.model.trim() || undefined,
      serialOrImei: itemData.serialOrImei.trim() || 'N/A',
      condition: itemData.condition,
      costBasis: agreedOffer,
      retailPrice: suggestedRetail || Math.round(agreedOffer * 1.8),
      imageUrl: itemData.imageUrl,
      internalNote: itemData.internalNote.trim() || undefined
    };

    setBuyBatchItems(prev => [...prev, newItem]);
    showToast('Item Added to Batch', `${newItem.title} added (Total: ${buyBatchItems.length + 1} items)`, 'success');

    // Reset item input for next item
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
      sourceNote: `Purchased from ${selectedIdentity?.fullName}`
    });
    setAgreedOffer(0);
    setSuggestedRetail(0);
    setStep('item');
  };

  const handleRemoveBatchItem = (tempId: string) => {
    setBuyBatchItems(prev => prev.filter(i => i.tempId !== tempId));
    showToast('Item Removed', 'Item removed from current batch', 'info');
  };

  // 2. FINALISE BUY FROM PERSON OR PAWN (Real Identities, Compliance & Transactions)
  const handleFinalize = async () => {
    if (!selectedIdentity || !txType) return;

    if (txType === 'buy') {
      const seller = selectedIdentity as Seller;

      // Consolidate all items to be acquired
      let itemsToAcquire = [...buyBatchItems];
      if (itemData.title.trim() && agreedOffer > 0) {
        itemsToAcquire.push({
          tempId: 'current',
          title: itemData.title.trim(),
          category: itemData.category,
          brand: itemData.brand.trim() || undefined,
          model: itemData.model.trim() || undefined,
          serialOrImei: itemData.serialOrImei.trim() || 'N/A',
          condition: itemData.condition,
          costBasis: agreedOffer,
          retailPrice: suggestedRetail || Math.round(agreedOffer * 1.8),
          imageUrl: itemData.imageUrl,
          internalNote: itemData.internalNote.trim() || undefined
        });
      }

      if (itemsToAcquire.length === 0) {
        showToast('No Items in Batch', 'Please add at least one item to this purchase batch', 'error');
        return;
      }

      const parentTxNumber = `ST-${Math.floor(Math.random() * 900000 + 100000)}`;
      const timestamp = new Date().toISOString();
      const totalPayout = itemsToAcquire.reduce((sum, i) => sum + i.costBasis, 0);

      const createdInventoryItems: InventoryItem[] = [];
      const sellerTxItems: any[] = [];

      for (const itemDraft of itemsToAcquire) {
        const sku = `LM-${Math.floor(Math.random() * 90000 + 10000)}`;

        const itemId = await addItem({
          sku,
          title: itemDraft.title,
          category: itemDraft.category,
          brand: itemDraft.brand,
          model: itemDraft.model,
          serialOrImei: itemDraft.serialOrImei,
          condition: itemDraft.condition,
          acquisitionType: 'Buy',
          costBasis: itemDraft.costBasis,
          retailPrice: itemDraft.retailPrice,
          status: 'Retail Floor',
          stockLocation: 'Retail Floor',
          imageUrl: itemDraft.imageUrl,
          specs: [itemDraft.brand, itemDraft.model].filter(Boolean).join(' • ') || undefined,
          sourceType: 'seller',
          sourceStatus: 'verified',
          sourceNote: `Purchased from ${seller.fullName} (${seller.idNumber}) via Batch ${parentTxNumber}`,
          internalNote: itemDraft.internalNote
        });

        const createdItem: InventoryItem = {
          id: itemId,
          sku,
          title: itemDraft.title,
          category: itemDraft.category,
          brand: itemDraft.brand,
          model: itemDraft.model,
          serialOrImei: itemDraft.serialOrImei,
          condition: itemDraft.condition,
          acquisitionType: 'Buy',
          costBasis: itemDraft.costBasis,
          retailPrice: itemDraft.retailPrice,
          status: 'Retail Floor',
          stockLocation: 'Retail Floor',
          imageUrl: itemDraft.imageUrl,
          specs: [itemDraft.brand, itemDraft.model].filter(Boolean).join(' • ') || undefined,
          sourceType: 'seller',
          sourceStatus: 'verified',
          addedAt: timestamp
        };

        createdInventoryItems.push(createdItem);

        // Record SAPS Form 21 Entry for each individual item
        await addSapsEntry({
          timestamp,
          customerId: seller.id,
          customerName: seller.fullName,
          customerIdNumber: seller.idNumber,
          customerAddress: seller.address,
          customerPhone: seller.mobile,
          itemDescription: itemDraft.title,
          category: itemDraft.category,
          serialOrImei: itemDraft.serialOrImei,
          condition: itemDraft.condition,
          acquisitionType: 'Buy',
          considerationPaid: itemDraft.costBasis,
          officerName: user?.user_metadata?.full_name || 'System Operator',
          policeStationRef: shopProfile.saps_dealer_license,
          verificationStatus: 'VERIFIED',
          barcodeRef: sku
        });

        sellerTxItems.push({
          itemId,
          itemSku: sku,
          itemTitle: itemDraft.title,
          category: itemDraft.category,
          brand: itemDraft.brand,
          model: itemDraft.model,
          serialOrImei: itemDraft.serialOrImei,
          condition: itemDraft.condition,
          costBasis: itemDraft.costBasis,
          retailPrice: itemDraft.retailPrice,
          sapsRef: sku,
          status: 'Acquired'
        });
      }

      // Record Consolidated Parent Seller Transaction
      await addSellerTransaction({
        transactionNumber: parentTxNumber,
        sellerId: seller.id,
        sellerName: seller.fullName,
        sellerIdNumber: seller.idNumber,
        sellerMobile: seller.mobile,
        staffId: user?.id,
        staffName: user?.user_metadata?.full_name || 'Cashier',
        items: sellerTxItems,
        itemId: createdInventoryItems[0].id,
        itemSku: createdInventoryItems[0].sku,
        itemTitle: createdInventoryItems.length > 1
          ? `${createdInventoryItems[0].title} (+${createdInventoryItems.length - 1} more items)`
          : createdInventoryItems[0].title,
        amountPaid: totalPayout,
        totalProposedPayout: totalPayout,
        totalApprovedPayout: totalPayout,
        paymentStatus: 'Acquired',
        paymentMethod: paymentMethod,
        paidAt: timestamp,
        timestamp,
        sapsRef: parentTxNumber
      });

      setResult({
        assetTag: createdInventoryItems[0].sku,
        transactionNumber: parentTxNumber,
        item: createdInventoryItems[0],
        batchItems: createdInventoryItems
      });

      setStep('completion');
      showToast('Batch Purchase Complete', `${createdInventoryItems.length} item(s) acquired under ${parentTxNumber}`, 'success');
      return;
    }

    if (txType === 'pawn' && pawnCalculations) {
      const pCustomer = selectedIdentity as Customer;
      const ticketNumber = `PWN-${Math.floor(Math.random() * 9000 + 1000)}`;

      const itemId = await addItem({
        sku,
        title: itemData.title,
        category: itemData.category,
        brand: itemData.brand || undefined,
        model: itemData.model || undefined,
        serialOrImei: itemData.serialOrImei || 'N/A',
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
        sourceStatus: 'verified',
        sourceNote: `Pawned by ${pCustomer.fullName} under Ticket ${ticketNumber}`,
        internalNote: itemData.internalNote || undefined
      });

      const loanId = await createLoan({
        ticketNumber,
        customerId: pCustomer.id,
        customerName: pCustomer.fullName,
        customerIdNumber: pCustomer.idNumber,
        customerMobile: pCustomer.mobile,
        customerAddress: pCustomer.address,
        itemId: itemId,
        itemTitle: itemData.title,
        itemCategory: itemData.category,
        serialOrImei: itemData.serialOrImei || 'N/A',
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
          note: 'Pawn loan initiated'
        }]
      });

      const item: InventoryItem = {
        id: itemId,
        sku,
        title: itemData.title,
        category: itemData.category,
        serialOrImei: itemData.serialOrImei || 'N/A',
        condition: itemData.condition,
        acquisitionType: 'Pawn',
        costBasis: agreedOffer,
        retailPrice: Math.round(agreedOffer * 1.85),
        status: 'Vault Hold',
        vaultLocation: businessRules.defaultVaultShelf,
        stockLocation: businessRules.defaultVaultShelf,
        pawnTicketId: ticketNumber,
        imageUrl: itemData.imageUrl,
        addedAt: new Date().toISOString()
      };

      const loan: PawnLoan = {
        ...pawnCalculations,
        id: loanId,
        ticketNumber,
        customerId: pCustomer.id,
        customerName: pCustomer.fullName,
        customerIdNumber: pCustomer.idNumber,
        customerMobile: pCustomer.mobile,
        customerAddress: pCustomer.address,
        itemId,
        itemTitle: itemData.title,
        itemCategory: itemData.category,
        serialOrImei: itemData.serialOrImei || 'N/A',
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
        history: []
      };

      // Statutory SAPS Form 21 Entry
      await addSapsEntry({
        timestamp: new Date().toISOString(),
        customerId: pCustomer.id,
        customerName: pCustomer.fullName,
        customerIdNumber: pCustomer.idNumber,
        customerAddress: pCustomer.address,
        customerPhone: pCustomer.mobile,
        itemDescription: itemData.title,
        category: itemData.category,
        serialOrImei: itemData.serialOrImei || 'N/A',
        condition: itemData.condition,
        acquisitionType: 'Pawn',
        considerationPaid: agreedOffer,
        officerName: user?.user_metadata?.full_name || 'System Operator',
        policeStationRef: shopProfile.saps_dealer_license,
        verificationStatus: 'VERIFIED',
        barcodeRef: sku
      });

      setResult({
        assetTag: sku,
        ticketNumber,
        item,
        loan
      });

      setStep('completion');
      showToast('Pawn Finalized', `Ticket ${ticketNumber} created and asset vaulted`, 'success');
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
                      className="w-full py-3 bg-[#C85A32] text-white rounded-xl font-semibold text-xs hover:bg-[#A94725] transition shadow-xs"
                    >
                      Save & Verify Identity
                    </button>
                  </div>
                )}

                {/* SELECTED IDENTITY DISPLAY */}
                {selectedIdentity && (
                  <div className="space-y-4">
                    <div className="p-5 rounded-2xl bg-white border-2 border-emerald-500/40 shadow-xs flex items-center justify-between">
                      <div className="flex items-center gap-3.5">
                        <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                          <CheckCircle2 className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wider bg-emerald-50 px-2 py-0.5 rounded">
                              Verified {txType === 'buy' ? 'Seller' : 'Customer'}
                            </span>
                          </div>
                          <h4 className="text-base font-bold text-gray-900 mt-0.5">{selectedIdentity.fullName}</h4>
                          <p className="text-xs text-gray-500 font-mono">{selectedIdentity.idNumber} · {selectedIdentity.mobile}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedIdentity(null)}
                        className="text-xs text-gray-500 hover:text-gray-900 font-semibold"
                      >
                        Change
                      </button>
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

                <div className="flex items-center justify-between gap-3 pt-2">
                  <button
                    onClick={handleBack}
                    className="flex items-center gap-1.5 px-5 py-3 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-100 transition text-xs font-semibold"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Back</span>
                  </button>

                  <div className="flex items-center gap-3">
                    {txType === 'buy' && (
                      <button
                        type="button"
                        onClick={handleAddItemToBatch}
                        className="py-3 px-5 rounded-xl border-2 border-[#C85A32] text-[#C85A32] hover:bg-[#FDF0EA] text-xs font-bold transition flex items-center gap-2 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add Item &amp; Continue Batch</span>
                      </button>
                    )}

                    <button
                      onClick={handleNext}
                      className="py-3 px-6 bg-[#C85A32] text-white rounded-xl font-semibold text-xs flex items-center justify-center gap-2 shadow-xs hover:bg-[#A94725] transition"
                    >
                      <span>{txType === 'existing' ? 'Choose Stock Location' : 'Review Deal Terms'}</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
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
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Final Deal Review</h3>
                    <p className="text-xs text-gray-500">
                      {txType === 'buy'
                        ? 'Verify batch payout & payment method before recording to SAPS Form 21 register'
                        : 'Verify transaction terms before recording to SAPS Form 21 register'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="p-6 rounded-2xl bg-white border border-gray-200 shadow-xs space-y-4">
                    <div className="space-y-2 text-xs divide-y divide-gray-100">
                      <div className="flex justify-between py-1.5">
                        <span className="text-gray-500">Transaction Type</span>
                        <span className="font-semibold text-gray-900">
                          {txType === 'buy' ? 'Direct Purchase (Seller Batch)' : '30-Day Pawn Loan'}
                        </span>
                      </div>
                      <div className="flex justify-between py-1.5">
                        <span className="text-gray-500">{txType === 'buy' ? 'Seller' : 'Customer'}</span>
                        <span className="font-semibold text-gray-900">{selectedIdentity?.fullName}</span>
                      </div>
                      <div className="flex justify-between py-1.5">
                        <span className="text-gray-500">ID Number</span>
                        <span className="font-mono font-medium text-gray-800">{selectedIdentity?.idNumber}</span>
                      </div>
                    </div>

                    {/* ITEMS IN BATCH LIST */}
                    {txType === 'buy' ? (
                      <div className="space-y-3 pt-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                            Acquisition Batch Items ({buyBatchItems.length + (itemData.title ? 1 : 0)})
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              if (itemData.title) {
                                handleAddItemToBatch();
                              } else {
                                setStep('item');
                              }
                            }}
                            className="text-[11px] text-[#C85A32] hover:underline font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add Another Item</span>
                          </button>
                        </div>

                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                          {buyBatchItems.map((item, idx) => (
                            <div key={item.tempId} className="p-2.5 bg-gray-50 rounded-xl border border-gray-200 text-xs flex items-center justify-between">
                              <div>
                                <span className="font-bold text-gray-900">#{idx + 1} {item.title}</span>
                                <div className="text-[10px] text-gray-500 font-mono">
                                  SN: {item.serialOrImei} · Cond: {item.condition}
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="font-mono font-bold text-emerald-700">R {item.costBasis.toLocaleString()}</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveBatchItem(item.tempId)}
                                  className="text-gray-400 hover:text-red-500 p-1"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}

                          {itemData.title && (
                            <div className="p-2.5 bg-[#FDF0EA] rounded-xl border border-[#C85A32]/30 text-xs flex items-center justify-between">
                              <div>
                                <span className="font-bold text-[#C85A32]">#{buyBatchItems.length + 1} {itemData.title}</span>
                                <div className="text-[10px] text-gray-600 font-mono">
                                  SN: {itemData.serialOrImei || 'N/A'} · Cond: {itemData.condition}
                                </div>
                              </div>
                              <span className="font-mono font-bold text-[#C85A32]">R {agreedOffer.toLocaleString()}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-between py-1.5 text-xs">
                        <span className="text-gray-500">Asset</span>
                        <span className="font-semibold text-gray-900">{itemData.title}</span>
                      </div>
                    )}

                    <div className="pt-2 border-t border-gray-200 space-y-3">
                      <div className="flex justify-between items-baseline">
                        <span className="text-xs font-bold text-gray-700">
                          {txType === 'buy' ? 'Total Approved Payout' : 'Immediate Cash Payout'}
                        </span>
                        <span className="text-2xl font-bold text-emerald-700 font-mono">
                          R {(txType === 'buy' 
                            ? buyBatchItems.reduce((sum, i) => sum + i.costBasis, 0) + (itemData.title ? agreedOffer : 0)
                            : agreedOffer
                          ).toLocaleString()}
                        </span>
                      </div>

                      {txType === 'buy' && (
                        <div className="grid grid-cols-2 gap-3 pt-2">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-600 uppercase">Payment Method</label>
                            <select
                              value={paymentMethod}
                              onChange={e => setPaymentMethod(e.target.value as any)}
                              className="w-full bg-[#F8F9FA] border border-gray-200 rounded-lg p-2 text-xs font-semibold text-gray-800 focus:outline-none"
                            >
                              <option value="cash">Cash Outflow</option>
                              <option value="eft">Electronic Funds Transfer (EFT)</option>
                              <option value="card">Card / Store Credit</option>
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-600 uppercase">Payment State</label>
                            <div className="w-full bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-xs font-bold text-emerald-700">
                              Acquired &amp; Paid
                            </div>
                          </div>
                        </div>
                      )}

                      {txType === 'pawn' && pawnCalculations && (
                        <div className="space-y-1.5 pt-2 border-t border-gray-100 text-xs">
                          <div className="flex justify-between text-gray-500">
                            <span>Monthly Interest (5%)</span>
                            <span className="font-mono">R {pawnCalculations.interest.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-gray-500">
                            <span>Admin & Storage Fee</span>
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
                          Finalizing will create traceable SKUs, record the transaction in the statutory register, and generate thermal receipts.
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={handleFinalize}
                      className={`w-full py-4 rounded-xl text-white font-bold text-sm shadow-xs transition cursor-pointer ${
                        txType === 'buy'
                          ? 'bg-emerald-600 hover:bg-emerald-700'
                          : 'bg-blue-600 hover:bg-blue-700'
                      }`}
                    >
                      {txType === 'buy' ? 'Complete Acquisition & Payout' : 'Finalise Pawn Loan Agreement'}
                    </button>

                    <button
                      onClick={handleBack}
                      className="text-xs text-gray-500 hover:text-gray-900 font-semibold text-center py-1 cursor-pointer"
                    >
                      Modify Terms
                    </button>
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
                    {result.batchItems && result.batchItems.length > 1 ? (
                      <span>Batch <span className="font-mono font-bold text-gray-800">{result.transactionNumber}</span> ({result.batchItems.length} items) logged to inventory.</span>
                    ) : (
                      <span>Asset <span className="font-mono font-bold text-gray-800">{result.assetTag}</span> has been logged to inventory.</span>
                    )}
                  </p>
                </div>

                <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs space-y-5">
                  {result.batchItems && result.batchItems.length > 1 ? (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                        <span className="text-xs font-bold text-gray-700 uppercase">Batch #{result.transactionNumber}</span>
                        <span className="text-xs font-bold text-emerald-700 font-mono">
                          R {result.batchItems.reduce((acc, i) => acc + (i.costBasis || 0), 0).toLocaleString()} Total Payout
                        </span>
                      </div>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {result.batchItems.map((item, idx) => (
                          <div key={item.id} className="p-2.5 rounded-xl bg-gray-50 border border-gray-200 text-xs flex justify-between items-center">
                            <div>
                              <p className="font-bold text-gray-900 font-mono">{item.sku}</p>
                              <p className="text-gray-600 text-[11px]">{item.title}</p>
                            </div>
                            <span className="font-mono font-bold text-gray-900">R {item.costBasis?.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
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
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => showToast('Label Sent', `Asset label(s) printed`, 'success')}
                      className="py-3 px-4 rounded-xl bg-gray-900 text-white font-semibold text-xs flex items-center justify-center gap-2 hover:bg-gray-800 transition shadow-xs cursor-pointer"
                    >
                      <Printer className="w-4 h-4" />
                      <span>Print Asset Labels</span>
                    </button>

                    {txType === 'pawn' && (
                      <button
                        onClick={() => setActiveContractModal(result.loan!)}
                        className="py-3 px-4 rounded-xl border border-gray-200 text-gray-800 font-semibold text-xs flex items-center justify-center gap-2 hover:bg-gray-50 transition shadow-xs cursor-pointer"
                      >
                        <FileText className="w-4 h-4" />
                        <span>Print Pawn Contract</span>
                      </button>
                    )}

                    <button
                      onClick={() => showToast('Digital Receipt Sent', 'Receipt sent via WhatsApp', 'info')}
                      className="py-3 px-4 rounded-xl border border-gray-200 text-gray-800 font-semibold text-xs flex items-center justify-center gap-2 hover:bg-gray-50 transition shadow-xs sm:col-span-2 cursor-pointer"
                    >
                      <Smartphone className="w-4 h-4" />
                      <span>Send WhatsApp Notification</span>
                    </button>
                  </div>
                </div>

                <div className="flex justify-center pt-2">
                  <button
                    onClick={resetWorkflow}
                    className="flex items-center gap-2 px-6 py-3 bg-[#C85A32] text-white rounded-xl font-semibold text-xs shadow-xs hover:bg-[#A94725] transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Start New Intake</span>
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
