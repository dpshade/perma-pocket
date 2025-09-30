import { useEffect, useMemo, useRef, useState } from 'react';
import { Filter, Save, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  expressionToString,
  evaluateExpression,
  getExpressionTags,
  parseBooleanExpression,
  validateExpression,
} from '@/lib/boolean';
import { saveSavedSearch } from '@/lib/storage';
import type { BooleanExpression, Prompt, SavedSearch } from '@/types/prompt';
import { Index } from 'flexsearch';
import { cn } from '@/lib/utils';

interface BooleanBuilderProps {
  allTags: string[];
  prompts: Prompt[];
  searchQuery: string;
  expressionText: string;
  onExpressionChange: (value: string) => void;
  onApply: (expression: BooleanExpression) => void;
  onClose: () => void;
  isOpen: boolean;
}

export function BooleanBuilder({
  allTags,
  prompts,
  searchQuery,
  expressionText,
  onExpressionChange,
  onApply,
  onClose,
  isOpen,
}: BooleanBuilderProps) {
  const [cursorPosition, setCursorPosition] = useState(0);
  const [parsedExpression, setParsedExpression] = useState<BooleanExpression | null>(null);
  const [matchCount, setMatchCount] = useState(0);
  const [error, setError] = useState('');
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveDescription, setSaveDescription] = useState('');
  const [showAllTags, setShowAllTags] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => {
        const input = inputRef.current;
        if (input) {
          const pos = expressionText.length;
          input.focus();
          input.setSelectionRange(pos, pos);
          setCursorPosition(pos);
        }
      });
    }
  }, [isOpen, expressionText.length]);

  useEffect(() => {
    if (!isOpen) {
      setError('');
      setParsedExpression(null);
      setMatchCount(0);
      setShowAllTags(false);
      return;
    }

    if (!expressionText.trim()) {
      setParsedExpression(null);
      setError('');
      setMatchCount(0);
      return;
    }

    const validation = validateExpression(expressionText);
    if (!validation.valid) {
      setError(validation.error || 'Invalid expression');
      setParsedExpression(null);
      setMatchCount(0);
      return;
    }

    try {
      const expression = parseBooleanExpression(expressionText);
      setParsedExpression(expression);
      setError('');

      const matches = prompts.filter((prompt) => {
        if (prompt.isArchived) return false;
        return evaluateExpression(expression, prompt.tags);
      });

      setMatchCount(matches.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Parse error');
      setParsedExpression(null);
      setMatchCount(0);
    }
  }, [expressionText, prompts, isOpen]);

  const tagIndex = useMemo(() => {
    const index = new Index({ tokenize: 'forward' });
    allTags.forEach((tag, idx) => {
      index.add(idx, tag);
    });
    return index;
  }, [allTags]);

  const getCurrentWord = (text: string, cursorPos: number) => {
    const beforeCursor = text.substring(0, cursorPos);
    const afterCursor = text.substring(cursorPos);
    const wordBoundaries = /[\s()]/;

    let start = beforeCursor.length;
    while (start > 0 && !wordBoundaries.test(beforeCursor[start - 1])) {
      start--;
    }

    let end = 0;
    while (end < afterCursor.length && !wordBoundaries.test(afterCursor[end])) {
      end++;
    }

    return beforeCursor.substring(start) + afterCursor.substring(0, end);
  };

  const usedTags = useMemo(() => {
    if (!parsedExpression) return new Set<string>();
    return new Set(getExpressionTags(parsedExpression).map((tag) => tag.toLowerCase()));
  }, [parsedExpression]);

  const displayedTags = useMemo(() => {
    const currentWord = getCurrentWord(expressionText, cursorPosition);

    if (!currentWord.trim()) {
      return allTags;
    }

    const results = tagIndex.search(currentWord);
    if (!results.length) {
      return allTags;
    }

    const ranked = results.map((idx) => allTags[idx as number]);
    const matched = new Set(ranked);
    const remainder = allTags.filter((tag) => !matched.has(tag));

    return [...ranked, ...remainder];
  }, [allTags, expressionText, cursorPosition, tagIndex]);

  const insertText = (text: string, surroundWithSpaces = false) => {
    const input = inputRef.current;
    if (!input) return;

    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? 0;
    const before = expressionText.substring(0, start);
    const after = expressionText.substring(end);

    const needsSpaceBefore = surroundWithSpaces && before.length > 0 && before[before.length - 1] !== ' ';
    const needsSpaceAfter = surroundWithSpaces && after.length > 0 && after[0] !== ' ';

    const next = `${needsSpaceBefore ? `${before} ` : before}${text}${needsSpaceAfter ? ` ${after}` : after}`;
    onExpressionChange(next);

    const cursorOffset = (needsSpaceBefore ? 1 : 0) + text.length;
    const newPos = start + cursorOffset + (needsSpaceAfter ? 1 : 0);

    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(newPos, newPos);
      setCursorPosition(newPos);
    });
  };

  const insertOperator = (operator: string) => {
    insertText(operator, true);
  };

  const insertTag = (tag: string) => {
    const input = inputRef.current;
    const start = input?.selectionStart ?? 0;
    const before = expressionText.substring(0, start);
    const needsSpace = before.length > 0 && !before.endsWith(' ') && !before.endsWith('(');
    insertText(`${needsSpace ? ' ' : ''}${tag}`, false);
  };

  const insertParens = () => {
    const input = inputRef.current;
    if (!input) return;

    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? 0;
    const text = `${expressionText.substring(0, start)}()${expressionText.substring(end)}`;
    onExpressionChange(text);

    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(start + 1, start + 1);
      setCursorPosition(start + 1);
    });
  };

  const handleApply = () => {
    if (!parsedExpression) return;
    onApply(parsedExpression);
    onExpressionChange('');
    setCursorPosition(0);
    setParsedExpression(null);
    setMatchCount(0);
    setShowAllTags(false);
  };

  const handleSave = () => {
    if (!parsedExpression || !saveName.trim()) return;

    const search: SavedSearch = {
      id: crypto.randomUUID(),
      name: saveName.trim(),
      description: saveDescription.trim() || undefined,
      expression: parsedExpression,
      textQuery: searchQuery || undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    saveSavedSearch(search);
    setSaveDialogOpen(false);
    setSaveName('');
    setSaveDescription('');
    alert(`Saved search "${search.name}" successfully!`);
  };

  const showTagToggle = displayedTags.length > 12;

  return (
    <div className="rounded-lg border border-border/70 bg-background/95 shadow-sm">
      <div className="flex items-center gap-3 border-b border-border/60 px-3 py-2.5">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Filter className="h-4 w-4 text-primary" />
          <span>Boolean filter</span>
          {parsedExpression && !error && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
              {matchCount} match{matchCount === 1 ? '' : 'es'}
            </span>
          )}
          {error && <span className="text-xs font-normal text-red-500">{error}</span>}
        </div>
        <div className="ml-auto flex items-center gap-3">
          {parsedExpression && !error && (
            <span className="hidden text-xs text-muted-foreground sm:inline-flex items-center gap-1">
              Press
              <kbd className="rounded border px-1 text-[10px] font-medium uppercase">⏎</kbd>
              to apply
            </span>
          )}
          {parsedExpression && !error && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => setSaveDialogOpen(true)}
              title="Save this search"
            >
              <Save className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={onClose}
            title="Close builder"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-4 px-3 py-3">
        <div className="relative">
          <Input
            ref={inputRef}
            id="boolean-expression"
            placeholder="e.g., ai AND analysis OR writing"
            value={expressionText}
            onChange={(event) => {
              onExpressionChange(event.target.value);
              setCursorPosition(event.target.selectionStart ?? 0);
            }}
            onKeyUp={(event) => {
              const target = event.currentTarget;
              setCursorPosition(target.selectionStart ?? 0);
            }}
            onClick={(event) => {
              const target = event.currentTarget;
              setCursorPosition(target.selectionStart ?? 0);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && parsedExpression) {
                event.preventDefault();
                handleApply();
              }
            }}
            className={cn('pr-10 text-sm', error && 'border-red-500 focus-visible:ring-red-500')}
          />
          {expressionText && (
            <button
              type="button"
              onClick={() => {
                onExpressionChange('');
                setParsedExpression(null);
                setMatchCount(0);
                setCursorPosition(0);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1 rounded-md border border-border/80 bg-muted/50 pr-1 text-xs text-muted-foreground">
            {['AND', 'OR', 'NOT'].map((operator) => (
              <Button
                key={operator}
                variant="ghost"
                size="sm"
                className="h-8 px-3 text-xs font-medium"
                onClick={() => insertOperator(operator)}
              >
                {operator}
              </Button>
            ))}
            <div className="h-6 w-px bg-border" />
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-3 text-xs font-medium"
              onClick={insertParens}
            >
              ( )
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <div
            className={cn(
              'flex gap-2',
              showAllTags
                ? 'flex-wrap'
                : 'flex-nowrap overflow-x-auto pb-1 text-nowrap [-ms-overflow-style:none] [scrollbar-width:none]'
            )}
            style={showAllTags ? undefined : { scrollbarWidth: 'none' }}
          >
            {!displayedTags.length ? (
              <span className="text-xs text-muted-foreground">No tags available</span>
            ) : (
              displayedTags.map((tag) => {
                const isUsed = usedTags.has(tag.toLowerCase());
                return (
                  <Badge
                    key={tag}
                    variant="outline"
                    className={cn(
                      'h-7 shrink-0 cursor-pointer rounded-full border-border/70 px-2.5 text-xs transition-colors',
                      showAllTags ? 'whitespace-normal' : 'whitespace-nowrap',
                      isUsed
                        ? 'cursor-not-allowed border-dashed opacity-40'
                        : 'hover:bg-primary hover:text-primary-foreground'
                    )}
                    onClick={() => {
                      if (!isUsed) insertTag(tag);
                    }}
                  >
                    {tag}
                  </Badge>
                );
              })
            )}
          </div>
          {showTagToggle && (
            <button
              type="button"
              onClick={() => setShowAllTags((state) => !state)}
              className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {showAllTags ? 'Show less' : 'Show all tags'}
            </button>
          )}
        </div>
      </div>

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Save search</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2 rounded-md border border-border/70 bg-muted/60 px-3 py-2 text-xs font-medium text-muted-foreground">
              <code className="max-w-[60%] shrink truncate">{parsedExpression && expressionToString(parsedExpression)}</code>
              {searchQuery && (
                <span className="truncate text-muted-foreground">+ "{searchQuery}"</span>
              )}
              <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                {matchCount}
              </span>
            </div>

            <Input
              id="save-name"
              placeholder="Search name"
              value={saveName}
              onChange={(event) => setSaveName(event.target.value)}
              className="h-9 text-sm"
            />
            <Input
              id="save-description"
              placeholder="Description (optional)"
              value={saveDescription}
              onChange={(event) => setSaveDescription(event.target.value)}
              className="h-9 text-sm"
            />

            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" className="h-8 px-3" onClick={() => setSaveDialogOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" className="h-8 px-3" onClick={handleSave} disabled={!saveName.trim()}>
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
