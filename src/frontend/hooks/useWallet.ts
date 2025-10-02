import { create } from 'zustand';
import {
  checkWalletConnection,
  getArweaveWallet,
} from '@/backend/api/client';
import { getProfile, initializeProfile } from '@/core/storage/cache';
import type { ArNSWalletConnector, WALLET_TYPES } from '@/shared/types/wallet';
import { WanderWalletConnector } from '@/backend/services/wallets';

interface WalletState {
  address: string | null;
  connected: boolean;
  connecting: boolean;
  error: string | null;
  walletType: WALLET_TYPES | null;
  wallet: ArNSWalletConnector | null;

  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  checkConnection: () => Promise<void>;
  setWallet: (connector: ArNSWalletConnector, address: string, walletType: WALLET_TYPES) => void;
}

export const useWallet = create<WalletState>((set, get) => ({
  address: null,
  connected: false,
  connecting: false,
  error: null,
  walletType: null,
  wallet: null,

  /**
   * Legacy connect method - attempts to connect via ArConnect/Wander (default wallet)
   * This maintains backward compatibility with existing code
   */
  connect: async () => {
    set({ connecting: true, error: null });
    try {
      // Use WanderWalletConnector as the default (ArConnect compatible)
      const connector = new WanderWalletConnector();
      await connector.connect();
      const address = await connector.getWalletAddress();

      if (address) {
        // Initialize or load profile
        let profile = getProfile();
        if (!profile || profile.address !== address) {
          profile = initializeProfile(address);
        }

        set({
          address,
          connected: true,
          connecting: false,
          wallet: connector,
          walletType: 'Wander' as any,
        });
      } else {
        throw new Error('Failed to get wallet address');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect wallet';
      set({ error: errorMessage, connecting: false, connected: false });
    }
  },

  /**
   * Set wallet connector and address
   * Called by ConnectWalletModal after successful connection
   */
  setWallet: (connector: ArNSWalletConnector, address: string, walletType: WALLET_TYPES) => {
    // Initialize or load profile
    let profile = getProfile();
    if (!profile || profile.address !== address) {
      profile = initializeProfile(address);
    }

    set({
      wallet: connector,
      address,
      connected: true,
      connecting: false,
      error: null,
      walletType,
    });
  },

  disconnect: async () => {
    try {
      const { wallet } = get();

      // Disconnect using the wallet connector if available
      if (wallet) {
        await wallet.disconnect();
      }

      // Don't clear cache - keep prompts for next session
      set({
        address: null,
        connected: false,
        error: null,
        wallet: null,
        walletType: null,
      });
    } catch (error) {
      console.error('Disconnect error:', error);
      set({
        address: null,
        connected: false,
        wallet: null,
        walletType: null,
      });
    }
  },

  checkConnection: async () => {
    try {
      // Check for legacy ArConnect connection first
      const isConnected = await checkWalletConnection();
      if (isConnected) {
        const arweaveWallet = getArweaveWallet();
        if (arweaveWallet) {
          const address = await arweaveWallet.getActiveAddress();
          if (address) {
            let profile = getProfile();
            if (!profile || profile.address !== address) {
              profile = initializeProfile(address);
            }

            // Restore WanderWalletConnector for legacy connections
            const connector = new WanderWalletConnector();
            set({
              address,
              connected: true,
              wallet: connector,
              walletType: 'Wander' as any,
            });
          }
        }
      }
    } catch (error) {
      console.error('Check connection error:', error);
    }
  },
}));