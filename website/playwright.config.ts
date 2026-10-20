import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
const base = process.env.DOCS_BASE ?? '/kinstate/';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  use: { browserName: 'chromium', baseURL: `http://127.0.0.1:4291${base}`, colorScheme: 'light' },
  webServer: {
    command: 'npm run docs:build && npm run docs:check && npm run docs:preview -- --port 4291',
    env: { DOCS_BASE: base, DOCS_OUT_DIR: '.test-build' },
    url: `http://127.0.0.1:4291${base}`,
    reuseExistingServer: false,
    timeout: 120_000,
    cwd: fileURLToPath(new URL('..', import.meta.url)),
  },
});
