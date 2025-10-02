import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import fs from 'fs'
import typescript from 'typescript'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      include: ['buffer', 'process', 'stream', 'util', 'crypto'],
      globals: {
        process: true,
        global: true,
        Buffer: true,
      },
    }),
    {
      name: 'service-worker',
      apply: 'build',
      writeBundle() {
        // Copy service worker to dist after build
        const srcPath = path.resolve(__dirname, 'src/sw.ts');
        const destPath = path.resolve(__dirname, 'dist/sw.js');

        // Compile TypeScript service worker
        const source = fs.readFileSync(srcPath, 'utf8');
        const result = typescript.transpileModule(source, {
          compilerOptions: {
            target: typescript.ScriptTarget.ES2020,
            module: typescript.ModuleKind.ES2020,
            lib: ['webworker', 'es2020']
          }
        });

        fs.writeFileSync(destPath, result.outputText);
      }
    }
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'fs': path.resolve(__dirname, './src/shared/polyfills/fs.ts'),
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
  },
})
