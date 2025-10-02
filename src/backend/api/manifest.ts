/**
 * Manifest API - Fetching and validating Arweave path manifests
 */

import type {
  ArweaveManifest,
  ManifestMetadata,
  ManifestPromptImportResult,
  ManifestImportResult,
} from '@/shared/types/manifest';
import {
  parseManifest,
  parseManifestMetadata,
  extractPromptTxIds,
  getMetadataTxId,
} from '@/shared/utils/manifest';
import { fetchPrompt } from './client';

const ARWEAVE_GATEWAY = 'https://arweave.net';

/**
 * Fetch manifest from Arweave by transaction ID
 */
export async function fetchManifest(txId: string): Promise<ArweaveManifest> {
  try {
    console.log(`[Manifest Fetch] Fetching manifest from ${txId}...`);

    const response = await fetch(`${ARWEAVE_GATEWAY}/${txId}`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // Validate and parse manifest
    const manifest = parseManifest(data);

    console.log(`[Manifest Fetch] ✅ Valid manifest with ${Object.keys(manifest.paths).length} paths`);

    return manifest;
  } catch (error) {
    console.error(`[Manifest Fetch] Failed to fetch manifest ${txId}:`, error);
    throw new Error(
      error instanceof Error
        ? error.message
        : 'Failed to fetch manifest from Arweave'
    );
  }
}

/**
 * Fetch manifest metadata from Arweave
 */
export async function fetchManifestMetadata(txId: string): Promise<ManifestMetadata> {
  try {
    console.log(`[Manifest Metadata] Fetching metadata from ${txId}...`);

    const response = await fetch(`${ARWEAVE_GATEWAY}/${txId}`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // Validate and parse metadata
    const metadata = parseManifestMetadata(data);

    console.log(`[Manifest Metadata] ✅ Loaded: "${metadata.title}" (${metadata.promptCount} prompts)`);

    return metadata;
  } catch (error) {
    console.error(`[Manifest Metadata] Failed to fetch metadata ${txId}:`, error);
    throw new Error(
      error instanceof Error
        ? error.message
        : 'Failed to fetch manifest metadata from Arweave'
    );
  }
}

/**
 * Fetch all prompts from a manifest
 * Returns both successful and failed fetches with status
 */
export async function fetchPromptsFromManifest(
  manifest: ArweaveManifest,
  password?: string,
  onProgress?: (current: number, total: number) => void
): Promise<ManifestPromptImportResult[]> {
  const txIds = extractPromptTxIds(manifest);
  const results: ManifestPromptImportResult[] = [];

  console.log(`[Manifest Import] Fetching ${txIds.length} prompts...`);

  // Get path for each txId
  const txIdToPath = new Map<string, string>();
  const metadataPath = manifest.index.path;

  for (const [path, entry] of Object.entries(manifest.paths)) {
    if (path !== metadataPath) {
      txIdToPath.set(entry.id, path);
    }
  }

  // Fetch prompts in batches to avoid overwhelming the gateway
  const BATCH_SIZE = 5;
  let completed = 0;

  for (let i = 0; i < txIds.length; i += BATCH_SIZE) {
    const batch = txIds.slice(i, i + BATCH_SIZE);

    const batchResults = await Promise.all(
      batch.map(async (txId) => {
        const path = txIdToPath.get(txId) || 'unknown';

        try {
          const prompt = await fetchPrompt(txId, password);

          if (!prompt) {
            return {
              path,
              txId,
              success: false,
              error: 'Prompt not found or failed to parse',
              isEncrypted: false,
            };
          }

          // Check if content is encrypted
          const isEncrypted = typeof prompt.content !== 'string';

          return {
            path,
            txId,
            success: true,
            prompt,
            isEncrypted,
          };
        } catch (error) {
          console.warn(`[Manifest Import] Failed to fetch prompt ${txId}:`, error);
          return {
            path,
            txId,
            success: false,
            error: error instanceof Error ? error.message : 'Failed to fetch',
            isEncrypted: false,
          };
        }
      })
    );

    results.push(...batchResults);

    completed += batch.length;

    if (onProgress) {
      onProgress(completed, txIds.length);
    }
  }

  const successCount = results.filter(r => r.success).length;
  const encryptedCount = results.filter(r => r.isEncrypted).length;

  console.log(
    `[Manifest Import] ✅ Fetched ${successCount}/${txIds.length} prompts (${encryptedCount} encrypted)`
  );

  return results;
}

/**
 * Import a complete manifest with metadata and prompts
 */
export async function importManifest(
  manifestTxId: string,
  password?: string,
  onProgress?: (current: number, total: number) => void
): Promise<ManifestImportResult> {
  try {
    // Fetch manifest
    const manifest = await fetchManifest(manifestTxId);

    // Fetch metadata
    const metadataTxId = getMetadataTxId(manifest);
    const metadata = await fetchManifestMetadata(metadataTxId);

    // Fetch all prompts
    const prompts = await fetchPromptsFromManifest(manifest, password, onProgress);

    const successfulCount = prompts.filter(p => p.success).length;
    const failedCount = prompts.filter(p => !p.success).length;
    const encryptedCount = prompts.filter(p => p.isEncrypted).length;

    return {
      success: true,
      metadata,
      prompts,
      totalCount: prompts.length,
      successfulCount,
      failedCount,
      encryptedCount,
    };
  } catch (error) {
    console.error('[Manifest Import] Import failed:', error);
    return {
      success: false,
      metadata: null,
      prompts: [],
      totalCount: 0,
      successfulCount: 0,
      failedCount: 0,
      encryptedCount: 0,
      error: error instanceof Error ? error.message : 'Import failed',
    };
  }
}
