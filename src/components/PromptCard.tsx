import { ExternalLink, Edit, Archive, ArchiveRestore, Check, Lock, Globe } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Prompt } from '@/types/prompt';
import { useState } from 'react';
import { wasPromptEncrypted } from '@/lib/encryption';

interface PromptCardProps {
  prompt: Prompt;
  onView: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onCopy: () => void;
}

export function PromptCard({ prompt, onView, onEdit, onArchive, onRestore, onCopy }: PromptCardProps) {
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
    <Card
      className={`group cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all duration-200 active:scale-[0.98] h-[240px] flex flex-col ${copied ? 'ring-2 ring-primary' : ''}`}
      onClick={handleCopy}
      title="Click to copy"
    >
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <CardTitle className="text-sm truncate">{prompt.title}</CardTitle>
              <span title={isPublic ? "Public prompt" : "Encrypted prompt"}>
                {isPublic ? (
                  <Globe className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                ) : (
                  <Lock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                )}
              </span>
              {copied && (
                <Check className="h-3.5 w-3.5 text-primary animate-in fade-in zoom-in duration-200" />
              )}
            </div>
            <CardDescription className="line-clamp-2 mt-0.5 text-xs">
              {prompt.description || 'No description'}
            </CardDescription>
          </div>
          {prompt.versions.length > 1 && (
            <Badge variant="secondary" className="shrink-0 text-xs h-5 px-1.5">
              v{prompt.versions.length}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="px-4 py-2 flex-1 flex flex-col justify-between min-h-0">
        <div className="space-y-2 overflow-hidden">
          {/* Tags */}
          {prompt.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 max-h-[60px] overflow-hidden">
              {prompt.tags.slice(0, 6).map((tag, index) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className="text-xs h-5 px-1.5"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {tag}
                </Badge>
              ))}
              {prompt.tags.length > 6 && (
                <Badge variant="outline" className="text-xs h-5 px-1.5">
                  +{prompt.tags.length - 6}
                </Badge>
              )}
            </div>
          )}

          {/* Metadata */}
          <div className="text-xs text-muted-foreground">
            <div>Updated: {formatDate(prompt.updatedAt)}</div>
            {!prompt.isSynced && (
              <div className="text-yellow-600 dark:text-yellow-400 flex items-center gap-1 animate-pulse mt-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-yellow-500 animate-ping"></span>
                Not synced
              </div>
            )}
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex gap-2 px-4 py-3 mt-auto">
        <Button
          size="sm"
          variant="outline"
          onClick={(e) => {
            e.stopPropagation();
            onView();
          }}
          className="hover:scale-110 active:scale-90 transition-transform h-7"
          title="Open prompt"
        >
          <ExternalLink className="h-3 w-3" />
        </Button>

        {!prompt.isArchived ? (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="hover:scale-110 active:scale-90 transition-transform h-7"
            >
              <Edit className="h-3 w-3" />
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                onArchive();
              }}
              className="hover:scale-110 active:scale-90 transition-transform h-7"
            >
              <Archive className="h-3 w-3" />
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              onRestore();
            }}
            className="hover:scale-110 active:scale-90 transition-transform animate-wiggle h-7"
          >
            <ArchiveRestore className="h-3 w-3" />
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}