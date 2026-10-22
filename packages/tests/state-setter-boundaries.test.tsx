import { transformSync, type NodePath } from '@babel/core';
import * as t from '@babel/types';
import React, * as ReactApi from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { Service, ServiceScope, flushSync } from '@kinstate/core';
import * as Services from '@kinstate/react';
import * as Internal from '../react/src/internal.js';
import plugin from '../compiler/src/index.js';

class State extends Service {
  user = { name: 'Ada' };
  unrelated = 0;
  rename() {
    this.user.name = 'Grace';
  }
  bump() {
    this.unrelated++;
  }
}

function compile(body: string, modules: Record<string, unknown>, extra = '') {
  const code = transformSync(
    `import React,{useState,useState as makeState,useReducer} from 'react';
     import * as ReactNS from 'react';
     import {useService} from '@kinstate/react';
     import {State,Child,Label} from './injected';
     ${extra}
     function Parent(){const state=useService(State);${body}}`,
    {
      filename: 'setter-consumer.tsx',
      configFile: false,
      babelrc: false,
      parserOpts: { plugins: ['typescript', 'jsx'] },
      plugins: [[plugin, { reactiveProps: true }]],
    },
  )!.code!;
  const lowered = transformSync(code, {
    filename: 'setter-consumer.tsx',
    configFile: false,
    babelrc: false,
    presets: [
      ['@babel/preset-typescript', { allExtensions: true, isTSX: true }],
      ['@babel/preset-react', { runtime: 'classic' }],
    ],
    plugins: [
      () => ({
        visitor: {
          ImportDeclaration(path: NodePath<t.ImportDeclaration>) {
            const module = t.memberExpression(
              t.identifier('__modules'),
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
  return new Function('__modules', `${lowered};return Parent;`)({
    react: ReactApi,
    '@kinstate/react': Services,
    '@kinstate/react/internal': Internal,
    './injected': { State, ...modules },
  }) as React.ComponentType;
}

afterEach(cleanup);

it.each(
  [
    'const [value,setValue]=useState(state.user.name);',
    'const [value,setValue]=makeState(state.user.name);',
    'const [value,setValue]=React.useState(state.user.name);',
    'const [value,setValue]=ReactNS.useState(state.user.name);',
    'const [value,dispatch]=useReducer((_,next)=>next,state.user.name);const setValue=dispatch;',
    'const [value,dispatch]=useState(state.user.name);const first=dispatch;const setValue=(first as typeof dispatch)!;',
  ].flatMap((declaration) =>
    ['setValue', "()=>setValue('selected')"].map((callback) => ({ declaration, callback })),
  ),
)(
  'allows a React dispatch initialized with a service snapshot: $declaration ($callback)',
  async ({ declaration, callback }) => {
    const counts = { child: 0 };
    function Child({ options }: any) {
      counts.child++;
      return React.createElement(
        'button',
        { onClick: () => options.setValue('selected') },
        `${options.title}:${options.value}`,
      );
    }
    const Parent = compile(
      `${declaration} return <Child options={{title:state.user.name,value,setValue:${callback}}}/>;`,
      { Child },
    );
    const scope = new ServiceScope([State]);
    try {
      render(
        <Services.ServiceProvider services={[State]} scope={scope}>
          <Parent />
        </Services.ServiceProvider>,
      );
      expect(screen.getByRole('button').textContent).toBe('Ada:Ada');
      const initial = counts.child;
      await act(async () => {
        scope.get(State).bump();
        flushSync();
      });
      expect(counts.child).toBe(initial);
      fireEvent.click(screen.getByRole('button'));
      expect(screen.getByRole('button').textContent).toBe('Ada:selected');
      await act(async () => {
        scope.get(State).rename();
        flushSync();
      });
      expect(screen.getByRole('button').textContent).toBe('Grace:selected');
    } finally {
      cleanup();
      scope.dispose();
    }
  },
);

it.each([
  'const [callback]=useState(()=>()=>state.user.name);return <Child options={{title:state.user.name,callback}}/>;',
  'const [value,setValue]=useState(()=>()=>state.user.name);return <Child options={{title:state.user.name,callback:()=>value()}}/>;',
  'const {useState}=factory;const [value,setValue]=useState(state.user.name);return <Child options={{title:state.user.name,callback:()=>setValue()}}/>;',
])('does not trust state values or a shadowed hook as dispatch: %s', (body) => {
  const Child = vi.fn(() => null);
  const scope = new ServiceScope([State]);
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    expect(() => {
      const Parent = compile(
        body,
        { Child },
        'const factory={useState(value){return [value,()=>value]}};',
      );
      render(
        <Services.ServiceProvider services={[State]} scope={scope}>
          <Parent />
        </Services.ServiceProvider>,
      );
    }).toThrow(/reactive|callback|capture|escape/i);
    expect(Child).not.toHaveBeenCalled();
  } finally {
    errors.mockRestore();
    cleanup();
    scope.dispose();
  }
});

it('tracks synchronous constructor projections and keeps unrelated updates quiet', async () => {
  let renders = 0;
  class Label {
    text: string;
    constructor(user: { name: string }) {
      this.text = user.name;
    }
  }
  function Child({ text }: any) {
    renders++;
    return React.createElement('span', null, text);
  }
  const Parent = compile('const label=new Label(state.user);return <Child text={label.text}/>;', {
    Child,
    Label,
  });
  const scope = new ServiceScope([State]);
  try {
    render(
      <Services.ServiceProvider services={[State]} scope={scope}>
        <Parent />
      </Services.ServiceProvider>,
    );
    expect(screen.getByText('Ada')).toBeTruthy();
    const initial = renders;
    await act(async () => {
      scope.get(State).bump();
      flushSync();
    });
    expect(renders).toBe(initial);
    await act(async () => {
      scope.get(State).rename();
      flushSync();
    });
    expect(screen.getByText('Grace')).toBeTruthy();
    expect(renders).toBe(initial + 1);
  } finally {
    cleanup();
    scope.dispose();
  }
});

it.each([
  'const user=state.user;const value=React.useMemo(()=>new Label(user),[user]);return <span>{value.text}</span>;',
  'class Projection {text=state.user.name}const value=React.useMemo(()=>new Projection(),[]);return <span>{value.text}</span>;',
  'class Projection {text=state.user.name}const Alias=Projection;const value=React.useMemo(()=>new Alias(),[]);return <span>{value.text}</span>;',
  'class Projection {text=state.user.name}const value=React.useMemo(()=>new (Projection as typeof Projection)(),[]);return <span>{value.text}</span>;',
])('replays constructor reads retained by memoization: %s', async (body) => {
  class Label {
    text: string;
    constructor(user: { name: string }) {
      this.text = user.name;
    }
  }
  const Parent = compile(body, { Label });
  const scope = new ServiceScope([State]);
  try {
    render(
      <Services.ServiceProvider services={[State]} scope={scope}>
        <Parent />
      </Services.ServiceProvider>,
    );
    expect(screen.getByText('Ada')).toBeTruthy();
    await act(async () => {
      scope.get(State).rename();
      flushSync();
    });
    expect(screen.getByText('Grace')).toBeTruthy();
  } finally {
    cleanup();
    scope.dispose();
  }
});
