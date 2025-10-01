/**
 * Password Context for Encryption
 *
 * Manages the user's encryption password for the current session.
 * Password is NEVER persisted - only stored in memory during the session.
 *
 * Usage:
 * - User is prompted for password on first encrypted operation
 * - Password is cached in memory for the session
 * - Password is cleared on wallet disconnect
 * - Same password required across all devices for deterministic encryption
 */

import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { clearEncryptionCache } from '@/lib/encryption';

interface PasswordContextValue {
  /** Current password (null if not set) */
  password: string | null;

  /** Set the encryption password for this session */
  setPassword: (password: string) => void;

  /** Clear the password and encryption cache */
  clearPassword: () => void;

  /** Check if password is currently set */
  hasPassword: boolean;
}

const PasswordContext = createContext<PasswordContextValue | undefined>(undefined);

export function PasswordProvider({ children }: { children: ReactNode }) {
  const [password, setPasswordState] = useState<string | null>(null);

  const setPassword = useCallback((newPassword: string) => {
    setPasswordState(newPassword);
  }, []);

  const clearPassword = useCallback(() => {
    setPasswordState(null);
    clearEncryptionCache();
  }, []);

  const value: PasswordContextValue = {
    password,
    setPassword,
    clearPassword,
    hasPassword: password !== null,
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
