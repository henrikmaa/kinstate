import { parseSync, transformSync } from '@babel/core';
import { describe, expect, it } from 'vitest';
import plugin from '../compiler/src/index.js';

function compile(body: string): string {
  const code = transformSync(`function Fixture(){${body}}`, {
    filename: 'async-patterns.jsx',
    configFile: false,
    babelrc: false,
    plugins: [[plugin, { reactiveProps: true }]],
  })!.code!;
  // Babel generation alone accepts invalid await/yield placement. Reparse it.
  expect(() => parseSync(code, { configFile: false, babelrc: false })).not.toThrow();
  return code;
}

function execute(body: string, inputs: Record<string, unknown>) {
  let tracking = 0;
  const frame = {
    track(callback: () => unknown) {
      tracking++;
      try {
        return callback();
      } finally {
        tracking--;
      }
    },
    finish(value: unknown) {
      return value;
    },
  };
  const code = compile(body).replace(/^import .*?;\n/gm, '');
  const fixture = new Function(
    'useReactive_renderFrame',
    '_markReactiveComponent',
    ...Object.keys(inputs),
    `${code};return Fixture;`,
  )(
    () => frame,
    // This harness executes emitted bodies outside React; memo integration is
    // tested with the real dispatcher in compiler/implicit-memo.test.tsx.
    (component: unknown) => component,
    ...Object.values(inputs),
  );
  return { run: fixture(), isTracking: () => tracking > 0 };
}

describe('suspending destructuring initializers', () => {
  it.each(['{value}', '[value]'])(
    'preserves async %s destructuring and getter collection',
    async (pattern) => {
      const events: string[] = [];
      let isTracking = () => false;
      const payload = pattern.startsWith('{')
        ? {
            get value() {
              events.push(`read:${isTracking()}`);
              return 7;
            },
          }
        : {
            *[Symbol.iterator]() {
              events.push(`read:${isTracking()}`);
              yield 7;
            },
          };
      const result = execute(
        `const load=async()=>{events.push('before');const ${pattern}=await fetchValue();events.push('after');return value;};return load;`,
        {
          events,
          fetchValue: async () => {
            events.push('fetch');
            return payload;
          },
        },
      );
      isTracking = result.isTracking;
      await expect(result.run()).resolves.toBe(7);
      expect(events).toEqual(['before', 'fetch', 'read:true', 'after']);
    },
  );

  it.each(['{value}', '[value]'])('preserves generator %s suspension and resumption', (pattern) => {
    const result = execute(
      `function* load(){const ${pattern}=yield 'request';return value;}return load;`,
      {},
    );
    const generator = result.run();
    expect(generator.next()).toEqual({ done: false, value: 'request' });
    expect(generator.next(pattern.startsWith('{') ? { value: 9 } : [9])).toEqual({
      done: true,
      value: 9,
    });
  });

  it('preserves lexical evaluation of new.target in an awaited initializer', async () => {
    const result = execute(
      `async function load(){const {value}=await Promise.resolve({value:new.target});return value;}return load;`,
      { Promise },
    );
    await expect(result.run()).resolves.toBeUndefined();
  });

  it('preserves rejection and does not evaluate defaults before resolution', async () => {
    const events: string[] = [];
    const error = new Error('request failed');
    const result = execute(
      `const load=async()=>{const {value=(events[0]='default')}=await fetchValue();return value;};return load;`,
      { events, fetchValue: () => Promise.reject(error) },
    );
    await expect(result.run()).rejects.toBe(error);
    expect(events).toEqual([]);
  });

  it.each([
    `const load=async()=>{const {value=await fallback()}=data;};return load;`,
    `const load=async()=>{const {[await key()]:value}=data;};return load;`,
    `function* load(){const {value=yield 'fallback'}=data;}return load;`,
    `function* load(){const {[yield 'key']:value}=data;}return load;`,
  ])('diagnoses suspension inside the pattern: %s', (body) => {
    expect(() => compile(body)).toThrow(
      'Await and yield inside destructuring patterns cannot be tracked synchronously',
    );
  });
});
