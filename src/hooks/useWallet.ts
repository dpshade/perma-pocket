import { create } from 'zustand';
import {
  connectWallet,
  disconnectWallet,
  getWalletAddress,
  checkWalletConnection,
} from '@/lib/arweave';
import { getProfile, initializeProfile } from '@/lib/storage';

interface WalletState {
  address: string | null;
  connected: boolean;
  connecting: boolean;
  error: string | null;

  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  checkConnection: () => Promise<void>;
}

export const useWallet = create<WalletState>((set) => ({
  address: null,
  connected: false,
  connecting: false,
  error: null,

  connect: async () => {
    set({ connecting: true, error: null });
    try {
      const address = await connectWallet();
      if (address) {
        // Initialize or load profile
        let profile = getProfile();
        if (!profile || profile.address !== address) {
          profile = initializeProfile(address);
        }

        set({ address, connected: true, connecting: false });
      } else {
        throw new Error('Failed to get wallet address');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect wallet';
      set({ error: errorMessage, connecting: false, connected: false });
    }
  },

  disconnect: async () => {
    try {
      await disconnectWallet();
      // Don't clear cache - keep prompts for next session
      set({ address: null, connected: false, error: null });
    } catch (error) {
      console.error('Disconnect error:', error);
      set({ address: null, connected: false });
    }
  },

  checkConnection: async () => {
    try {
      const isConnected = await checkWalletConnection();
      if (isConnected) {
        const address = await getWalletAddress();
        if (address) {
          let profile = getProfile();
          if (!profile || profile.address !== address) {
            profile = initializeProfile(address);
          }
          set({ address, connected: true });
        }
      }
    } catch (error) {
      console.error('Check connection error:', error);
    }
  },
}));