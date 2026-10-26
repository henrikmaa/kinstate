import { expect, it, vi } from 'vitest';
import { createArrayReverse } from '../src/array-reverse.js';

it('reuses shape proofs only when an owned array reports an unchanged shape', () => {
  const target = [1, 2, 3];
  const receiver = new Proxy(target, {});
  let version = 0;
  const representation = vi.fn(() => true);
  const method = createArrayReverse(
    target,
    receiver,
    Array.prototype.reverse,
    () => false,
    representation,
    (reverse) => reverse(),
    () => version,
  )!;
  expect(method.call(receiver)).toBe(receiver);
  expect(target).toEqual([3, 2, 1]);
  const inspected = representation.mock.calls.length;
  method.call(receiver);
  expect(target).toEqual([1, 2, 3]);
  expect(representation).toHaveBeenCalledTimes(inspected);
  Object.defineProperty(target, '0', { value: 4 });
  version++;
  method.call(receiver);
  expect(target).toEqual([3, 2, 4]);
  expect(representation.mock.calls.length).toBeGreaterThan(inspected);
});

it('rechecks failed proofs and falls back after pinning or preventing extensions', () => {
  const target = [1, 2, 3];
  const receiver = new Proxy(target, {});
  let version = 0;
  const mutate = vi.fn((reverse: () => void) => reverse());
  const method = createArrayReverse(
    target,
    receiver,
    Array.prototype.reverse,
    () => false,
    () => true,
    mutate,
    () => version,
  )!;
  method.call(receiver);
  Object.defineProperty(target, '0', { writable: false });
  version++;
  expect(() => method.call(receiver)).toThrow(TypeError);
  expect(mutate).toHaveBeenCalledTimes(1);
  Object.defineProperty(target, '0', { writable: true });
  version++;
  method.call(receiver);
  expect(mutate).toHaveBeenCalledTimes(2);
  Object.preventExtensions(target);
  method.call(receiver);
  expect(mutate).toHaveBeenCalledTimes(2);
});
