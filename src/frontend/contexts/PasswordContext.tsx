/**
 * Password Context for Encryption
 *
 * Manages the user's encryption password.
 * Password is persisted in localStorage tied to the connected wallet address.
 *
 * Usage:
 * - User is prompted for password on first encrypted operation
 * - Password is automatically remembered for the specific wallet address
 * - Password is cleared on wallet disconnect
 * - Different wallets can have different passwords on the same device
 */

import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import { clearEncryptionCache } from '@/core/encryption/crypto';

const STORAGE_KEY_PREFIX = 'pocket-prompt-encryption-key';

const getStorageKey = (address: string | null) => {
  if (!address) return null;
  return `${STORAGE_KEY_PREFIX}-${address}`;
};

interface PasswordContextValue {
  /** Current password (null if not set) */
  password: string | null;

  /** Set the encryption password and persist it to localStorage */
  setPassword: (password: string) => void;

  /** Clear the password and encryption cache */
  clearPassword: () => void;

  /** Check if password is currently set */
  hasPassword: boolean;

  /** Set the wallet address (loads saved password if available) */
  setWalletAddress: (address: string | null) => void;

  /** Check if password is currently being loaded from storage */
  isLoadingPassword: boolean;
}

const PasswordContext = createContext<PasswordContextValue | undefined>(undefined);

export function PasswordProvider({ children }: { children: ReactNode }) {
  const [walletAddress, setWalletAddressState] = useState<string | null>(null);
  const [password, setPasswordState] = useState<string | null>(null);
  const [isLoadingPassword, setIsLoadingPassword] = useState(false);

  // Load password when wallet address changes
  useEffect(() => {
    console.log('[PasswordContext] Wallet address changed:', walletAddress);

    if (!walletAddress) {
      console.log('[PasswordContext] No wallet address, clearing password');
      setPasswordState(null);
      setIsLoadingPassword(false);
      return;
    }

    setIsLoadingPassword(true);
    const storageKey = getStorageKey(walletAddress);
    console.log('[PasswordContext] Storage key:', storageKey);

    if (!storageKey) {
      console.log('[PasswordContext] No storage key generated');
      setIsLoadingPassword(false);
      return;
    }

    try {
      const stored = localStorage.getItem(storageKey);
      console.log('[PasswordContext] Loaded from localStorage:', stored ? '***PASSWORD***' : 'null');
      setPasswordState(stored || null);
    } catch (err) {
      console.error('[PasswordContext] Failed to load from localStorage:', err);
      setPasswordState(null);
    } finally {
      setIsLoadingPassword(false);
    }
  }, [walletAddress]);

  const setWalletAddress = useCallback((address: string | null) => {
    setWalletAddressState(address);
  }, []);

  const setPassword = useCallback((newPassword: string) => {
    console.log('[PasswordContext] Setting password for wallet:', walletAddress);
    setPasswordState(newPassword);

    // Persist to localStorage with wallet address
    const storageKey = getStorageKey(walletAddress);
    console.log('[PasswordContext] Saving to storage key:', storageKey);

    if (!storageKey) {
      console.warn('[PasswordContext] Cannot save - no storage key (wallet address not set)');
      return;
    }

    try {
      localStorage.setItem(storageKey, newPassword);
      console.log('[PasswordContext] Password saved to localStorage');
      // Verify it was saved
      const verify = localStorage.getItem(storageKey);
      console.log('[PasswordContext] Verification read:', verify ? '***PASSWORD***' : 'null');
    } catch (error) {
      console.error('[PasswordContext] Failed to persist password:', error);
    }
  }, [walletAddress]);

  const clearPassword = useCallback(() => {
    console.log('[PasswordContext] Clearing password from memory only (keeping in localStorage)');
    setPasswordState(null);
    clearEncryptionCache();
    // Note: We do NOT remove from localStorage - password persists across sessions
    // This allows reconnecting the same wallet without re-entering password
  }, []);

  const value: PasswordContextValue = {
    password,
    setPassword,
    clearPassword,
    hasPassword: password !== null,
    setWalletAddress,
    isLoadingPassword,
  };

  return (
    <PasswordContext.Provider value={value}>
      {children}
    </PasswordContext.Provider>
  );
}

/**
 * Hook to access password context
 * Throws error if used outside PasswordProvider
 */
export function usePassword() {
  const context = useContext(PasswordContext);
  if (!context) {
    throw new Error('usePassword must be used within PasswordProvider');
  }
  return context;
}
