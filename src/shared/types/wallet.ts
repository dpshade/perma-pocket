/**
 * Wallet type identifiers for multi-wallet support
 */
export type WALLET_TYPES = 'Wander' | 'ArweaveApp' | 'Beacon';

/**
 * Arweave address type (base64url encoded string)
 */
export type ArweaveAddress = string;

/**
 * Generic address type that can represent both Arweave and Ethereum addresses
 */
export type AoAddress = ArweaveAddress | `0x${string}`;

/**
 * Result of a transfer transaction
 */
export interface TransferTransactionResult {
  id: string;
  success: boolean;
  error?: string;
}

/**
 * Interface that all wallet connectors must implement
 * Provides a consistent API for connecting different wallet types
 */
export interface ArNSWalletConnector {
  /**
   * The type of tokens this wallet handles (arweave, ethereum, etc.)
   */
  tokenType: string;

  /**
   * Connect to the wallet
   * @throws Error if connection fails or user rejects
   */
  connect(): Promise<void>;

  /**
   * Disconnect from the wallet
   */
  disconnect(): Promise<void>;

  /**
   * Get the current wallet address
   * @returns The wallet address
   */
  getWalletAddress(): Promise<AoAddress>;

  /**
   * Signer instance for contract interactions (optional)
   */
  contractSigner?: any;

  /**
   * Subscribe to wallet events (optional)
   * @param event Event name
   * @param listener Event handler
   */
  on?(event: string, listener: (data: any) => void): Promise<void>;

  /**
   * Unsubscribe from wallet events (optional)
   * @param event Event name
   * @param listener Event handler
   */
  off?(event: string, listener: (data: any) => void): Promise<void>;

  /**
   * Submit a native token transfer transaction (optional)
   * @param amount Amount to transfer
   * @param toAddress Recipient address
   */
  submitNativeTransaction?(
    amount: number,
    toAddress: string,
  ): Promise<TransferTransactionResult>;

  /**
   * Signer instance for Turbo SDK operations (optional)
   */
  turboSigner?: any;
}

/**
 * Wallet connection state
 */
export interface WalletState {
  address: string | null;
  connected: boolean;
  connecting: boolean;
  error: string | null;
  walletType: WALLET_TYPES | null;
  wallet: ArNSWalletConnector | null;
}
