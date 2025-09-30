import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
  localStorage.clear();
});

// Mock window.arweaveWallet
global.window = global.window || {};
(global.window as any).arweaveWallet = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  getActiveAddress: vi.fn(),
  getPermissions: vi.fn(),
  // Encryption/Decryption methods for testing
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