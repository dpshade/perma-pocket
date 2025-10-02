- ensure we pass Running "bun run build"
$ tsc -b && vite build
src/frontend/components/search/SearchBar.tsx(32,5): error TS6133: 'clearFilters' is declared but its value is never read.
src/frontend/components/search/SearchBar.tsx(80,9): error TS6133: 'hasActiveFilters' is declared but its value is never read.
Error: Command "bun run build" exited with 2
after changes