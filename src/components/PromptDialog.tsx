import { Copy, Edit, Archive, History, Check, Lock, Globe } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Prompt } from '@/types/prompt';
import { useState } from 'react';
import { isPromptEncrypted } from '@/lib/encryption';

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

  if (!prompt) return null;

  const isEncrypted = isPromptEncrypted(prompt.content);
  const isPublic = !isEncrypted;

  const handleCopy = () => {
    navigator.clipboard.writeText(prompt.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <DialogTitle className="text-2xl">{prompt.title}</DialogTitle>
                <span title={isPublic ? "Public prompt" : "Encrypted prompt"}>
                  {isPublic ? (
                    <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  ) : (
                    <Lock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  )}
                </span>
              </div>
              {prompt.description && (
                <p className="text-sm text-muted-foreground mt-2">
                  {prompt.description}
                </p>
              )}
            </div>
            {prompt.versions.length > 1 && (
              <Badge variant="secondary">
                v{prompt.versions.length}
              </Badge>
            )}
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
          <div className="text-xs text-muted-foreground space-y-1 mt-3">
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

        {/* Content */}
        <div className="py-4">
          <div className="rounded-md border bg-muted/50 p-4">
            <pre className="whitespace-pre-wrap font-mono text-sm">
              {prompt.content}
            </pre>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end border-t pt-4">
          <Button
            variant="outline"
            onClick={handleCopy}
          >
            {copied ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="mr-2 h-4 w-4" />
                Copy
              </>
            )}
          </Button>

          {prompt.versions.length > 1 && (
            <Button
              variant="outline"
              onClick={onShowVersions}
            >
              <History className="mr-2 h-4 w-4" />
              Version History
            </Button>
          )}

          <Button
            variant="outline"
            onClick={onEdit}
          >
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>

          {!prompt.isArchived && (
            <Button
              variant="outline"
              onClick={() => {
                onArchive();
                onOpenChange(false);
              }}
            >
              <Archive className="mr-2 h-4 w-4" />
              Archive
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}