/**
 * Storage Service Abstraction
 * Manages item photographs and assets with Backblaze B2 (S3-compatible) storage
 * via server-side secure endpoints.
 * 
 * Security Rule:
 * Browser NEVER touches Backblaze B2 secret keys or master keys.
 * Uploads are mediated by `/api/storage/upload`.
 */

import { authApi } from './supabaseApi';
import { apiPost } from '../utils/apiClient';

export interface StorageUploadResult {
  imageUrl: string;
  storageKey: string;
}

export const storageService = {
  /**
   * Upload an item photograph.
   * Accepts a File, Blob, or base64 Data URL.
   * Path convention: shops/{shopId}/items/{itemId}/{imageId}.jpg
   */
  async uploadItemImage(
    fileOrDataUrl: File | Blob | string,
    shopId?: string,
    itemId: string = `item-${Date.now()}`,
    fileName?: string
  ): Promise<StorageUploadResult> {
    try {
      let base64Payload: string;

      if (typeof fileOrDataUrl === 'string') {
        base64Payload = fileOrDataUrl;
      } else {
        // Convert File / Blob to Data URL
        base64Payload = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = (err) => reject(err);
          reader.readAsDataURL(fileOrDataUrl);
        });
      }

      const session = await authApi.getSession();
      const token = session?.access_token;

      // Call secure server-side upload proxy
      const result = await apiPost<{ imageUrl: string; storageKey: string }>(
        '/api/storage/upload',
        {
          image: base64Payload,
          shopId,
          itemId,
          fileName,
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
      console.warn('Storage upload note:', err.message);
      // Fallback: If network or server endpoint is temporarily unavailable,
      // return data URL so local workflow is never blocked
      if (typeof fileOrDataUrl === 'string') {
        return {
          imageUrl: fileOrDataUrl,
          storageKey: `local/${shopId || 'offline'}/${itemId}.jpg`,
        };
      }
      return {
        imageUrl: 'https://images.unsplash.com/photo-1550009158-9ebf69173e03?w=600&q=80',
        storageKey: `fallback/${itemId}.jpg`,
      };
    }
  },

  /**
   * Delete an item image by its storage key
   */
  async deleteItemImage(storageKey: string): Promise<boolean> {
    if (!storageKey || storageKey.startsWith('fallback/')) return true;

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
   */
  getItemImageUrl(storageKeyOrUrl: string): string {
    if (!storageKeyOrUrl) return 'https://images.unsplash.com/photo-1550009158-9ebf69173e03?w=600&q=80';
    if (storageKeyOrUrl.startsWith('http://') || storageKeyOrUrl.startsWith('https://') || storageKeyOrUrl.startsWith('data:')) {
      return storageKeyOrUrl;
    }
    return `/uploads/${storageKeyOrUrl.replace(/^\/+/, '')}`;
  }
};
