/**
 * Storage Service Abstraction
 * Local-First Image Storage Policy:
 * - Transaction/inventory item photographs are LOCAL ONLY (Dexie IndexedDB / local storage).
 * - Business & Profile assets (shop logos, user/avatar photos) are CLOUD-BACKED (Backblaze B2 / Supabase Storage).
 */

import { authApi } from './supabaseApi';
import { apiPost } from '../utils/apiClient';

export interface StorageUploadResult {
  imageUrl: string;
  storageKey: string;
}

export type ImagePurpose = 'item' | 'logo' | 'profile';

export const storageService = {
  /**
   * Upload or resolve image storage based on purpose.
   * Path convention for cloud assets:
   *   Logo: shops/{shopId}/branding/logo/{imageId}.webp
   *   Profile: profiles/{shopId}/{userId}/{imageId}.webp
   * 
   * LOCAL ONLY policy for items:
   *   Item photos (purpose === 'item') stay 100% local and return local Data URL/reference immediately.
   */
  async uploadItemImage(
    fileOrDataUrl: File | Blob | string,
    shopId?: string,
    itemId: string = `item-${Date.now()}`,
    fileName?: string,
    purpose: ImagePurpose = 'item'
  ): Promise<StorageUploadResult> {
    let base64Payload: string = '';

    if (typeof fileOrDataUrl === 'string') {
      base64Payload = fileOrDataUrl;
    } else {
      base64Payload = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(fileOrDataUrl);
      });
    }

    // 1. LOCAL-ONLY POLICY FOR ITEM PHOTOS
    // Transaction and inventory item photos are operational local data.
    // They are stored locally in IndexedDB and never uploaded to cloud storage.
    if (purpose === 'item') {
      return {
        imageUrl: base64Payload || (typeof fileOrDataUrl === 'string' ? fileOrDataUrl : ''),
        storageKey: `local/${shopId || 'offline'}/items/${itemId}.webp`,
      };
    }

    // 2. CLOUD STORAGE POLICY FOR BUSINESS & PROFILE ASSETS (logos & user avatars)
    try {
      const session = await authApi.getSession();
      const token = session?.access_token;

      const result = await apiPost<{ imageUrl: string; storageKey: string }>(
        '/api/storage/upload',
        {
          image: base64Payload,
          shopId,
          itemId,
          fileName,
          purpose,
        },
        token
      );

      if (!result.ok || !result.data?.imageUrl) {
        throw new Error(result.error || `Upload failed with status ${result.status}`);
      }

      return {
        imageUrl: result.data.imageUrl,
        storageKey: result.data.storageKey,
      };
    } catch (err: any) {
      console.warn('Cloud asset upload note (preserving image locally):', err.message);
      const fallbackPath = purpose === 'logo'
        ? `local/${shopId || 'offline'}/branding/logo/logo.webp`
        : `local/${shopId || 'offline'}/profile/avatar.webp`;

      return {
        imageUrl: base64Payload || (typeof fileOrDataUrl === 'string' ? fileOrDataUrl : ''),
        storageKey: fallbackPath,
      };
    }
  },

  /**
   * Helper for standardized shop logo cloud upload
   */
  async uploadLogoImage(
    fileOrDataUrl: File | Blob | string,
    shopId?: string,
    fileName?: string
  ): Promise<StorageUploadResult> {
    return this.uploadItemImage(fileOrDataUrl, shopId, 'logo', fileName, 'logo');
  },

  /**
   * Helper for standardized user / avatar profile photo cloud upload
   */
  async uploadProfileImage(
    fileOrDataUrl: File | Blob | string,
    shopId?: string,
    userId?: string,
    fileName?: string
  ): Promise<StorageUploadResult> {
    return this.uploadItemImage(fileOrDataUrl, shopId, userId || 'avatar', fileName, 'profile');
  },

  /**
   * Delete an image asset by storage key (if stored remotely)
   */
  async deleteItemImage(storageKey: string): Promise<boolean> {
    if (!storageKey || storageKey.startsWith('local/') || storageKey.startsWith('fallback/')) return true;

    try {
      const session = await authApi.getSession();
      const token = session?.access_token;

      const result = await apiPost(
        '/api/storage/delete',
        { storageKey },
        token
      );

      return result.ok;
    } catch (err) {
      console.error('Failed to delete image from storage:', err);
      return false;
    }
  },

  /**
   * Resolves a storageKey or URL to a fully qualified URL
   * Preserves existing remote URLs, HTTP links, and Data URLs.
   */
  getItemImageUrl(storageKeyOrUrl: string): string {
    if (!storageKeyOrUrl) return '';
    if (storageKeyOrUrl.startsWith('http://') || storageKeyOrUrl.startsWith('https://') || storageKeyOrUrl.startsWith('data:')) {
      return storageKeyOrUrl;
    }
    return `/uploads/${storageKeyOrUrl.replace(/^\/+/, '')}`;
  }
};
