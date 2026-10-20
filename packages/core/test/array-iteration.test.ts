import { describe, expect, it, vi } from 'vitest';
import { Service, collectDependencies, observe, flushSync } from '../src/index.js';
import { Atom } from '../src/dependencies.js';

class Rows extends Service {
  rows = [
    { value: 1, active: true },
    { value: 2, active: false },
  ];
  get selected() {
    return this.rows
      .filter((row) => row.active)
      .map((row) => row.value)
      .join(',');
  }
}

describe('native array iteration graph', () => {
  it('coalesces sequence reads while retaining field-level callback dependencies', () => {
    const service = new Rows();
    service.rows = Array.from({ length: 1000 }, (_, value) => ({ value, active: true }));
    const capture = collectDependencies(() => service.rows.filter(() => true));
    // Root, method, sequence, length, and species constructor; never two atoms per index.
    expect(capture.dependencies.size).toBeLessThan(10);
    const seen: string[] = [];
    const stop = observe(() => seen.push(service.selected));
    service.rows[999]!.active = false;
    flushSync();
    expect(seen).toHaveLength(2);
    const rowSeen = vi.fn(() => service.rows[0]!.value);
    const stopRow = observe(rowSeen);
    service.rows[999] = { value: 9000, active: true };
    flushSync();
    expect(seen).toHaveLength(3);
    expect(rowSeen).toHaveBeenCalledTimes(1);
    stop();
    stopRow();
    flushSync();
  });

  it('tracks holes, deletions, appends, reassignment, and length truncation', () => {
    const service = new Rows();
    const values: string[] = [];
    const stop = observe(() => values.push(service.selected));
    delete service.rows[0];
    flushSync();
    service.rows[0] = { value: 3, active: true };
    flushSync();
    service.rows.push({ value: 4, active: true });
    flushSync();
    service.rows.length = 1;
    flushSync();
    expect(values).toEqual(['1', '', '3', '3,4', '3']);
    stop();
    flushSync();
  });

  it('preserves callback this, canonical array argument, sparse shape, and iteration mutation order', () => {
    const service = new Rows();
    const receiver = { offset: 10 };
    const visited: number[] = [];
    const mapped = service.rows.map(function (this: typeof receiver, row, index, array) {
      expect(this).toBe(receiver);
      expect(array).toBe(service.rows);
      expect(row).toBe(service.rows[index]);
      visited.push(index);
      if (index === 0) {
        delete array[1];
        array.push({ value: 3, active: true });
      }
      return row.value + this.offset;
    }, receiver);
    expect(visited).toEqual([0]);
    expect(mapped.length).toBe(2);
    expect(1 in mapped).toBe(false);
    expect(mapped[0]).toBe(11);
    expect(service.rows.filter).toBe(service.rows.filter);
    Object.defineProperty(service.rows, 'filter', {
      configurable: true,
      writable: true,
      value: Array.prototype.filter,
    });
    expect(service.rows.filter).toBe(service.rows.filter);
    expect(() => service.rows.filter(undefined as never)).toThrow(TypeError);
    const method = service.rows.filter;
    expect(Reflect.apply(method, [1, 2, 3], [(value: number) => value > 1])).toEqual([2, 3]);
    expect(() => method(() => true)).toThrow(TypeError);
    const arrayLike = { 0: 9, length: 1 };
    const borrowed = Reflect.get(service.rows, 'filter', arrayLike);
    expect(Reflect.apply(borrowed, arrayLike, [(value: number) => value > 1])).toEqual([9]);
  });

  it('preserves accessor receivers introduced before and during iteration', () => {
    const service = new Rows();
    const receivers: unknown[] = [];
    Object.defineProperty(service.rows, '0', {
      configurable: true,
      get() {
        receivers.push(this);
        return { value: 4, active: true };
      },
    });
    const result = service.rows.map((row, index, array) => {
      if (index === 0)
        Object.defineProperty(array, '1', {
          configurable: true,
          get() {
            receivers.push(this);
            return { value: 5, active: true };
          },
        });
      return row.value;
    });
    expect(result).toEqual([4, 5]);
    expect(receivers).toEqual([service.rows, service.rows]);
  });

  it('preserves custom species and invalidates when constructor changes', () => {
    class Result extends Array {}
    const service = new Rows();
    const constructors: Function[] = [];
    const stop = observe(() => constructors.push(service.rows.filter(() => true).constructor));
    Object.defineProperty(service.rows, 'constructor', {
      configurable: true,
      writable: true,
      value: { [Symbol.species]: Result },
    });
    flushSync();
    expect(constructors).toEqual([Array, Result]);
    stop();
    flushSync();
  });

  it('does not interpret non-index array properties as sequence changes', () => {
    const service = new Rows();
    const effect = vi.fn(() => service.rows.filter(() => true).length);
    const stop = observe(effect);
    Object.assign(service.rows, { '-1': 7, '01': 8, '4294967295': 9 });
    flushSync();
    expect(effect).toHaveBeenCalledTimes(1);
    stop();
    flushSync();
  });
});

