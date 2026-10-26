import { expect, it } from 'vitest';
import type { Dependency } from '@kinstate/core';
import { RenderFrame } from '../src/render-frame.js';

it('retains earlier version changes across a later dependency validation failure', () => {
  let version = 0;
  let fail = false;
  const first: Dependency = { getVersion: () => version, subscribe: () => () => {} };
  const second: Dependency = {
    getVersion: () => {
      if (fail) throw new Error('validation');
      return 0;
    },
    subscribe: () => () => {},
  };
  const frame = new RenderFrame();
  frame.adopt(
    new Map([
      [first, 0],
      [second, 0],
    ]),
  );
  const original = frame.getSnapshot();
  expect(frame.getSnapshot()).toBe(original);
  version++;
  fail = true;
  expect(() => frame.getSnapshot()).toThrow('validation');
  fail = false;
  const recovered = frame.getSnapshot();
  expect(recovered).not.toBe(original);
  expect(frame.getSnapshot()).toBe(recovered);
});
