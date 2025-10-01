/**
 * TypeScript declarations for ArConnect wallet
 * Augments the arconnect package types with the new signMessage API
 */

declare global {
  interface Window {
    arweaveWallet: {
      /**
       * Sign a message using the wallet (replaces deprecated signature() method)
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
