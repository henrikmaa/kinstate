import React, {
  Suspense,
  startTransition,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { jsx, jsxs } from 'react/jsx-runtime';
import { transformSync } from '@babel/core';
import type * as t from '@babel/types';
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Service, ServiceScope } from '@kinstate/core';
import { ServiceProvider, useService } from '@kinstate/react';
import * as internal from '@kinstate/react/internal';
import plugin from '../src/index.js';

afterEach(cleanup);

/** Execute compiler output with React's real dispatcher and the packaged ABI. */
function compile(source: string, globals: Record<string, unknown> = {}) {
  const transformed = transformSync(source, {
    filename: 'memo-consumer.tsx',
    configFile: false,
    babelrc: false,
    ast: true,
    parserOpts: { plugins: ['typescript', 'jsx'] },
    plugins: [[plugin, { reactiveProps: true }]],
    presets: [['@babel/preset-react', { runtime: 'automatic' }]],
  })!;
  const runtime: Record<string, unknown> = {
    ...internal,
    useService,
    useMemo,
    useState,
    useReducer: React.useReducer,
    useRef,
    useLayoutEffect,
    jsx,
    jsxs,
  };
  const names: string[] = [],
    values: unknown[] = [];
  for (const node of transformed.ast!.program.body) {
    if (node.type !== 'ImportDeclaration') continue;
    for (const specifier of (node as t.ImportDeclaration).specifiers) {
      if (specifier.type !== 'ImportSpecifier') throw new Error('Use named fixture imports');
      names.push(specifier.local.name);
      values.push(
        runtime[
          specifier.imported.type === 'Identifier'
            ? specifier.imported.name
            : specifier.imported.value
        ],
      );
    }
  }
  return new Function(
    ...names,
    ...Object.keys(globals),
    `${transformed.code!.replace(/^import[^;]*;\n/gm, '')};return View;`,
  )(...values, ...Object.values(globals)) as React.ComponentType<Record<string, unknown>>;
}

class State extends Service {
  row = { name: 'Ada', ignored: 0 };
  alternate = false;
  other = 'Grace';
}

