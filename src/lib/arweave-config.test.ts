import { describe, it, expect } from 'vitest';
import {
  getStaticTags,
  getDynamicTags,
  getArrayTags,
  getUploadTags,
  getProtocolVersion,
  getQueryFilters,
} from './arweave-config';
import type { Prompt } from '@/types/prompt';

describe('Arweave Config Utilities', () => {
  const mockPrompt: Prompt = {
    id: 'test-id-123',
    title: 'Test Prompt',
    description: 'Test description',
    content: 'Test content',
    tags: ['test', 'example', 'demo'],
    createdAt: 1234567890,
    updatedAt: 1234567899,
    currentTxId: 'test-tx-id',
    versions: [
      { txId: 'v1-tx', version: 1, timestamp: 1234567890 },
      { txId: 'v2-tx', version: 2, timestamp: 1234567899 },
    ],
    isSynced: true,
    isArchived: false,
  };

  describe('getStaticTags', () => {
    it('should load static tags from config', () => {
      const tags = getStaticTags();

      expect(tags).toEqual(
        expect.arrayContaining([
          { name: 'Content-Type', value: 'application/json' },
          { name: 'App-Name', value: 'Pocket Prompt' },
          { name: 'App-Version', value: '3.1.0' },
          { name: 'Type', value: 'prompt' },
          { name: 'Protocol', value: 'Pocket-Prompt-v3.1' },
          { name: 'Data-Protocol', value: 'Prompt' },
        ])
      );
    });

    it('should have Protocol tag set to v3', () => {
      const tags = getStaticTags();
      const protocolTag = tags.find(t => t.name === 'Protocol');

      expect(protocolTag).toBeDefined();
      expect(protocolTag?.value).toBe('Pocket-Prompt-v3.1');
    });

    it('should have App-Version set to 2.0.0', () => {
      const tags = getStaticTags();
      const versionTag = tags.find(t => t.name === 'App-Version');

      expect(versionTag).toBeDefined();
      expect(versionTag?.value).toBe('3.1.0');
    });
  });

  describe('getDynamicTags', () => {
    it('should generate dynamic tags for encrypted prompt', () => {
      const tags = getDynamicTags(mockPrompt, true);

      expect(tags).toEqual(
        expect.arrayContaining([
          { name: 'Prompt-Id', value: 'test-id-123' },
          { name: 'Title', value: 'Test Prompt' },
          { name: 'Description', value: 'Test description' },
          { name: 'Created-At', value: '1234567890' },
          { name: 'Updated-At', value: '1234567899' },
          { name: 'Version', value: '2' },
          { name: 'Encrypted', value: 'true' },
        ])
      );
    });

    it('should generate dynamic tags for public prompt', () => {
      const tags = getDynamicTags(mockPrompt, false);
      const encryptedTag = tags.find(t => t.name === 'Encrypted');

      expect(encryptedTag).toBeDefined();
      expect(encryptedTag?.value).toBe('false');
    });

    it('should handle prompt without description', () => {
      const { description, ...rest } = mockPrompt;
      const promptWithoutDesc = rest as Prompt;
      const tags = getDynamicTags(promptWithoutDesc, true);
      const descTag = tags.find(t => t.name === 'Description');

      expect(descTag).toBeDefined();
      expect(descTag?.value).toBe('');
    });

    it('should convert version count to string', () => {
      const tags = getDynamicTags(mockPrompt, true);
      const versionTag = tags.find(t => t.name === 'Version');

      expect(versionTag).toBeDefined();
      expect(versionTag?.value).toBe('2'); // mockPrompt has 2 versions
    });
  });

  describe('getArrayTags', () => {
    it('should generate Tag entries for each user tag', () => {
      const tags = getArrayTags(mockPrompt);

      expect(tags).toEqual([
        { name: 'Tag', value: 'test' },
        { name: 'Tag', value: 'example' },
        { name: 'Tag', value: 'demo' },
      ]);
    });

    it('should return empty array for prompt without tags', () => {
      const promptWithoutTags = { ...mockPrompt, tags: [] };
      const tags = getArrayTags(promptWithoutTags);

      expect(tags).toEqual([]);
    });

    it('should handle special characters in tags', () => {
      const promptWithSpecialTags = {
        ...mockPrompt,
        tags: ['test-tag', 'tag_with_underscore', 'tag.with.dots'],
      };
      const tags = getArrayTags(promptWithSpecialTags);

      expect(tags).toEqual([
        { name: 'Tag', value: 'test-tag' },
        { name: 'Tag', value: 'tag_with_underscore' },
        { name: 'Tag', value: 'tag.with.dots' },
      ]);
    });
  });

  describe('getUploadTags', () => {
    it('should combine all tag types for encrypted prompt', () => {
      const tags = getUploadTags(mockPrompt, true);

      // Check for static tags
      expect(tags).toEqual(
        expect.arrayContaining([
          { name: 'Protocol', value: 'Pocket-Prompt-v3.1' },
          { name: 'App-Name', value: 'Pocket Prompt' },
          { name: 'Content-Type', value: 'application/json' },
        ])
      );

      // Check for dynamic tags
      expect(tags).toEqual(
        expect.arrayContaining([
          { name: 'Prompt-Id', value: 'test-id-123' },
          { name: 'Title', value: 'Test Prompt' },
          { name: 'Encrypted', value: 'true' },
        ])
      );

      // Check for array tags
      expect(tags).toEqual(
        expect.arrayContaining([
          { name: 'Tag', value: 'test' },
          { name: 'Tag', value: 'example' },
          { name: 'Tag', value: 'demo' },
        ])
      );
    });

    it('should have correct Encrypted tag for public prompt', () => {
      const tags = getUploadTags(mockPrompt, false);
      const encryptedTag = tags.find(t => t.name === 'Encrypted');

      expect(encryptedTag?.value).toBe('false');
    });

    it('should include all expected tag names', () => {
      const tags = getUploadTags(mockPrompt, true);
      const tagNames = tags.map(t => t.name);

      expect(tagNames).toContain('Content-Type');
      expect(tagNames).toContain('App-Name');
      expect(tagNames).toContain('App-Version');
      expect(tagNames).toContain('Type');
      expect(tagNames).toContain('Protocol');
      expect(tagNames).toContain('Data-Protocol');
      expect(tagNames).toContain('Prompt-Id');
      expect(tagNames).toContain('Title');
      expect(tagNames).toContain('Description');
      expect(tagNames).toContain('Created-At');
      expect(tagNames).toContain('Updated-At');
      expect(tagNames).toContain('Version');
      expect(tagNames).toContain('Encrypted');
      expect(tagNames).toContain('Tag');
    });
  });

  describe('getProtocolVersion', () => {
    it('should return v3 protocol version from config', () => {
      const version = getProtocolVersion();

      expect(version).toBe('Pocket-Prompt-v3.1');
    });
  });

  describe('getQueryFilters', () => {
    it('should extract query filters from config', () => {
      const filters = getQueryFilters();

      expect(filters.protocol).toBe('Pocket-Prompt-v3.1');
      expect(filters.appName).toBe('Pocket Prompt');
    });

    it('should match Protocol tag in upload tags', () => {
      const filters = getQueryFilters();
      const uploadTags = getStaticTags();
      const protocolTag = uploadTags.find(t => t.name === 'Protocol');

      expect(filters.protocol).toBe(protocolTag?.value);
    });
  });

  describe('Config Consistency', () => {
    it('should have matching Protocol values in upload and query', () => {
      const uploadTags = getStaticTags();
      const queryFilters = getQueryFilters();
      const uploadProtocol = uploadTags.find(t => t.name === 'Protocol');

      expect(uploadProtocol?.value).toBe(queryFilters.protocol);
    });

    it('should have matching App-Name values in upload and query', () => {
      const uploadTags = getStaticTags();
      const queryFilters = getQueryFilters();
      const uploadAppName = uploadTags.find(t => t.name === 'App-Name');

      expect(uploadAppName?.value).toBe(queryFilters.appName);
    });
  });
});
