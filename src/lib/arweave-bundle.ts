/**
 * Bundle-based upload for bulk operations
 *
 * Architecture: Multiple prompts in ONE transaction
 * - Requires only 1 signature (for the bundle)
 * - All prompts stored as JSON array in single data item
 * - Bundle has metadata tags for discovery
 * - Must fetch entire bundle to access any prompt
 */

import { TurboFactory, ArconnectSigner } from '@ardrive/turbo-sdk/web';
import type { Prompt } from '@/types/prompt';
import { prepareContentForUpload, shouldEncrypt } from '@/lib/encryption';

const ARWEAVE_GATEWAY = 'https://arweave.net';

export interface PromptBundle {
  id: string;
  version: 1;
  createdAt: number;
  prompts: Prompt[];
  metadata: {
    count: number;
    encrypted: number;
    public: number;
    tags: string[]; // Unique tags across all prompts
  };
}

export interface BundleUploadResult {
  success: boolean;
  bundleId: string;
  bundleTxId: string;
  promptCount: number;
  error?: string;
}

/**
 * Upload multiple prompts as a single bundle (1 signature)
 *
 * Benefits:
 * - Only 1 signature required (for entire bundle)
 * - Fast parallel encryption (session key cached)
 * - Single transaction fee
 *
 * Tradeoffs:
 * - No individual prompt txIds (all share bundle txId)
 * - Must fetch entire bundle to access any prompt
 * - GraphQL queries return bundles, not individual prompts
 * - Bundle size limits (500 MiB max)
 */
export async function uploadPromptBundle(
  prompts: Omit<Prompt, 'id' | 'createdAt' | 'updatedAt' | 'currentTxId' | 'versions' | 'isSynced' | 'isArchived'>[],
  arweaveWallet: any
): Promise<BundleUploadResult> {
  try {
    console.log(`[Bundle Upload] Creating bundle with ${prompts.length} prompts`);

    // Create ArConnect signer
    const signer = new ArconnectSigner(arweaveWallet);
    const turbo = TurboFactory.authenticated({ signer });

    // Prepare all prompts
    const preparedPrompts: Prompt[] = [];
    let encryptedCount = 0;
    let publicCount = 0;
    const allTags = new Set<string>();

    for (const promptData of prompts) {
      const prompt: Prompt = {
        ...promptData,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        currentTxId: '', // Will be set to bundle txId after upload
        versions: [],
        isArchived: false,
        isSynced: false,
      };

      // Encrypt content if needed (uses cached master key)
      const isPublic = !shouldEncrypt(prompt.tags);
      const processedContent = await prepareContentForUpload(prompt.content, prompt.tags);

      preparedPrompts.push({
        ...prompt,
        content: processedContent as any,
      });

      // Track metadata
      if (isPublic) {
        publicCount++;
      } else {
        encryptedCount++;
      }

      prompt.tags.forEach(tag => allTags.add(tag));
    }

    // Create bundle structure
    const bundleId = crypto.randomUUID();
    const bundle: PromptBundle = {
      id: bundleId,
      version: 1,
      createdAt: Date.now(),
      prompts: preparedPrompts,
      metadata: {
        count: preparedPrompts.length,
        encrypted: encryptedCount,
        public: publicCount,
        tags: Array.from(allTags).sort(),
      },
    };

    const bundleData = JSON.stringify(bundle, null, 2);
    const sizeInBytes = new Blob([bundleData]).size;

    if (sizeInBytes > 500 * 1024 * 1024) {
      throw new Error(`Bundle size (${sizeInBytes} bytes) exceeds 500 MiB limit`);
    }

    console.log(`[Bundle Upload] Bundle size: ${(sizeInBytes / 1024).toFixed(2)} KB`);

    // Build bundle tags
    const tags = [
      { name: 'Content-Type', value: 'application/json' },
      { name: 'App-Name', value: 'Pocket Prompt' },
      { name: 'App-Version', value: '3.3.0' },
      { name: 'Protocol', value: 'Pocket-Prompt-v3.3' },
      { name: 'Type', value: 'prompt-bundle' }, // Different type for bundles
      { name: 'Bundle-Id', value: bundleId },
      { name: 'Prompt-Count', value: preparedPrompts.length.toString() },
      { name: 'Encrypted-Count', value: encryptedCount.toString() },
      { name: 'Public-Count', value: publicCount.toString() },
      { name: 'Created-At', value: Date.now().toString() },
      // Add all unique tags from prompts
      ...Array.from(allTags).map(tag => ({ name: 'Tag', value: tag })),
    ];

    console.log('[Bundle Upload] Uploading bundle (requires 1 signature)...');

    // Upload bundle - ONLY 1 SIGNATURE REQUIRED
    const result = await turbo.upload({
      data: bundleData,
      dataItemOpts: { tags },
    });

    console.log(`[Bundle Upload] ✅ Success! Bundle uploaded with txId: ${result.id}`);
    console.log(`[Bundle Upload] Contains ${prompts.length} prompts (${encryptedCount} encrypted, ${publicCount} public)`);
    console.log('[Bundle Upload] ⚠️  GraphQL indexing may take 1-10 minutes. Bundle cached locally for immediate access.');

    return {
      success: true,
      bundleId,
      bundleTxId: result.id,
      promptCount: preparedPrompts.length,
    };
  } catch (error) {
    console.error('[Bundle Upload] Upload failed:', error);
    return {
      success: false,
      bundleId: '',
      bundleTxId: '',
      promptCount: 0,
      error: error instanceof Error ? error.message : 'Bundle upload failed',
    };
  }
}

