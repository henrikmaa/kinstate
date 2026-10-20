import { describe, expect, it } from 'vitest';
import { Service } from '@kinstate/core';
import { assertComponentBoundary } from '../react/src/boundaries.js';
import {
  isReactiveComponent,
  markReactiveComponent,
  markReactiveWrapper,
} from '../react/src/component-tracking.js';

describe('compiler-proven wrapper trust', () => {
  it('resolves late registration without reading React internals or wrapper properties', () => {
    const inner = () => null;
    const wrapper = {
      get type() {
        throw new Error('Must not inspect React internals');
      },
    };
    expect(markReactiveWrapper(wrapper, inner)).toBe(wrapper);
    expect(isReactiveComponent(wrapper)).toBe(false);
    markReactiveComponent(inner);
    expect(isReactiveComponent(wrapper)).toBe(true);
  });
  it('never trusts an uncompiled wrapped function and terminates cyclic trust edges', () => {
    class State extends Service {
      row = { name: 'Ada' };
    }
    const state = new State();
    const wrapper = markReactiveWrapper({}, () => null);
    expect(() => assertComponentBoundary(state.row, 'value', wrapper)).toThrow(/Reactive objects/);
    const other = {};
    markReactiveWrapper(wrapper, other);
    markReactiveWrapper(other, wrapper);
    expect(isReactiveComponent(wrapper)).toBe(false);
  });
});
