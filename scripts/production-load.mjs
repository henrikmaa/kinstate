import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const extended = process.argv.includes('--long');
if (process.argv.slice(2).some((argument) => argument !== '--long'))
  throw new Error('Usage: node scripts/production-load.mjs [--long]');
function run(args, env = {}) {
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, ...env },
    maxBuffer: 8 * 1024 * 1024,
    timeout: extended ? 300_000 : 60_000,
  });
  if (result.status !== 0) {
    process.stderr.write(result.stdout ?? '');
    process.stderr.write(result.stderr ?? '');
    throw (
      result.error ?? new Error(`Load check failed (${result.signal ?? `exit ${result.status}`})`)
    );
  }
  return result.stdout;
}
const core = JSON.parse(
  run([
    '--expose-gc',
    '--import',
    'tsx',
    'scripts/production-load-core.mjs',
    ...(extended ? ['--long'] : []),
  ]),
);
// Vitest loads the production Babel transform, documented React APIs, and real DOM integration.
const temporary = mkdtempSync(join(tmpdir(), 'kinstate-load-'));
let react;
try {
  const report = join(temporary, 'react.json');
  run(
    [
      'node_modules/vitest/vitest.mjs',
      'run',
      'packages/tests/production-load.test.tsx',
      '--reporter=json',
      '--outputFile',
      report,
    ],
    { REACT_SERVICE_LOAD_LONG: extended ? '1' : '0', FORCE_COLOR: '0' },
  );
  react = JSON.parse(readFileSync(report, 'utf8'));
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
console.log(
  JSON.stringify(
    {
      schemaVersion: 1,
      core,
      react: {
        mountCycles: extended ? 1000 : 50,
        numPassedTests: react.numPassedTests,
        durationMs: Date.now() - react.startTime,
        success: react.success,
      },
    },
    null,
    2,
  ),
);
