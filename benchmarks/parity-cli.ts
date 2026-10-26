import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { benchmarkCases } from './cases.js';
// @ts-ignore Shared JavaScript report/gate implementation.
import { evaluateParity, parityMarkdown } from './parity.mjs';
import { benchmarkProvenance } from './provenance.mjs';
const input = process.argv[2];
if (!input)
  throw new Error('Usage: npx tsx benchmarks/parity-cli.ts <latest.json> [update,startup,unmount]');
const report = JSON.parse(await readFile(input, 'utf8'));
const metrics = process.argv[3]?.split(',') ?? ['update', 'setup', 'mount', 'startup', 'unmount'];
if (metrics.some((metric) => !['update', 'startup', 'setup', 'mount', 'unmount'].includes(metric)))
  throw new Error('Unknown parity metric');
const operations = report.results[0]?.operations ?? 30;
const gate = evaluateParity(report, {
  expectedCases: benchmarkCases(operations),
  provenance: await benchmarkProvenance(),
  metrics,
});
await writeFile(resolve(input, '..', 'parity.json'), JSON.stringify(gate, null, 2) + '\n');
await writeFile(resolve(input, '..', 'PARITY.md'), parityMarkdown(gate));
console.log(parityMarkdown(gate));
// Missing/noisy/historical data is an unproven gate, never a successful CI run.
process.exitCode = gate.status === 'pass' ? 0 : gate.status === 'regression' ? 1 : 2;
