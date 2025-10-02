import type { ArNSWalletConnector, AoAddress } from '@/shared/types/wallet';
import { ArweaveSigner } from '@ardrive/turbo-sdk/web';
import type { ArweaveJWK } from '@/core/encryption/keyfile';
import {
  validateJWK,
  deriveAddressFromJWK,
  encryptJWK,
  decryptJWK,
  storeEncryptedKeyfile,
  retrieveEncryptedKeyfile,
  removeEncryptedKeyfile,
} from '@/core/encryption/keyfile';

/**
 * Custom error for keyfile operations
 */
export class KeyfileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KeyfileError';
  }
}

/**
 * Keyfile Wallet Connector
 * Connects using an imported Arweave JWK (JSON keyfile)
 *
 * Security Features:
 * - JWK encrypted with password before storage
 * - Stored in IndexedDB (more secure than localStorage)
 * - Session-only mode available (no persistence)
 * - Auto-clear from memory
 */
export class KeyfileWalletConnector implements ArNSWalletConnector {
  tokenType = 'arweave';
  private _jwk: ArweaveJWK | null = null;
  private _address: string | null = null;
  private _signer: ArweaveSigner | null = null;
  private _sessionOnly: boolean = false;
  contractSigner: any;
  turboSigner: any;

  constructor() {
    // Connectors are lightweight - actual loading happens in connect()
  }

  /**
   * Load keyfile from encrypted storage
   * Requires password to decrypt
   */
  async loadFromStorage(password: string): Promise<void> {
    const encrypted = await retrieveEncryptedKeyfile();

    if (!encrypted) {
      throw new KeyfileError('No stored keyfile found');
    }

    try {
      this._jwk = await decryptJWK(encrypted, password);
      this._address = await deriveAddressFromJWK(this._jwk);

      // Create signer
      this._signer = new ArweaveSigner(this._jwk);
      this.contractSigner = this._signer;
      this.turboSigner = this._signer;

      console.log('[Keyfile] Loaded from storage successfully');
    } catch (error) {
      throw new KeyfileError('Failed to decrypt keyfile. Incorrect password?');
    }
  }

  /**
   * Import keyfile from JWK object
   * @param jwk - Arweave JWK object
   * @param password - Password to encrypt the keyfile
   * @param sessionOnly - If true, don't persist to storage
   */
  async importFromJWK(jwk: ArweaveJWK, password: string, sessionOnly: boolean = false): Promise<void> {
    // Validate JWK structure
    if (!validateJWK(jwk)) {
      throw new KeyfileError('Invalid JWK format. Please provide a valid Arweave keyfile.');
    }

    try {
      console.log('[Keyfile] Validating JWK and deriving address...');

      // Derive address to verify JWK is valid
      this._address = await deriveAddressFromJWK(jwk);
      console.log('[Keyfile] Address derived:', this._address);

      // Store JWK in memory (unencrypted for signing)
      this._jwk = jwk;
      this._sessionOnly = sessionOnly;

      // Create signer - ArweaveSigner expects the raw JWK
      console.log('[Keyfile] Creating ArweaveSigner...');
      this._signer = new ArweaveSigner(this._jwk);
      this.contractSigner = this._signer;
      this.turboSigner = this._signer;
      console.log('[Keyfile] ArweaveSigner created successfully');

      // Encrypt and store if not session-only
      if (!sessionOnly) {
        console.log('[Keyfile] Encrypting and storing keyfile...');
        const encrypted = await encryptJWK(jwk, password);
        await storeEncryptedKeyfile(encrypted);
        console.log('[Keyfile] Imported and encrypted successfully');
      } else {
        console.log('[Keyfile] Imported in session-only mode (not persisted)');
      }
    } catch (error) {
      if (error instanceof KeyfileError) {
        throw error;
      }
      console.error('[Keyfile] Import error details:', error);

      // Provide more specific error messages
      if (error instanceof SyntaxError) {
        throw new KeyfileError('Invalid JSON format in keyfile');
      }

      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      throw new KeyfileError(`Failed to import keyfile: ${errorMsg}`);
    }
  }

  /**
   * Import keyfile from JSON string
   * @param jsonString - JSON string containing the JWK
   * @param password - Password to encrypt the keyfile
   * @param sessionOnly - If true, don't persist to storage
   */
  async importFromJSON(jsonString: string, password: string, sessionOnly: boolean = false): Promise<void> {
    try {
      const jwk = JSON.parse(jsonString);
      await this.importFromJWK(jwk, password, sessionOnly);
    } catch (error) {
      if (error instanceof KeyfileError) {
        throw error;
      }
      throw new KeyfileError('Invalid JSON format. Please provide a valid Arweave keyfile.');
    }
  }

  async connect(): Promise<void> {
    // For keyfile, "connection" is just verification
    // Actual import happens via importFromJWK or loadFromStorage
    if (!this._jwk || !this._address) {
      throw new KeyfileError('No keyfile loaded. Please import a keyfile first.');
    }

    // Store wallet type
    if (!this._sessionOnly) {
      localStorage.setItem('walletType', 'Keyfile');
    }

    console.log('[Keyfile] Connected with address:', this._address);
  }

  async disconnect(): Promise<void> {
    try {
      // Clear from memory
      this._jwk = null;
      this._address = null;
      this._signer = null;
      this.contractSigner = null;
      this.turboSigner = null;

      // Remove from storage if not session-only
      if (!this._sessionOnly) {
        await removeEncryptedKeyfile();
      }

      localStorage.removeItem('walletType');

      console.log('[Keyfile] Disconnected and cleared');
    } catch (error) {
      console.error('Keyfile disconnection error:', error);
      // Still clear memory even if storage removal fails
      this._jwk = null;
      this._address = null;
      localStorage.removeItem('walletType');
    }
  }

  async getWalletAddress(): Promise<AoAddress> {
    if (!this._address) {
      throw new KeyfileError('No wallet address available. Please import a keyfile first.');
    }
    return this._address;
  }

  /**
   * Get the raw JWK (use carefully - sensitive data!)
   */
  getJWK(): ArweaveJWK | null {
    return this._jwk;
  }

  /**
   * Check if keyfile is session-only
   */
  isSessionOnly(): boolean {
    return this._sessionOnly;
  }

  /**
   * Subscribe to wallet events (not applicable for keyfile)
   */
  async on(_event: string, _listener: (data: any) => void): Promise<void> {
    console.warn('Keyfile wallet does not support event listeners');
  }

  /**
   * Unsubscribe from wallet events (not applicable for keyfile)
   */
  async off(_event: string, _listener: (data: any) => void): Promise<void> {
    console.warn('Keyfile wallet does not support event listeners');
  }
}
