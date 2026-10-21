import { describe, expect, it } from 'vitest';
import {
  Service,
  collectDependencies,
  flushSync,
  observe,
  isReactive,
  ServiceScope,
  serviceInputs,
} from '../src/index.js';
import {
  createReadonlyArrayIteration,
  registerReadonlyView,
  unwrapReadonlyView,
  normalizeServiceArgument,
  isServiceMethod,
  untracked,
} from '../src/internal.js';

/** A minimal consumer stub: production React owns the full read-only membrane. */
function views() {
  const cache = new WeakMap<object, object>();
  const readonlyValue = (value: unknown): any => {
    if (value === null || typeof value !== 'object') return value;
    const cached = cache.get(value);
    if (cached) return cached;
    const proxy = new Proxy(value, {
      get(source, key) {
        const result = Reflect.get(source, key, source);
        return (
          createReadonlyArrayIteration(source, proxy, result, readonlyValue) ??
          readonlyValue(result)
        );
      },
      set() {
        throw new TypeError('Readonly');
      },
      deleteProperty() {
        throw new TypeError('Readonly');
      },
    });
    cache.set(value, proxy);
    registerReadonlyView(proxy, value);
    return proxy;
  };
  return readonlyValue;
}
class State extends Service {
  ignored = 0;
  rows = [{ value: 0 }, { value: 1 }];
  selected = this.rows[0]!;
  payload: { nested: { row: { value: number } }[] } | undefined = undefined;
  onSave: (() => void) | undefined = undefined;
  select(row: { value: number }) {
    this.selected = row;
    this.selected.value++;
  }
  update(payload: { nested: { row: { value: number } }[] }) {
    this.payload = payload;
    payload.nested[0]!.row.value++;
    this.payload.nested[0]!.row.value++;
  }
  async updateLater(payload: { row: { value: number } }) {
    await Promise.resolve();
    payload.row.value++;
  }
  echo<T>(value: T) {
    return value;
  }
}

