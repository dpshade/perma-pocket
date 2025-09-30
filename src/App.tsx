import { useEffect, useState } from 'react';
import { Plus, Archive as ArchiveIcon, Folder } from 'lucide-react';
import { WalletButton } from '@/components/WalletButton';
import { SearchBar } from '@/components/SearchBar';
import { PromptCard } from '@/components/PromptCard';
import { PromptDialog } from '@/components/PromptDialog';
import { PromptEditor } from '@/components/PromptEditor';
import { VersionHistory } from '@/components/VersionHistory';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { useWallet } from '@/hooks/useWallet';
import { usePrompts } from '@/hooks/usePrompts';
import { useInitializeTheme } from '@/hooks/useTheme';
import type { Prompt, PromptVersion } from '@/types/prompt';
import { searchPrompts } from '@/lib/search';
import { evaluateExpression } from '@/lib/boolean';

function App() {
  useInitializeTheme();
  const { connected } = useWallet();
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

  const [showArchived, setShowArchived] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);

  // Load prompts when wallet connects
  useEffect(() => {
    if (connected) {
      loadPrompts();
    }
  }, [connected]);

  // Filter prompts based on search and tags
  const filteredPrompts = prompts.filter(prompt => {
    // Archive filter
    if (showArchived && !prompt.isArchived) return false;
    if (!showArchived && prompt.isArchived) return false;

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
      return await updatePrompt(editingPrompt.id, data);
    } else {
      return await addPrompt(data as Omit<Prompt, 'id' | 'createdAt' | 'updatedAt'>);
    }
  };

  const handleRestoreVersion = async (version: PromptVersion) => {
    if (!selectedPrompt) return;

    // Fetch the old version and create a new version from it
    const oldPrompt = await import('@/lib/arweave').then(m => m.fetchPrompt(version.txId));
    if (oldPrompt) {
      await updatePrompt(selectedPrompt.id, {
        content: oldPrompt.content,
        title: oldPrompt.title,
        description: oldPrompt.description,
        tags: oldPrompt.tags,
      });
    }
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
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
          <h1 className="flex items-center gap-2 text-xl font-bold sm:text-2xl">
            <Folder className="h-5 w-5 sm:h-6 sm:w-6" />
            <span>Pocket Prompt</span>
          </h1>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <WalletButton />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="space-y-8 px-4 py-6 sm:px-6 sm:py-10 lg:px-10">
        <section className="mx-auto flex max-w-6xl flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={showArchived ? "outline" : "ghost"}
              size="sm"
              onClick={() => setShowArchived(!showArchived)}
              className="whitespace-nowrap"
            >
              <ArchiveIcon className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">{showArchived ? 'Hide' : 'Show'} Archived</span>
              <span className="sm:hidden">Archived</span>
            </Button>
            <Button onClick={handleCreateNew} size="sm" className="whitespace-nowrap">
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">New Prompt</span>
              <span className="sm:hidden">New</span>
            </Button>
          </div>
          <SearchBar />
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
            <div className="text-6xl animate-bounce-slow">📝</div>
            <p className="text-muted-foreground text-lg">
              {prompts.length === 0
                ? "No prompts yet. Time to create something awesome!"
                : 'No prompts match your search. Try different filters?'}
            </p>
            {prompts.length === 0 && (
              <Button onClick={handleCreateNew} className="mt-4 animate-wiggle">
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Prompt
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredPrompts.map(prompt => (
              <PromptCard
                key={prompt.id}
                prompt={prompt}
                onView={() => handleView(prompt)}
                onEdit={() => handleEdit(prompt)}
                onArchive={() => archivePrompt(prompt.id)}
                onRestore={() => restorePrompt(prompt.id)}
                onCopy={() => handleCopy(prompt)}
              />
            ))}
          </div>
        )}
        </section>
      </main>

      {/* Dialogs */}
      <PromptDialog
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        prompt={selectedPrompt}
        onEdit={() => handleEdit(selectedPrompt!)}
        onArchive={() => archivePrompt(selectedPrompt!.id)}
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
    </div>
  );
}

export default App;