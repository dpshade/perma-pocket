/**
 * Encryption utilities for Pocket Prompt using Arweave wallet
 *
 * Uses hybrid encryption:
 * 1. Generate random AES-256 key for content
 * 2. Encrypt content with AES (fast for large data)
 * 3. Encrypt AES key with wallet's RSA public key
 * 4. Store both encrypted content and encrypted key
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

/**
 * Check if content is encrypted
 */
export function isEncrypted(data: any): data is EncryptedData {
  return data && data.isEncrypted === true && data.encryptedContent && data.encryptedKey && data.iv;
}

/**
 * Generate a random AES key
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
 * Convert Base64 string to ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Encrypt content using hybrid encryption with Arweave wallet
 */
export async function encryptContent(content: string): Promise<EncryptedData> {
  try {
    // Check if ArConnect is available
    if (!window.arweaveWallet) {
      throw new Error('Arweave wallet not connected');
    }

    // Generate random AES key
    const aesKey = await generateAESKey();

    // Generate random IV for AES-GCM
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Encrypt content with AES
    const encoder = new TextEncoder();
    const contentBuffer = encoder.encode(content);
    const encryptedContentBuffer = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      aesKey,
      contentBuffer
    );

    // Export AES key to raw format
    const rawAESKey = await crypto.subtle.exportKey('raw', aesKey);

    // Encrypt the AES key with wallet's public key
    const wallet: any = window.arweaveWallet;
    const encryptedKeyResult: any = await wallet.encrypt(
      new Uint8Array(rawAESKey),
      {
        algorithm: 'RSA-OAEP',
        hash: 'SHA-256',
      }
    );
    const encryptedKeyBuffer: ArrayBuffer =
      encryptedKeyResult instanceof ArrayBuffer
        ? encryptedKeyResult
        : encryptedKeyResult.buffer;

    // Convert to base64 for storage
    return {
      encryptedContent: arrayBufferToBase64(encryptedContentBuffer),
      encryptedKey: arrayBufferToBase64(encryptedKeyBuffer),
      iv: arrayBufferToBase64(iv),
      isEncrypted: true,
    };
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error(`Failed to encrypt content: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Decrypt content using hybrid encryption with Arweave wallet
 */
export async function decryptContent(encryptedData: EncryptedData): Promise<string> {
  try {
    // Check if ArConnect is available
    if (!window.arweaveWallet) {
      throw new Error('Arweave wallet not connected');
    }

    // Convert from base64
    const encryptedContentBuffer = base64ToArrayBuffer(encryptedData.encryptedContent);
    const encryptedKeyBuffer = base64ToArrayBuffer(encryptedData.encryptedKey);
    const iv = base64ToArrayBuffer(encryptedData.iv);

    // Decrypt the AES key with wallet's private key
    const decryptedKeyResult: any = await window.arweaveWallet.decrypt(
      new Uint8Array(encryptedKeyBuffer),
      {
        algorithm: 'RSA-OAEP',
        hash: 'SHA-256',
      }
    );
    const decryptedKeyBuffer: ArrayBuffer =
      decryptedKeyResult instanceof ArrayBuffer
        ? decryptedKeyResult
        : decryptedKeyResult.buffer;

    // Import the decrypted AES key
    const aesKey = await crypto.subtle.importKey(
      'raw',
      decryptedKeyBuffer,
      {
        name: 'AES-GCM',
        length: 256,
      },
      false,
      ['decrypt']
    );

    // Decrypt content with AES
    const decryptedContentBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: new Uint8Array(iv),
      },
      aesKey,
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
