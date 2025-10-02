import type { ArNSWalletConnector, AoAddress } from '@/shared/types/wallet';
import { ArweaveWebWallet } from 'arweave-wallet-connector';

/**
 * Custom error for Arweave.app wallet operations
 */
export class ArweaveAppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ArweaveAppError';
  }
}

/**
 * Execute a function with a timeout
 * @param fn Function to execute
 * @param timeoutMs Timeout in milliseconds
 * @returns The result of the function or 'timeout' string
 */
async function executeWithTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number
): Promise<T | 'timeout'> {
  return Promise.race([
    fn(),
    new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), timeoutMs)),
  ]);
}

/**
 * Arweave.app Wallet Connector
 * Connects to Arweave.app wallet using the arweave-wallet-connector library
 *
 * Initialize the wallet as soon as possible to get instant auto reconnect
 */
export class ArweaveAppWalletConnector implements ArNSWalletConnector {
  tokenType = 'arweave';
  private _wallet: InstanceType<typeof ArweaveWebWallet>;
  contractSigner?: any;
  turboSigner: any;

  constructor() {
    // Initialize the wallet immediately for instant auto reconnect
    this._wallet = new ArweaveWebWallet({
      name: 'Pocket Prompt',
      logo: 'https://arweave.net/your-logo-txid', // Replace with your app's logo if needed
    });

    // Set the wallet URL to arweave.app
    this._wallet.setUrl('arweave.app');

    // Create a proxy to add signMessage support for encryption
    const handler = {
      get: (target: any, prop: string) => {
        if (prop === 'signMessage') {
          return async (data: ArrayBuffer) => {
            return await target.signMessage(data, {
              hashAlgorithm: 'SHA-256',
            });
          };
        }
        if (prop === 'getActivePublicKey') {
          return async () => {
            return await target.getPublicKey();
          };
        }
        return target[prop];
      },
    };

    const proxiedWallet = new Proxy(this._wallet, handler);
    this.contractSigner = proxiedWallet as any;
    this.turboSigner = proxiedWallet as any;
  }

  /**
   * Execute Arweave.app API calls with timeout protection
   * The API can be unreliable, so we add a timeout
   */
  private async safeExecutor<T>(fn: () => Promise<T>): Promise<T> {
    const res = await executeWithTimeout(fn, 20000); // 20 second timeout for wallet operations

    if (res === 'timeout') {
      throw new ArweaveAppError(
        'Arweave.app wallet is not responding. Please check your connection and try again.'
      );
    }

    return res;
  }

  async connect(): Promise<void> {
    try {
      // Connect to arweave.app on user gesture
      await this.safeExecutor(async () => {
        await this._wallet.connect();
      });

      // Store wallet type in localStorage
      localStorage.setItem('walletType', 'ArweaveApp');
    } catch (error) {
      // Clean up on error
      localStorage.removeItem('walletType');
      console.error('Arweave.app connection error:', error);

      // Check if user cancelled
      if (error instanceof Error && error.message.includes('cancel')) {
        throw new ArweaveAppError('User cancelled authentication.');
      }

      if (error instanceof ArweaveAppError) {
        throw error;
      }

      throw new ArweaveAppError('Failed to connect to Arweave.app wallet. Please try again.');
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.safeExecutor(async () => {
        await this._wallet.disconnect();
      });
      localStorage.removeItem('walletType');
    } catch (error) {
      console.error('Arweave.app disconnection error:', error);
      // Still remove from localStorage even if disconnect fails
      localStorage.removeItem('walletType');
    }
  }

  async getWalletAddress(): Promise<AoAddress> {
    try {
      const address = await this.safeExecutor(async () => {
        // Access via namespaces API (standard for arweave-wallet-connector)
        if (this._wallet.namespaces?.arweaveWallet?.getActiveAddress) {
          return await this._wallet.namespaces.arweaveWallet.getActiveAddress();
        }
        // Fallback to address property
        if (this._wallet.address) {
          return this._wallet.address;
        }
        throw new ArweaveAppError('Unable to access wallet address');
      });

      if (!address) {
        throw new ArweaveAppError('No active address found in Arweave.app wallet.');
      }

      return address;
    } catch (error) {
      console.error('Failed to get Arweave.app wallet address:', error);

      if (error instanceof ArweaveAppError) {
        throw error;
      }

      throw new ArweaveAppError('Failed to retrieve wallet address from Arweave.app.');
    }
  }

  /**
   * Subscribe to wallet events
   */
  async on(event: string, listener: (data: any) => void): Promise<void> {
    // The ReactiveConnector supports event listening
    // Common events: 'connect', 'disconnect', 'activeAddress'
    if (this._wallet) {
      // @ts-ignore - ReactiveConnector may have event support
      this._wallet.on?.(event, listener);
    }
  }

  /**
   * Unsubscribe from wallet events
   */
  async off(event: string, listener: (data: any) => void): Promise<void> {
    if (this._wallet) {
      // @ts-ignore - ReactiveConnector may have event support
      this._wallet.off?.(event, listener);
    }
  }
}
