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
