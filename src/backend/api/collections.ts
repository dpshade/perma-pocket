import { TurboFactory, ArconnectSigner } from '@ardrive/turbo-sdk/web';
import type { SavedSearch } from '@/shared/types/prompt';
import arweaveConfig from '../../../arweave.config.json';

const ARWEAVE_GATEWAY = 'https://arweave.net';

// GraphQL endpoints - Goldsky has superior indexing speed
const GRAPHQL_ENDPOINTS = {
  primary: 'https://arweave-search.goldsky.com/graphql',
  fallback: 'https://arweave.net/graphql',
};

interface CollectionsData {
  collections: SavedSearch[];
}

/**
 * Execute GraphQL query with automatic fallback
 */
async function executeGraphQLQuery(query: string, variables: Record<string, any>): Promise<any> {
  const endpoints = [GRAPHQL_ENDPOINTS.primary, GRAPHQL_ENDPOINTS.fallback];

  for (let i = 0; i < endpoints.length; i++) {
    const endpoint = endpoints[i];
    const isPrimary = i === 0;

    try {
      console.log(`[Collections GraphQL] ${isPrimary ? 'Primary (Goldsky)' : 'Fallback (Arweave.net)'} query attempt...`);

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

      console.log(`[Collections GraphQL] ${isPrimary ? 'Goldsky' : 'Arweave.net'} query successful`);
      return result;
    } catch (error) {
      console.warn(`[Collections GraphQL] ${isPrimary ? 'Goldsky' : 'Arweave.net'} failed:`, error);

      if (i === endpoints.length - 1) {
        throw error;
      }

      console.log(`[Collections GraphQL] Trying fallback endpoint...`);
    }
  }
}

/**
 * Get collections upload tags from config
 */
function getCollectionsTags(collectionsCount: number): Array<{ name: string; value: string }> {
  const tags = arweaveConfig.upload.collectionsTags.map(tag => ({
    name: tag.name,
    value: tag.value,
  }));

  // Add dynamic tag for count
  tags.push({
    name: 'Collections-Count',
    value: collectionsCount.toString(),
  });

  return tags;
}

/**
 * Upload all collections to Arweave as single transaction
 */
export async function uploadCollections(
  collections: SavedSearch[],
  arweaveWallet: any
): Promise<{ success: boolean; txId?: string; error?: string }> {
  try {
    console.log(`[Collections Upload] Uploading ${collections.length} collections to Arweave`);

    // Create ArConnect signer
    const signer = new ArconnectSigner(arweaveWallet);

    // Create authenticated turbo instance
    const turbo = TurboFactory.authenticated({ signer });

    // Prepare data
    const data: CollectionsData = {
      collections,
    };

    const jsonData = JSON.stringify(data, null, 2);

    // Build tags
    const tags = getCollectionsTags(collections.length);

    // Upload
    const result = await turbo.upload({
      data: jsonData,
      dataItemOpts: { tags },
    });

    console.log(`[Collections Upload] Success! TxID: ${result.id}`);

    return {
      success: true,
      txId: result.id,
    };
  } catch (error) {
    console.error('[Collections Upload] Failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed',
    };
  }
}

/**
 * Query for latest collections transaction
 */
export async function queryLatestCollections(
  walletAddress: string
): Promise<{ txId: string | null; error?: string }> {
  try {
    console.log(`[Collections Query] Querying latest collections for wallet: ${walletAddress}`);

    const query = `
      query GetLatestCollections($owner: String!) {
        transactions(
          first: 1
          owners: [$owner]
          tags: [
            { name: "App-Name", values: ["Pocket Prompt"] }
            { name: "Protocol", values: ["Pocket-Prompt-v3.4"] }
            { name: "Type", values: ["collections"] }
          ]
          sort: HEIGHT_DESC
        ) {
          edges {
            node {
              id
              tags {
                name
                value
              }
              block {
                timestamp
                height
              }
            }
          }
        }
      }
    `;

    const result = await executeGraphQLQuery(query, { owner: walletAddress });

    const edges = result.data?.transactions?.edges || [];

    if (edges.length === 0) {
      console.log('[Collections Query] No collections found');
      return { txId: null };
    }

    const latestTxId = edges[0].node.id;
    console.log(`[Collections Query] Found latest collections: ${latestTxId}`);

    return { txId: latestTxId };
  } catch (error) {
    console.error('[Collections Query] Failed:', error);
    return {
      txId: null,
      error: error instanceof Error ? error.message : 'Query failed',
    };
  }
}

/**
 * Fetch collections from specific transaction
 */
export async function fetchCollections(txId: string): Promise<SavedSearch[]> {
  try {
    console.log(`[Collections Fetch] Fetching collections from: ${txId}`);

    const url = `${ARWEAVE_GATEWAY}/${txId}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data: CollectionsData = await response.json();

    console.log(`[Collections Fetch] Loaded ${data.collections.length} collections`);

    return data.collections;
  } catch (error) {
    console.error('[Collections Fetch] Failed:', error);
    throw error;
  }
}

/**
 * Check if a transaction is confirmed on Arweave
 * Returns true if the transaction can be queried successfully
 */
export async function isTransactionConfirmed(txId: string): Promise<boolean> {
  try {
    const query = `
      query CheckTransaction($id: ID!) {
        transaction(id: $id) {
          id
        }
      }
    `;

    const result = await executeGraphQLQuery(query, { id: txId });
    return result.data?.transaction?.id === txId;
  } catch (error) {
    console.warn(`[Collections Check] Transaction ${txId} not yet confirmed:`, error);
    return false;
  }
}
