import { ExternalLink, Edit, Archive, ArchiveRestore, Check, Lock, Globe } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Prompt } from '@/types/prompt';
import { useState } from 'react';
import { isPromptEncrypted } from '@/lib/encryption';

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
  const isEncrypted = isPromptEncrypted(prompt.content);
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
      className={`group cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all duration-200 active:scale-[0.98] ${copied ? 'ring-2 ring-primary' : ''}`}
      onClick={handleCopy}
      title="Click to copy"
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <CardTitle className="text-base sm:text-lg truncate">{prompt.title}</CardTitle>
              <span title={isPublic ? "Public prompt" : "Encrypted prompt"}>
                {isPublic ? (
                  <Globe className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                ) : (
                  <Lock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                )}
              </span>
              {copied && (
                <Check className="h-4 w-4 text-primary animate-in fade-in zoom-in duration-200" />
              )}
            </div>
            <CardDescription className="line-clamp-2 mt-1 text-xs sm:text-sm">
              {prompt.description || 'No description'}
            </CardDescription>
          </div>
          {prompt.versions.length > 1 && (
            <Badge variant="secondary" className="shrink-0 animate-pulse">
              v{prompt.versions.length}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {/* Tags */}
        {prompt.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {prompt.tags.map((tag, index) => (
              <Badge
                key={tag}
                variant="outline"
                className="text-xs"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Metadata */}
        <div className="text-xs text-muted-foreground space-y-1">
          <div>Updated: {formatDate(prompt.updatedAt)}</div>
          {!prompt.isSynced && (
            <div className="text-yellow-600 dark:text-yellow-400 flex items-center gap-1 animate-pulse">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-yellow-500 animate-ping"></span>
              Not synced to Arweave
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={(e) => {
            e.stopPropagation();
            onView();
          }}
          className="hover:scale-110 active:scale-90 transition-transform"
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
              className="hover:scale-110 active:scale-90 transition-transform"
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
              className="hover:scale-110 active:scale-90 transition-transform"
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
            className="hover:scale-110 active:scale-90 transition-transform animate-wiggle"
          >
            <ArchiveRestore className="h-3 w-3" />
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}