describe('compiled memo dependency replay', () => {
  it('retains caches for unchanged plain props and recomputes for authored dependencies', () => {
    let computations = 0;
    const View = compile(
      `import {useMemo} from 'react';
      function View({file}) { const name=useMemo(()=>format(file),[file]);return <span>{name}</span> }`,
      {
        format: (file: { name: string }) => {
          computations++;
          return file.name;
        },
      },
    );
    const file = { name: 'first' };
    const view = render(<View file={file} />);
    expect(computations).toBe(1);
    view.rerender(<View file={file} />);
    expect(computations).toBe(1);
    view.rerender(<View file={{ name: 'second' }} />);
    expect(computations).toBe(2);
    expect(screen.getByText('second')).toBeTruthy();
  });

  it('replays cached reactive reads and invalidates only their versions', async () => {
    const scope = new ServiceScope([State]);
    const state = scope.get(State);
    let computations = 0;
    const View = compile(
      `import {useMemo} from 'react';import {useService} from '@kinstate/react';
      function View({tick}) { const service=useService(State);const row=service.row;
        const name=useMemo(()=>format(row),[row]);return <span>{name}:{tick}</span> }`,
      {
        State,
        format: (row: { name: string }) => {
          computations++;
          return row.name;
        },
      },
    );
    const tree = (tick: number) => (
      <ServiceProvider services={[State]} scope={scope}>
        <View tick={tick} />
      </ServiceProvider>
    );
    const view = render(tree(0));
    expect(computations).toBe(1);
    view.rerender(tree(1));
    expect(computations).toBe(1);
    await act(async () => {
      state.row.ignored++;
    });
    expect(computations).toBe(1);
    await act(async () => {
      state.row.name = 'changed';
    });
    expect(screen.getByText('changed:1')).toBeTruthy();
    expect(computations).toBe(2);
    scope.dispose();
  });

  it('tracks direct memo reads even with an empty authored dependency array in props-aware mode', async () => {
    const scope = new ServiceScope([State]);
    const state = scope.get(State);
    const View = compile(
      `import {useMemo} from 'react';import {useService} from '@kinstate/react';
      function View(){const service=useService(State);const value=useMemo(()=>service.row.name,[]);return <span>{value}</span>}`,
      { State },
    );
    render(
      <ServiceProvider services={[State]} scope={scope}>
        <View />
      </ServiceProvider>,
    );
    await act(async () => {
      state.row.name = 'fresh';
    });
    expect(screen.getByText('fresh')).toBeTruthy();
    scope.dispose();
  });

  it('replaces cached conditional dependencies', async () => {
    const scope = new ServiceScope([State]);
    const state = scope.get(State);
    let computations = 0;
    const View = compile(
      `import {useMemo} from 'react';import {useService} from '@kinstate/react';
      function View(){const service=useService(State);const value=useMemo(()=>read(service.alternate ? service.other : service.row.name),[]);return <span>{value}</span>}`,
      {
        State,
        read: (value: string) => {
          computations++;
          return value;
        },
      },
    );
    render(
      <ServiceProvider services={[State]} scope={scope}>
        <View />
      </ServiceProvider>,
    );
    await act(async () => {
      state.alternate = true;
    });
    expect(screen.getByText('Grace')).toBeTruthy();
    const baseline = computations;
    await act(async () => {
      state.row.name = 'inactive';
    });
    expect(computations).toBe(baseline);
    await act(async () => {
      state.other = 'active';
    });
    expect(screen.getByText('active')).toBeTruthy();
    scope.dispose();
  });

  it('refreshes memo values after a mutation before subscriptions install', async () => {
    const scope = new ServiceScope([State]);
    const state = scope.get(State);
    const View = compile(
      `import {useMemo} from 'react';import {useService} from '@kinstate/react';
      function View(){const service=useService(State);return <span>{useMemo(()=>service.row.name,[])}</span>}`,
      { State },
    );
    function Mutator() {
      useLayoutEffect(() => {
        state.row.name = 'commit-race';
      }, []);
      return null;
    }
    render(
      <ServiceProvider services={[State]} scope={scope}>
        <View />
        <Mutator />
      </ServiceProvider>,
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText('commit-race')).toBeTruthy();
    scope.dispose();
  });

  it('does not publish memo cache metadata from a suspended transition', async () => {
    const scope = new ServiceScope([State]);
    const state = scope.get(State);
    let release!: () => void;
    let waiting = true;
    const gate = new Promise<void>((resolve) => {
      release = () => {
        waiting = false;
        resolve();
      };
    });
    const View = compile(
      `import {useMemo} from 'react';import {useService} from '@kinstate/react';
      function View({alternate}){const service=useService(State);
        const value=useMemo(()=>alternate ? service.other : service.row.name,[alternate]);
        wait(alternate);return <span data-testid="memo-value">{value}</span>}`,
      {
        State,
        wait: (alternate: boolean) => {
          if (alternate && waiting) throw gate;
        },
      },
    );
    function App() {
      const [alternate, setAlternate] = useState(false);
      return (
        <>
          <button onClick={() => startTransition(() => setAlternate(true))}>switch</button>
          <Suspense fallback="waiting">
            <View alternate={alternate} />
          </Suspense>
        </>
      );
    }
    render(
      <ServiceProvider services={[State]} scope={scope}>
        <App />
      </ServiceProvider>,
    );
    await act(async () => {
      fireEvent.click(screen.getByText('switch'));
    });
    expect(screen.getByTestId('memo-value').textContent).toBe('Ada');
    await act(async () => {
      state.row.name = 'current';
      state.other = 'future';
    });
    expect(screen.getByTestId('memo-value').textContent).toBe('current');
    await act(async () => {
      release();
      await gate;
    });
    expect(screen.getByTestId('memo-value').textContent).toBe('future');
    scope.dispose();
  });

  it('preserves failed opaque factory reads and recovers without changing hook order', async () => {
    const scope = new ServiceScope([State]);
    const state = scope.get(State);
    const View = compile(`import {useMemo,useState} from 'react';
      function View({read}) {let value;try {value=useMemo(read,[])}catch {value='fallback'}
        const [suffix]=useState('suffix');return <span>{value}:{suffix}</span>}`);
    const read = () => {
      const name = state.row.name;
      if (name === 'Ada') throw new Error('not ready');
      return name;
    };
    render(<View read={read} />);
    expect(screen.getByText('fallback:suffix')).toBeTruthy();
    await act(async () => {
      state.row.name = 'recovered';
    });
    expect(screen.getByText('recovered:suffix')).toBeTruthy();
    scope.dispose();
  });

  it('validates a newly committed branch mutated before memo metadata effects run', async () => {
    const scope = new ServiceScope([State]);
    const state = scope.get(State);
    const View = compile(
      `import {useMemo} from 'react';import {useService} from '@kinstate/react';
      function View({alternate}){const service=useService(State);
        return <span>{useMemo(()=>alternate ? service.other : service.row.name,[alternate])}</span>}`,
      { State },
    );
    function Mutator({ alternate }: { alternate: boolean }) {
      useLayoutEffect(() => {
        if (alternate) state.other = 'layout-current';
      }, [alternate]);
      return null;
    }
    const tree = (alternate: boolean) => (
      <ServiceProvider services={[State]} scope={scope}>
        <View alternate={alternate} />
        <Mutator alternate={alternate} />
      </ServiceProvider>
    );
    const view = render(tree(false));
    view.rerender(tree(true));
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText('layout-current')).toBeTruthy();
    scope.dispose();
  });

  it('retains pure definition-method caches with unchanged definitions', () => {
    let computations = 0;
    const definition = {
      build: (x: number, y: number) => {
        computations++;
        return x + y + '-preview';
      },
    };
    const View = compile(`import {useMemo} from 'react';
      function View({definition}){return <span>{useMemo(()=>definition.build(0,0),[definition])}</span>}`);
    const view = render(<View definition={definition} />);
    view.rerender(<View definition={definition} />);
    expect(computations).toBe(1);
    expect(screen.getByText('0-preview')).toBeTruthy();
  });

  it('retries a memo factory that suspends during a dependency switch', async () => {
    const scope = new ServiceScope([State]);
    const state = scope.get(State);
    let release!: () => void;
    let waiting = true;
    const gate = new Promise<void>((resolve) => {
      release = () => {
        waiting = false;
        resolve();
      };
    });
    const View = compile(
      `import {useMemo} from 'react';import {useService} from '@kinstate/react';
      function View({alternate}){const service=useService(State);
        const value=useMemo(()=>compute(alternate,alternate ? service.other : service.row.name),[alternate]);
        return <span data-testid="factory-value">{value}</span>}`,
      {
        State,
        compute: (alternate: boolean, value: string) => {
          if (alternate && waiting) throw gate;
          return value;
        },
      },
    );
    function App() {
      const [alternate, setAlternate] = useState(false);
      return (
        <>
          <button onClick={() => startTransition(() => setAlternate(true))}>factory switch</button>
          <Suspense fallback="waiting">
            <View alternate={alternate} />
          </Suspense>
        </>
      );
    }
    render(
      <ServiceProvider services={[State]} scope={scope}>
        <App />
      </ServiceProvider>,
    );
    await act(async () => {
      fireEvent.click(screen.getByText('factory switch'));
    });
    expect(screen.getByTestId('factory-value').textContent).toBe('Ada');
    await act(async () => {
      release();
      await gate;
    });
    expect(screen.getByTestId('factory-value').textContent).toBe('Grace');
    scope.dispose();
  });

  it('supports effect snapshot writes through a React DOM-ref alias', () => {
    const View = compile(`import {useRef,useLayoutEffect} from 'react';
      function View({content}){const ref=useRef(null);useLayoutEffect(()=>{const el=ref.current;
        if(el)el.textContent=content;},[content]);return <span ref={ref}/>}`);
    const view = render(<View content="first" />);
    expect(screen.getByText('first')).toBeTruthy();
    view.rerender(<View content="second" />);
    expect(screen.getByText('second')).toBeTruthy();
  });

  it('rejects a live reactive object retained in a React ref after commit', () => {
    const state = new State();
    const View = compile(`import {useRef,useLayoutEffect} from 'react';
      function View({value}){const ref=useRef(null);useLayoutEffect(()=>{ref.current=value;},[value]);return null;}`);
    expect(() => render(<View value={state.row} />)).toThrow(/Reactive objects cannot cross/);
  });

  it.each(['undefined', 'null'])(
    'retains native no-cache semantics for %s dependencies',
    (dependencyList) => {
      let computations = 0;
      const View = compile(
        `import {useMemo} from 'react';function View(){return <span>{useMemo(compute,${dependencyList})}</span>}`,
        { compute: () => ++computations },
      );
      const view = render(<View tick={0} />);
      view.rerender(<View tick={1} />);
      expect(computations).toBe(2);
    },
  );

  it('forwards root event and ref props through a compiled UI wrapper', async () => {
    let clicks = 0;
    const ref = React.createRef<HTMLButtonElement>();
    const ThirdParty = React.forwardRef<
      HTMLButtonElement,
      { onClick: () => void; children: React.ReactNode }
    >((props, forwarded) => (
      <button ref={forwarded} onClick={props.onClick}>
        {props.children}
      </button>
    ));
    const View = compile(
      `function View({label,forwardedProps}){return <ThirdParty {...forwardedProps}>{label}</ThirdParty>}`,
      { ThirdParty },
    );
    render(
      <View
        label="spread button"
        forwardedProps={{
          onClick: () => {
            clicks++;
          },
          ref,
        }}
      />,
    );
    expect(ref.current).toBe(screen.getByText('spread button'));
    fireEvent.click(screen.getByText('spread button'));
    expect(clicks).toBe(1);
  });

  it('does not treat on* properties inside nested config as JSX command props', () => {
    const state = new State();
    const ThirdParty = () => <span>never rendered</span>;
    const View = compile(`function View({...props}){return <ThirdParty {...props}/>}`, {
      ThirdParty,
    });
    expect(() => render(<View config={{ onClick: () => state.row.name }} />)).toThrow(
      /Reactive render callbacks cannot cross/,
    );
  });

  it.each([
    "const [value,setValue]=useState('first')",
    "const [value,setValue]=useReducer((_,next)=>next,'first')",
  ])(
    'forwards a genuine ordinary React dispatcher through a compiled spread wrapper: %s',
    (declaration) => {
      const ThirdParty = ({
        value,
        setActiveSnapPoint,
      }: {
        value: string;
        setActiveSnapPoint: (value: string) => void;
      }) => <button onClick={() => setActiveSnapPoint('next')}>{value}</button>;
      const View = compile(
        `import {useState,useReducer} from 'react';
      function Wrapper(props){return <ThirdParty {...props}/>}
      function View(){${declaration};return <Wrapper value={value} setActiveSnapPoint={setValue}/>}`,
        { ThirdParty },
      );
      render(<View />);
      fireEvent.click(screen.getByText('first'));
      expect(screen.getByText('next')).toBeTruthy();
    },
  );

  it('does not certify an arbitrary function stored as React state as a dispatcher', () => {
    const ThirdParty = () => null;
    const View = compile(
      `import {useState} from 'react';
      function Wrapper(props){return <ThirdParty {...props}/>}
      function View(){const [formatter]=useState(()=>()=> 'stored');return <Wrapper formatter={formatter}/>}`,
      { ThirdParty },
    );
    expect(() => render(<View />)).toThrow(/Reactive render callbacks cannot cross/);
  });

  it('does not certify a function-valued state value when mixed with reactive config', () => {
    const ThirdParty = () => null;
    const scope = new ServiceScope([State]);
    const View = compile(
      `import {useState} from 'react';import {useService} from '@kinstate/react';
      function Wrapper(props){return <ThirdParty {...props}/>}
      function View(){const service=useService(State);const [formatter]=useState(()=>()=> 'stored');
        return <Wrapper config={{label:service.other,formatter}}/>}`,
      { ThirdParty, State },
    );
    try {
      expect(() =>
        render(
          <ServiceProvider services={[State]} scope={scope}>
            <View />
          </ServiceProvider>,
        ),
      ).toThrow(/Reactive render callbacks cannot cross/);
    } finally {
      scope.dispose();
    }
  });
  it('keeps uppercase utility call counts out of React hook ordering across empty and multi-selection', () => {
    const View = compile(`const HANDLE_DEFS=(w,h)=>[{x:w,y:h}];
      function View({count}){if(!count)return <span>empty</span>;
        const selected=Array.from({length:count},(_,i)=>HANDLE_DEFS(i,i));
        return <span>{selected.length} selected</span>}`);
    const view = render(<View count={0} />);
    view.rerender(<View count={1} />);
    expect(screen.getByText('1 selected')).toBeTruthy();
    view.rerender(<View count={5} />);
    expect(screen.getByText('5 selected')).toBeTruthy();
    view.rerender(<View count={0} />);
    expect(screen.getByText('empty')).toBeTruthy();
  });
});
