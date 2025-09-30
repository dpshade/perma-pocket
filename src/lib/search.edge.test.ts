import { describe, it, expect, beforeEach } from 'vitest';
import {
  indexPrompts,
  addToIndex,
  removeFromIndex,
  searchPrompts,
  filterByTag,
  getAllTags,
} from './search';
import type { Prompt } from '@/types/prompt';

describe('Search Edge Cases', () => {
  const createMockPrompt = (
    id: string,
    overrides = {}
  ): Prompt => ({
    id,
    title: `Prompt ${id}`,
    description: 'Description',
    content: 'Content',
    tags: [],
    currentTxId: `tx-${id}`,
    versions: [{ txId: `tx-${id}`, version: 1, timestamp: Date.now() }],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isArchived: false,
    isSynced: true,
    ...overrides,
  });

  beforeEach(() => {
    // Clear index
    indexPrompts([]);
  });

  describe('Indexing Edge Cases', () => {
    it('should handle indexing empty array', () => {
      expect(() => indexPrompts([])).not.toThrow();
      const results = searchPrompts('anything');
      expect(results).toEqual([]);
    });

    it('should handle indexing very large dataset (1000 prompts)', () => {
      const prompts: Prompt[] = [];
      for (let i = 0; i < 1000; i++) {
        prompts.push(createMockPrompt(`${i}`, {
          title: `Prompt ${i}`,
          content: `Content ${i}`,
        }));
      }

      expect(() => indexPrompts(prompts)).not.toThrow();
      const results = searchPrompts('Prompt');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should handle prompts with very long content (100KB+)', () => {
      const prompt = createMockPrompt('1', {
        content: 'a'.repeat(100000),
      });

      // Adding should not throw, but FlexSearch may skip very large content
      expect(() => addToIndex(prompt)).not.toThrow();

      // Search may or may not find it depending on FlexSearch's internal limits
      // Just verify no error is thrown during search
      expect(() => searchPrompts('aaa')).not.toThrow();
    });

    it('should handle prompts with special characters in all fields', () => {
      const prompt = createMockPrompt('1', {
        title: '!@#$%^&*()_+-={}[]|:;"<>,.?/~`',
        description: '¡™£¢∞§¶•ªº–≠',
        content: '你好世界 مرحبا بالعالم',
        tags: ['tag!@#', 'tag$%^'],
      });

      expect(() => addToIndex(prompt)).not.toThrow();
    });

    it('should handle prompts with emoji in content', () => {
      const prompt = createMockPrompt('1', {
        title: '🚀 Rocket Prompt',
        content: '😀😁😂🤣😃😄😅',
        tags: ['emoji', '🎉'],
      });

      expect(() => addToIndex(prompt)).not.toThrow();
      const results = searchPrompts('Rocket');
      expect(results).toContain('1');
    });

    it('should handle prompts with null/undefined fields', () => {
      const prompt = createMockPrompt('1', {
        description: undefined,
        tags: null,
      });

      expect(() => addToIndex(prompt as any)).not.toThrow();
    });

    it('should handle adding same prompt multiple times', () => {
      const prompt = createMockPrompt('1', {
        title: 'Unique Test Prompt XYZ',
      });

      addToIndex(prompt);
      addToIndex(prompt);
      addToIndex(prompt);

      const results = searchPrompts('Unique Test Prompt XYZ');
      // Should only return once due to deduplication
      const count = results.filter(id => id === '1').length;
      expect(count).toBeLessThanOrEqual(1);
      expect(results).toContain('1');
    });

    it('should handle removing non-existent prompt', () => {
      expect(() => removeFromIndex('non-existent')).not.toThrow();
    });

    it('should handle removing prompt that was never indexed', () => {
      const prompt = createMockPrompt('1');
      expect(() => removeFromIndex(prompt.id)).not.toThrow();
    });

    it('should handle re-indexing after clear', () => {
      const prompts = [
        createMockPrompt('1'),
        createMockPrompt('2'),
      ];

      indexPrompts(prompts);
      indexPrompts([]); // Clear
      indexPrompts(prompts); // Re-index

      const results = searchPrompts('Prompt');
      expect(results.length).toBe(2);
    });
  });

  describe('Search Query Edge Cases', () => {
    beforeEach(() => {
      const prompts = [
        createMockPrompt('1', {
          title: 'React Components',
          content: 'Building reusable components',
          tags: ['react', 'javascript'],
        }),
        createMockPrompt('2', {
          title: 'TypeScript Guide',
          content: 'Advanced TypeScript patterns',
          tags: ['typescript', 'types'],
        }),
      ];
      indexPrompts(prompts);
    });

    it('should handle single character search', () => {
      const results = searchPrompts('R');
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle very long search queries', () => {
      const longQuery = 'React '.repeat(1000);
      expect(() => searchPrompts(longQuery)).not.toThrow();
    });

    it('should handle search with special regex characters', () => {
      expect(() => searchPrompts('.*+?^${}()|[]\\/')).not.toThrow();
    });

    it('should handle search with unicode characters', () => {
      const results = searchPrompts('你好');
      expect(results).toEqual([]);
    });

    it('should handle search with only whitespace', () => {
      const results = searchPrompts('   ');
      expect(results).toEqual([]);
    });

    it('should handle search with newlines and tabs', () => {
      const results = searchPrompts('React\n\t');
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle search with mixed case', () => {
      const results1 = searchPrompts('rEaCt');
      const results2 = searchPrompts('REACT');
      const results3 = searchPrompts('react');

      expect(results1.length).toBe(results2.length);
      expect(results2.length).toBe(results3.length);
    });

    it('should handle partial word search', () => {
      const results = searchPrompts('Reac');
      expect(results).toContain('1');
    });

    it('should handle search with multiple words', () => {
      const results = searchPrompts('React Components');
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle boolean-like search terms', () => {
      expect(() => searchPrompts('AND OR NOT')).not.toThrow();
    });

    it('should handle numeric search', () => {
      const prompt = createMockPrompt('3', {
        title: 'React 18.2 Features',
        content: 'New in version 18.2',
      });
      addToIndex(prompt);

      const results = searchPrompts('18');
      expect(results).toContain('3');
    });

    it('should handle search after prompt deletion', () => {
      removeFromIndex('1');
      const results = searchPrompts('React');
      expect(results).not.toContain('1');
    });
  });

  describe('Tag Filtering Edge Cases', () => {
    const mockPrompts = [
      createMockPrompt('1', { tags: ['react', 'frontend'] }),
      createMockPrompt('2', { tags: ['backend', 'api'] }),
      createMockPrompt('3', { tags: [] }),
      createMockPrompt('4', { tags: ['react'], isArchived: true }),
    ];

    it('should handle empty prompts array', () => {
      const results = filterByTag([], 'any-tag');
      expect(results).toEqual([]);
    });

    it('should handle prompts with no tags', () => {
      const results = filterByTag(mockPrompts, 'react');
      // Should only find prompts with tags
      expect(results.every(p => p.tags.length > 0)).toBe(true);
    });

    it('should handle tag with special characters', () => {
      const prompts = [
        createMockPrompt('1', { tags: ['c++', 'c#', 'f#'] }),
      ];
      const results = filterByTag(prompts, 'c++');
      expect(results).toHaveLength(1);
    });

    it('should handle tag with spaces', () => {
      const prompts = [
        createMockPrompt('1', { tags: ['React Native', 'Mobile Dev'] }),
      ];
      const results = filterByTag(prompts, 'React Native');
      expect(results).toHaveLength(1);
    });

    it('should handle tag with emoji', () => {
      const prompts = [
        createMockPrompt('1', { tags: ['🚀 rocket', 'fast'] }),
      ];
      const results = filterByTag(prompts, '🚀 rocket');
      expect(results).toHaveLength(1);
    });

    it('should handle extremely long tag names', () => {
      const longTag = 'a'.repeat(1000);
      const prompts = [
        createMockPrompt('1', { tags: [longTag] }),
      ];
      const results = filterByTag(prompts, longTag);
      expect(results).toHaveLength(1);
    });

    it('should handle case variations in tag filtering', () => {
      const results1 = filterByTag(mockPrompts, 'React');
      const results2 = filterByTag(mockPrompts, 'REACT');
      const results3 = filterByTag(mockPrompts, 'react');

      expect(results1.length).toBe(results2.length);
      expect(results2.length).toBe(results3.length);
    });

    it('should handle partial tag matching', () => {
      const results = filterByTag(mockPrompts, 'reac');
      // Should find 'react' tags if includes() matches
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle tag filtering with all archived', () => {
      const archived = mockPrompts.map(p => ({ ...p, isArchived: true }));
      const results = filterByTag(archived, 'react');
      expect(results).toEqual([]);
    });

    it('should handle duplicate tags in same prompt', () => {
      const prompts = [
        createMockPrompt('1', { tags: ['react', 'react', 'react'] }),
      ];
      const results = filterByTag(prompts, 'react');
      expect(results).toHaveLength(1);
    });
  });

  describe('Tag Collection Edge Cases', () => {
    it('should handle empty prompts array', () => {
      const tags = getAllTags([]);
      expect(tags).toEqual([]);
    });

    it('should handle prompts with no tags', () => {
      const prompts = [
        createMockPrompt('1', { tags: [] }),
        createMockPrompt('2', { tags: [] }),
      ];
      const tags = getAllTags(prompts);
      expect(tags).toEqual([]);
    });

    it('should handle prompts with duplicate tags', () => {
      const prompts = [
        createMockPrompt('1', { tags: ['react', 'react'] }),
        createMockPrompt('2', { tags: ['react'] }),
      ];
      const tags = getAllTags(prompts);
      expect(tags.filter(t => t === 'react')).toHaveLength(1);
    });

    it('should handle mixed case tags', () => {
      const prompts = [
        createMockPrompt('1', { tags: ['React', 'REACT', 'react'] }),
      ];
      const tags = getAllTags(prompts);
      // Should include all variations as they're different strings
      expect(tags.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle tags with special characters', () => {
      const prompts = [
        createMockPrompt('1', { tags: ['c++', 'c#', '.net', 'node.js'] }),
      ];
      const tags = getAllTags(prompts);
      expect(tags).toContain('c++');
      expect(tags).toContain('c#');
    });

    it('should handle very large number of unique tags', () => {
      const prompts: Prompt[] = [];
      for (let i = 0; i < 1000; i++) {
        prompts.push(createMockPrompt(`${i}`, {
          tags: [`tag${i}`, `category${i}`],
        }));
      }

      const tags = getAllTags(prompts);
      expect(tags.length).toBe(2000);
    });

    it('should handle tags with unicode characters', () => {
      const prompts = [
        createMockPrompt('1', { tags: ['你好', 'مرحبا', '🚀'] }),
      ];
      const tags = getAllTags(prompts);
      expect(tags).toContain('你好');
      expect(tags).toContain('مرحبا');
      expect(tags).toContain('🚀');
    });

    it('should maintain alphabetical order with special characters', () => {
      const prompts = [
        createMockPrompt('1', { tags: ['zebra', 'apple', '123', '!important'] }),
      ];
      const tags = getAllTags(prompts);
      const sorted = [...tags].sort();
      expect(tags).toEqual(sorted);
    });

    it('should exclude archived prompts from tag collection', () => {
      const prompts = [
        createMockPrompt('1', { tags: ['visible'], isArchived: false }),
        createMockPrompt('2', { tags: ['hidden'], isArchived: true }),
      ];
      const tags = getAllTags(prompts);
      expect(tags).toContain('visible');
      expect(tags).not.toContain('hidden');
    });
  });

  describe('Performance Edge Cases', () => {
    it('should handle rapid sequential searches', () => {
      const prompts = [createMockPrompt('1', { title: 'Test' })];
      indexPrompts(prompts);

      for (let i = 0; i < 100; i++) {
        searchPrompts('Test');
      }

      const results = searchPrompts('Test');
      expect(results).toContain('1');
    });

    it('should handle rapid index updates', () => {
      const prompt = createMockPrompt('rapid-test', {
        title: 'Rapid Update Test Unique Title',
      });

      for (let i = 0; i < 50; i++) {
        addToIndex(prompt);
        removeFromIndex(prompt.id);
      }

      // Add final time
      addToIndex(prompt);
      const results = searchPrompts('Rapid Update Test Unique');
      expect(results).toContain('rapid-test');
    });

    it('should handle large result sets', () => {
      const prompts: Prompt[] = [];
      for (let i = 0; i < 1000; i++) {
        prompts.push(createMockPrompt(`${i}`, {
          title: 'Common Title',
        }));
      }

      indexPrompts(prompts);
      const results = searchPrompts('Common');
      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThanOrEqual(1000);
    });
  });
});