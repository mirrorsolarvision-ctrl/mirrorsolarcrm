import { lazy, type ComponentType } from 'react';

/**
 * Robust lazy import wrapper with automatic reload on deployment chunk mismatches.
 * Resolves 'Failed to fetch dynamically imported module' when a new release is pushed.
 */
export function lazyRetry<T extends ComponentType<any>>(
  componentImport: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      return await componentImport();
    } catch (error: any) {
      console.warn('Lazy chunk load failed, checking for deployment update:', error);
      const isChunkError = 
        error?.message?.includes('Failed to fetch dynamically imported module') ||
        error?.message?.includes('dynamically imported module') ||
        error?.message?.includes('Loading chunk') ||
        error?.message?.includes('error loading dynamically imported module');

      if (isChunkError && typeof window !== 'undefined') {
        const key = 'crm_chunk_retry_time';
        const lastRetryTime = sessionStorage.getItem(key);
        const now = Date.now();
        
        // Only auto-reload if we haven't reloaded in the last 10 seconds (prevents loops)
        if (!lastRetryTime || now - parseInt(lastRetryTime, 10) > 10000) {
          sessionStorage.setItem(key, now.toString());
          window.location.reload();
          return new Promise(() => {}); // Wait for browser reload
        }
      }
      throw error;
    }
  });
}

