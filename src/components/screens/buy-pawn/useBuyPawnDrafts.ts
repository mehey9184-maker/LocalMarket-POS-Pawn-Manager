import { useState, useEffect, useCallback } from 'react';
import { draftService } from '../../../services/draftService';
import { WorkflowDraft, Customer, Seller, Permissions, ItemStatus } from '../../../types';
import { WorkflowStep, TxType, ItemDraft, NewIdentityDraft, BatchItem } from './buyPawnTypes';

interface UseBuyPawnDraftsProps {
  user: any;
  shopId?: string;
  step: WorkflowStep;
  txType: TxType;
  itemData: ItemDraft;
  newIdentity: NewIdentityDraft;
  selectedIdentity: Customer | Seller | null;
  buySelectedIdentity?: Seller | null;
  pawnSelectedIdentity?: Customer | null;
  agreedOffer: number;
  buyAgreedOffer?: number;
  pawnAgreedOffer?: number;
  isAgreedOfferFromMarketCheck?: boolean;
  suggestedRetail: number;
  retailPriceInput: string;
  isRetailPriceFromMarketCheck?: boolean;
  costBasisInput: string;
  existingStockStatus: ItemStatus;
  basketItems: BatchItem[];
  setItemData: (data: ItemDraft) => void;
  setNewIdentity: (data: NewIdentityDraft) => void;
  setSelectedIdentity: (identity: Customer | Seller | null) => void;
  setBuySelectedIdentity?: (seller: Seller | null) => void;
  setPawnSelectedIdentity?: (customer: Customer | null) => void;
  setAgreedOffer: (val: number) => void;
  setBuyAgreedOffer?: (val: number) => void;
  setPawnAgreedOffer?: (val: number) => void;
  setIsAgreedOfferFromMarketCheck?: (val: boolean) => void;
  setSuggestedRetail: (val: number) => void;
  setRetailPriceInput: (val: string) => void;
  setIsRetailPriceFromMarketCheck?: (val: boolean) => void;
  setCostBasisInput: (val: string) => void;
  setExistingStockStatus: (status: ItemStatus) => void;
  setBasketItems: (items: BatchItem[]) => void;
  setStep: (step: WorkflowStep) => void;
  setTxType: (txType: TxType) => void;
  hasPermission: (permission: keyof Permissions) => boolean;
  showToast: (title: string, message: string, type?: 'success' | 'error' | 'info' | 'amber') => void;
}

