import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { usePrompts } from '@/hooks/usePrompts';
import { getAllTags } from '@/lib/search';
import { useState, useEffect } from 'react';

export function SearchBar() {
  const { prompts, searchQuery, setSearchQuery, selectedTags, toggleTag, clearFilters } = usePrompts();
  const [allTags, setAllTags] = useState<string[]>([]);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);

  useEffect(() => {
    const tags = getAllTags(prompts);
    setAllTags(tags);
  }, [prompts]);

  const hasActiveFilters = searchQuery.length > 0 || selectedTags.length > 0;

  return (
    <div className="w-full space-y-3">
      {/* Search Input */}
      <div className="relative group">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-transform group-focus-within:scale-110" />
        <Input
          type="text"
          placeholder="Search prompts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 pr-10 focus:ring-2 transition-all"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground hover:rotate-90 transition-all active:scale-75"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Tag Filter Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowTagSuggestions(!showTagSuggestions)}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            {showTagSuggestions ? 'Hide' : 'Show'} tag filters ({allTags.length} tags)
          </button>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Clear all filters
            </button>
          )}
        </div>

        {/* Selected Tags */}
        {selectedTags.length > 0 && (
          <div className="flex flex-wrap gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
            {selectedTags.map((tag, index) => (
              <Badge
                key={tag}
                variant="default"
                className="cursor-pointer hover:scale-110 active:scale-95 transition-transform"
                onClick={() => toggleTag(tag)}
                style={{ animationDelay: `${index * 30}ms` }}
              >
                {tag}
                <X className="ml-1 h-3 w-3" />
              </Badge>
            ))}
          </div>
        )}

        {/* Tag Suggestions */}
        {showTagSuggestions && (
          <div className="flex flex-wrap gap-2 p-3 rounded-md border bg-muted/50 animate-in fade-in slide-in-from-top-2 duration-200">
            {allTags.length > 0 ? (
              allTags.map((tag, index) => (
                <Badge
                  key={tag}
                  variant={selectedTags.includes(tag) ? "default" : "outline"}
                  className="cursor-pointer hover:bg-primary hover:text-primary-foreground hover:scale-110 transition-all active:scale-95"
                  onClick={() => toggleTag(tag)}
                  style={{ animationDelay: `${index * 20}ms` }}
                >
                  {tag}
                </Badge>
              ))
            ) : (
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <span className="text-2xl animate-bounce-slow">🏷️</span>
                <p>No tags yet. Add tags to your prompts!</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}