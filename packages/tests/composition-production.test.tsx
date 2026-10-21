import { transformSync } from '@babel/core';
import * as t from '@babel/types';
import React from 'react';
import * as ReactApi from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Service, ServiceScope, flushSync } from '@kinstate/core';
import * as Services from '@kinstate/react';
import * as Internal from '../react/src/internal.js';
import plugin from '../compiler/src/index.js';

function compile(
  source: string,
  additional: Record<string, unknown> = {},
  mode: boolean | 'client' = true,
): { Parent: React.ComponentType<any>; Child: React.ComponentType<any> } {
  const tracked = transformSync(source, {
    filename: 'production.tsx',
    configFile: false,
    babelrc: false,
    parserOpts: { plugins: ['typescript', 'jsx'] },
    plugins: [[plugin, { reactiveProps: mode }]],
  })!.code!;
  const code = transformSync(tracked, {
    filename: 'production.tsx',
    configFile: false,
    babelrc: false,
    presets: [
      ['@babel/preset-typescript', { allExtensions: true, isTSX: true }],
      ['@babel/preset-react', { runtime: 'classic' }],
    ],
    plugins: [
      () => ({
        visitor: {
          ImportDeclaration(path: import('@babel/core').NodePath<t.ImportDeclaration>) {
            const source = path.node.source.value;
            path.replaceWith(
              t.variableDeclaration(
                'const',
                path.node.specifiers.map((specifier) =>
                  t.variableDeclarator(
                    t.cloneNode(specifier.local),
                    t.isImportNamespaceSpecifier(specifier) || t.isImportDefaultSpecifier(specifier)
                      ? t.memberExpression(t.identifier('__modules'), t.stringLiteral(source), true)
                      : t.memberExpression(
                          t.memberExpression(
                            t.identifier('__modules'),
                            t.stringLiteral(source),
                            true,
                          ),
                          t.isIdentifier(specifier.imported)
                            ? t.cloneNode(specifier.imported)
                            : t.stringLiteral(specifier.imported.value),
                          !t.isIdentifier(specifier.imported),
                        ),
                  ),
                ),
              ),
            );
          },
          ExportNamedDeclaration(path: import('@babel/core').NodePath<t.ExportNamedDeclaration>) {
            if (path.node.declaration) path.replaceWith(path.node.declaration);
          },
        },
      }),
    ],
  })!.code!;
  return new Function(
    '__modules',
    `${code}; return {Parent: typeof Parent === 'undefined' ? undefined : Parent, Child: typeof Child === 'undefined' ? undefined : Child, Wrapped: typeof Wrapped === 'undefined' ? undefined : Wrapped};`,
  )({
    react: ReactApi,
    '@kinstate/react': Services,
    '@kinstate/react/internal': Internal,
    './State': { State },
    ...additional,
  });
}
class State extends Service {
  row = { name: 'Ada', ignored: 0 };
  count = 0;
  unrelated = 0;
  rename(name: string) {
    this.row.name = name;
  }
}
const header = `import React, {memo, forwardRef, useState} from 'react';import {useService} from '@kinstate/react';import {State} from './State';`;
afterEach(cleanup);
const update = async (callback: () => void) =>
  act(async () => {
    callback();
    flushSync();
  });

