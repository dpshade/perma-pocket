import { Copy, Edit, Archive, History, Check, Lock, Globe } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/frontend/components/ui/dialog';
import { Button } from '@/frontend/components/ui/button';
import { Badge } from '@/frontend/components/ui/badge';
import type { Prompt } from '@/shared/types/prompt';
import { useState, useEffect } from 'react';
import { wasPromptEncrypted } from '@/core/encryption/crypto';
import { getPublicPromptShareLink } from '@/frontend/utils/deepLinks';

interface PromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prompt: Prompt | null;
  onEdit: () => void;
  onArchive: () => void;
  onShowVersions: () => void;
}

export function PromptDialog({
  open,
  onOpenChange,
  prompt,
  onEdit,
  onArchive,
  onShowVersions,
}: PromptDialogProps) {
  const [copied, setCopied] = useState(false);
  const [publicLinkCopied, setPublicLinkCopied] = useState(false);

  // Check if prompt has version history based on the latest version number
  const hasVersionHistory = (prompt: Prompt | null) => {
    if (!prompt || !prompt.versions || prompt.versions.length === 0) return false;
    const latestVersion = prompt.versions[prompt.versions.length - 1];
    return latestVersion && latestVersion.version > 1;
  };

  // Keyboard shortcuts for the dialog
  useEffect(() => {
    if (!open || !prompt) return;

    const handleCopy = () => {
      navigator.clipboard.writeText(prompt.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

      // Don't handle shortcuts when typing
      if (isTyping) return;

      switch (event.key) {
        case 'e':
          event.preventDefault();
          onEdit();
          break;
        case 'c':
          event.preventDefault();
          handleCopy();
          break;
        case 'a':
          if (!prompt.isArchived) {
            event.preventDefault();
            onArchive();
            onOpenChange(false);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, prompt, onEdit, onArchive, onOpenChange]);

  if (!prompt) return null;

  const isEncrypted = wasPromptEncrypted(prompt.tags);
  const isPublic = !isEncrypted;

  const handleCopy = () => {
    navigator.clipboard.writeText(prompt.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSharePublicLink = () => {
    if (!prompt.currentTxId) return;
    const shareUrl = getPublicPromptShareLink(prompt.currentTxId);
    navigator.clipboard.writeText(shareUrl);
    setPublicLinkCopied(true);
    setTimeout(() => setPublicLinkCopied(false), 2000);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
        {/* Sticky Header */}
        <div className="flex-none px-6 pt-6 pb-4 border-b bg-background">
          <DialogHeader className="text-left">
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-2">
                <DialogTitle className="text-2xl text-left">{prompt.title}</DialogTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge
                    variant={isEncrypted ? "default" : "secondary"}
                    className="flex items-center gap-1"
                    title={isEncrypted
                      ? "This prompt is encrypted. Only your wallet can decrypt it."
                      : "This prompt is public. Anyone can read it on Arweave."}
                  >
                    {isPublic ? (
                      <>
                        <Globe className="h-3 w-3" />
                        <span className="text-xs">Public</span>
                      </>
                    ) : (
                      <>
                        <Lock className="h-3 w-3" />
                        <span className="text-xs">Encrypted</span>
                      </>
                    )}
                  </Badge>
                  {hasVersionHistory(prompt) && (
                    <Badge variant="secondary">
                      v{prompt.versions[prompt.versions.length - 1]?.version}
                    </Badge>
                  )}
                </div>
                {prompt.description && (
                  <p className="text-sm text-muted-foreground text-left">
                    {prompt.description}
                  </p>
                )}
              </div>
            </div>

            {/* Tags */}
            {prompt.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {prompt.tags.map(tag => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            {/* Metadata */}
            <div className="text-xs text-muted-foreground space-y-1 mt-3 text-left">
              <div>Created: {formatDate(prompt.createdAt)}</div>
              <div>Last updated: {formatDate(prompt.updatedAt)}</div>
              {prompt.currentTxId && (
                <div>
                  Arweave TxID:{' '}
                  <a
                    href={`https://viewblock.io/arweave/tx/${prompt.currentTxId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {prompt.currentTxId.slice(0, 8)}...{prompt.currentTxId.slice(-8)}
                  </a>
                </div>
              )}
            </div>
          </DialogHeader>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="rounded-md border bg-muted/50 p-4">
            <pre className="whitespace-pre-wrap font-mono text-sm">
              {prompt.content}
            </pre>
          </div>
        </div>

        {/* Sticky Actions */}
        <div className="flex gap-1 sm:gap-2 justify-end border-t pt-4 pb-4 px-4 sm:px-6 bg-background flex-shrink-0">
          <Button
            variant="outline"
            onClick={handleCopy}
            size="sm"
            className="flex-shrink-0"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Copy</span>
              </>
            )}
          </Button>

          {/* Only show share button for public prompts with TxID */}
          {isPublic && prompt.currentTxId && (
            <Button
              variant="outline"
              onClick={handleSharePublicLink}
              title="Copy public link (no wallet required)"
              size="sm"
              className="flex-shrink-0"
            >
              {publicLinkCopied ? (
                <>
                  <Check className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Link Copied!</span>
                </>
              ) : (
                <>
                  <Globe className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Share</span>
                </>
              )}
            </Button>
          )}

          {hasVersionHistory(prompt) && (
            <Button
              variant="outline"
              onClick={onShowVersions}
              title="View version history"
              size="sm"
              className="flex-shrink-0"
            >
              <History className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">History</span>
            </Button>
          )}

          <Button
            variant="outline"
            onClick={onEdit}
            size="sm"
            className="flex-shrink-0"
          >
            <Edit className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Edit</span>
          </Button>

          {!prompt.isArchived && (
            <Button
              variant="outline"
              onClick={() => {
                onArchive();
                onOpenChange(false);
              }}
              size="sm"
              className="flex-shrink-0"
            >
              <Archive className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Archive</span>
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}