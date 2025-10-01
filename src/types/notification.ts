export type NotificationType = 'prompt' | 'collection';
export type NotificationStatus = 'pending' | 'confirmed' | 'failed';

export interface ArweaveNotification {
  id: string;
  type: NotificationType;
  txId: string;
  title: string;
  description?: string;
  status: NotificationStatus;
  timestamp: number;
  error?: string;
}

export interface NotificationState {
  notifications: ArweaveNotification[];
  unreadCount: number;
}
