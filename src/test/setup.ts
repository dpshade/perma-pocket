import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { clearEncryptionCache } from '@/lib/encryption';

// Cleanup after each test
afterEach(() => {
  cleanup();
  localStorage.clear();
  clearEncryptionCache(); // Clear encryption session cache
});

// Mock window.arweaveWallet
global.window = global.window || {};
(global.window as any).arweaveWallet = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  getActiveAddress: vi.fn().mockResolvedValue('mock-wallet-address-123'),
  getPermissions: vi.fn(),
  // signMessage method for session key derivation (replaces deprecated signature)
  signMessage: vi.fn().mockImplementation(async (data: Uint8Array) => {
    // Mock signature: Create a deterministic 256-byte signature from input
    const signature = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      signature[i] = (data[i % data.length] + i) % 256;
    }
    return signature;
  }),
  // Legacy encryption/decryption methods (kept for backward compatibility)
  encrypt: vi.fn().mockImplementation(async (data: Uint8Array) => {
    // Mock RSA-OAEP encryption: just reverse the bytes for testing
    const reversed = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) {
      reversed[i] = data[data.length - 1 - i];
    }
    // Return as Uint8Array (ArConnect can return Uint8Array or ArrayBuffer)
    return reversed;
  }),
  decrypt: vi.fn().mockImplementation(async (data: Uint8Array) => {
    // Mock RSA-OAEP decryption: reverse the bytes back
    const reversed = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) {
      reversed[i] = data[data.length - 1 - i];
    }
    // Return as Uint8Array (ArConnect can return Uint8Array or ArrayBuffer)
    return reversed;
  }),
};