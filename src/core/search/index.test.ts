import { describe, it, expect, beforeEach } from 'vitest';
import {
  indexPrompts,
  addToIndex,
  removeFromIndex,
  searchPrompts,
  filterByTag,
  getAllTags,
} from '@/core/search';
import type { Prompt } from '@/shared/types/prompt';

describe('Search Functionality', () => {
  const mockPrompts: Prompt[] = [
    {
      id: 'prompt-1',
      title: 'React Best Practices',
      description: 'Tips for writing better React code',
      content: 'Use functional components and hooks',
      tags: ['react', 'javascript', 'frontend'],
      currentTxId: 'tx-1',
      versions: [{ txId: 'tx-1', version: 1, timestamp: Date.now() }],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isArchived: false,
      isSynced: true,
    },
    {
      id: 'prompt-2',
      title: 'TypeScript Patterns',
      description: 'Advanced TypeScript patterns and techniques',
      content: 'Learn about generics, utility types, and more',
      tags: ['typescript', 'javascript', 'types'],
      currentTxId: 'tx-2',
      versions: [{ txId: 'tx-2', version: 1, timestamp: Date.now() }],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isArchived: false,
      isSynced: true,
    },
    {
      id: 'prompt-3',
      title: 'CSS Grid Layout',
      description: 'Master CSS Grid for complex layouts',
      content: 'Grid is powerful for 2D layouts',
      tags: ['css', 'frontend', 'layout'],
      currentTxId: 'tx-3',
      versions: [{ txId: 'tx-3', version: 1, timestamp: Date.now() }],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isArchived: false,
      isSynced: true,
    },
    {
      id: 'prompt-4',
      title: 'Archived Prompt',
      description: 'This is archived',
      content: 'Archived content',
      tags: ['archived'],
      currentTxId: 'tx-4',
      versions: [{ txId: 'tx-4', version: 1, timestamp: Date.now() }],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isArchived: true,
      isSynced: true,
    },
  ];

  beforeEach(() => {
    // Re-index prompts before each test
    indexPrompts(mockPrompts);
  });

  describe('Indexing', () => {
    it('should index prompts', () => {
      indexPrompts(mockPrompts);
      const results = searchPrompts('React');
      expect(results).toContain('prompt-1');
    });

    it('should not index archived prompts', () => {
      const results = searchPrompts('Archived');
      expect(results).not.toContain('prompt-4');
    });

    it('should add prompt to index', () => {
      const newPrompt: Prompt = {
        id: 'prompt-5',
        title: 'New Prompt',
        description: 'Newly added',
        content: 'New content here',
        tags: ['new'],
        currentTxId: 'tx-5',
        versions: [{ txId: 'tx-5', version: 1, timestamp: Date.now() }],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isArchived: false,
        isSynced: true,
      };

      addToIndex(newPrompt);
      const results = searchPrompts('New');
      expect(results).toContain('prompt-5');
    });

    it('should remove prompt from index', () => {
      removeFromIndex('prompt-1');
      const results = searchPrompts('React');
      expect(results).not.toContain('prompt-1');
    });
  });

  describe('Searching', () => {
    it('should search by title', () => {
      const results = searchPrompts('React');
      expect(results).toContain('prompt-1');
    });

    it('should search by description', () => {
      const results = searchPrompts('Advanced');
      expect(results).toContain('prompt-2');
    });

    it('should search by content', () => {
      const results = searchPrompts('functional components');
      expect(results).toContain('prompt-1');
    });

    it('should search by tags', () => {
      const results = searchPrompts('typescript');
      expect(results).toContain('prompt-2');
    });

    it('should return empty array for no results', () => {
      const results = searchPrompts('nonexistent');
      expect(results).toEqual([]);
    });

    it('should return empty array for empty query', () => {
      const results = searchPrompts('');
      expect(results).toEqual([]);
    });

    it('should handle case-insensitive search', () => {
      const results = searchPrompts('REACT');
      expect(results).toContain('prompt-1');
    });
  });

  describe('Tag Filtering', () => {
    it('should filter by single tag', () => {
      const results = filterByTag(mockPrompts, 'react');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('prompt-1');
    });

    it('should filter by tag case-insensitively', () => {
      const results = filterByTag(mockPrompts, 'REACT');
      expect(results).toHaveLength(1);
    });

    it('should exclude archived prompts', () => {
      const results = filterByTag(mockPrompts, 'archived');
      expect(results).toHaveLength(0);
    });

    it('should return multiple prompts with same tag', () => {
      const results = filterByTag(mockPrompts, 'frontend');
      expect(results).toHaveLength(2);
      expect(results.map(p => p.id)).toContain('prompt-1');
      expect(results.map(p => p.id)).toContain('prompt-3');
    });

    it('should return empty array for non-existent tag', () => {
      const results = filterByTag(mockPrompts, 'nonexistent');
      expect(results).toEqual([]);
    });
  });

  describe('Tag Collection', () => {
    it('should get all unique tags', () => {
      const tags = getAllTags(mockPrompts);
      expect(tags).toContain('react');
      expect(tags).toContain('typescript');
      expect(tags).toContain('javascript');
      expect(tags).toContain('frontend');
      expect(tags).toContain('css');
      expect(tags).toContain('layout');
      expect(tags).toContain('types');
    });

    it('should not include tags from archived prompts', () => {
      const tags = getAllTags(mockPrompts);
      expect(tags).not.toContain('archived');
    });

    it('should return sorted tags', () => {
      const tags = getAllTags(mockPrompts);
      const sorted = [...tags].sort();
      expect(tags).toEqual(sorted);
    });

    it('should return empty array for empty prompts', () => {
      const tags = getAllTags([]);
      expect(tags).toEqual([]);
    });
  });
});