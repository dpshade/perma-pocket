/**
 * File size utilities for calculating upload sizes
 */

import type { Prompt } from '@/shared/types/prompt';
import { prepareContentForUpload, shouldEncrypt } from '@/core/encryption/crypto';

/**
 * Calculate the size of a prompt as it will be uploaded to Arweave
 * Includes encryption overhead if applicable
 */
export async function calculatePromptUploadSize(prompt: Prompt): Promise<number> {
  // Encrypt content if needed (same as upload flow)
  const processedContent = await prepareContentForUpload(prompt.content, prompt.tags);

  // Create the exact upload payload structure
  const uploadData = {
    ...prompt,
    content: processedContent,
  };

  // Stringify with same formatting as upload
  const data = JSON.stringify(uploadData, null, 2);

  // Calculate size in bytes
  return new Blob([data]).size;
}

/**
 * Estimate prompt upload size WITHOUT performing encryption
 * Uses approximation based on content length and encryption overhead
 * Useful for quick previews before wallet is connected
 */
export function estimatePromptUploadSize(prompt: Prompt | Partial<Prompt> & { id: string; title: string; content: string; tags: string[] }): number {
  // Base JSON structure overhead (keys, formatting, etc.)
  const jsonOverhead = JSON.stringify({
    id: prompt.id,
    title: prompt.title,
    description: prompt.description || '',
    tags: prompt.tags,
    currentTxId: (prompt as Prompt).currentTxId || '',
    versions: (prompt as Prompt).versions || [],
    createdAt: (prompt as Prompt).createdAt || Date.now(),
    updatedAt: (prompt as Prompt).updatedAt || Date.now(),
    isArchived: (prompt as Prompt).isArchived || false,
    isSynced: (prompt as Prompt).isSynced || false,
    content: '', // Placeholder
  }, null, 2).length;

  // Content size
  const contentSize = new Blob([prompt.content]).size;

  // Encryption overhead estimation (if applicable)
  const needsEncryption = shouldEncrypt(prompt.tags);
  const encryptionOverhead = needsEncryption
    ? Math.ceil(contentSize * 1.37) + 200 // Base64 ~1.37x + encrypted key/iv overhead
    : contentSize;

  return jsonOverhead + encryptionOverhead;
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number, decimals: number = 1): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);

  return `${value.toFixed(decimals)} ${sizes[i]}`;
}

/**
 * Check if upload size is within free tier (100 KiB)
 */
export function isWithinFreeTier(bytes: number): boolean {
  return bytes <= 102400; // 100 KiB = 102400 bytes
}

/**
 * Get warning level based on file size
 */
export function getSizeWarningLevel(bytes: number): 'ok' | 'warning' | 'error' {
  const FREE_TIER = 102400; // 100 KiB

  if (bytes <= FREE_TIER * 0.8) {
    return 'ok'; // Under 80 KiB - plenty of room
  } else if (bytes <= FREE_TIER) {
    return 'warning'; // 80-100 KiB - approaching limit
  } else {
    return 'error'; // Over 100 KiB - will cost credits
  }
}

/**
 * Calculate cost estimate for data over free tier
 * Based on Turbo pricing (approximate)
 */
export function estimateCost(bytes: number): { free: boolean; sizeOver: number; estimatedWinc?: number } {
  const FREE_TIER = 102400;

  if (bytes <= FREE_TIER) {
    return { free: true, sizeOver: 0 };
  }

  const sizeOver = bytes - FREE_TIER;
  // Approximate: ~1 AR = 1,000,000,000,000 winston
  // Typical rate: ~0.0001 AR per 1 MB (varies with network congestion)
  // For rough estimation: ~100 winston per byte over free tier
  const estimatedWinc = sizeOver * 100;

  return { free: false, sizeOver, estimatedWinc };
}

/**
 * Get a description of the size status
 */
export function getSizeStatusMessage(bytes: number): string {
  const level = getSizeWarningLevel(bytes);
  const formatted = formatBytes(bytes);

  switch (level) {
    case 'ok':
      return `${formatted} - Within free tier`;
    case 'warning':
      return `${formatted} - Approaching 100 KiB limit`;
    case 'error':
      const cost = estimateCost(bytes);
      return `${formatted} - Exceeds free tier by ${formatBytes(cost.sizeOver)} (will require credits)`;
  }
}
