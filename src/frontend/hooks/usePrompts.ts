import { create } from 'zustand';
import type { Prompt, PromptMetadata, BooleanExpression, SavedSearch } from '@/shared/types/prompt';
import { getCachedPrompts, cachePrompt, addPromptToProfile, archivePrompt as archivePromptStorage, restorePrompt as restorePromptStorage } from '@/core/storage/cache';
import { fetchPrompt, uploadPrompt, getWalletJWK, getWalletAddress, queryAllUserPrompts, updatePromptArchiveStatus } from '@/backend/api/client';
import { indexPrompts, addToIndex, removeFromIndex } from '@/core/search';

// Notification callbacks for upload tracking
export type UploadStartCallback = (txId: string, title: string) => void;
export type UploadCompleteCallback = (txId: string) => void;

interface PromptsState {
  prompts: Prompt[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  selectedTags: string[];
  booleanExpression: BooleanExpression | null;
  activeSavedSearch: SavedSearch | null;
  onUploadStart?: UploadStartCallback;
  onUploadComplete?: UploadCompleteCallback;

  loadPrompts: (password?: string) => Promise<void>;
  addPrompt: (prompt: Omit<Prompt, 'id' | 'createdAt' | 'updatedAt'>, password?: string) => Promise<boolean>;
  updatePrompt: (id: string, updates: Partial<Prompt>, password?: string) => Promise<boolean>;
  archivePrompt: (id: string, password?: string) => Promise<void>;
  restorePrompt: (id: string, password?: string) => Promise<void>;
  setSearchQuery: (query: string) => void;
  toggleTag: (tag: string) => void;
  clearFilters: () => void;
  setBooleanExpression: (expression: BooleanExpression | null, textQuery?: string) => void;
  loadSavedSearch: (search: SavedSearch) => void;
  clearBooleanSearch: () => void;
  setUploadCallbacks: (onStart?: UploadStartCallback, onComplete?: UploadCompleteCallback) => void;
}

export const usePrompts = create<PromptsState>((set, get) => ({
  prompts: [],
  loading: false,
  error: null,
  searchQuery: '',
  selectedTags: [],
  booleanExpression: null,
  activeSavedSearch: null,
  onUploadStart: undefined,
  onUploadComplete: undefined,

  loadPrompts: async (password?: string) => {
    set({ loading: true, error: null });
    try {
      // Get wallet address for GraphQL query
      const walletAddress = await getWalletAddress();
      if (!walletAddress) {
        console.warn('No wallet connected, loading from cache only');
        const cached = getCachedPrompts();
        const cachedPrompts = Object.values(cached);
        indexPrompts(cachedPrompts);
        set({ prompts: cachedPrompts, loading: false });
        return;
      }

      console.log('Discovering prompts for wallet:', walletAddress);

      // Query all user's prompts from Arweave via GraphQL
      const discoveredTxIds = await queryAllUserPrompts(walletAddress);
      console.log(`Discovered ${discoveredTxIds.length} prompts via GraphQL`);

      if (discoveredTxIds.length === 0) {
        set({ prompts: [], loading: false });
        return;
      }

      const cached = getCachedPrompts();
      const cachedPrompts: Prompt[] = [];
      const toFetch: string[] = [];

      // Check what we have cached by currentTxId (only latest versions from query)
      discoveredTxIds.forEach(txId => {
        // Find cached prompt by matching currentTxId
        const cachedPrompt = Object.values(cached).find(p => p.currentTxId === txId);

        if (cachedPrompt) {
          cachedPrompts.push(cachedPrompt);
        } else {
          toFetch.push(txId);
        }
      });

      console.log(`Found ${cachedPrompts.length} in cache, fetching ${toFetch.length} from Arweave`);

      // Fetch missing prompts from Arweave in parallel (with password for decryption)
      if (toFetch.length > 0) {
        const fetched = await Promise.all(
          toFetch.map(txId => fetchPrompt(txId, password))
        );

        const successful = fetched.filter(p => p !== null);
        const failed = fetched.length - successful.length;

        console.log(`[LoadPrompts] Fetch results: ${successful.length} successful, ${failed} failed`);

        fetched.forEach(prompt => {
          if (prompt) {
            cachePrompt(prompt);
            cachedPrompts.push(prompt);

            // Update profile metadata for backward compatibility
            const metadata: PromptMetadata = {
              id: prompt.id,
              title: prompt.title,
              tags: prompt.tags,
              currentTxId: prompt.currentTxId,
              updatedAt: prompt.updatedAt,
              isArchived: prompt.isArchived || false,
            };
            addPromptToProfile(metadata);
          }
        });
      }

      // Index all prompts for search
      indexPrompts(cachedPrompts);

      console.log(`[LoadPrompts] Final count: ${cachedPrompts.length} prompts loaded into state`);

      set({ prompts: cachedPrompts, loading: false });
    } catch (error) {
      console.error('Load prompts error:', error);
      set({ error: 'Failed to load prompts', loading: false });
    }
  },

  addPrompt: async (promptData, password?: string) => {
    try {
      const jwk = await getWalletJWK();

      const prompt: Prompt = {
        ...promptData,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        currentTxId: '',
        versions: [],
        isArchived: false,
        isSynced: false,
      };

      // Upload to Arweave (with password for encryption if needed)
      const result = await uploadPrompt(prompt, jwk, password);
      if (!result.success) {
        throw new Error(result.error || 'Upload failed');
      }

      // Notify upload started
      const { onUploadStart } = get();
      if (onUploadStart) {
        onUploadStart(result.id, prompt.title);
      }

      // Update prompt with TxID
      prompt.currentTxId = result.id;
      prompt.versions = [{
        txId: result.id,
        version: 1,
        timestamp: Date.now(),
      }];
      prompt.isSynced = true;

      // Cache and add to profile
      cachePrompt(prompt);
      const metadata: PromptMetadata = {
        id: prompt.id,
        title: prompt.title,
        tags: prompt.tags,
        currentTxId: prompt.currentTxId,
        updatedAt: prompt.updatedAt,
        isArchived: false,
      };
      addPromptToProfile(metadata);

      // Add to index and state
      addToIndex(prompt);
      set(state => ({ prompts: [prompt, ...state.prompts] }));

      return true;
    } catch (error) {
      console.error('Add prompt error:', error);
      set({ error: 'Failed to create prompt' });
      return false;
    }
  },

  updatePrompt: async (id, updates, password?: string) => {
    try {
      const state = get();
      const existingPrompt = state.prompts.find(p => p.id === id);
      if (!existingPrompt) {
        throw new Error('Prompt not found');
      }

      const jwk = await getWalletJWK();

      // Create new version
      const updatedPrompt: Prompt = {
        ...existingPrompt,
        ...updates,
        updatedAt: Date.now(),
      };

      // Upload new version to Arweave (with password for encryption if needed)
      const result = await uploadPrompt(updatedPrompt, jwk, password);
      if (!result.success) {
        throw new Error(result.error || 'Upload failed');
      }

      // Notify upload started
      const { onUploadStart } = get();
      if (onUploadStart) {
        onUploadStart(result.id, updatedPrompt.title);
      }

      // Update version history
      updatedPrompt.currentTxId = result.id;
      updatedPrompt.versions = [
        ...existingPrompt.versions,
        {
          txId: result.id,
          version: existingPrompt.versions.length + 1,
          timestamp: Date.now(),
          changeNote: updates.content ? 'Content updated' : 'Metadata updated',
        },
      ];
      updatedPrompt.isSynced = true;

      // Cache and update profile
      cachePrompt(updatedPrompt);
      const metadata: PromptMetadata = {
        id: updatedPrompt.id,
        title: updatedPrompt.title,
        tags: updatedPrompt.tags,
        currentTxId: updatedPrompt.currentTxId,
        updatedAt: updatedPrompt.updatedAt,
        isArchived: updatedPrompt.isArchived,
      };
      addPromptToProfile(metadata);

      // Update index and state
      addToIndex(updatedPrompt);
      set(state => ({
        prompts: state.prompts.map(p => p.id === id ? updatedPrompt : p),
      }));

      return true;
    } catch (error) {
      console.error('Update prompt error:', error);
      set({ error: 'Failed to update prompt' });
      return false;
    }
  },

  archivePrompt: async (id, password?: string) => {
    const prompt = get().prompts.find(p => p.id === id);
    if (!prompt) return;

    // Optimistically update UI immediately
    archivePromptStorage(id);
    removeFromIndex(id);
    set(state => ({
      prompts: state.prompts.map(p =>
        p.id === id ? { ...p, isArchived: true } : p
      ),
    }));

    // Upload to Arweave in background with updated archive tag
    try {
      const jwk = await getWalletJWK();
      const result = await updatePromptArchiveStatus(prompt, true, jwk, password);

      if (result.success) {
        // Notify upload started
        const { onUploadStart, onUploadComplete } = get();
        if (onUploadStart) {
          onUploadStart(result.id, `${prompt.title} (archived)`);
        }

        // Update with new txId and version entry
        const updatedPrompt: Prompt = {
          ...prompt,
          isArchived: true,
          currentTxId: result.id,
          versions: [
            ...prompt.versions,
            {
              txId: result.id,
              version: prompt.versions.length, // Same version number (not incremented)
              timestamp: Date.now(),
              changeNote: 'Archived',
            },
          ],
          isSynced: true,
        };

        // Update cache and profile
        cachePrompt(updatedPrompt);
        const metadata: PromptMetadata = {
          id: updatedPrompt.id,
          title: updatedPrompt.title,
          tags: updatedPrompt.tags,
          currentTxId: updatedPrompt.currentTxId,
          updatedAt: updatedPrompt.updatedAt,
          isArchived: true,
        };
        addPromptToProfile(metadata);

        // Update state with new txId
        set(state => ({
          prompts: state.prompts.map(p =>
            p.id === id ? updatedPrompt : p
          ),
        }));
      }
    } catch (error) {
      console.error('Failed to archive prompt on Arweave:', error);
      // UI already updated optimistically, so user sees immediate feedback
      // Background sync will retry on next load
    }
  },

  restorePrompt: async (id, password?: string) => {
    const prompt = get().prompts.find(p => p.id === id);
    if (!prompt) return;

    // Optimistically update UI immediately
    restorePromptStorage(id);
    if (prompt) {
      addToIndex({ ...prompt, isArchived: false });
    }
    set(state => ({
      prompts: state.prompts.map(p =>
        p.id === id ? { ...p, isArchived: false } : p
      ),
    }));

    // Upload to Arweave in background with updated archive tag
    try {
      const jwk = await getWalletJWK();
      const result = await updatePromptArchiveStatus(prompt, false, jwk, password);

      if (result.success) {
        // Notify upload started
        const { onUploadStart, onUploadComplete } = get();
        if (onUploadStart) {
          onUploadStart(result.id, `${prompt.title} (restored)`);
        }

        // Update with new txId and version entry
        const updatedPrompt: Prompt = {
          ...prompt,
          isArchived: false,
          currentTxId: result.id,
          versions: [
            ...prompt.versions,
            {
              txId: result.id,
              version: prompt.versions.length, // Same version number (not incremented)
              timestamp: Date.now(),
              changeNote: 'Restored from archive',
            },
          ],
          isSynced: true,
        };

        // Update cache and profile
        cachePrompt(updatedPrompt);
        const metadata: PromptMetadata = {
          id: updatedPrompt.id,
          title: updatedPrompt.title,
          tags: updatedPrompt.tags,
          currentTxId: updatedPrompt.currentTxId,
          updatedAt: updatedPrompt.updatedAt,
          isArchived: false,
        };
        addPromptToProfile(metadata);

        // Update state with new txId
        set(state => ({
          prompts: state.prompts.map(p =>
            p.id === id ? updatedPrompt : p
          ),
        }));
      }
    } catch (error) {
      console.error('Failed to restore prompt on Arweave:', error);
      // UI already updated optimistically, so user sees immediate feedback
      // Background sync will retry on next load
    }
  },

  setSearchQuery: (query) => {
    set({ searchQuery: query });
  },

  toggleTag: (tag) => {
    set(state => ({
      selectedTags: state.selectedTags.includes(tag)
        ? state.selectedTags.filter(t => t !== tag)
        : [...state.selectedTags, tag],
    }));
  },

  clearFilters: () => {
    set({ searchQuery: '', selectedTags: [], booleanExpression: null, activeSavedSearch: null });
  },

  setBooleanExpression: (expression, textQuery) => {
    set({
      booleanExpression: expression,
      searchQuery: textQuery || '',
      selectedTags: [], // Clear simple tag filters when using boolean
      activeSavedSearch: null, // Clear active saved search if manually setting expression
    });
  },

  loadSavedSearch: (search) => {
    set({
      booleanExpression: search.expression,
      searchQuery: search.textQuery || '',
      selectedTags: [], // Clear simple tag filters
      activeSavedSearch: search,
    });
  },

  clearBooleanSearch: () => {
    set({ booleanExpression: null, activeSavedSearch: null });
  },

  setUploadCallbacks: (onStart, onComplete) => {
    set({ onUploadStart: onStart, onUploadComplete: onComplete });
  },
}));