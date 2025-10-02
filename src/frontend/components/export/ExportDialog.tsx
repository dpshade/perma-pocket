/**
 * ExportDialog - Export prompts as Arweave path manifest
 * Multi-stage: Selection → Config → Warnings → Upload → Complete
 */

import { useState, useMemo, useEffect } from 'react';
import { Package, AlertTriangle, Lock, Unlock, CheckCircle, AlertCircle, Search, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/frontend/components/ui/dialog';
import { Button } from '@/frontend/components/ui/button';
import { Input } from '@/frontend/components/ui/input';
import { Textarea } from '@/frontend/components/ui/textarea';
import { Badge } from '@/frontend/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/frontend/components/ui/alert';
import type { Prompt } from '@/shared/types/prompt';
import type { ExportConfig } from '@/shared/types/manifest';
import { shouldEncrypt } from '@/core/encryption/crypto';
import { exportPromptsAsManifest, getWalletAddress } from '@/backend/api/export';
import { searchPrompts } from '@/core/search';

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allPrompts: Prompt[];
  arweaveWallet: any;
  password?: string;
}

type ExportStage = 'selection' | 'config' | 'warning' | 'uploading' | 'complete';

export function ExportDialog({
  open,
  onOpenChange,
  allPrompts,
  arweaveWallet,
  password,
}: ExportDialogProps) {
  const [stage, setStage] = useState<ExportStage>('selection');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [collectionName, setCollectionName] = useState('');
  const [description, setDescription] = useState('');
  const [includeEncrypted, setIncludeEncrypted] = useState(true);
  const [exportProgress, setExportProgress] = useState<{
    stage: string;
    current: number;
    total: number;
    message: string;
  } | null>(null);
  const [manifestTxId, setManifestTxId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Filter prompts based on search
  const filteredPrompts = useMemo(() => {
    if (!searchQuery) return allPrompts.filter(p => !p.isArchived);

    const searchResults = searchPrompts(searchQuery);
    const resultIds = new Set(searchResults.map(r => r.id));
    return allPrompts.filter(p => !p.isArchived && resultIds.has(p.id));
  }, [allPrompts, searchQuery]);

  // Get selected prompts
  const selectedPrompts = useMemo(() => {
    return allPrompts.filter(p => selectedIds.has(p.id));
  }, [allPrompts, selectedIds]);

  // Count encryption status
  const encryptedCount = selectedPrompts.filter(p => shouldEncrypt(p.tags)).length;
  const publicCount = selectedPrompts.length - encryptedCount;

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setStage('selection');
      setSearchQuery('');
      setSelectedIds(new Set());
      setCollectionName('');
      setDescription('');
      setIncludeEncrypted(true);
      setExportProgress(null);
      setManifestTxId(null);
      setError(null);
    }
  }, [open]);

  const handleClose = () => {
    if (stage !== 'uploading') {
      onOpenChange(false);
    }
  };

  const toggleSelection = (id: string) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedIds(newSelection);
  };

  const selectAll = () => {
    const allIds = new Set(filteredPrompts.map(p => p.id));
    setSelectedIds(allIds);
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleContinueToConfig = () => {
    if (selectedIds.size === 0) {
      setError('Please select at least one prompt to export');
      return;
    }
    setError(null);
    setStage('config');
  };

  const handleContinueToWarning = () => {
    if (!collectionName.trim()) {
      setError('Collection name is required');
      return;
    }

    if (encryptedCount > 0 && includeEncrypted) {
      setStage('warning');
    } else {
      handleExport();
    }
  };

  const handleRemoveEncrypted = () => {
    const publicIds = new Set(
      selectedPrompts
        .filter(p => !shouldEncrypt(p.tags))
        .map(p => p.id)
    );
    setSelectedIds(publicIds);
    setStage('config');
  };

  const handleExport = async () => {
    setStage('uploading');
    setError(null);
    setExportProgress(null);

    try {
      const walletAddress = await getWalletAddress(arweaveWallet);

      const config: ExportConfig = {
        collectionName: collectionName.trim(),
        description: description.trim() || undefined,
        includeEncrypted,
        sourceType: 'manual',
      };

      const result = await exportPromptsAsManifest(
        selectedPrompts,
        config,
        walletAddress,
        arweaveWallet,
        password,
        (stage, current, total, message) => {
          setExportProgress({ stage, current, total, message });
        }
      );

      if (!result.success) {
        throw new Error(result.error || 'Export failed');
      }

      setManifestTxId(result.manifestTxId || null);
      setStage('complete');
    } catch (error) {
      console.error('[Export Dialog] Export failed:', error);
      setError(error instanceof Error ? error.message : 'Export failed');
      setStage('config');
    }
  };

  const renderSelection = () => (
    <div className="flex flex-col h-full max-h-[70vh]">
      {/* Experimental notice */}
      <Alert className="mb-4 border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950">
        <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <AlertTitle className="text-blue-900 dark:text-blue-100">Experimental Feature</AlertTitle>
        <AlertDescription className="text-blue-800 dark:text-blue-200">
          This export feature is currently in beta. Please test thoroughly before relying on it for critical workflows.
        </AlertDescription>
      </Alert>

      {/* Search and selection controls */}
      <div className="flex-none space-y-3 pb-4 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search prompts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-9"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={selectAll}>
              Select All ({filteredPrompts.length})
            </Button>
            {selectedIds.size > 0 && (
              <Button size="sm" variant="outline" onClick={clearSelection}>
                Clear Selection
              </Button>
            )}
          </div>
          <Badge variant="secondary">
            {selectedIds.size} selected
          </Badge>
        </div>
      </div>

      {/* Prompt list */}
      <div className="flex-1 overflow-y-auto space-y-2 py-4">
        {filteredPrompts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {searchQuery ? 'No prompts match your search' : 'No prompts available'}
          </div>
        ) : (
          filteredPrompts.map((prompt) => {
            const isSelected = selectedIds.has(prompt.id);
            const isEncrypted = shouldEncrypt(prompt.tags);

            return (
              <div
                key={prompt.id}
                onClick={() => toggleSelection(prompt.id)}
                className={`
                  rounded-lg border p-3 cursor-pointer transition-all
                  ${isSelected
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                  }
                `}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}}
                    className="mt-1 h-4 w-4"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium truncate">{prompt.title}</h4>
                      {isEncrypted ? (
                        <Lock className="h-3 w-3 text-amber-600 flex-shrink-0" />
                      ) : (
                        <Unlock className="h-3 w-3 text-green-600 flex-shrink-0" />
                      )}
                    </div>
                    {prompt.description && (
                      <p className="text-sm text-muted-foreground line-clamp-1 mt-1">
                        {prompt.description}
                      </p>
                    )}
                    {prompt.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {prompt.tags.slice(0, 3).map(tag => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {prompt.tags.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{prompt.tags.length - 3}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Error message */}
      {error && (
        <Alert variant="destructive" className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Actions */}
      <div className="flex-none pt-4 border-t flex justify-between items-center">
        <div className="text-sm text-muted-foreground">
          {selectedIds.size} prompt{selectedIds.size !== 1 ? 's' : ''} selected
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleContinueToConfig} disabled={selectedIds.size === 0}>
            Continue
          </Button>
        </div>
      </div>
    </div>
  );

  const renderConfig = () => (
    <div className="space-y-4">
      {/* Collection Name */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Collection Name</label>
        <Input
          placeholder="e.g., React Components Library"
          value={collectionName}
          onChange={(e) => {
            setCollectionName(e.target.value);
            setError(null);
          }}
          maxLength={100}
          autoFocus
        />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Description (Optional)</label>
        <Textarea
          placeholder="Describe this collection..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={500}
          rows={3}
        />
      </div>

      {/* Statistics */}
      <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
        <div className="text-sm font-medium">Export Summary</div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{selectedPrompts.length} total prompts</Badge>
          {publicCount > 0 && (
            <Badge variant="outline" className="flex items-center gap-1">
              <Unlock className="h-3 w-3" />
              {publicCount} public
            </Badge>
          )}
          {encryptedCount > 0 && (
            <Badge variant="outline" className="flex items-center gap-1">
              <Lock className="h-3 w-3" />
              {encryptedCount} encrypted
            </Badge>
          )}
        </div>
      </div>

      {/* Encryption Warning */}
      {encryptedCount > 0 && (
        <Alert variant="default" className="border-amber-500/30 bg-amber-500/5">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-600">Encrypted Content Detected</AlertTitle>
          <AlertDescription className="text-sm text-muted-foreground">
            {encryptedCount} prompt{encryptedCount === 1 ? '' : 's'} will be encrypted in the manifest.
            Recipients will need your encryption key to access the content.
            <div className="mt-2 flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleRemoveEncrypted}
              >
                Export Public Only ({publicCount})
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Actions */}
      <div className="flex justify-between items-center pt-4">
        <Button variant="outline" onClick={() => setStage('selection')}>
          Back
        </Button>
        <Button onClick={handleContinueToWarning} disabled={!collectionName.trim()}>
          Continue
        </Button>
      </div>
    </div>
  );

  const renderWarning = () => {
    const encryptedPromptsList = selectedPrompts.filter(p => shouldEncrypt(p.tags));

    return (
      <div className="space-y-4">
        {/* Critical Warning */}
        <Alert variant="destructive">
          <AlertTriangle className="h-5 w-5" />
          <AlertTitle className="text-lg">Privacy & Encryption Warning</AlertTitle>
          <AlertDescription className="space-y-3 mt-2">
            <p className="font-medium">
              You are exporting {encryptedCount} encrypted prompt{encryptedCount === 1 ? '' : 's'}.
            </p>

            <div className="space-y-2 text-sm">
              <p>⚠️ <strong>What will be visible to everyone:</strong></p>
              <ul className="list-disc list-inside pl-2 space-y-1">
                <li>Prompt titles and descriptions</li>
                <li>Tag organization</li>
                <li>Folder structure</li>
                <li>Number of prompts</li>
              </ul>
            </div>

            <div className="space-y-2 text-sm">
              <p>🔒 <strong>What requires encryption key:</strong></p>
              <ul className="list-disc list-inside pl-2 space-y-1">
                <li>Actual prompt content (encrypted)</li>
              </ul>
            </div>

            <div className="rounded-lg bg-background/50 p-3 space-y-2 text-sm">
              <p className="font-medium">To make prompts fully public and shareable:</p>
              <ol className="list-decimal list-inside pl-2 space-y-1">
                <li>Add "public" tag to each prompt</li>
                <li>Re-upload prompts to Arweave</li>
                <li>Export again</li>
              </ol>
            </div>
          </AlertDescription>
        </Alert>

        {/* Encrypted Prompts List */}
        <div className="max-h-48 overflow-y-auto rounded-lg border border-border p-4 space-y-2">
          <div className="text-sm font-medium mb-2">Encrypted Prompts:</div>
          {encryptedPromptsList.slice(0, 10).map((prompt) => (
            <div key={prompt.id} className="flex items-start gap-2 text-sm">
              <Lock className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <span className="truncate">{prompt.title}</span>
            </div>
          ))}
          {encryptedPromptsList.length > 10 && (
            <div className="text-xs text-muted-foreground">
              ... and {encryptedPromptsList.length - 10} more
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setStage('config')} className="flex-1">
            Back
          </Button>
          <Button
            variant="outline"
            onClick={handleRemoveEncrypted}
            className="flex-1"
          >
            Remove Encrypted
          </Button>
          <Button onClick={handleExport} className="flex-1">
            Export Anyway
          </Button>
        </div>
      </div>
    );
  };

  const renderUploading = () => (
    <div className="space-y-4">
      <div className="flex flex-col items-center justify-center py-8 gap-4">
        <div className="rounded-full bg-primary/10 p-4 animate-pulse">
          <Package className="h-8 w-8 text-primary" />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-semibold">Exporting Collection...</h3>
          <p className="text-sm text-muted-foreground mt-1">
            This may take a few moments
          </p>
        </div>
      </div>

      {exportProgress && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{exportProgress.message}</span>
            <span className="text-muted-foreground">
              {exportProgress.current} / {exportProgress.total}
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all"
              style={{
                width: `${(exportProgress.current / exportProgress.total) * 100}%`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );

  const renderComplete = () => (
    <div className="space-y-4">
      <div className="flex flex-col items-center justify-center py-8 gap-4">
        <div className="rounded-full bg-green-500/10 p-4">
          <CheckCircle className="h-8 w-8 text-green-500" />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-semibold">Export Complete!</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Your collection has been uploaded to Arweave
          </p>
        </div>
      </div>

      {manifestTxId && (
        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
          <div className="text-sm font-medium">Share this manifest:</div>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-muted px-3 py-2 rounded font-mono break-all">
              {manifestTxId}
            </code>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(manifestTxId);
              }}
            >
              Copy
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Share this transaction ID with others to let them import your collection
          </p>
        </div>
      )}

      <Button onClick={handleClose} className="w-full">
        Done
      </Button>
    </div>
  );

  const getDialogTitle = () => {
    switch (stage) {
      case 'selection':
        return 'Select Prompts to Export';
      case 'config':
        return 'Configure Collection';
      case 'warning':
        return 'Privacy Warning';
      case 'uploading':
        return 'Exporting...';
      case 'complete':
        return 'Export Complete';
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={`max-w-2xl ${stage === 'selection' ? 'max-h-[85vh]' : ''}`}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {getDialogTitle()}
          </DialogTitle>
        </DialogHeader>

        {stage === 'selection' && renderSelection()}
        {stage === 'config' && renderConfig()}
        {stage === 'warning' && renderWarning()}
        {stage === 'uploading' && renderUploading()}
        {stage === 'complete' && renderComplete()}
      </DialogContent>
    </Dialog>
  );
}
