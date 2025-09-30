import { expect, afterEach, vi } from 'vitest';
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
};