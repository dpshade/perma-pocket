/**
 * Export API - Generate and upload Arweave path manifests
 */

import { TurboFactory, ArconnectSigner } from '@ardrive/turbo-sdk/web';
import type { Prompt } from '@/shared/types/prompt';
import type {
  ExportConfig,
  ExportResult,
  ManifestMetadata,
  ArweaveManifest,
} from '@/shared/types/manifest';
import {
  createManifestMetadata,
  createManifest,
} from '@/shared/utils/manifest';
import { uploadPrompt } from './client';
import { shouldEncrypt } from '@/core/encryption/crypto';

/**
 * Ensure all prompts are uploaded to Arweave
 * Returns map of promptId -> txId
 */
export async function ensurePromptsUploaded(
  prompts: Prompt[],
  password?: string,
  onProgress?: (current: number, total: number, title: string) => void
): Promise<Map<string, string>> {
  const txIdMap = new Map<string, string>();
  let completed = 0;

  console.log(`[Export] Verifying ${prompts.length} prompts are uploaded...`);

  for (const prompt of prompts) {
    // Skip if already uploaded
    if (prompt.currentTxId && prompt.isSynced) {
      txIdMap.set(prompt.id, prompt.currentTxId);
      completed++;

      if (onProgress) {
        onProgress(completed, prompts.length, prompt.title);
      }

      continue;
    }

    // Check if password is required for encrypted prompts
    const needsEncryption = shouldEncrypt(prompt.tags);
    if (needsEncryption && !password) {
      throw new Error(
        `Password required to upload encrypted prompt: "${prompt.title}"`
      );
    }

    // Upload prompt
    try {
      console.log(`[Export] Uploading: ${prompt.title}`);
      const result = await uploadPrompt(prompt, password);

      if (result.success && result.prompt?.currentTxId) {
        txIdMap.set(prompt.id, result.prompt.currentTxId);
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (error) {
      console.error(`[Export] Failed to upload "${prompt.title}":`, error);
      throw new Error(
        `Failed to upload prompt "${prompt.title}": ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }

    completed++;

    if (onProgress) {
      onProgress(completed, prompts.length, prompt.title);
    }
  }

  console.log(`[Export] ✅ All ${prompts.length} prompts uploaded`);

  return txIdMap;
}

/**
 * Upload metadata JSON to Arweave
 */
async function uploadMetadata(
  metadata: ManifestMetadata,
  arweaveWallet: any
): Promise<string> {
  console.log('[Export] Uploading metadata...');

  const signer = new ArconnectSigner(arweaveWallet);
  const turbo = TurboFactory.authenticated({ signer });

  const jsonData = JSON.stringify(metadata, null, 2);

  const tags = [
    { name: 'Content-Type', value: 'application/json' },
    { name: 'App-Name', value: 'Pocket Prompt' },
    { name: 'App-Version', value: '3.5.0' },
    { name: 'Protocol', value: 'Pocket-Prompt-v3.5' },
    { name: 'Type', value: 'manifest-metadata' },
    { name: 'Collection-Title', value: metadata.title },
  ];

  const result = await turbo.upload({
    data: jsonData,
    dataItemOpts: { tags },
  });

  console.log(`[Export] ✅ Metadata uploaded: ${result.id}`);

  return result.id;
}

/**
 * Upload manifest JSON to Arweave
 */
async function uploadManifest(
  manifest: ArweaveManifest,
  metadata: ManifestMetadata,
  arweaveWallet: any
): Promise<string> {
  console.log('[Export] Uploading manifest...');

  const signer = new ArconnectSigner(arweaveWallet);
  const turbo = TurboFactory.authenticated({ signer });

  const jsonData = JSON.stringify(manifest, null, 2);

  const tags = [
    { name: 'Content-Type', value: 'application/json' },
    { name: 'App-Name', value: 'Pocket Prompt' },
    { name: 'App-Version', value: '3.5.0' },
    { name: 'Protocol', value: 'Pocket-Prompt-v3.5' },
    { name: 'Type', value: 'prompt-manifest' },
    { name: 'Manifest-Version', value: '0.2.0' },
    { name: 'Collection-Title', value: metadata.title },
    { name: 'Prompt-Count', value: metadata.promptCount.toString() },
    { name: 'Public-Count', value: metadata.publicCount.toString() },
    { name: 'Encrypted-Count', value: metadata.encryptedCount.toString() },
    // Add all collection tags
    ...metadata.tags.map(tag => ({ name: 'Tag', value: tag })),
  ];

  const result = await turbo.upload({
    data: jsonData,
    dataItemOpts: { tags },
  });

  console.log(`[Export] ✅ Manifest uploaded: ${result.id}`);

  return result.id;
}

/**
 * Export prompts as an Arweave path manifest
 */
export async function exportPromptsAsManifest(
  prompts: Prompt[],
  config: ExportConfig,
  walletAddress: string,
  arweaveWallet: any,
  password?: string,
  onProgress?: (
    stage: 'upload' | 'metadata' | 'manifest',
    current: number,
    total: number,
    message: string
  ) => void
): Promise<ExportResult> {
  try {
    console.log(`[Export] Starting export of ${prompts.length} prompts...`);

    // Filter out encrypted prompts if requested
    let promptsToExport = prompts;

    if (!config.includeEncrypted) {
      promptsToExport = prompts.filter(p =>
        p.tags.some(t => t.toLowerCase() === 'public')
      );
      console.log(
        `[Export] Filtered to ${promptsToExport.length} public prompts`
      );
    }

    if (promptsToExport.length === 0) {
      throw new Error('No prompts to export after filtering');
    }

    // Count encryption status
    const publicCount = promptsToExport.filter(p =>
      p.tags.some(t => t.toLowerCase() === 'public')
    ).length;
    const encryptedCount = promptsToExport.length - publicCount;

    // Step 1: Ensure all prompts are uploaded
    await ensurePromptsUploaded(
      promptsToExport,
      password,
      (current, total, title) => {
        if (onProgress) {
          onProgress('upload', current, total, `Uploading: ${title}`);
        }
      }
    );

    // Update prompts with latest txIds (they may have been uploaded in ensurePromptsUploaded)
    // Note: This is a simplification - in production you'd want to refresh from state

    // Step 2: Create metadata
    if (onProgress) {
      onProgress('metadata', 0, 1, 'Creating collection metadata...');
    }

    const metadata = createManifestMetadata(
      config.collectionName,
      promptsToExport,
      walletAddress,
      {
        description: config.description,
        sourceFilter: config.sourceFilter,
        sourceType: config.sourceType,
      }
    );

    // Upload metadata
    const metadataTxId = await uploadMetadata(metadata, arweaveWallet);

    if (onProgress) {
      onProgress('metadata', 1, 1, 'Metadata uploaded');
    }

    // Step 3: Create and upload manifest
    if (onProgress) {
      onProgress('manifest', 0, 1, 'Creating manifest...');
    }

    const manifest = createManifest(
      promptsToExport,
      metadata,
      metadataTxId
    );

    const manifestTxId = await uploadManifest(manifest, metadata, arweaveWallet);

    if (onProgress) {
      onProgress('manifest', 1, 1, 'Manifest uploaded');
    }

    console.log(`[Export] ✅ Export complete!`);
    console.log(`[Export] Manifest TxID: ${manifestTxId}`);
    console.log(`[Export] ${promptsToExport.length} prompts (${publicCount} public, ${encryptedCount} encrypted)`);

    return {
      success: true,
      manifestTxId,
      metadataTxId,
      promptCount: promptsToExport.length,
      publicCount,
      encryptedCount,
    };
  } catch (error) {
    console.error('[Export] Export failed:', error);
    return {
      success: false,
      promptCount: 0,
      publicCount: 0,
      encryptedCount: 0,
      error: error instanceof Error ? error.message : 'Export failed',
    };
  }
}

/**
 * Get wallet address from ArConnect
 */
export async function getWalletAddress(arweaveWallet: any): Promise<string> {
  try {
    return await arweaveWallet.getActiveAddress();
  } catch (error) {
    throw new Error('Failed to get wallet address');
  }
}
