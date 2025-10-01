import { useEffect } from 'react';
import { Wallet, LogOut, Copy, Check } from 'lucide-react';
import { Button } from '@/frontend/components/ui/button';
import { useWallet } from '@/frontend/hooks/useWallet';
import { usePassword } from '@/frontend/contexts/PasswordContext';
import { useState } from 'react';

export function WalletButton() {
  const { address, connected, connecting, connect, disconnect, checkConnection } = useWallet();
  const { clearPassword } = usePassword();
  const [copied, setCopied] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    checkConnection();
  }, []);

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

  const handleDisconnect = () => {
    disconnect();
    clearPassword(); // Clear encryption password from session
    setShowDropdown(false);
  };

  if (!connected) {
    return (
      <Button
        onClick={connect}
        disabled={connecting}
        variant="default"
        size="default"
      >
        <Wallet className="mr-2 h-4 w-4" />
        {connecting ? 'Connecting...' : 'Connect Wallet'}
      </Button>
    );
  }

  return (
    <div className="relative">
      <Button
        onClick={() => setShowDropdown(!showDropdown)}
        variant="outline"
        size="default"
      >
        <Wallet className="mr-2 h-4 w-4" />
        {address && truncateAddress(address)}
      </Button>

      {showDropdown && (
        <div className="absolute right-0 mt-2 w-48 rounded-md border bg-popover text-popover-foreground shadow-md z-50">
          <div className="p-2">
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