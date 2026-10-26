import React, * as ReactApi from 'react';
import { createRequire } from 'node:module';
import * as JsxRuntime from 'react/jsx-runtime';
import { transformSync, type NodePath } from '@babel/core';
import * as t from '@babel/types';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Service, flushSync } from '@kinstate/core';
import * as Services from '@kinstate/react';
import * as Internal from '@kinstate/react/internal';
import plugin from '../src/index.js';

let fixtureId = 0;
/** Native ESM evaluation keeps export/hoisting behavior independent of test stubs. */
async function compile(source: string, values: Record<string, unknown> = {}, refresh = false) {
  const key = `__kinstate_memo_fixture_${++fixtureId}`;
  const modules: Record<string, unknown> = {
    react: ReactApi,
    'react/jsx-runtime': JsxRuntime,
    '@kinstate/react': Services,
    '@kinstate/react/internal': Internal,
    './fixture': values,
  };
  (globalThis as Record<string, unknown>)[key] = modules;
  let output = transformSync(source, {
    filename: 'implicit-memo.tsx',
    configFile: false,
    babelrc: false,
    parserOpts: { plugins: ['typescript', 'jsx'] },
    plugins: [[plugin, { reactiveProps: true }]],
    presets: [['@babel/preset-react', { runtime: 'automatic' }]],
  })!.code!;
  if (refresh) {
    const refreshPlugin = createRequire(import.meta.url)('react-refresh/babel');
    output = transformSync(output, {
      filename: 'hmr.jsx',
      configFile: false,
      babelrc: false,
      plugins: [[refreshPlugin, { skipEnvCheck: true }]],
    })!.code!;
  }
  let executable = transformSync(output, {
    filename: 'implicit-memo.tsx',
    configFile: false,
    babelrc: false,
    plugins: [
      () => ({
        visitor: {
          ImportDeclaration(path: NodePath<t.ImportDeclaration>) {
            const module = t.memberExpression(
              t.memberExpression(t.identifier('globalThis'), t.stringLiteral(key), true),
              t.stringLiteral(path.node.source.value),
              true,
            );
            path.replaceWith(
              t.variableDeclaration(
                'const',
                path.node.specifiers.map((specifier) =>
                  t.variableDeclarator(
                    t.cloneNode(specifier.local),
                    t.isImportSpecifier(specifier)
                      ? t.memberExpression(
                          t.cloneNode(module),
                          t.stringLiteral(
                            t.isIdentifier(specifier.imported)
                              ? specifier.imported.name
                              : specifier.imported.value,
                          ),
                          true,
                        )
                      : t.isImportDefaultSpecifier(specifier)
                        ? t.memberExpression(t.cloneNode(module), t.identifier('default'))
                        : t.cloneNode(module),
                  ),
                ),
              ),
            );
          },
        },
      }),
    ],
  })!.code!;
  if (refresh)
    executable = `const {$RefreshReg$,$RefreshSig$}=globalThis[${JSON.stringify(key)}]['./fixture'];\n${executable}`;
  try {
    const url = `data:text/javascript,${encodeURIComponent(executable)}#${fixtureId}`;
    return (await import(/* @vite-ignore */ url)) as Record<string, unknown>;
  } finally {
    delete (globalThis as Record<string, unknown>)[key];
  }
}

afterEach(cleanup);

class State extends Service {
  rows = [
    { id: 'a', x: 0 },
    { id: 'b', x: 0 },
    { id: 'c', x: 0 },
  ];
}

