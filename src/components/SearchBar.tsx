import { Search, X, Filter, Bookmark, Archive } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SavedSearchesDialog } from '@/components/SavedSearchesDialog';
import { usePrompts } from '@/hooks/usePrompts';
import { getAllTags } from '@/lib/search';
import { expressionToString } from '@/lib/boolean';
import { useState, useEffect } from 'react';
import type { BooleanExpression, SavedSearch } from '@/types/prompt';
import { BooleanBuilder } from '@/components/BooleanBuilder';

interface SearchBarProps {
  showArchived: boolean;
  setShowArchived: (show: boolean) => void;
}

export function SearchBar({ showArchived, setShowArchived }: SearchBarProps) {
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

  useEffect(() => {
    const tags = getAllTags(prompts);
    setAllTags(tags);
  }, [prompts]);

  const hasActiveFilters = searchQuery.length > 0 || selectedTags.length > 0 || booleanExpression !== null;

  const handleLoadSavedSearch = (search: SavedSearch) => {
    loadSavedSearch(search);
  };

  const handleApplyExpression = (expression: BooleanExpression) => {
    setBooleanExpression(expression, searchQuery || undefined);
    setShowBooleanBuilder(false);
  };

  const tagLabel = allTags.length === 1 ? 'tag' : 'tags';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSavedSearchesDialogOpen(true)}
            className="h-9 gap-2 px-3 text-sm font-medium"
          >
            <Bookmark className="h-4 w-4" />
            <span>Collections</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowArchived(!showArchived)}
            className="h-8 w-8 text-muted-foreground"
            title={showArchived ? 'Hide archived' : 'Show archived'}
          >
            <Archive className="h-3.5 w-3.5" />
          </Button>
        </div>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 px-3 text-sm"
            onClick={clearFilters}
          >
            Clear all filters
          </Button>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button
            variant={booleanExpression ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowBooleanBuilder((open) => !open)}
            className="h-10 w-10"
            title="Filter builder"
          >
            <Filter className="h-4 w-4" />
          </Button>

          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder={booleanExpression ? 'Additional text filter…' : 'Search prompts…'}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="h-10 w-full border-0 bg-muted/50 pl-11 pr-11 text-sm focus-visible:ring-0 focus-visible:bg-muted"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition-all hover:text-foreground"
                title="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {booleanExpression && (
          <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2 text-sm">
            <Filter className="h-4 w-4 text-primary" />
            <div className="flex-1 min-w-0">
              {activeSavedSearch ? (
                <span className="font-medium text-primary">{activeSavedSearch.name}</span>
              ) : (
                <code className="truncate text-xs text-primary">{expressionToString(booleanExpression)}</code>
              )}
            </div>
            <button
              onClick={clearBooleanSearch}
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
            />
          </div>
        )}
      </div>

      {!booleanExpression && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
            <button
              onClick={() => setShowTagSuggestions(!showTagSuggestions)}
              className="font-medium text-foreground transition-colors hover:text-primary"
            >
              {showTagSuggestions ? 'Hide tag filters' : 'Show tag filters'} ({allTags.length} {tagLabel})
            </button>
            {selectedTags.length > 0 && (
              <span className="text-xs text-muted-foreground">
                Filtering by {selectedTags.length} {selectedTags.length === 1 ? 'tag' : 'tags'}
              </span>
            )}
          </div>

          {selectedTags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedTags.map((tag) => (
                <Badge
                  key={tag}
                  variant="default"
                  className="cursor-pointer rounded-full px-3 text-xs transition-transform hover:scale-105"
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                  <X className="ml-1 h-3 w-3" />
                </Badge>
              ))}
            </div>
          )}

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
      />
    </div>
  );
}
