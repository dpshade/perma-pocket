import { useState } from 'react';
import { X, ExternalLink } from 'lucide-react';
import {
  WanderWalletConnector,
  ArweaveAppWalletConnector,
  BeaconWalletConnector,
} from '@/backend/services/wallets';
import type { ArNSWalletConnector } from '@/shared/types/wallet';
import { WanderIcon, BeaconIcon, ArweaveAppIcon } from '@/frontend/components/icons';

interface ConnectWalletModalProps {
  open: boolean;
  onClose: () => void;
  onConnect: (connector: ArNSWalletConnector, address: string) => void;
}

/**
 * Wallet Connect Modal
 * Displays available wallet options for connecting to Arweave
 */
export function ConnectWalletModal({ open, onClose, onConnect }: ConnectWalletModalProps) {
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleConnect = async (walletConnector: ArNSWalletConnector, walletName: string) => {
    try {
      setConnecting(true);
      setError(null);

      // Connect to the wallet
      await walletConnector.connect();

      // Get the wallet address
      const address = await walletConnector.getWalletAddress();

      if (!address) {
        throw new Error('Failed to get wallet address');
      }

      // Notify parent component
      onConnect(walletConnector, address);
      onClose();
    } catch (err: any) {
      console.error(`${walletName} connection error:`, err);

      // User-friendly error messages
      let errorMessage = `Failed to connect to ${walletName}`;

      if (err.message?.includes('User cancelled') || err.message?.includes('cancel')) {
        errorMessage = 'Connection cancelled';
      } else if (err.message?.includes('not installed')) {
        errorMessage = `${walletName} is not installed. Please install the extension first.`;
      } else if (err.message?.includes('not responding')) {
        errorMessage = `${walletName} is not responding. Please check that it's running.`;
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
    } finally {
      setConnecting(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !connecting) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md"
      onClick={handleBackdropClick}
    >
      <div className="relative w-full max-w-md rounded-lg border bg-card/95 backdrop-blur-sm p-6 shadow-lg mx-4">
        {/* Header */}
        <div className="mb-4">
          <button
            onClick={onClose}
            disabled={connecting}
            className="absolute top-4 right-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
          >
            <X className="h-5 w-5" />
            <span className="sr-only">Close</span>
          </button>

          <h2 className="text-xl font-semibold mb-2">Connect Wallet</h2>
          <p className="text-sm text-muted-foreground">
            Choose a wallet to connect to Pocket Prompt
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 p-3">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* Arweave Wallets Section */}
        <div className="space-y-3">
          {/* Wander Wallet */}
          <button
            onClick={() => handleConnect(new WanderWalletConnector(), 'Wander')}
            disabled={connecting}
            className="w-full flex items-center gap-3 rounded-lg border border-border bg-background p-4 text-left transition-all hover:bg-accent hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex h-12 w-12 items-center justify-center">
              <WanderIcon className="h-full w-full" />
            </div>
            <div className="flex-1">
              <div className="font-medium">Wander</div>
              <div className="text-xs text-muted-foreground">Browser extension wallet</div>
            </div>
            {connecting && <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />}
          </button>

          {/* Arweave.app Wallet */}
          <button
            onClick={() => handleConnect(new ArweaveAppWalletConnector(), 'Arweave.app')}
            disabled={connecting}
            className="w-full flex items-center gap-3 rounded-lg border border-border bg-background p-4 text-left transition-all hover:bg-accent hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex h-12 w-12 items-center justify-center">
              <ArweaveAppIcon className="h-full w-full" />
            </div>
            <div className="flex-1">
              <div className="font-medium">Arweave.app</div>
              <div className="text-xs text-muted-foreground">Web-based wallet</div>
            </div>
            {connecting && <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />}
          </button>

          {/* Beacon Wallet */}
          <button
            onClick={() => handleConnect(new BeaconWalletConnector(), 'Beacon')}
            disabled={connecting}
            className="w-full flex items-center gap-3 rounded-lg border border-border bg-background p-4 text-left transition-all hover:bg-accent hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex h-12 w-12 items-center justify-center">
              <BeaconIcon className="h-full w-full" />
            </div>
            <div className="flex-1">
              <div className="font-medium">Beacon</div>
              <div className="text-xs text-muted-foreground">Mobile-first wallet</div>
            </div>
            {connecting && <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />}
          </button>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t">
          <p className="text-xs text-muted-foreground text-center">
            Don't have a wallet?{' '}
            <a
              href="https://ar.io/wallet"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              Get one here
              <ExternalLink className="h-3 w-3" />
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
