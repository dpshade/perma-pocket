import { useState, useEffect, useCallback, useRef } from 'react';
import type { SavedSearch } from '@/types/prompt';
import { uploadCollections, queryLatestCollections, fetchCollections } from '@/lib/collections-storage';

const STORAGE_KEY = 'pktpmt_saved_searches';
const UPLOAD_DEBOUNCE_MS = 2000; // 2 seconds

interface CollectionsState {
  collections: SavedSearch[];
  isLoading: boolean;
  isSyncing: boolean;
  lastSyncTxId: string | null;
  error: string | null;
}

export interface UseCollectionsReturn {
  collections: SavedSearch[];
  isLoading: boolean;
  isSyncing: boolean;
  lastSyncTxId: string | null;
  error: string | null;
  addCollection: (collection: SavedSearch) => void;
  updateCollection: (collection: SavedSearch) => void;
  deleteCollection: (id: string) => void;
  syncFromArweave: () => Promise<void>;
  clearError: () => void;
}

/**
 * Hook for managing collections with Arweave sync
 * - Stores all collections in localStorage for instant access
 * - Debounces uploads to Arweave (2 second delay)
 * - Optimistically updates UI before Arweave confirmation
 * - Fetches latest collections from Arweave on mount
 */
export function useCollections(
  walletAddress: string | null,
  arweaveWallet: any,
  onUploadStart?: (txId: string, count: number) => void,
  _onUploadComplete?: (txId: string) => void,
  onUploadError?: (error: string) => void
): UseCollectionsReturn {
  const [state, setState] = useState<CollectionsState>({
    collections: [],
    isLoading: true,
    isSyncing: false,
    lastSyncTxId: null,
    error: null,
  });

  const uploadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingCollectionsRef = useRef<SavedSearch[] | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as any[];

        // Migrate old collections that have createdAt
        const migrated = parsed.map(collection => {
          // If collection has createdAt but it's the same type structure, remove it
          if ('createdAt' in collection) {
            const { createdAt, ...rest } = collection;
            return rest as SavedSearch;
          }
          return collection as SavedSearch;
        });

        // Save migrated data back
        if (migrated.length > 0 && parsed.some(c => 'createdAt' in c)) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
          console.log('[useCollections] Migrated collections to remove createdAt field');
        }

        setState(prev => ({ ...prev, collections: migrated, isLoading: false }));
      } else {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    } catch (error) {
      console.error('[useCollections] Failed to load from localStorage:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to load collections from local storage',
      }));
    }
  }, []);

  // Sync from Arweave on wallet change
  useEffect(() => {
    if (!walletAddress) {
      return;
    }

    syncFromArweave();
  }, [walletAddress]);

  /**
   * Fetch latest collections from Arweave
   */
  const syncFromArweave = useCallback(async () => {
    if (!walletAddress) {
      console.log('[useCollections] No wallet address, skipping Arweave sync');
      return;
    }

    try {
      console.log('[useCollections] Syncing from Arweave...');
      setState(prev => ({ ...prev, isSyncing: true, error: null }));

      // Query for latest transaction
      const { txId, error: queryError } = await queryLatestCollections(walletAddress);

      if (queryError) {
        throw new Error(queryError);
      }

      if (!txId) {
        console.log('[useCollections] No collections found on Arweave');
        setState(prev => ({ ...prev, isSyncing: false }));
        return;
      }

      // Fetch collections
      const collections = await fetchCollections(txId);

      // Update state and localStorage
      setState(prev => ({
        ...prev,
        collections,
        lastSyncTxId: txId,
        isSyncing: false,
      }));

      localStorage.setItem(STORAGE_KEY, JSON.stringify(collections));

      console.log(`[useCollections] Synced ${collections.length} collections from Arweave`);
    } catch (error) {
      console.error('[useCollections] Sync failed:', error);
      setState(prev => ({
        ...prev,
        isSyncing: false,
        error: error instanceof Error ? error.message : 'Failed to sync from Arweave',
      }));
    }
  }, [walletAddress]);

  /**
   * Debounced upload to Arweave
   */
  const scheduleUpload = useCallback(
    (collections: SavedSearch[]) => {
      // Clear existing timeout
      if (uploadTimeoutRef.current) {
        clearTimeout(uploadTimeoutRef.current);
      }

      // Store pending collections
      pendingCollectionsRef.current = collections;

      // Schedule upload
      uploadTimeoutRef.current = setTimeout(async () => {
        if (!arweaveWallet || !pendingCollectionsRef.current) {
          console.log('[useCollections] No wallet or pending collections, skipping upload');
          return;
        }

        try {
          console.log('[useCollections] Uploading to Arweave...');
          setState(prev => ({ ...prev, isSyncing: true, error: null }));

          const result = await uploadCollections(pendingCollectionsRef.current, arweaveWallet);

          if (result.success && result.txId) {
            console.log(`[useCollections] Upload successful: ${result.txId}`);
            setState(prev => ({ ...prev, lastSyncTxId: result.txId!, isSyncing: false }));

            // Notify upload start
            if (onUploadStart) {
              onUploadStart(result.txId, pendingCollectionsRef.current.length);
            }

            // Note: onUploadComplete will be called by polling when transaction is confirmed
          } else {
            throw new Error(result.error || 'Upload failed');
          }
        } catch (error) {
          console.error('[useCollections] Upload failed:', error);
          const errorMessage = error instanceof Error ? error.message : 'Failed to upload to Arweave';

          setState(prev => ({
            ...prev,
            isSyncing: false,
            error: errorMessage,
          }));

          // Notify upload error
          if (onUploadError) {
            onUploadError(errorMessage);
          }
        }

        pendingCollectionsRef.current = null;
      }, UPLOAD_DEBOUNCE_MS);
    },
    [arweaveWallet, onUploadStart, onUploadError]
  );

  /**
   * Update localStorage and schedule Arweave upload
   */
  const persistCollections = useCallback(
    (collections: SavedSearch[]) => {
      // Update localStorage immediately (optimistic)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(collections));

      // Schedule debounced upload to Arweave
      if (arweaveWallet) {
        scheduleUpload(collections);
      }
    },
    [arweaveWallet, scheduleUpload]
  );

  /**
   * Add a new collection
   */
  const addCollection = useCallback(
    (collection: SavedSearch) => {
      const updated = [...state.collections, collection];
      setState(prev => ({ ...prev, collections: updated }));
      persistCollections(updated);
    },
    [state.collections, persistCollections]
  );

  /**
   * Update an existing collection
   */
  const updateCollection = useCallback(
    (collection: SavedSearch) => {
      const updated = state.collections.map(c =>
        c.id === collection.id ? collection : c
      );
      setState(prev => ({ ...prev, collections: updated }));
      persistCollections(updated);
    },
    [state.collections, persistCollections]
  );

  /**
   * Delete a collection
   */
  const deleteCollection = useCallback(
    (id: string) => {
      const updated = state.collections.filter(c => c.id !== id);
      setState(prev => ({ ...prev, collections: updated }));
      persistCollections(updated);
    },
    [state.collections, persistCollections]
  );

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (uploadTimeoutRef.current) {
        clearTimeout(uploadTimeoutRef.current);
      }
    };
  }, []);

  return {
    collections: state.collections,
    isLoading: state.isLoading,
    isSyncing: state.isSyncing,
    lastSyncTxId: state.lastSyncTxId,
    error: state.error,
    addCollection,
    updateCollection,
    deleteCollection,
    syncFromArweave,
    clearError,
  };
}
