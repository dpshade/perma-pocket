# Edge Cases - Comprehensive Test Coverage

## Summary

**Total Tests: 175 ✅ (100% passing)**

All edge cases have been identified, tested, and fixed in the codebase.

## Test Files

1. **storage.edge.test.ts** - 30 tests
2. **search.edge.test.ts** - 44 tests
3. **versionHistory.edge.test.ts** - 30 tests
4. **Plus original tests** - 71 tests

---

## Storage Edge Cases (30 tests)

### Profile Management
- ✅ Corrupted JSON data in localStorage
- ✅ Profile with missing required fields
- ✅ Very long wallet addresses (10,000 chars)
- ✅ Special characters in wallet address
- ✅ Empty string as wallet address
- ✅ Extremely large prompt arrays (1,000 prompts)
- ✅ Concurrent profile updates
- ✅ Archiving/restoring non-existent prompts
- ✅ Prompts with extremely long titles (100,000 chars)
- ✅ Prompts with empty arrays

### Cache Management
- ✅ Corrupted cache JSON data
- ✅ Cache with missing fields
- ✅ Caching prompts with circular references
- ✅ Extremely large prompt content (1MB)
- ✅ Caching 1000+ prompts
- ✅ Prompts with null values in versions
- ✅ Prompts with undefined properties
- ✅ Getting cached prompt with empty string ID
- ✅ localStorage quota exceeded (DOMException)
- ✅ Clearing cache when empty
- ✅ Multiple rapid cache operations

### Theme Management
- ✅ Corrupted theme data
- ✅ Null theme value
- ✅ Undefined theme value
- ✅ Empty string theme
- ✅ Saving theme when localStorage fails
- ✅ Rapid theme toggles (100 iterations)

### Data Integrity
- ✅ Maintaining integrity after multiple operations
- ✅ Simultaneous profile and cache operations

---

## Search Edge Cases (44 tests)

### Indexing
- ✅ Empty array indexing
- ✅ Very large dataset (1,000 prompts)
- ✅ Prompts with very long content (100KB+)
- ✅ Special characters in all fields
- ✅ Emoji in content
- ✅ Null/undefined fields
- ✅ Adding same prompt multiple times (deduplication)
- ✅ Removing non-existent prompts
- ✅ Removing prompt that was never indexed
- ✅ Re-indexing after clear

**Code Fix:** Implemented proper index clearing and deduplication tracking with `indexedIds` Set.

### Search Queries
- ✅ Single character search
- ✅ Very long search queries (1,000+ words)
- ✅ Special regex characters
- ✅ Unicode characters
- ✅ Only whitespace
- ✅ Newlines and tabs
- ✅ Mixed case
- ✅ Partial word search
- ✅ Multiple words
- ✅ Boolean-like terms (AND, OR, NOT)
- ✅ Numeric search
- ✅ Search after prompt deletion

