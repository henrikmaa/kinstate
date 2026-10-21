import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const temporary = mkdtempSync(join(tmpdir(), 'kinstate-pack-'));
const run = (command, args, cwd) =>
  execFileSync(command, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
try {
  const tarballs = ['core', 'react', 'compiler'].map((name) => {
    const result = JSON.parse(
      run('npm', ['pack', '--json', '--pack-destination', temporary], join(root, 'packages', name)),
    )[0];
    for (const required of ['dist/index.js', 'dist/index.d.ts', 'LICENSE', 'README.md']) {
      if (!result.files.some((file) => file.path === required))
        throw new Error(`${name}: package missing ${required}`);
    }
    if (name === 'compiler') {
      for (const required of [
        'dist/next.js',
        'dist/next.d.ts',
        'dist/next-loader.cjs',
        'dist/next-loader.d.cts',
        'dist/next-loader.cjs.map',
        'dist/next-transform.js',
      ]) {
        if (!result.files.some((file) => file.path === required))
          throw new Error(`compiler: package missing ${required}`);
      }
    }
    return join(temporary, result.filename);
  });
  for (const reactVersion of ['18.3.1', '19.3.1']) {
    const consumer = join(temporary, `consumer-${reactVersion}`);
    mkdirSync(consumer);
    writeFileSync(
      join(consumer, 'package.json'),
      JSON.stringify({ private: true, type: 'module' }),
    );
    console.log(`Installing packed packages with React ${reactVersion}`);
    run(
      'npm',
      [
        'install',
        '--no-audit',
        '--no-fund',
        ...tarballs,
        `react@${reactVersion}`,
        `react-dom@${reactVersion}`,
        'typescript@^5.9.0',
        '@types/react@^19',
        '@types/react-dom@^19',
        '@types/node@^22',
        'vite@^7',
        ...(reactVersion.startsWith('19.') ? ['next@16.4.2'] : []),
      ],
      consumer,
    );
    writeFileSync(
      join(consumer, 'consumer.ts'),
      `
import {Service, ServiceScope, dependencies, serviceInputs} from '@kinstate/core';
import {useService} from '@kinstate/react';
import {RenderFrame, useRenderFrame} from '@kinstate/react/internal';
const frame = new RenderFrame();
import plugin from '@kinstate/compiler';
import vitePlugin from '@kinstate/compiler/vite';
class Cart extends Service { total = 1; onSave: ((name: string) => Promise<string>) | undefined = undefined; }
class Checkout extends Service { static inject = dependencies(Cart); constructor(readonly cart: Cart) { super(); } }
const checkout: Checkout = new ServiceScope([Checkout]).get(Checkout);
const total: number = checkout.cart.total;
const consumer: () => Cart = () => useService(Cart);
function ReadonlyConsumer() {
  const cart=useService(Cart);
  // @ts-expect-error Consumer state cannot be assigned, including in events.
  cart.total=2;
  void cart.total;
}
const binding = serviceInputs(Cart, {total: 4, onSave: async name => name.toUpperCase()});
// @ts-expect-error Callback argument types must match.
serviceInputs(Cart, {onSave: async (name: number) => String(name)});
const seeded = new ServiceScope([Cart], {inputs: [binding]});
const changed: boolean = seeded.applyInputs([serviceInputs(Cart, {total: 8})]);
// @ts-expect-error Inputs cannot replace methods.
serviceInputs(Cart, {onInit: () => {}});
// @ts-expect-error Undefined cannot replace a non-nullable field.
serviceInputs(Cart, {total: undefined});
const receivingPlugin = vitePlugin({reactiveProps: true});
void [total, consumer, plugin, vitePlugin, receivingPlugin, changed, frame, useRenderFrame];
`,
    );
    writeFileSync(
      join(consumer, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          strict: true,
          target: 'ES2022',
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          noEmit: true,
          skipLibCheck: false,
        },
        include: ['consumer.ts'],
      }),
    );
    run(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'], consumer);
    writeFileSync(
      join(consumer, 'smoke.mjs'),
      `
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {Service,ServiceScope,observe,flushSync,serviceInputs,isReactive} from '@kinstate/core';
import {transformSync} from '@babel/core';
import compiler from '@kinstate/compiler';
class Counter extends Service { onSave=undefined; count=0; name='Counter'; increment(){ this.count++; } }
const scope=new ServiceScope([Counter],{inputs:[serviceInputs(Counter,{count:0})]});const service=scope.get(Counter);let runs=0;
assert.equal(isReactive(service),true);
const stop=observe(()=>{void service.count;runs++});service.name='Other';flushSync();assert.equal(runs,1);service.increment();flushSync();assert.equal(runs,2);assert.equal(scope.applyInputs([serviceInputs(Counter,{count:2})]),true);flushSync();assert.equal(service.count,2);assert.equal(runs,3);const callback=name=>Promise.resolve(name);scope.applyInputs([serviceInputs(Counter,{onSave:callback})]);assert.equal(service.onSave,callback);assert.equal(await service.onSave('packed'),'packed');stop();scope.dispose();
const source=\`import React from 'react'; import {renderToString} from 'react-dom/server'; import {Service} from '@kinstate/core'; import {ServiceProvider,useService} from '@kinstate/react'; class State extends Service {count=7} function Label({value}){return React.createElement('span',null,value)} function Display(){const s=useService(State);return React.createElement(Label,{value:s.count})} export const html=renderToString(React.createElement(ServiceProvider,{services:[State]},React.createElement(Display)));\`;
const result=transformSync(source,{configFile:false,babelrc:false,plugins:[compiler]});
writeFileSync(new URL('./compiled.mjs',import.meta.url),result.code);
assert.match((await import('./compiled.mjs')).html,/>7</);
const modules = {
  'compiled-child.mjs': \`import React from 'react';export function Child({row,children}){return React.createElement('span',null,row.name,':',children())}\`,
  'compiled-wrapper.mjs': \`import {memo} from 'react';import {Child} from './compiled-child.mjs';export const Wrapped=memo(Child);\`,
  'compiled-props.mjs': \`import React from 'react';import {renderToString} from 'react-dom/server';import {Service} from '@kinstate/core';import {ServiceProvider,useService} from '@kinstate/react';import {Wrapped} from './compiled-wrapper.mjs';class State extends Service {row={name:'Packed'};count=7}function Parent(){const service=useService(State);return React.createElement(Wrapped,{row:service.row},()=>service.count)}export const html=renderToString(React.createElement(ServiceProvider,{services:[State]},React.createElement(Parent)));\`,
};
for(const [filename, code] of Object.entries(modules)) {
  const compiled=transformSync(code,{filename,configFile:false,babelrc:false,plugins:[[compiler,{reactiveProps:true}]]});
  writeFileSync(new URL('./'+filename,import.meta.url),compiled.code);
}
const propsHtml=(await import('./compiled-props.mjs')).html;
assert.match(propsHtml,/Packed/);assert.match(propsHtml,/7/);
console.log('Packed imports, declarations, compiler, core, SSR and imported reactive receivers passed.');
`,
    );
    console.log(run(process.execPath, ['smoke.mjs'], consumer).trim());
    if (reactVersion.startsWith('19.')) {
      // A real clean consumer catches missing loader files and workspace-only resolution.
      // Keep Next's own tsconfig/declarations separate from the strict package check above.
      const nextConsumer = join(consumer, 'next-app');
      mkdirSync(nextConsumer);
      writeFileSync(
        join(nextConsumer, 'package.json'),
        JSON.stringify({ private: true, type: 'module' }),
      );
      for (const file of ['app', 'next.config.mjs'])
        cpSync(join(root, 'packages/examples/nextjs', file), join(nextConsumer, file), {
          recursive: true,
        });
      writeFileSync(
        join(nextConsumer, 'adapter-types.ts'),
        `import type {NextConfig} from 'next'; import {withKinstate} from '@kinstate/compiler/next'; const config:NextConfig=withKinstate({compiler:{removeConsole:true}}); void config;`,
      );
      // Next supports legacy decorators; the instrumentation prepass must preserve them.
      writeFileSync(
        join(nextConsumer, 'tsconfig.json'),
        JSON.stringify({ compilerOptions: { experimentalDecorators: true, strict: true } }),
      );
      writeFileSync(
        join(nextConsumer, 'app/decorated.ts'),
        'function entity(target: Function): void { void target; } @entity export class Model { count: number = 0; }',
      );
      const page = join(nextConsumer, 'app/page.tsx');
      writeFileSync(page, "import './decorated';\n" + readFileSync(page, 'utf8'));
      const build = run(
        process.execPath,
        [join(consumer, 'node_modules/next/dist/bin/next'), 'build', '--webpack'],
        nextConsumer,
      );
      if (/disabled SWC|using external babel|\.babelrc/i.test(build))
        throw new Error('Packed Next consumer unexpectedly disabled SWC');
      console.log(
        'Packed Next.js Webpack + SWC consumer (including next/font and decorators) built successfully.',
      );
    }
  }
} catch (error) {
  if (error.stdout) console.error(String(error.stdout));
  if (error.stderr) console.error(String(error.stderr));
  throw error;
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
