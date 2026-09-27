import { useState, useRef } from 'react';
import { compressImage } from '../../../utils/imageProcessor';
import { ItemDraft, PhotoUploadStatus, PhotoMeta } from './buyPawnTypes';

interface UseBuyPawnImagesProps {
  itemData: ItemDraft;
  setItemData: React.Dispatch<React.SetStateAction<ItemDraft>>;
  shopId?: string;
  showToast: (title: string, message: string, type?: 'success' | 'error' | 'info' | 'amber') => void;
}

export function useBuyPawnImages({
  itemData,
  setItemData,
  showToast,
}: UseBuyPawnImagesProps) {
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [photoUploadStatus, setPhotoUploadStatus] = useState<PhotoUploadStatus>('idle');
  const [photoMeta, setPhotoMeta] = useState<PhotoMeta | null>(null);
  const photoFileInputRef = useRef<HTMLInputElement>(null);
  const uploadGenerationRef = useRef<number>(0);

  /**
   * Item Photo Local Policy:
   * Item photographs are operational local data stored in Dexie IndexedDB.
   * No cloud uploads are performed for transaction/inventory item photos.
   * Resolves immediately without blocking.
   */
  const waitForCurrentUpload = async (): Promise<string | null> => {
    return null;
  };

  /**
   * Local-First Photo Processing Pipeline:
   * 1. Optimize image in-browser instantly via Canvas / Bitmap API (<100ms)
   * 2. Store locally and attach local photo reference to item
   * 3. Item photos remain local-only (no cloud upload)
   */
  const handleProcessImage = async (fileOrBlob: File | Blob, originalFileName?: string) => {
    const currentGen = ++uploadGenerationRef.current;
    setPhotoUploadStatus('optimizing');
    const originalSize = fileOrBlob.size;

    try {
      // 1. Instant local optimization (WebP, max 1600px, quality 0.82)
      const processed = await compressImage(fileOrBlob, {
        maxDimension: 1600,
        quality: 0.82,
        fileName: originalFileName || (fileOrBlob as File).name || 'item_photo.jpg',
      });

      // Discard if user replaced image while compression was running
      if (uploadGenerationRef.current !== currentGen) return;

      // 2. Immediately store local photo reference on item
      setItemData((prev) => ({ ...prev, imageUrl: processed.dataUrl }));
      setPhotoMeta({
        originalSize,
        compressedSize: processed.size,
        dimensions: `${processed.width}×${processed.height}`,
      });
      
      // 3. Mark as local-only asset (no background cloud upload)
      setPhotoUploadStatus('local_only');
    } catch (err: any) {
      if (uploadGenerationRef.current !== currentGen) return;
      console.error('Image optimization error:', err);
      showToast('Image Error', err.message || 'Could not process photograph', 'error');
      setPhotoUploadStatus('idle');
    }
  };

  const handlePhotoFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Invalid File', 'Please select an image file (JPEG, PNG, WebP).', 'amber');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      showToast('File Too Large', 'Please select an image smaller than 20MB.', 'amber');
      return;
    }

    await handleProcessImage(file, file.name);
    if (e.target) e.target.value = '';
  };

  const handleRemovePhoto = () => {
    uploadGenerationRef.current++;
    setItemData((prev) => ({ ...prev, imageUrl: '' }));
    setPhotoMeta(null);
    setPhotoUploadStatus('idle');
    showToast('Photo Removed', 'Image removed from item intake.', 'info');
  };

  const resetImages = () => {
    uploadGenerationRef.current++;
    setIsCameraOpen(false);
    setPhotoUploadStatus('idle');
    setPhotoMeta(null);
  };

  return {
    isCameraOpen,
    setIsCameraOpen,
    photoUploadStatus,
    photoMeta,
    photoFileInputRef,
    handleProcessImage,
    handlePhotoFileSelect,
    handleRemovePhoto,
    resetImages,
    waitForCurrentUpload,
  };
}
