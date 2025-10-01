/**
 * PasswordPrompt Component
 *
 * Prompts user to set up their encryption password for the session.
 * Shows critical warnings about password recovery.
 *
 * Usage: Display when user attempts encrypted operation without password set
 */

import { useState } from 'react';
import { AlertCircle, Lock } from 'lucide-react';
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

interface PasswordPromptProps {
  open: boolean;
  onPasswordSet: (password: string) => void;
  onCancel: () => void;
}

export function PasswordPrompt({ open, onPasswordSet, onCancel }: PasswordPromptProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Success - set password
    onPasswordSet(password);

    // Clear form
    setPassword('');
    setConfirmPassword('');
  };

  const handleCancel = () => {
    setPassword('');
    setConfirmPassword('');
    setError(null);
    onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleCancel()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Set Encryption Password
          </DialogTitle>
          <DialogDescription>
            Create a password to encrypt your prompts. This password will be required to decrypt
            your content on any device.
          </DialogDescription>
        </DialogHeader>

        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            <strong>Critical:</strong> If you lose this password, your encrypted prompts cannot be
            recovered. There is no password reset mechanism.
          </AlertDescription>
        </Alert>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter a strong password"
              autoFocus
              required
            />
            <p className="text-sm text-muted-foreground">Minimum 8 characters</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm Password</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              required
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button type="submit">Set Password</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
