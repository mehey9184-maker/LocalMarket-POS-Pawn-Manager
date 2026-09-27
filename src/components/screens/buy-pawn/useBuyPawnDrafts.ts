import { useState, useEffect, useCallback } from 'react';
import { draftService } from '../../../services/draftService';
import { WorkflowDraft, Customer, Seller, Permissions } from '../../../types';
import { WorkflowStep, TxType, ItemDraft, NewIdentityDraft } from './buyPawnTypes';

interface UseBuyPawnDraftsProps {
  user: any;
  shopId?: string;
  step: WorkflowStep;
  txType: TxType;
  itemData: ItemDraft;
  newIdentity: NewIdentityDraft;
  selectedIdentity: Customer | Seller | null;
  setItemData: (data: ItemDraft) => void;
  setNewIdentity: (data: NewIdentityDraft) => void;
  setSelectedIdentity: (identity: Customer | Seller | null) => void;
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
  setItemData,
  setNewIdentity,
  setSelectedIdentity,
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
        const relevant = drafts.filter((d) => d.workflowType === 'buy' || d.workflowType === 'pawn');
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
          payload: { itemData, newIdentity, selectedIdentity, txType },
        });
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [step, txType, itemData, newIdentity, selectedIdentity, draftId, user, shopId]);

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
      setItemData(draft.payload.itemData);
      setNewIdentity(draft.payload.newIdentity);
      setSelectedIdentity(draft.payload.selectedIdentity);
      setActiveDrafts([]);
      showToast('Draft Restored', 'Your previous work has been restored.', 'info');
    },
    [hasPermission, setItemData, setNewIdentity, setSelectedIdentity, setStep, setTxType, showToast]
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
