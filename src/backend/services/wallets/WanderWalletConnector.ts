import type { ArNSWalletConnector, AoAddress } from '@/shared/types/wallet';
import type { PermissionType } from 'arconnect';

/**
 * Required permissions for Wander wallet
 */
export const WANDER_WALLET_PERMISSIONS: PermissionType[] = [
  'ACCESS_ADDRESS',
  'ACCESS_ALL_ADDRESSES',
  'ACCESS_PUBLIC_KEY',
  'SIGN_TRANSACTION',
  'ACCESS_ARWEAVE_CONFIG',
  'SIGNATURE',
];

/**
 * Custom error for wallet not installed
 */
export class WalletNotInstalledError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WalletNotInstalledError';
  }
}

/**
 * Custom error for Wander wallet operations
 */
export class WanderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WanderError';
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
 * Wander Wallet Connector
 * Connects to Wander wallet extension via window.arweaveWallet
 */
export class WanderWalletConnector implements ArNSWalletConnector {
  tokenType = 'arweave';
  private _wallet: Window['arweaveWallet'];
  contractSigner: Window['arweaveWallet'];
  turboSigner: any;

  constructor() {
    if (typeof window === 'undefined') {
      throw new WalletNotInstalledError('Wander is not available in this environment.');
    }
    this._wallet = (window as any).arweaveWallet;
    this.contractSigner = (window as any).arweaveWallet;
    this.turboSigner = (window as any).arweaveWallet;
  }

  /**
   * Execute Wander API calls with timeout protection
   * The Wander API can be unreliable, so we add a timeout
   */
  private async safeWanderApiExecutor<T>(fn: () => T): Promise<T> {
    if (!this._wallet) {
      throw new WalletNotInstalledError('Wander is not installed.');
    }

    const res = await executeWithTimeout(() => Promise.resolve(fn()), 3000);

    if (res === 'timeout') {
      throw new Error('Wander wallet is not responding. Please check that the extension is running and try again.');
    }

    return res;
  }

  async connect(): Promise<void> {
    try {
      await this.safeWanderApiExecutor(async () => {
        // Cast to any to avoid type conflicts between arconnect versions
        await this._wallet.connect(WANDER_WALLET_PERMISSIONS as any);
      });

      // Store wallet type in localStorage
      localStorage.setItem('walletType', 'Wander');
    } catch (error) {
      // Clean up on error
      localStorage.removeItem('walletType');
      console.error('Wander connection error:', error);
      throw new WanderError('Failed to connect to Wander wallet. Please try again.');
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this._wallet) {
        await this.safeWanderApiExecutor(async () => {
          await this._wallet.disconnect();
        });
      }
      localStorage.removeItem('walletType');
    } catch (error) {
      console.error('Wander disconnection error:', error);
      // Still remove from localStorage even if disconnect fails
      localStorage.removeItem('walletType');
    }
  }

  async getWalletAddress(): Promise<AoAddress> {
    try {
      const address = await this.safeWanderApiExecutor(async () => {
        return await this._wallet.getActiveAddress();
      });

      if (!address) {
        throw new WanderError('No active address found in Wander wallet.');
      }

      return address;
    } catch (error) {
      console.error('Failed to get Wander wallet address:', error);
      throw new WanderError('Failed to retrieve wallet address from Wander.');
    }
  }

  /**
   * Subscribe to wallet events
   */
  async on(_event: string, _listener: (data: any) => void): Promise<void> {
    // Wander doesn't currently support event listeners in the same way
    // This is here for interface compatibility
    console.warn('Wander wallet does not support event listeners');
  }

  /**
   * Unsubscribe from wallet events
   */
  async off(_event: string, _listener: (data: any) => void): Promise<void> {
    // Wander doesn't currently support event listeners in the same way
    // This is here for interface compatibility
    console.warn('Wander wallet does not support event listeners');
  }
}
