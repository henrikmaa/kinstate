import { transformSync } from '@babel/core';
import { describe, expect, it } from 'vitest';
import { Linter } from 'eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import plugin from '../src/index.js';
const compile = (body: string, extra = '') =>
  transformSync(
    `import React,{useMemo,createElement,useState} from 'react';import {useService} from '@kinstate/react';${extra}function Counter(){const service=useService(State);${body}}`,
    {
      filename: 'audit.tsx',
      configFile: false,
      babelrc: false,
      parserOpts: { plugins: ['typescript', 'jsx'] },
      plugins: [plugin],
    },
  )!.code!;
describe('tracking correctness audit', () => {
  it('does not treat shadowed memo helpers as React memoization', () => {
    const code = compile('const useMemo=fn=>fn();return useMemo(()=>service.count)');
    expect(code).toContain('.track(() => service.count)');
  });
  it('does not guard props passed to a shadowed element factory', () => {
    const code = compile(
      'const createElement=value=>value;return createElement({render:()=>service.count})',
    );
    expect(code).not.toContain('.boundary(');
    expect(code).toContain('.track(() => service.count)');
  });
  it('retains explicit memo diagnostics for actual imported hooks', () => {
    expect(() => compile('return useMemo(()=>service.count,[])')).toThrow(/must not hide/);
  });
  it('keeps actual React hooks outside tracking collectors', () => {
    const code = compile(
      'const [count]=useState(0);return <span>{count+service.useCount()}</span>',
    );
    expect(code).toContain('useState(0)');
    expect(code).not.toContain('.track(() => useState');
    expect(code).toContain('service["useCount"]()');
  });
  it('keeps service method names compatible with the official Rules of Hooks lint', () => {
    const code = compile(
      'const useCount=service.useCount;const [local]=useState(0);return <span>{useCount()+service.useCount()+local}</span>',
    );
    const lint = new Linter();
    expect(
      lint.verify(code, [
        {
          languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            parserOptions: { ecmaFeatures: { jsx: true } },
          },
          plugins: { 'react-hooks': { rules: reactHooks.rules } },
          rules: { 'react-hooks/rules-of-hooks': 'error' },
        },
      ]),
    ).toEqual([]);
  });
  it('diagnoses reassigned service method aliases with hook-like names', () => {
    expect(() => compile('let useCount=service.useCount;useCount=other;return useCount()')).toThrow(
      /must not be reassigned/,
    );
  });
  it('diagnoses computed React namespace hooks instead of moving them into a collector', () => {
    expect(() => compile("const [count]=React['useState'](0);return count+service.count")).toThrow(
      /Computed React namespace calls/,
    );
  });
  it.each([
    'try{return <span>ignored</span>}finally{return <span>{service.count}</span>}',
    'try{throw new Error()}catch(error){return service.count}finally{cleanup()}',
  ])('diagnoses component returns crossing finally: %s', (body) => {
    expect(() => compile(body)).toThrow(/returns cannot cross finally/);
  });
  it('supports a return after try/finally and returns in ordinary nested helpers', () => {
    expect(compile('try{read()}finally{cleanup()}return service.count')).toContain('.finish(');
    expect(
      compile('const read=()=>{try{return service.count}finally{cleanup()}};return read()'),
    ).toContain('.finish(');
  });
});
