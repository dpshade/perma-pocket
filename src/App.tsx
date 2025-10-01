import { useEffect, useState, useCallback } from 'react';
import { Plus, Archive as ArchiveIcon, Folder, Upload, Copy, Bell } from 'lucide-react';
import { WalletButton } from '@/components/WalletButton';
import { SearchBar } from '@/components/SearchBar';
import { PromptCard } from '@/components/PromptCard';
import { PromptListItem } from '@/components/PromptListItem';
import { PromptDialog } from '@/components/PromptDialog';
import { PromptEditor } from '@/components/PromptEditor';
import { VersionHistory } from '@/components/VersionHistory';
import { UploadDialog } from '@/components/UploadDialog';
import { NotificationsDialog } from '@/components/NotificationsDialog';
import { PasswordPrompt } from '@/components/PasswordPrompt';
import { PasswordUnlock } from '@/components/PasswordUnlock';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useWallet } from '@/hooks/useWallet';
import { usePrompts } from '@/hooks/usePrompts';
import { usePassword } from '@/contexts/PasswordContext';
import { useInitializeTheme } from '@/hooks/useTheme';
import { useCollections } from '@/hooks/useCollections';
import { useNotifications } from '@/hooks/useNotifications';
import { getArweaveWallet } from '@/lib/arweave';
import { isTransactionConfirmed } from '@/lib/collections-storage';
import { Badge } from '@/components/ui/badge';
import type { Prompt, PromptVersion } from '@/types/prompt';
import { searchPrompts } from '@/lib/search';
import { evaluateExpression } from '@/lib/boolean';
import type { FileImportResult } from '@/lib/import';
import { getViewMode, saveViewMode, hasEncryptedPromptsInCache } from '@/lib/storage';
import type { EncryptedData } from '@/lib/encryption';
import { findDuplicates } from '@/lib/duplicates';

