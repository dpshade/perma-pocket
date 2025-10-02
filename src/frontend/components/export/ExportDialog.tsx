/**
 * ExportDialog - Export prompts as Arweave path manifest
 * Includes critical encryption and privacy warnings
 */

import { useState } from 'react';
import { Package, AlertTriangle, Lock, Unlock, CheckCircle, AlertCircle } from 'lucide-react';
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

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prompts: Prompt[];
  arweaveWallet: any;
  password?: string;
  sourceFilter?: string;
  sourceType: 'filter' | 'collection' | 'manual';
}

type ExportStage = 'config' | 'warning' | 'uploading' | 'complete';

export function ExportDialog({
  open,
  onOpenChange,
  prompts,
  arweaveWallet,
  password,
  sourceFilter,
  sourceType,
}: ExportDialogProps) {
  const [stage, setStage] = useState<ExportStage>('config');
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

  // Count encryption status
  const encryptedPrompts = prompts.filter(p => shouldEncrypt(p.tags));
  const publicPrompts = prompts.filter(p => !shouldEncrypt(p.tags));
  const encryptedCount = encryptedPrompts.length;
  const publicCount = publicPrompts.length;

  const handleClose = () => {
    if (stage !== 'uploading') {
      setStage('config');
      setCollectionName('');
      setDescription('');
      setIncludeEncrypted(true);
      setExportProgress(null);
      setManifestTxId(null);
      setError(null);
      onOpenChange(false);
    }
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
    setIncludeEncrypted(false);
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
        sourceFilter,
        sourceType,
      };

      const result = await exportPromptsAsManifest(
        prompts,
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
          <Badge variant="outline">{prompts.length} total prompts</Badge>
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
        <Button variant="outline" onClick={handleClose}>
          Cancel
        </Button>
        <Button onClick={handleContinueToWarning} disabled={!collectionName.trim()}>
          Continue
        </Button>
      </div>
    </div>
  );

  const renderWarning = () => (
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
        {encryptedPrompts.slice(0, 10).map((prompt) => (
          <div key={prompt.id} className="flex items-start gap-2 text-sm">
            <Lock className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <span className="truncate">{prompt.title}</span>
          </div>
        ))}
        {encryptedPrompts.length > 10 && (
          <div className="text-xs text-muted-foreground">
            ... and {encryptedPrompts.length - 10} more
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
      case 'config':
        return 'Export Collection';
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {getDialogTitle()}
          </DialogTitle>
        </DialogHeader>

        {stage === 'config' && renderConfig()}
        {stage === 'warning' && renderWarning()}
        {stage === 'uploading' && renderUploading()}
        {stage === 'complete' && renderComplete()}
      </DialogContent>
    </Dialog>
  );
}
