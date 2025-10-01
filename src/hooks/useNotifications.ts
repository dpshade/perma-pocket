import { useState, useCallback, useEffect, useRef } from 'react';
import type { ArweaveNotification, NotificationType } from '@/types/notification';

const STORAGE_KEY = 'pktpmt_notifications';
const CHECK_INTERVAL_MS = 30000; // Check every 30 seconds

interface UseNotificationsReturn {
  notifications: ArweaveNotification[];
  unreadCount: number;
  addNotification: (
    type: NotificationType,
    txId: string,
    title: string,
    description?: string
  ) => void;
  markAsConfirmed: (txId: string) => void;
  markAsFailed: (txId: string, error: string) => void;
  clearNotification: (id: string) => void;
  clearAll: () => void;
  markAllAsRead: () => void;
}

/**
 * Hook for managing Arweave upload notifications
 * - Tracks pending, confirmed, and failed uploads
 * - Automatically checks pending transactions via GraphQL
 * - Persists notifications in localStorage
 */
export function useNotifications(
  walletAddress: string | null,
  checkPendingFn?: (txId: string) => Promise<boolean>
): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<ArweaveNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load notifications from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as ArweaveNotification[];
        setNotifications(parsed);

        // Count unread (pending + recent confirmed/failed)
        const now = Date.now();
        const fiveMinutesAgo = now - 5 * 60 * 1000;
        const unread = parsed.filter(
          n => n.status === 'pending' || n.timestamp > fiveMinutesAgo
        ).length;
        setUnreadCount(unread);
      }
    } catch (error) {
      console.error('[useNotifications] Failed to load from localStorage:', error);
    }
  }, []);

  // Save notifications to localStorage whenever they change
  useEffect(() => {
    if (notifications.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
    }
  }, [notifications]);

  // Periodically check pending notifications
  useEffect(() => {
    if (!walletAddress || !checkPendingFn) {
      return;
    }

    const checkPending = async () => {
      const pending = notifications.filter(n => n.status === 'pending');

      if (pending.length === 0) return;

      console.log(`[useNotifications] Checking ${pending.length} pending transactions...`);

      for (const notification of pending) {
        try {
          const isConfirmed = await checkPendingFn(notification.txId);

          if (isConfirmed) {
            console.log(`[useNotifications] Transaction confirmed: ${notification.txId}`);
            markAsConfirmed(notification.txId);
          }
        } catch (error) {
          console.warn(`[useNotifications] Failed to check ${notification.txId}:`, error);
        }
      }
    };

    // Check immediately
    checkPending();

    // Then check periodically
    checkIntervalRef.current = setInterval(checkPending, CHECK_INTERVAL_MS);

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [walletAddress, notifications, checkPendingFn]);

  /**
   * Add a new pending notification
   */
  const addNotification = useCallback(
    (type: NotificationType, txId: string, title: string, description?: string) => {
      const notification: ArweaveNotification = {
        id: crypto.randomUUID(),
        type,
        txId,
        title,
        description,
        status: 'pending',
        timestamp: Date.now(),
      };

      setNotifications(prev => [notification, ...prev]);
      setUnreadCount(prev => prev + 1);

      console.log(`[useNotifications] Added pending notification: ${title} (${txId})`);
    },
    []
  );

  /**
   * Mark a notification as confirmed
   */
  const markAsConfirmed = useCallback((txId: string) => {
    setNotifications(prev =>
      prev.map(n =>
        n.txId === txId
          ? { ...n, status: 'confirmed' as const, timestamp: Date.now() }
          : n
      )
    );
  }, []);

  /**
   * Mark a notification as failed
   */
  const markAsFailed = useCallback((txId: string, error: string) => {
    setNotifications(prev =>
      prev.map(n =>
        n.txId === txId
          ? { ...n, status: 'failed' as const, error, timestamp: Date.now() }
          : n
      )
    );
  }, []);

  /**
   * Clear a single notification
   */
  const clearNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  /**
   * Clear all notifications
   */
  const clearAll = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  /**
   * Mark all notifications as read
   */
  const markAllAsRead = useCallback(() => {
    setUnreadCount(0);
  }, []);

  return {
    notifications,
    unreadCount,
    addNotification,
    markAsConfirmed,
    markAsFailed,
    clearNotification,
    clearAll,
    markAllAsRead,
  };
}
