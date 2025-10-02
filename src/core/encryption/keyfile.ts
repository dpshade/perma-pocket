/**
 * Keyfile encryption and storage utilities
 *
 * Security Strategy:
 * 1. Never store raw JWK in localStorage or unencrypted storage
 * 2. Encrypt JWK using password + AES-256-GCM before storage
 * 3. Store encrypted JWK in IndexedDB (more secure than localStorage)
 * 4. Support session-only mode (no persistence)
 * 5. Auto-clear from memory after timeout
 */

/**
 * Arweave JWK interface (RSA-PSS 4096-bit key)
 */
export interface ArweaveJWK {
  kty: 'RSA';
  n: string;    // Modulus
  e: string;    // Public exponent
  d: string;    // Private exponent
  p: string;    // First prime factor
  q: string;    // Second prime factor
  dp: string;   // First factor CRT exponent
  dq: string;   // Second factor CRT exponent
  qi: string;   // First CRT coefficient
}

/**
 * Encrypted keyfile storage format
 */
interface EncryptedKeyfile {
  encryptedJWK: string;    // Base64 encrypted JWK
  iv: string;              // Initialization vector
  salt: string;            // Salt for key derivation
  addressHint: string;     // First 6 chars of address (for UI display)
  createdAt: number;       // Timestamp when stored
}

const DB_NAME = 'pocket-prompt-keyfiles';
const STORE_NAME = 'keyfiles';
const DB_VERSION = 1;
const KEYFILE_KEY = 'encrypted-keyfile';

/**
 * Initialize IndexedDB for keyfile storage
 */
async function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(new Error('Failed to open IndexedDB'));

    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create object store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
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
 * Convert Base64url string to Uint8Array
 * Arweave uses base64url encoding (- and _ instead of + and /, no padding)
 */
function base64urlToArrayBuffer(base64url: string): Uint8Array {
  // Convert base64url to standard base64
  let base64 = base64url
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  // Add padding if needed
  const padding = base64.length % 4;
  if (padding > 0) {
    base64 += '='.repeat(4 - padding);
  }

  // Decode using standard base64 decoder
  return base64ToArrayBuffer(base64);
}

/**
 * Derive encryption key from password
 */
async function deriveKeyFromPassword(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordData = encoder.encode(password);

  // Import password as key material
  const importedKey = await crypto.subtle.importKey(
    'raw',
    passwordData,
    'PBKDF2',
    false,
    ['deriveKey']
  );

  // Derive AES-256 key using PBKDF2
  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 250000, // Same as main encryption system
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
}

/**
 * Validate JWK structure
 */
export function validateJWK(jwk: any): jwk is ArweaveJWK {
  if (typeof jwk !== 'object' || jwk === null) {
    return false;
  }

  // Check required fields
  const requiredFields = ['kty', 'n', 'e', 'd', 'p', 'q', 'dp', 'dq', 'qi'];
  for (const field of requiredFields) {
    if (typeof jwk[field] !== 'string' || !jwk[field]) {
      console.error(`JWK validation failed: missing or invalid field "${field}"`);
      return false;
    }
  }

  // Check key type
  if (jwk.kty !== 'RSA') {
    console.error('JWK validation failed: kty must be "RSA"');
    return false;
  }

  return true;
}

/**
 * Derive wallet address from JWK public key
 * Uses the same algorithm as Arweave
 */
export async function deriveAddressFromJWK(jwk: ArweaveJWK): Promise<string> {
  try {
    // Arweave derives address from SHA-256 hash of the modulus (n value)
    // The modulus is base64url encoded, so we need to decode it properly
    const modulusBuffer = base64urlToArrayBuffer(jwk.n);
    const hashBuffer = await crypto.subtle.digest('SHA-256', modulusBuffer);

    // Convert to base64url (Arweave address format)
    const address = arrayBufferToBase64(hashBuffer)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    console.log('[Keyfile] Derived address from modulus:', address);
    return address;
  } catch (error) {
    console.error('Failed to derive address from JWK:', error);
    throw new Error('Failed to derive wallet address from keyfile');
  }
}

/**
 * Encrypt JWK with password
 */
