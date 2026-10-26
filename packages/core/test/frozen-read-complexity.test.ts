import { expect, it, vi } from 'vitest';
import { Service, observe, flushSync, isReactive } from '../src/index.js';

it('reads frozen payload snapshots without rescanning their frozen descriptors', () => {
  class Data extends Service {
    rows: readonly Readonly<{ value: number }>[] = [];
  }
  const source = Object.freeze(
    Array.from({ length: 1000 }, (_, value) => Object.freeze({ value })),
  );
  const service = new Data();
  service.rows = source;
  const snapshot = service.rows;
  expect(snapshot).not.toBe(source);
  const frozenChecks = vi.spyOn(Object, 'isFrozen');
  try {
    for (let index = 0; index < 100; index++) expect(service.rows[index]!.value).toBe(index);
    expect(frozenChecks.mock.calls.filter(([value]) => value === snapshot)).toHaveLength(0);
  } finally {
    frozenChecks.mockRestore();
  }
});

it('keeps copied sealed mutable objects reactive after restoring extensibility restrictions', () => {
  class Data extends Service {
    value = { count: 0 };
  }
  const source = Object.seal({ count: 1 });
  const service = new Data();
  service.value = source;
  expect(isReactive(service.value)).toBe(true);
  expect(Object.isSealed(service.value)).toBe(true);
  const seen: number[] = [];
  const stop = observe(() => {
    seen.push(service.value.count);
  });
  service.value.count++;
  flushSync();
  expect(seen).toEqual([1, 2]);
  expect(source.count).toBe(1);
  expect(Reflect.defineProperty(service.value, 'extra', { value: 3 })).toBe(false);
  stop();
});
