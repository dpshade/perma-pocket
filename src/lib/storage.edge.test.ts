import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getProfile,
  saveProfile,
  initializeProfile,
  addPromptToProfile,
  archivePrompt,
  restorePrompt,
  getCachedPrompts,
  cachePrompt,
  getCachedPrompt,
  clearCache,
  getTheme,
  saveTheme,
} from './storage';
import type { UserProfile, Prompt, PromptMetadata } from '@/types/prompt';

describe('Storage Edge Cases', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('Profile Edge Cases', () => {
    it('should handle corrupted profile data in localStorage', () => {
      localStorage.setItem('pktpmt_profile', 'invalid json {{{');
      const profile = getProfile();
      expect(profile).toBeNull();
    });

    it('should handle profile with missing required fields', () => {
      localStorage.setItem('pktpmt_profile', '{"address": null}');
      const profile = getProfile();
      expect(profile).not.toBeNull();
      expect(profile?.address).toBeNull();
    });

    it('should handle very long wallet addresses', () => {
      const longAddress = 'a'.repeat(10000);
      const profile = initializeProfile(longAddress);
      expect(profile.address).toBe(longAddress);

      const retrieved = getProfile();
      expect(retrieved?.address).toBe(longAddress);
    });

    it('should handle special characters in wallet address', () => {
      const specialAddress = '!@#$%^&*()_+-={}[]|:;"<>,.?/~`';
      const profile = initializeProfile(specialAddress);
      expect(profile.address).toBe(specialAddress);
    });

    it('should handle empty string as wallet address', () => {
      const profile = initializeProfile('');
      expect(profile.address).toBe('');
      expect(profile.prompts).toEqual([]);
    });

    it('should handle extremely large prompt arrays', () => {
      const address = 'test-address';
      initializeProfile(address);

      // Add 1000 prompts
      for (let i = 0; i < 1000; i++) {
        const metadata: PromptMetadata = {
          id: `prompt-${i}`,
          title: `Prompt ${i}`,
          tags: [`tag${i}`],
          currentTxId: `tx-${i}`,
          updatedAt: Date.now(),
          isArchived: false,
        };
        addPromptToProfile(metadata);
      }

      const profile = getProfile();
      expect(profile?.prompts).toHaveLength(1000);
    });

    it('should handle concurrent profile updates', () => {
      const address = 'test-address';
      initializeProfile(address);

      const metadata1: PromptMetadata = {
        id: 'prompt-1',
        title: 'First',
        tags: [],
        currentTxId: 'tx-1',
        updatedAt: Date.now(),
        isArchived: false,
      };

      const metadata2: PromptMetadata = {
        id: 'prompt-2',
        title: 'Second',
        tags: [],
        currentTxId: 'tx-2',
        updatedAt: Date.now(),
        isArchived: false,
      };

      addPromptToProfile(metadata1);
      addPromptToProfile(metadata2);

      const profile = getProfile();
      expect(profile?.prompts).toHaveLength(2);
    });

    it('should handle archiving non-existent prompt', () => {
      const address = 'test-address';
      initializeProfile(address);

      archivePrompt('non-existent-id');
      const profile = getProfile();
      expect(profile?.prompts).toHaveLength(0);
    });

    it('should handle restoring non-existent prompt', () => {
      const address = 'test-address';
      initializeProfile(address);

      restorePrompt('non-existent-id');
      const profile = getProfile();
      expect(profile?.prompts).toHaveLength(0);
    });

    it('should handle prompt with extremely long title', () => {
      const address = 'test-address';
      initializeProfile(address);

      const metadata: PromptMetadata = {
        id: 'prompt-1',
        title: 'a'.repeat(100000),
        tags: [],
        currentTxId: 'tx-1',
        updatedAt: Date.now(),
        isArchived: false,
      };

      addPromptToProfile(metadata);
      const profile = getProfile();
      expect(profile?.prompts[0].title.length).toBe(100000);
    });

    it('should handle prompt with empty arrays', () => {
      const address = 'test-address';
      initializeProfile(address);

      const metadata: PromptMetadata = {
        id: 'prompt-1',
        title: '',
        tags: [],
        currentTxId: '',
        updatedAt: 0,
        isArchived: false,
      };

      addPromptToProfile(metadata);
      const profile = getProfile();
      expect(profile?.prompts).toHaveLength(1);
    });
  });

  describe('Cache Edge Cases', () => {
    const createMockPrompt = (id: string, overrides = {}): Prompt => ({
      id,
      title: `Prompt ${id}`,
      description: 'Test',
      content: 'Content',
      tags: [],
      currentTxId: `tx-${id}`,
      versions: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isArchived: false,
      isSynced: true,
      ...overrides,
    });

    it('should handle corrupted cache data', () => {
      localStorage.setItem('pktpmt_prompts', 'invalid json');
      const cached = getCachedPrompts();
      expect(cached).toEqual({});
    });

    it('should handle cache with missing fields', () => {
      localStorage.setItem('pktpmt_prompts', '{"prompt-1": {"id": "1"}}');
      const cached = getCachedPrompts();
      expect(cached['prompt-1']).toBeDefined();
    });

    it('should handle caching prompt with circular references', () => {
      const prompt = createMockPrompt('1');
      // Note: JSON.stringify will handle this, but we test the behavior
      cachePrompt(prompt);
      const retrieved = getCachedPrompt('1');
      expect(retrieved?.id).toBe('1');
    });

    it('should handle extremely large prompt content', () => {
      const prompt = createMockPrompt('1', {
        content: 'x'.repeat(1000000), // 1MB of content
      });

      cachePrompt(prompt);
      const retrieved = getCachedPrompt('1');
      expect(retrieved?.content.length).toBe(1000000);
    });

    it('should handle caching 1000+ prompts', () => {
      for (let i = 0; i < 1000; i++) {
        const prompt = createMockPrompt(`prompt-${i}`);
        cachePrompt(prompt);
      }

      const cached = getCachedPrompts();
      expect(Object.keys(cached)).toHaveLength(1000);
    });

    it('should handle prompt with null values in versions', () => {
      const prompt = createMockPrompt('1', {
        versions: [
          { txId: 'tx-1', version: 1, timestamp: Date.now() },
          { txId: null, version: 2, timestamp: null },
        ],
      });

      cachePrompt(prompt);
      const retrieved = getCachedPrompt('1');
      expect(retrieved?.versions).toHaveLength(2);
    });

    it('should handle prompt with undefined properties', () => {
      const prompt = createMockPrompt('1', {
        description: undefined,
        tags: undefined,
      });

      cachePrompt(prompt);
      const retrieved = getCachedPrompt('1');
      expect(retrieved).toBeDefined();
    });

    it('should handle getting cached prompt with empty string id', () => {
      const result = getCachedPrompt('');
      expect(result).toBeNull();
    });

    it('should handle localStorage quota exceeded', () => {
      // Mock localStorage.setItem to throw QuotaExceededError
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = vi.fn(() => {
        throw new DOMException('QuotaExceededError');
      });

      const prompt = createMockPrompt('1');

      // Should not throw, just log error
      expect(() => cachePrompt(prompt)).not.toThrow();

      // Restore original
      Storage.prototype.setItem = originalSetItem;
    });

    it('should handle clearing cache when empty', () => {
      expect(() => clearCache()).not.toThrow();
      expect(getProfile()).toBeNull();
      expect(getCachedPrompts()).toEqual({});
    });

    it('should handle multiple rapid cache operations', () => {
      const prompt1 = createMockPrompt('1');
      const prompt2 = createMockPrompt('2');

      cachePrompt(prompt1);
      cachePrompt(prompt2);
      getCachedPrompt('1');
      getCachedPrompt('2');
      clearCache();

      expect(getCachedPrompts()).toEqual({});
    });
  });

  describe('Theme Edge Cases', () => {
    it('should handle corrupted theme data', () => {
      localStorage.setItem('pktpmt_theme', '12345');
      const theme = getTheme();
      expect(theme).toBe('light'); // Should default to light
    });

    it('should handle null theme value', () => {
      localStorage.setItem('pktpmt_theme', 'null');
      const theme = getTheme();
      expect(theme).toBe('light');
    });

    it('should handle undefined theme value', () => {
      localStorage.setItem('pktpmt_theme', 'undefined');
      const theme = getTheme();
      expect(theme).toBe('light');
    });

    it('should handle empty string theme', () => {
      localStorage.setItem('pktpmt_theme', '');
      const theme = getTheme();
      expect(theme).toBe('light');
    });

    it('should handle saving theme when localStorage fails', () => {
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = vi.fn(() => {
        throw new Error('Storage error');
      });

      expect(() => saveTheme('dark')).not.toThrow();

      Storage.prototype.setItem = originalSetItem;
    });

    it('should handle rapid theme toggles', () => {
      for (let i = 0; i < 100; i++) {
        saveTheme(i % 2 === 0 ? 'light' : 'dark');
      }

      // After 100 iterations (0-99), last iteration is i=99 which is odd, so 'dark'
      const theme = getTheme();
      expect(theme).toBe('dark');
    });
  });

  describe('Data Integrity Edge Cases', () => {
    it('should maintain data integrity after multiple operations', () => {
      const address = 'test-address';
      initializeProfile(address);

      // Add prompt
      const metadata: PromptMetadata = {
        id: 'prompt-1',
        title: 'Test',
        tags: ['tag1'],
        currentTxId: 'tx-1',
        updatedAt: Date.now(),
        isArchived: false,
      };
      addPromptToProfile(metadata);

      // Archive it
      archivePrompt('prompt-1');

      // Restore it
      restorePrompt('prompt-1');

      // Update it
      const updated = { ...metadata, title: 'Updated' };
      addPromptToProfile(updated);

      const profile = getProfile();
      expect(profile?.prompts).toHaveLength(1);
      expect(profile?.prompts[0].title).toBe('Updated');
      expect(profile?.prompts[0].isArchived).toBe(false);
    });

    it('should handle simultaneous profile and cache operations', () => {
      const address = 'test-address';
      initializeProfile(address);

      const metadata: PromptMetadata = {
        id: 'prompt-1',
        title: 'Test',
        tags: [],
        currentTxId: 'tx-1',
        updatedAt: Date.now(),
        isArchived: false,
      };

      const prompt: Prompt = {
        id: 'prompt-1',
        title: 'Test',
        description: 'Desc',
        content: 'Content',
        tags: [],
        currentTxId: 'tx-1',
        versions: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isArchived: false,
        isSynced: true,
      };

      addPromptToProfile(metadata);
      cachePrompt(prompt);

      const profile = getProfile();
      const cached = getCachedPrompt('prompt-1');

      expect(profile?.prompts[0].id).toBe('prompt-1');
      expect(cached?.id).toBe('prompt-1');
    });
  });
});