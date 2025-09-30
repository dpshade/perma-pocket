import { TurboFactory, ArconnectSigner } from '@ardrive/turbo-sdk/web';
import type { Prompt, ArweaveUploadResult } from '@/types/prompt';
import { prepareContentForUpload, prepareContentForDisplay, shouldEncrypt } from '@/lib/encryption';

const ARWEAVE_GATEWAY = 'https://arweave.net';

/**
 * Upload a prompt to Arweave using Turbo SDK
 * Free for data under 100 KiB
 */
export async function uploadPrompt(
  prompt: Prompt,
  arweaveWallet: any
): Promise<ArweaveUploadResult> {
  try {
    // Create ArConnect signer
    const signer = new ArconnectSigner(arweaveWallet);

    // Create authenticated turbo instance
    const turbo = TurboFactory.authenticated({ signer });

    // Encrypt content if no "public" tag
    const isPublic = !shouldEncrypt(prompt.tags);
    const processedContent = await prepareContentForUpload(prompt.content, prompt.tags);

    // Create upload payload with potentially encrypted content
    const uploadData = {
      ...prompt,
      content: processedContent,
    };

    const data = JSON.stringify(uploadData, null, 2);

    // Check size (100 KiB = 102400 bytes)
    const sizeInBytes = new Blob([data]).size;

    if (sizeInBytes > 102400) {
      console.warn(`Prompt size (${sizeInBytes} bytes) exceeds free tier (100 KiB)`);
    }

    // Build comprehensive tags including user-defined ones
    const tags = [
      // Required tags
      { name: 'Content-Type', value: 'application/json' },
      { name: 'App-Name', value: 'Pocket Prompt' },
      { name: 'App-Version', value: '1.0.0' },

      // Data identification
      { name: 'Type', value: 'prompt' },
      { name: 'Prompt-Id', value: prompt.id },
      { name: 'Title', value: prompt.title },

      // Metadata
      { name: 'Description', value: prompt.description || '' },
      { name: 'Created-At', value: prompt.createdAt.toString() },
      { name: 'Updated-At', value: prompt.updatedAt.toString() },
      { name: 'Version', value: prompt.versions.length.toString() },

      // Encryption status
      { name: 'Encrypted', value: isPublic ? 'false' : 'true' },

      // User-defined tags from prompt
      ...prompt.tags.map(tag => ({ name: 'Tag', value: tag })),

      // Protocol tags for discoverability
      { name: 'Protocol', value: 'Pocket-Prompt-v1' },
      { name: 'Data-Protocol', value: 'Prompt' },
    ];

    // Use upload() method for simple data upload with proper tags
    const result = await turbo.upload({
      data,
      dataItemOpts: { tags },
    });

    return {
      id: result.id,
      success: true,
    };
  } catch (error) {
    console.error('Arweave upload error:', error);
    return {
      id: '',
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed',
    };
  }
}

/**
 * Fetch a prompt from Arweave by transaction ID
 */
export async function fetchPrompt(txId: string): Promise<Prompt | null> {
  try {
    const response = await fetch(`${ARWEAVE_GATEWAY}/${txId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch prompt: ${response.statusText}`);
    }
    const promptData: any = await response.json();

    // Check if content is encrypted and decrypt if needed
    let content = promptData.content;
    if (typeof content === 'object' && content.isEncrypted) {
      try {
        content = await prepareContentForDisplay(content);
      } catch (error) {
        console.error('Decryption error for prompt:', txId, error);
        // If decryption fails, return null so the prompt is skipped
        return null;
      }
    }

    const prompt: Prompt = {
      ...promptData,
      content,
    };

    return prompt;
  } catch (error) {
    console.error('Arweave fetch error:', error);
    return null;
  }
}

/**
 * Fetch multiple prompts in parallel
 */
export async function fetchPrompts(txIds: string[]): Promise<Prompt[]> {
  const promises = txIds.map(txId => fetchPrompt(txId));
  const results = await Promise.allSettled(promises);

  return results
    .filter((result): result is PromiseFulfilledResult<Prompt> =>
      result.status === 'fulfilled' && result.value !== null
    )
    .map(result => result.value);
}

/**
 * Check if wallet is connected (ArConnect)
 */
export async function checkWalletConnection(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const arweaveWallet = (window as any).arweaveWallet;
  if (!arweaveWallet) return false;

  try {
    const permissions = await arweaveWallet.getPermissions();
    return permissions.length > 0;
  } catch {
    return false;
  }
}

/**
 * Connect to ArConnect wallet
 */
export async function connectWallet(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const arweaveWallet = (window as any).arweaveWallet;

  if (!arweaveWallet) {
    throw new Error('ArConnect not installed. Please install ArConnect extension.');
  }

  try {
    await arweaveWallet.connect([
      'ACCESS_ADDRESS',
      'SIGN_TRANSACTION',
      'ACCESS_PUBLIC_KEY',
      'SIGNATURE',
      'ENCRYPT',
      'DECRYPT',
    ]);
    const address = await arweaveWallet.getActiveAddress();
    return address;
  } catch (error) {
    console.error('Wallet connection error:', error);
    throw error;
  }
}

/**
 * Disconnect from ArConnect wallet
 */
export async function disconnectWallet(): Promise<void> {
  if (typeof window === 'undefined') return;
  const arweaveWallet = (window as any).arweaveWallet;

  if (arweaveWallet) {
    try {
      await arweaveWallet.disconnect();
    } catch (error) {
      console.error('Wallet disconnection error:', error);
    }
  }
}

/**
 * Get active wallet address
 */
export async function getWalletAddress(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const arweaveWallet = (window as any).arweaveWallet;

  if (!arweaveWallet) return null;

  try {
    return await arweaveWallet.getActiveAddress();
  } catch {
    return null;
  }
}

/**
 * Get wallet JWK for signing
 */
export async function getWalletJWK(): Promise<any> {
  if (typeof window === 'undefined') throw new Error('Not in browser');
  const arweaveWallet = (window as any).arweaveWallet;

  if (!arweaveWallet) {
    throw new Error('ArConnect not available');
  }

  // Note: ArConnect doesn't expose the actual JWK for security
  // We'll use ArConnect's signing capabilities instead
  // For Turbo SDK, we need to create a custom signer
  return arweaveWallet;
}