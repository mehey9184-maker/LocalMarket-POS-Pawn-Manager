import { useState, useRef } from 'react';
import { compressImage } from '../../../utils/imageProcessor';
import { storageService } from '../../../services/storageService';
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
  shopId,
  showToast,
}: UseBuyPawnImagesProps) {
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [photoUploadStatus, setPhotoUploadStatus] = useState<PhotoUploadStatus>('idle');
  const [photoMeta, setPhotoMeta] = useState<PhotoMeta | null>(null);
  const photoFileInputRef = useRef<HTMLInputElement>(null);
  const currentUploadPromiseRef = useRef<Promise<any> | null>(null);

  /**
   * Local-First Photo Processing Pipeline:
   * 1. Optimize image in-browser instantly via Canvas / Bitmap API (<100ms)
   * 2. Immediately display local preview (zero user waiting)
   * 3. Upload to Backblaze B2 in the background (non-blocking)
   */
  const handleProcessImage = async (fileOrBlob: File | Blob, originalFileName?: string) => {
    setPhotoUploadStatus('optimizing');
    const originalSize = fileOrBlob.size;

    try {
      // 1. Instant local optimization (WebP, max 1600px, quality 0.82)
      const processed = await compressImage(fileOrBlob, {
        maxDimension: 1600,
        quality: 0.82,
        fileName: originalFileName || (fileOrBlob as File).name || 'item_photo.jpg',
      });

      // 2. Immediately display local preview data URL (user continues without waiting)
      setItemData((prev) => ({ ...prev, imageUrl: processed.dataUrl }));
      setPhotoMeta({
        originalSize,
        compressedSize: processed.size,
        dimensions: `${processed.width}×${processed.height}`,
      });
      setPhotoUploadStatus('ready');

      // 3. Background non-blocking upload to Backblaze B2 (mediated by /api/storage/upload)
      setPhotoUploadStatus('uploading');
      const draftItemId = itemData.serialOrImei || `intake-${Date.now()}`;

      const uploadPromise = storageService
        .uploadItemImage(processed.blob, shopId, draftItemId, processed.fileName)
        .then((uploadRes) => {
          if (
            uploadRes.imageUrl &&
            !uploadRes.imageUrl.startsWith('data:image/') &&
            !uploadRes.storageKey?.startsWith('local/')
          ) {
            // Successfully uploaded to remote Backblaze B2!
            setItemData((prev) => {
              if (prev.imageUrl === processed.dataUrl) {
                return { ...prev, imageUrl: uploadRes.imageUrl };
              }
              return prev;
            });
            setPhotoUploadStatus('synced');
            return uploadRes.imageUrl;
          } else {
            setPhotoUploadStatus('local_only');
            return null;
          }
        })
        .catch((err) => {
          console.warn('Background upload note (preserved locally):', err);
          setPhotoUploadStatus('local_only');
          return null;
        });

      currentUploadPromiseRef.current = uploadPromise;
    } catch (err: any) {
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
    setItemData((prev) => ({ ...prev, imageUrl: '' }));
    setPhotoMeta(null);
    setPhotoUploadStatus('idle');
    currentUploadPromiseRef.current = null;
    showToast('Photo Removed', 'Image removed from item intake.', 'info');
  };

  const resetImages = () => {
    setIsCameraOpen(false);
    setPhotoUploadStatus('idle');
    setPhotoMeta(null);
    currentUploadPromiseRef.current = null;
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
  };
}
