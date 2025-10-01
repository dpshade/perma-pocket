/**
 * Encryption utilities for Pocket Prompt using Arweave wallet + password
 *
 * Approach: Wallet + Password Hybrid Encryption (v3.3+)
 * 1. User provides password once per session
 * 2. Derive master AES-256 key from: wallet address + password
 * 3. Use this key to encrypt/decrypt all prompt content
 * 4. Deterministic: same wallet + same password = same key (works across devices)
 * 5. Secure: password is secret, PBKDF2 with 250k iterations
 */

import { getProtocolVersion } from '@/backend/config/arweave';

export interface EncryptedData {
  encryptedContent: string;
  encryptedKey: string;
  iv: string; // Initialization vector for AES
  isEncrypted: true;
}

export interface DecryptedData {
  content: string;
  isEncrypted: false;
}

// Session cache for the derived master key
let sessionMasterKey: CryptoKey | null = null;
let currentWalletAddress: string | null = null;
let currentPasswordHash: string | null = null; // Hash to verify password hasn't changed
let pendingKeyDerivation: Promise<CryptoKey> | null = null;

/**
 * Check if content is encrypted
 */
export function isEncrypted(data: any): data is EncryptedData {
  return !!(data && data.isEncrypted === true && data.encryptedContent && data.encryptedKey && data.iv);
}

/**
 * Generate a random AES key for content encryption
 */
async function generateAESKey(): Promise<CryptoKey> {
  return await crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Convert ArrayBuffer to Base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert Base64 string to Uint8Array
 */
function base64ToArrayBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Hash a password for cache verification (not for encryption)
 */
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return arrayBufferToBase64(hashBuffer);
}

/**
 * Derive a master encryption key from wallet address + password
 * This is deterministic: same wallet + same password = same key
 * Uses a pending promise to prevent race conditions during parallel derivation
 */
async function getOrCreateMasterKey(password: string): Promise<CryptoKey> {
  if (!window.arweaveWallet) {
    throw new Error('Arweave wallet not connected');
  }

  // Get current wallet address
  const address = await window.arweaveWallet.getActiveAddress();
  const passwordHash = await hashPassword(password);

  // If we have a cached key for this wallet and password, use it
  if (sessionMasterKey && currentWalletAddress === address && currentPasswordHash === passwordHash) {
    console.log('[Encryption] Using cached master key');
    return sessionMasterKey;
  }

  // If key derivation is already in progress, wait for it
  if (pendingKeyDerivation) {
    console.log('[Encryption] Master key derivation in progress, waiting...');
    return await pendingKeyDerivation;
  }

  // Start new key derivation and cache the promise
  console.log('[Encryption] Deriving master encryption key from wallet + password...');

  pendingKeyDerivation = (async () => {
    try {
      // Combine wallet address and password as input
      const combinedInput = new TextEncoder().encode(`${address}:${password}`);

      // Import the combined input as raw key material
      const importedKey = await crypto.subtle.importKey(
        'raw',
        combinedInput,
        'PBKDF2',
        false,
        ['deriveKey']
      );

      // Use app-specific salt based on current protocol version
      // This ensures encryption is tied to the protocol version
      const protocolVersion = getProtocolVersion().toLowerCase();
      const salt = new TextEncoder().encode(protocolVersion);

      // Derive master AES-256 key using PBKDF2 with 250,000 iterations
      const masterKey = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: 250000, // High iteration count for brute-force resistance
          hash: 'SHA-256',
        },
        importedKey,
        {
          name: 'AES-GCM',
          length: 256,
        },
        false,
        ['encrypt', 'decrypt']
      );

      // Cache for this session
      sessionMasterKey = masterKey;
      currentWalletAddress = address;
      currentPasswordHash = passwordHash;

      console.log('[Encryption] Master encryption key derived successfully');

      return masterKey;
    } finally {
      // Clear pending promise once complete (success or failure)
      pendingKeyDerivation = null;
    }
  })();

  return await pendingKeyDerivation;
}

/**
 * Clear the cached master key (call on wallet disconnect or password change)
 */
export function clearEncryptionCache(): void {
  sessionMasterKey = null;
  currentWalletAddress = null;
  currentPasswordHash = null;
  pendingKeyDerivation = null;
  console.log('[Encryption] Cache cleared');
}

/**
 * Encrypt content using password-based encryption
 * Requires password for key derivation (cached for session)
 */
