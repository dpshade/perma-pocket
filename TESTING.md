# Testing Documentation

PermaPocket has comprehensive test coverage for all core logic and utilities.

## Running Tests

```bash
# Run tests once
bun test --run
# or
bunx vitest run

# Run tests in watch mode
bunx vitest

# Run tests with UI
bunx vitest --ui

# Run with coverage
bunx vitest run --coverage
```

## Test Structure

All tests are located alongside their source files with `.test.ts` extension:

```
src/
├── lib/
│   ├── storage.ts
│   ├── storage.test.ts       # 15 tests
│   ├── search.ts
│   ├── search.test.ts        # 20 tests
│   ├── tagFilter.test.ts     # 24 tests (comprehensive tag logic)
│   ├── utils.ts
│   └── utils.test.ts         # 5 tests
├── hooks/
│   ├── useTheme.ts
│   └── useTheme.test.ts      # 7 tests
└── test/
    └── setup.ts              # Test configuration
```

## Test Coverage

### Total: 71 Tests Passing ✅

#### Storage Utilities (15 tests)
**File:** `src/lib/storage.test.ts`

- ✅ Profile Management (7 tests)
  - Get/save/initialize user profiles
  - Add/update prompt metadata
  - Archive/restore prompts

- ✅ Prompt Caching (5 tests)
  - Cache and retrieve prompts
  - Handle missing prompts
  - Clear all cache

- ✅ Theme Management (3 tests)
  - Get/save theme preferences
  - Default to light theme

#### Search Functionality (20 tests)
**File:** `src/lib/search.test.ts`

- ✅ Indexing (4 tests)
  - Index prompts for search
  - Exclude archived prompts
  - Add/remove from index

- ✅ Searching (6 tests)
  - Search by title, description, content, tags
  - Handle empty queries
  - Case-insensitive search

- ✅ Tag Filtering (5 tests)
  - Filter by single/multiple tags
  - Exclude archived prompts
  - Case-insensitive matching

- ✅ Tag Collection (5 tests)
  - Get all unique tags
  - Exclude archived prompt tags
  - Return sorted tags

#### Tag/Filter/Folder Logic (24 tests)
**File:** `src/lib/tagFilter.test.ts`

This comprehensive test suite validates ALL tag and filtering logic:

- ✅ Single Tag Filtering (5 tests)
  - Filter by individual tags
  - Handle non-matching tags
  - Exclude archived prompts

- ✅ Multi-Tag Filtering with AND Logic (3 tests)
  - Filter by multiple tags (all must match)
  - Handle no matches
  - Match specific combinations

- ✅ Tag Collection and Organization (4 tests)
  - Collect all unique tags
  - Exclude archived tags
  - Alphabetical sorting
  - Handle empty tags

- ✅ Tag Frequency and Organization (2 tests)
  - Count tag frequency
  - Identify most common tags

- ✅ Case Sensitivity Handling (2 tests)
  - Case-insensitive matching
  - Mixed case tags

- ✅ Edge Cases (6 tests)
  - Empty arrays/strings
  - All archived prompts
  - Duplicate tags

- ✅ Combined Filter Operations (3 tests)
  - Archive + tag filtering
  - Sequential filtering
  - Search + filter combinations

#### Utility Functions (5 tests)
**File:** `src/lib/utils.test.ts`

- ✅ className merger (cn function)
  - Merge class names
  - Handle conditional classes
  - Resolve Tailwind conflicts
  - Handle empty/null/undefined

#### Theme Hook (7 tests)
**File:** `src/hooks/useTheme.test.ts`

- ✅ Theme State Management
  - Initialize with default
  - Set dark/light theme
  - Toggle theme
  - Persist to localStorage
  - Load from localStorage
  - Update document class

## Test Configuration

**Framework:** Vitest
**Test Environment:** jsdom
**React Testing:** @testing-library/react
**Setup File:** `src/test/setup.ts`

### Setup File Contents

The setup file:
- Cleans up after each test
- Clears localStorage between tests
- Mocks window.arweaveWallet for wallet tests
- Configures @testing-library/jest-dom matchers

## Writing New Tests

### Example Test

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { myFunction } from './myFile';

describe('My Feature', () => {
  beforeEach(() => {
    // Clean up before each test
    localStorage.clear();
  });

  it('should do something', () => {
    const result = myFunction('input');
    expect(result).toBe('expected');
  });
});
```

### Best Practices

1. **Clear state between tests**: Use `beforeEach` to reset localStorage and other state
2. **Test edge cases**: Empty inputs, null/undefined, extreme values
3. **Use descriptive names**: Test names should clearly describe what's being tested
4. **Group related tests**: Use `describe` blocks to organize tests logically
5. **Test behavior, not implementation**: Focus on what the code does, not how

## Continuous Integration

Add to your CI pipeline:

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bunx vitest run
```

## Coverage Goals

Current coverage focuses on:
- ✅ All core business logic
- ✅ All tag/filter/folder operations
- ✅ All storage operations
- ✅ All search functionality
- ✅ Theme management
- ✅ Utility functions

Future coverage could include:
- [ ] Arweave integration (requires mocking)
- [ ] React hooks (useWallet, usePrompts)
- [ ] Component rendering tests
- [ ] Integration tests

## Notes

- **Bun native test runner** has issues with jsdom/localStorage, so we use `bunx vitest` instead
- **ArConnect wallet** is mocked in the setup file
- **Arweave uploads** are not tested (would require extensive mocking)
- **Components** are not tested yet (future addition)