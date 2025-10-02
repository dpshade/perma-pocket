import { useEffect, useState, useCallback, useRef } from 'react';
import { Plus, Archive as ArchiveIcon, Upload, Copy, Bell } from 'lucide-react';
import { WalletButton } from '@/frontend/components/wallet/WalletButton';
import { SearchBar, type SearchBarHandle } from '@/frontend/components/search/SearchBar';
import { PromptCard } from '@/frontend/components/prompts/PromptCard';
import { PromptListItem } from '@/frontend/components/prompts/PromptListItem';
import { PromptDialog } from '@/frontend/components/prompts/PromptDialog';
import { PromptEditor } from '@/frontend/components/prompts/PromptEditor';
import { VersionHistory } from '@/frontend/components/prompts/VersionHistory';
import { UploadDialog } from '@/frontend/components/shared/UploadDialog';
import { NotificationsDialog } from '@/frontend/components/shared/NotificationsDialog';
import { PasswordPrompt } from '@/frontend/components/wallet/PasswordPrompt';
import { PasswordUnlock } from '@/frontend/components/wallet/PasswordUnlock';
import { ThemeToggle } from '@/frontend/components/shared/ThemeToggle';
import { InstallPrompt } from '@/frontend/components/pwa/InstallPrompt';
import { PublicPromptView } from '@/frontend/components/prompts/PublicPromptView';
import { Button } from '@/frontend/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/frontend/components/ui/tooltip';
import { useWallet } from '@/frontend/hooks/useWallet';
import { usePrompts } from '@/frontend/hooks/usePrompts';
import { usePassword } from '@/frontend/contexts/PasswordContext';
import { useInitializeTheme } from '@/frontend/hooks/useTheme';
import { useCollections } from '@/frontend/hooks/useCollections';
import { useNotifications } from '@/frontend/hooks/useNotifications';
import { getArweaveWallet } from '@/backend/api/client';
import { isTransactionConfirmed } from '@/backend/api/collections';
import { Badge } from '@/frontend/components/ui/badge';
import type { Prompt, PromptVersion } from '@/shared/types/prompt';
import { searchPrompts } from '@/core/search';
import { evaluateExpression } from '@/core/search/boolean';
import type { FileImportResult } from '@/shared/utils/import';
import { getViewMode, saveViewMode, hasEncryptedPromptsInCache } from '@/core/storage/cache';
import type { EncryptedData } from '@/core/encryption/crypto';
import { findDuplicates } from '@/core/validation/duplicates';
import { parseDeepLink, updateDeepLink, urlParamToExpression } from '@/frontend/utils/deepLinks';

