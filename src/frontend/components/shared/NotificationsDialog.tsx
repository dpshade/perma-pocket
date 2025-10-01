import { Bell, CheckCircle2, XCircle, Clock, Trash2, FolderOpen, FileText } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/frontend/components/ui/dialog';
import { Button } from '@/frontend/components/ui/button';
import { Badge } from '@/frontend/components/ui/badge';
import type { ArweaveNotification } from '@/shared/types/notification';

interface NotificationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notifications: ArweaveNotification[];
  onClear: (id: string) => void;
  onClearAll: () => void;
}

export function NotificationsDialog({
  open,
  onOpenChange,
  notifications,
  onClear,
  onClearAll,
}: NotificationsDialogProps) {
  const formatDate = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;

    // Less than 1 minute
    if (diff < 60000) {
      return 'Just now';
    }

    // Less than 1 hour
    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000);
      return `${minutes}m ago`;
    }

    // Less than 1 day
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      return `${hours}h ago`;
    }

    // More than 1 day
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusIcon = (status: ArweaveNotification['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-orange-500 animate-pulse" />;
      case 'confirmed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusBadge = (status: ArweaveNotification['status']) => {
    switch (status) {
      case 'pending':
        return (
          <Badge variant="outline" className="border-orange-500/50 bg-orange-500/10 text-orange-700 dark:text-orange-300">
            Pending
          </Badge>
        );
      case 'confirmed':
        return (
          <Badge variant="outline" className="border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-300">
            Confirmed
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="outline" className="border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-300">
            Failed
          </Badge>
        );
    }
  };

  const getTypeIcon = (type: ArweaveNotification['type']) => {
    switch (type) {
      case 'prompt':
        return <FileText className="h-4 w-4 text-primary" />;
      case 'collection':
        return <FolderOpen className="h-4 w-4 text-primary" />;
    }
  };

  const pending = notifications.filter(n => n.status === 'pending');
  const completed = notifications.filter(n => n.status !== 'pending');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px] gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4 text-primary" />
            Arweave Notifications
          </DialogTitle>
          <DialogDescription className="text-sm">
            Track your uploads to the Arweave network
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto px-6 pb-6">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Bell className="h-12 w-12 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">No notifications yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Upload activity will appear here
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Pending Transactions */}
              {pending.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-1">
                    Pending ({pending.length})
                  </h3>
                  {pending.map((notification) => (
                    <div
                      key={notification.id}
                      className="rounded-lg border border-orange-500/30 bg-orange-500/5 px-4 py-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          {getTypeIcon(notification.type)}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="text-sm font-semibold truncate">
                                {notification.title}
                              </h4>
                              {getStatusIcon(notification.status)}
                            </div>
                            {notification.description && (
                              <p className="text-xs text-muted-foreground mb-2">
                                {notification.description}
                              </p>
                            )}
                            <div className="flex items-center gap-2">
                              {getStatusBadge(notification.status)}
                              <span className="text-xs text-muted-foreground">
                                {formatDate(notification.timestamp)}
                              </span>
                            </div>
                            <div className="mt-2">
                              <a
                                href={`https://viewblock.io/arweave/tx/${notification.txId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-primary hover:underline font-mono"
                              >
                                {notification.txId.slice(0, 8)}...{notification.txId.slice(-8)}
                              </a>
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => onClear(notification.id)}
                          title="Clear notification"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Completed Transactions */}
              {completed.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-1">
                    History ({completed.length})
                  </h3>
                  {completed.map((notification) => (
                    <div
                      key={notification.id}
                      className="rounded-lg border border-border/70 bg-background/95 px-4 py-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          {getTypeIcon(notification.type)}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="text-sm font-semibold truncate">
                                {notification.title}
                              </h4>
                              {getStatusIcon(notification.status)}
                            </div>
                            {notification.description && (
                              <p className="text-xs text-muted-foreground mb-2">
                                {notification.description}
                              </p>
                            )}
                            {notification.error && (
                              <p className="text-xs text-red-600 dark:text-red-400 mb-2">
                                Error: {notification.error}
                              </p>
                            )}
                            <div className="flex items-center gap-2">
                              {getStatusBadge(notification.status)}
                              <span className="text-xs text-muted-foreground">
                                {formatDate(notification.timestamp)}
                              </span>
                            </div>
                            <div className="mt-2">
                              <a
                                href={`https://viewblock.io/arweave/tx/${notification.txId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-primary hover:underline font-mono"
                              >
                                {notification.txId.slice(0, 8)}...{notification.txId.slice(-8)}
                              </a>
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => onClear(notification.id)}
                          title="Clear notification"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-between border-t border-border/70 px-6 py-4">
          {notifications.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="h-9 px-4"
              onClick={onClearAll}
            >
              Clear All
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-9 px-4 ml-auto"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
