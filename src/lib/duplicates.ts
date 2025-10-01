import type { Prompt } from '@/types/prompt';

export interface DuplicateGroup {
  title: string;
  prompts: Prompt[];
  reason: 'exact-title' | 'similar-title' | 'exact-content';
}

/**
 * Calculate similarity between two strings (0-1)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) return 1;

  // Simple Levenshtein distance ratio
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;

  if (longer.length === 0) return 1.0;

  const editDistance = levenshteinDistance(s1, s2);
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Find duplicate prompts based on title and content similarity
 */
export function findDuplicates(prompts: Prompt[], threshold = 0.85): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];
  const processed = new Set<string>();

  // Filter out archived prompts
  const activePrompts = prompts.filter(p => !p.isArchived);

  // Group by exact title first
  const titleMap = new Map<string, Prompt[]>();
  activePrompts.forEach(prompt => {
    const normalizedTitle = prompt.title.toLowerCase().trim();
    if (!titleMap.has(normalizedTitle)) {
      titleMap.set(normalizedTitle, []);
    }
    titleMap.get(normalizedTitle)!.push(prompt);
  });

  // Add exact title matches
  titleMap.forEach((prompts, title) => {
    if (prompts.length > 1) {
      groups.push({
        title: prompts[0].title,
        prompts,
        reason: 'exact-title',
      });
      prompts.forEach(p => processed.add(p.id));
    }
  });

  // Find similar titles
  const remaining = activePrompts.filter(p => !processed.has(p.id));
  for (let i = 0; i < remaining.length; i++) {
    const similarGroup: Prompt[] = [remaining[i]];

    for (let j = i + 1; j < remaining.length; j++) {
      if (processed.has(remaining[j].id)) continue;

      const similarity = calculateSimilarity(remaining[i].title, remaining[j].title);
      if (similarity >= threshold) {
        similarGroup.push(remaining[j]);
        processed.add(remaining[j].id);
      }
    }

    if (similarGroup.length > 1) {
      groups.push({
        title: similarGroup[0].title,
        prompts: similarGroup,
        reason: 'similar-title',
      });
      processed.add(remaining[i].id);
    }
  }

  // Find exact content duplicates
  const contentMap = new Map<string, Prompt[]>();
  const stillRemaining = activePrompts.filter(p => !processed.has(p.id));

  stillRemaining.forEach(prompt => {
    const content = typeof prompt.content === 'string'
      ? prompt.content.toLowerCase().trim()
      : '';

    if (content.length > 0) {
      if (!contentMap.has(content)) {
        contentMap.set(content, []);
      }
      contentMap.get(content)!.push(prompt);
    }
  });

  contentMap.forEach((prompts) => {
    if (prompts.length > 1) {
      groups.push({
        title: prompts[0].title,
        prompts,
        reason: 'exact-content',
      });
    }
  });

  return groups;
}

/**
 * Get count of duplicate prompts (excludes archived)
 */
export function getDuplicateCount(prompts: Prompt[]): number {
  // Filter out archived prompts before finding duplicates
  const activePrompts = prompts.filter(p => !p.isArchived);
  const groups = findDuplicates(activePrompts);
  return groups.reduce((sum, group) => sum + group.prompts.length, 0);
}

/**
 * Check if a prompt is part of any duplicate group
 */
export function isDuplicate(prompt: Prompt, allPrompts: Prompt[]): boolean {
  const groups = findDuplicates(allPrompts);
  return groups.some(group => group.prompts.some(p => p.id === prompt.id));
}
