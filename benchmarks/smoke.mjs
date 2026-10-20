import assert from 'node:assert/strict';
import { build, preview } from 'vite';
import { chromium } from '@playwright/test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { libraries, workloads } from './schema.ts';
import { writeReport } from './report.mjs';

await build({ configFile: resolve('benchmarks/vite.config.ts'), logLevel: 'warn' });
const server = await preview({
  configFile: resolve('benchmarks/vite.config.ts'),
  preview: { host: '127.0.0.1', port: 0 },
  logLevel: 'warn',
});
let browser;
let reportDirectory;
try {
  reportDirectory = await mkdtemp(join(tmpdir(), 'kinstate-benchmark-smoke-'));
  const report = JSON.parse(await readFile(resolve('benchmarks/latest.json'), 'utf8'));
  await writeReport(report, reportDirectory);
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}`);
  await page.waitForFunction(() => window.benchmarkReady);
  for (const workload of workloads) {
    let checksum;
    for (const library of libraries) {
      const sample = await page.evaluate(
        async ({ library, test }) => window.runBenchmark(library, test),
        {
          library,
          test: {
            workload,
            size: 1000,
            consumers: workload === 'full-list-row' ? 1000 : 10,
            operations: 5,
          },
        },
      );
      for (const key of ['setupMs', 'mountMs', 'updateMs', 'unmountMs', 'renders'])
        assert.ok(Number.isFinite(sample[key]) && sample[key] >= 0);
      checksum ??= sample.checksum;
      assert.equal(sample.checksum, checksum, `${workload}: library output must match`);
    }
  }
  await page.goto(pathToFileURL(join(reportDirectory, 'report.html')).href);
  await page.locator('#workload').selectOption('array-visible-row');
  await page.locator('#size').selectOption('10000');
  assert.equal(await page.locator('.bar-row').count(), 4);
  assert.match(await page.locator('.direction').textContent(), /Lower is better/);
  for (const metric of ['startup', 'setup', 'mount', 'unmount', 'renders', 'update']) {
    await page.locator('#metric').selectOption(metric);
    assert.equal(await page.locator('.bar-row').count(), 4);
    assert.match(await page.locator('#status').textContent(), /Lower is better/);
  }
  await page.screenshot({ path: '/tmp/kinstate-benchmark-desktop.png', fullPage: true });
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download raw JSON' }).click();
  assert.equal((await downloaded).suggestedFilename(), 'results.json');
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    false,
    'No mobile page overflow',
  );
  await page.screenshot({ path: '/tmp/kinstate-benchmark-mobile.png', fullPage: true });
  await page.locator('#size').selectOption('all');
  assert.equal(await page.locator('.comparison').count(), 3);
  assert.deepEqual(errors, []);
  console.log(
    `Passed ${workloads.length * libraries.length} production adapter checks and report filters, charts, download and mobile layout.`,
  );
} finally {
  try {
    await browser?.close();
  } finally {
    try {
      await new Promise((done, reject) =>
        server.httpServer.close((error) => (error ? reject(error) : done())),
      );
    } finally {
      if (reportDirectory) await rm(reportDirectory, { recursive: true, force: true });
    }
  }
}
