import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..');
const temporary = mkdtempSync(join(tmpdir(), 'kinstate-git-install-'));

function run(command, args, cwd) {
  return execFileSync(command, args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    timeout: 5 * 60 * 1000,
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function write(directory, filename, contents) {
  const target = join(directory, filename);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, contents);
}

function json(directory, filename, value) {
  write(directory, filename, JSON.stringify(value, null, 2));
}

function snapshotSource() {
  const repository = join(temporary, 'repository');
  mkdirSync(repository);
  // Include pending source edits so this gate validates the working tree before committing.
  // Git's ignore rules keep build output, dependencies and local caches out of the snapshot.
  const filenames = run(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    root,
  )
    .split('\0')
    .filter(Boolean);
  for (const filename of new Set(filenames)) {
    const source = join(root, filename);
    if (!existsSync(source)) continue;
    const target = join(repository, filename);
    mkdirSync(dirname(target), { recursive: true });
    cpSync(source, target, { recursive: true });
  }
  const hooks = join(temporary, 'empty-hooks');
  mkdirSync(hooks);
  run('git', ['init', '--quiet'], repository);
  run('git', ['add', '.'], repository);
  run(
    'git',
    [
      '-c',
      'user.name=Kinstate package verification',
      '-c',
      'user.email=verification@example.invalid',
      '-c',
      'commit.gpgsign=false',
      '-c',
      `core.hooksPath=${hooks}`,
      'commit',
      '--quiet',
      '-m',
      'Verify working tree Git installation',
    ],
    repository,
  );
  const commit = run('git', ['rev-parse', 'HEAD'], repository).trim();
  return `git+${pathToFileURL(repository).href}#${commit}`;
}

function createConsumer(name, dependency, dependencies = {}) {
  const consumer = join(temporary, name);
  mkdirSync(consumer);
  json(consumer, 'package.json', {
    private: true,
    type: 'module',
    dependencies: { kinstate: dependency, ...dependencies },
  });
  return consumer;
}

function assertInstalledArtifacts(consumer) {
  const installed = join(consumer, 'node_modules/kinstate');
  for (const name of ['core', 'react', 'compiler']) {
    assert.equal(
      lstatSync(join(installed, 'distribution/dist/workspaces', name)).isSymbolicLink(),
      false,
      `Embedded ${name} must contain files, not a workspace symlink`,
    );
    for (const file of ['index.js', 'index.d.ts'])
      assert.ok(
        existsSync(join(installed, 'distribution/dist/workspaces', name, file)),
        `Git installation omitted embedded ${name}/${file}`,
      );
  }
  for (const unwanted of ['packages', 'website', 'benchmarks', '.git'])
    assert.equal(existsSync(join(installed, unwanted)), false, `Unexpected shipped ${unwanted}`);
  assert.equal(
    existsSync(join(installed, 'node_modules/react')),
    false,
    'React must resolve from the consumer, never a bundled second instance',
  );
}

const declarationConsumer = `
import {Service, ServiceScope, dependencies, serviceInputs} from 'kinstate';
import {Service as CoreService} from 'kinstate/core';
import {ServiceProvider, useService} from 'kinstate/react';
import {RenderFrame, useRenderFrame} from 'kinstate/react/internal';
import {RenderFrame as SameFrame} from 'kinstate/internal';
import compiler from 'kinstate/compiler';
import vitePlugin from 'kinstate/compiler/vite';
class Cart extends Service { total = 1; update(total: number) { this.total = total; } }
class Checkout extends Service {
  static inject = dependencies(Cart);
  constructor(readonly cart: Cart) { super(); }
}
const scope = new ServiceScope([Checkout]);
const checkout: Checkout = scope.get(Checkout);
const binding = serviceInputs(Cart, {total: 2});
function Consumer() {
  const cart = useService(Cart);
  // @ts-expect-error React consumers cannot mutate service state directly.
  cart.total = 2;
  cart.update(3);
  return cart.total;
}
void [CoreService, checkout, binding, Consumer, ServiceProvider, RenderFrame, SameFrame,
  useRenderFrame, compiler, vitePlugin()];
`;

const runtimeConsumer = `
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {Service,ServiceScope,observe,flushSync} from 'kinstate';
import {Service as CoreService} from 'kinstate/core';
import {RenderFrame} from 'kinstate/react/internal';
import {RenderFrame as SameFrame} from 'kinstate/internal';
import compiler from 'kinstate/compiler';
import vitePlugin from 'kinstate/compiler/vite';
import {withKinstate} from 'kinstate/compiler/next';
const require=createRequire(import.meta.url);
const compilerRequire=createRequire(import.meta.resolve('kinstate/compiler'));
const {transformSync}=compilerRequire('@babel/core');
assert.equal(Service,CoreService);assert.equal(RenderFrame,SameFrame);
const reactRequire=createRequire(import.meta.resolve('kinstate/react'));
const runtimeReactRequire=createRequire(reactRequire.resolve('./workspaces/react/index.js'));
assert.equal(reactRequire.resolve('react'),require.resolve('react'));
assert.equal(runtimeReactRequire.resolve('react'),require.resolve('react'));
class Counter extends Service { count=0; name='Counter'; increment(){this.count++;} }
const scope=new ServiceScope([Counter]);const service=scope.get(Counter);let runs=0;
const stop=observe(()=>{void service.count;runs++});service.name='Other';flushSync();
assert.equal(runs,1);service.increment();flushSync();assert.equal(runs,2);stop();scope.dispose();
const source=\`import React from 'react';import {renderToString} from 'react-dom/server';import {Service} from 'kinstate/core';import {ServiceProvider,useService} from 'kinstate/react';class State extends Service {count=7}function Display(){const state=useService(State);return React.createElement('span',null,state.count)}export const html=renderToString(React.createElement(ServiceProvider,{services:[State]},React.createElement(Display)));\`;
const compiled=transformSync(source,{filename:'consumer.js',configFile:false,babelrc:false,plugins:[compiler]}).code;
assert.match(compiled,/kinstate\\/react\\/internal/);
writeFileSync(new URL('./compiled.mjs',import.meta.url),compiled);
assert.match((await import('./compiled.mjs')).html,/>7</);
const vite=vitePlugin();const transform=typeof vite.transform==='function'?vite.transform:vite.transform.handler;
const viteResult=await transform.call({},source,'/application/consumer.js');
assert.match(viteResult.code,/kinstate\\/react\\/internal/);
const next=withKinstate();const webpack=next.webpack({},{});
const loader=webpack.module.rules.at(-1).use[0];
assert.equal(loader.options.importSource,'kinstate/react');
assert.equal(loader.options.reactiveProps,'client');
assert.equal(typeof require(loader.loader),'function');
for (const importSource of [undefined,'custom/react']) {
  const options={importSource};const expectedSource=importSource??'kinstate/react';
  const aliasSource=source.replaceAll('kinstate/react',expectedSource);
  const babelResult=transformSync(aliasSource,{filename:'alias.js',configFile:false,babelrc:false,plugins:[[compiler,options]]});
  assert.ok(babelResult.code.includes(expectedSource+'/internal'));
  const aliasVite=vitePlugin(options);
  const aliasTransform=typeof aliasVite.transform==='function'?aliasVite.transform:aliasVite.transform.handler;
  const aliasResult=await aliasTransform.call({},aliasSource,'/application/alias.js');
  assert.ok(aliasResult.code.includes(expectedSource+'/internal'));
  const aliasNext=withKinstate({},options).webpack({},{});
  assert.equal(aliasNext.module.rules.at(-1).use[0].options.importSource,expectedSource);
}
console.log('Git-installed core, shared identities, SSR, compiler, Vite and Next adapters passed.');
`;

function checkReactConsumer(consumer) {
  console.log('Checking Git-installed declarations and runtime integration.');
  json(consumer, 'tsconfig.json', {
    compilerOptions: {
      strict: true,
      target: 'ES2022',
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      noEmit: true,
      skipLibCheck: false,
    },
    include: ['consumer.ts'],
  });
  write(consumer, 'consumer.ts', declarationConsumer);
  run(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'], consumer);
  write(consumer, 'smoke.mjs', runtimeConsumer);
  console.log(run(process.execPath, ['smoke.mjs'], consumer).trim());
}

function rewriteExampleImports(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const filename = join(directory, entry.name);
    if (entry.isDirectory()) rewriteExampleImports(filename);
    else if (/\.[cm]?[jt]sx?$/.test(entry.name)) {
      const source = readFileSync(filename, 'utf8');
      writeFileSync(filename, source.replaceAll('@kinstate/', 'kinstate/'));
    }
  }
}

function checkNextBuild(consumer) {
  console.log('Building the Git-installed Next.js example with Webpack and SWC.');
  const application = join(consumer, 'next-app');
  mkdirSync(application);
  json(application, 'package.json', { private: true, type: 'module' });
  for (const name of ['app', 'next.config.mjs'])
    cpSync(join(root, 'packages/examples/nextjs', name), join(application, name), {
      recursive: true,
    });
  rewriteExampleImports(application);
  write(
    application,
    'adapter-types.ts',
    `import type {NextConfig} from 'next';import {withKinstate} from 'kinstate/compiler/next';const config:NextConfig=withKinstate({compiler:{removeConsole:true}});void config;`,
  );
  const build = run(
    process.execPath,
    [join(consumer, 'node_modules/next/dist/bin/next'), 'build', '--webpack'],
    application,
  );
  assert.doesNotMatch(build, /disabled SWC|using external babel|\.babelrc/i);
  console.log('Git-installed Next.js Webpack + SWC example built successfully.');
}

try {
  const dependency = snapshotSource();
  console.log('Installing a clean Git dependency without React.');
  const coreConsumer = createConsumer('core-only', dependency);
  run('npm', ['install', '--omit=peer', '--no-audit', '--no-fund'], coreConsumer);
  assertInstalledArtifacts(coreConsumer);
  assert.equal(existsSync(join(coreConsumer, 'node_modules/react')), false);
  write(
    coreConsumer,
    'core.mjs',
    `import assert from 'node:assert/strict';import {Service} from 'kinstate';import {Service as SameService} from 'kinstate/core';assert.equal(Service,SameService);console.log('Git-installed core works without React.');`,
  );
  console.log(run(process.execPath, ['core.mjs'], coreConsumer).trim());
  for (const reactVersion of ['18.3.1', '19.3.1']) {
    console.log(`Installing a clean Git dependency with React ${reactVersion}.`);
    const consumer = createConsumer(`react-${reactVersion}`, dependency, {
      react: reactVersion,
      'react-dom': reactVersion,
      typescript: '^5.9.0',
      '@types/react': '^19',
      '@types/react-dom': '^19',
      '@types/node': '^22',
      vite: '^7',
      ...(reactVersion.startsWith('19.') ? { next: '16.4.2' } : {}),
    });
    run('npm', ['install', '--no-audit', '--no-fund'], consumer);
    assertInstalledArtifacts(consumer);
    // Reinstall from the generated lockfile: no workspaces or source links may be needed.
    console.log(`Checking npm ci reproducibility with React ${reactVersion}.`);
    run('npm', ['ci', '--no-audit', '--no-fund'], consumer);
    assertInstalledArtifacts(consumer);
    checkReactConsumer(consumer);
    if (reactVersion.startsWith('19.')) checkNextBuild(consumer);
  }
} catch (error) {
  if (error.stdout) console.error(String(error.stdout));
  if (error.stderr) console.error(String(error.stderr));
  throw error;
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
