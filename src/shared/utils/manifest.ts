/**
 * Arweave Path Manifest Utilities
 * Handles parsing, generation, and validation of manifest structures
 */

import type {
  ArweaveManifest,
  ManifestMetadata,
  ManifestPath,
  PathGenerationOptions,
} from '@/shared/types/manifest';
import type { Prompt } from '@/shared/types/prompt';

const DEFAULT_PATH_OPTIONS: PathGenerationOptions = {
  useTagFolders: true,
  sanitizeTitles: true,
  handleDuplicates: true,
};

/**
 * Validate manifest structure
 */
export function validateManifest(data: any): data is ArweaveManifest {
  if (!data || typeof data !== 'object') {
    return false;
  }

  // Check required fields
  if (data.manifest !== 'arweave/paths') {
    return false;
  }

  if (data.version !== '0.2.0') {
    return false;
  }

  if (!data.index || typeof data.index.path !== 'string') {
    return false;
  }

  if (!data.paths || typeof data.paths !== 'object') {
    return false;
  }

  // Validate all paths have transaction IDs
  for (const entry of Object.values(data.paths)) {
    if (!entry || typeof (entry as any).id !== 'string') {
      return false;
    }
  }

  return true;
}

/**
 * Parse manifest from JSON data
 */
export function parseManifest(data: any): ArweaveManifest {
  if (!validateManifest(data)) {
    throw new Error('Invalid manifest structure. Expected arweave/paths v0.2.0 format.');
  }

  return data as ArweaveManifest;
}

/**
 * Validate manifest metadata
 */
export function validateManifestMetadata(data: any): data is ManifestMetadata {
  if (!data || typeof data !== 'object') {
    return false;
  }

  // Required fields
  if (typeof data.title !== 'string' || !data.title.trim()) {
    return false;
  }

  if (typeof data.exportedAt !== 'number') {
    return false;
  }

  if (typeof data.promptCount !== 'number') {
    return false;
  }

  if (typeof data.publicCount !== 'number') {
    return false;
  }

  if (typeof data.encryptedCount !== 'number') {
    return false;
  }

  if (!Array.isArray(data.tags)) {
    return false;
  }

  if (typeof data.exportedBy !== 'string') {
    return false;
  }

  return true;
}

/**
 * Parse manifest metadata from JSON data
 */
export function parseManifestMetadata(data: any): ManifestMetadata {
  if (!validateManifestMetadata(data)) {
    throw new Error('Invalid manifest metadata structure.');
  }

  return data as ManifestMetadata;
}

/**
 * Sanitize a string for use in file paths
 * Removes special characters and ensures valid filenames
 */
export function sanitizePathSegment(segment: string): string {
  return segment
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '') // Remove invalid filename characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/\.+$/, '') // Remove trailing dots
    .replace(/^\.+/, '') // Remove leading dots
    .slice(0, 100); // Limit length
}

/**
 * Generate a file path for a prompt
 * Format: {primaryTag}/{sanitized-title}.md
 */
export function generatePromptPath(
  prompt: Prompt,
  options: PathGenerationOptions = DEFAULT_PATH_OPTIONS
): string {
  let folder = 'uncategorized';
  let filename = prompt.title;

  // Use primary tag as folder if available
  if (options.useTagFolders && prompt.tags.length > 0) {
    folder = sanitizePathSegment(prompt.tags[0]);
  }

  // Sanitize title for filename
  if (options.sanitizeTitles) {
    filename = sanitizePathSegment(prompt.title);
  }

  // Ensure filename
  if (!filename) {
    filename = 'untitled';
  }

  // Add .md extension
  if (!filename.endsWith('.md')) {
    filename += '.md';
  }

  return `${folder}/${filename}`;
}

/**
 * Generate paths for multiple prompts, handling duplicates
 */
