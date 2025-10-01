import { useState, useEffect } from 'react';
import { Search, Save, HelpCircle, Tag as TagIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/frontend/components/ui/dialog';
import { Input } from '@/frontend/components/ui/input';
import { Button } from '@/frontend/components/ui/button';
import { Badge } from '@/frontend/components/ui/badge';
import { Label } from '@/frontend/components/ui/label';
import { parseBooleanExpression, evaluateExpression, expressionToString, validateExpression } from '@/core/search/boolean';
import { saveSavedSearch } from '@/core/storage/cache';
import type { BooleanExpression, Prompt, SavedSearch } from '@/shared/types/prompt';

interface BooleanSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prompts: Prompt[];
  availableTags: string[];
  onApply: (expression: BooleanExpression, textQuery?: string) => void;
}

export function BooleanSearchDialog({
  open,
  onOpenChange,
  prompts,
  availableTags,
  onApply,
}: BooleanSearchDialogProps) {
  const [expressionText, setExpressionText] = useState('');
  const [textQuery, setTextQuery] = useState('');
  const [parsedExpression, setParsedExpression] = useState<BooleanExpression | null>(null);
  const [matchCount, setMatchCount] = useState(0);
  const [error, setError] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveDescription, setSaveDescription] = useState('');

  // Parse and validate expression
  useEffect(() => {
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
      const expr = parseBooleanExpression(expressionText);
      setParsedExpression(expr);
      setError('');

      // Calculate match count
      const matches = prompts.filter(p => {
        if (p.isArchived) return false;
        return evaluateExpression(expr, p.tags);
      });
      setMatchCount(matches.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Parse error');
      setParsedExpression(null);
      setMatchCount(0);
    }
  }, [expressionText, prompts]);

  const handleApply = () => {
    if (parsedExpression) {
      onApply(parsedExpression, textQuery || undefined);
      onOpenChange(false);
      // Reset state
      setExpressionText('');
      setTextQuery('');
      setSaveName('');
      setSaveDescription('');
    }
  };

  const handleSave = () => {
    if (!parsedExpression || !saveName.trim()) return;

    const search: SavedSearch = {
      id: crypto.randomUUID(),
      name: saveName.trim(),
      description: saveDescription.trim() || undefined,
      expression: parsedExpression,
      textQuery: textQuery || undefined,
      updatedAt: Date.now(),
    };

    saveSavedSearch(search);
    setShowSaveDialog(false);
    setSaveName('');
    setSaveDescription('');
    alert(`Saved search "${search.name}" successfully!`);
  };

  const insertOperator = (operator: string) => {
    const input = document.getElementById('boolean-expression') as HTMLInputElement;
    if (!input) return;

    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    const text = expressionText;

    const before = text.substring(0, start);
    const after = text.substring(end);

    // Add spaces around operator if needed
    const needsSpaceBefore = before.length > 0 && before[before.length - 1] !== ' ';
    const needsSpaceAfter = after.length > 0 && after[0] !== ' ';

    const newText =
      before +
      (needsSpaceBefore ? ' ' : '') +
      operator +
      (needsSpaceAfter ? ' ' : '') +
      after;

    setExpressionText(newText);

    // Set cursor position after operator
    setTimeout(() => {
      const newPos = start + (needsSpaceBefore ? 1 : 0) + operator.length + (needsSpaceAfter ? 1 : 0);
      input.setSelectionRange(newPos, newPos);
      input.focus();
    }, 0);
  };

  const insertTag = (tag: string) => {
    const input = document.getElementById('boolean-expression') as HTMLInputElement;
    if (!input) return;

    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    const text = expressionText;

    const before = text.substring(0, start);
    const after = text.substring(end);

    // Add space before tag if needed
    const needsSpace = before.length > 0 && before[before.length - 1] !== ' ' && before[before.length - 1] !== '(';
    const newText = before + (needsSpace ? ' ' : '') + tag + after;

    setExpressionText(newText);

    // Set cursor after tag
    setTimeout(() => {
      const newPos = start + (needsSpace ? 1 : 0) + tag.length;
      input.setSelectionRange(newPos, newPos);
      input.focus();
    }, 0);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            {showSaveDialog ? 'Save This Search' : 'Boolean Tag Search'}
          </DialogTitle>
          <DialogDescription>
            {showSaveDialog
              ? 'Give your search a name and description for easy reuse.'
              : 'Create advanced tag filters using AND, OR, and NOT operators.'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {!showSaveDialog ? (
            <>
          {/* Main Search Form */}
          {/* Expression Input */}
          <div className="space-y-2">
            <Label htmlFor="boolean-expression" className="text-base">Boolean Expression</Label>
            <Input
              id="boolean-expression"
              placeholder="e.g., ai AND analysis OR writing"
              value={expressionText}
              onChange={(e) => setExpressionText(e.target.value)}
              className={error ? 'border-red-500' : ''}
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
            {parsedExpression && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Parsed:</span>
                <code className="bg-muted px-2 py-1 rounded">
                  {expressionToString(parsedExpression)}
                </code>
                <span className="ml-auto font-medium text-primary">
                  {matchCount} match{matchCount !== 1 ? 'es' : ''}
                </span>
              </div>
            )}
          </div>

          {/* Operator Buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => insertOperator('AND')}
            >
              AND
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => insertOperator('OR')}
            >
              OR
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => insertOperator('NOT')}
            >
              NOT
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const input = document.getElementById('boolean-expression') as HTMLInputElement;
                const start = input?.selectionStart || 0;
                const end = input?.selectionEnd || 0;
                const text = expressionText;
                const newText = text.substring(0, start) + '()' + text.substring(end);
                setExpressionText(newText);
                setTimeout(() => {
                  input?.setSelectionRange(start + 1, start + 1);
                  input?.focus();
                }, 0);
              }}
            >
              ( )
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHelp(!showHelp)}
            >
              <HelpCircle className="h-4 w-4" />
            </Button>
          </div>

          {/* Help Section */}
          {showHelp && (
            <div className="bg-muted p-3 rounded-md text-sm space-y-2">
              <p className="font-medium">Boolean Search Examples:</p>
              <ul className="space-y-1 list-disc list-inside">
                <li><code>ai AND analysis</code> - Both tags required</li>
                <li><code>writing OR creative</code> - Either tag matches</li>
                <li><code>ai AND NOT deprecated</code> - Has ai, not deprecated</li>
                <li><code>(ai AND analysis) OR writing</code> - Complex grouping</li>
              </ul>
              <p className="text-muted-foreground">
                Operators are case-insensitive. Use parentheses to control evaluation order.
              </p>
            </div>
          )}

          {/* Available Tags */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-base">
              <TagIcon className="h-4 w-4" />
              Available Tags (click to insert)
            </Label>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-3 border rounded-md bg-muted/30">
              {availableTags.length > 0 ? (
                availableTags.map(tag => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                    onClick={() => insertTag(tag)}
                  >
                    {tag}
                  </Badge>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No tags available yet</p>
              )}
            </div>
          </div>

          {/* Optional Text Filter */}
          <div className="space-y-2">
            <Label htmlFor="text-query" className="text-base">Optional Text Filter</Label>
            <Input
              id="text-query"
              placeholder="Additional fuzzy text search..."
              value={textQuery}
              onChange={(e) => setTextQuery(e.target.value)}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between pt-2">
            <div className="flex gap-2">
              {parsedExpression && (
                <Button
                  variant="outline"
                  onClick={() => setShowSaveDialog(true)}
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save Search
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleApply} disabled={!parsedExpression}>
                Apply Filter
              </Button>
            </div>
          </div>
          </>
          ) : (
            <>
          {/* Save Search Form */}
          {/* Show the defined search */}
          <div className="space-y-2">
            <Label className="text-base">Search Expression</Label>
            <div className="bg-muted p-3 rounded-md">
              <code className="text-sm">
                {expressionToString(parsedExpression!)}
              </code>
            </div>
            {textQuery && (
              <div className="text-sm text-muted-foreground">
                Text filter: <span className="font-mono">{textQuery}</span>
              </div>
            )}
            <div className="text-sm font-medium text-primary">
              {matchCount} match{matchCount !== 1 ? 'es' : ''} in current list
            </div>
          </div>

          {/* Save fields */}
          <div className="space-y-2">
            <Label htmlFor="save-name" className="text-base">Search Name*</Label>
            <Input
              id="save-name"
              placeholder="e.g., AI Analysis Prompts"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="save-description" className="text-base">Description (optional)</Label>
            <Input
              id="save-description"
              placeholder="Brief description of this search..."
              value={saveDescription}
              onChange={(e) => setSaveDescription(e.target.value)}
            />
          </div>

          {/* Save action buttons */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
              Back
            </Button>
            <Button onClick={handleSave} disabled={!saveName.trim()}>
              <Save className="h-4 w-4 mr-2" />
              Save Search
            </Button>
          </div>
          </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