/**
 * Fetch a prompt bundle from Arweave
 */
export async function fetchPromptBundle(bundleTxId: string): Promise<PromptBundle | null> {
  try {
    console.log(`[Bundle Fetch] Fetching bundle ${bundleTxId}...`);
    const response = await fetch(`${ARWEAVE_GATEWAY}/${bundleTxId}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch bundle: ${response.statusText}`);
    }

    const bundle: PromptBundle = await response.json();
    console.log(`[Bundle Fetch] ✅ Retrieved bundle with ${bundle.prompts.length} prompts`);

    return bundle;
  } catch (error) {
    console.error(`[Bundle Fetch] Failed to fetch bundle ${bundleTxId}:`, error);
    return null;
  }
}

/**
 * Extract individual prompts from a bundle
 * Updates each prompt with the bundle's txId
 */
export function extractPromptsFromBundle(bundle: PromptBundle, bundleTxId: string): Prompt[] {
  return bundle.prompts.map(prompt => ({
    ...prompt,
    currentTxId: bundleTxId, // All prompts share the bundle's txId
    versions: [{
      txId: bundleTxId,
      version: 1,
      timestamp: bundle.createdAt,
    }],
    isSynced: true,
  }));
}

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

/**
 * Query user's prompt bundles from GraphQL
 */
export async function queryUserBundles(
  walletAddress: string
): Promise<string[]> {
  const query = `
    query($owner: String!) {
      transactions(
        owners: [$owner]
        tags: [
          { name: "Protocol", values: ["Pocket-Prompt-v3.3"] }
          { name: "Type", values: ["prompt-bundle"] }
        ]
        sort: HEIGHT_DESC
        first: 100
      ) {
        edges {
          node {
            id
          }
        }
      }
    }
  `;

  try {
    const result: any = await executeGraphQLQuery(query, { owner: walletAddress });
    const bundleTxIds = result.data.transactions.edges.map((edge: any) => edge.node.id);

    console.log(`[Bundle Query] Found ${bundleTxIds.length} bundles for wallet`);
    return bundleTxIds;
  } catch (error) {
    console.error('[Bundle Query] Query failed:', error);
    return [];
  }
}
