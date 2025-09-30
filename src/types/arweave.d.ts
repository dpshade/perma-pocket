/**
 * TypeScript declarations for ArConnect wallet
 */

interface ArweaveWallet {
  connect(permissions: string[]): Promise<void>;
  disconnect(): Promise<void>;
  getActiveAddress(): Promise<string>;
  getPermissions(): Promise<string[]>;
  encrypt(
    data: Uint8Array,
    options: {
      algorithm: string;
      hash: string;
    }
  ): Promise<Uint8Array | ArrayBuffer>;
  decrypt(
    data: Uint8Array,
    options: {
      algorithm: string;
      hash: string;
    }
  ): Promise<Uint8Array | ArrayBuffer>;
}

declare global {
  interface Window {
    arweaveWallet?: ArweaveWallet;
  }
}

export {};
