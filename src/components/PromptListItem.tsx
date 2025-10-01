import { ExternalLink, Edit, Archive, ArchiveRestore, Check, Lock, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Prompt } from '@/types/prompt';
import { useState } from 'react';
import { wasPromptEncrypted } from '@/lib/encryption';

interface PromptListItemProps {
  prompt: Prompt;
  onView: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onCopy: () => void;
}

export function PromptListItem({ prompt, onView, onEdit, onArchive, onRestore, onCopy }: PromptListItemProps) {
  const [copied, setCopied] = useState(false);
  const isEncrypted = wasPromptEncrypted(prompt.tags);
  const isPublic = !isEncrypted;

  const handleCopy = () => {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div
      className={`group border-b border-border py-4 px-4 hover:bg-muted/50 transition-colors cursor-pointer ${copied ? 'bg-primary/5' : ''}`}
      onClick={handleCopy}
      title="Click to copy"
    >
      <div className="flex items-start gap-4">
        {/* Left: Icon */}
        <div className="flex-shrink-0 pt-1">
          <span title={isPublic ? "Public prompt" : "Encrypted prompt"}>
            {isPublic ? (
              <Globe className="h-5 w-5 text-muted-foreground" />
            ) : (
              <Lock className="h-5 w-5 text-muted-foreground" />
            )}
          </span>
        </div>

        {/* Center: Content */}
        <div className="flex-1 min-w-0 space-y-1">
          {/* Title */}
          <div className="flex items-center gap-2">
            <h3 className="text-base font-medium text-primary hover:underline truncate">
              {prompt.title}
            </h3>
            {copied && (
              <Check className="h-4 w-4 text-primary animate-in fade-in zoom-in duration-200 flex-shrink-0" />
            )}
            {prompt.versions.length > 1 && (
              <Badge variant="secondary" className="text-xs shrink-0">
                v{prompt.versions.length}
              </Badge>
            )}
          </div>

          {/* Description */}
          <p className="text-sm text-muted-foreground line-clamp-2">
            {prompt.description || 'No description'}
          </p>

          {/* Tags */}
          {prompt.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {prompt.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {/* Metadata */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
            <span>Updated {formatDate(prompt.updatedAt)}</span>
            {!prompt.isSynced && (
              <span className="text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-yellow-500 animate-ping"></span>
                Not synced
              </span>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onView();
            }}
            className="h-8 w-8 p-0"
            title="Open prompt"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>

          {!prompt.isArchived ? (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                className="h-8 w-8 p-0"
                title="Edit"
              >
                <Edit className="h-3.5 w-3.5" />
              </Button>

              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  onArchive();
                }}
                className="h-8 w-8 p-0"
                title="Archive"
              >
                <Archive className="h-3.5 w-3.5" />
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onRestore();
              }}
              className="h-8 w-8 p-0"
              title="Restore"
            >
              <ArchiveRestore className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
