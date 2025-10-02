import { useEffect, useState } from 'react';
import { Wallet, LogOut, Copy, Check, Lock, FileKey, Trash2 } from 'lucide-react';
import { Button } from '@/frontend/components/ui/button';
import { useWallet } from '@/frontend/hooks/useWallet';
import { usePassword } from '@/frontend/contexts/PasswordContext';
import { ConnectWalletModal } from './ConnectWalletModal';
import type { ArNSWalletConnector, WALLET_TYPES } from '@/shared/types/wallet';
import { removeEncryptedKeyfile } from '@/core/encryption/keyfile';

interface WalletButtonProps {
  onSetPassword?: () => void;
}

export function WalletButton({ onSetPassword }: WalletButtonProps = {}) {
  const { address, connected, connecting, disconnect, checkConnection, setWallet, walletType } = useWallet();
  const { hasPassword, clearPassword } = usePassword();
  const [copied, setCopied] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  const truncateAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSetPassword = () => {
    setShowDropdown(false);
    onSetPassword?.();
  };

  const handleDisconnect = () => {
    disconnect();
    clearPassword(); // Clear encryption password from session
    setShowDropdown(false);
  };

  const handleRemoveKeyfile = async () => {
    if (!confirm('Are you sure you want to remove the stored keyfile? You will need to re-import it to connect again.')) {
      return;
    }

    try {
      await removeEncryptedKeyfile();
      disconnect();
      clearPassword();
      setShowDropdown(false);
    } catch (error) {
      console.error('Failed to remove keyfile:', error);
      alert('Failed to remove keyfile. Please try again.');
    }
  };

  const handleConnect = (connector: ArNSWalletConnector, address: string) => {
    // Determine wallet type from localStorage or connector type
    const storedWalletType = localStorage.getItem('walletType') as WALLET_TYPES;
    setWallet(connector, address, storedWalletType);
  };

  if (!connected) {
    return (
      <>
        <Button
          onClick={() => setShowConnectModal(true)}
          disabled={connecting}
          variant="default"
          size="default"
        >
          <Wallet className="mr-2 h-4 w-4" />
          {connecting ? 'Connecting...' : 'Connect Wallet'}
        </Button>

        <ConnectWalletModal
          open={showConnectModal}
          onClose={() => setShowConnectModal(false)}
          onConnect={handleConnect}
        />
      </>
    );
  }

  return (
    <div className="relative">
      <Button
        onClick={() => setShowDropdown(!showDropdown)}
        variant="outline"
        size="default"
        title={walletType ? `Connected with ${walletType}` : 'Connected'}
      >
        <Wallet className="mr-2 h-4 w-4" />
        {address && truncateAddress(address)}
      </Button>

      {showDropdown && (
        <div className="absolute right-0 mt-0.5 w-56 rounded-md border bg-popover text-popover-foreground shadow-md z-50">
          <div className="p-2">
            {/* Wallet Type Indicator */}
            {walletType === 'Keyfile' && (
              <div className="flex items-center gap-2 px-2 py-1.5 mb-1 text-xs text-muted-foreground border-b">
                <FileKey className="h-3 w-3" />
                <span>Keyfile Wallet</span>
              </div>
            )}

            <button
              onClick={copyAddress}
              className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
            >
              {copied ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Address
                </>
              )}
            </button>

            {!hasPassword && (
              <button
                onClick={handleSetPassword}
                className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
              >
                <Lock className="mr-2 h-4 w-4" />
                Set Encryption Password
              </button>
            )}

            {/* Keyfile-specific options */}
            {walletType === 'Keyfile' && (
              <button
                onClick={handleRemoveKeyfile}
                className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Remove Stored Keyfile
              </button>
            )}

            <button
              onClick={handleDisconnect}
              className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Disconnect
            </button>
          </div>
        </div>
      )}
    </div>
  );
}