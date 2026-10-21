import { transformSync } from '@babel/core';
import type * as t from '@babel/types';
import { Service, flushSync } from '@kinstate/core';
import { RenderFrame, markReactiveComponent, markReactiveWrapper } from '@kinstate/react/internal';
import { describe, expect, it } from 'vitest';
import plugin from '../src/index.js';

class State extends Service {
  count = 0;
  ignored = 0;
  useCount<T = unknown>() {
    return this.count;
  }
}

/** Run emitted JavaScript against the real collector; React's dispatcher is the only stub. */
function execute(source: string, name: string, reactiveProps = false, state = new State()) {
  const transformed = transformSync(source, {
    filename: 'expression-parameter-fixture.tsx',
    configFile: false,
    babelrc: false,
    ast: true,
    parserOpts: { plugins: ['typescript', 'jsx'], createParenthesizedExpressions: true },
    plugins: [[plugin, { reactiveProps }]],
    presets: [['@babel/preset-typescript', { allExtensions: true, isTSX: true }]],
  })!;
  let frame: RenderFrame;
  const runtime: Record<string, unknown> = {
    useRenderFrame: () => (frame = new RenderFrame()),
    markReactiveComponent,
    markReactiveWrapper,
    useService: () => state,
  };
  const imports = transformed.ast!.program.body.filter(
    (node): node is t.ImportDeclaration => node.type === 'ImportDeclaration',
  );
  const parameters: string[] = [],
    values: unknown[] = [];
  for (const declaration of imports)
    for (const specifier of declaration.specifiers) {
      if (specifier.type !== 'ImportSpecifier') throw new Error('Fixture imports must be named');
      parameters.push(specifier.local.name);
      values.push(
        runtime[
          specifier.imported.type === 'Identifier'
            ? specifier.imported.name
            : specifier.imported.value
        ],
      );
    }
  const render = new Function(
    ...parameters,
    'State',
    `${transformed.code!.replace(/^import[^;]*;\n/gm, '').replace(/^export \{\};?\n?/gm, '')};return ${name};`,
  )(...values, State) as (props?: unknown) => unknown;
  return { render, state, frame: () => frame! };
}

const serviceHeader = "import {useService} from '@kinstate/react';";
describe('transparent callable expression wrappers', () => {
  it.each([
    'service.useCount satisfies () => number',
    '((service.useCount as () => number) satisfies () => number)!',
    'service.useCount<number>',
    '((service.useCount<number>) satisfies () => number)',
  ])('retains observed reads through %s', (initializer) => {
    const compiled = execute(
      `${serviceHeader}function Counter(){const service=useService(State);const useCount=${initializer};return useCount()}`,
      'Counter',
    );
    expect(compiled.render()).toBe(0);
    let updates = 0;
    const stop = compiled.frame().subscribe(() => updates++);
    try {
      compiled.state.ignored++;
      flushSync();
      expect(updates).toBe(0);
      compiled.state.count++;
      flushSync();
      expect(updates).toBe(1);
      expect(compiled.render()).toBe(1);
    } finally {
      stop();
    }
  });
});

describe('computed receiving-component parameter keys', () => {
  it.each([
    "const key='count';function Child({[key]:value}){var key='other';return value}",
    "const key='count';function Child({[key]:value}){let key='other';return value}",
    "const key='count';function Child({nested:{[key]:value}}){function key(){}return value}",
    'function Child(key,{[key]:value}){return value}',
    'function Child({[key]:value},key){return value}',
  ])('diagnoses parameter/body binding scope changes: %s', (source) => {
    expect(() => execute(source, 'Child', true)).toThrow(
      /Computed component parameter keys cannot reference component parameters or body bindings/,
    );
  });
  it.each([
    "function Child({['count']:value}){var key='other';return value}",
    "const key='count';function Child({[key]:value}){var other='ignored';return value}",
    "const constants={key:'count'};function Child({[constants.key]:value}){var key='other';return value}",
    "function Child({[(()=>{const key='count';return key})()]:value}){var key='other';return value}",
  ])('preserves accepted computed-key execution: %s', (source) => {
    const original = new Function(`${source};return Child;`)() as (props: unknown) => unknown;
    const compiled = execute(source, 'Child', true);
    expect(original({ count: 3 })).toBe(3);
    expect(compiled.render({ count: 3 })).toBe(original({ count: 3 }));
  });
});
