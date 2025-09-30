import { useState, useEffect } from 'react';
import { Bookmark, Trash2, Play, Copy, Edit2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { getSavedSearches, deleteSavedSearch } from '@/lib/storage';
import { expressionToString } from '@/lib/boolean';
import type { SavedSearch } from '@/types/prompt';

interface SavedSearchesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLoad: (search: SavedSearch) => void;
  onEdit: (search: SavedSearch) => void;
}

export function SavedSearchesDialog({
  open,
  onOpenChange,
  onLoad,
  onEdit,
}: SavedSearchesDialogProps) {
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Load saved searches when dialog opens
  useEffect(() => {
    if (open) {
      const loaded = getSavedSearches();
      setSearches(loaded);
    }
  }, [open]);

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this saved search?')) {
      deleteSavedSearch(id);
      setSearches(searches.filter(s => s.id !== id));
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
      createdAt: Date.now(),
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
            Saved searches
          </DialogTitle>
          <DialogDescription className="text-sm">
            Manage and reuse your boolean filters.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-2 overflow-y-auto px-6 pb-6">
          {searches.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/70 bg-muted/40 py-10 text-center text-muted-foreground">
              <Bookmark className="mx-auto mb-3 h-10 w-10 opacity-50" />
              <p className="text-sm">No saved searches yet. Create one from the boolean builder.</p>
            </div>
          ) : (
            searches.map(search => (
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
                        title="Load this search"
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
                        title="Edit search"
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
                        title="Duplicate search"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(search.id);
                        }}
                        title="Delete search"
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
                    <span>Created {formatDate(search.createdAt)}</span>
                    {search.updatedAt !== search.createdAt && (
                      <span>• Updated {formatDate(search.updatedAt)}</span>
                    )}
                  </div>
                </div>
              </div>
            ))
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
