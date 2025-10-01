# AGENTS.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
```bash
bun run dev          # Start Vite dev server on http://localhost:5173
bun run build        # TypeScript check + production build
bun run preview      # Preview production build locally
bun run lint         # Run ESLint
```

### Testing
```bash
bunx vitest run      # Run all tests once
bunx vitest          # Run tests in watch mode
bunx vitest --ui     # Run tests with interactive UI
bunx vitest run --coverage  # Run with coverage report

# Test only specific files
bunx vitest run src/lib/storage.test.ts
bunx vitest run src/**/*.edge.test.ts  # Only edge case tests
```

**Note:** Use `bunx vitest` instead of `bun test` because Bun's native test runner has issues with jsdom/localStorage.

## Architecture Overview

### Tech Stack
- **Frontend:** React 18 + TypeScript + Vite
- **Storage:** Arweave (via Turbo SDK) + localStorage cache
- **Search:** FlexSearch (client-side full-text search)
- **State Management:** Zustand stores
- **Styling:** Tailwind CSS + shadcn/ui components
- **Wallet:** ArConnect browser extension

### Core Data Flow
1. User connects ArConnect wallet → queries Arweave via GraphQL for all prompts
2. GraphQL discovers all transactions with `Protocol: Pocket-Prompt-v3.2` + owner address
3. Full prompts fetched from Arweave and cached in localStorage under `pktpmt:prompts`
4. Profile metadata stored in localStorage for backward compatibility
5. On edit, new version uploaded to Arweave → version history preserved
6. FlexSearch index rebuilt on prompt load for client-side search

