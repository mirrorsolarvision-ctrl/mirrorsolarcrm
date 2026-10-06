import type { LeadDocument } from '../context/CRMContext';

/**
 * Clean filename formatter to ensure the downloaded file has an organized, recognizable name
 */
export function formatDownloadFileName(doc: { fileName?: string; documentType?: string; fileType?: string }, customerName?: string, sectionPrefix?: string): string {
  const safeCustomer = customerName ? customerName.replace(/[^a-zA-Z0-9]/g, '_') : 'Customer';
  const safeDocType = (doc.documentType || 'Document').replace(/[^a-zA-Z0-9]/g, '_');
  
  let baseName = doc.fileName || `${safeDocType}`;
  
  // Extract extension if exists
  let ext = '';
  const lastDot = baseName.lastIndexOf('.');
  if (lastDot !== -1) {
    ext = baseName.substring(lastDot);
    baseName = baseName.substring(0, lastDot);
  } else {
    // Default extension from mime type
    if (doc.fileType?.includes('pdf') || doc.fileName?.endsWith('.pdf')) ext = '.pdf';
    else if (doc.fileType?.includes('png') || doc.fileName?.endsWith('.png')) ext = '.png';
    else ext = '.jpg';
  }

  const prefix = sectionPrefix ? `${sectionPrefix}_` : '';
  return `MirrorSolar_${safeCustomer}_${prefix}${safeDocType}${ext}`;
}

/**
 * Downloads a single document using fetch Blob -> object URL.
 * Works seamlessly across Laptop (Windows/Mac/Linux), Tablets (iPad/Android), and Mobile browsers!
 */
export async function downloadFileBlob(
  fileUrl: string, 
  fileName: string, 
  onProgress?: (status: 'downloading' | 'success' | 'error') => void
): Promise<boolean> {
  if (!fileUrl) {
    console.error("No file URL provided for download");
    onProgress?.('error');
    return false;
  }

  onProgress?.('downloading');

  try {
    // 1. Fetch file as blob (handles CORS where allowed)
    const response = await fetch(fileUrl, { mode: 'cors' });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const blob = await response.blob();
    
    // 2. Create blob URL
    const blobUrl = window.URL.createObjectURL(blob);
    
    // 3. Trigger download via hidden anchor
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = blobUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    
    // 4. Cleanup object URL
    setTimeout(() => {
      window.URL.revokeObjectURL(blobUrl);
      try { document.body.removeChild(a); } catch {}
    }, 1500);

    onProgress?.('success');
    return true;
  } catch (err) {
    console.warn("Blob fetch download failed, falling back to direct anchor:", err);
    try {
      // Fallback: direct anchor with download and target blank
      const a = document.createElement('a');
      a.href = fileUrl;
      a.download = fileName;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        try { document.body.removeChild(a); } catch {}
      }, 500);
      onProgress?.('success');
      return true;
    } catch (fallbackErr) {
      console.error("Direct anchor fallback also failed:", fallbackErr);
      onProgress?.('error');
      return false;
    }
  }
}

/**
 * Downloads multiple documents sequentially with a staggered delay
 * to avoid browser popup blockers and network collisions.
 */
export async function downloadMultipleDocuments(
  docs: LeadDocument[], 
  customerName: string, 
  sectionPrefix?: string,
  onFileStart?: (current: number, total: number, doc: LeadDocument) => void
): Promise<{ successCount: number; totalCount: number }> {
  if (!docs || docs.length === 0) return { successCount: 0, totalCount: 0 };

  let successCount = 0;
  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    if (doc.fileUrl) {
      onFileStart?.(i + 1, docs.length, doc);
      const safeName = formatDownloadFileName(doc, customerName, sectionPrefix);
      const success = await downloadFileBlob(doc.fileUrl, safeName);
      if (success) successCount++;
      // Stagger download calls by 400ms
      if (i < docs.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 400));
      }
    }
  }

  return { successCount, totalCount: docs.length };
}

/**
 * Attempts native Web Share API (mobile/tablet/modern browsers).
 * If not supported or rejected, calls the fallback callback.
 */
export async function shareDocumentNativeOrFallback(
  doc: LeadDocument,
  customerName: string,
  onFallback: (doc: LeadDocument) => void
): Promise<boolean> {
  const shareData = {
    title: `Solar Project Document: ${doc.documentType}`,
    text: `Mirror Solar CRM - ${doc.documentType} for ${customerName} (${doc.fileName})`,
    url: doc.fileUrl
  };

  if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare && navigator.canShare(shareData)) {
    try {
      await navigator.share(shareData);
      return true;
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.warn("Native share failed, using fallback modal:", err);
        onFallback(doc);
      }
      return false;
    }
  } else {
    // Web Share API not available -> show fallback popup
    onFallback(doc);
    return false;
  }
}

/**
 * Returns a preformatted WhatsApp share URL
 */
export function getWhatsAppShareUrl(doc: LeadDocument, customerName: string): string {
  const message = `*Mirror Solar CRM - Document Share*\n` +
    `📁 *Document:* ${doc.documentType}\n` +
    `👤 *Customer:* ${customerName}\n` +
    `📄 *File:* ${doc.fileName}\n` +
    `🔗 *Download Link:* ${doc.fileUrl}`;
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
}

/**
 * Returns a preformatted mailto URL
 */
export function getEmailShareUrl(doc: LeadDocument, customerName: string): string {
  const subject = `[Mirror Solar CRM] ${doc.documentType} - ${customerName}`;
  const body = `Dear Team,\n\nPlease find the project document below:\n\n` +
    `Document: ${doc.documentType}\n` +
    `Customer: ${customerName}\n` +
    `File Name: ${doc.fileName}\n` +
    `Download Link: ${doc.fileUrl}\n\n` +
    `Sent from Mirror Solar CRM`;
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/**
 * Copies the document link to clipboard
 */
export async function copyDocumentLink(url: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(url);
      return true;
    } else {
      // Fallback
      const textArea = document.createElement('textarea');
      textArea.value = url;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return successful;
    }
  } catch (err) {
    console.error("Failed to copy link:", err);
    return false;
  }
}
