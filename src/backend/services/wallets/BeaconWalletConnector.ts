import type { ArNSWalletConnector, AoAddress } from '@/shared/types/wallet';
import WalletClient from '@vela-ventures/ao-sync-sdk';
import type { PermissionType } from 'arconnect';

/**
 * Required permissions for Beacon wallet
 */
export const BEACON_WALLET_PERMISSIONS: PermissionType[] = [
  'ACCESS_ADDRESS',
  'ACCESS_ALL_ADDRESSES',
  'ACCESS_PUBLIC_KEY',
  'SIGN_TRANSACTION',
  'ACCESS_ARWEAVE_CONFIG',
  'SIGNATURE',
];

/**
 * Custom error for Beacon wallet operations
 */
export class BeaconError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BeaconError';
  }
}

/**
 * Beacon Wallet Connector
 * Connects to Beacon wallet using the @vela-ventures/ao-sync-sdk
 */
export class BeaconWalletConnector implements ArNSWalletConnector {
  tokenType = 'arweave';
  public _wallet: WalletClient;
  contractSigner: any;
  turboSigner: any;

  constructor() {
    this._wallet = new WalletClient();

    // Attempt to reconnect if previously connected
    try {
      this._wallet.reconnect();
    } catch (error) {
      // Ignore reconnection errors during initialization
      console.debug('Beacon wallet not previously connected');
    }

    this.contractSigner = this._wallet as any;
    this.turboSigner = this._wallet as any;
  }

  async connect(): Promise<void> {
    try {
      // Store wallet type before connecting
      localStorage.setItem('walletType', 'Beacon');

      // Connect to Beacon wallet with app info
      await this._wallet.connect({
        appInfo: {
          name: 'Pocket Prompt',
          logo: 'https://arweave.net/your-logo-txid', // Replace with your app's logo
        }
      });

      // Verify connection by getting address
      const address = await this._wallet.getActiveAddress();
      if (!address) {
        throw new BeaconError('Failed to get address after connection.');
      }

      console.log('Beacon wallet connected:', address);
    } catch (error) {
      // Clean up on error
      localStorage.removeItem('walletType');
      console.error('Beacon connection error:', error);

      if (error instanceof BeaconError) {
        throw error;
      }

      // Check if user cancelled
      if (error instanceof Error && error.message.includes('cancel')) {
        throw new BeaconError('User cancelled authentication.');
      }

      throw new BeaconError('Failed to connect to Beacon wallet. Please try again.');
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this._wallet) {
        await this._wallet.disconnect();
      }
      localStorage.removeItem('walletType');
    } catch (error) {
      console.error('Beacon disconnection error:', error);
      // Still remove from localStorage even if disconnect fails
      localStorage.removeItem('walletType');
    }
  }

  async getWalletAddress(): Promise<AoAddress> {
    try {
      const address = await this._wallet.getActiveAddress();

      if (!address) {
        throw new BeaconError('No active address found in Beacon wallet.');
      }

      return address;
    } catch (error) {
      console.error('Failed to get Beacon wallet address:', error);

      if (error instanceof BeaconError) {
        throw error;
      }

      throw new BeaconError('Failed to retrieve wallet address from Beacon.');
    }
  }

  /**
   * Subscribe to wallet events
   * @param event Event name (e.g., 'disconnect', 'accountChange')
   * @param listener Event handler
   */
  async on(event: string, listener: (data: any) => void): Promise<void> {
    if (this._wallet && typeof this._wallet.on === 'function') {
      this._wallet.on(event, listener);
    }
  }

  /**
   * Unsubscribe from wallet events
   * @param event Event name
   * @param listener Event handler
   */
  async off(event: string, listener: (data: any) => void): Promise<void> {
    if (this._wallet && typeof this._wallet.off === 'function') {
      this._wallet.off(event, listener);
    }
  }
}
