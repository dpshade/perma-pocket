# Upload Strategies Comparison

## Overview

There are three strategies for uploading multiple prompts to Arweave, each with different signature requirements and tradeoffs.

## Strategy Comparison

### 1. Individual Sequential Uploads (Current Default)

**How it works:**
- Each prompt uploaded separately, one after another
- Each prompt gets its own unique transaction ID (txId)
- GraphQL discovers prompts individually

**Signature Requirements (10 prompts):**
- Encryption: 1 signature (master key derived once)
- Uploads: 10 signatures (one per prompt)
- **Total: 11 signatures**

**Pros:**
✅ Each prompt has unique txId
✅ Individual prompt updates work normally
✅ Fine-grained version control
✅ GraphQL returns specific prompts
✅ Can fetch single prompt without downloading others

**Cons:**
❌ Slower (sequential, not parallel)
❌ 10+ signature prompts from wallet

**Use Case:** Standard single-prompt uploads, editing existing prompts

```typescript
// Individual upload
const result = await uploadPrompt(prompt, wallet);
```

---

### 2. Bulk Parallel Uploads

**How it works:**
- Each prompt uploaded in parallel using `Promise.all()`
- Each prompt still gets unique transaction ID
- GraphQL discovers prompts individually

**Signature Requirements (10 prompts):**
- Encryption: 1 signature (master key cached)
- Uploads: 10 signatures (one per prompt)
- **Total: 11 signatures**

**Pros:**
✅ Each prompt has unique txId
✅ Much faster than sequential (parallel)
✅ Individual prompt updates work normally
✅ Fine-grained version control
✅ GraphQL returns specific prompts
✅ Partial success handling (some uploads can fail)

**Cons:**
❌ 10+ signature prompts from wallet

**Use Case:** Importing multiple prompts from files, bulk operations where individual txIds matter

```typescript
// Bulk parallel upload
const { success, results, errors } = await bulkUploadPrompts(prompts, wallet);

// Each result has its own txId
results.forEach(r => console.log(r.prompt.currentTxId));
```

---

### 3. Bundle Upload (Single Signature) ⭐

**How it works:**
- All prompts packaged into ONE JSON structure
- Single transaction with one txId (shared by all prompts)
- GraphQL discovers bundles (not individual prompts)

**Signature Requirements (10 prompts):**
- Encryption: 1 signature (master key derived once)
- Upload: 1 signature (for entire bundle)
- **Total: 2 signatures** ⭐

**Pros:**
✅ Minimal signatures (2 total)
✅ Fastest upload (single transaction)
✅ Single transaction fee
✅ Great UX for bulk imports

**Cons:**
❌ All prompts share same txId
❌ Must fetch entire bundle to access any prompt
❌ Cannot update individual prompts (must re-upload entire bundle)
❌ Bundle size limit (500 MiB)
❌ GraphQL returns bundles, requires extraction

**Use Case:** Initial bulk import, archiving collections, minimal signature scenarios

```typescript
// Bundle upload (1 signature for all prompts!)
const { bundleTxId, promptCount } = await uploadPromptBundle(prompts, wallet);

// All prompts share the same txId
console.log(`${promptCount} prompts in bundle ${bundleTxId}`);

// Later: fetch bundle and extract prompts
const bundle = await fetchPromptBundle(bundleTxId);
const prompts = extractPromptsFromBundle(bundle, bundleTxId);
```

---

## Detailed Comparison Table

| Feature | Individual | Bulk Parallel | Bundle |
|---------|-----------|---------------|--------|
| **Signatures (10 prompts)** | 11 | 11 | **2** ⭐ |
| **Upload Speed** | Slow (sequential) | Fast (parallel) | **Fastest (single tx)** |
| **Unique TxIds** | ✅ Yes | ✅ Yes | ❌ No (shared) |
| **Individual Updates** | ✅ Yes | ✅ Yes | ❌ No |
| **Version Control** | ✅ Fine-grained | ✅ Fine-grained | ❌ Bundle-level only |
| **Fetch Single Prompt** | ✅ Yes | ✅ Yes | ❌ Must fetch all |
| **GraphQL Discovery** | ✅ Per-prompt | ✅ Per-prompt | ❌ Per-bundle |
| **Transaction Fees** | 10 fees | 10 fees | **1 fee** ⭐ |
| **Size Limit** | 500 MiB/prompt | 500 MiB/prompt | 500 MiB total |
| **Partial Success** | N/A | ✅ Yes | ❌ All-or-nothing |

---

## Recommended Strategy by Use Case

### Use Individual Uploads When:
- Creating/editing single prompts
- Need to update specific prompts later
- Each prompt needs independent version history
- Standard app usage

### Use Bulk Parallel Uploads When:
- Importing multiple prompts from files
- Each prompt needs unique txId
- Need partial success handling
- Fine-grained control over individual prompts

### Use Bundle Uploads When:
- **Minimizing signatures is critical** ⭐
- Initial bulk import (won't update individually)
- Archiving prompt collections
- Exporting/sharing prompt sets
- Users complain about signature spam
- Transaction fees are a concern

---

## Migration Path

Applications can support all three strategies:

```typescript
// Detect use case and choose strategy
async function uploadPrompts(prompts: Prompt[], strategy: 'individual' | 'bulk' | 'bundle') {
  if (strategy === 'bundle') {
    // Best UX: 2 signatures for any number of prompts
    return await uploadPromptBundle(prompts, wallet);
  } else if (strategy === 'bulk') {
    // Good: Parallel, individual txIds
    return await bulkUploadPrompts(prompts, wallet);
  } else {
    // Standard: One at a time
    return await Promise.all(prompts.map(p => uploadPrompt(p, wallet)));
  }
}
```

---

## Implementation Files

- **Individual:** `src/lib/arweave.ts` → `uploadPrompt()`
- **Bulk Parallel:** `src/lib/arweave.ts` → `bulkUploadPrompts()`
- **Bundle:** `src/lib/arweave-bundle.ts` → `uploadPromptBundle()`

---

## Recommendation

For the **best user experience during bulk imports**, use **Bundle Upload**:
- Only 2 signatures total (vs 11+ signatures)
- Fastest upload speed
- Single transaction fee
- Perfect for "import 50 prompts from file" scenario

For **standard app usage** (creating/editing individual prompts), continue using **Individual Uploads**.

The hybrid approach provides maximum flexibility while minimizing signature spam where it matters most.
