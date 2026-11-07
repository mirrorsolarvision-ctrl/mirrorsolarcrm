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
        const key = 'crm_chunk_retry_' + window.location.pathname;
        const hasRetried = sessionStorage.getItem(key);
        if (!hasRetried) {
          sessionStorage.setItem(key, 'true');
          window.location.reload();
          return new Promise(() => {}); // Wait for reload
        }
        sessionStorage.removeItem(key);
      }
      throw error;
    }
  });
}