function App() {
  useInitializeTheme();
  const { address, connected } = useWallet();
  const { password, setPassword, hasPassword } = usePassword();
  const {
    prompts,
    loading,
    searchQuery,
    selectedTags,
    booleanExpression,
    loadPrompts,
    addPrompt,
    updatePrompt,
    archivePrompt,
    restorePrompt,
  } = usePrompts();

  // Collections management with Arweave sync
  const arweaveWallet = getArweaveWallet();

  // Notifications for Arweave uploads
  const notifications = useNotifications(address, isTransactionConfirmed);

  // Notification callbacks for collections
  const handleCollectionUploadStart = useCallback((txId: string, count: number) => {
    notifications.addNotification(
      'collection',
      txId,
      'Collections uploaded',
      `Syncing ${count} collection${count === 1 ? '' : 's'} to Arweave`
    );
  }, [notifications]);

  const handleCollectionUploadComplete = useCallback((txId: string) => {
    notifications.markAsConfirmed(txId);
  }, [notifications]);

  const handleCollectionUploadError = useCallback((error: string) => {
    console.error('[App] Collections upload error:', error);
  }, []);

  const collections = useCollections(
    address,
    arweaveWallet,
    handleCollectionUploadStart,
    handleCollectionUploadComplete,
    handleCollectionUploadError
  );

  const [showArchived, setShowArchived] = useState(false);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [notificationsDialogOpen, setNotificationsDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'cards'>(() => getViewMode());
  const [passwordPromptOpen, setPasswordPromptOpen] = useState(false);
  const [passwordUnlockOpen, setPasswordUnlockOpen] = useState(false);
  const [sampleEncryptedData, setSampleEncryptedData] = useState<EncryptedData | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const toggleViewMode = () => {
    const newMode = viewMode === 'list' ? 'cards' : 'list';
    setViewMode(newMode);
    saveViewMode(newMode);
  };

  // Determine which password dialog to show when wallet connects
  useEffect(() => {
    const checkForEncryptedPrompts = async () => {
      if (!connected || hasPassword) return;

      // Check if user has existing encrypted prompts
      const hasEncrypted = hasEncryptedPromptsInCache();

      if (hasEncrypted) {
        // Returning user - fetch one encrypted prompt for password validation
        console.log('[App] User has encrypted prompts, showing unlock dialog');

        // Get first encrypted prompt from cache
        const { getCachedPrompts } = await import('@/lib/storage');
        const cached = getCachedPrompts();
        const encryptedPrompt = Object.values(cached).find(p =>
          !p.tags.some(tag => tag.toLowerCase() === 'public')
        );

        if (encryptedPrompt) {
          // Fetch the encrypted content for password validation
          const { fetchPrompt } = await import('@/lib/arweave');
          const promptWithEncrypted = await fetchPrompt(
            encryptedPrompt.currentTxId,
            undefined,
            true // skipDecryption
          );

          if (promptWithEncrypted && typeof promptWithEncrypted.content === 'object') {
            setSampleEncryptedData(promptWithEncrypted.content);
            setPasswordUnlockOpen(true);
          } else {
            // Fallback to password prompt if we can't get encrypted data
            setPasswordPromptOpen(true);
          }
        } else {
          setPasswordPromptOpen(true);
        }
      } else {
        // New user - show password setup
        console.log('[App] New user, showing password setup dialog');
        setPasswordPromptOpen(true);
      }
    };

    checkForEncryptedPrompts();
  }, [connected, hasPassword]);

  // Load prompts after password is set
  useEffect(() => {
    if (connected && hasPassword) {
      loadPrompts(password || undefined);
    }
  }, [connected, hasPassword, password, loadPrompts]);

  const handlePasswordSet = (newPassword: string) => {
    setPassword(newPassword);
    setPasswordPromptOpen(false);
  };

  const handlePasswordUnlock = (unlockedPassword: string) => {
    setPassword(unlockedPassword);
    setPasswordUnlockOpen(false);
    setSampleEncryptedData(null);
  };

  // Filter prompts based on search and tags
  const filteredPrompts = prompts.filter(prompt => {
    // Archive filter
    if (showArchived && !prompt.isArchived) return false;
    if (!showArchived && prompt.isArchived) return false;

    // Duplicate filter
    if (showDuplicates) {
      const duplicateGroups = findDuplicates(prompts);
      const duplicateIds = new Set(
        duplicateGroups.flatMap(group => group.prompts.map(p => p.id))
      );
      if (!duplicateIds.has(prompt.id)) return false;
    }

    // Boolean expression filter (takes precedence over simple tag filter)
    if (booleanExpression) {
      if (!evaluateExpression(booleanExpression, prompt.tags)) return false;
    } else if (selectedTags.length > 0) {
      // Simple tag filter (only applies if no boolean expression)
      const hasAllTags = selectedTags.every(tag =>
        prompt.tags.some(t => t.toLowerCase() === tag.toLowerCase())
      );
      if (!hasAllTags) return false;
    }

    // Text search filter (works with both boolean and simple tag filters)
    if (searchQuery) {
      const searchIds = searchPrompts(searchQuery);
      if (!searchIds.includes(prompt.id)) return false;
    }

    return true;
  });

  // Reset selected index when filtered prompts change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredPrompts.length, searchQuery, selectedTags, booleanExpression, showArchived]);

  // Scroll selected item into view
  useEffect(() => {
    const selectedElement = document.querySelector(`[data-prompt-index="${selectedIndex}"]`);
    if (selectedElement) {
      selectedElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedIndex]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

      // Handle Escape to close dialogs
      if (event.key === 'Escape') {
        if (viewDialogOpen) {
          event.preventDefault();
          setViewDialogOpen(false);
          return;
        }
        if (editorOpen) {
          event.preventDefault();
          setEditorOpen(false);
          return;
        }
        if (versionHistoryOpen) {
          event.preventDefault();
          setVersionHistoryOpen(false);
          return;
        }
        if (uploadDialogOpen) {
          event.preventDefault();
          setUploadDialogOpen(false);
          return;
        }
        if (passwordPromptOpen) {
          event.preventDefault();
          setPasswordPromptOpen(false);
          return;
        }
        if (passwordUnlockOpen) {
          event.preventDefault();
          setPasswordUnlockOpen(false);
          return;
        }

        // Check if we're in the search input specifically
        const isSearchInput = target.getAttribute('type') === 'text' && target.getAttribute('placeholder')?.includes('Search');
        if (isSearchInput) {
          event.preventDefault();
          (target as HTMLInputElement).blur();
          return;
        }
      }

      const numResults = filteredPrompts.length;
      if (numResults === 0) return;

      // Check if we're in the search input specifically
      const isSearchInput = target.getAttribute('type') === 'text' && target.getAttribute('placeholder')?.includes('Search');

      // Block certain dialogs from all navigation
      const blockingDialogOpen = editorOpen || versionHistoryOpen || uploadDialogOpen || passwordPromptOpen || passwordUnlockOpen || viewDialogOpen;

      switch (event.key) {
        case 'ArrowDown':
          // Don't allow in any dialogs or when typing (except search)
          if (blockingDialogOpen) return;
          if (!isSearchInput && isTyping) return;
          event.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % numResults);
          break;
        case 'ArrowUp':
          // Don't allow in any dialogs or when typing (except search)
          if (blockingDialogOpen) return;
          if (!isSearchInput && isTyping) return;
          event.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + numResults) % numResults);
          break;
        case 'Enter':
          // Don't allow in any dialogs
          if (blockingDialogOpen) return;
          if (!isSearchInput && isTyping) return;
          event.preventDefault();
          handleView(filteredPrompts[selectedIndex]);
          break;
        case 'e':
          // Don't allow when dialogs are open or typing - PromptDialog handles its own shortcuts
          if (blockingDialogOpen || isTyping) return;
          event.preventDefault();
          handleEdit(filteredPrompts[selectedIndex]);
          break;
        case 'c':
          // Don't allow when dialogs are open or typing - PromptDialog handles its own shortcuts
          if (blockingDialogOpen || isTyping) return;
          event.preventDefault();
          handleCopy(filteredPrompts[selectedIndex]);
          break;
        case 'a':
          // Don't allow when dialogs are open or typing - PromptDialog handles its own shortcuts
          if (blockingDialogOpen || isTyping) return;
          event.preventDefault();
          if (filteredPrompts[selectedIndex].isArchived) {
            restorePrompt(filteredPrompts[selectedIndex].id, password || undefined);
          } else {
            archivePrompt(filteredPrompts[selectedIndex].id, password || undefined);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredPrompts, selectedIndex, selectedPrompt, viewDialogOpen, editorOpen, versionHistoryOpen, uploadDialogOpen, passwordPromptOpen, passwordUnlockOpen, password, archivePrompt, restorePrompt]);

  const handleCreateNew = () => {
    setEditingPrompt(null);
    setEditorOpen(true);
  };

  const handleView = (prompt: Prompt) => {
    setSelectedPrompt(prompt);
    setViewDialogOpen(true);
  };

  const handleEdit = (prompt: Prompt) => {
    setEditingPrompt(prompt);
    setEditorOpen(true);
    setViewDialogOpen(false);
  };

  const handleCopy = (prompt: Prompt) => {
    navigator.clipboard.writeText(prompt.content);
  };

  const handleSave = async (data: Partial<Prompt>) => {
    if (editingPrompt) {
      return await updatePrompt(editingPrompt.id, data, password || undefined);
    } else {
      return await addPrompt(data as Omit<Prompt, 'id' | 'createdAt' | 'updatedAt'>, password || undefined);
    }
  };

  const handleRestoreVersion = async (version: PromptVersion) => {
    if (!selectedPrompt) return;

    // Fetch the old version and create a new version from it
    const oldPrompt = await import('@/lib/arweave').then(m => m.fetchPrompt(version.txId, password || undefined));
    if (oldPrompt) {
      await updatePrompt(selectedPrompt.id, {
        content: oldPrompt.content,
        title: oldPrompt.title,
        description: oldPrompt.description,
        tags: oldPrompt.tags,
      }, password || undefined);
    }
  };

  const handleBatchImport = async (selectedPrompts: FileImportResult[]) => {
    let imported = 0;
    let updated = 0;
    const errors: string[] = [];

    for (const result of selectedPrompts) {
      if (!result.success || !result.prompt) continue;

      try {
        const existingPrompt = prompts.find(p => p.id === result.prompt!.id);

        if (existingPrompt) {
          // Update existing prompt
          await updatePrompt(existingPrompt.id, {
            title: result.prompt!.title,
            description: result.prompt!.description,
            content: result.prompt!.content,
            tags: result.prompt!.tags,
          }, password || undefined);
          updated++;
        } else {
          // Add new prompt
          await addPrompt({
            title: result.prompt!.title,
            description: result.prompt!.description,
            content: result.prompt!.content,
            tags: result.prompt!.tags,
            currentTxId: '',
            versions: [],
            isArchived: false,
            isSynced: false,
          } as Omit<Prompt, 'id' | 'createdAt' | 'updatedAt'>, password || undefined);
          imported++;
        }
      } catch (err) {
        errors.push(`${result.fileName}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    // Show summary
    let message = `Import Complete!\n\n`;
    if (imported > 0) {
      message += `✓ ${imported} new prompt${imported !== 1 ? 's' : ''} added\n`;
    }
    if (updated > 0) {
      message += `✓ ${updated} prompt${updated !== 1 ? 's' : ''} updated\n`;
    }
    if (errors.length > 0) {
      message += `\n⚠ ${errors.length} error${errors.length !== 1 ? 's' : ''}:\n`;
      message += errors.slice(0, 3).join('\n');
      if (errors.length > 3) {
        message += `\n... and ${errors.length - 3} more`;
      }
    }

    alert(message);
  };

  if (!connected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-6 max-w-md">
          <div className="animate-bounce-slow">
            <Folder className="h-16 w-16 sm:h-20 sm:w-20 mx-auto text-primary" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold">Pocket Prompt</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Your permanent, decentralized prompt library powered by Arweave.
            Connect your wallet to get started.
          </p>
          <WalletButton />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
          <h1 className="flex items-center gap-2 text-xl font-bold sm:text-2xl">
            <Folder className="h-5 w-5 sm:h-6 sm:w-6" />
            <span className="hidden sm:inline">Pocket Prompt</span>
            <span className="sm:hidden">PP</span>
          </h1>
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setUploadDialogOpen(true)}
                  >
                    <Upload className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Upload Files</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      setNotificationsDialogOpen(true);
                      notifications.markAllAsRead();
                    }}
                    className="relative"
                  >
                    <Bell className="h-4 w-4" />
                    {notifications.unreadCount > 0 && (
                      <Badge
                        variant="destructive"
                        className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px]"
                      >
                        {notifications.unreadCount > 9 ? '9+' : notifications.unreadCount}
                      </Badge>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Arweave Notifications</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <WalletButton />
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="space-y-8 px-4 py-6 sm:px-6 sm:py-10 lg:px-10">
        <section className="mx-auto flex max-w-6xl flex-col gap-4">
          <SearchBar
            showArchived={showArchived}
            setShowArchived={setShowArchived}
            viewMode={viewMode}
            onViewModeToggle={toggleViewMode}
            showDuplicates={showDuplicates}
            setShowDuplicates={setShowDuplicates}
            collections={collections}
          />
          {showArchived && (
            <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/30 px-4 py-2.5 text-sm">
              <ArchiveIcon className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Viewing archived prompts</span>
            </div>
          )}
          {showDuplicates && (
            <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-amber-500/10 px-4 py-2.5 text-sm">
              <Copy className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span className="font-medium text-amber-700 dark:text-amber-300">Showing potential duplicates only</span>
            </div>
          )}
        </section>

        <section className="mx-auto max-w-6xl">
        {loading ? (
          <div className="text-center py-12">
            <div className="relative inline-block">
              <div className="animate-spin inline-block w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full" role="status">
                <span className="sr-only">Loading...</span>
              </div>
              <Folder className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-5 w-5 text-primary animate-pulse" />
            </div>
            <p className="mt-4 text-muted-foreground animate-pulse">Fetching your prompts...</p>
          </div>
        ) : filteredPrompts.length === 0 ? (
          <div className="text-center py-12 space-y-4">
            <p className="text-muted-foreground text-lg">
              {prompts.length === 0
                ? "No prompts yet. Click the + button to create your first prompt!"
                : 'No prompts match your search. Try different filters?'}
            </p>
          </div>
        ) : (
          <>
            <div className="mb-4 text-sm text-muted-foreground">
              Showing {filteredPrompts.length} {filteredPrompts.length === 1 ? 'prompt' : 'prompts'}
              {(() => {
                const totalActive = prompts.filter(p => !p.isArchived).length;
                return filteredPrompts.length !== totalActive && !showArchived ? ` of ${totalActive} total` : '';
              })()}
            </div>
            {viewMode === 'list' ? (
          <div className="border border-border rounded-lg overflow-hidden bg-card">
            {filteredPrompts.map((prompt, index) => (
              <div key={`${prompt.id}-${index}`} data-prompt-index={index}>
                <PromptListItem
                  prompt={prompt}
                  isSelected={index === selectedIndex}
                  onView={() => handleView(prompt)}
                  onEdit={() => handleEdit(prompt)}
                  onArchive={() => archivePrompt(prompt.id, password || undefined)}
                  onRestore={() => restorePrompt(prompt.id, password || undefined)}
                  onCopy={() => handleCopy(prompt)}
                />
                {index < filteredPrompts.length - 1 && <div className="border-b border-border" />}
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredPrompts.map((prompt, index) => (
              <div key={`${prompt.id}-${index}`} data-prompt-index={index}>
                <PromptCard
                  prompt={prompt}
                  isSelected={index === selectedIndex}
                  onView={() => handleView(prompt)}
                  onEdit={() => handleEdit(prompt)}
                  onArchive={() => archivePrompt(prompt.id, password || undefined)}
                  onRestore={() => restorePrompt(prompt.id, password || undefined)}
                  onCopy={() => handleCopy(prompt)}
                />
              </div>
            ))}
          </div>
        )}
          </>
        )}
        </section>
      </main>

      {/* Dialogs */}
      <PromptDialog
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        prompt={selectedPrompt}
        onEdit={() => handleEdit(selectedPrompt!)}
        onArchive={() => archivePrompt(selectedPrompt!.id, password || undefined)}
        onShowVersions={() => {
          setViewDialogOpen(false);
          setVersionHistoryOpen(true);
        }}
      />

      <PromptEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        prompt={editingPrompt}
        onSave={handleSave}
      />

      <VersionHistory
        open={versionHistoryOpen}
        onOpenChange={setVersionHistoryOpen}
        prompt={selectedPrompt}
        onRestoreVersion={handleRestoreVersion}
      />

      <UploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onImport={handleBatchImport}
        existingPromptIds={prompts.map(p => p.id)}
        existingPrompts={prompts}
      />

      <NotificationsDialog
        open={notificationsDialogOpen}
        onOpenChange={setNotificationsDialogOpen}
        notifications={notifications.notifications}
        onClear={notifications.clearNotification}
        onClearAll={notifications.clearAll}
      />

      <PasswordPrompt
        open={passwordPromptOpen}
        onPasswordSet={handlePasswordSet}
        onCancel={() => setPasswordPromptOpen(false)}
      />

      <PasswordUnlock
        open={passwordUnlockOpen}
        sampleEncryptedData={sampleEncryptedData}
        onPasswordUnlock={handlePasswordUnlock}
        onCancel={() => setPasswordUnlockOpen(false)}
      />

      {/* Floating Action Button */}
      <Button
        onClick={handleCreateNew}
        size="lg"
        className="fixed bottom-6 right-6 rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-110 active:scale-95 z-50 h-14 w-14 sm:h-12 sm:w-auto sm:px-6"
        title="Create prompt"
      >
        <Plus className="h-6 w-6 sm:mr-2" />
        <span className="hidden sm:inline font-semibold">Prompt</span>
      </Button>
    </div>
  );
}

export default App;