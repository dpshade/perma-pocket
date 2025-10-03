import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/frontend/components/ui/dialog';
import { Button } from '@/frontend/components/ui/button';
import { Badge } from '@/frontend/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/frontend/components/ui/tooltip';
import type { Prompt, PromptVersion } from '@/shared/types/prompt';
import { useState, useRef } from 'react';
import { fetchPrompt } from '@/backend/api/client';
import { ExternalLink, Eye } from 'lucide-react';

interface VersionHistoryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prompt: Prompt | null;
  onRestoreVersion: (version: PromptVersion) => void;
  password?: string;
}

interface VersionData {
  prompt: Prompt;
  previousPrompt?: Prompt;
}

export function VersionHistory({
  open,
  onOpenChange,
  prompt,
  onRestoreVersion,
  password,
}: VersionHistoryProps) {
  const [selectedVersionTxId, setSelectedVersionTxId] = useState<string | null>(null);
  const [selectedVersionData, setSelectedVersionData] = useState<VersionData | null>(null);
  const [loading, setLoading] = useState(false);

  // Cache for fetched version data to avoid redundant network requests
  const versionCacheRef = useRef<Map<string, Prompt>>(new Map());

  if (!prompt) return null;

  // Deduplicate versions - keep only the latest transaction for each version number
  const uniqueVersions = prompt.versions.reduce((acc: PromptVersion[], curr: PromptVersion) => {
    const existingIndex = acc.findIndex(v => v.version === curr.version);
    if (existingIndex === -1) {
      // New version number, add it
      acc.push(curr);
    } else {
      // Duplicate version number, keep the one with the latest timestamp
      if (curr.timestamp > acc[existingIndex].timestamp) {
        acc[existingIndex] = curr;
      }
    }
    return acc;
  }, []);

  const handleViewVersion = async (version: PromptVersion, index: number) => {
    // Toggle off if clicking the same version
    if (selectedVersionTxId === version.txId) {
      setSelectedVersionTxId(null);
      setSelectedVersionData(null);
      return;
    }

    setLoading(true);
    try {
      const cache = versionCacheRef.current;

      // Helper to get version from cache or fetch
      const getVersion = async (txId: string): Promise<Prompt | null> => {
        // Check cache first
        if (cache.has(txId)) {
          return cache.get(txId)!;
        }

        // If it's the current version, use the prompt prop (already available)
        if (txId === prompt.currentTxId) {
          cache.set(txId, prompt);
          return prompt;
        }

        // Fetch from network
        const fetched = await fetchPrompt(txId, password);
        if (fetched) {
          cache.set(txId, fetched);
        }
        return fetched;
      };

      // Prepare fetch operations
      const fetchOperations: [Promise<Prompt | null>, Promise<Prompt | null> | null] = [
        getVersion(version.txId),
        null,
      ];

      // Fetch previous version for comparison (if not first version)
      if (index > 0) {
        const prevVersion = uniqueVersions[index - 1];
        fetchOperations[1] = getVersion(prevVersion.txId);
      }

      // Execute fetches in parallel
      const [versionPrompt, previousPrompt] = await Promise.all([
        fetchOperations[0],
        fetchOperations[1] || Promise.resolve(null),
      ]);

      if (!versionPrompt) {
        setSelectedVersionTxId(version.txId);
        setSelectedVersionData(null);
        return;
      }

      setSelectedVersionTxId(version.txId);
      setSelectedVersionData({
        prompt: versionPrompt,
        previousPrompt: previousPrompt || undefined,
      });
    } catch (error) {
      console.error('Failed to load version:', error);
      setSelectedVersionTxId(version.txId);
      setSelectedVersionData(null);
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

  // Helper to detect what changed
  const getChanges = (current: Prompt, previous?: Prompt) => {
    if (!previous) {
      return { type: 'initial' as const };
    }

    const changes: string[] = [];
    if (current.title !== previous.title) changes.push('title');
    if (current.description !== previous.description) changes.push('description');
    if (current.content !== previous.content) changes.push('content');

    // Compare tags
    const currentTags = [...current.tags].sort().join(',');
    const prevTags = [...previous.tags].sort().join(',');
    if (currentTags !== prevTags) changes.push('tags');

    if (current.isArchived !== previous.isArchived) {
      changes.push(current.isArchived ? 'archived' : 'unarchived');
    }

    return {
      type: 'update' as const,
      changes,
      contentChanged: changes.includes('content'),
      metadataOnly: changes.length > 0 && !changes.includes('content'),
    };
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

        <div className="space-y-4">
          {uniqueVersions.map((version, index) => {
            const isLatest = index === uniqueVersions.length - 1;
            return (
              <div
                key={version.txId}
                className="border rounded-xl p-4 space-y-3"
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
                            onClick={() => handleViewVersion(version, index)}
                            disabled={loading}
                          >
                            <Eye className="mr-1 h-3 w-3" />
                            {index === 0 ? 'View' : 'View Changes'}
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

                {/* Show version changes if selected */}
                {selectedVersionTxId === version.txId && selectedVersionData && (
                  <div className="mt-3 space-y-3">
                    {(() => {
                      const { prompt: currentVersion, previousPrompt } = selectedVersionData;
                      const changes = getChanges(currentVersion, previousPrompt);

                      if (typeof currentVersion.content !== 'string') {
                        return (
                          <div className="rounded-md border border-yellow-600/30 bg-yellow-500/10 p-3 text-sm text-yellow-700 dark:text-yellow-300">
                            ⚠ Failed to decrypt this version
                          </div>
                        );
                      }

                      return (
                        <>
                          {/* Metadata Changes */}
                          {changes.type === 'update' && changes.changes.length > 0 && (
                            <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                              <div className="text-xs font-semibold text-muted-foreground">
                                Changes in this version:
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {changes.changes.map(change => (
                                  <Badge key={change} variant="secondary" className="text-xs">
                                    {change}
                                  </Badge>
                                ))}
                              </div>

                              {/* Title change */}
                              {changes.changes.includes('title') && previousPrompt && (
                                <div className="text-xs space-y-1">
                                  <div className="text-muted-foreground">Title:</div>
                                  <div className="flex gap-2 items-start">
                                    <div className="flex-1 rounded bg-red-500/10 px-2 py-1 line-through text-red-600 dark:text-red-400">
                                      {previousPrompt.title}
                                    </div>
                                    <div className="flex-1 rounded bg-green-500/10 px-2 py-1 text-green-600 dark:text-green-400">
                                      {currentVersion.title}
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Description change */}
                              {changes.changes.includes('description') && previousPrompt && (
                                <div className="text-xs space-y-1">
                                  <div className="text-muted-foreground">Description:</div>
                                  <div className="flex gap-2 items-start">
                                    <div className="flex-1 rounded bg-red-500/10 px-2 py-1 line-through text-red-600 dark:text-red-400">
                                      {previousPrompt.description || '(empty)'}
                                    </div>
                                    <div className="flex-1 rounded bg-green-500/10 px-2 py-1 text-green-600 dark:text-green-400">
                                      {currentVersion.description || '(empty)'}
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Tags change */}
                              {changes.changes.includes('tags') && previousPrompt && (
                                <div className="text-xs space-y-1">
                                  <div className="text-muted-foreground">Tags:</div>
                                  <div className="flex gap-2 items-start">
                                    <div className="flex-1 rounded bg-red-500/10 px-2 py-1">
                                      {previousPrompt.tags.map(tag => (
                                        <Badge key={tag} variant="outline" className="mr-1 text-xs line-through text-red-600 dark:text-red-400">
                                          {tag}
                                        </Badge>
                                      ))}
                                    </div>
                                    <div className="flex-1 rounded bg-green-500/10 px-2 py-1">
                                      {currentVersion.tags.map(tag => (
                                        <Badge key={tag} variant="outline" className="mr-1 text-xs text-green-600 dark:text-green-400">
                                          {tag}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Content Display/Diff */}
                          {changes.type === 'initial' || !changes.metadataOnly ? (
                            <div className="rounded-md border bg-muted/50 p-3">
                              <div className="text-xs font-semibold text-muted-foreground mb-2">
                                {changes.type === 'initial' ? 'Initial Content:' : 'Content:'}
                              </div>
                              <pre className="whitespace-pre-wrap font-mono text-xs max-h-60 overflow-y-auto">
                                {currentVersion.content}
                              </pre>
                            </div>
                          ) : (
                            <div className="rounded-md border border-blue-500/30 bg-blue-500/10 p-3 text-xs text-blue-700 dark:text-blue-300">
                              ℹ️ Metadata-only update (content unchanged)
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}
                {selectedVersionTxId === version.txId && !selectedVersionData && !loading && (
                  <div className="mt-3 rounded-md border border-red-600/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">
                    ⚠ Failed to load this version
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