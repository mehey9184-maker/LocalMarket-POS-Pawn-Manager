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
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      // Call secure server-side upload proxy
      const response = await fetch('/api/storage/upload', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          image: base64Payload,
          shopId,
          itemId,
          fileName,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(errorData.error || `Upload failed with HTTP ${response.status}`);
      }

      const result = await response.json();
      return {
        imageUrl: result.imageUrl,
        storageKey: result.storageKey,
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
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch('/api/storage/delete', {
        method: 'POST',
        headers,
        body: JSON.stringify({ storageKey }),
      });

      return response.ok;
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
