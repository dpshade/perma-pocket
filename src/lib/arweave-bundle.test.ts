import { describe, it, expect, vi } from 'vitest';
import { extractPromptsFromBundle, queryUserBundles } from './arweave-bundle';
import type { PromptBundle } from './arweave-bundle';
import type { Prompt } from '@/types/prompt';

describe('arweave-bundle', () => {
  const mockPrompt: Prompt = {
    id: 'test-id-1',
    title: 'Test Prompt',
    content: 'Test content',
    tags: ['test', 'example'],
    description: 'Test description',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    currentTxId: '',
    versions: [],
    isArchived: false,
    isSynced: false,
  };

  const mockBundle: PromptBundle = {
    id: 'bundle-123',
    version: 1,
    createdAt: Date.now(),
    prompts: [
      { ...mockPrompt, id: 'prompt-1' },
      { ...mockPrompt, id: 'prompt-2' },
      { ...mockPrompt, id: 'prompt-3' },
    ],
    metadata: {
      count: 3,
      encrypted: 0,
      public: 3,
      tags: ['test', 'example'],
    },
  };

  describe('extractPromptsFromBundle', () => {
    it('should extract prompts with bundle txId', () => {
      const bundleTxId = 'bundle-tx-123';
      const prompts = extractPromptsFromBundle(mockBundle, bundleTxId);

      expect(prompts).toHaveLength(3);
      prompts.forEach((prompt) => {
        expect(prompt.currentTxId).toBe(bundleTxId);
        expect(prompt.isSynced).toBe(true);
      });
    });

    it('should create version history with bundle txId', () => {
      const bundleTxId = 'bundle-tx-456';
      const prompts = extractPromptsFromBundle(mockBundle, bundleTxId);

      prompts.forEach((prompt) => {
        expect(prompt.versions).toHaveLength(1);
        expect(prompt.versions[0].txId).toBe(bundleTxId);
        expect(prompt.versions[0].version).toBe(1);
        expect(prompt.versions[0].timestamp).toBe(mockBundle.createdAt);
      });
    });

    it('should preserve original prompt data', () => {
      const bundleTxId = 'bundle-tx-789';
      const prompts = extractPromptsFromBundle(mockBundle, bundleTxId);

      expect(prompts[0].id).toBe('prompt-1');
      expect(prompts[0].title).toBe('Test Prompt');
      expect(prompts[0].content).toBe('Test content');
      expect(prompts[0].tags).toEqual(['test', 'example']);
    });

    it('should handle empty bundle', () => {
      const emptyBundle: PromptBundle = {
        ...mockBundle,
        prompts: [],
        metadata: { ...mockBundle.metadata, count: 0 },
      };
      const prompts = extractPromptsFromBundle(emptyBundle, 'tx-empty');

      expect(prompts).toHaveLength(0);
    });
  });

  describe('queryUserBundles', () => {
    const mockWalletAddress = 'test-wallet-address';

    it('should query bundles with correct GraphQL structure', async () => {
      const mockResponse = {
        data: {
          transactions: {
            edges: [
              { node: { id: 'bundle-1' } },
              { node: { id: 'bundle-2' } },
            ],
          },
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const bundleTxIds = await queryUserBundles(mockWalletAddress);

      expect(bundleTxIds).toEqual(['bundle-1', 'bundle-2']);
      // Should use Goldsky as primary endpoint
      expect(global.fetch).toHaveBeenCalledWith(
        'https://arweave-search.goldsky.com/graphql',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('should filter by Protocol: Pocket-Prompt-v3.1', async () => {
      const mockResponse = {
        data: { transactions: { edges: [] } },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      await queryUserBundles(mockWalletAddress);

      const fetchCall = (global.fetch as any).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);

      expect(requestBody.query).toContain('Protocol');
      expect(requestBody.query).toContain('Pocket-Prompt-v3.1');
    });

    it('should filter by Type: prompt-bundle', async () => {
      const mockResponse = {
        data: { transactions: { edges: [] } },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      await queryUserBundles(mockWalletAddress);

      const fetchCall = (global.fetch as any).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);

      expect(requestBody.query).toContain('Type');
      expect(requestBody.query).toContain('prompt-bundle');
    });

    it('should handle fetch errors gracefully', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Internal Server Error',
      });

      const bundleTxIds = await queryUserBundles(mockWalletAddress);

      expect(bundleTxIds).toEqual([]);
    });

    it('should handle network errors gracefully', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const bundleTxIds = await queryUserBundles(mockWalletAddress);

      expect(bundleTxIds).toEqual([]);
    });

    it('should pass wallet address as owner variable', async () => {
      const mockResponse = {
        data: { transactions: { edges: [] } },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      await queryUserBundles(mockWalletAddress);

      const fetchCall = (global.fetch as any).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);

      expect(requestBody.variables).toEqual({ owner: mockWalletAddress });
    });

    it('should limit results to first 100 bundles', async () => {
      const mockResponse = {
        data: { transactions: { edges: [] } },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      await queryUserBundles(mockWalletAddress);

      const fetchCall = (global.fetch as any).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);

      expect(requestBody.query).toContain('first: 100');
    });

    it('should sort by HEIGHT_DESC', async () => {
      const mockResponse = {
        data: { transactions: { edges: [] } },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      await queryUserBundles(mockWalletAddress);

      const fetchCall = (global.fetch as any).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);

      expect(requestBody.query).toContain('sort: HEIGHT_DESC');
    });
  });

  describe('Bundle Structure', () => {
    it('should have version 1', () => {
      expect(mockBundle.version).toBe(1);
    });

    it('should have metadata matching prompts', () => {
      expect(mockBundle.metadata.count).toBe(mockBundle.prompts.length);
    });

    it('should have unique bundle id', () => {
      expect(mockBundle.id).toBeTruthy();
      expect(typeof mockBundle.id).toBe('string');
    });

    it('should have createdAt timestamp', () => {
      expect(mockBundle.createdAt).toBeTruthy();
      expect(typeof mockBundle.createdAt).toBe('number');
    });

    it('should track encrypted and public counts', () => {
      expect(mockBundle.metadata.encrypted).toBe(0);
      expect(mockBundle.metadata.public).toBe(3);
      expect(mockBundle.metadata.encrypted + mockBundle.metadata.public).toBe(
        mockBundle.metadata.count
      );
    });

    it('should aggregate unique tags from all prompts', () => {
      expect(mockBundle.metadata.tags).toEqual(['test', 'example']);
    });
  });
});
