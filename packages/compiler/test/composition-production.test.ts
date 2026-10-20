import { transformSync } from '@babel/core';
import { describe, expect, it } from 'vitest';
import plugin from '../src/index.js';
const compile = (source: string, reactiveProps: boolean | 'client' = true) =>
  transformSync(source, {
    filename: 'receivers.tsx',
    configFile: false,
    babelrc: false,
    parserOpts: { plugins: ['typescript', 'jsx'] },
    plugins: [[plugin, { reactiveProps }]],
  })!.code!;
describe('reactive receiver compiler contract', () => {
  it.each([
    'export default function ({row}){return <span>{row.name}</span>}',
    'export default ({row})=><span>{row.name}</span>',
    'const Child=({row})=><span>{row.name}</span>;',
    'const Child=function render({row}){return <span>{row.name}</span>};',
    'export default function render({row}){return <span>{row.name}</span>}',
    "import {memo,forwardRef} from 'react';export default memo(forwardRef(({row},ref)=><span ref={ref}>{row.name}</span>));",
  ])('marks the actual receiving component: %s', (source) => {
    const code = compile(source);
    expect(code).toContain('markReactiveComponent');
    expect(code).toContain('use no memo');
    expect(code).toMatch(/\.track\(\(\) => row\.name\)/);
  });
  it('retains memoization diagnostics for concealed prop reads', () => {
    expect(() =>
      compile(
        "import {useMemo} from 'react';function Child({row}){return useMemo(()=>row.name,[])}",
      ),
    ).toThrow(/must not hide/);
  });
  it.each([
    'function Child({row}={}){return row.name}',
    'function Child(...props){return props[0].row.name}',
  ])('diagnoses reads hidden in parameter initialization: %s', (source) => {
    expect(() => compile(source)).toThrow(/parameter defaults and rest parameters/);
  });
  it('never trusts mutable receiver aliases whose type can change while evaluating props', () => {
    const code = compile(
      "import {useService} from '@kinstate/react';function Parent(){const s=useService(S);let Target=Child;return <Target row={(Target=Other,s.row)}/>}function Child({row}){return row.name}",
    );
    expect(code).toMatch(/\.boundary\([\s\S]*?"value"\)/);
    expect(code).not.toMatch(/"value", Target/);
  });
  it('diagnoses asynchronous reactive render callbacks', () => {
    expect(() =>
      compile(
        "import {useService} from '@kinstate/react';function Parent(){const s=useService(S);return <Child render={async()=>s.count}/>}function Child({render}){return render()}",
      ),
    ).toThrow(/must be synchronous/);
  });
  it('registers a default memo alias without injecting component hooks into the wrapper module', () => {
    const code = compile(
      "import {memo} from 'react';import {Child} from './Child';export default memo(Child);",
    );
    expect(code).toContain('markReactiveWrapper');
    expect(code).not.toContain('useRenderFrame');
    expect(code.match(/memo\(Child\)/g)).toHaveLength(1);
  });
  it('respects explicit infrastructure opt-out without hiding useService consumers', () => {
    expect(
      compile(
        "'use client';'use no service tracking';function Child({row}){return row.name}",
        'client',
      ),
    ).not.toContain('useRenderFrame');
    expect(
      compile(
        "'use client';'use no service tracking';import {useService} from '@kinstate/react';function Child(){const s=useService(S);return s.count}",
        'client',
      ),
    ).toContain('useRenderFrame');
  });
  it('never marks an arbitrary wrapper shadowing a React import', () => {
    const code = compile(
      "import {memo} from 'react';import {Child} from './Child';{const memo=arbitraryWrapper;const Wrapped=memo(Child);}",
    );
    expect(code).not.toContain('markReactiveWrapper');
  });
  it.each([
    'const render=async()=>{await Promise.resolve();return s.count};return <Child render={render}/>;',
    'const original=async()=>s.count;const alias=original;return <Child render={alias}/>;',
    'const render=(async()=>s.count) as ()=>Promise<number>;return <Child render={render}/>;',
    'const render=flag ? ()=>s.count : async()=>s.count;return <Child render={render}/>;',
    'const render=useCallback(async()=>s.count,[s]);return <Child render={render}/>;',
    'function* render(){yield s.count}return <Child render={render}/>;',
  ])('diagnoses asynchronous callback aliases: %s', (body) => {
    expect(() =>
      compile(
        `import {useService} from '@kinstate/react';import {useCallback} from 'react';function Parent(){const s=useService(S);${body}}function Child({render}){return render()}`,
      ),
    ).toThrow(/must be synchronous/);
  });
  it.each([
    'const fallback=7;function Child({value=fallback}){var fallback=9;return value}',
    'function Child({first},{second=first}){return second}',
    'function Child({first=second},{second}){return first}',
    'function Child({count,read=()=>count}){var count=9;return read()}',
  ])('diagnoses defaults requiring a separate parameter environment: %s', (source) => {
    expect(() => compile(source)).toThrow(/parameter defaults must move/);
  });
  it('diagnoses function declarations that change lowered parameter hoisting', () => {
    expect(() => compile('function Child({count}){function count(){}return count}')).toThrow(
      /body function declarations/,
    );
  });
  it.each(['/app/node_modules/library/Child.jsx', 'C:\\app\\node_modules\\library\\Child.jsx'])(
    'leaves precompiled dependency consumers unchanged: %s',
    (filename) => {
      const source =
        "'use client';import {useService} from '@kinstate/react';function Child(){const s=useService(S,frame);return s.count}";
      const options = { filename, configFile: false as const, babelrc: false as const };
      const baseline = transformSync(source, options)!.code;
      expect(
        transformSync(source, { ...options, plugins: [[plugin, { reactiveProps: true }]] })!.code,
      ).toBe(baseline);
    },
  );
  it('does not turn an async server component into a hook consumer', () => {
    expect(compile('export default async function Child(){return 1}')).not.toContain(
      'useRenderFrame',
    );
  });
});
