import { TurboFactory, ArconnectSigner } from '@ardrive/turbo-sdk/web';
import type { Prompt, ArweaveUploadResult } from '@/shared/types/prompt';
import { prepareContentForUpload, prepareContentForDisplay, shouldEncrypt, clearEncryptionCache } from '@/core/encryption/crypto';
import { getUploadTags, getQueryFilters } from '@/backend/config/arweave';

const ARWEAVE_GATEWAY = 'https://arweave.net';

// GraphQL endpoints - Goldsky has superior indexing speed and reliability
const GRAPHQL_ENDPOINTS = {
  primary: 'https://arweave-search.goldsky.com/graphql',
  fallback: 'https://arweave.net/graphql',
};

/**
 * Execute GraphQL query with automatic fallback
 * Tries Goldsky first (faster indexing), falls back to arweave.net on failure
 */
async function executeGraphQLQuery(query: string, variables: Record<string, any>): Promise<any> {
  const endpoints = [GRAPHQL_ENDPOINTS.primary, GRAPHQL_ENDPOINTS.fallback];

  for (let i = 0; i < endpoints.length; i++) {
    const endpoint = endpoints[i];
    const isPrimary = i === 0;

    try {
      console.log(`[GraphQL] ${isPrimary ? 'Primary (Goldsky)' : 'Fallback (Arweave.net)'} query attempt...`);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, variables }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
      }

      console.log(`[GraphQL] ${isPrimary ? 'Goldsky' : 'Arweave.net'} query successful`);
      return result;
    } catch (error) {
      console.warn(`[GraphQL] ${isPrimary ? 'Goldsky' : 'Arweave.net'} failed:`, error);

      // If this was the last endpoint, throw the error
      if (i === endpoints.length - 1) {
        throw error;
      }

      // Otherwise, continue to next endpoint
      console.log(`[GraphQL] Trying fallback endpoint...`);
    }
  }
}

// GraphQL response types
interface GraphQLTag {
  name: string;
  value: string;
}

interface GraphQLNode {
  id: string;
  tags: GraphQLTag[];
  block?: {
    height: number;
    timestamp: number;
  };
}

interface GraphQLEdge {
  cursor: string;
  node: GraphQLNode;
}

interface GraphQLPageInfo {
  hasNextPage: boolean;
}

interface GraphQLTransactionsResponse {
  data: {
    transactions: {
      pageInfo: GraphQLPageInfo;
      edges: GraphQLEdge[];
    };
  };
}

/**
 * Query user's prompts from Arweave using GraphQL
 * Discovers all prompts owned by the wallet address
 */
export async function queryUserPrompts(
  walletAddress: string,
  cursor?: string
): Promise<{ txIds: string[]; hasNextPage: boolean; nextCursor: string | null }> {
  const { protocol } = getQueryFilters();

  const query = `
    query($owner: String!, $cursor: String) {
      transactions(
        owners: [$owner]
        tags: [
          { name: "Protocol", values: ["${protocol}"] }
          { name: "Type", values: ["prompt"] }
        ]
        sort: HEIGHT_DESC
        first: 100
        after: $cursor
      ) {
        pageInfo {
          hasNextPage
        }
        edges {
          cursor
          node {
            id
            tags {
              name
              value
            }
            block {
              height
              timestamp
            }
          }
        }
      }
    }
  `;

  try {
    console.log('[GraphQL] Querying for wallet:', walletAddress);

    const result: GraphQLTransactionsResponse = await executeGraphQLQuery(query, {
      owner: walletAddress,
      cursor
    });

    const { edges, pageInfo } = result.data.transactions;

    const txIds = edges.map(edge => edge.node.id);
    const nextCursor = edges.length > 0 ? edges[edges.length - 1].cursor : null;

    console.log(`[GraphQL] Found ${txIds.length} transactions for this page (hasNextPage: ${pageInfo.hasNextPage})`);
    if (txIds.length > 0) {
      console.log('[GraphQL] Sample transaction:', txIds[0]);
      console.log('[GraphQL] Tags:', edges[0].node.tags);
    }

    return {
      txIds,
      hasNextPage: pageInfo.hasNextPage,
      nextCursor,
    };
  } catch (error) {
    console.error('[GraphQL] Query error:', error);
    return {
      txIds: [],
      hasNextPage: false,
      nextCursor: null,
    };
  }
}

