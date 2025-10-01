/**
 * Encryption utilities for Pocket Prompt using Arweave wallet
 *
 * New approach: Session-based encryption
 * 1. User signs a standard message once per session
 * 2. Derive a master AES-256 key from the signature
 * 3. Use this key to encrypt/decrypt all prompt content
 * 4. No more signatures required after initial setup
 */

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
 * Derive a master encryption key from wallet signature
 * This only requires ONE signature per session
 * Uses a pending promise to prevent race conditions during parallel decryption
 */
async function getOrCreateMasterKey(): Promise<CryptoKey> {
  if (!window.arweaveWallet) {
    throw new Error('Arweave wallet not connected');
  }

  // Get current wallet address
  const address = await window.arweaveWallet.getActiveAddress();

  // If we have a cached key for this wallet, use it
  if (sessionMasterKey && currentWalletAddress === address) {
    console.log('[Encryption] Using cached master key');
    return sessionMasterKey;
  }

  // If key derivation is already in progress, wait for it
  if (pendingKeyDerivation) {
    console.log('[Encryption] Master key derivation in progress, waiting...');
    return await pendingKeyDerivation;
  }

  // Start new key derivation and cache the promise
  console.log('[Encryption] Deriving master encryption key (requires one signature)...');

  pendingKeyDerivation = (async () => {
    try {
      // Standard message to sign
      const message = new TextEncoder().encode(
        `Pocket Prompt Encryption Key\nWallet: ${address}\nThis signature creates your encryption key for this session.`
      );

      // Get wallet signature (this is the ONLY signature needed)
      const signature = await window.arweaveWallet.signature(message, {
        name: 'RSA-PSS',
        saltLength: 32,
      });

      // Convert signature to Uint8Array if needed
      const signatureBytes = signature instanceof Uint8Array
        ? signature
        : new Uint8Array(signature);

      // Derive a cryptographic key from the signature using PBKDF2
      const importedKey = await crypto.subtle.importKey(
        'raw',
        signatureBytes,
        'PBKDF2',
        false,
        ['deriveBits', 'deriveKey']
      );

      const salt = new TextEncoder().encode(`pocket-prompt-${address}`);

      const masterKey = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: 100000,
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
 * Clear the cached master key (call on wallet disconnect)
 */
export function clearEncryptionCache(): void {
  sessionMasterKey = null;
  currentWalletAddress = null;
  pendingKeyDerivation = null;
  console.log('[Encryption] Cache cleared');
}

/**
 * Encrypt content using session-based encryption
 * Only requires ONE signature per session (for master key derivation)
 */
export async function encryptContent(content: string): Promise<EncryptedData> {
  try {
    // Get or create master key (only requires signature on first call)
    const masterKey = await getOrCreateMasterKey();

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
 * Decrypt content using session-based encryption
 * Uses cached master key (no signature required after first call)
 */
export async function decryptContent(encryptedData: EncryptedData): Promise<string> {
  try {
    // Get master key (uses cached version if available)
    const masterKey = await getOrCreateMasterKey();

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
 */
export async function prepareContentForUpload(
  content: string,
  tags: string[]
): Promise<string | EncryptedData> {
  if (shouldEncrypt(tags)) {
    return await encryptContent(content);
  }
  return content;
}

/**
 * Prepare content for display - decrypt if needed
 */
export async function prepareContentForDisplay(
  content: string | EncryptedData
): Promise<string> {
  if (typeof content === 'string') {
    return content;
  }

  if (isEncrypted(content)) {
    return await decryptContent(content);
  }

  return String(content);
}
