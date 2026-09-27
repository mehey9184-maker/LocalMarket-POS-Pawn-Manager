/**
 * Client-Side Image Processor
 * 
 * High-performance, local-first image optimization using browser-native Canvas & Bitmap APIs.
 * Optimizes item photographs and standardizes shop logos before storage or network transmission.
 * 
 * Rules:
 * - Browser-native APIs only (createImageBitmap, Image, Canvas).
 * - Fast POS image handling: strips metadata, resizes only when needed, compresses to WebP with JPEG fallback.
 * - Does not upscale small images.
 * - Local first: returns instant preview data URL and optimized File/Blob.
 */

export interface ProcessedImageResult {
  blob: Blob;
  file: File;
  dataUrl: string;
  mimeType: string;
  fileName: string;
  size: number;
  width: number;
  height: number;
}

export interface CompressImageOptions {
  maxDimension?: number;
  quality?: number;
  fileName?: string;
}

export interface CreateLogoOptions {
  size?: number;
  quality?: number;
  fileName?: string;
}

let _isWebpSupported: boolean | null = null;

/**
 * Checks if the browser's canvas export supports WebP encoding.
 */
export function isWebpSupported(): boolean {
  if (_isWebpSupported !== null) return _isWebpSupported;
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    _isWebpSupported = canvas.toDataURL('image/webp').startsWith('data:image/webp');
  } catch {
    _isWebpSupported = false;
  }
  return _isWebpSupported;
}

interface ImageDimensions {
  source: CanvasImageSource;
  width: number;
  height: number;
  cleanup?: () => void;
}

/**
 * Formats a byte number into human-readable string (e.g. 142 KB, 1.2 MB).
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Safely decodes an image Blob or File using createImageBitmap with HTMLImageElement fallback.
 */
async function loadImageSource(fileOrBlob: File | Blob): Promise<ImageDimensions> {
  if (typeof createImageBitmap === 'function') {
    try {
      // Try with imageOrientation: 'from-image' to respect EXIF orientation on phones
      const bitmap = await (createImageBitmap as any)(fileOrBlob, { imageOrientation: 'from-image' });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup: () => {
          if ('close' in bitmap && typeof bitmap.close === 'function') {
            bitmap.close();
          }
        },
      };
    } catch {
      try {
        const bitmap = await createImageBitmap(fileOrBlob);
        return {
          source: bitmap,
          width: bitmap.width,
          height: bitmap.height,
          cleanup: () => {
            if ('close' in bitmap && typeof bitmap.close === 'function') {
              bitmap.close();
            }
          },
        };
      } catch {
        // Fall back to Image element if createImageBitmap fails
      }
    }
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(fileOrBlob);
    img.onload = () => {
      resolve({
        source: img,
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
        cleanup: () => {
          URL.revokeObjectURL(objectUrl);
        },
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image for processing'));
    };
    img.src = objectUrl;
  });
}

/**
 * Converts a Canvas to a Blob using Promise.
 */
function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas to blob conversion failed'));
      },
      mimeType,
      quality
    );
  });
}

/**
 * Converts a Blob to a Data URL.
 */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Compresses and normalizes general item photographs.
 * 
 * - Limits max dimension to 1600px on the longest side (without upscaling).
 * - Encodes as WebP (quality ~0.82) with JPEG fallback.
 * - Strips camera EXIF metadata through canvas rendering.
 */
