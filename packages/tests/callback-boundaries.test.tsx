import { transformSync } from '@babel/core';
import * as t from '@babel/types';
import React, * as ReactApi from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Service, ServiceScope, flushSync } from '@kinstate/core';
import * as Services from '@kinstate/react';
import * as Internal from '../react/src/internal.js';
import plugin from '../compiler/src/index.js';

class State extends Service {
  row = { name: 'Ada' };
  unrelated = 0;
  rename(name: string) {
    this.row.name = name;
  }
  bump() {
    this.unrelated++;
  }
}

/** Compile only the consumer: the injected third-party component stays uninstrumented. */
function consumer(body: string, modules: Record<string, unknown> = {}, extraSource = '') {
  const tracked = transformSync(
    `import React,{useState,useCallback,useMemo} from 'react';
     import {useService} from '@kinstate/react';
     import {State} from './state';
     import {Child,counts,factory} from './external';
     ${extraSource}
     function Parent(){const state=useService(State);${body}}`,
    {
      filename: 'consumer.tsx',
      configFile: false,
      babelrc: false,
      parserOpts: { plugins: ['typescript', 'jsx'] },
      plugins: [[plugin, { reactiveProps: true }]],
    },
  )!.code!;
  const code = transformSync(tracked, {
    filename: 'consumer.tsx',
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
                          t.isIdentifier(specifier.imported)
                            ? t.stringLiteral(specifier.imported.name)
                            : t.cloneNode(specifier.imported),
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
  return new Function('__modules', `${code};return Parent;`)({
    react: ReactApi,
    '@kinstate/react': Services,
    '@kinstate/react/internal': Internal,
    './state': { State },
    './external': modules,
  }) as React.ComponentType;
}

afterEach(cleanup);
async function change(callback: () => void) {
  await act(async () => {
    callback();
    flushSync();
  });
}

describe('snapshot callbacks at uninstrumented component boundaries', () => {
  it.each([
    'const title=state.row.name;const renderLabel=useCallback(()=>title,[title]);return <Child options={{renderLabel}}/>;',
    'const title=state.row.name;const options=useMemo(()=>({title,renderLabel:()=>title}),[title]);return <Child options={options}/>;',
  ])('supports standard React memo hooks around evaluated snapshots: %s', async (body) => {
    const counts = { parent: 0, child: 0 };
    function Child({ options }: any) {
      counts.child++;
      return React.createElement('span', null, options.renderLabel());
    }
    const Parent = consumer(`counts.parent++;${body}`, { Child, counts });
    const scope = new ServiceScope([State]);
    try {
      render(
        <Services.ServiceProvider services={[State]} scope={scope}>
          <Parent />
        </Services.ServiceProvider>,
      );
      expect(screen.getByText('Ada')).toBeTruthy();
      const initial = { ...counts };
      await change(() => scope.get(State).bump());
      expect(counts).toEqual(initial);
      await change(() => scope.get(State).rename('Grace'));
      expect(screen.getByText('Grace')).toBeTruthy();
      expect(counts.parent).toBe(initial.parent + 1);
      expect(counts.child).toBe(initial.child + 1);
    } finally {
      cleanup();
      scope.dispose();
    }
  });

  it.each(['useState', 'React.useState'])(
    'accepts ordinary %s setter adapters without coupling callback names to on*',
    async (stateHook) => {
      const counts = { parent: 0, child: 0 };
      function Child({ options }: any) {
        counts.child++;
        return React.createElement(
          'button',
          { onClick: options.toggle },
          `${options.title}:${options.collapsed}`,
        );
      }
      const Parent = consumer(
        `counts.parent++;
       const [collapsed,setIsCollapsed]=${stateHook}(false);
       return <Child options={{title:state.row.name,collapsed,toggle:()=>setIsCollapsed(value=>!value)}}/>;`,
        { Child, counts },
      );
      const scope = new ServiceScope([State]);
      try {
        render(
          <Services.ServiceProvider services={[State]} scope={scope}>
            <Parent />
          </Services.ServiceProvider>,
        );
        expect(screen.getByRole('button').textContent).toBe('Ada:false');
        const initial = { ...counts };
        await change(() => scope.get(State).bump());
        expect(counts).toEqual(initial);
        fireEvent.click(screen.getByRole('button'));
        expect(screen.getByRole('button').textContent).toBe('Ada:true');
        expect(counts.parent).toBe(initial.parent + 1);
        expect(counts.child).toBe(initial.child + 1);
        await change(() => scope.get(State).rename('Grace'));
        expect(screen.getByRole('button').textContent).toBe('Grace:true');
        expect(counts.parent).toBe(initial.parent + 2);
        expect(counts.child).toBe(initial.child + 2);
      } finally {
        cleanup();
        scope.dispose();
      }
    },
  );

  it('accepts Service constructor tokens alongside snapshots and pure formatters', async () => {
    function Child({ options }: any) {
      expect(options.serviceType).toBe(State);
      return React.createElement('span', null, options.pureFormatter(options.title));
    }
    const Parent = consumer(
      'return <Child options={{title:state.row.name,serviceType:State,pureFormatter:(value:string)=>value.toUpperCase()}}/>;',
      { Child },
    );
    const scope = new ServiceScope([State]);
    try {
      render(
        <Services.ServiceProvider services={[State]} scope={scope}>
          <Parent />
        </Services.ServiceProvider>,
      );
      expect(screen.getByText('ADA')).toBeTruthy();
      await change(() => scope.get(State).rename('Grace'));
      expect(screen.getByText('GRACE')).toBeTruthy();
    } finally {
      cleanup();
      scope.dispose();
    }
  });

  it('accepts chart/table formatters and hook setters alongside reactive snapshot data', async () => {
    const counts = { parent: 0, child: 0, setter: undefined as unknown };
    function Child({ options }: any) {
      counts.child++;
      expect(options.setIsCollapsed).toBe(counts.setter);
      return React.createElement(
        'button',
        { onClick: () => options.setIsCollapsed(true) },
        `${options.formatter(options.title)}:${options.collapsed}`,
      );
    }
    const Parent = consumer(
      `counts.parent++;
       const [collapsed,setIsCollapsed]=useState(false);
       counts.setter=setIsCollapsed;
       const options={title:state.row.name,collapsed,setIsCollapsed,
         formatter(value:string){return value.toUpperCase()}};
       return <Child options={options}/>;`,
      { Child, counts },
    );
    const scope = new ServiceScope([State]);
    try {
      render(
        <Services.ServiceProvider services={[State]} scope={scope}>
          <Parent />
        </Services.ServiceProvider>,
      );
      expect(screen.getByRole('button').textContent).toBe('ADA:false');
      const initial = { ...counts };
      await change(() => scope.get(State).bump());
      expect(counts).toEqual(initial);
      await change(() => scope.get(State).rename('Grace'));
      expect(screen.getByRole('button').textContent).toBe('GRACE:false');
      expect(counts.parent).toBe(initial.parent + 1);
      expect(counts.child).toBe(initial.child + 1);
      fireEvent.click(screen.getByRole('button'));
      expect(screen.getByRole('button').textContent).toBe('GRACE:true');
    } finally {
      cleanup();
      scope.dispose();
    }
  });

  it('preserves formatter receivers and never executes callbacks while validating options', async () => {
    const counts = { formatterCalls: 0 };
    function Child({ options }: any) {
      expect(counts.formatterCalls).toBe(0);
      return React.createElement('span', null, options.pointFormatter.call({ y: 12 }));
    }
    const Parent = consumer(
      `const currency=state.row.name;
       const options={title:currency,pointFormatter(this:{y:number}){
         counts.formatterCalls++;return currency+':'+this.y;
       }};
       return <Child options={options}/>;`,
      { Child, counts },
    );
    const scope = new ServiceScope([State]);
    try {
      render(
        <Services.ServiceProvider services={[State]} scope={scope}>
          <Parent />
        </Services.ServiceProvider>,
      );
      expect(screen.getByText('Ada:12')).toBeTruthy();
      expect(counts.formatterCalls).toBe(1);
      counts.formatterCalls = 0;
      await change(() => scope.get(State).rename('EUR'));
      expect(screen.getByText('EUR:12')).toBeTruthy();
      expect(counts.formatterCalls).toBe(1);
    } finally {
      cleanup();
      scope.dispose();
    }
  });

  it('allows asynchronous callbacks capturing already evaluated snapshots', async () => {
    let callback: (() => Promise<string>) | undefined;
    function Child({ options }: any) {
      callback = options.loadLabel;
      return React.createElement('span', null, options.title);
    }
    const Parent = consumer(
      `const title=state.row.name;
       return <Child options={{title,loadLabel:async()=>{await Promise.resolve();return title}}}/>;`,
      { Child },
    );
    const scope = new ServiceScope([State]);
    try {
      render(
        <Services.ServiceProvider services={[State]} scope={scope}>
          <Parent />
        </Services.ServiceProvider>,
      );
      const first = callback!;
      expect(await first()).toBe('Ada');
      await change(() => scope.get(State).rename('Grace'));
      expect(await callback!()).toBe('Grace');
      expect(await first()).toBe('Ada');
    } finally {
      cleanup();
      scope.dispose();
    }
  });

  it.each([
    'const title=state.row.name;const renderLabel=()=>title;return <Child renderLabel={renderLabel}/>;',
    'const title=state.row.name;const original=()=>title;const alias=original as ()=>string;return <Child renderLabel={alias!}/>;',
    'const {name:title}=state.row;function renderLabel(){return title}return <Child options={{renderLabel}}/>;',
  ])('accepts evaluated snapshot captures and updates their parent: %s', async (body) => {
    function Child({ renderLabel, options }: any) {
      return React.createElement('span', null, (renderLabel ?? options.renderLabel)());
    }
    const Parent = consumer(body, { Child });
    const scope = new ServiceScope([State]);
    try {
      render(
        <Services.ServiceProvider services={[State]} scope={scope}>
          <Parent />
        </Services.ServiceProvider>,
      );
      expect(screen.getByText('Ada')).toBeTruthy();
      await change(() => scope.get(State).rename('Grace'));
      expect(screen.getByText('Grace')).toBeTruthy();
    } finally {
      cleanup();
      scope.dispose();
    }
  });

  it.each([
    'return <Child options={{renderLabel:()=>state.row.name}}/>;',
    'const row=state.row;return <Child options={{renderLabel:()=>row.name}}/>;',
    'const row=state.row;const renderLabel=factory(row);return <Child options={{renderLabel}}/>;',
    "let title=state.row.name;const options={renderLabel:()=>title};title='changed';return <Child options={options}/>;",
    "const renderLabel=()=>'';renderLabel.row=state.row;return <Child options={{title:state.row.name,renderLabel}}/>;",
    'const callbacks=[];callbacks.push(()=>state.row.name);return <Child options={{title:state.row.name,renderLabel:()=>callbacks[0]()}}/>;',
    'const callbacks={};Object.assign(callbacks,{read:()=>state.row.name});return <Child options={{title:state.row.name,renderLabel:()=>callbacks.read()}}/>;',
    "const box={value:state.row.name};const renderLabel=()=>typeof box.value==='string'?box.value:box.value.name;return <Child options={{renderLabel}} other={(box.value=state.row,'x')}/>;",
    'const value=state.row;function renderLabel(){return value.name}{const value=state.row.name;return <Child options={{renderLabel}}/>;}',
    'const snapshot={name:state.row.name};return <Child options={{renderLabel:()=>snapshot.name}}/>;',
  ])('rejects deferred live reads before an uninstrumented child executes: %s', (body) => {
    const invoked = vi.fn();
    function Child({ options }: any) {
      invoked();
      return React.createElement('span', null, options.renderLabel());
    }
    const scope = new ServiceScope([State]);
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(() => {
        const Parent = consumer(body, {
          Child,
          factory: (row: { name: string }) => () => row.name,
        });
        render(
          <Services.ServiceProvider services={[State]} scope={scope}>
            <Parent />
          </Services.ServiceProvider>,
        );
      }).toThrow(/callback|reactive|boundar|capture/i);
      expect(invoked).not.toHaveBeenCalled();
    } finally {
      errors.mockRestore();
      cleanup();
      scope.dispose();
    }
  });

  it.each([
    'const row=state.row;const format=async()=>row.name;return <TrackedChild formatter={format}/>;',
    'const row=state.row;async function format(){return row.name}return <TrackedChild formatter={format}/>;',
  ])('rejects async live aliases even when the receiving component is compiled: %s', (body) => {
    const counts = { child: 0 };
    const Parent = consumer(
      body,
      { counts },
      'function TrackedChild({formatter}){counts.child++;return <span>{formatter()}</span>}',
    );
    const scope = new ServiceScope([State]);
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(() =>
        render(
          <Services.ServiceProvider services={[State]} scope={scope}>
            <Parent />
          </Services.ServiceProvider>,
        ),
      ).toThrow(/callback|reactive|boundar/i);
      expect(counts.child).toBe(0);
    } finally {
      errors.mockRestore();
      cleanup();
      scope.dispose();
    }
  });

  it.each([
    'return <TrackedChild options={{load:async()=>{await Promise.resolve();return state.row.name}}}/>;',
    'const row=state.row;return <TrackedChild options={{async load(){await Promise.resolve();return row.name}}}/>;',
    'let row=state.row;const options={load:async()=>row.name};row=state.row;return <TrackedChild options={options}/>;',
    'const row=state.row;const later=async()=>row.name;const alias=(later as ()=>Promise<string>)!;const load=()=>alias();return <TrackedChild options={{load}}/>;',
  ])('rejects nested async live callbacks to compiled receivers: %s', (body) => {
    const counts = { child: 0 };
    const scope = new ServiceScope([State]);
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(() => {
        const Parent = consumer(
          body,
          { counts },
          'function TrackedChild({options}){counts.child++;options.load();return <span>child</span>}',
        );
        render(
          <Services.ServiceProvider services={[State]} scope={scope}>
            <Parent />
          </Services.ServiceProvider>,
        );
      }).toThrow(/callback|reactive|boundar|synchronous/i);
      expect(counts.child).toBe(0);
    } finally {
      errors.mockRestore();
      cleanup();
      scope.dispose();
    }
  });
});
