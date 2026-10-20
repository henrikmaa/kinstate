import { createElement, createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Service } from '@kinstate/core';
import { assertComponentBoundary } from '../react/src/boundaries.js';

class Data extends Service {
  nested = { count: 1 };
}
describe('uninstrumented component value boundaries', () => {
  it('does not invoke own getters, including React element branding getters', () => {
    const getter = vi.fn(() => 'value');
    const value = Object.defineProperty({}, '$$typeof', { get: getter });
    expect(() => assertComponentBoundary(value, 'value')).toThrow(/getters/);
    expect(getter).not.toHaveBeenCalled();
  });
  it('rejects inherited reads without invoking their getters', () => {
    const service = new Data();
    const getter = vi.fn(() => service.nested);
    const value = Object.create(Object.defineProperty({}, 'user', { get: getter }));
    expect(() => assertComponentBoundary(value, 'value')).toThrow(/prototype/);
    expect(getter).not.toHaveBeenCalled();
  });
  it('accepts React elements with framework-owned key/ref accessors and imperative refs', () => {
    const ref = createRef<HTMLInputElement>();
    expect(() =>
      assertComponentBoundary(createElement('input', { key: 'field', ref }), 'value'),
    ).not.toThrow();
    expect(() => assertComponentBoundary(ref, 'ref')).not.toThrow();
    expect(() => assertComponentBoundary(() => {}, 'ref')).not.toThrow();
    const getter = vi.fn(() => ({}));
    const bad = Object.defineProperty({}, 'current', { get: getter });
    expect(() => assertComponentBoundary(bad, 'ref')).toThrow();
    expect(getter).not.toHaveBeenCalled();
  });
  it('checks nested arrays, records, maps and sets for reactive escapes', () => {
    const service = new Data();
    for (const value of [
      [service.nested],
      { value: service.nested },
      new Map([['x', service.nested]]),
      new Set([service.nested]),
    ]) {
      expect(() => assertComponentBoundary(value, 'value')).toThrow(/Reactive objects/);
    }
  });
  it('preserves cyclic plain values, dates and element command props without cloning', () => {
    const value: { date: Date; self?: unknown } = { date: new Date(0) };
    value.self = value;
    expect(() => assertComponentBoundary(value, 'value')).not.toThrow();
    const command = vi.fn();
    expect(() =>
      assertComponentBoundary(createElement('button', { onClick: command }, 'Go'), 'value'),
    ).not.toThrow();
    expect(command).not.toHaveBeenCalled();
    expect(() => assertComponentBoundary({ render: command }, 'value')).toThrow(/render callbacks/);
  });
});