export async function compressImage(
  fileOrBlob: File | Blob,
  options: CompressImageOptions = {}
): Promise<ProcessedImageResult> {
  const maxDimension = options.maxDimension || 1600;
  const quality = options.quality !== undefined ? options.quality : 0.82;
  const originalName = (fileOrBlob as File).name || options.fileName || 'photo';

  const decoded = await loadImageSource(fileOrBlob);

  try {
    let targetWidth = decoded.width;
    let targetHeight = decoded.height;

    // Scale down if larger than maxDimension, preserving aspect ratio (never upscale)
    if (targetWidth > maxDimension || targetHeight > maxDimension) {
      if (targetWidth >= targetHeight) {
        targetHeight = Math.round((targetHeight * maxDimension) / targetWidth);
        targetWidth = maxDimension;
      } else {
        targetWidth = Math.round((targetWidth * maxDimension) / targetHeight);
        targetHeight = maxDimension;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to obtain canvas 2D rendering context');
    }

    // High quality scaling
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(decoded.source, 0, 0, targetWidth, targetHeight);

    const useWebp = isWebpSupported();
    const mimeType = useWebp ? 'image/webp' : 'image/jpeg';
    const ext = useWebp ? 'webp' : 'jpg';

    // Generate clean filename
    const baseName = originalName.replace(/\.[^/.]+$/, '');
    const finalFileName = `${baseName}.${ext}`;

    const blob = await canvasToBlob(canvas, mimeType, quality);
    const dataUrl = await blobToDataUrl(blob);
    const file = new File([blob], finalFileName, { type: mimeType, lastModified: Date.now() });

    return {
      blob,
      file,
      dataUrl,
      mimeType,
      fileName: finalFileName,
      size: blob.size,
      width: targetWidth,
      height: targetHeight,
    };
  } finally {
    decoded.cleanup?.();
  }
}

/**
 * Normalizes an uploaded logo into LocalMarket's standardized square asset format.
 * 
 * - Standardized 512 × 512 canvas.
 * - Contain behavior: preserves aspect ratio, centered with transparent or clean background.
 * - Does not upscale tiny logos unnecessarily.
 * - WebP output where supported, PNG fallback.
 */
export async function createLogoImage(
  fileOrBlob: File | Blob,
  options: CreateLogoOptions = {}
): Promise<ProcessedImageResult> {
  const targetSquareSize = options.size || 512;
  const quality = options.quality !== undefined ? options.quality : 0.85;
  const originalName = (fileOrBlob as File).name || options.fileName || 'logo';

  const decoded = await loadImageSource(fileOrBlob);

  try {
    const canvas = document.createElement('canvas');
    canvas.width = targetSquareSize;
    canvas.height = targetSquareSize;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to obtain canvas 2D rendering context');
    }

    // Clean transparent canvas
    ctx.clearRect(0, 0, targetSquareSize, targetSquareSize);

    // Calculate contain dimensions (centered, fit within 512x512)
    const srcW = decoded.width;
    const srcH = decoded.height;

    let drawW: number;
    let drawH: number;

    // If source is smaller than square, keep its physical size centered without blurry upscaling
    if (srcW <= targetSquareSize && srcH <= targetSquareSize) {
      drawW = srcW;
      drawH = srcH;
    } else {
      const scale = Math.min(targetSquareSize / srcW, targetSquareSize / srcH);
      drawW = Math.round(srcW * scale);
      drawH = Math.round(srcH * scale);
    }

    const offsetX = Math.round((targetSquareSize - drawW) / 2);
    const offsetY = Math.round((targetSquareSize - drawH) / 2);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(decoded.source, offsetX, offsetY, drawW, drawH);

    const useWebp = isWebpSupported();
    const mimeType = useWebp ? 'image/webp' : 'image/png';
    const ext = useWebp ? 'webp' : 'png';

    const baseName = originalName.replace(/\.[^/.]+$/, '');
    const finalFileName = `${baseName}_logo.${ext}`;

    const blob = await canvasToBlob(canvas, mimeType, quality);
    const dataUrl = await blobToDataUrl(blob);
    const file = new File([blob], finalFileName, { type: mimeType, lastModified: Date.now() });

    return {
      blob,
      file,
      dataUrl,
      mimeType,
      fileName: finalFileName,
      size: blob.size,
      width: targetSquareSize,
      height: targetSquareSize,
    };
  } finally {
    decoded.cleanup?.();
  }
}
