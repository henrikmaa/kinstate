import { describe, expect, it } from 'vitest';
import { Service, collectDependencies, flushSync, observe, isReactive } from '../src/index.js';

class State extends Service {
  data: any = {};
  rows: any[] = [];
}

describe('service-owned publication graphs', () => {
  it('isolates raw aliases while preserving payload aliases, cycles and canonical reassignments', () => {
    const child = { value: 1 };
    const raw: any = { first: child, second: child };
    raw.self = raw;
    const state = new State();
    state.data = raw;
    const canonical = state.data;
    expect(canonical.first).toBe(canonical.second);
    expect(canonical.self).toBe(canonical);
    expect(canonical).not.toBe(raw);
    child.value = 9;
    raw.extra = true;
    expect(canonical.first.value).toBe(1);
    expect(canonical.extra).toBeUndefined();
    state.data = canonical;
    expect(state.data).toBe(canonical);
    state.rows = [canonical.first, canonical];
    expect(state.rows[0]).toBe(canonical.first);
    expect(state.rows[1]).toBe(canonical);
    state.data = raw;
    expect(state.data).not.toBe(canonical);
    expect(state.data.first.value).toBe(9);
  });

  it('copies retained raw values even after a computed getter registered a borrowed proxy', () => {
    const input = [{ value: 1 }];
    class Borrowed extends State {
      get external() {
        return input;
      }
    }
    const state = new Borrowed();
    expect(isReactive(state.external)).toBe(true);
    state.rows = input;
    input[0]!.value = 8;
    input.push({ value: 9 });
    expect(state.rows).toHaveLength(1);
    expect(state.rows[0].value).toBe(1);
  });

  it('never exposes owned mutable backing through descriptor reflection or pinned slots', () => {
    const state = new State();
    state.data = { nested: { value: 1 } };
    const descriptor = Object.getOwnPropertyDescriptor(state.data, 'nested')!;
    expect(descriptor.value).toBe(state.data.nested);
    const values: number[] = [];
    const stop = observe(() => values.push(state.data.nested.value));
    descriptor.value.value = 2;
    flushSync();
    expect(values).toEqual([1, 2]);
    Object.defineProperty(state.data, 'nested', { writable: false, configurable: false });
    expect(state.data.nested).toBe(descriptor.value);
    const raw = { value: 3 };
    expect(() => Object.defineProperty(state.data, 'fresh', { value: raw })).toThrow(/Fresh raw/);
    expect(Object.hasOwn(state.data, 'fresh')).toBe(false);
    expect(raw).toEqual({ value: 3 });
    stop();
  });

  it('preserves symbols, nonenumerables, null prototypes and accessors without evaluating them', () => {
    const symbol = Symbol('key');
    let calls = 0;
    const raw = Object.create(null);
    Object.defineProperty(raw, 'hidden', { value: { value: 1 }, enumerable: false });
    Object.defineProperty(raw, 'derived', {
      configurable: true,
      get() {
        calls++;
        return this[symbol].value;
      },
    });
    raw[symbol] = { value: 4 };
    const state = new State();
    state.data = raw;
    expect(calls).toBe(0);
    expect(Object.getPrototypeOf(state.data)).toBeNull();
    expect(Object.getOwnPropertyDescriptor(state.data, 'hidden')!.enumerable).toBe(false);
    expect(state.data.hidden).not.toBe(raw.hidden);
    expect(state.data.derived).toBe(4);
    expect(calls).toBe(1);
    state.data[symbol].value = 5;
    expect(state.data.derived).toBe(5);
  });

  it('copies sparse custom-prototype arrays and preserves frozen snapshot descriptors', () => {
    const prototype = Object.create(Array.prototype);
    prototype.label = 'custom';
    const raw = [1, , { value: 3 }];
    Object.setPrototypeOf(raw, prototype);
    const state = new State();
    state.rows = raw;
    expect(Object.getPrototypeOf(state.rows)).toBe(prototype);
    expect(Object.hasOwn(state.rows, '1')).toBe(false);
    expect(state.rows[2]).not.toBe(raw[2]);
    const frozen = Object.freeze({ child: Object.freeze({ value: 7 }) });
    state.data = frozen;
    expect(state.data).not.toBe(frozen);
    expect(Object.isFrozen(state.data)).toBe(true);
    expect(Object.isFrozen(state.data.child)).toBe(true);
    expect(isReactive(state.data)).toBe(false);
    expect(isReactive(state.data.child)).toBe(false);
    expect(() => {
      state.data.child.value = 9;
    }).toThrow(TypeError);
  });

  it('keeps opaque instances and callbacks intact and copies deep graphs iteratively', () => {
    class Opaque {
      #value = 2;
      read() {
        return this.#value;
      }
    }
    class Rows extends Array<number> {
      #secret = 7;
      secret() {
        return this.#secret;
      }
    }
    stateSubclassCheck(new Rows(1, 2));
    stateSubclassCheck(Object.freeze(new Rows(1, 2)));
    function stateSubclassCheck(value: Readonly<Rows>) {
      const holder = new State();
      holder.data = { rows: value };
      expect(holder.data.rows).toBe(value);
      expect(holder.data.rows.secret()).toBe(7);
    }
    const instance = new Opaque();
    const callback = () => 1;
    const state = new State();
    state.data = { instance, callback };
    expect(state.data.instance).toBe(instance);
    expect(state.data.instance.read()).toBe(2);
    expect(state.data.callback).toBe(callback);
    const root: any = {};
    let source = root;
    for (let i = 0; i < 12000; i++) source = source.child = {};
    expect(() => {
      state.data = root;
    }).not.toThrow();
    let copy = state.data;
    for (let i = 0; i < 12000; i++) copy = copy.child;
    expect(copy).not.toBe(source);
  });

  it('does not change observed versions when raw source arrays are mutated after publication', () => {
    const raw = [1, 2, 3];
    const state = new State();
    state.rows = raw;
    const capture = collectDependencies(() => state.rows[0]);
    state.rows.reverse();
    state.rows.reverse();
    const current = collectDependencies(() => state.rows[0]);
    raw.reverse();
    Object.defineProperty(raw, '0', { get: () => 99 });
    Object.freeze(raw);
    expect(state.rows[0]).toBe(1);
    expect(
      [...current.dependencies].every(([node, version]) => node.getVersion() === version),
    ).toBe(true);
    state.rows.reverse();
    expect([...state.rows]).toEqual([3, 2, 1]);
    expect([...capture.dependencies].some(([node, version]) => node.getVersion() !== version)).toBe(
      true,
    );
  });
});