### Tag Filtering
- ✅ Empty prompts array
- ✅ Prompts with no tags
- ✅ Tags with special characters (c++, c#, f#)
- ✅ Tags with spaces
- ✅ Tags with emoji
- ✅ Extremely long tag names (1,000 chars)
- ✅ Case variations
- ✅ Partial tag matching
- ✅ All archived prompts
- ✅ Duplicate tags in same prompt

### Tag Collection
- ✅ Empty prompts array
- ✅ Prompts with no tags
- ✅ Duplicate tags
- ✅ Mixed case tags
- ✅ Tags with special characters
- ✅ Very large number of unique tags (2,000)
- ✅ Tags with unicode characters
- ✅ Alphabetical order with special characters
- ✅ Excluding archived prompts

### Performance
- ✅ Rapid sequential searches (100 searches)
- ✅ Rapid index updates (50 add/remove cycles)
- ✅ Large result sets (1,000 results)

**Code Fixes:**
- Completely reinitialize FlexSearch index on `indexPrompts()`
- Track indexed IDs to prevent duplicates
- Gracefully handle FlexSearch's internal limits on content size
- Proper error handling with try-catch and warnings

---

## Version History Edge Cases (30 tests)

### Version Arrays
- ✅ Prompt with no versions
- ✅ Prompt with single version
- ✅ Prompt with 100 versions
- ✅ Versions with duplicate version numbers
- ✅ Versions with non-sequential numbers
- ✅ Versions with same timestamps
- ✅ Versions with future timestamps
- ✅ Versions with negative timestamps
- ✅ Versions with zero timestamp

### Transaction IDs
- ✅ Empty txId
- ✅ Very long txId (10,000 chars)
- ✅ TxId with special characters
- ✅ Duplicate txIds in different versions
- ✅ Unicode characters in txId

### Change Notes
- ✅ Version without change note (undefined)
- ✅ Empty change note
- ✅ Very long change note (50,000+ chars)
- ✅ Change note with special characters
- ✅ Change note with newlines
- ✅ Change note with emoji

### Version Ordering
- ✅ Unordered versions
- ✅ Identifying latest version from unordered array
- ✅ Versions sorted by timestamp instead of version number

### Version Restoration
- ✅ Restoring first version
- ✅ Restoring middle version
- ✅ Creating new version after restoration

### Version Metadata
- ✅ Version with all optional fields missing
- ✅ Negative version number
- ✅ Zero version number
- ✅ Extremely large version number (MAX_SAFE_INTEGER)

---

## Key Code Improvements

### 1. Search Index Management
**Before:**
```typescript
const promptIndex = new Document({...});

export function indexPrompts(prompts: Prompt[]): void {
  prompts.forEach(prompt => {
    try {
      promptIndex.remove(prompt.id);
    } catch {}
  });
  // Only removed prompts in the new array, didn't clear old ones
}
```

**After:**
```typescript
let promptIndex = new Document({...});
const indexedIds = new Set<string>();

export function indexPrompts(prompts: Prompt[]): void {
  // Completely clear and reinitialize
  promptIndex = new Document({...});
  indexedIds.clear();

  prompts.forEach(prompt => {
    if (!prompt.isArchived) {
      try {
        promptIndex.add(prompt as any);
        indexedIds.add(prompt.id);
      } catch (error) {
        console.warn(`Failed to index prompt:`, error);
      }
    }
  });
}
```

### 2. Deduplication Tracking
**Added:**
```typescript
export function addToIndex(prompt: Prompt): void {
  if (!prompt.isArchived) {
    try {
      if (indexedIds.has(prompt.id)) {
        promptIndex.remove(prompt.id);
      }
      promptIndex.add(prompt as any);
      indexedIds.add(prompt.id);
    } catch (error) {
      console.warn(`Failed to add prompt to index:`, error);
    }
  }
}
```

### 3. Graceful Error Handling
All storage and search operations now:
- Use try-catch blocks
- Log warnings instead of throwing errors
- Return sensible defaults (empty arrays, null)
- Continue execution on non-critical errors

---

## Test Results

```
✓ src/lib/storage.test.ts       (15 tests)
✓ src/lib/storage.edge.test.ts  (30 tests)
✓ src/lib/search.test.ts        (20 tests)
✓ src/lib/search.edge.test.ts   (44 tests)
✓ src/lib/tagFilter.test.ts     (24 tests)
✓ src/lib/versionHistory.edge.test.ts (30 tests)
✓ src/lib/utils.test.ts         (5 tests)
✓ src/hooks/useTheme.test.ts    (7 tests)

Test Files  8 passed (8)
Tests       175 passed (175)
Duration    ~2.8s
```

---

## Coverage Areas

### ✅ Fully Covered
- Storage (localStorage) operations
- Search indexing and querying
- Tag filtering and organization
- Version history management
- Theme management
- Utility functions
- Error handling
- Data integrity
- Performance under load

### 📝 Test Characteristics
- **Robustness**: Tests with corrupted data, missing fields, extreme values
- **Performance**: Tests with 1,000+ items, rapid operations
- **Edge Values**: Empty strings, nulls, undefined, MAX_SAFE_INTEGER
- **Character Sets**: Unicode, emoji, special characters, regex chars
- **Concurrency**: Multiple rapid operations
- **Limits**: localStorage quota, FlexSearch limits

---

## Running Edge Case Tests

```bash
# Run all tests including edge cases
bunx vitest run

# Run only edge case tests
bunx vitest run src/**/*.edge.test.ts

# Watch mode for development
bunx vitest

# With UI
bunx vitest --ui
```

---

## Lessons Learned

1. **FlexSearch has internal limits** on content size - graceful degradation needed
2. **Index state management** requires complete reinitialization for clean state
3. **Deduplication** needs explicit tracking with a Set
4. **localStorage can fail** - all operations need try-catch
5. **Edge cases are everywhere** - test with extreme values, unicode, special chars
6. **Error messages should be warnings** for non-critical failures
7. **State tracking** (like indexedIds) prevents subtle bugs

---

**All edge cases identified, tested, and resolved! 🎉**