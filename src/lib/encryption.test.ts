import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  isEncrypted,
  shouldEncrypt,
  isPromptEncrypted,
  encryptContent,
  decryptContent,
  prepareContentForUpload,
  prepareContentForDisplay,
  type EncryptedData,
} from './encryption';

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
  });

  describe('Encryption and Decryption Flow', () => {
    const testContent = 'This is a secret test prompt content!';

    beforeEach(() => {
      // Reset mock calls
      vi.clearAllMocks();
    });

    describe('encryptContent', () => {
      it('should encrypt content successfully', async () => {
        const encrypted = await encryptContent(testContent);

        expect(encrypted.isEncrypted).toBe(true);
        expect(encrypted.encryptedContent).toBeTruthy();
        expect(encrypted.encryptedKey).toBeTruthy();
        expect(encrypted.iv).toBeTruthy();
        expect(typeof encrypted.encryptedContent).toBe('string');
        expect(typeof encrypted.encryptedKey).toBe('string');
        expect(typeof encrypted.iv).toBe('string');
      });

      it('should call wallet encrypt method', async () => {
        await encryptContent(testContent);
        expect(window.arweaveWallet.encrypt).toHaveBeenCalledWith(
          expect.any(Uint8Array),
          {
            algorithm: 'RSA-OAEP',
            hash: 'SHA-256',
          }
        );
      });

      it('should throw error when wallet is not connected', async () => {
        const originalWallet = window.arweaveWallet;
        (window as any).arweaveWallet = undefined;

        await expect(encryptContent(testContent)).rejects.toThrow(
          'Arweave wallet not connected'
        );

        (window as any).arweaveWallet = originalWallet;
      });

      it('should produce different encrypted outputs for same content', async () => {
        // Due to random IV, each encryption should be unique
        const encrypted1 = await encryptContent(testContent);
        const encrypted2 = await encryptContent(testContent);

        expect(encrypted1.encryptedContent).not.toBe(
          encrypted2.encryptedContent
        );
        expect(encrypted1.iv).not.toBe(encrypted2.iv);
      });
    });

    describe('decryptContent', () => {
      it('should decrypt encrypted content back to original', async () => {
        const encrypted = await encryptContent(testContent);
        const decrypted = await decryptContent(encrypted);

        expect(decrypted).toBe(testContent);
      });

      it('should call wallet decrypt method', async () => {
        const encrypted = await encryptContent(testContent);
        vi.clearAllMocks(); // Clear the encrypt call

        await decryptContent(encrypted);

        expect(window.arweaveWallet.decrypt).toHaveBeenCalledWith(
          expect.any(Uint8Array),
          {
            algorithm: 'RSA-OAEP',
            hash: 'SHA-256',
          }
        );
      });

      it('should throw error when wallet is not connected', async () => {
        const encrypted = await encryptContent(testContent);
        const originalWallet = window.arweaveWallet;
        (window as any).arweaveWallet = undefined;

        await expect(decryptContent(encrypted)).rejects.toThrow(
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
          const encrypted = await encryptContent(content);
          const decrypted = await decryptContent(encrypted);
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
          const encrypted = await encryptContent(testCase);
          const decrypted = await decryptContent(encrypted);
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
        ]);

        expect(isEncrypted(result)).toBe(true);
        expect(window.arweaveWallet.encrypt).toHaveBeenCalled();
      });

      it('should not encrypt content when tags include public', async () => {
        const result = await prepareContentForUpload(testContent, ['public']);

        expect(result).toBe(testContent);
        expect(window.arweaveWallet.encrypt).not.toHaveBeenCalled();
      });

      it('should handle case-insensitive public tag', async () => {
        const testCases = ['public', 'Public', 'PUBLIC', 'PuBLiC'];

        for (const publicTag of testCases) {
          vi.clearAllMocks();
          const result = await prepareContentForUpload(testContent, [
            publicTag,
          ]);
          expect(result).toBe(testContent);
        }
      });

      it('should encrypt when public is not the exact tag', async () => {
        const result = await prepareContentForUpload(testContent, [
          'publicize',
        ]);
        expect(isEncrypted(result)).toBe(true);
      });
    });

    describe('prepareContentForDisplay', () => {
      it('should return string content as-is', async () => {
        const result = await prepareContentForDisplay(testContent);
        expect(result).toBe(testContent);
      });

      it('should decrypt encrypted content', async () => {
        const encrypted = await encryptContent(testContent);
        const result = await prepareContentForDisplay(encrypted);

        expect(result).toBe(testContent);
      });

      it('should handle already decrypted content', async () => {
        const plainText = 'Already plain text';
        const result = await prepareContentForDisplay(plainText);

        expect(result).toBe(plainText);
      });

      it('should convert non-string, non-encrypted data to string', async () => {
        const result = await prepareContentForDisplay({ foo: 'bar' } as any);
        expect(typeof result).toBe('string');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle encryption errors gracefully', async () => {
      const originalEncrypt = window.arweaveWallet.encrypt;
      window.arweaveWallet.encrypt = vi
        .fn()
        .mockRejectedValue(new Error('Encryption failed'));

      await expect(encryptContent('test')).rejects.toThrow(
        'Failed to encrypt content'
      );

      window.arweaveWallet.encrypt = originalEncrypt;
    });

    it('should handle decryption errors gracefully', async () => {
      const encrypted = await encryptContent('test');

      const originalDecrypt = window.arweaveWallet.decrypt;
      window.arweaveWallet.decrypt = vi
        .fn()
        .mockRejectedValue(new Error('Decryption failed'));

      await expect(decryptContent(encrypted)).rejects.toThrow(
        'Failed to decrypt content'
      );

      window.arweaveWallet.decrypt = originalDecrypt;
    });

    it('should handle invalid encrypted data structure', async () => {
      const invalidData = {
        encryptedContent: 'invalid-base64',
        encryptedKey: 'invalid-base64',
        iv: 'invalid-base64',
        isEncrypted: true,
      } as EncryptedData;

      await expect(decryptContent(invalidData)).rejects.toThrow();
    });
  });

  describe('Backward Compatibility', () => {
    it('should handle unencrypted legacy content', async () => {
      const legacyContent = 'This is old unencrypted content';
      const result = await prepareContentForDisplay(legacyContent);

      expect(result).toBe(legacyContent);
    });

    it('should not try to encrypt empty content', async () => {
      const result = await prepareContentForUpload('', ['work']);
      expect(isEncrypted(result)).toBe(true);

      const decrypted = await prepareContentForDisplay(result as EncryptedData);
      expect(decrypted).toBe('');
    });
  });
});