/**
 * Query all user's prompts with automatic pagination
 * Returns all transaction IDs across multiple pages
 */
export async function queryAllUserPrompts(walletAddress: string): Promise<string[]> {
  const allTxIds: string[] = [];
  let hasNextPage = true;
  let cursor: string | null = null;

  while (hasNextPage) {
    const result = await queryUserPrompts(walletAddress, cursor || undefined);
    allTxIds.push(...result.txIds);
    hasNextPage = result.hasNextPage;
    cursor = result.nextCursor;

    console.log(`Discovered ${result.txIds.length} prompts. Total: ${allTxIds.length}`);

    // Safety limit to prevent infinite loops
    if (allTxIds.length > 10000) {
      console.warn('Reached safety limit of 10000 prompts');
      break;
    }
  }

  return allTxIds;
}

/**
 * Query prompts by specific tags (for public discovery)
 */
export async function queryPromptsByTags(
  tags: string[],
  cursor?: string
): Promise<{ txIds: string[]; hasNextPage: boolean; nextCursor: string | null }> {
  const { protocol } = getQueryFilters();
  const tagFilters = tags.map(tag => `{ name: "Tag", values: ["${tag}"] }`).join('\n');

  const query = `
    query($cursor: String) {
      transactions(
        tags: [
          { name: "Protocol", values: ["${protocol}"] }
          { name: "Type", values: ["prompt"] }
          { name: "Encrypted", values: ["false"] }
          ${tagFilters}
        ]
        sort: HEIGHT_DESC
        first: 100
        after: $cursor
      ) {
        pageInfo {
          hasNextPage
        }
        edges {
          cursor
          node {
            id
            tags {
              name
              value
            }
            block {
              height
              timestamp
            }
          }
        }
      }
    }
  `;

  try {
    const result: GraphQLTransactionsResponse = await executeGraphQLQuery(query, { cursor });
    const { edges, pageInfo } = result.data.transactions;

    const txIds = edges.map(edge => edge.node.id);
    const nextCursor = edges.length > 0 ? edges[edges.length - 1].cursor : null;

    return {
      txIds,
      hasNextPage: pageInfo.hasNextPage,
      nextCursor,
    };
  } catch (error) {
    console.error('GraphQL query error:', error);
    return {
      txIds: [],
      hasNextPage: false,
      nextCursor: null,
    };
  }
}

/**
 * Upload a prompt to Arweave using Turbo SDK
 * Free for data under 100 KiB
 */
