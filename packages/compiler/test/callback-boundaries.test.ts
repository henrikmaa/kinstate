import { transformSync } from '@babel/core';
import { describe, expect, it } from 'vitest';
import plugin from '../src/index.js';

function compile(body: string, reactiveProps = true) {
  return transformSync(
    `import {useService} from '@kinstate/react';
     import {useState} from 'react';import {Child} from './external';
     function Parent(){const state=useService(State);${body}}`,
    {
      filename: 'callbacks.tsx',
      configFile: false,
      babelrc: false,
      parserOpts: { plugins: ['typescript', 'jsx'] },
      plugins: [[plugin, { reactiveProps }]],
    },
  )!.code!;
}

describe('snapshot callback compilation', () => {
  it.each([
    'const title=state.name;return <Child formatter={()=>title}/>;',
    'const title=state.name;const format=()=>title;const alias=(format as ()=>string)!;return <Child formatter={alias}/>;',
    'const title=state.name;function format(){return title}return <Child formatter={format}/>;',
    'const [collapsed,setIsCollapsed]=useState(false);return <Child options={{title:state.name,collapsed,setIsCollapsed,formatter:(value:string)=>value.toUpperCase()}}/>;',
    'const {name:title}=state.row;return <Child options={{title,formatter:()=>title}}/>;',
  ])('preserves valid JavaScript for safe callbacks: %s', (body) => {
    const code = compile(body);
    expect(code).toContain('function Parent');
    expect(code).toMatch(/useService\(State[,)]/);
    expect(() =>
      transformSync(code, {
        filename: 'callbacks.tsx',
        configFile: false,
        babelrc: false,
        parserOpts: { plugins: ['typescript', 'jsx'] },
      }),
    ).not.toThrow();
  });

  it('also permits safe snapshot callbacks without automatic receiving-component instrumentation', () => {
    expect(() =>
      compile('const title=state.name;return <Child formatter={()=>title}/>;', false),
    ).not.toThrow();
  });

  it('continues diagnosing asynchronous live render callbacks to compiled receivers', () => {
    expect(() => compile('return <Child formatter={async()=>state.name}/>;')).toThrow(
      /synchronous/,
    );
  });
});
