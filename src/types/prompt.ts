export interface Prompt {
  id: string;
  title: string;
  description: string;
  content: string;
  tags: string[];

  // Arweave data
  currentTxId: string;
  versions: PromptVersion[];

  // Metadata
  createdAt: number;
  updatedAt: number;
  isArchived: boolean;

  // Local cache
  isSynced: boolean;
}

export interface PromptVersion {
  txId: string;
  version: number;
  timestamp: number;
  changeNote?: string;
}

export interface UserProfile {
  address: string;
  profileTxId?: string;
  prompts: PromptMetadata[];
  lastSync: number;
}

export interface PromptMetadata {
  id: string;
  title: string;
  tags: string[];
  currentTxId: string;
  updatedAt: number;
  isArchived: boolean;
}

export interface ArweaveUploadResult {
  id: string;
  success: boolean;
  error?: string;
  prompt?: Prompt; // Optional, used for bulk uploads to return the full prompt with txId
}

export interface SavedSearch {
  id: string;
  name: string;
  description?: string;
  expression: BooleanExpression;
  textQuery?: string; // Optional text search to combine with boolean
  createdAt: number;
  updatedAt: number;
}

// Boolean expression types for tag-based search
export type ExpressionType = 'tag' | 'and' | 'or' | 'not';

export interface BooleanExpression {
  type: ExpressionType;
  value: string | BooleanExpression[];
}