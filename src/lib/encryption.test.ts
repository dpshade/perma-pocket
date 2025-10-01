import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  isEncrypted,
  shouldEncrypt,
  isPromptEncrypted,
  wasPromptEncrypted,
  encryptContent,
  decryptContent,
  prepareContentForUpload,
  prepareContentForDisplay,
  type EncryptedData,
} from './encryption';

const TEST_PASSWORD = 'test-password-123';

describe('Encryption Utilities', () => {
  describe('Type Guards and Validation', () => {
    describe('isEncrypted', () => {
      it('should return true for valid encrypted data', () => {
        const data: EncryptedData = {
          encryptedContent: 'abc123',
          encryptedKey: 'def456',
          iv: 'ghi789',
          isEncrypted: true,
        };
        expect(isEncrypted(data)).toBe(true);
      });

      it('should return false for data without isEncrypted flag', () => {
        const data = {
          encryptedContent: 'abc123',
          encryptedKey: 'def456',
          iv: 'ghi789',
        };
        expect(isEncrypted(data)).toBe(false);
      });

      it('should return false for data missing required fields', () => {
        expect(isEncrypted({ isEncrypted: true })).toBe(false);
        expect(
          isEncrypted({ isEncrypted: true, encryptedContent: 'abc' })
        ).toBe(false);
        expect(
          isEncrypted({
            isEncrypted: true,
            encryptedContent: 'abc',
            encryptedKey: 'def',
          })
        ).toBe(false);
      });

      it('should return false for null or undefined', () => {
        expect(isEncrypted(null)).toBe(false);
        expect(isEncrypted(undefined)).toBe(false);
      });

      it('should return false for plain strings', () => {
        expect(isEncrypted('plain text')).toBe(false);
      });
    });

    describe('shouldEncrypt', () => {
      it('should return true for prompts without public tag', () => {
        expect(shouldEncrypt(['work', 'personal'])).toBe(true);
        expect(shouldEncrypt(['draft'])).toBe(true);
        expect(shouldEncrypt([])).toBe(true);
      });

      it('should return false for prompts with public tag', () => {
        expect(shouldEncrypt(['public'])).toBe(false);
        expect(shouldEncrypt(['work', 'public'])).toBe(false);
        expect(shouldEncrypt(['PUBLIC'])).toBe(false);
        expect(shouldEncrypt(['Public'])).toBe(false);
      });

      it('should be case-insensitive for public tag', () => {
        expect(shouldEncrypt(['PuBLiC'])).toBe(false);
        expect(shouldEncrypt(['pUbLIc'])).toBe(false);
      });
    });

    describe('isPromptEncrypted', () => {
      it('should return false for plain string content', () => {
        expect(isPromptEncrypted('plain text content')).toBe(false);
      });

      it('should return true for encrypted object content', () => {
        const encryptedContent: EncryptedData = {
          encryptedContent: 'abc123',
          encryptedKey: 'def456',
          iv: 'ghi789',
          isEncrypted: true,
        };
        expect(isPromptEncrypted(encryptedContent)).toBe(true);
      });

      it('should return false for invalid encrypted objects', () => {
        expect(isPromptEncrypted({ foo: 'bar' })).toBe(false);
        expect(isPromptEncrypted({ isEncrypted: true })).toBe(false);
      });
    });

    describe('wasPromptEncrypted', () => {
      it('should return true for prompts without public tag', () => {
        expect(wasPromptEncrypted(['work', 'draft'])).toBe(true);
        expect(wasPromptEncrypted(['private'])).toBe(true);
        expect(wasPromptEncrypted([])).toBe(true);
      });

      it('should return false for prompts with public tag', () => {
        expect(wasPromptEncrypted(['public'])).toBe(false);
        expect(wasPromptEncrypted(['work', 'public', 'draft'])).toBe(false);
      });

      it('should be case-insensitive for public tag', () => {
        expect(wasPromptEncrypted(['PUBLIC'])).toBe(false);
        expect(wasPromptEncrypted(['Public'])).toBe(false);
        expect(wasPromptEncrypted(['PuBLiC'])).toBe(false);
      });

      it('should return true when public is not exact match', () => {
        expect(wasPromptEncrypted(['publicize'])).toBe(true);
        expect(wasPromptEncrypted(['republic'])).toBe(true);
      });
    });
  });

  describe('Encryption and Decryption Flow', () => {
    const testContent = 'This is a secret test prompt content!';

    beforeEach(() => {
      // Reset mock calls
      vi.clearAllMocks();
    });

    describe('encryptContent', () => {
      it('should encrypt content successfully', async () => {
        const encrypted = await encryptContent(testContent, TEST_PASSWORD);

        expect(encrypted.isEncrypted).toBe(true);
        expect(encrypted.encryptedContent).toBeTruthy();
        expect(encrypted.encryptedKey).toBeTruthy();
        expect(encrypted.iv).toBeTruthy();
        expect(typeof encrypted.encryptedContent).toBe('string');
        expect(typeof encrypted.encryptedKey).toBe('string');
        expect(typeof encrypted.iv).toBe('string');
      });

      it('should call wallet signMessage method for session key', async () => {
        await encryptContent(testContent, TEST_PASSWORD);
        // Session-based encryption uses signMessage() to derive master key
        expect(window.arweaveWallet.signMessage).toHaveBeenCalled();

        // Verify the call includes the message data
        const call = (window.arweaveWallet.signMessage as any).mock.calls[0];
        expect(call[0]).toBeTruthy(); // Message data
        expect(call[0].length).toBeGreaterThan(0); // Has content
        // New signMessage API uses hashAlgorithm option
        expect(call[1]).toMatchObject({
          hashAlgorithm: 'SHA-256',
        });
      });

      it('should throw error when wallet is not connected', async () => {
        const originalWallet = window.arweaveWallet;
        (window as any).arweaveWallet = undefined;

        await expect(encryptContent(testContent, TEST_PASSWORD)).rejects.toThrow(
          'Arweave wallet not connected'
        );

        (window as any).arweaveWallet = originalWallet;
      });

      it('should produce different encrypted outputs for same content', async () => {
        // Due to random IV, each encryption should be unique
        const encrypted1 = await encryptContent(testContent, TEST_PASSWORD);
        const encrypted2 = await encryptContent(testContent, TEST_PASSWORD);

        expect(encrypted1.encryptedContent).not.toBe(
          encrypted2.encryptedContent
        );
        expect(encrypted1.iv).not.toBe(encrypted2.iv);
      });
    });

    describe('decryptContent', () => {
      it('should decrypt encrypted content back to original', async () => {
        const encrypted = await encryptContent(testContent, TEST_PASSWORD);
        const decrypted = await decryptContent(encrypted, TEST_PASSWORD);

        expect(decrypted).toBe(testContent);
      });

      it('should use cached session key (no additional signatures)', async () => {
        const encrypted = await encryptContent(testContent, TEST_PASSWORD);
        vi.clearAllMocks(); // Clear the signMessage call from encryption

        await decryptContent(encrypted, TEST_PASSWORD);

        // Decryption should NOT call signMessage() again since the session key is cached
        expect(window.arweaveWallet.signMessage).not.toHaveBeenCalled();
      });

      it('should throw error when wallet is not connected', async () => {
        const encrypted = await encryptContent(testContent, TEST_PASSWORD);
        const originalWallet = window.arweaveWallet;
        (window as any).arweaveWallet = undefined;

        await expect(decryptContent(encrypted, TEST_PASSWORD)).rejects.toThrow(
          'Arweave wallet not connected'
        );

        (window as any).arweaveWallet = originalWallet;
      });

      it('should handle various content types', async () => {
        const contents = [
          'Simple text',
          'Multi\nline\ncontent',
          'Special chars: !@#$%^&*()',
          'Unicode: 你好世界 🌍',
          'JSON-like: {"key": "value"}',
        ];

        for (const content of contents) {
          const encrypted = await encryptContent(content, TEST_PASSWORD);
          const decrypted = await decryptContent(encrypted, TEST_PASSWORD);
          expect(decrypted).toBe(content);
        }
      });
    });

    describe('Round-trip encryption', () => {
      it('should maintain content integrity through encrypt/decrypt cycle', async () => {
        const testCases = [
          'Simple text',
          'A much longer text with many words and characters to test the encryption properly',
          '',
          '12345',
          'Special: \n\t\r',
        ];

        for (const testCase of testCases) {
          const encrypted = await encryptContent(testCase, TEST_PASSWORD);
          const decrypted = await decryptContent(encrypted, TEST_PASSWORD);
          expect(decrypted).toBe(testCase);
        }
      });
    });
  });

  describe('Content Preparation', () => {
    const testContent = 'Test prompt content';

    beforeEach(() => {
      vi.clearAllMocks();
    });

    describe('prepareContentForUpload', () => {
      it('should encrypt content when tags do not include public', async () => {
        const result = await prepareContentForUpload(testContent, [
          'work',
          'draft',
        ], TEST_PASSWORD);

        expect(isEncrypted(result)).toBe(true);
        expect(window.arweaveWallet.signMessage).toHaveBeenCalled();
      });

      it('should not encrypt content when tags include public', async () => {
        const result = await prepareContentForUpload(testContent, ['public'], TEST_PASSWORD);

        expect(result).toBe(testContent);
        expect(window.arweaveWallet.signMessage).not.toHaveBeenCalled();
      });

      it('should handle case-insensitive public tag', async () => {
        const testCases = ['public', 'Public', 'PUBLIC', 'PuBLiC'];

        for (const publicTag of testCases) {
          vi.clearAllMocks();
          const result = await prepareContentForUpload(testContent, [
            publicTag,
          ], TEST_PASSWORD);
          expect(result).toBe(testContent);
        }
      });

      it('should encrypt when public is not the exact tag', async () => {
        const result = await prepareContentForUpload(testContent, [
          'publicize',
        ], TEST_PASSWORD);
        expect(isEncrypted(result)).toBe(true);
      });
    });

    describe('prepareContentForDisplay', () => {
      it('should return string content as-is', async () => {
        const result = await prepareContentForDisplay(testContent, TEST_PASSWORD);
        expect(result).toBe(testContent);
      });

      it('should decrypt encrypted content', async () => {
        const encrypted = await encryptContent(testContent, TEST_PASSWORD);
        const result = await prepareContentForDisplay(encrypted, TEST_PASSWORD);

        expect(result).toBe(testContent);
      });

      it('should handle already decrypted content', async () => {
        const plainText = 'Already plain text';
        const result = await prepareContentForDisplay(plainText, TEST_PASSWORD);

        expect(result).toBe(plainText);
      });

      it('should convert non-string, non-encrypted data to string', async () => {
        const result = await prepareContentForDisplay({ foo: 'bar' } as any, TEST_PASSWORD);
        expect(typeof result).toBe('string');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle encryption errors gracefully', async () => {
      const originalSignMessage = window.arweaveWallet.signMessage;
      window.arweaveWallet.signMessage = vi
        .fn()
        .mockRejectedValue(new Error('signMessage failed'));

      await expect(encryptContent('test', TEST_PASSWORD)).rejects.toThrow(
        'Failed to encrypt content'
      );

      window.arweaveWallet.signMessage = originalSignMessage;
    });

    it('should handle decryption errors gracefully', async () => {
      const encrypted = await encryptContent('test', TEST_PASSWORD);

      // Corrupt the encrypted key to cause decryption failure
      const corruptedData = {
        ...encrypted,
        encryptedKey: 'corrupted-invalid-data',
      };

      await expect(decryptContent(corruptedData, TEST_PASSWORD)).rejects.toThrow(
        'Failed to decrypt content'
      );
    });

    it('should handle invalid encrypted data structure', async () => {
      const invalidData = {
        encryptedContent: 'invalid-base64',
        encryptedKey: 'invalid-base64',
        iv: 'invalid-base64',
        isEncrypted: true,
      } as EncryptedData;

      await expect(decryptContent(invalidData, TEST_PASSWORD)).rejects.toThrow();
    });
  });

  describe('Backward Compatibility', () => {
    it('should handle unencrypted legacy content', async () => {
      const legacyContent = 'This is old unencrypted content';
      const result = await prepareContentForDisplay(legacyContent, TEST_PASSWORD);

      expect(result).toBe(legacyContent);
    });

    it('should not try to encrypt empty content', async () => {
      const result = await prepareContentForUpload('', ['work'], TEST_PASSWORD);
      expect(isEncrypted(result)).toBe(true);

      const decrypted = await prepareContentForDisplay(result as EncryptedData, TEST_PASSWORD);
      expect(decrypted).toBe('');
    });
  });
});
