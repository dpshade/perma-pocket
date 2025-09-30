import { useState, useEffect, useRef } from 'react';
import { X, Lock, Globe } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { shouldEncrypt } from '@/lib/encryption';
import { getAllTags } from '@/lib/search';
import { usePrompts } from '@/hooks/usePrompts';
import type { Prompt } from '@/types/prompt';

interface PromptEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prompt?: Prompt | null;
  onSave: (data: Partial<Prompt>) => Promise<boolean>;
}

export function PromptEditor({ open, onOpenChange, prompt, onSave }: PromptEditorProps) {
  const { prompts } = usePrompts();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [allTags, setAllTags] = useState<string[]>([]);
  const tagInputRef = useRef<HTMLInputElement>(null);

  // Get all existing tags with frequency counts
  useEffect(() => {
    const tagCounts = new Map<string, number>();
    prompts.forEach(prompt => {
      if (!prompt.isArchived) {
        prompt.tags.forEach(tag => {
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        });
      }
    });

    // Sort by frequency (most used first), then alphabetically
    const sortedTags = Array.from(tagCounts.entries())
      .sort((a, b) => {
        const countDiff = b[1] - a[1];
        if (countDiff !== 0) return countDiff;
        return a[0].localeCompare(b[0]);
      })
      .map(([tag]) => tag);

    setAllTags(sortedTags);
  }, [prompts]);

  // Filter and sort available tags based on input with fuzzy matching
  const availableTags = (() => {
    const input = tagInput.toLowerCase().trim();

    return allTags
      .filter(tag => !tags.includes(tag))
      .map(tag => {
        if (!input) return { tag, score: 0 };

        const tagLower = tag.toLowerCase();

        // Exact match - highest priority
        if (tagLower === input) return { tag, score: 100 };

        // Starts with - high priority
        if (tagLower.startsWith(input)) return { tag, score: 50 };

        // Contains - medium priority
        if (tagLower.includes(input)) return { tag, score: 25 };

        // Fuzzy match - calculate character match percentage
        let matchCount = 0;
        let inputIndex = 0;
        for (let i = 0; i < tagLower.length && inputIndex < input.length; i++) {
          if (tagLower[i] === input[inputIndex]) {
            matchCount++;
            inputIndex++;
          }
        }

        if (matchCount === input.length) {
          return { tag, score: 10 + (matchCount / tagLower.length) * 10 };
        }

        return null;
      })
      .filter((item): item is { tag: string; score: number } => item !== null)
      .sort((a, b) => b.score - a.score)
      .map(item => item.tag)
      .slice(0, 20); // Limit to 20 suggestions
  })();

  useEffect(() => {
    if (prompt) {
      setTitle(prompt.title);
      setDescription(prompt.description);
      setContent(prompt.content);
      setTags(prompt.tags);
    } else {
      // Reset for new prompt
      setTitle('');
      setDescription('');
      setContent('');
      setTags([]);
    }
    setTagInput('');
  }, [prompt, open]);

  const handleAddTag = (tagToAdd?: string) => {
    const tag = tagToAdd || tagInput.trim();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleTogglePublic = () => {
    const hasPublicTag = tags.some(tag => tag.toLowerCase() === 'public');
    if (hasPublicTag) {
      // Remove "public" tag
      setTags(tags.filter(tag => tag.toLowerCase() !== 'public'));
    } else {
      // Add "public" tag
      setTags([...tags, 'public']);
    }
  };

  // Determine encryption status based on current tags
  const willBeEncrypted = shouldEncrypt(tags);

  const handleSave = async () => {
    if (!title.trim()) {
      alert('Title is required');
      return;
    }

    setSaving(true);
    const success = await onSave({
      title: title.trim(),
      description: description.trim(),
      content: content.trim(),
      tags,
    });

    setSaving(false);
    if (success) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl flex flex-col h-[80vh] p-0">
        {/* Header */}
        <div className="flex-shrink-0 px-6 pt-6">
          <DialogHeader>
            <DialogTitle>
              {prompt ? 'Edit Prompt' : 'Create New Prompt'}
            </DialogTitle>
            <DialogDescription>
              {prompt ? 'Update your prompt. A new version will be created and uploaded to Arweave.' : 'Create a new prompt and upload it to Arweave (free under 100 KiB).'}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto px-6">
          <div className="space-y-2 py-4">
          {/* Title */}
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium w-24 flex-shrink-0">
              Title <span className="text-xs text-muted-foreground">*</span>
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter prompt title..."
              autoFocus
              className="flex-1"
            />
          </div>

          {/* Description */}
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium w-24 flex-shrink-0">Description</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of what this prompt does..."
              className="flex-1"
            />
          </div>

          {/* Tags */}
          <div className="flex items-start gap-3">
            <label className="text-sm font-medium w-24 flex-shrink-0">Tags</label>
            <div className="flex-1 space-y-2">
              <div className="flex gap-2">
                <Input
                  ref={tagInputRef}
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Add a tag and press Enter..."
                  className="flex-1"
                />
                <Button type="button" onClick={() => handleAddTag()} variant="outline">
                  Add
                </Button>
              </div>

              {/* Active tags and available tag suggestions */}
              <div className="flex flex-wrap gap-2">
                {/* Active tags (removable) */}
                {tags.map(tag => {
                  const isPublicTag = tag.toLowerCase() === 'public';
                  return (
                    <Badge
                      key={tag}
                      variant={isPublicTag ? "default" : "secondary"}
                      className="cursor-pointer"
                      onClick={() => handleRemoveTag(tag)}
                      title={isPublicTag ? "This tag makes the prompt public (click to remove)" : "Click to remove"}
                    >
                      {isPublicTag && <Globe className="mr-1 h-3 w-3" />}
                      {tag}
                      <X className="ml-1 h-3 w-3" />
                    </Badge>
                  );
                })}

                {/* Available tag suggestions (clickable to add) */}
                {availableTags.length > 0 && (
                  <>
                    {availableTags.map(tag => (
                      <Badge
                        key={tag}
                        variant="outline"
                        className="cursor-pointer opacity-60 hover:opacity-100 transition-opacity"
                        onClick={() => handleAddTag(tag)}
                        title="Click to add"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

          {/* Content - expandable */}
          <div className="flex items-start gap-3 mt-2">
            <label className="text-sm font-medium w-24 flex-shrink-0">
              Content <span className="text-xs text-muted-foreground">*</span>
            </label>
            <div className="flex-1 flex flex-col min-h-[300px]">
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Enter your prompt content here... (supports Markdown)"
                className="flex-1 font-mono text-sm resize-none mb-1 min-h-[300px]"
              />
              <div className="text-xs text-muted-foreground flex-shrink-0">
                {content.length} characters · {Math.ceil(new Blob([content]).size / 1024)} KB
                {new Blob([content]).size > 102400 && (
                  <span className="text-yellow-600 ml-2">
                    ⚠ Exceeds 100 KiB free tier
                  </span>
                )}
              </div>

              {/* Encryption Info Banner */}
              <div className={`mt-2 rounded border px-2 py-1.5 text-xs flex-shrink-0 ${
                willBeEncrypted
                  ? 'border-primary/30 bg-primary/5 text-muted-foreground'
                  : 'border-muted-foreground/30 bg-muted/30 text-muted-foreground'
              }`}>
                {willBeEncrypted ? (
                  <>
                    Only your wallet can decrypt this content. To make a prompt public, add the <code className="px-1 py-0.5 bg-muted rounded text-[10px]">public</code> tag.
                  </>
                ) : (
                  <>
                    This prompt has the <code className="px-1 py-0.5 bg-muted rounded text-[10px]">public</code> tag and will be stored as plain text on Arweave. Anyone can read it. Remove the tag to encrypt it.
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="flex items-center justify-between gap-2 flex-shrink-0 border-t pt-4 pb-4 px-6 bg-background">
          <div className="flex items-center gap-2">
            {/* Encryption Status Badge */}
            <Badge
              variant={willBeEncrypted ? "default" : "secondary"}
              className="flex items-center gap-1.5 text-xs"
            >
              {willBeEncrypted ? (
                <>
                  <Lock className="h-3 w-3" />
                  Encrypted
                </>
              ) : (
                <>
                  <Globe className="h-3 w-3" />
                  Public
                </>
              )}
            </Badge>

            {/* Quick Public/Private Toggle */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleTogglePublic}
              className="h-7 text-xs"
              title={willBeEncrypted ? "Make this prompt public" : "Make this prompt private (encrypted)"}
            >
              {willBeEncrypted ? (
                <>
                  <Globe className="h-3 w-3 mr-1" />
                  Make Public
                </>
              ) : (
                <>
                  <Lock className="h-3 w-3 mr-1" />
                  Make Private
                </>
              )}
            </Button>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !title.trim() || !content.trim()}
            >
              {saving ? 'Saving...' : prompt ? 'Update & Upload' : 'Create & Upload'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}