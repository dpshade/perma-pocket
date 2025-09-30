# PermaPocket

> Your permanent, decentralized prompt library powered by Arweave

PermaPocket is a fully client-side, web-based application for managing and storing AI prompts on Arweave's permanent blockchain storage. Built with React, TypeScript, and Tailwind CSS.

## ✨ Features

### Core Functionality
- **🔐 Wallet Integration**: Connect with ArConnect wallet for decentralized identity
- **📤 Free Arweave Storage**: Upload prompts under 100 KiB for free via Turbo SDK
- **🔍 Advanced Search**: Full-text search powered by FlexSearch
- **🏷️ Tag Management**: Organize prompts with tags and filter by multiple tags
- **📋 One-Click Copy**: Instantly copy prompts to clipboard
- **✏️ Edit & Version Control**: Create new versions on edit, navigate version history
- **🗄️ Archive System**: Soft delete with ability to restore archived prompts

### Technical Features
- **💾 Local Caching**: localStorage-based caching for fast loading
- **🌓 Dark Mode**: Built-in dark/light theme toggle
- **📱 Responsive Design**: Works on desktop, tablet, and mobile
- **🎨 Beautiful UI**: Built with shadcn/ui and Tailwind CSS
- **⚡ Fast & Lightweight**: Client-side only, no backend required

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) 18+ or [Bun](https://bun.sh/)
- [ArConnect](https://www.arconnect.io/) browser extension

### Installation

```bash
# Clone the repository
git clone https://github.com/dpshade/perma-pocket.git
cd perma-pocket

# Install dependencies (using Bun - faster!)
bun install
# or with npm
npm install

# Start development server
bun run dev
# or with npm
npm run dev
```

Visit `http://localhost:5173` and connect your ArConnect wallet to get started!

## 📖 Usage

### Getting Started
1. **Connect Wallet**: Click "Connect Wallet" and approve the ArConnect connection
2. **Create Prompt**: Click "New Prompt" to create your first prompt
3. **Add Details**: Fill in title, description, tags, and content
4. **Upload**: Click "Create & Upload" to save to Arweave (free under 100 KiB!)

### Managing Prompts
- **Search**: Use the search bar to find prompts by title, description, content, or tags
- **Filter by Tags**: Click tags to filter, or use the tag filter dropdown
- **View**: Click "View" on any prompt card to see full details
- **Copy**: One-click copy button on cards and in detail view
- **Edit**: Edit prompts to create new versions (old versions preserved)
- **Archive**: Hide prompts without deleting (can be restored)

### Version History
- Each edit creates a new version uploaded to Arweave
- View version history by clicking "Version History" in prompt details
- Restore any previous version (creates a new version with old content)
- All versions permanently stored on Arweave with unique transaction IDs

## 🏗️ Architecture

### Tech Stack
- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS + shadcn/ui components
- **Storage**: Arweave (via Turbo SDK) + localStorage cache
- **Search**: FlexSearch (client-side full-text search)
- **State Management**: Zustand
- **Wallet**: ArConnect integration

### Project Structure
```
src/
├── components/           # React components
│   ├── ui/              # shadcn/ui base components
│   ├── WalletButton.tsx # Wallet connection UI
│   ├── SearchBar.tsx    # Search and tag filtering
│   ├── PromptCard.tsx   # Prompt grid card
│   ├── PromptDialog.tsx # Full prompt view
│   ├── PromptEditor.tsx # Create/edit form
│   ├── VersionHistory.tsx # Version management
│   └── ThemeToggle.tsx  # Dark mode toggle
├── hooks/               # Custom React hooks
│   ├── useWallet.ts     # Wallet state management
│   ├── usePrompts.ts    # Prompts state management
│   └── useTheme.ts      # Theme state management
├── lib/                 # Core utilities
│   ├── arweave.ts       # Arweave/Turbo SDK integration
│   ├── storage.ts       # localStorage management
│   ├── search.ts        # FlexSearch integration
│   └── utils.ts         # Helper functions
└── types/               # TypeScript definitions
    └── prompt.ts        # Data models
```

### Data Models

#### Prompt
```typescript
interface Prompt {
  id: string;              // UUID
  title: string;
  description: string;
  content: string;         // Markdown
  tags: string[];
  currentTxId: string;     // Latest Arweave TX ID
  versions: PromptVersion[]; // Version history
  createdAt: number;
  updatedAt: number;
  isArchived: boolean;
  isSynced: boolean;
}
```

#### User Profile (localStorage)
```typescript
interface UserProfile {
  address: string;         // Wallet address
  prompts: PromptMetadata[]; // List of user's prompts
  lastSync: number;
}
```

## 🔧 Development

### Available Scripts
```bash
bun run dev      # Start development server
bun run build    # Build for production
bun run preview  # Preview production build
bun run lint     # Run ESLint

# Testing (see TESTING.md for details)
bunx vitest run  # Run all tests once
bunx vitest      # Run tests in watch mode
bunx vitest --ui # Run tests with interactive UI
```

### Environment Setup
No environment variables needed! PermaPocket is 100% client-side.

### Testing
PermaPocket has comprehensive test coverage (175 tests) for all core logic:
- Storage operations (localStorage)
- Search and indexing (FlexSearch)
- Tag filtering and organization
- Version history management
- Edge cases and error handling

See [TESTING.md](./TESTING.md) and [EDGE_CASES.md](./EDGE_CASES.md) for details.

## 🌐 Deployment

PermaPocket can be deployed to any static hosting service:

### Vercel / Netlify / Static Hosts
```bash
bun run build
# Deploy dist/ folder to any static hosting service
```

Build settings:
- **Build Command**: `bun run build` or `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `bun install` or `npm install`

### IPFS / Arweave (Fully Decentralized)
```bash
bun run build
# Upload dist/ folder to IPFS or Arweave
# Example with ArDrive CLI:
ardrive upload-file --local-path ./dist --parent-folder-id <folder-id>
```

## 📝 Roadmap

- [ ] **Import/Export**: Batch import from pocket-prompt-suite YAML files
- [ ] **Collection Sharing**: Share entire prompt collections via Arweave
- [ ] **Markdown Preview**: Live preview while editing
- [ ] **PWA Support**: Offline access to cached prompts
- [ ] **Multi-wallet**: Support for other Arweave wallets
- [ ] **Collaboration**: Share prompts with other users
- [ ] **Analytics**: Track most-used prompts locally

## 🤝 Contributing

Contributions welcome! This project is inspired by [pocket-prompt-suite](https://github.com/dpshade/pocket-prompt-suite).

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Write tests for new functionality
4. Run tests: `bunx vitest run`
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Development Guidelines
- See [AGENTS.md](./AGENTS.md) for architecture and development workflow
- All new features should include tests
- Follow existing code style (TypeScript + functional components)
- Update documentation when adding features

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- [Arweave](https://www.arweave.org/) - Permanent data storage
- [ArDrive Turbo](https://ardrive.io/turbo/) - Free uploads under 100 KiB
- [pocket-prompt-suite](https://github.com/dpshade/pocket-prompt-suite) - Original inspiration
- [shadcn/ui](https://ui.shadcn.com/) - Beautiful component library
- [FlexSearch](https://github.com/nextapps-de/flexsearch) - Fast search library

---

**Built with ❤️ for the permanent web**