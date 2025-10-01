#!/usr/bin/env bun
/**
 * Verification script to demonstrate config usage
 * Run with: bun run scripts/verify-config.ts
 */

import { getStaticTags, getDynamicTags, getArrayTags, getUploadTags, getQueryFilters, getProtocolVersion } from '../src/lib/arweave-config';
import type { Prompt } from '../src/types/prompt';

console.log('🔍 Pocket Prompt - Config Verification\n');
console.log('=' .repeat(60));

// 1. Show Protocol Version
console.log('\n📌 Protocol Version:');
console.log(`   ${getProtocolVersion()}`);

// 2. Show Query Filters
console.log('\n🔎 GraphQL Query Filters (from config):');
const filters = getQueryFilters();
console.log(`   Protocol: ${filters.protocol}`);
console.log(`   App-Name: ${filters.appName}`);

// 3. Show Static Tags
console.log('\n📦 Static Tags (from config):');
const staticTags = getStaticTags();
staticTags.forEach(tag => {
  console.log(`   ${tag.name}: ${tag.value}`);
});

// 4. Create a mock prompt
const mockPrompt: Prompt = {
  id: 'demo-123',
  title: 'Demo Prompt',
  description: 'Testing config integration',
  content: 'This is the prompt content',
  tags: ['demo', 'test', 'config'],
  createdAt: Date.now(),
  updatedAt: Date.now(),
  currentTxId: 'tx-abc123',
  versions: [
    { txId: 'tx-v1', version: 1, timestamp: Date.now() - 10000 },
    { txId: 'tx-v2', version: 2, timestamp: Date.now() },
  ],
  isSynced: true,
  isArchived: false,
};

// 5. Show Dynamic Tags
console.log('\n⚡ Dynamic Tags (generated for sample prompt):');
const dynamicTags = getDynamicTags(mockPrompt, true);
dynamicTags.forEach(tag => {
  console.log(`   ${tag.name}: ${tag.value}`);
});

// 6. Show Array Tags
console.log('\n🏷️  User Tags (from prompt):');
const arrayTags = getArrayTags(mockPrompt);
arrayTags.forEach(tag => {
  console.log(`   ${tag.name}: ${tag.value}`);
});

// 7. Show Complete Upload Tags
console.log('\n📤 Complete Upload Tag Set (encrypted prompt):');
const allTags = getUploadTags(mockPrompt, true);
console.log(`   Total tags: ${allTags.length}`);
console.log('\n   Full tag list:');
allTags.forEach((tag, idx) => {
  console.log(`   ${String(idx + 1).padStart(2, ' ')}. ${tag.name.padEnd(15, ' ')} : ${tag.value}`);
});

// 8. Verify consistency
console.log('\n✅ Config Consistency Check:');
const uploadProtocol = staticTags.find(t => t.name === 'Protocol')?.value;
const queryProtocol = filters.protocol;
const uploadAppName = staticTags.find(t => t.name === 'App-Name')?.value;
const queryAppName = filters.appName;

console.log(`   Upload Protocol === Query Protocol: ${uploadProtocol === queryProtocol} (${uploadProtocol})`);
console.log(`   Upload App-Name === Query App-Name: ${uploadAppName === queryAppName} (${uploadAppName})`);

// 9. Show public prompt tags for comparison
console.log('\n📤 Complete Upload Tag Set (public prompt):');
const publicTags = getUploadTags(mockPrompt, false);
const encryptedTag = publicTags.find(t => t.name === 'Encrypted');
console.log(`   Encrypted tag value: ${encryptedTag?.value}`);
console.log(`   Total tags: ${publicTags.length}`);

console.log('\n' + '='.repeat(60));
console.log('✨ Config verification complete!\n');