**GraphQL Query Strategy:**
- **Primary:** Goldsky (https://arweave-search.goldsky.com/graphql) - faster indexing, better reliability
- **Fallback:** Arweave.net (https://arweave.net/graphql) - automatic fallback if Goldsky fails
- Goldsky typically indexes new transactions within seconds vs minutes for arweave.net
- All queries automatically retry with fallback endpoint on failure

**⚠️ GraphQL Indexing Delay:**
- **Goldsky:** Usually 10-30 seconds for new prompts to become discoverable
- **Arweave.net fallback:** May take 1-10 minutes
- During indexing, prompts are cached locally and accessible, but won't sync across devices until indexed

### State Management (Zustand)
- **useWallet** (`src/hooks/useWallet.ts`): Wallet connection state
- **usePrompts** (`src/hooks/usePrompts.ts`): Prompts CRUD + search/filter state
- **useTheme** (`src/hooks/useTheme.ts`): Dark/light theme persistence

### Key Architectural Decisions

#### Version Control System
Each prompt edit creates a new Arweave transaction with full content. Previous versions remain accessible forever on Arweave. The `versions` array tracks all transaction IDs chronologically.

#### Caching Strategy
- **Profile metadata** (small): Always in localStorage, synced on changes
- **Full prompts** (large): Cached in localStorage, fetched from Arweave only if missing
- **Search index**: Built in-memory on app load from cached prompts

#### Search Implementation
FlexSearch indexes title, description, content, and tags. Index is rebuilt completely on `indexPrompts()` to avoid stale data. The `indexedIds` Set prevents duplicate indexing.

#### Tag Filtering
Tags use case-insensitive AND logic (all selected tags must match). Archived prompts always excluded from search/filters.

## Important Implementation Details

### Arweave Upload Tags
All uploads include comprehensive tags for discoverability:
- `App-Name: Pocket Prompt`
- `App-Version: 3.3.0` (semantic versioning)
- `Protocol: Pocket-Prompt-v3.3` (wallet + password hybrid encryption)
- `Type: prompt`
- `Prompt-Id: {uuid}`
- `Tag: {tag}` (one per user tag)
- `Encrypted: true|false`
- `Archived: true|false`

**⚠️ PROTOCOL VERSION HISTORY:**
- **v1:** Per-transaction RSA encryption (**INCOMPATIBLE** - deprecated)
- **v2:** Hybrid period - v2 tags but some used v1 encryption (**INCOMPATIBLE** - deprecated)
- **v3.0:** Session-based encryption with incorrect key wrapping (**INCOMPATIBLE** - deprecated)
- **v3.1:** Session-based encryption with signature() RSA-PSS (**INCOMPATIBLE** - deprecated)
- **v3.2:** Session-based encryption with signMessage() SHA-256 (**INCOMPATIBLE** - deprecated, non-deterministic signatures)
- **v3.3:** Wallet + password hybrid encryption (**CURRENT**)

GraphQL queries only search for v3.3 prompts. Old v1/v2/v3.0/v3.1/v3.2 prompts are not backward compatible and will be ignored.

The `App-Name` and `Protocol` tags are used in GraphQL queries to discover a user's library.

**Encryption Architecture (v3.3):**
- User provides password once per session (prompted on first encrypted operation)
- Master key derived from: PBKDF2(walletAddress + password, 250k iterations)
- Content encrypted with random AES-256-GCM key
- AES key encrypted with master key (proper key wrapping with IV)
- All subsequent operations: Use cached master key (zero additional password prompts)
- Session key cleared on wallet disconnect
- **Deterministic:** Same wallet + same password = same key (works across devices)
- **Secure:** Password is secret, high iteration PBKDF2 prevents brute-force
- **⚠️ WARNING:** Lost password = permanently encrypted data. No recovery possible.

**Versioning Strategy:**
- Uses **semantic versioning** (MAJOR.MINOR.PATCH)
- Protocol breaking changes = MAJOR version bump
- New features = MINOR version bump
- Bug fixes = PATCH version bump

See `src/lib/arweave.ts` for full tag structure and `src/lib/encryption.ts` for session-based encryption implementation.

### FlexSearch Index Management
The search index must be completely reinitialized (not just cleared) to avoid internal state issues. Always use:
```typescript
promptIndex = new Document({...});  // Reinitialize, don't just clear
indexedIds.clear();
```
See `src/lib/search.ts:27-46` for implementation.

### localStorage Error Handling
All storage operations wrapped in try-catch blocks. On quota exceeded or corruption:
- Log warning (console.warn)
- Return sensible defaults (empty arrays, null)
- Never throw errors that crash the app

See edge case tests in `src/lib/storage.edge.test.ts` for exhaustive coverage.

### Testing Philosophy
Tests focus on business logic and utilities, not UI components. Edge cases extensively covered:
- Corrupted data (malformed JSON)
- Extreme values (1000+ items, 100KB+ strings)
- Unicode/emoji/special characters
- Concurrent operations
- localStorage quota limits

Total: 175 tests (see EDGE_CASES.md for details).

## File Organization

```
src/
├── components/          # React components
│   ├── ui/             # shadcn/ui primitives
│   ├── WalletButton.tsx
│   ├── PromptCard.tsx
│   ├── PromptDialog.tsx
│   ├── PromptEditor.tsx
│   ├── VersionHistory.tsx
│   ├── SearchBar.tsx
│   └── ThemeToggle.tsx
├── hooks/              # Zustand stores
│   ├── useWallet.ts    # Wallet connection
│   ├── usePrompts.ts   # Prompts CRUD + filtering
│   └── useTheme.ts     # Theme persistence
├── lib/                # Core logic (heavily tested)
│   ├── arweave.ts      # Turbo SDK integration
│   ├── storage.ts      # localStorage management
│   ├── search.ts       # FlexSearch integration
│   └── utils.ts        # cn() class merger
├── types/
│   └── prompt.ts       # TypeScript interfaces
└── test/
    └── setup.ts        # Vitest config
```

## Development Workflow

### Adding New Features
1. Define TypeScript interfaces in `src/types/`
2. Implement core logic in `src/lib/` with comprehensive tests
3. Add state management in `src/hooks/` if needed
4. Build UI components in `src/components/`
5. Run `bunx vitest` to ensure all tests pass

### Modifying Arweave Upload
When changing prompt structure or tags:
1. Update `Prompt` interface in `src/types/prompt.ts`
2. Update upload tags in `src/lib/arweave.ts:30-54`
3. Consider backwards compatibility (old txIds must still be fetchable)
4. Increment `Protocol` version tag if breaking change

### Working with Search
When modifying search behavior:
1. Update FlexSearch config in `src/lib/search.ts:15-24`
2. Run edge case tests: `bunx vitest run src/lib/search.edge.test.ts`
3. Test with 1000+ prompts to ensure performance

### Browser Extension Required
Development requires ArConnect browser extension installed. Mock wallet is available in tests via `src/test/setup.ts:15-21`.

## Common Tasks

### Run Single Test File
```bash
bunx vitest run src/lib/storage.test.ts
```

### Debug Test Failures
```bash
bunx vitest --ui  # Interactive UI for debugging
```

### Check TypeScript Errors
```bash
tsc -b  # Type check without emitting files
```

### Build for Production
```bash
bun run build  # Outputs to dist/
```

### Add shadcn/ui Component
```bash
bunx shadcn-ui@latest add [component-name]
```

## Known Limitations

1. **ArConnect Only**: No support for other Arweave wallets yet
2. **Free Tier Size**: Uploads over 100 KiB require payment (Turbo credits)
3. **GraphQL Indexing Delay**: Newly uploaded prompts take 1-10 minutes to become discoverable via GraphQL. They're cached locally for immediate access, but won't sync across devices until indexed.
4. **No PWA**: Offline mode not implemented (could use service workers)
5. **Client-side Only**: No backend = no server-side rendering/indexing

## Related Projects

This app was inspired by [pocket-prompt-suite](https://github.com/dpshade/pocket-prompt-suite), a YAML-based prompt library at `/home/dpshade/Developer/pocket-prompt-suite/`.