export function generatePromptPaths(
  prompts: Prompt[],
  options: PathGenerationOptions = DEFAULT_PATH_OPTIONS
): Map<string, string> {
  // Map: promptId -> path
  const pathMap = new Map<string, string>();

  // Track used paths for duplicate detection
  const usedPaths = new Set<string>();

  for (const prompt of prompts) {
    let path = generatePromptPath(prompt, options);

    // Handle duplicates by appending counter
    if (options.handleDuplicates && usedPaths.has(path)) {
      const basePath = path.replace(/\.md$/, '');
      let counter = 2;

      while (usedPaths.has(`${basePath}-${counter}.md`)) {
        counter++;
      }

      path = `${basePath}-${counter}.md`;
    }

    usedPaths.add(path);
    pathMap.set(prompt.id, path);
  }

  return pathMap;
}

/**
 * Create manifest structure from prompts
 */
export function createManifest(
  prompts: Prompt[],
  _metadata: ManifestMetadata,
  metadataTxId: string,
  options: PathGenerationOptions = DEFAULT_PATH_OPTIONS
): ArweaveManifest {
  const pathMap = generatePromptPaths(prompts, options);
  const paths: Record<string, ManifestPath> = {};

  // Add metadata file as index
  paths['collection.json'] = { id: metadataTxId };

  // Add all prompt paths
  for (const prompt of prompts) {
    const path = pathMap.get(prompt.id);
    if (path && prompt.currentTxId) {
      paths[path] = { id: prompt.currentTxId };
    }
  }

  return {
    manifest: 'arweave/paths',
    version: '0.2.0',
    index: {
      path: 'collection.json',
    },
    paths,
  };
}

/**
 * Extract transaction IDs from manifest (excluding metadata)
 */
export function extractPromptTxIds(manifest: ArweaveManifest): string[] {
  const txIds: string[] = [];
  const metadataPath = manifest.index.path;

  for (const [path, entry] of Object.entries(manifest.paths)) {
    // Skip metadata file
    if (path === metadataPath) {
      continue;
    }

    txIds.push(entry.id);
  }

  return txIds;
}

/**
 * Get folder structure from manifest for preview
 * Returns: { folder: pathCount }
 */
export function getManifestFolderStructure(manifest: ArweaveManifest): Record<string, number> {
  const structure: Record<string, number> = {};
  const metadataPath = manifest.index.path;

  for (const path of Object.keys(manifest.paths)) {
    // Skip metadata file
    if (path === metadataPath) {
      continue;
    }

    // Extract folder from path
    const parts = path.split('/');
    const folder = parts.length > 1 ? parts[0] : 'root';

    structure[folder] = (structure[folder] || 0) + 1;
  }

  return structure;
}

/**
 * Get metadata transaction ID from manifest
 */
export function getMetadataTxId(manifest: ArweaveManifest): string {
  const metadataPath = manifest.index.path;
  const entry = manifest.paths[metadataPath];

  if (!entry) {
    throw new Error('Metadata entry not found in manifest');
  }

  return entry.id;
}

/**
 * Create manifest metadata object
 */
export function createManifestMetadata(
  title: string,
  prompts: Prompt[],
  walletAddress: string,
  options: {
    description?: string;
    sourceFilter?: string;
    sourceType: 'filter' | 'collection' | 'manual';
  }
): ManifestMetadata {
  // Count encryption status
  const publicCount = prompts.filter(p =>
    p.tags.some(t => t.toLowerCase() === 'public')
  ).length;
  const encryptedCount = prompts.length - publicCount;

  // Collect all unique tags
  const allTags = new Set<string>();
  for (const prompt of prompts) {
    for (const tag of prompt.tags) {
      allTags.add(tag);
    }
  }

  return {
    title: title.trim(),
    description: options.description?.trim(),
    exportedAt: Date.now(),
    sourceFilter: options.sourceFilter,
    sourceType: options.sourceType,
    promptCount: prompts.length,
    publicCount,
    encryptedCount,
    tags: Array.from(allTags).sort(),
    exportedBy: walletAddress,
    appVersion: '3.5.0', // TODO: Get from config
  };
}
