import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Prompt, PromptVersion } from '@/types/prompt';
import { useState } from 'react';
import { fetchPrompt } from '@/lib/arweave';
import { ExternalLink, Eye } from 'lucide-react';

interface VersionHistoryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prompt: Prompt | null;
  onRestoreVersion: (version: PromptVersion) => void;
}

export function VersionHistory({
  open,
  onOpenChange,
  prompt,
  onRestoreVersion,
}: VersionHistoryProps) {
  const [selectedVersion, setSelectedVersion] = useState<Prompt | null>(null);
  const [loading, setLoading] = useState(false);

  if (!prompt) return null;

  const handleViewVersion = async (version: PromptVersion) => {
    setLoading(true);
    try {
      const versionPrompt = await fetchPrompt(version.txId);
      if (versionPrompt) {
        setSelectedVersion(versionPrompt);
      }
    } catch (error) {
      console.error('Failed to load version:', error);
    } finally {
      setLoading(false);
    }
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
          <DialogTitle>Version History: {prompt.title}</DialogTitle>
          <DialogDescription>
            View and restore previous versions of this prompt
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {prompt.versions.map((version, index) => {
            const isLatest = index === prompt.versions.length - 1;
            return (
              <div
                key={version.txId}
                className="border rounded-lg p-4 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Version {version.version}</span>
                      {isLatest && (
                        <Badge variant="default">Current</Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatDate(version.timestamp)}
                    </div>
                    {version.changeNote && (
                      <div className="text-sm italic text-muted-foreground">
                        "{version.changeNote}"
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleViewVersion(version)}
                      disabled={loading}
                    >
                      <Eye className="mr-1 h-3 w-3" />
                      View
                    </Button>

                    <a
                      href={`https://viewblock.io/arweave/tx/${version.txId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button size="sm" variant="outline">
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </a>

                    {!isLatest && (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => {
                          onRestoreVersion(version);
                          onOpenChange(false);
                        }}
                      >
                        Restore
                      </Button>
                    )}
                  </div>
                </div>

                {/* Show version content if selected */}
                {selectedVersion && selectedVersion.currentTxId === version.txId && (
                  <div className="mt-3 rounded-md border bg-muted/50 p-3">
                    <pre className="whitespace-pre-wrap font-mono text-xs max-h-40 overflow-y-auto">
                      {selectedVersion.content}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}