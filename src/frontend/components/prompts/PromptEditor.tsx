import { useState, useEffect, useRef } from 'react';
import { Lock, Globe, X } from 'lucide-react';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/frontend/components/ui/dialog';
import { Button } from '@/frontend/components/ui/button';
import { Input } from '@/frontend/components/ui/input';
import { Textarea } from '@/frontend/components/ui/textarea';
import { Badge } from '@/frontend/components/ui/badge';
import { Label } from '@/frontend/components/ui/label';
import { shouldEncrypt } from '@/core/encryption/crypto';
import { usePrompts } from '@/frontend/hooks/usePrompts';
import type { Prompt } from '@/shared/types/prompt';

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
      // Check if adding "public" tag - show warning
      if (tag.toLowerCase() === 'public') {
        const confirmed = window.confirm(
          '⚠️ WARNING: Making this prompt public will store it as plain text on Arweave PERMANENTLY.\n\n' +
          '• Anyone can read it forever\n' +
          '• It cannot be deleted from Arweave\n' +
          '• Making it private later will NOT remove the public version\n\n' +
          'Are you sure you want to make this prompt public?'
        );
        if (!confirmed) {
          setTagInput('');
          return;
        }
      }
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
      // Remove "public" tag - no confirmation needed
      setTags(tags.filter(tag => tag.toLowerCase() !== 'public'));
    } else {
      // Add "public" tag - show warning confirmation
      const confirmed = window.confirm(
        '⚠️ WARNING: Making this prompt public will store it as plain text on Arweave PERMANENTLY.\n\n' +
        '• Anyone can read it forever\n' +
        '• It cannot be deleted from Arweave\n' +
        '• Making it private later will NOT remove the public version\n\n' +
        'Are you sure you want to make this prompt public?'
      );
      if (confirmed) {
        setTags([...tags, 'public']);
      }
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
      <DialogContent
        size="xl"
        className="flex max-h-[88vh] flex-col"
      >
        <DialogHeader className="gap-2 text-left">
          <DialogTitle className="text-xl font-semibold">
              {prompt ? 'Edit Prompt' : 'Create New Prompt'}
          </DialogTitle>
          <DialogDescription className="text-sm text-foreground/70">
            {prompt ? 'Update your prompt. A new version will be created and uploaded to Arweave.' : 'Craft a new prompt and we’ll prepare it for Arweave (free under 100 KiB).'}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="flex-1 overflow-y-auto space-y-6">
          <div className="space-y-10">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground/70">Title <span className="text-xs text-foreground/40">*</span></Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Give your prompt a clear title..."
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground/70">Description</Label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional short description"
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium text-foreground/70">Tags</Label>
              <div className="flex gap-2">
                <Input
                  ref={tagInputRef}
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Add a tag and press Enter"
                />
                <Button type="button" variant="outline" onClick={() => handleAddTag()}>
                  Add
                </Button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {tags.map(tag => {
                    const isPublicTag = tag.toLowerCase() === 'public';
                    return (
                      <Badge
                        key={tag}
                        variant={isPublicTag ? 'default' : 'secondary'}
                        className="cursor-pointer px-3 py-1 text-xs"
                        onClick={() => handleRemoveTag(tag)}
                        title={isPublicTag ? 'This tag makes the prompt public (click to remove)' : 'Click to remove'}
                      >
                        {isPublicTag && <Globe className="mr-1 h-3 w-3" />}
                        {tag}
                        <X className="ml-1 h-3 w-3" />
                      </Badge>
                    );
                  })}
                </div>
              )}
              {availableTags.length > 0 && (
                <div className="flex flex-wrap gap-2 text-xs text-foreground/60">
                  {availableTags.map(tag => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className="cursor-pointer px-3 py-1 text-xs"
                      onClick={() => handleAddTag(tag)}
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium text-foreground/70">Content <span className="text-xs text-foreground/40">*</span></Label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write your prompt..."
                className="min-h-[260px] resize-vertical font-mono text-sm"
              />
              <div className="flex flex-wrap items-center gap-3 text-xs text-foreground/60">
                <span>{content.length} characters</span>
                <span>•</span>
                <span>{Math.ceil(new Blob([content]).size / 1024)} KB</span>
                {new Blob([content]).size > 102400 && (
                  <span className="text-amber-600">⚠ Exceeds 100 KiB free tier</span>
                )}
              </div>
              <div
                className={`rounded-md border px-3 py-2 text-xs leading-relaxed ${
                  willBeEncrypted
                    ? 'border-primary/30 bg-primary/10 text-primary-foreground'
                    : 'border-amber-400/40 bg-amber-500/10 text-amber-700 dark:text-amber-200'
                }`}
              >
                {willBeEncrypted ? (
                  <>
                    Only your wallet can decrypt this content. Add the <code className="px-1 py-0.5 bg-black/5 dark:bg-white/10 rounded">public</code> tag to share it.
                  </>
                ) : (
                  <>
                    <strong>Warning:</strong> This prompt will be permanently public on Arweave. Removing the public tag later will not erase this copy.
                  </>
                )}
              </div>
            </div>
          </div>
        </DialogBody>

        <DialogFooter className="justify-between">
          <div className="flex items-center gap-2 text-xs text-foreground/70">
            <Badge
              variant={willBeEncrypted ? 'default' : 'secondary'}
              className="flex items-center gap-1.5 px-3 py-1"
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
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleTogglePublic}
              className="h-8 text-xs"
              title={willBeEncrypted ? 'Make this prompt public' : 'Make this prompt private (encrypted)'}
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
              className="min-w-[160px]"
            >
              {saving ? 'Saving…' : prompt ? 'Update & Upload' : 'Create & Upload'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}