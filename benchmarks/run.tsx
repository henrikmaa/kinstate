import { build, preview } from 'vite';
import { chromium } from '@playwright/test';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { cpus, platform, arch, totalmem } from 'node:os';
import { resolve } from 'node:path';
import { libraries, workloads } from './schema.js';
import { benchmarkCases } from './cases.js';
import { benchmarkProvenance } from './provenance.mjs';
import type { Report, Result, Sample } from './schema.js';
// @ts-ignore JavaScript report writer is shared with node:test.
import { writeReport } from './report.mjs';

const args = process.argv.slice(2);
function numberOption(name: string, fallback: number): number {
  const index = args.indexOf(`--${name}`);
  if (index < 0) return fallback;
  const value = Number(args[index + 1]);
  if (!Number.isInteger(value) || value < 1)
    throw new Error(`--${name} requires a positive integer`);
  return value;
}
const quick = args.includes('--quick');
const samples = numberOption('samples', quick ? 2 : 7);
const warmups = numberOption('warmups', quick ? 1 : 2);
const operations = numberOption('operations', quick ? 5 : 30);
const sampleTimeoutMs = numberOption('timeout-ms', 120000);
const seed = numberOption('seed', 20261020);
let randomState = seed >>> 0;
function shuffled<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    randomState ^= randomState << 13;
    randomState ^= randomState >>> 17;
    randomState ^= randomState << 5;
    const j = (randomState >>> 0) % (i + 1);
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}
const cases = benchmarkCases(operations, quick);
const workloadOption = args.indexOf('--workload');
const selected = workloadOption < 0 ? undefined : new Set(args[workloadOption + 1]?.split(','));
if (selected && (!selected.size || [...selected].some((name) => !workloads.includes(name as any))))
  throw new Error('Unknown --workload (use comma-separated workload names)');
