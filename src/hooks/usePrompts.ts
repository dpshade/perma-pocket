import { create } from 'zustand';
import type { Prompt, PromptMetadata } from '@/types/prompt';
import { getProfile, getCachedPrompts, cachePrompt, addPromptToProfile, archivePrompt as archivePromptStorage, restorePrompt as restorePromptStorage } from '@/lib/storage';
import { fetchPrompt, uploadPrompt, getWalletJWK } from '@/lib/arweave';
import { indexPrompts, addToIndex, removeFromIndex } from '@/lib/search';

interface PromptsState {
  prompts: Prompt[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  selectedTags: string[];

  loadPrompts: () => Promise<void>;
  addPrompt: (prompt: Omit<Prompt, 'id' | 'createdAt' | 'updatedAt'>) => Promise<boolean>;
  updatePrompt: (id: string, updates: Partial<Prompt>) => Promise<boolean>;
  archivePrompt: (id: string) => void;
  restorePrompt: (id: string) => void;
  setSearchQuery: (query: string) => void;
  toggleTag: (tag: string) => void;
  clearFilters: () => void;
}

export const usePrompts = create<PromptsState>((set, get) => ({
  prompts: [],
  loading: false,
  error: null,
  searchQuery: '',
  selectedTags: [],

  loadPrompts: async () => {
    set({ loading: true, error: null });
    try {
      const profile = getProfile();
      if (!profile) {
        set({ prompts: [], loading: false });
        return;
      }

      const cached = getCachedPrompts();
      const cachedPrompts: Prompt[] = [];
      const toFetch: string[] = [];

      // Check what we have cached
      profile.prompts.forEach(meta => {
        const cachedPrompt = cached[meta.id];
        if (cachedPrompt) {
          cachedPrompts.push(cachedPrompt);
        } else {
          toFetch.push(meta.currentTxId);
        }
      });

      // Fetch missing prompts from Arweave
      if (toFetch.length > 0) {
        const fetched = await Promise.all(
          toFetch.map(txId => fetchPrompt(txId))
        );

        fetched.forEach(prompt => {
          if (prompt) {
            cachePrompt(prompt);
            cachedPrompts.push(prompt);
          }
        });
      }

      // Index all prompts for search
      indexPrompts(cachedPrompts);

      set({ prompts: cachedPrompts, loading: false });
    } catch (error) {
      console.error('Load prompts error:', error);
      set({ error: 'Failed to load prompts', loading: false });
    }
  },

  addPrompt: async (promptData) => {
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

      // Upload to Arweave
      const result = await uploadPrompt(prompt, jwk);
      if (!result.success) {
        throw new Error(result.error || 'Upload failed');
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

  updatePrompt: async (id, updates) => {
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

      // Upload new version to Arweave
      const result = await uploadPrompt(updatedPrompt, jwk);
      if (!result.success) {
        throw new Error(result.error || 'Upload failed');
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

  archivePrompt: (id) => {
    archivePromptStorage(id);
    removeFromIndex(id);
    set(state => ({
      prompts: state.prompts.map(p =>
        p.id === id ? { ...p, isArchived: true } : p
      ),
    }));
  },

  restorePrompt: (id) => {
    restorePromptStorage(id);
    const prompt = get().prompts.find(p => p.id === id);
    if (prompt) {
      addToIndex({ ...prompt, isArchived: false });
    }
    set(state => ({
      prompts: state.prompts.map(p =>
        p.id === id ? { ...p, isArchived: false } : p
      ),
    }));
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
    set({ searchQuery: '', selectedTags: [] });
  },
}));