export async function encryptContent(content: string, password: string): Promise<EncryptedData> {
  try {
    // Get or create master key using password
    const masterKey = await getOrCreateMasterKey(password);

    // Generate random AES key for this content
    const contentKey = await generateAESKey();

    // Generate random IV for content encryption
    const contentIv = crypto.getRandomValues(new Uint8Array(12));

    // Encrypt content with the content key
    const encoder = new TextEncoder();
    const contentBuffer = encoder.encode(content);
    const encryptedContentBuffer = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: contentIv,
      },
      contentKey,
      contentBuffer
    );

    // Export content key to raw format
    const rawContentKey = await crypto.subtle.exportKey('raw', contentKey);

    // Encrypt the content key with the master key
    const keyIv = crypto.getRandomValues(new Uint8Array(12));
    const encryptedKeyBuffer = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: keyIv,
      },
      masterKey,
      rawContentKey
    );

    // Combine key IV and encrypted key
    const combinedKeyData = new Uint8Array(keyIv.length + new Uint8Array(encryptedKeyBuffer).length);
    combinedKeyData.set(keyIv, 0);
    combinedKeyData.set(new Uint8Array(encryptedKeyBuffer), keyIv.length);

    // Convert to base64 for storage
    return {
      encryptedContent: arrayBufferToBase64(encryptedContentBuffer),
      encryptedKey: arrayBufferToBase64(combinedKeyData.buffer),
      iv: arrayBufferToBase64(contentIv),
      isEncrypted: true,
    };
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error(`Failed to encrypt content: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Decrypt content using password-based encryption
 * Requires the same password used for encryption
 */
export async function decryptContent(encryptedData: EncryptedData, password: string): Promise<string> {
  try {
    // Get master key using password
    const masterKey = await getOrCreateMasterKey(password);

    // Parse encrypted key data (contains IV + encrypted key)
    const combinedKeyData = base64ToArrayBuffer(encryptedData.encryptedKey);
    const keyIv = combinedKeyData.slice(0, 12);
    const encryptedKeyBuffer = combinedKeyData.slice(12);

    // Decrypt the content key using the master key
    const decryptedKeyBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: keyIv,
      },
      masterKey,
      encryptedKeyBuffer
    );

    // Import the decrypted content key
    const contentKey = await crypto.subtle.importKey(
      'raw',
      decryptedKeyBuffer,
      {
        name: 'AES-GCM',
        length: 256,
      },
      false,
      ['decrypt']
    );

    // Decrypt content
    const encryptedContentBuffer = base64ToArrayBuffer(encryptedData.encryptedContent);
    const contentIv = base64ToArrayBuffer(encryptedData.iv);

    const decryptedContentBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: contentIv,
      },
      contentKey,
      encryptedContentBuffer
    );

    // Convert back to string
    const decoder = new TextDecoder();
    return decoder.decode(decryptedContentBuffer);
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error(`Failed to decrypt content: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validate a password by attempting to decrypt encrypted data
 * Returns true if password is correct, false otherwise
 */
export async function validatePassword(
  encryptedData: EncryptedData,
  password: string
): Promise<boolean> {
  try {
    await decryptContent(encryptedData, password);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a prompt should be encrypted based on tags
 * Prompts with "public" tag are not encrypted
 * This is used for UPLOAD decisions only
 */
export function shouldEncrypt(tags: string[]): boolean {
  return !tags.some(tag => tag.toLowerCase() === 'public');
}

/**
 * Check if a prompt's content is actually encrypted
 * This checks the actual data structure, not tags
 * Use this for DISPLAY decisions
 */
export function isPromptEncrypted(content: string | any): boolean {
  // If it's a string, it's not encrypted
  if (typeof content === 'string') {
    return false;
  }

  // If it's an object with encryption markers, it's encrypted
  return isEncrypted(content);
}

/**
 * Check if a prompt was encrypted based on its tags
 * Use this to determine the encryption status for UI display
 * (After decryption, content is a string, so we check tags instead)
 */
export function wasPromptEncrypted(tags: string[]): boolean {
  // Check if prompt has the "public" tag (case-insensitive)
  return !tags.some(tag => tag.toLowerCase() === 'public');
}

/**
 * Prepare content for upload - encrypt if needed
 * Requires password if encryption is needed
 */
export async function prepareContentForUpload(
  content: string,
  tags: string[],
  password?: string
): Promise<string | EncryptedData> {
  if (shouldEncrypt(tags)) {
    if (!password) {
      throw new Error('Password required for encrypted content');
    }
    return await encryptContent(content, password);
  }
  return content;
}

/**
 * Prepare content for display - decrypt if needed
 * Requires password if content is encrypted
 */
export async function prepareContentForDisplay(
  content: string | EncryptedData,
  password?: string
): Promise<string> {
  if (typeof content === 'string') {
    return content;
  }

  if (isEncrypted(content)) {
    if (!password) {
      throw new Error('Password required to decrypt content');
    }
    return await decryptContent(content, password);
  }

  return String(content);
}
