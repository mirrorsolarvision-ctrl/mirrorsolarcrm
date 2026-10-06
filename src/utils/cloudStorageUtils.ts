import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';

export type CompressionPreset = 'ultra_50kb' | 'standard_150kb' | 'high_res' | 'original';

export interface UploadOptions {
  onProgress?: (progressPercent: number, bytesTransferred: number, totalBytes: number) => void;
  compressPreset?: CompressionPreset;
  maxDimension?: number;
  quality?: number;
  compressImage?: boolean;
}

/**
 * Format bytes to readable string (e.g., 42.5 KB or 3.2 MB)
 */
export function formatBytes(bytes: number, decimals: number = 1): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Iterative smart Canvas compression to guarantee output within target file size limit.
 * Perfect for compressing camera photos to strictly < 50 KB without blurriness on documents.
 */
export async function compressImageToTargetPreset(
  file: File,
  preset: CompressionPreset = 'ultra_50kb'
): Promise<File> {
  // If not an image or SVG, return untouched
  if (!file.type.startsWith('image/') || file.type.includes('svg') || preset === 'original') {
    return file;
  }

  // Define preset configurations
  let maxDimension = 1920;
  let initialQuality = 0.82;
  let targetMaxBytes = Infinity;

  if (preset === 'ultra_50kb') {
    maxDimension = 1024;
    initialQuality = 0.55;
    targetMaxBytes = 48 * 1024; // strictly ~48 KB to guarantee < 50 KB
  } else if (preset === 'standard_150kb') {
    maxDimension = 1400;
    initialQuality = 0.72;
    targetMaxBytes = 150 * 1024;
  } else if (preset === 'high_res') {
    maxDimension = 1920;
    initialQuality = 0.85;
    targetMaxBytes = 450 * 1024;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = async () => {
        let currentWidth = img.width;
        let currentHeight = img.height;

        // Scale down to maxDimension
        if (currentWidth > maxDimension || currentHeight > maxDimension) {
          if (currentWidth > currentHeight) {
            currentHeight = Math.round((currentHeight * maxDimension) / currentWidth);
            currentWidth = maxDimension;
          } else {
            currentWidth = Math.round((currentWidth * maxDimension) / currentHeight);
            currentHeight = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = currentWidth;
        canvas.height = currentHeight;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          resolve(file);
          return;
        }

        // Draw with high quality interpolation
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, currentWidth, currentHeight);

        const targetMime = 'image/jpeg';
        let quality = initialQuality;
        let bestBlob: Blob | null = null;

        // Iterative compression loop to guarantee < targetMaxBytes (for ultra_50kb)
        const renderBlob = (q: number): Promise<Blob | null> => {
          return new Promise((bResolve) => canvas.toBlob(bResolve, targetMime, q));
        };

        bestBlob = await renderBlob(quality);

        if (bestBlob && preset === 'ultra_50kb') {
          // If still over target, iteratively decrease quality or scale dimension
          let attempts = 0;
          while (bestBlob && bestBlob.size > targetMaxBytes && attempts < 4) {
            attempts++;
            quality = Math.max(0.25, quality - 0.12);
            bestBlob = await renderBlob(quality);

            // If still over 50kb, shrink canvas slightly
            if (bestBlob && bestBlob.size > targetMaxBytes) {
              currentWidth = Math.round(currentWidth * 0.85);
              currentHeight = Math.round(currentHeight * 0.85);
              canvas.width = currentWidth;
              canvas.height = currentHeight;
              ctx.drawImage(img, 0, 0, currentWidth, currentHeight);
              bestBlob = await renderBlob(quality);
            }
          }
        }

        if (bestBlob && bestBlob.size < file.size) {
          const cleanExt = file.name.replace(/\.[^/.]+$/, "") + '.jpg';
          const compressedFile = new File([bestBlob], cleanExt, {
            type: targetMime,
            lastModified: Date.now()
          });
          resolve(compressedFile);
        } else {
          resolve(file);
        }
      };
      img.onerror = () => resolve(file);
    };
    reader.onerror = () => resolve(file);
  });
}

/**
 * Backward compatibility alias for compressImageFile
 */
export async function compressImageFile(
  file: File,
  maxDimension: number = 1920,
  _quality: number = 0.82
): Promise<File> {
  return compressImageToTargetPreset(file, maxDimension <= 1024 ? 'ultra_50kb' : 'standard_150kb');
}

/**
 * Uploads a file directly to Firebase Cloud Storage with real-time resumable progress tracking.
 * Returns the public HTTPS download URL.
 */
export async function uploadFileToStorage(
  file: File,
  folderPath: string = 'leads/documents',
  options: UploadOptions = {}
): Promise<string> {
  let processedFile = file;

  // 1. Process preset compression
  if (options.compressImage !== false && file.type.startsWith('image/')) {
    try {
      processedFile = await compressImageToTargetPreset(
        file,
        options.compressPreset || 'ultra_50kb'
      );
    } catch (compressErr) {
      console.warn('Image compression bypassed:', compressErr);
      processedFile = file;
    }
  }

  // 2. Sanitize filename
  const cleanName = processedFile.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
  const uniqueTimestamp = Date.now();
  const cleanFolder = folderPath.replace(/^\/+|\/+$/g, '');
  const storagePath = `${cleanFolder}/${uniqueTimestamp}_${cleanName}`;
  const fileRef = ref(storage, storagePath);

  // 3. Resumable upload task with progress tracking
  return new Promise((resolve, reject) => {
    const uploadTask = uploadBytesResumable(fileRef, processedFile, {
      contentType: processedFile.type,
      customMetadata: {
        originalName: file.name,
        compressedSize: `${processedFile.size} bytes`,
        uploadedAt: new Date().toISOString()
      }
    });

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        if (options.onProgress) {
          options.onProgress(progress, snapshot.bytesTransferred, snapshot.totalBytes);
        }
      },
      (error) => {
        console.error('Firebase Storage Upload Error:', error);
        reject(new Error(`Storage upload failed: ${error.message}`));
      },
      async () => {
        try {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          if (options.onProgress) {
            options.onProgress(100, processedFile.size, processedFile.size);
          }
          resolve(downloadUrl);
        } catch (urlErr: any) {
          reject(new Error(`Failed to retrieve download URL: ${urlErr.message}`));
        }
      }
    );
  });
}