describe('private read-only consumer provenance', () => {
  it('normalizes views on canonical reads, writes and command arguments without mutating caller containers', async () => {
    const state = new State();
    const readonly = views();
    const row = readonly(state.rows[1]);
    expect(unwrapReadonlyView(row)).toBe(state.rows[1]);
    expect(isReactive(row)).toBe(true);
    state.select(normalizeServiceArgument(row));
    expect(state.selected).toBe(state.rows[1]);
    expect(state.selected.value).toBe(2);
    const payload = { nested: [{ row }] };
    state.update(normalizeServiceArgument(payload));
    expect(state.rows[1]!.value).toBe(4);
    expect(payload.nested[0]!.row).toBe(row);
    expect(state.payload!.nested[0]!.row).toBe(state.rows[1]);
    await state.updateLater(normalizeServiceArgument({ row }));
    expect(state.rows[1]!.value).toBe(5);
    expect(() => {
      row.value++;
    }).toThrow('Readonly');
  });
  it('preserves ordinary argument identity and caches cyclic adapters', () => {
    const state = new State();
    const ordinary = { data: [1, 2] };
    expect(state.echo(ordinary)).toBe(ordinary);
    expect(normalizeServiceArgument(ordinary)).toBe(ordinary);
    const payload: { row: unknown; self?: unknown } = { row: views()(state.rows[0]) };
    payload.self = payload;
    const normalized = normalizeServiceArgument(payload);
    expect(normalized).not.toBe(payload);
    expect(normalizeServiceArgument(payload)).toBe(normalized);
    expect(normalizeServiceArgument(normalized)).toBe(normalized);
    expect(normalized.self).toBe(normalized);
    expect(normalized.row).toBe(state.rows[0]);
    expect(payload.row).not.toBe(state.rows[0]);
    const callback = () => state.selected;
    const callbackView = new Proxy(callback, {});
    registerReadonlyView(callbackView, callback);
    expect(normalizeServiceArgument({ callback: callbackView }).callback).toBe(callback);
  });
  it('does not retain negative container scans or rescan known adapters', () => {
    const state = new State();
    const payload: { row: unknown } = { row: undefined };
    expect(normalizeServiceArgument(payload)).toBe(payload);
    payload.row = views()(state.rows[0]);
    const normalized = normalizeServiceArgument(payload);
    expect(normalized).not.toBe(payload);
    expect(normalized.row).toBe(state.rows[0]);
    let enumerations = 0;
    const counted = new Proxy(
      { row: payload.row },
      {
        ownKeys(target) {
          enumerations++;
          return Reflect.ownKeys(target);
        },
      },
    );
    const adapter = normalizeServiceArgument(counted);
    expect(enumerations).toBe(1);
    expect(normalizeServiceArgument(counted)).toBe(adapter);
    expect(enumerations).toBe(1);
  });
  it('identifies only bound service commands as mutable authorities', () => {
    const callback = () => {};
    const scope = new ServiceScope([State], {
      inputs: [serviceInputs(State, { onSave: callback })],
    });
    const state = scope.get(State);
    expect(isServiceMethod(state.select)).toBe(true);
    expect(isServiceMethod(state.echo)).toBe(true);
    expect(isServiceMethod(state.onSave)).toBe(false);
    expect(state.onSave).toBe(callback);
    expect(isServiceMethod(state.rows.map)).toBe(false);
    expect(isServiceMethod(callback)).toBe(false);
    scope.dispose();
  });
  it('suspends collection for reflection and restores it after exceptions and nested collectors', () => {
    const state = new State();
    let runs = 0;
    const stop = observe(() => {
      try {
        untracked(() => {
          void state.ignored;
          throw new Error('probe');
        });
      } catch {}
      void state.rows;
      runs++;
    });
    state.ignored++;
    flushSync();
    expect(runs).toBe(1);
    state.rows = [];
    flushSync();
    expect(runs).toBe(2);
    stop();
    const outer = collectDependencies(() =>
      untracked(() => collectDependencies(() => state.ignored)),
    );
    expect(outer.dependencies.size).toBe(0);
    expect(outer.value.dependencies.size).toBe(1);
  });
  it('rejects rebinding a view and fixed argument properties that cannot change observed identity', () => {
    const state = new State(),
      view = views()(state.rows[0]);
    expect(() => registerReadonlyView(view, state.rows[1]!)).toThrow(/source cannot change/);
    const payload = Object.freeze({ row: view });
    const normalized = normalizeServiceArgument(payload);
    expect(() => normalized.row).toThrow(/fixed argument properties/);
  });
});

describe('read-only optimized array iteration', () => {
  it.each(['map', 'filter'] as const)(
    'retains sequence subscriptions and safe %s callback values/results',
    (method) => {
      const state = new State();
      const readonly = views();
      const rows = readonly(state.rows);
      const iterate = rows[method];
      expect(rows[method]).toBe(iterate);
      const captured = collectDependencies(() =>
        rows[method]((row: unknown, index: number, array: unknown) => {
          expect(array).toBe(rows);
          expect(row).toBe(rows[index]);
          return method === 'filter' ? true : row;
        }),
      );
      // Callback assertions read indices, so inspect a second traversal without those reads.
      const narrow = collectDependencies(() =>
        rows[method]((row: unknown) => (method === 'filter' ? true : row)),
      );
      expect(narrow.dependencies.size).toBeGreaterThan(0);
      expect(narrow.dependencies.size).toBeLessThan(8);
      expect(() => {
        captured.value[0].value++;
      }).toThrow('Readonly');
      let runs = 0;
      const stop = observe(() => {
        rows[method](() => true);
        runs++;
      });
      state.rows.push({ value: 2 });
      flushSync();
      expect(runs).toBe(2);
      stop();
    },
  );
  it('keeps native callbacks, holes and borrowed call receivers intact', () => {
    const raw = [1, , 3];
    const scope = new State();
    const rows = views()(scope.rows);
    expect(rows.map.call(raw, (value: number) => value * 2)).toEqual([2, , 6]);
    expect(() =>
      rows.map((row: { value: number }) => {
        row.value++;
      }),
    ).toThrow('Readonly');
    expect(
      createReadonlyArrayIteration([], [], Array.prototype.map, (value) => value),
    ).toBeUndefined();
  });
});
