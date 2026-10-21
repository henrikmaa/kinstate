import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import kinstate from './packages/compiler/src/vite.js';
const path = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));
export default defineConfig({
  plugins: [kinstate()],
  resolve: { alias: [
    { find: '@kinstate/core/internal', replacement: path('./packages/core/src/internal.ts') },
    { find: '@kinstate/react/internal', replacement: path('./packages/react/src/internal.ts') },
    { find: '@kinstate/react', replacement: path('./packages/react/src/index.tsx') },
    { find: '@kinstate/core', replacement: path('./packages/core/src/index.ts') },
  ] },
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'jsdom', include: ['packages/**/*.test.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.next/**'],
    restoreMocks: true,
  },
});