export async function uploadPrompt(
  prompt: Prompt,
  arweaveWallet: any,
  password?: string
): Promise<ArweaveUploadResult> {
  try {
    // Create ArConnect signer
    const signer = new ArconnectSigner(arweaveWallet);

    // Create authenticated turbo instance
    const turbo = TurboFactory.authenticated({ signer });

    // Encrypt content if no "public" tag
    const isPublic = !shouldEncrypt(prompt.tags);
    const processedContent = await prepareContentForUpload(prompt.content, prompt.tags, password);

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

    // Build comprehensive tags from config
    const tags = getUploadTags(prompt, !isPublic);

    // Use upload() method for simple data upload with proper tags
    console.log('[Upload] Uploading prompt with tags:', {
      Protocol: tags.find(t => t.name === 'Protocol')?.value,
      Type: tags.find(t => t.name === 'Type')?.value,
      Encrypted: tags.find(t => t.name === 'Encrypted')?.value,
      'Prompt-Id': tags.find(t => t.name === 'Prompt-Id')?.value,
    });

    const result = await turbo.upload({
      data,
      dataItemOpts: { tags },
    });

    console.log('[Upload] Success! Transaction ID:', result.id);
    console.log('[Upload] ⚠️  GraphQL indexing may take 1-10 minutes. Prompt cached locally for immediate access.');

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
 * Archive or restore a prompt on Arweave
 * This reuploads the prompt with updated archive status but does NOT increment version
 * Creates a new transaction with the Archived tag updated
 */
export async function updatePromptArchiveStatus(
  prompt: Prompt,
  isArchived: boolean,
  arweaveWallet: any,
  password?: string
): Promise<ArweaveUploadResult> {
  try {
    // Create ArConnect signer
    const signer = new ArconnectSigner(arweaveWallet);

    // Create authenticated turbo instance
    const turbo = TurboFactory.authenticated({ signer });

    // Update the prompt's archive status
    const updatedPrompt = {
      ...prompt,
      isArchived,
      updatedAt: Date.now(),
    };

    // Encrypt content if needed (use existing content which may already be encrypted)
    const isPublic = !shouldEncrypt(prompt.tags);
    const processedContent = await prepareContentForUpload(prompt.content, prompt.tags, password);

    // Create upload payload with updated archive status
    const uploadData = {
      ...updatedPrompt,
      content: processedContent,
    };

    const data = JSON.stringify(uploadData, null, 2);

    // Build comprehensive tags from config (includes Archived tag)
    const tags = getUploadTags(updatedPrompt, !isPublic);

    console.log('[Archive Update] Uploading prompt with archive status:', {
      'Prompt-Id': tags.find(t => t.name === 'Prompt-Id')?.value,
      Archived: tags.find(t => t.name === 'Archived')?.value,
    });

    const result = await turbo.upload({
      data,
      dataItemOpts: { tags },
    });

    console.log(`[Archive Update] Success! Transaction ID: ${result.id}`);
    console.log('[Archive Update] ⚠️  GraphQL indexing may take 1-10 minutes. Prompt cached locally for immediate access.');

    return {
      id: result.id,
      success: true,
    };
  } catch (error) {
    console.error('Archive update error:', error);
    return {
      id: '',
      success: false,
      error: error instanceof Error ? error.message : 'Archive update failed',
    };
  }
}

/**
 * Bulk upload multiple prompts in parallel
 *
 * Signature requirements:
 * - 1 signature for master encryption key (session-cached)
 * - 1 signature per prompt for upload (ANS-104 data item spec requirement)
 *
 * Benefits:
 * - Parallel uploads (faster than sequential)
 * - Single encryption signature for all prompts
 * - All uploads batched in UI as one operation
 *
 * Note: ArConnect may show multiple signature prompts (one per prompt).
 * This is required by the ANS-104 specification - each data item must be signed.
 */
export async function bulkUploadPrompts(
  prompts: Omit<Prompt, 'id' | 'createdAt' | 'updatedAt' | 'currentTxId' | 'versions' | 'isSynced' | 'isArchived'>[],
  arweaveWallet: any,
  password?: string
): Promise<{ success: boolean; results: ArweaveUploadResult[]; errors: string[] }> {
  try {
    console.log(`[Bulk Upload] Starting bulk upload of ${prompts.length} prompts`);
    console.log('[Bulk Upload] Note: Encryption requires 1 signature, uploads require 1 signature each');

    // Create ArConnect signer
    const signer = new ArconnectSigner(arweaveWallet);

    // Create authenticated turbo instance
    const turbo = TurboFactory.authenticated({ signer });

    // Prepare all prompts (this will trigger encryption with 1 signature)
    const preparedPrompts: Prompt[] = [];

    for (const promptData of prompts) {
      const prompt: Prompt = {
        ...promptData,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        currentTxId: '',
        versions: [],
        isArchived: false,
        isSynced: false,
      };

      // Encrypt content if needed (uses cached master key after first prompt)
      const processedContent = await prepareContentForUpload(prompt.content, prompt.tags, password);

      preparedPrompts.push({ ...prompt, content: processedContent as any });
    }

    console.log(`[Bulk Upload] Encryption complete. Uploading ${preparedPrompts.length} prompts in parallel...`);

    // Upload all prompts in parallel
    const uploadPromises = preparedPrompts.map(async (prompt) => {
      const isPublic = !shouldEncrypt(prompt.tags);
      const data = JSON.stringify({ ...prompt }, null, 2);

      // Build tags from config
      const tags = getUploadTags(prompt, !isPublic);

      try {
        const result = await turbo.upload({
          data,
          dataItemOpts: { tags },
        });

        return {
          success: true,
          id: result.id,
          prompt: {
            ...prompt,
            currentTxId: result.id,
            versions: [{
              txId: result.id,
              version: 1,
              timestamp: Date.now(),
            }],
            isSynced: true,
          },
        };
      } catch (error) {
        return {
          success: false,
          id: '',
          error: error instanceof Error ? error.message : 'Upload failed',
          prompt,
        };
      }
    });

    const uploadResults = await Promise.all(uploadPromises);

    // Process results
    const results: ArweaveUploadResult[] = [];
    const errors: string[] = [];

    uploadResults.forEach((result) => {
      if (result.success && result.prompt) {
        results.push({
          id: result.id,
          success: true,
          prompt: result.prompt,
        });
      } else {
        const errorMsg = result.error || `Failed to upload prompt "${result.prompt?.title}"`;
        errors.push(errorMsg);
        results.push({
          id: '',
          success: false,
          error: errorMsg,
        });
      }
    });

    const successCount = results.filter(r => r.success).length;
    console.log(`[Bulk Upload] Complete: ${successCount}/${prompts.length} successful, ${errors.length} failed`);
    console.log('[Bulk Upload] ⚠️  GraphQL indexing may take 1-10 minutes per prompt. Prompts cached locally for immediate access.');

    return {
      success: errors.length === 0,
      results,
      errors,
    };
  } catch (error) {
    console.error('[Bulk Upload] Bulk upload error:', error);
    return {
      success: false,
      results: [],
      errors: [error instanceof Error ? error.message : 'Bulk upload failed'],
    };
  }
}

/**
 * Fetch transaction tags from GraphQL
 */
async function fetchTransactionTags(txId: string): Promise<GraphQLTag[]> {
  const query = `
    query($id: ID!) {
      transaction(id: $id) {
        tags {
          name
          value
        }
      }
    }
  `;

  try {
    const result = await executeGraphQLQuery(query, { id: txId });
    return result.data?.transaction?.tags || [];
  } catch (error) {
    console.error(`[Fetch Tags] ${txId} - FAILED:`, error);
    return [];
  }
}

/**
 * Fetch a prompt from Arweave by transaction ID
 */
export async function fetchPrompt(txId: string, password?: string, skipDecryption = false): Promise<Prompt | null> {
  try {
    console.log(`[Fetch] Fetching prompt ${txId}...`);

    // Fetch both the data and tags in parallel
    const [dataResponse, tags] = await Promise.all([
      fetch(`${ARWEAVE_GATEWAY}/${txId}`),
      fetchTransactionTags(txId),
    ]);

    if (!dataResponse.ok) {
      throw new Error(`Failed to fetch prompt: ${dataResponse.statusText}`);
    }
    const promptData: any = await dataResponse.json();

    console.log(`[Fetch] ${txId} - Title: "${promptData.title}", Encrypted: ${typeof promptData.content === 'object' && promptData.content.isEncrypted}`);

    // Check if content is encrypted and decrypt if needed
    let content = promptData.content;
    if (typeof content === 'object' && content.isEncrypted) {
      if (skipDecryption) {
        // Keep encrypted content as-is for password validation
        console.log(`[Fetch] ${txId} - Keeping encrypted content for validation`);
      } else {
        try {
          console.log(`[Fetch] ${txId} - Decrypting...`);
          content = await prepareContentForDisplay(content, password);
          console.log(`[Fetch] ${txId} - Decryption successful`);
        } catch (error) {
          console.error(`[Fetch] ${txId} - Decryption FAILED:`, error);
          // If decryption fails, return null so the prompt is skipped
          return null;
        }
      }
    }

    // Read archive status from tags (defaults to false if not found)
    const archivedTag = tags.find(tag => tag.name === 'Archived');
    const isArchived = archivedTag?.value === 'true';

    const prompt: Prompt = {
      ...promptData,
      content,
      currentTxId: txId, // Ensure we have the txId we just fetched
      isSynced: true, // If we fetched it from Arweave, it's synced
      isArchived, // Override with tag value from Arweave
    };

    console.log(`[Fetch] ${txId} - SUCCESS (Archived: ${isArchived})`);
    return prompt;
  } catch (error) {
    console.error(`[Fetch] ${txId} - FAILED:`, error);
    return null;
  }
}

/**
 * Fetch multiple prompts in parallel
 */
export async function fetchPrompts(txIds: string[], password?: string, skipDecryption = false): Promise<Prompt[]> {
  const promises = txIds.map(txId => fetchPrompt(txId, password, skipDecryption));
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
      // Clear the encryption session cache
      clearEncryptionCache();
    } catch (error) {
      console.error('Wallet disconnection error:', error);
    }
  }
}

/**
 * Get ArConnect wallet object
 */
export function getArweaveWallet(): any | null {
  if (typeof window === 'undefined') return null;
  return (window as any).arweaveWallet || null;
}

/**
 * Get active wallet address
 */
export async function getWalletAddress(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const arweaveWallet = getArweaveWallet();

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