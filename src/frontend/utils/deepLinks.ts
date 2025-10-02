/**
 * Deep Linking Utilities
 * Manages URL parameters for sharing app state
 */

import type { BooleanExpression } from '@/shared/types/prompt';
import { expressionToString, parseBooleanExpression } from '@/core/search/boolean';

export interface DeepLinkParams {
  /** Search query text */
  q?: string;
  /** Boolean expression filter */
  expr?: string;
  /** Collection/saved search ID */
  collection?: string;
  /** Specific prompt ID to view */
  prompt?: string;
  /** Show archived prompts */
  archived?: boolean;
  /** Show duplicates only */
  duplicates?: boolean;
  /** Public prompt Arweave TxID (no wallet required) */
  txid?: string;
}

/**
 * Parse URL search parameters into DeepLinkParams
 */
export function parseDeepLink(): DeepLinkParams {
  const params = new URLSearchParams(window.location.search);

  return {
    q: params.get('q') || undefined,
    expr: params.get('expr') || undefined,
    collection: params.get('collection') || undefined,
    prompt: params.get('prompt') || undefined,
    archived: params.get('archived') === 'true',
    duplicates: params.get('duplicates') === 'true',
    txid: params.get('txid') || undefined,
  };
}

/**
 * Update URL with current app state (without page reload)
 */
export function updateDeepLink(params: DeepLinkParams): void {
  const url = new URL(window.location.href);
  const searchParams = new URLSearchParams();

  // Add parameters if they exist
  if (params.q) searchParams.set('q', params.q);
  if (params.expr) searchParams.set('expr', params.expr);
  if (params.collection) searchParams.set('collection', params.collection);
  if (params.prompt) searchParams.set('prompt', params.prompt);
  if (params.archived) searchParams.set('archived', 'true');
  if (params.duplicates) searchParams.set('duplicates', 'true');
  if (params.txid) searchParams.set('txid', params.txid);

  // Update URL without reload
  const newUrl = searchParams.toString()
    ? `${url.pathname}?${searchParams.toString()}`
    : url.pathname;

  window.history.replaceState({}, '', newUrl);
}

/**
 * Clear all deep link parameters from URL
 */
export function clearDeepLink(): void {
  const url = new URL(window.location.href);
  window.history.replaceState({}, '', url.pathname);
}

/**
 * Generate a shareable URL for the current state
 */
export function generateShareableUrl(params: DeepLinkParams): string {
  const url = new URL(window.location.origin);
  const searchParams = new URLSearchParams();

  if (params.q) searchParams.set('q', params.q);
  if (params.expr) searchParams.set('expr', params.expr);
  if (params.collection) searchParams.set('collection', params.collection);
  if (params.prompt) searchParams.set('prompt', params.prompt);
  if (params.archived) searchParams.set('archived', 'true');
  if (params.duplicates) searchParams.set('duplicates', 'true');
  if (params.txid) searchParams.set('txid', params.txid);

  return searchParams.toString()
    ? `${url.origin}/?${searchParams.toString()}`
    : url.origin;
}

/**
 * Convert BooleanExpression to URL-safe string
 */
export function expressionToUrlParam(expression: BooleanExpression): string {
  return encodeURIComponent(expressionToString(expression));
}

/**
 * Parse URL-safe string back to BooleanExpression
 */
export function urlParamToExpression(param: string): BooleanExpression | null {
  try {
    const decoded = decodeURIComponent(param);
    return parseBooleanExpression(decoded);
  } catch (error) {
    console.error('Failed to parse expression from URL:', error);
    return null;
  }
}

/**
 * Get a shareable link for a specific prompt
 */
export function getPromptShareLink(promptId: string): string {
  return generateShareableUrl({ prompt: promptId });
}

/**
 * Get a shareable link for a search query
 */
export function getSearchShareLink(query: string): string {
  return generateShareableUrl({ q: query });
}

/**
 * Get a shareable link for a boolean expression filter
 */
export function getExpressionShareLink(expression: BooleanExpression): string {
  return generateShareableUrl({ expr: expressionToString(expression) });
}

/**
 * Get a shareable link for a collection
 */
export function getCollectionShareLink(collectionId: string): string {
  return generateShareableUrl({ collection: collectionId });
}

/**
 * Get a public shareable link for a prompt by Arweave TxID
 * This link works without wallet connection for public prompts
 */
export function getPublicPromptShareLink(txId: string): string {
  return generateShareableUrl({ txid: txId });
}