describe('computed edge replacement', () => {
  it('retains unchanged source edges across synchronous subscription replacement and releases at checkpoint', () => {
    const service = new Rows();
    const node = [...collectDependencies(() => service.rows[0]!.active).dependencies.keys()].at(
      -1,
    ) as Atom;
    const add = vi.spyOn(node.watchers, 'add');
    const remove = vi.spyOn(node.watchers, 'delete');
    const stop = observe(() => {
      void service.selected;
    });
    expect(add).toHaveBeenCalledTimes(1);
    for (let index = 0; index < 5; index++) {
      service.rows[0]!.value++;
      flushSync();
    }
    expect(add).toHaveBeenCalledTimes(1);
    expect(remove).not.toHaveBeenCalled();
    stop();
    flushSync();
    expect(remove).toHaveBeenCalledTimes(1);
    expect(node.watchers.size).toBe(0);
  });

  it('invalidates cached data classifications when descriptors change or become pinned', () => {
    const service = new Rows();
    const row = service.rows[0]!;
    expect(row.value).toBe(1);
    Object.defineProperty(row, 'value', { configurable: true, get: () => 8 });
    expect(row.value).toBe(8);
    Object.defineProperty(row, 'value', { configurable: true, writable: true, value: 9 });
    expect(row.value).toBe(9);
    Object.freeze(row);
    expect(row.value).toBe(9);
    expect(Reflect.set(row, 'value', 10)).toBe(false);
  });
});

describe('partially failed array length writes', () => {
  class Numbers extends Service {
    rows = [1, 2, 3];
  }
  for (const operation of ['reflect-set', 'define-property'] as const) {
    it(`publishes actual partial mutations when ${operation} cannot remove a pinned index`, () => {
      const service = new Numbers();
      Object.defineProperty(service.rows, '1', { configurable: false });
      const lengths: number[] = [];
      const sequences: string[] = [];
      const high: Array<[number | undefined, boolean]> = [];
      const low = vi.fn(() => [service.rows[0], 0 in service.rows]);
      const pinned = vi.fn(() => [service.rows[1], 1 in service.rows]);
      const stops = [
        observe(() => lengths.push(service.rows.length)),
        observe(() => sequences.push(service.rows.map((value) => value).join(','))),
        observe(() => high.push([service.rows[2], 2 in service.rows])),
        observe(low),
        observe(pinned),
      ];
      if (operation === 'reflect-set') {
        expect(Reflect.set(service.rows, 'length', 0)).toBe(false);
      } else {
        expect(() => Object.defineProperty(service.rows, 'length', { value: 0 })).toThrow(
          TypeError,
        );
      }
      expect(service.rows.length).toBe(2);
      expect(2 in service.rows).toBe(false);
      flushSync();
      expect(lengths).toEqual([3, 2]);
      expect(sequences).toEqual(['1,2,3', '1,2']);
      expect(high).toEqual([
        [3, true],
        [undefined, false],
      ]);
      expect(low).toHaveBeenCalledTimes(1);
      expect(pinned).toHaveBeenCalledTimes(1);
      stops.forEach((stop) => stop());
      flushSync();
    });
  }

  it('tracks actual removals after native coercion of length values', () => {
    const service = new Numbers();
    const seen: Array<[number, number | undefined, boolean]> = [];
    const stop = observe(() =>
      seen.push([service.rows.length, service.rows[2], 2 in service.rows]),
    );
    expect(Reflect.defineProperty(service.rows, 'length', { value: '1' })).toBe(true);
    flushSync();
    expect(seen).toEqual([
      [3, 3, true],
      [1, undefined, false],
    ]);
    stop();
    flushSync();
  });
});
