import { useState } from 'react';
import { Bookmark, Trash2, Play, Copy as CopyIcon, Edit2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { expressionToString } from '@/lib/boolean';
import type { SavedSearch } from '@/types/prompt';
import type { UseCollectionsReturn } from '@/hooks/useCollections';

interface SavedSearchesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLoad: (search: SavedSearch) => void;
  onEdit: (search: SavedSearch) => void;
  showDuplicates: boolean;
  setShowDuplicates: (show: boolean) => void;
  duplicateCount: number;
  collections: UseCollectionsReturn;
}

export function SavedSearchesDialog({
  open,
  onOpenChange,
  onLoad,
  onEdit,
  showDuplicates,
  setShowDuplicates,
  duplicateCount,
  collections: collectionsHook,
}: SavedSearchesDialogProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this collection?')) {
      collectionsHook.deleteCollection(id);
      if (selectedId === id) {
        setSelectedId(null);
      }
    }
  };

  const handleLoad = (search: SavedSearch) => {
    onLoad(search);
    onOpenChange(false);
  };

  const handleDuplicate = (search: SavedSearch) => {
    const duplicated: SavedSearch = {
      ...search,
      id: crypto.randomUUID(),
      name: `${search.name} (Copy)`,
      updatedAt: Date.now(),
    };
    onEdit(duplicated);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px] gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Bookmark className="h-4 w-4 text-primary" />
            Collections
          </DialogTitle>
          <DialogDescription className="text-sm">
            Save and organize your custom filters for quick access.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-3 overflow-y-auto px-6 pb-6">
          {/* Default Collections */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-1">
              Default Collections
            </h3>

            {/* Duplicates Collection */}
            <div
              className={`rounded-lg border bg-background/95 px-4 py-3 transition-colors cursor-pointer ${
                showDuplicates ? 'border-amber-500/60 ring-1 ring-amber-500/20 bg-amber-500/5' : 'border-border/70 hover:border-border'
              }`}
              onClick={() => {
                setShowDuplicates(!showDuplicates);
                onOpenChange(false);
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <CopyIcon className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <h3 className="text-sm font-semibold">Duplicates</h3>
                    {duplicateCount > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
                        {duplicateCount}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Find prompts with duplicate titles or content
                  </p>
                </div>
                <Button
                  variant={showDuplicates ? 'default' : 'outline'}
                  size="sm"
                  className="h-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDuplicates(!showDuplicates);
                    onOpenChange(false);
                  }}
                >
                  {showDuplicates ? 'Hide' : 'Show'}
                </Button>
              </div>
            </div>
          </div>

          {/* Saved Collections */}
          {collectionsHook.collections.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-1">
                Saved Collections
              </h3>
              {collectionsHook.collections.map((search) => (
                <div
                  key={search.id}
                  className={`rounded-lg border border-border/70 bg-background/95 px-4 py-3 transition-colors ${
                    selectedId === search.id ? 'border-primary/60 ring-1 ring-primary/20 bg-primary/5' : 'hover:border-border'
                  }`}
                  onClick={() => setSelectedId(search.id)}
                >
                <div className="space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="truncate text-sm font-semibold">{search.name}</h3>
                      {search.description && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {search.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleLoad(search);
                        }}
                        title="Load this collection"
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(search);
                        }}
                        title="Edit collection"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDuplicate(search);
                        }}
                        title="Duplicate collection"
                      >
                        <CopyIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(search.id);
                        }}
                        title="Delete collection"
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>

                  {/* Expression */}
                  <div className="space-y-1">
                    <code className="block rounded-md border border-border/60 bg-muted/50 px-3 py-1 text-xs">
                      {expressionToString(search.expression)}
                    </code>
                    {search.textQuery && (
                      <div className="text-xs text-muted-foreground">
                        Text filter: <span className="font-mono text-xs">{search.textQuery}</span>
                      </div>
                    )}
                  </div>

                  {/* Metadata */}
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span>Updated {formatDate(search.updatedAt)}</span>
                  </div>
                </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-border/70 px-6 py-4">
          <Button variant="outline" size="sm" className="h-9 px-4" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
