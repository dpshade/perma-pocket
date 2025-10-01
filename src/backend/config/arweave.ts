/**
 * Arweave configuration utilities
 * Loads tag configuration from arweave.config.json
 */

import arweaveConfig from '../../../arweave.config.json';
import type { Prompt } from '@/shared/types/prompt';

interface ArweaveTag {
  name: string;
  value: string;
}

/**
 * Get static upload tags from config
 */
export function getStaticTags(): ArweaveTag[] {
  return arweaveConfig.upload.tags.map(tag => ({
    name: tag.name,
    value: tag.value,
  }));
}

/**
 * Get dynamic tags for a specific prompt
 */
export function getDynamicTags(prompt: Prompt, isEncrypted: boolean): ArweaveTag[] {
  const tags: ArweaveTag[] = [];

  // Process configured dynamic tags
  arweaveConfig.upload.dynamicTags.forEach(tagConfig => {
    if (tagConfig.name === 'Prompt-Id') {
      tags.push({ name: 'Prompt-Id', value: prompt.id });
    } else if (tagConfig.name === 'Title') {
      tags.push({ name: 'Title', value: prompt.title });
    } else if (tagConfig.name === 'Description') {
      tags.push({ name: 'Description', value: prompt.description || '' });
    } else if (tagConfig.name === 'Created-At') {
      tags.push({ name: 'Created-At', value: prompt.createdAt.toString() });
    } else if (tagConfig.name === 'Updated-At') {
      tags.push({ name: 'Updated-At', value: prompt.updatedAt.toString() });
    } else if (tagConfig.name === 'Version') {
      tags.push({ name: 'Version', value: prompt.versions.length.toString() });
    } else if (tagConfig.name === 'Encrypted') {
      tags.push({ name: 'Encrypted', value: isEncrypted ? 'true' : 'false' });
    } else if (tagConfig.name === 'Archived') {
      tags.push({ name: 'Archived', value: prompt.isArchived ? 'true' : 'false' });
    }
  });

  return tags;
}

/**
 * Get array tags (user-defined tags from prompt)
 */
export function getArrayTags(prompt: Prompt): ArweaveTag[] {
  return prompt.tags.map(tag => ({ name: 'Tag', value: tag }));
}

/**
 * Get all upload tags for a prompt
 */
export function getUploadTags(prompt: Prompt, isEncrypted: boolean): ArweaveTag[] {
  return [
    ...getStaticTags(),
    ...getDynamicTags(prompt, isEncrypted),
    ...getArrayTags(prompt),
  ];
}

/**
 * Get the protocol version from config
 */
export function getProtocolVersion(): string {
  const protocolTag = arweaveConfig.upload.tags.find(tag => tag.name === 'Protocol');
  return protocolTag?.value || 'Pocket-Prompt-v3.4';
}

/**
 * Get GraphQL query filters from config
 */
export function getQueryFilters() {
  return {
    protocol: arweaveConfig.query.filters.find(f => f.name === 'Protocol')?.values[0] || 'Pocket-Prompt-v3.4',
    appName: arweaveConfig.query.filters.find(f => f.name === 'App-Name')?.values[0] || 'Pocket Prompt',
  };
}
