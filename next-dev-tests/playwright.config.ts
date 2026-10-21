import { defineConfig } from '@playwright/test';

const bundler = process.env.NEXT_TEST_BUNDLER ?? 'webpack';
if (!['webpack', 'turbopack'].includes(bundler)) throw new Error('Unknown Next test bundler');

export default defineConfig({
  testDir: '.',
  testMatch: 'compiler.spec.ts',
  workers: 1,
  use: { browserName: 'chromium', baseURL: 'http://127.0.0.1:4276' },
  webServer: {
    command: `npm exec -w @kinstate/example-next -- next dev --${bundler} --hostname 127.0.0.1 --port 4276`,
    url: 'http://127.0.0.1:4276',
    reuseExistingServer: false,
    timeout: 90000,
  },
});
