const CHUNK_RELOAD_KEY = 'ng_chunk_reload';

function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';

  return message.includes('Failed to fetch dynamically imported module') || message.includes('Importing a module script failed') || message.includes('error loading dynamically imported module');
}

/**
 * Wraps Angular loadChildren imports with a one-time full reload on stale chunk errors (common during ng serve HMR).
 */
export function lazyLoadChildren<T>(importFn: () => Promise<T>): () => Promise<T> {
  return () =>
    importFn().catch((error: unknown) => {
      if (isChunkLoadError(error) && !sessionStorage.getItem(CHUNK_RELOAD_KEY)) {
        sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
        window.location.reload();
      }

      sessionStorage.removeItem(CHUNK_RELOAD_KEY);
      throw error;
    });
}