describe('implicit receiving-component memoization', () => {
  it('skips stable rows on parent local-state changes and preserves fine-grained own updates', async () => {
    const counts = { parent: 0, a: 0, b: 0, c: 0 };
    const module = await compile(
      `import {useState} from 'react';import {counts} from './fixture';
      function Row({row}){counts[row.id]++;return <span data-testid={row.id}>{row.x}</span>}
      export function View({rows}){const [guide,setGuide]=useState(0);counts.parent++;
        return <><button onClick={()=>setGuide(value=>value+1)}>guide {guide}</button>{rows.map(row=><Row key={row.id} row={row}/>)}</>}`,
      { counts },
    );
    const View = module.View as React.ComponentType<{ rows: State['rows'] }>;
    const state = new State();
    render(<View rows={state.rows} />);
    for (let i = 0; i < 4; i++) fireEvent.click(screen.getByRole('button'));
    expect(counts).toEqual({ parent: 5, a: 1, b: 1, c: 1 });
    await act(async () => {
      state.rows[1]!.x = 20;
      flushSync();
    });
    expect(screen.getByTestId('b').textContent).toBe('20');
    expect(counts).toEqual({ parent: 5, a: 1, b: 2, c: 1 });
  });

  it('retains context and local-state updates under stable props', async () => {
    const context = React.createContext('first');
    let childRenders = 0;
    const module = await compile(
      `import {useContext,useState} from 'react';import {context,record} from './fixture';
      export function View({label}){const theme=useContext(context);const [value,setValue]=useState(0);record();
        return <button onClick={()=>setValue(value+1)}>{label}:{theme}:{value}</button>}`,
      { context, record: () => childRenders++ },
    );
    const View = module.View as React.ComponentType<{ label: string }>;
    const view = render(
      <context.Provider value="first">
        <View label="row" />
      </context.Provider>,
    );
    view.rerender(
      <context.Provider value="first">
        <View label="row" />
      </context.Provider>,
    );
    expect(childRenders).toBe(1);
    view.rerender(
      <context.Provider value="second">
        <View label="row" />
      </context.Provider>,
    );
    expect(screen.getByText('row:second:0')).toBeTruthy();
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('row:second:1')).toBeTruthy();
    expect(childRenders).toBe(3);
  });

  it('keeps named/default exports and declarations hoisted to the final receiver binding', async () => {
    const module = await compile(`export const before=<View label="hoisted"/>;
      export default function View({label}){return <span>{label}</span>}export {View};`);
    expect(module.default).toBe(module.View);
    expect((module.before as React.ReactElement).type).toBe(module.View);
    render(module.before as React.ReactElement);
    expect(screen.getByText('hoisted')).toBeTruthy();
  });

  it.each([
    'export default ({label})=><span>{label}</span>',
    'export const View=({label})=><span>{label}</span>',
  ])('supports expression export forms: %s', async (source) => {
    const module = await compile(source);
    const View = (module.default ?? module.View) as React.ComponentType<{ label: string }>;
    render(<View label="expression" />);
    expect(screen.getByText('expression')).toBeTruthy();
  });

  it('preserves an authored memo comparator instead of adding another memo layer', async () => {
    let comparisons = 0;
    const module = await compile(
      `import {memo} from 'react';import {compare} from './fixture';
      export const View=memo(({label})=><span>{label}</span>,compare);`,
      {
        compare: (a: { label: string }, b: { label: string }) => {
          comparisons++;
          return a.label === b.label;
        },
      },
    );
    const View = module.View as React.ComponentType<{ label: string }>;
    const view = render(<View label="same" />);
    view.rerender(<View label="same" />);
    expect(comparisons).toBe(1);
  });

  it('supports forwardRef while memoizing its outer component exactly once', async () => {
    let renders = 0;
    const module = await compile(
      `import {forwardRef} from 'react';import {record} from './fixture';
      export const View=forwardRef(({label},ref)=>{record();return <button ref={ref}>{label}</button>});`,
      { record: () => renders++ },
    );
    const View = module.View as React.ComponentType<{
      label: string;
      ref: React.Ref<HTMLButtonElement>;
    }>;
    const ref = React.createRef<HTMLButtonElement>();
    const view = render(<View label="forwarded" ref={ref} />);
    view.rerender(<View label="forwarded" ref={ref} />);
    expect(renders).toBe(1);
    expect(ref.current).toBe(screen.getByRole('button'));
  });

  it('keeps changing callback props fresh instead of freezing closures', async () => {
    const seen: number[] = [];
    const module = await compile(
      `import {useState} from 'react';import {seen} from './fixture';
      function Row({onSelect}){return <button onClick={onSelect}>select</button>}
      export function View(){const [guide,setGuide]=useState(0);return <>
        <button onClick={()=>setGuide(guide+1)}>next</button><Row onSelect={()=>seen.push(guide)}/></>}`,
      { seen },
    );
    const View = module.View as React.ComponentType;
    render(<View />);
    fireEvent.click(screen.getByText('select'));
    fireEvent.click(screen.getByText('next'));
    fireEvent.click(screen.getByText('select'));
    expect(seen).toEqual([0, 1]);
  });

  it('reuses cached wrappers and never wraps an implicit wrapper twice', () => {
    const Raw = () => null;
    const wrapped = Internal.markReactiveComponent(Raw, true);
    expect(Internal.markReactiveComponent(Raw, true)).toBe(wrapped);
    expect(Internal.markReactiveComponent(wrapped, true)).toBe(wrapped);
  });
  it('replaces row subscriptions when a prop changes and stops reading the old row', async () => {
    let renders = 0;
    const module = await compile(
      `import {record} from './fixture';export function View({row}){record();return <span>{row.x}</span>}`,
      { record: () => renders++ },
    );
    const View = module.View as React.ComponentType<{ row: { x: number } }>;
    const state = new State();
    const old = state.rows[0]!;
    const view = render(<View row={old} />);
    view.rerender(<View row={state.rows[1]!} />);
    const baseline = renders;
    await act(async () => {
      old.x = 100;
      flushSync();
    });
    expect(renders).toBe(baseline);
    await act(async () => {
      state.rows[1]!.x = 50;
      flushSync();
    });
    expect(screen.getByText('50')).toBeTruthy();
    expect(renders).toBe(baseline + 1);
  });

  it.each([
    'export function View({row}){const [x]=useState(0);return <span>{row.x+x}</span>}',
    'export const View=({row})=>{const [x]=useState(0);return <span>{row.x+x}</span>}',
    'export default function View({row}){const [x]=useState(0);return <span>{row.x+x}</span>}',
  ])(
    'registers the final memoized binding with the official React Refresh transform: %s',
    async (source) => {
      const registered: unknown[] = [];
      const module = await compile(
        `import {useState} from 'react';${source}`,
        {
          $RefreshReg$: (value: unknown) => registered.push(value),
          $RefreshSig$: () => (value: unknown) => value,
        },
        true,
      );
      const View = (module.View ?? module.default) as React.ComponentType<{ row: { x: number } }>;
      expect(registered).toContain(View);
      render(<View row={{ x: 3 }} />);
      expect(screen.getByText('3')).toBeTruthy();
    },
  );
});