const sizeOption = args.indexOf('--size');
const selectedSize = sizeOption < 0 ? undefined : numberOption('size', 1000);
const selectedCases = cases.filter(
  (test) =>
    (!selected || selected.has(test.workload)) && (!selectedSize || test.size === selectedSize),
);
if (!selectedCases.length) throw new Error('No benchmark cases match the supplied filters');
const outputOption = args.indexOf('--output');
const outputDirectory = resolve(
  outputOption < 0 ? 'benchmarks' : (args[outputOption + 1] ?? 'benchmarks'),
);
const require = createRequire(import.meta.url);
async function version(name: string) {
  return JSON.parse(await readFile(require.resolve(`${name}/package.json`), 'utf8')).version;
}
await build({ configFile: resolve('benchmarks/vite.config.ts'), logLevel: 'warn' });
const provenance = await benchmarkProvenance();
const server = await preview({
  configFile: resolve('benchmarks/vite.config.ts'),
  logLevel: 'warn',
  preview: { host: '127.0.0.1', port: 0, open: false },
});
const address = server.httpServer.address();
if (!address || typeof address === 'string') throw new Error('Preview did not allocate a TCP port');
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const browserErrors: string[] = [];
  page.on('pageerror', (error) => browserErrors.push(error.message));
  await page.goto(`http://127.0.0.1:${address.port}`);
  await page.waitForFunction(() => (window as any).benchmarkReady === true);
  const production = await page.evaluate(() => (window as any).benchmarkProduction);
  if (!production) throw new Error('Benchmark must use a production build');
  const results: Result[] = [];
  for (const benchmarkCase of shuffled(selectedCases)) {
    console.log(`Measuring ${benchmarkCase.workload} / ${benchmarkCase.size} rows`);
    const byLibrary = Object.fromEntries(
      libraries.map((library) => [library, { ...benchmarkCase, library, samples: [] as Sample[] }]),
    ) as Record<(typeof libraries)[number], Result>;
    for (let trial = -warmups; trial < samples; trial++) {
      for (const library of shuffled(libraries)) {
        let deadline: ReturnType<typeof setTimeout> | undefined;
        let sample: Sample;
        try {
          sample = await Promise.race([
            page.evaluate(
              async ({ library, benchmarkCase }) =>
                (window as any).runBenchmark(library, benchmarkCase),
              { library, benchmarkCase },
            ),
            new Promise<never>((_, reject) => {
              deadline = setTimeout(
                () =>
                  reject(
                    new Error(
                      `${library}/${benchmarkCase.workload}/${benchmarkCase.size}: sample ${trial} exceeded ${sampleTimeoutMs}ms`,
                    ),
                  ),
                sampleTimeoutMs,
              );
            }),
          ]);
        } finally {
          clearTimeout(deadline);
        }
        if (browserErrors.length) throw new Error(browserErrors.join('\n'));
        for (const key of [
          'setupMs',
          'mountMs',
          'updateMs',
          'unmountMs',
          'renders',
          'checksum',
        ] as const)
          if (!Number.isFinite(sample[key]) || sample[key] < 0)
            throw new Error(`Invalid ${key} from ${library}`);
        if (trial >= 0) byLibrary[library].samples.push({ ...sample, block: trial });
      }
    }
    results.push(...libraries.map((library) => byLibrary[library]));
    console.log(
      `Verified ${benchmarkCase.workload.padEnd(20)} ${String(benchmarkCase.size).padStart(6)} rows / ${benchmarkCase.consumers} consumers`,
    );
  }
  const finalProvenance = await benchmarkProvenance();
  if (
    ['sourceHash', 'lockfileHash', 'buildHash'].some(
      (field) =>
        provenance[field as keyof typeof provenance] !==
        finalProvenance[field as keyof typeof finalProvenance],
    )
  )
    throw new Error('Source, lockfile or production bundle changed during measurement');
  const report: Report = {
    schemaVersion: 1,
    timestamp: new Date().toISOString(),
    environment: {
      provenance,
      frameworkVersion: JSON.parse(await readFile('packages/core/package.json', 'utf8')).version,
      node: process.version,
      platform: platform(),
      arch: arch(),
      cpu: cpus()[0]?.model,
      logicalCpus: cpus().length,
      memoryGiB: +(totalmem() / 2 ** 30).toFixed(1),
      browser: browser.version(),
      userAgent: await page.evaluate(() => navigator.userAgent),
      mode: 'production',
      renderer: 'React DOM in headless Chromium',
      viewport: '1280 × 800',
      versions: Object.fromEntries(
        await Promise.all(
          ['react', 'react-dom', 'mobx', 'mobx-react-lite', 'zustand', 'valtio', 'vite'].map(
            async (name) => [name, await version(name)],
          ),
        ),
      ),
    },
    methodology: {
      samples,
      warmups,
      seed,
      scheduling:
        'Controlled commit benchmark: one synchronous logical transaction, one microtask checkpoint, then the same React flushSync checkpoint for every library; timing includes notification delivery and DOM commits, excludes correctness checks. No frame or paint wait.',
      coverage: { complete: selectedCases.length === cases.length && !quick, cases: selectedCases },
      limitations: [
        'Single machine, single browser process, sequential warmed runs; timings are not cross-device performance guarantees.',
        'Headless browser commit latency excludes paint, layout measurement, network, real API libraries and user-event dispatch.',
        'Large arrays use a bounded visible window; this is not a virtualization-library benchmark.',
        'Zustand uses one structurally shared immutable publication per transaction; proxy libraries mutate in place. Representation costs are included.',
        'Results are scenario-specific. Do not combine different workloads into an overall winner.',
        'Fresh stores and roots for every sample; setup and teardown are measured separately. No forced garbage collection; allocation and GC can affect outliers.',
      ],
    },
    results,
  };
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(resolve(outputDirectory, 'latest.json'), JSON.stringify(report, null, 2) + '\n');
  await writeReport(report, outputDirectory);
  console.log(
    `\nSaved ${outputDirectory}/report.html, RESULTS.md and latest.json (${results.length} comparisons, ${samples} measured samples each).`,
  );
} finally {
  await browser?.close();
  await new Promise<void>((resolveClose, reject) =>
    server.httpServer.close((error) => (error ? reject(error) : resolveClose())),
  );
}
