import { transformSync } from '@babel/core';
import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { Service, flushSync } from '@kinstate/core';
import { RenderFrame } from '../../react/src/render-frame.js';
import plugin from '../src/index.js';

const imports = `import { useService } from '@kinstate/react';
import React, { memo, forwardRef, useEffect, useCallback, useMemo } from 'react';`;
function transform(source: string, header = imports): string {
  return transformSync(`${header}\n${source}`, {
    filename: 'composition.tsx',
    configFile: false,
    babelrc: false,
    parserOpts: { plugins: ['typescript', 'jsx'] },
    plugins: [plugin],
  })!.code!;
}

/** Execute the compiler output with a real collector but no React render dispatcher. */
function evaluateView(source: string, service: Service) {
  const code = transformSync(transform(source), {
    filename: 'composition.tsx',
    configFile: false,
    babelrc: false,
    presets: [
      ['@babel/preset-typescript', { allExtensions: true, isTSX: true }],
      ['@babel/preset-react', { runtime: 'classic' }],
    ],
    plugins: [
      () => ({
        visitor: {
          ImportDeclaration(path: { remove(): void }) {
            path.remove();
          },
        },
      }),
    ],
  })!.code!;
  const frame = new RenderFrame();
  const View = new Function(
    'React',
    'useService',
    'useReactive_renderFrame',
    'S',
    'Layout',
    'useEffect',
    'useCallback',
    `${code};return View;`,
  )(
    React,
    () => service,
    () => frame,
    class {},
    () => null,
    () => undefined,
    (callback: unknown) => callback,
  ) as () => React.ReactElement<{
    title?: string;
    children?: unknown;
    onSave?: () => void;
    data?: unknown;
  }>;
  return { View, frame };
}

class State extends Service {
  name = 'Ada';
  count = 1;
  ignored = 0;
  user = { name: 'Ada' };
  items = ['a', 'b'];
  save() {
    this.ignored++;
  }
}

describe('ordinary React component composition', () => {
  it('tracks primitive props and children before crossing a custom component boundary', () => {
    const service = new State();
    const { View, frame } = evaluateView(
      'function View(){const s=useService(S);return <Layout title={s.name}>{s.count}</Layout>}',
      service,
    );
    const element = View();
    expect(element.props.title).toBe('Ada');
    expect(element.props.children).toBe(1);
    let updates = 0;
    const stop = frame.subscribe(() => updates++);
    service.ignored++;
    flushSync();
    expect(updates).toBe(0);
    service.name = 'Grace';
    flushSync();
    expect(updates).toBe(1);
    stop();
  });

  it('preserves ordinary command callbacks without adding event-time read dependencies', () => {
    const service = new State();
    const { View, frame } = evaluateView(
      'function View(){const s=useService(S);const save=useCallback(()=>s.save(),[s]);useEffect(()=>s.save(),[s]);return <Layout onSave={save}/>}',
      service,
    );
    const element = View();
    expect(typeof element.props.onSave).toBe('function');
    let updates = 0;
    const stop = frame.subscribe(() => updates++);
    element.props.onSave!();
    flushSync();
    expect(service.ignored).toBe(1);
    expect(updates).toBe(0);
    stop();
  });

  it('accepts copied plain values while rejecting reactive objects at runtime', () => {
    const service = new State();
    const good = evaluateView(
      'function View(){const s=useService(S);return <Layout data={{name:s.name,items:s.items.map(x=>x)}}/>}',
      service,
    );
    expect(good.View().props.data).toEqual({ name: 'Ada', items: ['a', 'b'] });
    const bad = evaluateView(
      'function View(){const s=useService(S);return <Layout data={{user:s.user}}/>}',
      service,
    );
    expect(() => bad.View()).toThrow(/reactive|useService/i);
  });

  it('guards custom createElement values and accepts command props', () => {
    const code = transform(
      'function View(){const s=useService(S);return React.createElement(Layout,{title:s.name,onSave:()=>s.save()},s.count)}',
    );
    expect(code).toContain('.boundary(');
    expect(code).toContain('"command"');
    const service = new State();
    const { View } = evaluateView(
      'function View(){const s=useService(S);return React.createElement(Layout,{title:s.name,onSave:()=>s.save()},s.count)}',
      service,
    );
    expect(View().props.title).toBe('Ada');
  });

  it('classifies imperative refs separately from deferred render props', () => {
    const jsx = transform(
      'function View(){const s=useService(S);return <Layout ref={()=>s.save()}/>}',
    );
    expect(jsx).toContain('"ref"');
    expect(jsx).toMatch(/boundary\([\s\S]*?=>[\s\S]*?s\.save\(\)/);
    const factory = transform(
      'function View(){const s=useService(S);return React.createElement(Layout,{ref:s.save})}',
    );
    expect(factory).toContain('"ref"');
    expect(factory).toContain('.boundary(');
  });

  it.each([
    'return <Layout render={()=>s.name}/>;',
    'return <Layout>{()=>s.name}</Layout>;',
    'const render=useCallback(()=>s.name,[s]);return <Layout render={render}/>;',
    'return React.createElement(Layout,{render:()=>s.name});',
  ])('diagnoses deferred reactive render props: %s', (body) => {
    expect(() => transform(`function View(){const s=useService(S);${body}}`)).toThrow(
      /render-prop/i,
    );
  });

  it('retains diagnostics for useMemo-hidden reactive reads and direct service escapes', () => {
    expect(() =>
      transform('function View(){const s=useService(S);return useMemo(()=>s.name,[s])}'),
    ).toThrow(/must not hide/);
    expect(() =>
      transform(
        'function View(){const s=useService(S);const read=()=>s.name;return useMemo(read,[s])}',
      ),
    ).toThrow(/must not hide/);
    expect(() =>
      transform('function View(){const s=useService(S);return <Layout service={s}/>}'),
    ).toThrow(/cannot escape/);
    expect(() => transform('function useStateService(){const s=useService(S);return s}')).toThrow(
      /not custom hooks/,
    );
  });

  it.each([
    'const View=memo(()=>{const s=useService(S);return <span>{s.name}</span>});',
    'const View=forwardRef((props,ref)=>{const s=useService(S);return <span ref={ref}>{s.name}</span>});',
    'const View=memo(forwardRef((props,ref)=>{const s=useService(S);return <span ref={ref}>{s.name}</span>}));',
    'export default React.memo(()=>{const s=useService(S);return <span>{s.name}</span>});',
  ])('recognizes documented React wrapper boundaries: %s', (source) => {
    expect(transform(source)).toContain('useService(S, _serviceFrame)');
  });

  it('recognizes aliased wrappers and hook imports without treating arbitrary helpers as components', () => {
    const header = `import {useService} from '@kinstate/react';import {memo as remember,forwardRef as forward,useCallback as command,useEffect as effect} from 'react';`;
    const code = transform(
      'const View=remember(forward((p,r)=>{const s=useService(S);const save=command(()=>s.save(),[s]);effect(()=>s.save(),[s]);return <Layout onSave={save}/>;}));',
      header,
    );
    expect(code).toContain('useService(S, _serviceFrame)');
    expect(() =>
      transform('const View=arbitrary(()=>{const s=useService(S);return s.name});'),
    ).toThrow(/anonymous callbacks/);
  });
});
