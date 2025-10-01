/**
 * Comprehensive validation tests for encryption/decryption
 * Triple-check that encrypt/decrypt round-trip works correctly
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { encryptContent, decryptContent, clearEncryptionCache } from './encryption';

const TEST_PASSWORD = 'test-password-123';

// Mock ArConnect wallet
const mockWallet = {
  signMessage: async (data: Uint8Array) => {
    // Simulate signing with a deterministic "signature"
    const signatureBytes = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      signatureBytes[i] = (i + data[0]) % 256;
    }
    return signatureBytes;
  },
  getActiveAddress: async () => '7oqF5rsBLc8MqWnrOHloVjixlbpfT7IdFqRQfyaNLOg',
};

describe('Encryption Validation - Triple Check', () => {
  beforeEach(() => {
    (window as any).arweaveWallet = mockWallet;
    clearEncryptionCache();
  });

  afterEach(() => {
    clearEncryptionCache();
    delete (window as any).arweaveWallet;
  });

  it('VALIDATION 1: Simple string round-trip', async () => {
    const original = 'Hello, World!';

    const encrypted = await encryptContent(original, TEST_PASSWORD);
    expect(encrypted.isEncrypted).toBe(true);
    expect(encrypted.encryptedContent).toBeDefined();
    expect(encrypted.encryptedKey).toBeDefined();
    expect(encrypted.iv).toBeDefined();

    const decrypted = await decryptContent(encrypted, TEST_PASSWORD);
    expect(decrypted).toBe(original);
  });

  it('VALIDATION 2: Large content round-trip (10KB)', async () => {
    const original = 'x'.repeat(10000);

    const encrypted = await encryptContent(original, TEST_PASSWORD);
    const decrypted = await decryptContent(encrypted, TEST_PASSWORD);

    expect(decrypted).toBe(original);
    expect(decrypted.length).toBe(10000);
  });

  it('VALIDATION 3: Unicode and special characters', async () => {
    const original = '日本語 🎉 émojis & spëcial chârs: \n\t"quotes"';

    const encrypted = await encryptContent(original, TEST_PASSWORD);
    const decrypted = await decryptContent(encrypted, TEST_PASSWORD);

    expect(decrypted).toBe(original);
  });

  it('VALIDATION 4: JSON-like content', async () => {
    const original = JSON.stringify({
      title: 'Test Prompt',
      description: 'A test',
      content: 'Some content with\nnewlines\tand\ttabs',
      tags: ['test', 'validation'],
    }, null, 2);

    const encrypted = await encryptContent(original, TEST_PASSWORD);
    const decrypted = await decryptContent(encrypted, TEST_PASSWORD);

    expect(decrypted).toBe(original);

    // Verify we can parse it back
    const parsed = JSON.parse(decrypted);
    expect(parsed.title).toBe('Test Prompt');
    expect(parsed.tags).toEqual(['test', 'validation']);
  });

  it('VALIDATION 5: Multiple encrypt/decrypt cycles with cache', async () => {
    const contents = [
      'First content',
      'Second content with more text',
      'Third content: 日本語',
      'Fourth content\nwith\nnewlines',
      'Fifth content with émojis 🚀',
    ];

    // Encrypt all
    const encrypted = await Promise.all(
      contents.map(content => encryptContent(content, TEST_PASSWORD))
    );

    // Verify all encrypted data is unique
    const encryptedContents = encrypted.map(e => e.encryptedContent);
    const uniqueContents = new Set(encryptedContents);
    expect(uniqueContents.size).toBe(5); // All should be unique

    // Decrypt all
    const decrypted = await Promise.all(
      encrypted.map(enc => decryptContent(enc, TEST_PASSWORD))
    );

    // Verify all match originals
    decrypted.forEach((dec, i) => {
      expect(dec).toBe(contents[i]);
    });
  });

  it('VALIDATION 6: Encrypted output format validation', async () => {
    const original = 'Test content';
    const encrypted = await encryptContent(original, TEST_PASSWORD);

    // Validate structure
    expect(encrypted).toHaveProperty('encryptedContent');
    expect(encrypted).toHaveProperty('encryptedKey');
    expect(encrypted).toHaveProperty('iv');
    expect(encrypted).toHaveProperty('isEncrypted');
    expect(encrypted.isEncrypted).toBe(true);

    // Validate base64 encoding (should not throw)
    expect(() => atob(encrypted.encryptedContent)).not.toThrow();
    expect(() => atob(encrypted.encryptedKey)).not.toThrow();
    expect(() => atob(encrypted.iv)).not.toThrow();

    // Validate IV is 12 bytes (base64 encoded = 16 chars)
    const ivBytes = atob(encrypted.iv);
    expect(ivBytes.length).toBe(12);

    // Validate encryptedKey contains: 12-byte IV + encrypted AES key + GCM auth tag
    const keyBytes = atob(encrypted.encryptedKey);
    expect(keyBytes.length).toBeGreaterThan(12); // At least IV + some data
  });

  it('VALIDATION 7: Session key caching works (no re-derivation)', async () => {
    let signatureCount = 0;
    const trackingWallet = {
      ...mockWallet,
      signMessage: async (data: Uint8Array) => {
        signatureCount++;
        return mockWallet.signMessage(data);
      },
    };
    (window as any).arweaveWallet = trackingWallet;

    // First encryption should trigger signature
    const encrypted1 = await encryptContent('Content 1', TEST_PASSWORD);
    expect(signatureCount).toBe(1);

    // Second encryption should use cached key
    const encrypted2 = await encryptContent('Content 2', TEST_PASSWORD);
    expect(signatureCount).toBe(1); // Still 1, not 2

    // Decryption should also use cached key
    await decryptContent(encrypted1, TEST_PASSWORD);
    await decryptContent(encrypted2, TEST_PASSWORD);
    expect(signatureCount).toBe(1); // Still 1

    // Verify decryption works
    expect(await decryptContent(encrypted1, TEST_PASSWORD)).toBe('Content 1');
    expect(await decryptContent(encrypted2, TEST_PASSWORD)).toBe('Content 2');
  });

  it('VALIDATION 8: Empty string handling', async () => {
    const original = '';
    const encrypted = await encryptContent(original, TEST_PASSWORD);
    const decrypted = await decryptContent(encrypted, TEST_PASSWORD);
    expect(decrypted).toBe('');
  });

  it('VALIDATION 9: Very long content (100KB)', async () => {
    const original = 'Lorem ipsum dolor sit amet. '.repeat(4000); // ~100KB

    const encrypted = await encryptContent(original, TEST_PASSWORD);
    const decrypted = await decryptContent(encrypted, TEST_PASSWORD);

    expect(decrypted).toBe(original);
    expect(decrypted.length).toBeGreaterThan(100000);
  });

  it('VALIDATION 10: Deterministic master key derivation', async () => {
    clearEncryptionCache();

    // Encrypt with first session
    const encrypted1 = await encryptContent('Test', TEST_PASSWORD);
    const decrypted1 = await decryptContent(encrypted1, TEST_PASSWORD);
    expect(decrypted1).toBe('Test');

    // Clear cache and re-derive key
    clearEncryptionCache();

    // Should still decrypt (deterministic derivation from same wallet)
    const decrypted2 = await decryptContent(encrypted1, TEST_PASSWORD);
    expect(decrypted2).toBe('Test');
  });
});