export function useBuyPawnDrafts({
  user,
  shopId,
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
  isAgreedOfferFromMarketCheck = false,
  suggestedRetail,
  retailPriceInput,
  isRetailPriceFromMarketCheck = false,
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
  setRetailPriceInput,
  setIsRetailPriceFromMarketCheck,
  setCostBasisInput,
  setExistingStockStatus,
  setBasketItems,
  setStep,
  setTxType,
  hasPermission,
  showToast,
}: UseBuyPawnDraftsProps) {
  const [activeDrafts, setActiveDrafts] = useState<WorkflowDraft[]>([]);
  const [draftId, setDraftId] = useState<string>(() => crypto.randomUUID());

  useEffect(() => {
    if (user && shopId) {
      draftService.getActiveDrafts(user.id, shopId).then((drafts) => {
        // Existing Stock, Buy, and Pawn drafts are all recoverable
        const relevant = drafts.filter(
          (d) => d.workflowType === 'buy' || d.workflowType === 'pawn' || d.workflowType === 'existing'
        );
        setActiveDrafts(relevant);
      });
    }
  }, [user, shopId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (step !== 'completion' && txType && user && shopId) {
        draftService.saveDraft({
          id: draftId,
          shopId: shopId,
          userId: user.id,
          workflowType: txType,
          step: step,
          payload: {
            itemData,
            newIdentity,
            selectedIdentity,
            buySelectedIdentity,
            pawnSelectedIdentity,
            txType,
            agreedOffer,
            buyAgreedOffer,
            pawnAgreedOffer,
            isAgreedOfferFromMarketCheck: Boolean(isAgreedOfferFromMarketCheck),
            suggestedRetail,
            retailPriceInput,
            isRetailPriceFromMarketCheck: Boolean(isRetailPriceFromMarketCheck),
            costBasisInput,
            existingStockStatus,
            basketItems,
          },
        });
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [
    step,
    txType,
    itemData,
    newIdentity,
    selectedIdentity,
    agreedOffer,
    isAgreedOfferFromMarketCheck,
    suggestedRetail,
    retailPriceInput,
    isRetailPriceFromMarketCheck,
    costBasisInput,
    existingStockStatus,
    basketItems,
    draftId,
    user,
    shopId,
  ]);

  const handleContinueDraft = useCallback(
    (draft: WorkflowDraft) => {
      if (draft.workflowType === 'buy' && !hasPermission('sellerAcquisitions')) {
        showToast(
          'Permission Denied',
          'Senior Cashier or higher authority required for Buy From Person acquisitions.',
          'error'
        );
        return;
      }
      if (draft.workflowType === 'pawn' && !hasPermission('pawn')) {
        showToast(
          'Permission Denied',
          'Senior Cashier or higher authority required for Pawn loans.',
          'error'
        );
        return;
      }
      setDraftId(draft.id);
      setTxType(draft.workflowType as TxType);
      setStep(draft.step as WorkflowStep);
      if (draft.payload?.itemData) setItemData(draft.payload.itemData);
      if (draft.payload?.newIdentity) setNewIdentity(draft.payload.newIdentity);
      if (draft.payload?.selectedIdentity !== undefined) setSelectedIdentity(draft.payload.selectedIdentity);
      if (draft.payload?.buySelectedIdentity !== undefined) setBuySelectedIdentity?.(draft.payload.buySelectedIdentity);
      if (draft.payload?.pawnSelectedIdentity !== undefined) setPawnSelectedIdentity?.(draft.payload.pawnSelectedIdentity);
      if (draft.payload?.agreedOffer !== undefined) setAgreedOffer(draft.payload.agreedOffer);
      if (draft.payload?.buyAgreedOffer !== undefined) setBuyAgreedOffer?.(draft.payload.buyAgreedOffer);
      if (draft.payload?.pawnAgreedOffer !== undefined) setPawnAgreedOffer?.(draft.payload.pawnAgreedOffer);
      setIsAgreedOfferFromMarketCheck?.(Boolean(draft.payload?.isAgreedOfferFromMarketCheck));
      if (draft.payload?.suggestedRetail !== undefined) setSuggestedRetail(draft.payload.suggestedRetail);
      if (draft.payload?.retailPriceInput !== undefined) setRetailPriceInput(draft.payload.retailPriceInput);
      setIsRetailPriceFromMarketCheck?.(Boolean(draft.payload?.isRetailPriceFromMarketCheck));
      if (draft.payload?.costBasisInput !== undefined) setCostBasisInput(draft.payload.costBasisInput);
      if (draft.payload?.existingStockStatus) setExistingStockStatus(draft.payload.existingStockStatus);
      if (draft.payload?.basketItems) setBasketItems(draft.payload.basketItems);

      setActiveDrafts([]);
      showToast('Draft Restored', 'Your previous work has been restored.', 'info');
    },
    [
      hasPermission,
      setItemData,
      setNewIdentity,
      setSelectedIdentity,
      setAgreedOffer,
      setIsAgreedOfferFromMarketCheck,
      setSuggestedRetail,
      setRetailPriceInput,
      setIsRetailPriceFromMarketCheck,
      setCostBasisInput,
      setExistingStockStatus,
      setBasketItems,
      setStep,
      setTxType,
      showToast,
    ]
  );

  const handleDiscardDraft = useCallback(
    (id: string) => {
      if (shopId) {
        draftService.discardDraft(id, shopId);
      }
      setActiveDrafts((prev) => prev.filter((d) => d.id !== id));
    },
    [shopId]
  );

  const closeDraft = useCallback(
    async (targetShopId?: string) => {
      const activeShop = targetShopId || shopId;
      if (activeShop) {
        await draftService.closeDraft(draftId, activeShop);
      }
    },
    [draftId, shopId]
  );

  return {
    activeDrafts,
    draftId,
    setDraftId,
    handleContinueDraft,
    handleDiscardDraft,
    closeDraft,
  };
}
