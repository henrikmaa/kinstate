import { describe, expect, it, vi } from 'vitest';
import { Service, collectDependencies, observe, flushSync } from '../src/index.js';

class State extends Service {
  row = { value: 1, other: 10, child: { value: 2 } };
  other = 0;
}

describe('synchronous ordinary-data read consistency', () => {
  it('captures an ordinary property version once per collection despite repeated reads', () => {
    const state = new State();
    const row = state.row;
    const dependency = [...collectDependencies(() => row.value).dependencies.keys()][0]!;
    const version = vi.spyOn(dependency, 'getVersion');
    collectDependencies(() => {
      for (let index = 0; index < 100; index++) expect(row.value).toBe(1);
    });
    expect(version).toHaveBeenCalledTimes(1);
    collectDependencies(() => expect(row.value).toBe(1));
    expect(version).toHaveBeenCalledTimes(2);
  });

  it('validates each computed read after mutations while retaining its earliest captured version', () => {
    class Counter extends Service {
      count = 1;
      get doubled() {
        return this.count * 2;
      }
    }
    const state = new Counter();
    const captured = collectDependencies(() => {
      const values = [state.doubled, state.doubled];
      state.count = 2;
      values.push(state.doubled, state.doubled);
      state.count = 3;
      values.push(state.doubled);
      return values;
    });
    expect(captured.value).toEqual([2, 2, 4, 4, 6]);
    expect([...captured.dependencies].some(([dep, version]) => dep.getVersion() !== version)).toBe(
      true,
    );
    expect(state.doubled).toBe(6);
  });

  it('keeps the earliest dependency version when a field changes between repeated reads', () => {
    const state = new State();
    const captured = collectDependencies(() => {
      const values = [state.row.value, state.row.value];
      state.row.value = 2;
      values.push(state.row.value, state.row.value);
      return values;
    });
    expect(captured.value).toEqual([1, 1, 2, 2]);
    expect([...captured.dependencies].some(([dep, version]) => dep.getVersion() !== version)).toBe(
      true,
    );
  });

  it('captures each nested collector independently and restores outer tracking', () => {
    const state = new State();
    const outer = collectDependencies(() => {
      void state.row.value;
      void state.row.value;
      const nested = collectDependencies(() => [state.row.value, state.row.value]);
      expect(nested.value).toEqual([1, 1]);
      expect(nested.dependencies.size).toBe(2);
      void state.row.other;
      void state.row.value;
      return nested;
    });
    expect(outer.dependencies.size).toBe(3);
    state.row.value++;
    expect(
      [...outer.value.dependencies].some(([dep, version]) => dep.getVersion() !== version),
    ).toBe(true);
  });

  it('keeps untracked reads and independent observations current', () => {
    const state = new State();
    collectDependencies(() => [state.row.value, state.row.value]);
    const values: number[] = [];
    const stop = observe(() => values.push(state.row.value + state.row.value));
    state.row.value = 7;
    expect(state.row.value).toBe(7);
    flushSync();
    expect(values).toEqual([2, 14]);
    stop();
    flushSync();
  });

  it('keeps fields current through accessor, pinned-object, deletion and reinsertion changes', () => {
    const state = new State();
    const row = state.row;
    collectDependencies(() => {
      expect(row.value + row.value).toBe(2);
      Object.defineProperty(row, 'value', { configurable: true, get: () => row.other });
      expect(row.value).toBe(10);
      row.other = 11;
      expect(row.value).toBe(11);
      expect(row.child).toBe(row.child);
      const raw = { value: 20 };
      Object.defineProperty(row, 'child', { configurable: false, writable: false, value: raw });
      expect(row.child).toBe(raw);
      Reflect.deleteProperty(row, 'value');
      expect(row.value).toBeUndefined();
      Reflect.set(row, 'value', 30);
      expect(row.value + row.value).toBe(60);
    });
  });

  it('preserves dynamic getters and computed reads after unrelated writes', () => {
    let calls = 0;
    class Values extends State {
      get total() {
        calls++;
        return this.row.value + this.other;
      }
    }
    const state = new Values();
    const captured = collectDependencies(() => {
      expect(state.row.value + state.row.value).toBe(2);
      expect(state.total).toBe(1);
      state.other = 3;
      expect(state.row.value + state.row.value).toBe(2);
      expect(state.total).toBe(4);
    });
    expect(calls).toBe(2);
    expect(captured.dependencies.size).toBeGreaterThan(1);
  });
});