function App() {
  useInitializeTheme();

  // Check for public prompt viewing (txid parameter) - no wallet required
  const [publicTxId, setPublicTxId] = useState<string | null>(() => {
    const params = parseDeepLink();
    return params.txid || null;
  });

  const { address, connected } = useWallet();
  const { password, setPassword, hasPassword } = usePassword();
  const {
    prompts,
    loading,
    searchQuery,
    selectedTags,
    booleanExpression,
    activeSavedSearch,
    loadPrompts,
    addPrompt,
    updatePrompt,
    archivePrompt,
    restorePrompt,
    setUploadCallbacks,
    setSearchQuery,
    setBooleanExpression,
    loadSavedSearch,
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

  // Use refs to avoid re-registering callbacks on every render
  const uploadCallbacksRef = useRef({
    onStart: (txId: string, title: string) => {
      notifications.addNotification(
        'prompt',
        txId,
        'Prompt uploaded',
        `Syncing "${title}" to Arweave`
      );
    },
    onComplete: (txId: string) => {
      notifications.markAsConfirmed(txId);
    },
  });

  // Update ref when notifications change (doesn't trigger re-render)
  uploadCallbacksRef.current = {
    onStart: (txId: string, title: string) => {
      notifications.addNotification(
        'prompt',
        txId,
        'Prompt uploaded',
        `Syncing "${title}" to Arweave`
      );
    },
    onComplete: (txId: string) => {
      notifications.markAsConfirmed(txId);
    },
  };

  // Set up prompt upload callbacks (only once on mount)
  useEffect(() => {
    setUploadCallbacks(
      (txId, title) => uploadCallbacksRef.current.onStart(txId, title),
      (txId) => uploadCallbacksRef.current.onComplete(txId)
    );
  }, [setUploadCallbacks]); // Only depends on setUploadCallbacks (stable)

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
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);
  const searchBarRef = useRef<SearchBarHandle>(null);
  const [deepLinkInitialized, setDeepLinkInitialized] = useState(false);

  // Track grid columns for keyboard navigation
  const [gridColumns, setGridColumns] = useState(1);

  useEffect(() => {
    const updateGridColumns = () => {
      const width = window.innerWidth;
      if (width >= 1280) setGridColumns(4); // xl
      else if (width >= 1024) setGridColumns(3); // lg
      else if (width >= 640) setGridColumns(2); // sm
      else setGridColumns(1); // default
    };

    updateGridColumns();
    window.addEventListener('resize', updateGridColumns);
    return () => window.removeEventListener('resize', updateGridColumns);
  }, []);

  // Parse deep link parameters on initial load
  useEffect(() => {
    if (!connected || !hasPassword || deepLinkInitialized || prompts.length === 0) return;

    const params = parseDeepLink();

    // Apply search query
    if (params.q) {
      setSearchQuery(params.q);
    }

    // Apply boolean expression filter
    if (params.expr) {
      const expression = urlParamToExpression(params.expr);
      if (expression) {
        setBooleanExpression(expression, params.q);
      }
    }

    // Apply collection filter
    if (params.collection && collections.collections) {
      const savedSearch = collections.collections.find(
        (s: any) => s.id === params.collection
      );
      if (savedSearch) {
        loadSavedSearch(savedSearch);
      }
    }

    // Apply archived filter
    if (params.archived) {
      setShowArchived(true);
    }

    // Apply duplicates filter
    if (params.duplicates) {
      setShowDuplicates(true);
    }

    // Open specific prompt
    if (params.prompt) {
      const prompt = prompts.find(p => p.id === params.prompt);
      if (prompt) {
        setSelectedPrompt(prompt);
        setViewDialogOpen(true);
      }
    }

    setDeepLinkInitialized(true);
  }, [connected, hasPassword, deepLinkInitialized, prompts, collections.collections, setSearchQuery, setBooleanExpression, loadSavedSearch]);

  // Update URL when app state changes (debounced)
  useEffect(() => {
    if (!deepLinkInitialized) return;

    const timeoutId = setTimeout(() => {
      const { expressionToString } = require('@/core/search/boolean');
      const { wasPromptEncrypted } = require('@/core/encryption/crypto');

      // If viewing a public prompt, use txid instead of prompt id
      let txidParam: string | undefined;
      if (viewDialogOpen && selectedPrompt && selectedPrompt.currentTxId) {
        const isPublic = !wasPromptEncrypted(selectedPrompt.tags);
        if (isPublic) {
          txidParam = selectedPrompt.currentTxId;
        }
      }

      updateDeepLink({
        q: searchQuery || undefined,
        expr: booleanExpression && !activeSavedSearch ? expressionToString(booleanExpression) : undefined,
        collection: activeSavedSearch?.id,
        // Don't include prompt param if we're using txid
        prompt: !txidParam && viewDialogOpen && selectedPrompt ? selectedPrompt.id : undefined,
        archived: showArchived || undefined,
        duplicates: showDuplicates || undefined,
        txid: txidParam,
      });
    }, 300); // Debounce for 300ms

    return () => clearTimeout(timeoutId);
  }, [searchQuery, booleanExpression, activeSavedSearch, viewDialogOpen, selectedPrompt, showArchived, showDuplicates, deepLinkInitialized]);

  // Blur search input when any dialog opens
  useEffect(() => {
    const anyDialogOpen = viewDialogOpen || editorOpen || versionHistoryOpen || uploadDialogOpen || passwordPromptOpen || passwordUnlockOpen || notificationsDialogOpen;

    if (anyDialogOpen) {
      const activeElement = document.activeElement as HTMLElement;
      if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
        activeElement.blur();
      }
    }
  }, [viewDialogOpen, editorOpen, versionHistoryOpen, uploadDialogOpen, passwordPromptOpen, passwordUnlockOpen, notificationsDialogOpen]);

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
        const { getCachedPrompts } = await import('@/core/storage/cache');
        const cached = getCachedPrompts();
        const encryptedPrompt = Object.values(cached).find(p =>
          !p.tags.some(tag => tag.toLowerCase() === 'public')
        );

        if (encryptedPrompt) {
          // Fetch the encrypted content for password validation
          const { fetchPrompt } = await import('@/backend/api/client');
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
  // Get search results with scores for sorting
  const searchResults = searchQuery ? searchPrompts(searchQuery) : [];
  const searchScoreMap = new Map(searchResults.map(r => [r.id, r.score]));

  const filteredPrompts = prompts
    .filter(prompt => {
      // Archive filter - mutually exclusive
      if (showArchived) {
        // Only show archived prompts
        if (!prompt.isArchived) return false;
      } else {
        // Only show non-archived prompts
        if (prompt.isArchived) return false;
      }

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
        if (!searchScoreMap.has(prompt.id)) return false;
      }

      return true;
    })
    .sort((a, b) => {
      // When searching, sort by FlexSearch relevance score
      if (searchQuery && searchScoreMap.size > 0) {
        const scoreA = searchScoreMap.get(a.id) || 0;
        const scoreB = searchScoreMap.get(b.id) || 0;
        return scoreB - scoreA; // Higher score first
      }
      // Default sort by updatedAt (most recent first)
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

  // Reset selected index when filtered prompts change
  useEffect(() => {
    setSelectedIndex(-1);
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
          // If in search input, move to first result and blur search
          if (isSearchInput) {
            setSelectedIndex(0);
            searchBarRef.current?.blurSearchInput();
          } else if (viewMode === 'list') {
            // List view: go to next item
            setSelectedIndex((prev) => (prev + 1) % numResults);
          } else {
            // Grid view: go down one row
            setSelectedIndex((prev) => {
              const next = prev + gridColumns;
              return next < numResults ? next : prev;
            });
          }
          break;
        case 'ArrowUp':
          // Don't allow in any dialogs or when typing (except search)
          if (blockingDialogOpen) return;
          if (!isSearchInput && isTyping) return;
          event.preventDefault();

          if (viewMode === 'list') {
            // List view: if at top item (index 0), focus search input and unfocus results
            if (selectedIndex === 0) {
              searchBarRef.current?.focusSearchInput();
              setSelectedIndex(-1);
            } else {
              // Go to previous item
              setSelectedIndex((prev) => (prev - 1 + numResults) % numResults);
            }
          } else {
            // Grid view: if in top row, focus search input and unfocus results
            if (selectedIndex < gridColumns) {
              searchBarRef.current?.focusSearchInput();
              setSelectedIndex(-1);
            } else {
              // Go up one row
              setSelectedIndex((prev) => {
                const next = prev - gridColumns;
                return next >= 0 ? next : prev;
              });
            }
          }
          break;
        case 'ArrowLeft':
          // Only for grid view
          if (viewMode !== 'cards') return;
          if (blockingDialogOpen) return;
          if (!isSearchInput && isTyping) return;
          event.preventDefault();
          setSelectedIndex((prev) => {
            // Don't go left if we're at the first column
            const currentCol = prev % gridColumns;
            if (currentCol === 0) return prev;
            return prev - 1;
          });
          break;
        case 'ArrowRight':
          // Only for grid view
          if (viewMode !== 'cards') return;
          if (blockingDialogOpen) return;
          if (!isSearchInput && isTyping) return;
          event.preventDefault();
          setSelectedIndex((prev) => {
            // Don't go right if we're at the last column or last item
            const currentCol = prev % gridColumns;
            const isLastColumn = currentCol === gridColumns - 1;
            const isLastItem = prev === numResults - 1;
            if (isLastColumn || isLastItem) return prev;
            return prev + 1;
          });
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
  }, [filteredPrompts, selectedIndex, selectedPrompt, viewDialogOpen, editorOpen, versionHistoryOpen, uploadDialogOpen, passwordPromptOpen, passwordUnlockOpen, password, archivePrompt, restorePrompt, viewMode, gridColumns]);

  const handleCreateNew = () => {
    setEditingPrompt(null);
    setEditorOpen(true);
  };

  const handleView = (prompt: Prompt) => {
    // Open dialog immediately with cached data for instant response
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
    setCopiedPromptId(prompt.id);
    // Keep overlay visible long enough for fade-out animation (1000ms visible + 300ms fade-out)
    setTimeout(() => setCopiedPromptId(null), 1300);
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
    const oldPrompt = await import('@/backend/api/client').then(m => m.fetchPrompt(version.txId, password || undefined));
    if (oldPrompt) {
      await updatePrompt(selectedPrompt.id, {
        content: oldPrompt.content,
        title: oldPrompt.title,
        description: oldPrompt.description,
        tags: oldPrompt.tags,
      }, password || undefined);
    }
  };

  const handleExitPublicView = () => {
    setPublicTxId(null);
    const url = new URL(window.location.href);
    window.history.replaceState({}, '', url.pathname);
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

  // Public prompt view (no wallet required)
  if (publicTxId) {
    return <PublicPromptView txId={publicTxId} onBack={handleExitPublicView} />;
  }

  if (!connected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-6 max-w-md">
          <div className="animate-bounce-slow">
            <img src="/logo.svg" alt="Pocket Prompt Logo" className="h-16 w-16 sm:h-20 sm:w-20 mx-auto" />
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
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 sm:px-4 md:px-0 py-4 sm:py-4">
          <h1 className="flex items-center gap-2.5 sm:gap-2 text-lg font-bold sm:text-xl md:text-2xl">
            <img src="/logo.svg" alt="Pocket Prompt Logo" className="h-6 w-6 sm:h-6 sm:w-6" />
            <span className="sm:hidden">Pocket</span>
            <span className="hidden sm:inline">Pocket Prompt</span>
          </h1>
          <div className="flex items-center gap-2 sm:gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setUploadDialogOpen(true)}
                    className="h-10 w-10 sm:h-9 sm:w-9"
                  >
                    <Upload className="h-5 w-5 sm:h-4 sm:w-4" />
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
                    className="relative h-10 w-10 sm:h-9 sm:w-9"
                  >
                    <Bell className="h-5 w-5 sm:h-4 sm:w-4" />
                    {notifications.unreadCount > 0 && (
                      <Badge
                        variant="destructive"
                        className="absolute -top-0.5 -right-0.5 h-5 w-5 flex items-center justify-center p-0 text-[10px]"
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

            <WalletButton onSetPassword={() => setPasswordPromptOpen(true)} />
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="space-y-2 px-4 py-6 sm:px-6 sm:py-10 lg:px-10">
        <section className="mx-auto flex max-w-6xl flex-col gap-4">
          <SearchBar
            ref={searchBarRef}
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
              <img src="/logo.svg" alt="Pocket Prompt Logo" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-5 w-5 animate-pulse" />
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
            <div className="mb-4 ml-1 text-sm text-muted-foreground">
              Showing {filteredPrompts.length} {filteredPrompts.length === 1 ? 'prompt' : 'prompts'}
              {(() => {
                const totalActive = prompts.filter(p => !p.isArchived).length;
                return filteredPrompts.length !== totalActive && !showArchived ? ` of ${totalActive} total` : '';
              })()}
            </div>
            {viewMode === 'list' || window.innerWidth < 640 ? (
          <div className="border border-border rounded-lg overflow-hidden bg-card">
            {filteredPrompts.map((prompt, index) => (
              <div key={`${prompt.id}-${index}`} data-prompt-index={index}>
                <PromptListItem
                  prompt={prompt}
                  isSelected={index === selectedIndex}
                  isCopied={copiedPromptId === prompt.id}
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
          <div className="hidden sm:grid grid-cols-2 gap-5 lg:grid-cols-3 xl:grid-cols-4">
            {filteredPrompts.map((prompt, index) => (
              <div key={`${prompt.id}-${index}`} data-prompt-index={index}>
                <PromptCard
                  prompt={prompt}
                  isSelected={index === selectedIndex}
                  isCopied={copiedPromptId === prompt.id}
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
        password={password || undefined}
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
        className="fixed bottom-6 right-6 sm:bottom-6 sm:right-6 rounded-full shadow-xl hover:shadow-2xl transition-all hover:scale-110 active:scale-95 z-50 h-16 w-16 sm:h-14 sm:w-14 md:h-12 md:w-auto md:px-6 flex items-center justify-center"
        title="Create prompt"
      >
        <Plus className="h-7 w-7 sm:h-6 sm:w-6 md:mr-2 flex-shrink-0" />
        <span className="hidden md:inline font-semibold">Prompt</span>
      </Button>

      {/* PWA Install Prompt */}
      <InstallPrompt />
    </div>
  );
}

export default App;