describe('compiled reactive props in production composition', () => {
  it('tracks a stable live object in an imported memo receiver, independently of its parent', async () => {
    const counters = { parent: 0, child: 0 };
    const child = compile(
      `import React,{memo} from 'react';import {counters} from './counts';export const Child=memo(({row})=>{counters.child++;return <span>{row.name}</span>});`,
      { './counts': { counters } },
    );
    const parent = compile(
      `${header}import {Child} from './child';import {counters} from './counts';function Parent(){const state=useService(State);counters.parent++;return <Child row={state.row}/>}`,
      { './child': child, './counts': { counters } },
    );
    const scope = new ServiceScope([State]);
    const state = scope.get(State);
    render(
      <Services.ServiceProvider services={[State]} scope={scope}>
        <parent.Parent />
      </Services.ServiceProvider>,
    );
    expect(screen.getByText('Ada')).toBeTruthy();
    await update(() => {
      state.row.name = 'Grace';
    });
    expect(screen.getByText('Grace')).toBeTruthy();
    expect(counters).toEqual({ parent: 1, child: 2 });
    await update(() => {
      state.row.ignored++;
      state.unrelated++;
    });
    expect(counters).toEqual({ parent: 1, child: 2 });
    scope.dispose();
  });

  it('collects deferred render props in the receiving render and changes conditional dependencies', async () => {
    const counters = { parent: 0, child: 0 };
    const views = compile(
      `${header}import {counters} from './counts';function Child({render}){counters.child++;return <span>{render()}</span>}function Parent(){const state=useService(State);counters.parent++;return <Child render={()=>state.count ? state.row.name : 'Empty'}/>} `,
      { './counts': { counters } },
    );
    const scope = new ServiceScope([State]);
    const state = scope.get(State);
    render(
      <Services.ServiceProvider services={[State]} scope={scope}>
        <views.Parent />
      </Services.ServiceProvider>,
    );
    await update(() => {
      state.row.name = 'Grace';
    });
    expect(counters.child).toBe(1);
    await update(() => {
      state.count = 1;
    });
    expect(screen.getByText('Grace')).toBeTruthy();
    await update(() => {
      state.row.name = 'Lin';
    });
    expect(screen.getByText('Lin')).toBeTruthy();
    expect(counters).toEqual({ parent: 1, child: 3 });
    scope.dispose();
  });

  it('tracks nested destructuring after the frame hook, preserving memo/forwardRef refs and commands', async () => {
    const views = compile(
      `${header}const Child=memo(forwardRef(({row:{name},onChange},ref)=><button ref={ref} onClick={onChange}>{name}</button>));function Parent(){const state=useService(State);return <Child row={state.row} onChange={()=>state.rename('Grace')}/>}`,
    );
    const scope = new ServiceScope([State]);
    render(
      <Services.ServiceProvider services={[State]} scope={scope}>
        <views.Parent />
      </Services.ServiceProvider>,
    );
    await update(() => screen.getByRole('button').click());
    expect(screen.getByText('Grace')).toBeTruthy();
    scope.dispose();
  });

  it('accepts ordinary ServiceProvider constructor tokens in derived initial state', () => {
    const views = compile(
      `${header}import {ServiceProvider} from '@kinstate/react';function Child(){const state=useService(State);return <span>{state.count}</span>}function Parent({count}){return <ServiceProvider services={[State]} initialState={[{service:State,state:{count}}]}><Child/></ServiceProvider>}`,
    );
    render(React.createElement(views.Parent!, { count: 42 }));
    expect(screen.getByText('42')).toBeTruthy();
  });

  it('keeps abandoned suspended receiver reads separate from committed dependencies', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let ready = false;
    const controls = {
      get ready() {
        return ready;
      },
      gate,
    };
    const views = compile(
      `${header}import {controls} from './gate';function Child({row}){if(row.name==='Suspend' && !controls.ready)throw controls.gate;return <span>{row.name}</span>}function Parent(){const state=useService(State);return <React.Suspense fallback={<span>Waiting</span>}><Child row={state.row}/></React.Suspense>}`,
      { './gate': { controls } },
    );
    const scope = new ServiceScope([State]);
    const state = scope.get(State);
    render(
      <React.StrictMode>
        <Services.ServiceProvider services={[State]} scope={scope}>
          <views.Parent />
        </Services.ServiceProvider>
      </React.StrictMode>,
    );
    await update(() => {
      state.row.name = 'Suspend';
    });
    expect(screen.getByText('Waiting')).toBeTruthy();
    await act(async () => {
      state.row.name = 'Latest';
      ready = true;
      release();
      flushSync();
      await gate;
    });
    expect(screen.getByText('Latest')).toBeTruthy();
    const view = screen.getByText('Latest');
    cleanup();
    await update(() => {
      state.row.name = 'After unmount';
    });
    expect(view.isConnected).toBe(false);
    scope.dispose();
  });

  it('preserves reactive props through a wrapper-only imported module', async () => {
    const counters = { parent: 0, child: 0 };
    const child = compile(
      `import React from 'react';import {counters} from './counts';export const Child=({row})=>{counters.child++;return <span>{row.name}</span>}`,
      { './counts': { counters } },
    );
    const wrapper = compile(
      `import {memo} from 'react';import {Child} from './child';export const Wrapped=memo(Child);`,
      { './child': child },
    );
    const parent = compile(
      `${header}import {Wrapped} from './wrapper';import {counters} from './counts';function Parent(){const state=useService(State);counters.parent++;return <Wrapped row={state.row}/>}`,
      { './wrapper': wrapper, './counts': { counters } },
    );
    const scope = new ServiceScope([State]);
    const state = scope.get(State);
    render(
      <Services.ServiceProvider services={[State]} scope={scope}>
        <parent.Parent />
      </Services.ServiceProvider>,
    );
    await update(() => {
      state.row.name = 'Wrapped';
    });
    expect(screen.getByText('Wrapped')).toBeTruthy();
    expect(counters).toEqual({ parent: 1, child: 2 });
    scope.dispose();
  });

  it('preserves parameter mutation and var redeclaration when lowering destructured props', () => {
    const views = compile(
      `import React from 'react';function Child({count}){var count;count++;return <span>{count}</span>}function Parent(){return <Child count={3}/>} `,
    );
    render(<views.Parent />);
    expect(screen.getByText('4')).toBeTruthy();
  });
  it('evaluates destructured props and ref parameters in authored order with literal defaults', () => {
    const order: string[] = [];
    const inputs = {
      first: {
        item: {
          get value() {
            order.push('first');
            return undefined;
          },
        },
      },
      second: {
        item: {
          get value() {
            order.push('second');
            return undefined;
          },
        },
      },
    };
    const views = compile(
      `import React,{forwardRef} from 'react';import {inputs} from './inputs';const Child=forwardRef(({item:{value:first=1}},{item:{value:second=2}})=><span>{first}:{second}</span>);function Parent(){return <Child item={inputs.first.item} ref={inputs.second}/>} `,
      { './inputs': { inputs } },
    );
    render(<views.Parent />);
    expect(screen.getByText('1:2')).toBeTruthy();
    expect(order).toEqual(['first', 'second']);
  });
  it('tracks service-capturing function declarations in compiled receiving components', async () => {
    const counters = { parent: 0, child: 0 };
    const views = compile(
      `${header}import {counters} from './counts';function Child({render}){counters.child++;return <span>{render()}</span>}function Parent(){const state=useService(State);function renderValue(){return state.count}counters.parent++;return <Child render={renderValue}/>}`,
      { './counts': { counters } },
    );
    const scope = new ServiceScope([State]);
    const state = scope.get(State);
    render(
      <Services.ServiceProvider services={[State]} scope={scope}>
        <views.Parent />
      </Services.ServiceProvider>,
    );
    await update(() => {
      state.count = 1;
    });
    expect(screen.getByText('1')).toBeTruthy();
    expect(counters).toEqual({ parent: 1, child: 2 });
    await update(() => {
      state.unrelated++;
    });
    expect(counters).toEqual({ parent: 1, child: 2 });
    scope.dispose();
  });
  it('keeps server modules inert in client-only mode', () => {
    const source = 'export function Child({row}){return row.name}';
    const result = transformSync(source, {
      filename: 'server.tsx',
      configFile: false,
      babelrc: false,
      plugins: [[plugin, { reactiveProps: 'client' }]],
    })!.code!;
    expect(result).not.toContain('useRenderFrame');
    expect(
      transformSync(`'use client';${source}`, {
        filename: 'client.tsx',
        configFile: false,
        babelrc: false,
        plugins: [[plugin, { reactiveProps: 'client' }]],
      })!.code,
    ).toContain('useRenderFrame');
  });
});
