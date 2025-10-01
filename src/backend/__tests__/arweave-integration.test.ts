import { describe, it, expect } from 'vitest';
import { getQueryFilters, getUploadTags } from '@/backend/config/arweave';
import type { Prompt } from '@/shared/types/prompt';

describe('Arweave Config Integration', () => {
  const mockPrompt: Prompt = {
    id: 'integration-test-id',
    title: 'Integration Test Prompt',
    description: 'Testing config integration',
    content: 'Test content',
    tags: ['integration', 'test'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    currentTxId: '',
    versions: [],
    isSynced: false,
    isArchived: false,
  };

  describe('Upload Tag Generation', () => {
    it('should generate tags with Protocol v3 for encrypted prompt', () => {
      const tags = getUploadTags(mockPrompt, true);

      const protocolTag = tags.find(t => t.name === 'Protocol');
      expect(protocolTag).toBeDefined();
      expect(protocolTag?.value).toBe('Pocket-Prompt-v3.1');

      const encryptedTag = tags.find(t => t.name === 'Encrypted');
      expect(encryptedTag).toBeDefined();
      expect(encryptedTag?.value).toBe('true');
    });

    it('should generate tags with Protocol v3 for public prompt', () => {
      const tags = getUploadTags(mockPrompt, false);

      const protocolTag = tags.find(t => t.name === 'Protocol');
      expect(protocolTag).toBeDefined();
      expect(protocolTag?.value).toBe('Pocket-Prompt-v3.1');

      const encryptedTag = tags.find(t => t.name === 'Encrypted');
      expect(encryptedTag).toBeDefined();
      expect(encryptedTag?.value).toBe('false');
    });

    it('should generate all required tags for Arweave upload', () => {
      const tags = getUploadTags(mockPrompt, true);
      const tagNames = new Set(tags.map(t => t.name));

      // Verify all required tags are present
      const requiredTags = [
        'Content-Type',
        'App-Name',
        'App-Version',
        'Type',
        'Protocol',
        'Data-Protocol',
        'Prompt-Id',
        'Title',
        'Description',
        'Created-At',
        'Updated-At',
        'Version',
        'Encrypted',
      ];

      requiredTags.forEach(tagName => {
        expect(tagNames.has(tagName)).toBe(true);
      });
    });

    it('should include user-defined tags', () => {
      const tags = getUploadTags(mockPrompt, true);
      const userTags = tags.filter(t => t.name === 'Tag');

      expect(userTags).toHaveLength(2);
      expect(userTags.map(t => t.value)).toEqual(['integration', 'test']);
    });

    it('should use App-Version 2.0.0 from config', () => {
      const tags = getUploadTags(mockPrompt, true);
      const versionTag = tags.find(t => t.name === 'App-Version');

      expect(versionTag).toBeDefined();
      expect(versionTag?.value).toBe('3.1.0');
    });
  });

  describe('GraphQL Query Filters', () => {
    it('should extract Protocol v3 from config', () => {
      const filters = getQueryFilters();

      expect(filters.protocol).toBe('Pocket-Prompt-v3.1');
    });

    it('should extract App-Name from config', () => {
      const filters = getQueryFilters();

      expect(filters.appName).toBe('Pocket Prompt');
    });

    it('should have consistent Protocol between upload and query', () => {
      const uploadTags = getUploadTags(mockPrompt, true);
      const queryFilters = getQueryFilters();

      const uploadProtocol = uploadTags.find(t => t.name === 'Protocol')?.value;

      expect(uploadProtocol).toBe(queryFilters.protocol);
      expect(queryFilters.protocol).toBe('Pocket-Prompt-v3.1');
    });
  });

  describe('Config-Based Tag Consistency', () => {
    it('should ensure upload and query use same Protocol version', () => {
      const uploadTags = getUploadTags(mockPrompt, true);
      const queryFilters = getQueryFilters();

      const uploadProtocol = uploadTags.find(t => t.name === 'Protocol')?.value;
      const queryProtocol = queryFilters.protocol;

      expect(uploadProtocol).toBe(queryProtocol);
    });

    it('should ensure upload and query use same App-Name', () => {
      const uploadTags = getUploadTags(mockPrompt, true);
      const queryFilters = getQueryFilters();

      const uploadAppName = uploadTags.find(t => t.name === 'App-Name')?.value;
      const queryAppName = queryFilters.appName;

      expect(uploadAppName).toBe(queryAppName);
    });

    it('should generate identical tags for same prompt parameters', () => {
      const tags1 = getUploadTags(mockPrompt, true);
      const tags2 = getUploadTags(mockPrompt, true);

      expect(tags1).toEqual(tags2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle prompt with empty description', () => {
      const promptWithoutDesc = { ...mockPrompt, description: '' };
      const tags = getUploadTags(promptWithoutDesc, true);

      const descTag = tags.find(t => t.name === 'Description');
      expect(descTag).toBeDefined();
      expect(descTag?.value).toBe('');
    });

    it('should handle prompt with undefined description', () => {
      const { description, ...rest } = mockPrompt;
      const promptWithoutDesc = rest as Prompt;
      const tags = getUploadTags(promptWithoutDesc, true);

      const descTag = tags.find(t => t.name === 'Description');
      expect(descTag).toBeDefined();
      expect(descTag?.value).toBe('');
    });

    it('should handle prompt with no user tags', () => {
      const promptWithoutTags = { ...mockPrompt, tags: [] };
      const tags = getUploadTags(promptWithoutTags, true);

      const userTags = tags.filter(t => t.name === 'Tag');
      expect(userTags).toHaveLength(0);
    });

    it('should handle prompt with many versions', () => {
      const versions = Array.from({ length: 10 }, (_, i) => ({
        txId: `v${i + 1}-tx`,
        version: i + 1,
        timestamp: Date.now(),
      }));

      const promptWithVersions = { ...mockPrompt, versions };
      const tags = getUploadTags(promptWithVersions, true);

      const versionTag = tags.find(t => t.name === 'Version');
      expect(versionTag).toBeDefined();
      expect(versionTag?.value).toBe('10');
    });
  });

  describe('Protocol Version Verification', () => {
    it('should never use v1 protocol', () => {
      const uploadTags = getUploadTags(mockPrompt, true);
      const queryFilters = getQueryFilters();

      const uploadProtocol = uploadTags.find(t => t.name === 'Protocol')?.value;

      expect(uploadProtocol).not.toBe('Pocket-Prompt-v1');
      expect(queryFilters.protocol).not.toBe('Pocket-Prompt-v1');
    });

    it('should never use v2 protocol', () => {
      const uploadTags = getUploadTags(mockPrompt, true);
      const queryFilters = getQueryFilters();

      const uploadProtocol = uploadTags.find(t => t.name === 'Protocol')?.value;

      expect(uploadProtocol).not.toBe('Pocket-Prompt-v2');
      expect(queryFilters.protocol).not.toBe('Pocket-Prompt-v2');
    });

    it('should use v3 protocol exclusively', () => {
      const uploadTags = getUploadTags(mockPrompt, true);
      const queryFilters = getQueryFilters();

      const uploadProtocol = uploadTags.find(t => t.name === 'Protocol')?.value;

      expect(uploadProtocol).toBe('Pocket-Prompt-v3.1');
      expect(queryFilters.protocol).toBe('Pocket-Prompt-v3.1');
    });
  });
});
