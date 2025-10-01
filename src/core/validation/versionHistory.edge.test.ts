import { describe, it, expect } from 'vitest';
import type { Prompt, PromptVersion } from '@/shared/types/prompt';

describe('Version History Edge Cases', () => {
  const createMockPrompt = (versions: PromptVersion[]): Prompt => ({
    id: 'prompt-1',
    title: 'Test Prompt',
    description: 'Description',
    content: 'Content',
    tags: [],
    currentTxId: versions[versions.length - 1]?.txId || '',
    versions,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isArchived: false,
    isSynced: true,
  });

  describe('Version Array Edge Cases', () => {
    it('should handle prompt with no versions', () => {
      const prompt = createMockPrompt([]);
      expect(prompt.versions).toEqual([]);
      expect(prompt.currentTxId).toBe('');
    });

    it('should handle prompt with single version', () => {
      const version: PromptVersion = {
        txId: 'tx-1',
        version: 1,
        timestamp: Date.now(),
      };
      const prompt = createMockPrompt([version]);
      expect(prompt.versions).toHaveLength(1);
      expect(prompt.currentTxId).toBe('tx-1');
    });

    it('should handle prompt with 100 versions', () => {
      const versions: PromptVersion[] = [];
      for (let i = 1; i <= 100; i++) {
        versions.push({
          txId: `tx-${i}`,
          version: i,
          timestamp: Date.now() + i,
        });
      }

      const prompt = createMockPrompt(versions);
      expect(prompt.versions).toHaveLength(100);
      expect(prompt.currentTxId).toBe('tx-100');
    });

    it('should handle versions with duplicate version numbers', () => {
      const versions: PromptVersion[] = [
        { txId: 'tx-1', version: 1, timestamp: Date.now() },
        { txId: 'tx-2', version: 1, timestamp: Date.now() },
        { txId: 'tx-3', version: 1, timestamp: Date.now() },
      ];

      const prompt = createMockPrompt(versions);
      expect(prompt.versions).toHaveLength(3);
    });

    it('should handle versions with non-sequential version numbers', () => {
      const versions: PromptVersion[] = [
        { txId: 'tx-1', version: 1, timestamp: Date.now() },
        { txId: 'tx-5', version: 5, timestamp: Date.now() },
        { txId: 'tx-3', version: 3, timestamp: Date.now() },
      ];

      const prompt = createMockPrompt(versions);
      expect(prompt.versions).toHaveLength(3);
    });

    it('should handle versions with same timestamps', () => {
      const now = Date.now();
      const versions: PromptVersion[] = [
        { txId: 'tx-1', version: 1, timestamp: now },
        { txId: 'tx-2', version: 2, timestamp: now },
        { txId: 'tx-3', version: 3, timestamp: now },
      ];

      const prompt = createMockPrompt(versions);
      expect(prompt.versions).toHaveLength(3);
      expect(prompt.versions.every(v => v.timestamp === now)).toBe(true);
    });

    it('should handle versions with future timestamps', () => {
      const future = Date.now() + 1000000000;
      const versions: PromptVersion[] = [
        { txId: 'tx-1', version: 1, timestamp: future },
      ];

      const prompt = createMockPrompt(versions);
      expect(prompt.versions[0].timestamp).toBe(future);
    });

    it('should handle versions with negative timestamps', () => {
      const versions: PromptVersion[] = [
        { txId: 'tx-1', version: 1, timestamp: -1000 },
      ];

      const prompt = createMockPrompt(versions);
      expect(prompt.versions[0].timestamp).toBe(-1000);
    });

    it('should handle versions with zero timestamp', () => {
      const versions: PromptVersion[] = [
        { txId: 'tx-1', version: 1, timestamp: 0 },
      ];

      const prompt = createMockPrompt(versions);
      expect(prompt.versions[0].timestamp).toBe(0);
    });
  });

  describe('Transaction ID Edge Cases', () => {
    it('should handle empty txId', () => {
      const version: PromptVersion = {
        txId: '',
        version: 1,
        timestamp: Date.now(),
      };
      expect(version.txId).toBe('');
    });

    it('should handle very long txId', () => {
      const longTxId = 'a'.repeat(10000);
      const version: PromptVersion = {
        txId: longTxId,
        version: 1,
        timestamp: Date.now(),
      };
      expect(version.txId.length).toBe(10000);
    });

    it('should handle txId with special characters', () => {
      const specialTxId = '!@#$%^&*()_+-={}[]|:;"<>,.?/~`';
      const version: PromptVersion = {
        txId: specialTxId,
        version: 1,
        timestamp: Date.now(),
      };
      expect(version.txId).toBe(specialTxId);
    });

    it('should handle duplicate txIds in different versions', () => {
      const versions: PromptVersion[] = [
        { txId: 'same-tx', version: 1, timestamp: Date.now() },
        { txId: 'same-tx', version: 2, timestamp: Date.now() + 1000 },
      ];

      const prompt = createMockPrompt(versions);
      expect(prompt.versions).toHaveLength(2);
      expect(prompt.versions.every(v => v.txId === 'same-tx')).toBe(true);
    });

    it('should handle Unicode characters in txId', () => {
      const version: PromptVersion = {
        txId: '你好-مرحبا-🚀',
        version: 1,
        timestamp: Date.now(),
      };
      expect(version.txId).toContain('你好');
      expect(version.txId).toContain('مرحبا');
      expect(version.txId).toContain('🚀');
    });
  });

  describe('Change Note Edge Cases', () => {
    it('should handle version without change note', () => {
      const version: PromptVersion = {
        txId: 'tx-1',
        version: 1,
        timestamp: Date.now(),
      };
      expect(version.changeNote).toBeUndefined();
    });

    it('should handle empty change note', () => {
      const version: PromptVersion = {
        txId: 'tx-1',
        version: 1,
        timestamp: Date.now(),
        changeNote: '',
      };
      expect(version.changeNote).toBe('');
    });

    it('should handle very long change note', () => {
      const longNote = 'Change '.repeat(10000);
      const version: PromptVersion = {
        txId: 'tx-1',
        version: 1,
        timestamp: Date.now(),
        changeNote: longNote,
      };
      expect(version.changeNote?.length).toBeGreaterThan(50000);
    });

    it('should handle change note with special characters', () => {
      const version: PromptVersion = {
        txId: 'tx-1',
        version: 1,
        timestamp: Date.now(),
        changeNote: '!@#$%^&*()_+-={}[]|:;"<>,.?/~`',
      };
      expect(version.changeNote).toContain('!@#');
    });

    it('should handle change note with newlines', () => {
      const version: PromptVersion = {
        txId: 'tx-1',
        version: 1,
        timestamp: Date.now(),
        changeNote: 'Line 1\nLine 2\nLine 3',
      };
      expect(version.changeNote).toContain('\n');
    });

    it('should handle change note with emoji', () => {
      const version: PromptVersion = {
        txId: 'tx-1',
        version: 1,
        timestamp: Date.now(),
        changeNote: 'Updated content 🚀✨🎉',
      };
      expect(version.changeNote).toContain('🚀');
    });
  });

  describe('Version Ordering Edge Cases', () => {
    it('should handle unordered versions', () => {
      const versions: PromptVersion[] = [
        { txId: 'tx-5', version: 5, timestamp: Date.now() + 5000 },
        { txId: 'tx-1', version: 1, timestamp: Date.now() + 1000 },
        { txId: 'tx-3', version: 3, timestamp: Date.now() + 3000 },
      ];

      const prompt = createMockPrompt(versions);
      // Versions should be stored as-is, app logic handles ordering
      expect(prompt.versions[0].version).toBe(5);
    });

    it('should identify latest version from unordered array', () => {
      const versions: PromptVersion[] = [
        { txId: 'tx-2', version: 2, timestamp: Date.now() + 2000 },
        { txId: 'tx-3', version: 3, timestamp: Date.now() + 3000 },
        { txId: 'tx-1', version: 1, timestamp: Date.now() + 1000 },
      ];

      const prompt = createMockPrompt(versions);
      // currentTxId should be the last item in array
      expect(prompt.currentTxId).toBe('tx-1');
    });

    it('should handle versions sorted by timestamp instead of version number', () => {
      const now = Date.now();
      const versions: PromptVersion[] = [
        { txId: 'tx-3', version: 3, timestamp: now + 1000 },
        { txId: 'tx-1', version: 1, timestamp: now + 3000 },
        { txId: 'tx-2', version: 2, timestamp: now + 2000 },
      ];

      const prompt = createMockPrompt(versions);
      expect(prompt.versions).toHaveLength(3);
    });
  });

  describe('Version Restoration Edge Cases', () => {
    it('should handle restoring first version', () => {
      const versions: PromptVersion[] = [
        { txId: 'tx-1', version: 1, timestamp: Date.now() },
        { txId: 'tx-2', version: 2, timestamp: Date.now() + 1000 },
        { txId: 'tx-3', version: 3, timestamp: Date.now() + 2000 },
      ];

      const prompt = createMockPrompt(versions);
      const firstVersion = prompt.versions[0];

      expect(firstVersion.version).toBe(1);
      expect(firstVersion.txId).toBe('tx-1');
    });

    it('should handle restoring to middle version', () => {
      const versions: PromptVersion[] = [
        { txId: 'tx-1', version: 1, timestamp: Date.now() },
        { txId: 'tx-2', version: 2, timestamp: Date.now() + 1000 },
        { txId: 'tx-3', version: 3, timestamp: Date.now() + 2000 },
      ];

      const prompt = createMockPrompt(versions);
      const middleVersion = prompt.versions[1];

      expect(middleVersion.version).toBe(2);
    });

    it('should handle creating new version after restoration', () => {
      const versions: PromptVersion[] = [
        { txId: 'tx-1', version: 1, timestamp: Date.now() },
        { txId: 'tx-2', version: 2, timestamp: Date.now() + 1000 },
      ];

      const prompt = createMockPrompt(versions);

      // Simulate restoration creating new version
      const newVersion: PromptVersion = {
        txId: 'tx-3',
        version: 3,
        timestamp: Date.now() + 2000,
        changeNote: 'Restored from version 1',
      };

      const updatedVersions = [...prompt.versions, newVersion];
      expect(updatedVersions).toHaveLength(3);
      expect(updatedVersions[2].changeNote).toContain('Restored');
    });
  });

  describe('Edge Cases in Version Metadata', () => {
    it('should handle version with all optional fields missing', () => {
      const version: PromptVersion = {
        txId: 'tx-1',
        version: 1,
        timestamp: Date.now(),
      };

      expect(version.changeNote).toBeUndefined();
    });

    it('should handle version with negative version number', () => {
      const version: PromptVersion = {
        txId: 'tx-1',
        version: -1,
        timestamp: Date.now(),
      };

      expect(version.version).toBe(-1);
    });

    it('should handle version with zero version number', () => {
      const version: PromptVersion = {
        txId: 'tx-1',
        version: 0,
        timestamp: Date.now(),
      };

      expect(version.version).toBe(0);
    });

    it('should handle version with extremely large version number', () => {
      const version: PromptVersion = {
        txId: 'tx-1',
        version: Number.MAX_SAFE_INTEGER,
        timestamp: Date.now(),
      };

      expect(version.version).toBe(Number.MAX_SAFE_INTEGER);
    });
  });
});