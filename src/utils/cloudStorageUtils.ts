import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';

export interface UploadOptions {
  onProgress?: (progressPercent: number, bytesTransferred: number, totalBytes: number) => void;
  compressImage?: boolean;
  maxDimension?: number;
  quality?: number;
}

/**
 * Compresses an image file client-side using an HTML5 Canvas.
 * Significantly speeds up uploads on mobile connections while maintaining crisp document legibility.
 */
export async function compressImageFile(
  file: File,
  maxDimension: number = 1920,
  quality: number = 0.82
): Promise<File> {
  // If not an image, return original file untouched
  if (!file.type.startsWith('image/') || file.type.includes('svg')) {
    return file;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        const targetMime = file.type === 'image/png' ? 'image/jpeg' : file.type;
        canvas.toBlob(
          (blob) => {
            if (blob && blob.size < file.size) {
              const compressedFile = new File([blob], file.name.replace(/\.png$/i, '.jpg'), {
                type: targetMime,
                lastModified: Date.now()
              });
              resolve(compressedFile);
            } else {
              // If compressed blob is somehow not smaller, return original
              resolve(file);
            }
          },
          targetMime,
          quality
        );
      };
      img.onerror = () => resolve(file);
    };
    reader.onerror = () => resolve(file);
  });
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

  // 1. Auto-compress if image and compression is enabled (default: true for images)
  if (options.compressImage !== false && file.type.startsWith('image/')) {
    try {
      processedFile = await compressImageFile(
        file,
        options.maxDimension || 1920,
        options.quality || 0.82
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
