import { transformSync } from '@babel/core';
import { describe, expect, it } from 'vitest';
import plugin from '../src/index.js';

function compile(body: string, reactiveProps = false): string {
  return transformSync(
    `import {useService} from '@kinstate/react';function Counter(){const service=useService(State);${body}}`,
    {
      filename: 'function-callback.tsx',
      configFile: false,
      babelrc: false,
      parserOpts: { plugins: ['jsx'] },
      plugins: [[plugin, { reactiveProps }]],
    },
  )!.code!;
}

describe('service-capturing function declarations', () => {
  it.each([
    'function render(){return service.count}return <ThirdParty render={render}/>;',
    'function render(){return service.count}const alias=render;return <ThirdParty render={alias}/>;',
    'function render(){return read()}function read(){return service.count}return <ThirdParty render={render}/>;',
  ])('diagnoses declarations escaping to an uncompiled receiver: %s', (body) => {
    expect(() => compile(body)).toThrow(/render-prop/);
  });
  it('continues accepting ordinary synchronous local helper calls', () => {
    expect(compile('function read(){return service.count}return <span>{read()}</span>')).toContain(
      '.track(() => read())',
    );
  });
  it('keeps event command declarations supported', () => {
    expect(
      compile('function onClick(){service.count++}return <ThirdParty onClick={onClick}/>'),
    ).toContain('"command"');
  });
});
