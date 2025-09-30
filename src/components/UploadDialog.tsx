import { useState, useRef, useEffect } from 'react';
import type { DragEvent } from 'react';
import { Upload, FolderUp, FileText, CheckCircle, AlertCircle, ArrowLeft, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { importMarkdownDirectory, type FileImportResult } from '@/lib/import';
import { estimatePromptUploadSize, formatBytes, getSizeWarningLevel } from '@/lib/fileSize';

interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (selectedPrompts: FileImportResult[]) => Promise<void>;
  existingPromptIds: string[];
}

export function UploadDialog({ open, onOpenChange, onImport, existingPromptIds }: UploadDialogProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [preview, setPreview] = useState<FileImportResult[] | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [fileSizes, setFileSizes] = useState<Map<string, number>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setPreview(null);
    setSelectedIds(new Set());
    setFileSizes(new Map());
    setIsProcessing(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (folderInputRef.current) folderInputRef.current.value = '';
  };

  // Calculate file sizes when preview changes
  useEffect(() => {
    if (!preview) return;

    const calculateSizes = async () => {
      const sizeMap = new Map<string, number>();

      for (const result of preview) {
        if (result.success && result.prompt) {
          // Estimate size (fast, doesn't require wallet connection)
          const estimatedSize = estimatePromptUploadSize(result.prompt);
          sizeMap.set(result.prompt.id, estimatedSize);
        }
      }

      setFileSizes(sizeMap);
    };

    calculateSizes();
  }, [preview]);

  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const items = Array.from(e.dataTransfer.items);
    if (items.length === 0) return;

    setIsProcessing(true);

    try {
      // Collect all files (including from folders)
      const files: File[] = [];

      for (const item of items) {
        if (item.kind === 'file') {
          const entry = item.webkitGetAsEntry();
          if (entry) {
            await collectFiles(entry, files);
          }
        }
      }

      if (files.length === 0) {
        alert('No markdown files found in the dropped items.');
        setIsProcessing(false);
        return;
      }

      // Create a FileList-like object and process
      const fileList = createFileList(files);
      await processFiles(fileList);
    } catch (error) {
      alert(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsProcessing(false);
    }
  };

  const collectFiles = async (entry: any, files: File[]): Promise<void> => {
    if (entry.isFile) {
      const file = await new Promise<File>((resolve) => {
        entry.file((f: File) => resolve(f));
      });
      if (file.name.endsWith('.md')) {
        files.push(file);
      }
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      const entries = await new Promise<any[]>((resolve) => {
        reader.readEntries((e: any[]) => resolve(e));
      });
      for (const childEntry of entries) {
        await collectFiles(childEntry, files);
      }
    }
  };

  const createFileList = (files: File[]): FileList => {
    const dataTransfer = new DataTransfer();
    files.forEach(file => dataTransfer.items.add(file));
    return dataTransfer.files;
  };

  const processFiles = async (files: FileList) => {
    const batchResult = await importMarkdownDirectory(files);

    if (batchResult.total === 0) {
      alert('No markdown files found.');
      setIsProcessing(false);
      return;
    }

    // Show preview with all successful parses
    setPreview(batchResult.results);

    // Auto-select all successfully parsed prompts
    const validIds = new Set(
      batchResult.results
        .filter(r => r.success && r.prompt)
        .map(r => r.prompt!.id)
    );
    setSelectedIds(validIds);
    setIsProcessing(false);
  };

  const handleFileSelect = async () => {
    const files = fileInputRef.current?.files;
    if (!files || files.length === 0) return;
    setIsProcessing(true);
    await processFiles(files);
  };

  const handleFolderSelect = async () => {
    const files = folderInputRef.current?.files;
    if (!files || files.length === 0) return;
    setIsProcessing(true);
    await processFiles(files);
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

  const handleImport = async () => {
    if (!preview) return;

    const selectedPrompts = preview.filter(
      p => p.success && p.prompt && selectedIds.has(p.prompt.id)
    );

    if (selectedPrompts.length === 0) {
      alert('No prompts selected for import.');
      return;
    }

    setIsProcessing(true);

    try {
      await onImport(selectedPrompts);
      resetState();
      onOpenChange(false);
    } catch (error) {
      alert(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBack = () => {
    resetState();
  };

  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };

  // Preview mode
  if (preview) {
    const successCount = preview.filter(p => p.success).length;
    const errorCount = preview.filter(p => !p.success).length;
    const selectedCount = selectedIds.size;
    const newCount = preview.filter(p =>
      p.success && p.prompt && !existingPromptIds.includes(p.prompt.id) && selectedIds.has(p.prompt.id)
    ).length;
    const updateCount = preview.filter(p =>
      p.success && p.prompt && existingPromptIds.includes(p.prompt.id) && selectedIds.has(p.prompt.id)
    ).length;

    // Calculate total size of selected prompts
    const totalSize = Array.from(selectedIds).reduce((sum, id) => {
      return sum + (fileSizes.get(id) || 0);
    }, 0);

    // Count size warnings
    const oversizedCount = Array.from(selectedIds).filter(id => {
      const size = fileSizes.get(id) || 0;
      return size > 102400; // 100 KiB
    }).length;

    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Review Prompts ({successCount} parsed, {selectedCount} selected)</span>
              <Button variant="ghost" size="sm" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </DialogTitle>
          </DialogHeader>

          {/* Stats */}
          <div className="flex gap-2 flex-wrap">
            {newCount > 0 && (
              <Badge variant="default">{newCount} new</Badge>
            )}
            {updateCount > 0 && (
              <Badge variant="secondary">{updateCount} updates</Badge>
            )}
            {errorCount > 0 && (
              <Badge variant="destructive">{errorCount} errors</Badge>
            )}
            <Badge variant="outline" className="bg-muted">
              Total: {formatBytes(totalSize)}
            </Badge>
            {oversizedCount > 0 && (
              <Badge variant="destructive" className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {oversizedCount} over 100 KiB
              </Badge>
            )}
          </div>

          {/* Prompt List */}
          <div className="flex-1 overflow-y-auto space-y-2 min-h-[300px] max-h-[500px] border rounded-lg p-4">
            {preview.map((result, index) => {
              const isSelected = result.prompt && selectedIds.has(result.prompt.id);
              const willUpdate = result.prompt && existingPromptIds.includes(result.prompt.id);
              const fileSize = result.prompt ? fileSizes.get(result.prompt.id) : undefined;
              const sizeWarning = fileSize ? getSizeWarningLevel(fileSize) : 'ok';

              return (
                <div
                  key={index}
                  className={`
                    rounded-lg border p-4 transition-all cursor-pointer
                    ${result.success
                      ? isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-background hover:border-primary/50'
                      : 'border-destructive/50 bg-destructive/5'
                    }
                  `}
                  onClick={() => result.success && result.prompt && toggleSelection(result.prompt.id)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={!result.success}
                          onChange={() => {}}
                          className="h-4 w-4"
                        />
                        <h4 className="font-medium truncate">
                          {result.success && result.prompt ? result.prompt.title : result.fileName}
                        </h4>
                      </div>

                      {result.success && result.prompt ? (
                        <div className="mt-2 space-y-1">
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {result.prompt.description || 'No description'}
                          </p>
                          <div className="flex flex-wrap gap-1 items-center">
                            <code className="text-xs bg-muted px-1 py-0.5 rounded">
                              {result.prompt.id}
                            </code>
                            {result.prompt.tags.map(tag => (
                              <Badge key={tag} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                          <div className="flex flex-wrap gap-1 items-center">
                            {willUpdate && (
                              <Badge variant="secondary" className="text-xs">
                                Will update existing
                              </Badge>
                            )}
                            {fileSize !== undefined && (
                              <Badge
                                variant={sizeWarning === 'error' ? 'destructive' : sizeWarning === 'warning' ? 'default' : 'outline'}
                                className={`text-xs ${sizeWarning === 'warning' ? 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 border-yellow-500/30' : ''}`}
                              >
                                {formatBytes(fileSize)}
                                {sizeWarning === 'error' && ' (requires credits)'}
                                {sizeWarning === 'warning' && ' (near limit)'}
                                {sizeWarning === 'ok' && ' (free)'}
                              </Badge>
                            )}
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-destructive mt-1">{result.error}</p>
                      )}
                    </div>

                    <div className="flex-shrink-0">
                      {result.success ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-destructive" />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Actions */}
          <div className="flex justify-between items-center border-t pt-4">
            <div className="text-sm text-muted-foreground">
              {selectedCount} of {successCount} prompts selected
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleImport}
                disabled={selectedCount === 0 || isProcessing}
              >
                {isProcessing ? 'Importing...' : `Import ${selectedCount} Prompt${selectedCount !== 1 ? 's' : ''}`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Upload mode
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upload Prompts</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Drag and Drop Zone */}
          <div
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className={`
              relative border-2 border-dashed rounded-lg p-12 transition-colors
              ${isDragging
                ? 'border-primary bg-primary/5'
                : 'border-border bg-muted/30 hover:border-primary/50'
              }
              ${isProcessing ? 'opacity-50 pointer-events-none' : ''}
            `}
          >
            <div className="flex flex-col items-center justify-center gap-4 text-center">
              <div className="rounded-full bg-primary/10 p-4">
                <Upload className="h-8 w-8 text-primary" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">
                  {isProcessing ? 'Processing files...' : 'Drag and drop multiple files or folders here'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  Supports .md files with frontmatter • Drop multiple files at once
                </p>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or</span>
            </div>
          </div>

          {/* Manual Selection Buttons */}
          <div className="grid grid-cols-2 gap-4">
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className="h-24 flex flex-col gap-2"
            >
              <FileText className="h-6 w-6" />
              <div className="space-y-0.5">
                <div className="font-medium">Select Files</div>
                <div className="text-xs text-muted-foreground">Multiple selection</div>
              </div>
            </Button>

            <Button
              variant="outline"
              onClick={() => folderInputRef.current?.click()}
              disabled={isProcessing}
              className="h-24 flex flex-col gap-2"
            >
              <FolderUp className="h-6 w-6" />
              <div className="space-y-0.5">
                <div className="font-medium">Select Folder</div>
                <div className="text-xs text-muted-foreground">All .md files</div>
              </div>
            </Button>
          </div>

          {/* Hidden File Inputs */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".md"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          <input
            ref={folderInputRef}
            type="file"
            {...({ webkitdirectory: '', directory: '' } as any)}
            onChange={handleFolderSelect}
            className="hidden"
          />

          {/* Info */}
          <div className="rounded-lg border border-border/50 bg-muted/30 p-4 space-y-2">
            <div className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm">Preview prompts before importing</p>
            </div>
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm">Files must have valid frontmatter with <code className="text-xs bg-muted px-1 py-0.5 rounded">id</code> and <code className="text-xs bg-muted px-1 py-0.5 rounded">title</code> fields</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
