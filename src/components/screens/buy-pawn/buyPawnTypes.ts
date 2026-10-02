import { ItemCondition, InventoryItem, PawnLoan, Customer, Seller, ItemStatus } from '../../../types';

export type WorkflowStep = 'mode' | 'customer' | 'item' | 'valuation' | 'location' | 'deal' | 'completion';
export type TxType = 'existing' | 'buy' | 'pawn' | null;

export interface ItemDraft {
  title: string;
  category: InventoryItem['category'];
  brand: string;
  model: string;
  serialOrImei: string;
  condition: ItemCondition;
  imageUrl: string;
  stockLocation: string;
  internalNote: string;
  sourceNote: string;
}

export interface NewIdentityDraft {
  fullName: string;
  idNumber: string;
  mobile: string;
  address: string;
  idType: 'RSA Smart ID' | 'Green ID Book' | 'Passport';
}

export interface BatchItem extends ItemDraft {
  id: string;
  agreedOffer: number;
  suggestedRetail: number;
}

export interface CompletionResult {
  assetTag: string;
  ticketNumber?: string;
  item: InventoryItem;
  loan?: PawnLoan;
}

export type PhotoUploadStatus = 'idle' | 'optimizing' | 'ready' | 'uploading' | 'synced' | 'local_only';

export interface PhotoMeta {
  originalSize?: number;
  compressedSize?: number;
  dimensions?: string;
}

export interface PawnCalculations {
  interest: number;
  adminFee: number;
  totalRedemption: number;
  expiryDate: string;
}

export interface StepperStep {
  id: string;
  label: string;
}

export function normalizeStepForTransactionType(
  currentStep: WorkflowStep,
  targetType: TxType,
  targetIdentity: Customer | Seller | null,
  targetAgreedOffer: number = 0,
  retailPriceInput: string = ''
): WorkflowStep {
  if (!targetType || targetType === 'existing') {
    // Existing Stock flow: mode -> item -> valuation -> location
    if (currentStep === 'mode' || currentStep === 'customer' || currentStep === 'item') {
      return 'item';
    }
    if (currentStep === 'valuation') {
      return 'valuation';
    }
    if (currentStep === 'deal' || currentStep === 'location') {
      const price = parseFloat(retailPriceInput);
      return price > 0 ? 'location' : 'valuation';
    }
    return 'item';
  }

  if (targetType === 'pawn') {
    // Pawn flow: mode -> customer (Borrower Info) -> item (Collateral Item) -> valuation (Loan Terms) -> deal (Review & Pledge)
    // CRITICAL PAWN INVARIANT: Borrower Info is REQUIRED before progressing past customer step!
    const hasBorrower = Boolean(targetIdentity);

    if (currentStep === 'mode' || currentStep === 'customer') {
      return 'customer';
    }

    if (currentStep === 'item' || currentStep === 'valuation') {
      // If borrower is already set (e.g. restored from previous Pawn state), keep currentStep.
      // If NO borrower is set, MUST land on 'customer' (Borrower Info)!
      return hasBorrower ? currentStep : 'customer';
    }

    if (currentStep === 'deal' || currentStep === 'location') {
      if (!hasBorrower) return 'customer';
      if (targetAgreedOffer <= 0) return 'valuation';
      return 'deal';
    }

    return hasBorrower ? 'item' : 'customer';
  }

  if (targetType === 'buy') {
    // Buy From Person flow: mode -> item (Evaluate Item) -> valuation (Valuation & Price) -> customer (Seller Info) -> deal (Review & Record)
    const hasSeller = Boolean(targetIdentity);
    const hasPayout = targetAgreedOffer > 0;

    if (currentStep === 'mode' || currentStep === 'item') {
      return 'item';
    }

    if (currentStep === 'valuation') {
      return 'valuation';
    }

    if (currentStep === 'customer') {
      // If switching to Buy on customer step, if payout is set, keep customer. Otherwise valuation.
      return hasPayout ? 'customer' : 'valuation';
    }

    if (currentStep === 'deal' || currentStep === 'location') {
      if (!hasPayout) return 'valuation';
      if (!hasSeller) return 'customer';
      return 'deal';
    }

    return 'item';
  }

  return 'item';
}
