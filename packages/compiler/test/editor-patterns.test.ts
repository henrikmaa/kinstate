import { transformSync } from '@babel/core';
import { describe, expect, it } from 'vitest';
import plugin from '../src/index.js';

function compile(body: string, extra = '') {
  return transformSync(
    `import {useService} from '@kinstate/react';import {useMemo,useState} from 'react';
    ${extra}function View(){const state=useService(State);${body}}`,
    {
      filename: 'editor-patterns.tsx',
      configFile: false,
      babelrc: false,
      parserOpts: { plugins: ['typescript', 'jsx'] },
      plugins: [[plugin, { reactiveProps: true }]],
    },
  )!.code!;
}

describe('ordinary editor commands and cached projections', () => {
  it('keeps a static icon cache independent of a service command used by list events', () => {
    const code = compile(
      `const add=state.add;const [search]=useState('');
      const names=Object.keys(icons);const filtered=useMemo(()=>names.filter(name=>name.includes(search)),[names,search]);
      return <div>{filtered.map(name=><button onClick={()=>add(name)}>{name}</button>)}</div>;`,
      `import {icons} from 'icon-library';`,
    );
    expect(code).toContain('useServiceMemo');
    expect(code).toContain('names.filter');
  });
  it('permits fresh callback-local mutation payloads and retains their provenance', () => {
    const code = compile(`const update=state.update;const width=state.width;
      const move=()=>{const patch={};patch.width=width;update(patch)};return <button onClick={move}/>;`);
    expect(code).toContain('patch.width = width');
  });
  it.each([
    "const input=document.createElement('input');input.onchange=()=>state.upload(input.files[0]);input.click()",
    'const reader=new FileReader();reader.onload=()=>state.apply(reader.result);reader.readAsDataURL(file)',
  ])('permits native event command registrations: %s', (command) => {
    expect(() =>
      compile(`const open=()=>{${command}};return <button onClick={open}/>;`),
    ).not.toThrow();
  });
  it.each([
    'external.value=state.user;',
    'const target=external;target.value=state.user;',
    'const move=()=>{let patch={};patch=external;patch.value=state.user};return <button onClick={move}/>;',
    'const document=custom;const open=()=>{const input=document.createElement("input");input.onchange=()=>state.save()};return <button onClick={open}/>;',
  ])('retains diagnostics for unproven property escapes: %s', (body) => {
    expect(() => compile(body)).toThrow(/cannot escape through property assignment/);
  });
  it('does not collide with an authored hook-shaped memo helper', () => {
    const code = compile(`const useReactive_serviceMemo=()=>123;
      const value=useMemo(()=>state.name,[]);return <span>{value+useReactive_serviceMemo()}</span>;`);
    expect(code).toMatch(/useServiceMemo as useReactive_serviceMemo\d/);
    expect(code).toContain('const useReactive_serviceMemo =');
  });
  it('does not rewrite a computed React namespace hook as a different hook', () => {
    expect(() =>
      compile(
        `const hook='useCallback';return React[hook](()=>state.name,[]);`,
        `import * as React from 'react';`,
      ),
    ).toThrow(/Computed React namespace calls/);
  });

  it('allows an unshadowed animation frame handle to be retained by an owned ref', () => {
    expect(() =>
      compile(
        `const animation=useRef(null);const step=()=>state.advance();
      const play=()=>{animation.current=requestAnimationFrame(step)};return <button onClick={play}/>;`,
        `import {useRef} from 'react';`,
      ),
    ).not.toThrow();
  });
  it('does not mistake a shadowed scheduler result for a numeric browser handle', () => {
    expect(() =>
      compile(
        `const requestAnimationFrame=arbitrary;const animation=useRef(null);
      const step=()=>state.advance();const play=()=>{external.handle=requestAnimationFrame(step)};
      return <button onClick={play}/>;`,
        `import {useRef} from 'react';`,
      ),
    ).toThrow(/cannot escape through property assignment/);
  });
  it('does not instrument uppercase helpers invoked as ordinary functions', () => {
    const code = compile(
      `return state.rows.map(row=>HANDLE_DEFS(row.width,row.height));`,
      `const HANDLE_DEFS=(w,h)=>[{x:w,y:h}];`,
    );
    expect(code).not.toMatch(/markReactiveComponent\(HANDLE_DEFS/);
    expect(code).not.toMatch(
      /const HANDLE_DEFS[\s\S]*?useReactive_renderFrame\(\)[\s\S]*?function View/,
    );
    expect(code).toContain('HANDLE_DEFS(');
  });
  it('diagnoses direct ordinary calls to functions that themselves consume services', () => {
    expect(() =>
      compile(
        `return Child();`,
        `function Child(){const service=useService(State);return service.name;}`,
      ),
    ).toThrow(/must be rendered by React/);
  });
  it('does not add component hooks to uppercase iteration and event callbacks', () => {
    const code = compile(
      `return <button onClick={ACTION}>{state.rows.map(FORMAT_ROW)}</button>;`,
      `const FORMAT_ROW=row=>row.name;const ACTION=()=>performCommand();`,
    );
    expect(code).not.toMatch(/markReactiveComponent\((FORMAT_ROW|ACTION)/);
  });
  it.each([
    'export default function makeConfig(){return {enabled:true}}',
    'export function GET(){return new Response("ok")}',
    'export const FORMAT=row=>row.name;',
  ])('leaves ordinary .ts modules without React evidence free of injected hooks: %s', (source) => {
    const result = transformSync(source, {
      filename: 'engine.ts',
      configFile: false,
      babelrc: false,
      parserOpts: { plugins: ['typescript', 'jsx'] },
      plugins: [[plugin, { reactiveProps: true }]],
    })!.code!;
    expect(result).not.toContain('useRenderFrame');
    expect(result).not.toContain('markReactiveComponent');
  });
  it('keeps primitive-returning components in TSX modules reactive', () => {
    const code = transformSync('export default function Name({row}){return row.name}', {
      filename: 'primitive.tsx',
      configFile: false,
      babelrc: false,
      parserOpts: { plugins: ['typescript', 'jsx'] },
      plugins: [[plugin, { reactiveProps: true }]],
    })!.code!;
    expect(code).toContain('useRenderFrame');
    expect(code).toContain('markReactiveComponent');
  });
});
