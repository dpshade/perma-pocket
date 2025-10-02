import { ExternalLink, Edit, Archive, ArchiveRestore, Check, Lock, Globe, Info } from 'lucide-react';
import { Button } from '@/frontend/components/ui/button';
import { Badge } from '@/frontend/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/frontend/components/ui/tooltip';
import type { Prompt } from '@/shared/types/prompt';
import { useState } from 'react';
import { wasPromptEncrypted } from '@/core/encryption/crypto';

interface PromptListItemProps {
  prompt: Prompt;
  isSelected?: boolean;
  onView: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onCopy: () => void;
}

export function PromptListItem({ prompt, isSelected = false, onView, onEdit, onArchive, onRestore, onCopy }: PromptListItemProps) {
  const [copied, setCopied] = useState(false);
  const isEncrypted = wasPromptEncrypted(prompt.tags);
  const isPublic = !isEncrypted;

  const handleCopy = () => {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const formatDateTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${month}/${day}/${year} · ${hours}:${minutes}`;
  };

  const getDisplayDescription = () => {
    if (prompt.description) {
      return prompt.description;
    }
    // If no description, use truncated content
    if (typeof prompt.content === 'string') {
      return prompt.content;
    }
    return '';
  };

  return (
    <div
      className={`group relative border-b border-border py-6 px-4 sm:py-4 md:hover:bg-muted/50 transition-colors cursor-pointer ${copied ? 'bg-primary/5' : ''} ${isSelected ? 'bg-primary/10 border-l-4 border-l-primary' : ''}`}
      onClick={handleCopy}
      title="Click to copy"
    >
      <div className="flex items-start gap-4">
        {/* Left: Icon - hidden on mobile for cleaner look */}
        <div className="hidden sm:flex flex-shrink-0 pt-1">
          <span title={isPublic ? "Public prompt" : "Encrypted prompt"}>
            {isPublic ? (
              <Globe className="h-5 w-5 text-muted-foreground" />
            ) : (
              <Lock className="h-5 w-5 text-muted-foreground" />
            )}
          </span>
        </div>

        {/* Center: Content */}
        <div className="flex-1 min-w-0 space-y-2 pr-32 sm:pr-32">
          {/* Title */}
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold sm:text-base sm:font-medium text-primary [@media(hover:hover)]:hover:underline truncate">
              {prompt.title}
            </h3>
            {copied && (
              <Check className="h-4 w-4 text-primary animate-in fade-in zoom-in duration-200 flex-shrink-0" />
            )}
          </div>

          {/* Description */}
          {getDisplayDescription() && (
            <p className="text-sm text-muted-foreground/80 line-clamp-2 sm:line-clamp-1">
              {getDisplayDescription()}
            </p>
          )}

          {/* Tags */}
          {prompt.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {prompt.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {prompt.tags.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{prompt.tags.length - 3}
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Actions - Bottom Right */}
      <div className="absolute bottom-4 right-4 flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity bg-background/95 backdrop-blur-sm rounded-md p-1 shadow-sm">
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  onView();
                }}
                className="h-11 w-11 md:h-8 md:w-8 p-0"
              >
                <ExternalLink className="h-4 w-4 md:h-3.5 md:w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Open prompt</p>
            </TooltipContent>
          </Tooltip>

          {!prompt.isArchived ? (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit();
                    }}
                    className="h-11 w-11 md:h-8 md:w-8 p-0"
                  >
                    <Edit className="h-4 w-4 md:h-3.5 md:w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Edit</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      onArchive();
                    }}
                    className="h-11 w-11 md:h-8 md:w-8 p-0"
                  >
                    <Archive className="h-4 w-4 md:h-3.5 md:w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Archive</p>
                </TooltipContent>
              </Tooltip>
            </>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRestore();
                  }}
                  className="h-11 w-11 md:h-8 md:w-8 p-0"
                >
                  <ArchiveRestore className="h-4 w-4 md:h-3.5 md:w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Restore</p>
              </TooltipContent>
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => e.stopPropagation()}
                className="h-11 w-11 md:h-8 md:w-8 p-0"
              >
                <Info className="h-4 w-4 md:h-3.5 md:w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" align="end" className="text-xs p-3">
              <div className="space-y-1.5 min-w-[160px]">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Created</span>
                  <span className="font-medium">{formatDateTime(prompt.createdAt)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Updated</span>
                  <span className="font-medium">{formatDateTime(prompt.updatedAt)}</span>
                </div>
                {!prompt.isSynced && (
                  <>
                    <div className="border-t border-border my-1"></div>
                    <div className="text-yellow-500 flex items-center gap-1.5">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-yellow-500"></span>
                      <span className="text-[11px]">Not synced to Arweave</span>
                    </div>
                  </>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