export async function encryptJWK(jwk: ArweaveJWK, password: string): Promise<EncryptedKeyfile> {
  try {
    // Generate random salt and IV
    const salt = crypto.getRandomValues(new Uint8Array(32));
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Derive encryption key from password
    const encryptionKey = await deriveKeyFromPassword(password, salt);

    // Convert JWK to JSON string
    const jwkString = JSON.stringify(jwk);
    const jwkBuffer = new TextEncoder().encode(jwkString);

    // Encrypt JWK
    const encryptedBuffer = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      encryptionKey,
      jwkBuffer
    );

    // Derive address hint for UI
    const address = await deriveAddressFromJWK(jwk);
    const addressHint = address.slice(0, 6);

    return {
      encryptedJWK: arrayBufferToBase64(encryptedBuffer),
      iv: arrayBufferToBase64(iv),
      salt: arrayBufferToBase64(salt),
      addressHint,
      createdAt: Date.now(),
    };
  } catch (error) {
    console.error('Keyfile encryption failed:', error);
    throw new Error('Failed to encrypt keyfile');
  }
}

/**
 * Decrypt encrypted keyfile with password
 */
export async function decryptJWK(encrypted: EncryptedKeyfile, password: string): Promise<ArweaveJWK> {
  try {
    // Parse salt and IV
    const salt = base64ToArrayBuffer(encrypted.salt);
    const iv = base64ToArrayBuffer(encrypted.iv);

    // Derive decryption key from password
    const decryptionKey = await deriveKeyFromPassword(password, salt);

    // Decrypt JWK
    const encryptedBuffer = base64ToArrayBuffer(encrypted.encryptedJWK);
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      decryptionKey,
      encryptedBuffer
    );

    // Parse JWK
    const jwkString = new TextDecoder().decode(decryptedBuffer);
    const jwk = JSON.parse(jwkString);

    // Validate decrypted JWK
    if (!validateJWK(jwk)) {
      throw new Error('Decrypted data is not a valid JWK');
    }

    return jwk;
  } catch (error) {
    console.error('Keyfile decryption failed:', error);

    // Check if it's a wrong password (decryption error)
    if (error instanceof Error && error.message.includes('decrypt')) {
      throw new Error('Incorrect password or corrupted keyfile');
    }

    throw new Error('Failed to decrypt keyfile');
  }
}

/**
 * Store encrypted keyfile in IndexedDB
 */
export async function storeEncryptedKeyfile(encrypted: EncryptedKeyfile): Promise<void> {
  try {
    const db = await initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const request = store.put(encrypted, KEYFILE_KEY);

      request.onsuccess = () => {
        console.log('[Keyfile] Encrypted keyfile stored in IndexedDB');
        resolve();
      };

      request.onerror = () => {
        reject(new Error('Failed to store encrypted keyfile'));
      };
    });
  } catch (error) {
    console.error('Failed to store keyfile:', error);
    throw new Error('Failed to store encrypted keyfile');
  }
}

/**
 * Retrieve encrypted keyfile from IndexedDB
 */
export async function retrieveEncryptedKeyfile(): Promise<EncryptedKeyfile | null> {
  try {
    const db = await initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);

      const request = store.get(KEYFILE_KEY);

      request.onsuccess = () => {
        const result = request.result as EncryptedKeyfile | undefined;
        resolve(result || null);
      };

      request.onerror = () => {
        reject(new Error('Failed to retrieve encrypted keyfile'));
      };
    });
  } catch (error) {
    console.error('Failed to retrieve keyfile:', error);
    return null;
  }
}

/**
 * Remove encrypted keyfile from IndexedDB
 */
export async function removeEncryptedKeyfile(): Promise<void> {
  try {
    const db = await initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const request = store.delete(KEYFILE_KEY);

      request.onsuccess = () => {
        console.log('[Keyfile] Encrypted keyfile removed from IndexedDB');
        resolve();
      };

      request.onerror = () => {
        reject(new Error('Failed to remove encrypted keyfile'));
      };
    });
  } catch (error) {
    console.error('Failed to remove keyfile:', error);
    throw new Error('Failed to remove encrypted keyfile');
  }
}

/**
 * Check if a keyfile is stored
 */
export async function hasStoredKeyfile(): Promise<boolean> {
  const keyfile = await retrieveEncryptedKeyfile();
  return keyfile !== null;
}

/**
 * Get address hint from stored keyfile (for UI display)
 */
export async function getStoredKeyfileAddressHint(): Promise<string | null> {
  const keyfile = await retrieveEncryptedKeyfile();
  return keyfile?.addressHint || null;
}
