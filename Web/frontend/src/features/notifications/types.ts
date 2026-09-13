export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  link?: string;
  metadata?: Record<string, string>;
}

export interface NotificationPage {
  items: NotificationItem[];
  page: number;
  pageSize: number;
  total: number;
  unread: number;
}

export const NOTIFICATION_RECEIVED_EVENT = 'hsa:notification-received';

export type SearchResultType =
  | 'TRAINING'
  | 'LESSON'
  | 'SESSION'
  | 'USER'
  | 'EVALUATION'
  | 'PAYMENT'
  | 'CERTIFICATE';

export interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle?: string;
  link: string;
}

export interface SearchResponse {
  query: string;
  groups: Array<{ type: SearchResultType; items: SearchResult[] }>;
}
