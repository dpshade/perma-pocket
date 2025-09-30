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
}