import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const temporary = mkdtempSync(join(tmpdir(), 'kinstate-yarn-'));
function run(command, args, cwd) {
  return execFileSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 300000,
    maxBuffer: 16 * 1024 * 1024,
  });
}
try {
  const [{ filename }] = JSON.parse(
    run('npm', ['pack', '--json', '--pack-destination', temporary], root),
  );
  const consumer = join(temporary, 'consumer');
  mkdirSync(consumer);
  writeFileSync(
    join(consumer, 'package.json'),
    JSON.stringify({
      private: true,
      type: 'module',
      packageManager: 'yarn@4.18.1',
      dependencies: {
        kinstate: `file:${join(temporary, filename)}`,
        react: '19.3.1',
        'react-dom': '19.3.1',
        typescript: '5.9.3',
        '@types/react': '^19',
        '@types/react-dom': '^19',
        '@types/node': '^24',
        vite: '^8',
      },
    }),
  );
  writeFileSync(join(consumer, '.yarnrc.yml'), 'nodeLinker: node-modules\nenableScripts: false\n');
  console.log('Installing the self-contained distribution with Yarn 4.18.1.');
  run('corepack', ['yarn@4.18.1', 'install'], consumer);
  writeFileSync(
    join(consumer, 'consumer.mjs'),
    `import assert from 'node:assert/strict';import {Service} from 'kinstate';import {Service as SameService} from 'kinstate/core';import {ServiceProvider} from 'kinstate/react';import compiler from 'kinstate/compiler';import vite from 'kinstate/compiler/vite';assert.equal(Service,SameService);assert.equal(typeof ServiceProvider,'function');assert.equal(typeof compiler,'function');assert.equal(typeof vite,'function');`,
  );
  run(process.execPath, ['consumer.mjs'], consumer);
  writeFileSync(
    join(consumer, 'consumer.ts'),
    `import type {ComponentProps} from 'react';import {Service,ServiceScope} from 'kinstate/core';import {useService,ServiceProvider} from 'kinstate/react';import compiler from 'kinstate/compiler/vite';class Counter extends Service{count=0;increment(){this.count++}}function Consumer(){const service=useService(Counter);const count:number=service.count;service.increment();return count;}const provider:ComponentProps<typeof ServiceProvider>={scope:new ServiceScope([Counter]),services:[Counter],children:null};void provider;void compiler;void Consumer;`,
  );
  writeFileSync(
    join(consumer, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        strict: true,
        skipLibCheck: false,
        noEmit: true,
      },
      include: ['consumer.ts'],
    }),
  );
  run(
    process.execPath,
    [join(consumer, 'node_modules/typescript/bin/tsc'), '-p', 'tsconfig.json'],
    consumer,
  );
  run('corepack', ['yarn@4.18.1', 'install', '--immutable'], consumer);
  assert.ok(filename.endsWith('.tgz'));
  console.log(
    'Yarn imports, shared core identity, React/compiler exports, strict declarations and immutable reinstall passed.',
  );
} catch (error) {
  if (error.stdout) console.error(String(error.stdout));
  if (error.stderr) console.error(String(error.stderr));
  throw error;
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
