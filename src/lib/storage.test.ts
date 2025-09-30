import { describe, it, expect, beforeEach } from 'vitest';
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

describe('Storage Utilities', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('Profile Management', () => {
    it('should return null when no profile exists', () => {
      const profile = getProfile();
      expect(profile).toBeNull();
    });

    it('should initialize a new profile', () => {
      const address = 'test-address-123';
      const profile = initializeProfile(address);

      expect(profile.address).toBe(address);
      expect(profile.prompts).toEqual([]);
      expect(profile.lastSync).toBeGreaterThan(0);
    });

    it('should save and retrieve profile', () => {
      const profile: UserProfile = {
        address: 'test-address',
        prompts: [],
        lastSync: Date.now(),
      };

      saveProfile(profile);
      const retrieved = getProfile();

      expect(retrieved).toEqual(profile);
    });

    it('should add prompt metadata to profile', () => {
      const address = 'test-address';
      initializeProfile(address);

      const metadata: PromptMetadata = {
        id: 'prompt-1',
        title: 'Test Prompt',
        tags: ['test', 'demo'],
        currentTxId: 'tx-123',
        updatedAt: Date.now(),
        isArchived: false,
      };

      addPromptToProfile(metadata);
      const profile = getProfile();

      expect(profile?.prompts).toHaveLength(1);
      expect(profile?.prompts[0]).toEqual(metadata);
    });

    it('should update existing prompt in profile', () => {
      const address = 'test-address';
      initializeProfile(address);

      const metadata: PromptMetadata = {
        id: 'prompt-1',
        title: 'Test Prompt',
        tags: ['test'],
        currentTxId: 'tx-123',
        updatedAt: Date.now(),
        isArchived: false,
      };

      addPromptToProfile(metadata);

      const updated: PromptMetadata = {
        ...metadata,
        title: 'Updated Prompt',
        currentTxId: 'tx-456',
      };

      addPromptToProfile(updated);
      const profile = getProfile();

      expect(profile?.prompts).toHaveLength(1);
      expect(profile?.prompts[0].title).toBe('Updated Prompt');
      expect(profile?.prompts[0].currentTxId).toBe('tx-456');
    });

    it('should archive prompt', () => {
      const address = 'test-address';
      initializeProfile(address);

      const metadata: PromptMetadata = {
        id: 'prompt-1',
        title: 'Test Prompt',
        tags: ['test'],
        currentTxId: 'tx-123',
        updatedAt: Date.now(),
        isArchived: false,
      };

      addPromptToProfile(metadata);
      archivePrompt('prompt-1');

      const profile = getProfile();
      expect(profile?.prompts[0].isArchived).toBe(true);
    });

    it('should restore archived prompt', () => {
      const address = 'test-address';
      initializeProfile(address);

      const metadata: PromptMetadata = {
        id: 'prompt-1',
        title: 'Test Prompt',
        tags: ['test'],
        currentTxId: 'tx-123',
        updatedAt: Date.now(),
        isArchived: true,
      };

      addPromptToProfile(metadata);
      restorePrompt('prompt-1');

      const profile = getProfile();
      expect(profile?.prompts[0].isArchived).toBe(false);
    });
  });

  describe('Prompt Caching', () => {
    const mockPrompt: Prompt = {
      id: 'prompt-1',
      title: 'Test Prompt',
      description: 'A test prompt',
      content: 'Test content',
      tags: ['test'],
      currentTxId: 'tx-123',
      versions: [
        {
          txId: 'tx-123',
          version: 1,
          timestamp: Date.now(),
        },
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isArchived: false,
      isSynced: true,
    };

    it('should return empty object when no cached prompts exist', () => {
      const cached = getCachedPrompts();
      expect(cached).toEqual({});
    });

    it('should cache a prompt', () => {
      cachePrompt(mockPrompt);
      const cached = getCachedPrompts();

      expect(cached['prompt-1']).toEqual(mockPrompt);
    });

    it('should retrieve cached prompt by ID', () => {
      cachePrompt(mockPrompt);
      const retrieved = getCachedPrompt('prompt-1');

      expect(retrieved).toEqual(mockPrompt);
    });

    it('should return null for non-existent cached prompt', () => {
      const retrieved = getCachedPrompt('non-existent');
      expect(retrieved).toBeNull();
    });

    it('should clear all cache', () => {
      const address = 'test-address';
      initializeProfile(address);
      cachePrompt(mockPrompt);

      clearCache();

      expect(getProfile()).toBeNull();
      expect(getCachedPrompts()).toEqual({});
    });
  });

  describe('Theme Management', () => {
    it('should return light theme by default', () => {
      const theme = getTheme();
      expect(theme).toBe('light');
    });

    it('should save and retrieve dark theme', () => {
      saveTheme('dark');
      const theme = getTheme();
      expect(theme).toBe('dark');
    });

    it('should save and retrieve light theme', () => {
      saveTheme('light');
      const theme = getTheme();
      expect(theme).toBe('light');
    });
  });
});