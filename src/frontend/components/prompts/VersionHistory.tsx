import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/frontend/components/ui/dialog';
import { Button } from '@/frontend/components/ui/button';
import { Badge } from '@/frontend/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/frontend/components/ui/tooltip';
import type { Prompt, PromptVersion } from '@/shared/types/prompt';
import { useState } from 'react';
import { fetchPrompt } from '@/backend/api/client';
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
  const [selectedVersionTxId, setSelectedVersionTxId] = useState<string | null>(null);
  const [selectedVersionContent, setSelectedVersionContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!prompt) return null;

  const handleViewVersion = async (version: PromptVersion) => {
    // Toggle off if clicking the same version
    if (selectedVersionTxId === version.txId) {
      setSelectedVersionTxId(null);
      setSelectedVersionContent(null);
      return;
    }

    setLoading(true);
    try {
      const versionPrompt = await fetchPrompt(version.txId);
      if (versionPrompt) {
        setSelectedVersionTxId(version.txId);
        setSelectedVersionContent(typeof versionPrompt.content === 'string' ? versionPrompt.content : 'Encrypted content');
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
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewVersion(version)}
                            disabled={loading}
                          >
                            <Eye className="mr-1 h-3 w-3" />
                            View
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>View version content</p>
                        </TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <a
                            href={`https://viewblock.io/arweave/tx/${version.txId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button size="sm" variant="outline">
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          </a>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>View on Arweave</p>
                        </TooltipContent>
                      </Tooltip>

                      {!isLatest && (
                        <Tooltip>
                          <TooltipTrigger asChild>
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
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Restore this version</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </TooltipProvider>
                  </div>
                </div>

                {/* Show version content if selected */}
                {selectedVersionTxId === version.txId && selectedVersionContent && (
                  <div className="mt-3 rounded-md border bg-muted/50 p-3">
                    <pre className="whitespace-pre-wrap font-mono text-xs max-h-40 overflow-y-auto">
                      {selectedVersionContent}
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