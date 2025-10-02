/**
 * Arweave Path Manifest Types
 * Supports the arweave/paths manifest specification v0.2.0
 */

import type { Prompt } from './prompt';

/**
 * Arweave path manifest structure (arweave/paths v0.2.0)
 * Used for organizing collections of prompts with readable paths
 */
export interface ArweaveManifest {
  manifest: 'arweave/paths';
  version: '0.2.0';
  index: {
    path: string; // Path to metadata file (e.g., "collection.json")
  };
  paths: Record<string, ManifestPath>; // Path -> transaction mapping
}

/**
 * Individual path entry in manifest
 */
export interface ManifestPath {
  id: string; // Arweave transaction ID
}

/**
 * Collection metadata stored at the index path
 * Provides context about the exported collection
 */
export interface ManifestMetadata {
  title: string;
  description?: string;
  exportedAt: number;

  // Export context
  sourceFilter?: string; // Boolean expression if exported from filter
  sourceType: 'filter' | 'collection' | 'manual'; // How prompts were selected

  // Statistics
  promptCount: number;
  publicCount: number;
  encryptedCount: number;
  tags: string[]; // Unique tags across all prompts

  // Attribution
  exportedBy: string; // Wallet address
  appVersion: string; // App version used for export
}

/**
 * Export configuration options
 */
export interface ExportConfig {
  collectionName: string;
  description?: string;
  includeEncrypted: boolean; // Whether to include encrypted prompts
  sourceFilter?: string; // Optional filter expression for context
  sourceType: 'filter' | 'collection' | 'manual';
}

/**
 * Export result information
 */
export interface ExportResult {
  success: boolean;
  manifestTxId?: string; // Transaction ID of uploaded manifest
  metadataTxId?: string; // Transaction ID of metadata
  promptCount: number;
  publicCount: number;
  encryptedCount: number;
  error?: string;
}

/**
 * Import result for a single prompt from manifest
 */
export interface ManifestPromptImportResult {
  path: string; // Original path in manifest
  txId: string; // Arweave transaction ID
  success: boolean;
  prompt?: Prompt;
  error?: string;
  isEncrypted: boolean; // Whether content is encrypted
}

/**
 * Complete import result from manifest
 */
export interface ManifestImportResult {
  success: boolean;
  metadata: ManifestMetadata | null;
  prompts: ManifestPromptImportResult[];
  totalCount: number;
  successfulCount: number;
  failedCount: number;
  encryptedCount: number;
  error?: string;
}

/**
 * Path generation options
 */
export interface PathGenerationOptions {
  useTagFolders: boolean; // Organize by primary tag
  sanitizeTitles: boolean; // Remove special characters from filenames
  handleDuplicates: boolean; // Append counters for duplicate paths
}
