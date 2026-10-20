import { transformSync } from '@babel/core';
import { describe, expect, it } from 'vitest';
import plugin from '../src/index.js';
import kinstate from '../src/vite.js';
const transform = (body: string, imports = 'import { useService } from "@kinstate/react";') =>
  transformSync(`${imports}\n${body}`, {
    filename: 'fixture.tsx',
    configFile: false,
    babelrc: false,
    parserOpts: {
      plugins: ['typescript', 'jsx'],
    },
    plugins: [plugin],
  })!.code!;
describe('render dependency compiler', () => {
  it('inserts a frame and seals returns without wrapping the component or hooks', () => {
    const code = transform(
      'function Counter(){ const service = useService(CounterService); const [x] = useState(0); return <div>{service.count}</div>; }',
    );
    expect(code).toContain('useRenderFrame as useReactive_renderFrame');
    expect(code).toContain('from "@kinstate/react/internal"');
    expect(code).toContain('useService(CounterService, _serviceFrame)');
    expect(code).toContain('_serviceFrame.track(() => service.count)');
    expect(code).toContain('_serviceFrame.finish(<div>');
    expect(code).toContain('use no memo');
    expect(code).not.toContain('track(() => useState');
  });
  it('supports hook import aliases and concise arrows', () => {
    const code = transform(
      'const Counter = () => {const service=useCounter(CounterService);return service.count;};',
      'import { useService as useCounter } from "@kinstate/react";',
    );
    expect(code).toContain('useCounter(CounterService, _serviceFrame)');
    // A hook must remain in the component, never inside a tracking callback.
    expect(code).not.toContain('track(() => useCounter');
    expect(code).toContain('.finish(');
  });
  it('preserves method receivers, detached handlers, and optional chains', () => {
    const code = transform(
      'function Counter(){ const s = useService(S); const onClick = () => s.increment(); return <button onClick={onClick}>{s.user?.name ?? s.label()}</button>; }',
    );
    expect(code).toContain('track(() => s.increment())');
    expect(code).toContain('track(() => s.label())');
    expect(code).not.toContain('track(() => s.increment)()');
    expect(code).toContain('?.name');
  });
  it('does not turn mutation targets into callback results', () => {
    const code = transform(
      'function Counter(){ const s=useService(S); return <button onClick={()=>s.count++}>{s.count}</button> }',
    );
    expect(code).toContain('() => s.count++');
  });
  it('seals early returns but leaves nested callback returns alone', () => {
    const code = transform(
      'function Counter(){const s=useService(S); if(s.flag) return null; return s.items.map(x=>{ return x.name; });}',
    );
    expect(code).toContain('return _serviceFrame.finish(null)');
    expect(code).toContain('return _serviceFrame.track(() => x.name)');
  });
  it.each([
    ['const Counter=()=>useService(S).count;', /local binding/],
    ['function useCounter(){const s=useService(S);return s.count}', /not custom hooks/],
    ['async function Counter(){const s=useService(S);return s.count}', /synchronous/],
    ['function Counter(){const s=useService(S);return <Child service={s}/>}', /cannot escape/],
    ['function Counter(){const s=useService(S);return helper(s)}', /cannot escape/],
    ['function Counter(){const s=useService(S);const a=s;return helper(a)}', /cannot escape/],
    [
      'function Counter(){const s=useService(S);const user=s.user;return useMemo(()=>user.name,[])}',
      /must not hide/,
    ],
    [
      'function Counter(){const s=useService(S);const Item=()=> <span>{s.count}</span>;return <Item/>}',
      /Nested components/,
    ],
    [
      'function Counter(){const s=useService(S);return <Child>{()=>s.count}</Child>}',
      /render-prop/,
    ],
    [
      'function Counter(){const s=useService(S);return <Child render={()=>s.count}/>}',
      /render-prop/,
    ],
    ['function Counter(){const s=useService(S);return useMemo(()=>s.count,[])}', /must not hide/],
    [
      'function Counter(){const s=useService(S);return s.format(useId())}',
      /cannot be nested inside a reactive read/,
    ],
    [
      'function Counter(){const s=useService(S);return React.createElement(Child,null,()=>s.count)}',
      /render-prop/,
    ],
    [
      'function Counter(){const s=useService(S);let {x,f=()=>x}=s.obj;x=2;return f()}',
      /Function-valued destructuring defaults/,
    ],
    [
      'let leaked;function Counter(){const s=useService(S);leaked=s.user;return null}',
      /outside the consuming component/,
    ],
  ])('diagnoses unsupported tracking: %s', (body, error) =>
    expect(() => transform(body)).toThrow(error),
  );
  it('allows stable service identity comparisons and Object iteration', () => {
    const code = transform(
      'function Counter(){const a=useService(S);const b=useService(S);return <div>{a===b}{Object.keys(a).join(",")}</div>}',
    );
    expect(code).toContain('a === b');
    expect(code).toContain('track(() => Object.keys(a))');
  });
  it('tracks synchronous external helpers without losing their nested reads', () => {
    const code = transform('function Counter(){const s=useService(S);return helper(s.nested);}');
    expect(code).toContain('track(() => helper(');
  });
  it('supports reactive writes in event callbacks and intrinsic createElement props', () => {
    const code = transform(
      'function Counter(){const s=useService(S);return React.createElement("button",{onClick:()=>s.count=s.count+1},s.count)}',
    );
    expect(code).toContain('s.count =');
    expect(code).toContain('"button"');
  });
  it('guards aliased React createElement component props', () => {
    expect(
      transform(
        'function Counter(){const s=useService(S);return h(Child,{user:s.user})}',
        'import {useService} from "@kinstate/react";import {createElement as h} from "react";',
      ),
    ).toContain('boundary');
  });
  it('tracks destructuring and lazy loop iterations', () => {
    const code = transform(
      'function Counter(){const s=useService(S);const {count: value}=s;for(const x of s.items){console.log(x.name)}for(const k in s){console.log(k)}return value;}',
    );
    expect(code).toContain('const {\n      count: value\n    } = s;');
    expect(code).toContain('.iterate(');
    expect(code).toContain('.keys(s)');
  });
  it('does not instrument shadowed service imports', () => {
    const code = transform('function helper(useService){return useService(S)}');
    expect(code).not.toContain('useRenderFrame');
  });
  it('leaves unrelated modules unchanged', () =>
    expect(transform('const x = obj.value;', '')).toBe('const x = obj.value;'));
  it('produces Vite source maps while preserving TypeScript and JSX', async () => {
    const vite = kinstate();
    expect(vite.name).toBe('kinstate');
    const hook = vite.transform as (
      code: string,
      id: string,
    ) => Promise<{
      code: string;
      map: unknown;
    }>;
    const result = await hook(
      'import {useService} from "@kinstate/react"; function Counter(): JSX.Element {const s=useService(S);return <div>{s.count}</div>}',
      '/app/Counter.tsx',
    );
    expect(result.code).toContain('JSX.Element');
    expect(result.code).toContain('<div>');
    expect(result.map).toBeTruthy();
  });
});
