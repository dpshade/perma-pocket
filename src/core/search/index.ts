import { Document } from 'flexsearch';
import type { Prompt } from '@/shared/types/prompt';

// Create FlexSearch document index
let promptIndex = new Document({
  document: {
    id: 'id',
    index: ['title', 'description', 'content', 'tags'],
  },
  tokenize: 'forward',
  cache: true,
});

// Track indexed IDs for proper cleanup
const indexedIds = new Set<string>();

/**
 * Index all prompts for search
 */
export function indexPrompts(prompts: Prompt[]): void {
  // Completely clear and reinitialize the index for clean state
  promptIndex = new Document({
    document: {
      id: 'id',
      index: ['title', 'description', 'content', 'tags'],
    },
    tokenize: 'forward',
    cache: true,
  });
  indexedIds.clear();

  // Add non-archived prompts to index
  prompts.forEach(prompt => {
    if (!prompt.isArchived) {
      try {
        promptIndex.add(prompt as any);
        indexedIds.add(prompt.id);
      } catch (error) {
        // Skip problematic prompts (e.g., content too large for FlexSearch)
        console.warn(`Failed to index prompt ${prompt.id}:`, error);
      }
    }
  });
}

/**
 * Add single prompt to index
 */
export function addToIndex(prompt: Prompt): void {
  if (!prompt.isArchived) {
    try {
      // Remove existing entry if present to ensure no duplicates
      if (indexedIds.has(prompt.id)) {
        promptIndex.remove(prompt.id);
      }
      promptIndex.add(prompt as any);
      indexedIds.add(prompt.id);
    } catch (error) {
      // Skip problematic prompts (e.g., content too large for FlexSearch)
      console.warn(`Failed to add prompt ${prompt.id} to index:`, error);
    }
  }
}

/**
 * Remove prompt from index
 */
export function removeFromIndex(promptId: string): void {
  try {
    if (indexedIds.has(promptId)) {
      promptIndex.remove(promptId);
      indexedIds.delete(promptId);
    }
  } catch (error) {
    console.warn(`Error removing from index: ${promptId}`, error);
  }
}

/**
 * Search prompts by query
 * Returns array of prompt IDs
 */
export function searchPrompts(query: string): string[] {
  if (!query.trim()) {
    return [];
  }

  try {
    const results = promptIndex.search(query, {
      limit: 100,
      enrich: true,
    });

    // FlexSearch returns results grouped by field
    // Flatten and deduplicate prompt IDs
    const ids = new Set<string>();

    results.forEach((fieldResult: any) => {
      if (fieldResult.result) {
        fieldResult.result.forEach((item: any) => {
          if (typeof item === 'string') {
            ids.add(item);
          } else if (item.id) {
            ids.add(item.id);
          }
        });
      }
    });

    return Array.from(ids);
  } catch (error) {
    console.error('Search error:', error);
    return [];
  }
}

/**
 * Filter prompts by tag
 */
export function filterByTag(prompts: Prompt[], tag: string): Prompt[] {
  return prompts.filter(prompt =>
    !prompt.isArchived && prompt.tags.some(t =>
      t.toLowerCase().includes(tag.toLowerCase())
    )
  );
}

/**
 * Get all unique tags from prompts
 */
export function getAllTags(prompts: Prompt[]): string[] {
  const tags = new Set<string>();
  prompts.forEach(prompt => {
    if (!prompt.isArchived) {
      prompt.tags.forEach(tag => tags.add(tag));
    }
  });
  return Array.from(tags).sort();
}