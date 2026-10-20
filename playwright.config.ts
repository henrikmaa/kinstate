import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './browser-tests', fullyParallel: true,
  use: { browserName: 'chromium', headless: true },
  webServer: [
    { command: 'npm run preview -w @kinstate/example-vite -- --port 4273', url: 'http://127.0.0.1:4273', reuseExistingServer: false },
    { command: 'npm run start -w @kinstate/example-next -- --port 4274', url: 'http://127.0.0.1:4274', reuseExistingServer: false },
  ],
});
