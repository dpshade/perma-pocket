import { ExternalLink, Edit, Archive, ArchiveRestore, Check, Lock, Globe, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { Prompt } from '@/types/prompt';
import { useState } from 'react';
import { wasPromptEncrypted } from '@/lib/encryption';

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

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
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
      className={`group relative border-b border-border py-4 px-4 hover:bg-muted/50 transition-colors cursor-pointer ${copied ? 'bg-primary/5' : ''} ${isSelected ? 'bg-primary/10 border-l-4 border-l-primary' : ''}`}
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
        <div className="flex-1 min-w-0 space-y-1 pr-32">
          {/* Title */}
          <div className="flex items-center gap-2">
            <h3 className="text-base font-medium text-primary hover:underline truncate">
              {prompt.title}
            </h3>
            {copied && (
              <Check className="h-4 w-4 text-primary animate-in fade-in zoom-in duration-200 flex-shrink-0" />
            )}
          </div>

          {/* Description */}
          {getDisplayDescription() && (
            <p className="text-sm text-muted-foreground line-clamp-1">
              {getDisplayDescription()}
            </p>
          )}

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
        </div>
      </div>

      {/* Actions - Bottom Right */}
      <div className="absolute bottom-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-background/95 backdrop-blur-sm rounded-md p-1 shadow-sm">
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
                className="h-8 w-8 p-0"
              >
                <ExternalLink className="h-3.5 w-3.5" />
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
                    className="h-8 w-8 p-0"
                  >
                    <Edit className="h-3.5 w-3.5" />
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
                    className="h-8 w-8 p-0"
                  >
                    <Archive className="h-3.5 w-3.5" />
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
                  className="h-8 w-8 p-0"
                >
                  <ArchiveRestore className="h-3.5 w-3.5" />
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
                className="h-8 w-8 p-0"
              >
                <Info className="h-3.5 w-3.5" />
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
