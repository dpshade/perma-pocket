import { Search, X, Filter, Bookmark, Archive, LayoutGrid, List } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SavedSearchesDialog } from '@/components/SavedSearchesDialog';
import { usePrompts } from '@/hooks/usePrompts';
import { getAllTags } from '@/lib/search';
import { expressionToString } from '@/lib/boolean';
import { useState, useEffect, useRef } from 'react';
import type { BooleanExpression, SavedSearch } from '@/types/prompt';
import type { UseCollectionsReturn } from '@/hooks/useCollections';
import { BooleanBuilder } from '@/components/BooleanBuilder';
import { getDuplicateCount } from '@/lib/duplicates';

interface SearchBarProps {
  showArchived: boolean;
  setShowArchived: (show: boolean) => void;
  viewMode: 'list' | 'cards';
  onViewModeToggle: () => void;
  showDuplicates: boolean;
  setShowDuplicates: (show: boolean) => void;
  collections: UseCollectionsReturn;
}

export function SearchBar({ showArchived, setShowArchived, viewMode, onViewModeToggle, showDuplicates, setShowDuplicates, collections }: SearchBarProps) {
  const {
    prompts,
    searchQuery,
    setSearchQuery,
    selectedTags,
    toggleTag,
    clearFilters,
    booleanExpression,
    activeSavedSearch,
    setBooleanExpression,
    loadSavedSearch,
    clearBooleanSearch,
  } = usePrompts();
  const [allTags, setAllTags] = useState<string[]>([]);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [showBooleanBuilder, setShowBooleanBuilder] = useState(false);
  const [expressionText, setExpressionText] = useState('');
  const [savedSearchesDialogOpen, setSavedSearchesDialogOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const tags = getAllTags(prompts);
    setAllTags(tags);
  }, [prompts]);

  // Auto-focus search bar on mount
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Keyboard shortcuts: / and cmd+k/ctrl+k
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check if user is typing in an input or textarea
      const target = event.target as HTMLElement;
      const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

      // Handle / key (only when not already typing)
      if (event.key === '/' && !isTyping) {
        event.preventDefault();
        searchInputRef.current?.focus();
      }

      // Handle cmd+k or ctrl+k
      if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const hasActiveFilters = searchQuery.length > 0 || selectedTags.length > 0 || booleanExpression !== null;

  const handleLoadSavedSearch = (search: SavedSearch) => {
    loadSavedSearch(search);
  };

  const handleApplyExpression = (expression: BooleanExpression) => {
    setBooleanExpression(expression, searchQuery || undefined);
    setShowBooleanBuilder(false);
  };

  const tagLabel = allTags.length === 1 ? 'tag' : 'tags';
  const duplicateCount = getDuplicateCount(prompts);

  return (
    <div className="space-y-5">
      {hasActiveFilters && (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            className="h-9 px-3 text-sm"
            onClick={clearFilters}
          >
            Clear all filters
          </Button>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              type="text"
              placeholder={booleanExpression ? 'Additional text filter…' : 'Search prompts…'}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="h-10 w-full border-0 bg-muted/50 pl-11 pr-20 text-sm focus-visible:ring-0 focus-visible:bg-muted"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="rounded-full p-1 text-muted-foreground transition-all hover:text-foreground"
                  title="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              <Button
                variant={booleanExpression || showBooleanBuilder ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setShowBooleanBuilder((open) => !open)}
                className="h-7 w-7 p-0"
                title="Filter builder"
              >
                <Filter className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>

        {booleanExpression && (
          <div
            className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2 text-sm cursor-pointer hover:bg-primary/10 transition-colors"
            onClick={() => {
              setExpressionText(expressionToString(booleanExpression));
              setShowBooleanBuilder(true);
            }}
            title="Click to edit filter"
          >
            <Filter className="h-4 w-4 text-primary" />
            <div className="flex-1 min-w-0">
              {activeSavedSearch ? (
                <span className="font-medium text-primary">{activeSavedSearch.name}</span>
              ) : (
                <code className="truncate text-xs text-primary">{expressionToString(booleanExpression)}</code>
              )}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                clearBooleanSearch();
              }}
              className="rounded-full p-1 text-primary/70 transition-colors hover:text-primary"
              title="Remove filter"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {showBooleanBuilder && (
          <div className="animate-in fade-in slide-in-from-top-2">
            <BooleanBuilder
              allTags={allTags}
              prompts={prompts}
              searchQuery={searchQuery}
              expressionText={expressionText}
              onExpressionChange={setExpressionText}
              onApply={handleApplyExpression}
              onClose={() => setShowBooleanBuilder(false)}
              isOpen={showBooleanBuilder}
              collections={collections}
            />
          </div>
        )}
      </div>

      {!booleanExpression && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
            <button
              onClick={() => setShowTagSuggestions(!showTagSuggestions)}
              className="font-medium text-foreground transition-colors hover:text-primary pl-1"
            >
              {showTagSuggestions ? 'Hide tag filters' : 'Show tag filters'} ({allTags.length} {tagLabel})
            </button>
            <div className="flex items-center gap-2">
              {selectedTags.length > 0 && (
                <button
                  onClick={() => {
                    const tagsExpression = selectedTags.map(t => `"${t}"`).join(' AND ');
                    setExpressionText(tagsExpression);
                    setShowBooleanBuilder(true);
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
                  title="Click to edit filter"
                >
                  Filtering by {selectedTags.length} {selectedTags.length === 1 ? 'tag' : 'tags'}
                </button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSavedSearchesDialogOpen(true)}
                className="h-7 w-7 p-0 text-muted-foreground"
                title="Collections"
              >
                <Bookmark className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant={showArchived ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setShowArchived(!showArchived)}
                className={`h-7 w-7 p-0 ${showArchived ? '' : 'text-muted-foreground'}`}
                title={showArchived ? 'Hide archived' : 'Show archived'}
              >
                <Archive className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={onViewModeToggle}
                className="h-7 w-7 p-0"
                title={viewMode === 'list' ? 'Switch to cards view' : 'Switch to list view'}
              >
                {viewMode === 'list' ? (
                  <LayoutGrid className="h-4 w-4" />
                ) : (
                  <List className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {showTagSuggestions && (
            <div className="flex flex-wrap gap-2 rounded-xl border border-border/70 bg-muted/40 p-3">
              {allTags.length > 0 ? (
                allTags.map((tag) => (
                  <Badge
                    key={tag}
                    variant={selectedTags.includes(tag) ? 'default' : 'outline'}
                    className="cursor-pointer rounded-full px-3 text-xs transition-colors hover:bg-primary hover:text-primary-foreground"
                    onClick={() => toggleTag(tag)}
                  >
                    {tag}
                  </Badge>
                ))
              ) : (
                <div className="text-xs text-muted-foreground">No tags yet. Add tags to your prompts!</div>
              )}
            </div>
          )}

          {selectedTags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedTags.map((tag) => (
                <Badge
                  key={tag}
                  variant="default"
                  className="group cursor-pointer rounded-full px-3 text-xs transition-all hover:scale-105 hover:bg-primary/90"
                  onClick={(e) => {
                    // If clicking the X area, just remove the tag
                    if ((e.target as HTMLElement).closest('svg')) {
                      toggleTag(tag);
                    } else {
                      // Otherwise, open boolean builder with current tags
                      const tagsExpression = selectedTags.map(t => `"${t}"`).join(' AND ');
                      setExpressionText(tagsExpression);
                      setShowBooleanBuilder(true);
                    }
                  }}
                  title="Click to edit filter"
                >
                  {tag}
                  <X className="ml-1 h-3 w-3 opacity-60 group-hover:opacity-100 transition-opacity" />
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}

      <SavedSearchesDialog
        open={savedSearchesDialogOpen}
        onOpenChange={setSavedSearchesDialogOpen}
        onLoad={handleLoadSavedSearch}
        onEdit={(search) => {
          setExpressionText(expressionToString(search.expression));
          setShowBooleanBuilder(true);
          setSavedSearchesDialogOpen(false);
        }}
        showDuplicates={showDuplicates}
        setShowDuplicates={setShowDuplicates}
        duplicateCount={duplicateCount}
        collections={collections}
      />
    </div>
  );
}
