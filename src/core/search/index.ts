import { Document } from 'flexsearch';
import type { Prompt } from '@/shared/types/prompt';

// Create FlexSearch document index with field-specific resolution for better relevance
// Higher resolution = better precision and higher ranking for that field
let promptIndex = new Document({
  document: {
    id: 'id',
    index: [
      { field: 'tags', tokenize: 'strict', resolution: 9 },      // Highest priority: exact tag matches
      { field: 'title', tokenize: 'forward', resolution: 9 },    // High priority: title matches
      { field: 'description', tokenize: 'forward', resolution: 5 }, // Medium priority
      { field: 'content', tokenize: 'forward', resolution: 3 },  // Lower priority: content is longer/less specific
    ],
  },
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
      index: [
        { field: 'tags', tokenize: 'strict', resolution: 9 },
        { field: 'title', tokenize: 'forward', resolution: 9 },
        { field: 'description', tokenize: 'forward', resolution: 5 },
        { field: 'content', tokenize: 'forward', resolution: 3 },
      ],
    },
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

export interface SearchResult {
  id: string;
  score: number;
}

/**
 * Search prompts by query
 * Returns array of search results with IDs and scores, sorted by relevance
 */
export function searchPrompts(query: string): SearchResult[] {
  if (!query.trim()) {
    return [];
  }

  try {
    const results = promptIndex.search(query, {
      limit: 100,
      enrich: true,
    });

    // FlexSearch returns results grouped by field
    // Collect IDs with their scores from each field
    const scoreMap = new Map<string, number>();

    results.forEach((fieldResult: any) => {
      if (fieldResult.result) {
        fieldResult.result.forEach((item: any) => {
          const id = typeof item === 'string' ? item : item.id;
          if (id) {
            // Accumulate scores from all fields where this ID appears
            // Higher resolution fields naturally contribute higher scores
            const currentScore = scoreMap.get(id) || 0;
            const itemScore = typeof item === 'object' && item.score ? item.score : 1;
            scoreMap.set(id, currentScore + itemScore);
          }
        });
      }
    });

    // Convert to array and sort by score (highest first)
    return Array.from(scoreMap.entries())
      .map(([id, score]) => ({ id, score }))
      .sort((a, b) => b.score - a.score);
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