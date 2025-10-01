/**
 * PasswordUnlock Component
 *
 * Prompts user to enter their password to decrypt existing encrypted prompts.
 * Validates password by attempting to decrypt a known encrypted prompt.
 *
 * Usage: Display when user has encrypted prompts but password not set in session
 */

import { useState } from 'react';
import { AlertCircle, Lock, Unlock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { validatePassword, type EncryptedData } from '@/lib/encryption';

interface PasswordUnlockProps {
  open: boolean;
  /** Sample encrypted data to validate password against */
  sampleEncryptedData: EncryptedData | null;
  onPasswordUnlock: (password: string) => void;
  onCancel: () => void;
}

export function PasswordUnlock({
  open,
  sampleEncryptedData,
  onPasswordUnlock,
  onCancel,
}: PasswordUnlockProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!password) {
      setError('Password is required');
      return;
    }

    // If we have sample data, validate password against it
    if (sampleEncryptedData) {
      setIsValidating(true);
      try {
        const isValid = await validatePassword(sampleEncryptedData, password);

        if (!isValid) {
          setError('Incorrect password. Please try again.');
          setIsValidating(false);
          return;
        }
      } catch (err) {
        setError('Failed to validate password. Please try again.');
        setIsValidating(false);
        return;
      }
      setIsValidating(false);
    }

    // Success - password is valid
    onPasswordUnlock(password);

    // Clear form
    setPassword('');
  };

  const handleCancel = () => {
    setPassword('');
    setError(null);
    onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleCancel()}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Unlock className="h-5 w-5" />
            Unlock Encrypted Prompts
          </DialogTitle>
          <DialogDescription>
            Enter your encryption password to access your encrypted prompts.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="unlock-password">Password</Label>
            <Input
              id="unlock-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your encryption password"
              autoFocus
              required
              disabled={isValidating}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Alert>
            <Lock className="h-4 w-4" />
            <AlertDescription className="text-sm">
              Your password is only stored in memory for this session. You'll need to re-enter it
              when you reconnect your wallet.
            </AlertDescription>
          </Alert>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancel} disabled={isValidating}>
              Cancel
            </Button>
            <Button type="submit" disabled={isValidating}>
              {isValidating ? 'Validating...' : 'Unlock'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
