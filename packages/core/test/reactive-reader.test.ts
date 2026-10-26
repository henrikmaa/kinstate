import { describe, expect, it } from 'vitest';
import { Service, observe, flushSync, collectDependencies } from '../src/index.js';
import { createReactiveReader } from '../src/internal.js';
import { readonlyServiceValue } from '../../react/src/service-view.js';

class State extends Service {
  count = 1;
  child = { value: 2 };
  rows = [1, 2];
  get doubled() {
    return this.count * 2;
  }
  increment() {
    this.count++;
  }
}

describe('canonical membrane reader', () => {
  it('retains canonical receivers, stable commands and tracked getter/field reads', () => {
    const state = new State();
    const read = createReactiveReader(state)!;
    expect(read).toBeTypeOf('function');
    expect(read('increment')).toBe(state.increment);
    expect(read('child')).toBe(state.child);
    const captured = collectDependencies(() => read('doubled'));
    expect(captured.value).toBe(2);
    state.count = 3;
    expect(read('doubled')).toBe(6);
    expect(
      [...captured.dependencies].some(([node, version]) => node.getVersion() !== version),
    ).toBe(true);
    Object.defineProperty(state, 'doubled', {
      configurable: true,
      get() {
        return this.count * 3;
      },
    });
    expect(read('doubled')).toBe(9);
    Object.freeze(state);
    expect(read('count')).toBe(3);
    expect(read('child')).toBe(state.child);
  });

  it('does not bypass borrowed or foreign proxy behavior and frozen opacity', () => {
    const raw = { value: { count: 1 } };
    class Borrowed extends Service {
      get external() {
        return raw;
      }
    }
    const state = new Borrowed();
    const borrowed = state.external;
    expect(createReactiveReader(borrowed)).toBeUndefined();
    expect(createReactiveReader(new Proxy(state, {}))).toBeUndefined();
    expect(createReactiveReader(raw)).toBeUndefined();
    expect(createReactiveReader(Object.freeze({ value: 1 }))).toBeUndefined();
    expect(borrowed.value.count).toBe(1);
    Object.defineProperty(raw, 'value', { configurable: false, writable: false });
    // Cached borrowed classifications still go through the VM's invariant enforcement.
    expect(() => Reflect.get(borrowed, 'value')).toThrow(TypeError);
    expect(() => readonlyServiceValue(borrowed).value).toThrow(TypeError);
  });

  it('evicts owned cached data classifications on accessor conversion and preserves foreign receivers', () => {
    const state = new State();
    const child = state.child;
    expect(child.value).toBe(2);
    expect(Reflect.get(child, 'value', { value: 9 })).toBe(2);
    let receiver: unknown;
    Object.defineProperty(child, 'value', {
      configurable: true,
      get() {
        receiver = this;
        return Reflect.get(this, 'other');
      },
    });
    Object.defineProperty(child, 'other', { value: 4, configurable: true });
    expect(child.value).toBe(4);
    expect(receiver).toBe(child);
    const foreign = { other: 8 };
    expect(Reflect.get(child, 'value', foreign)).toBe(8);
    expect(receiver).toBe(foreign);
    Object.defineProperty(child, 'value', { configurable: true, writable: true, value: 6 });
    expect(child.value).toBe(6);
    expect(child.value).toBe(6);
    const rows = state.rows;
    expect(rows.map((value) => value)).toEqual([1, 2]);
    Object.defineProperty(rows, '0', {
      configurable: true,
      get() {
        receiver = this;
        return 7;
      },
    });
    expect(rows.map((value) => value)).toEqual([7, 2]);
    expect(receiver).toBe(rows);
  });

  it('retains raw foreign proxy get traps for cached borrowed properties and array indices', () => {
    const receivers: unknown[] = [];
    const foreignRow = new Proxy(
      { value: 3 },
      {
        get(target, key, receiver) {
          if (key === 'value') receivers.push(receiver);
          return Reflect.get(target, key, receiver);
        },
      },
    );
    const foreignArray = new Proxy([3], {
      get(target, key, receiver) {
        if (key === '0') receivers.push(receiver);
        return Reflect.get(target, key, receiver);
      },
    });
    class Borrowed extends Service {
      get row() {
        return foreignRow;
      }
      get rows() {
        return foreignArray;
      }
    }
    const state = new Borrowed();
    const row = state.row;
    const rows = state.rows;
    expect(row.value).toBe(3);
    receivers.length = 0;
    expect(row.value).toBe(3);
    expect(receivers).toEqual([row]);
    rows.map((value) => value);
    receivers.length = 0;
    expect(rows.map((value) => value)).toEqual([3]);
    expect(receivers).toEqual([rows]);
    const foreign = { value: 8 };
    receivers.length = 0;
    expect(Reflect.get(row, 'value', foreign)).toBe(3);
    expect(receivers).toEqual([foreign]);
  });

  it('keeps readonly consumer tracking, descriptor semantics and mutation rejection', () => {
    const state = new State();
    const view = readonlyServiceValue(state);
    const values: number[] = [];
    const stop = observe(() => values.push(view.child.value + view.doubled));
    state.child.value = 5;
    state.increment();
    flushSync();
    expect(values).toEqual([4, 9]);
    expect(view.child).toBe(view.child);
    expect(() => Reflect.set(view.child, 'value', 8)).toThrow(/read-only/);
    expect(() => Object.defineProperty(view, 'count', { value: 7 })).toThrow(/read-only/);
    Object.defineProperty(state, 'child', { writable: false, configurable: false });
    expect(Object.getOwnPropertyDescriptor(view, 'child')!.value).toBe(view.child);
    expect(view.child.value).toBe(5);
    Object.freeze(state.rows);
    expect(view.rows.map((value) => value * 2)).toEqual([2, 4]);
    stop();
  });
});
