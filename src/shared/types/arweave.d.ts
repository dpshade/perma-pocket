/**
 * TypeScript declarations for ArConnect wallet
 * Augments the arconnect package types with the new signMessage API
 */

import type { ArConnectWebWallet } from 'arconnect';

declare global {
  interface Window {
    arweaveWallet: ArConnectWebWallet & {
      /**
       * Sign a message using the wallet (new API)
       * @param data Message data to sign
       * @param options Hash algorithm options
       * @returns Promise of the signature
       */
      signMessage(
        data: Uint8Array | ArrayBuffer,
        options?: {
          hashAlgorithm?: 'SHA-256' | 'SHA-384' | 'SHA-512';
        }
      ): Promise<Uint8Array>;
    };
  }
}

export {};
