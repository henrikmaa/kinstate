import { describe, expect, it, vi } from 'vitest';
import { Atom } from '../src/dependencies.js';
import { ComputedGraph } from '../src/computed-graph.js';
import { Service, observe, collectDependencies, flushSync } from '../src/index.js';

describe('persistent computed graph', () => {
  it('reuses connections for unchanged membership and attaches/detaches only branch differences', () => {
    const attach = vi.fn();
    const detach = vi.fn();
    const graph = new ComputedGraph(attach, detach);
    const first = new Atom();
    const second = new Atom();
    const third = new Atom();
    graph.begin();
    graph.read(first, 0);
    graph.read(second, 0);
    graph.finish();
    expect(attach).not.toHaveBeenCalled();
    graph.connect();
    expect(attach.mock.calls.map(([source]) => source)).toEqual([first, second]);
    graph.begin();
    graph.read(second, 0);
    graph.read(first, 0);
    graph.finish();
    expect(attach).toHaveBeenCalledTimes(2);
    expect(detach).not.toHaveBeenCalled();
    graph.begin();
    graph.read(first, 0);
    graph.read(third, 0);
    graph.finish();
    expect(attach).toHaveBeenCalledTimes(3);
    expect(detach.mock.calls.map(([source]) => source)).toEqual([second]);
    graph.disconnect();
    expect(detach.mock.calls.map(([source]) => source)).toEqual([second, first, third]);
    graph.connect();
    expect(attach).toHaveBeenCalledTimes(5);
    graph.disconnect();
  });

  it('retains the earliest version within a generation and replaces it in the next', () => {
    const graph = new ComputedGraph(
      () => {},
      () => {},
    );
    const source = new Atom();
    graph.begin();
    graph.read(source, 0);
    source.changed();
    graph.read(source, 1);
    graph.finish();
    expect(graph.isStale()).toBe(true);
    graph.begin();
    graph.read(source, 1);
    graph.finish();
    expect(graph.isStale()).toBe(false);
    graph.begin();
    graph.finish();
    source.changed();
    expect(graph.isStale()).toBe(false);
  });
});

describe('connected computed validation', () => {
  it('skips source-version walks for unrelated writes while connected and validates detached reads lazily', () => {
    class State extends Service {
      count = 1;
      unrelated = 0;
      get doubled() {
        return this.count * 2;
      }
    }
    const state = new State();
    const source = [...collectDependencies(() => state.count).dependencies.keys()][0]!;
    const seen: number[] = [];
    const stop = observe(() => seen.push(state.doubled));
    const version = vi.spyOn(source, 'getVersion');
    state.unrelated++;
    expect(state.doubled).toBe(2);
    expect(version).not.toHaveBeenCalled();
    state.count = 2;
    state.count = 3;
    flushSync();
    expect(seen).toEqual([2, 6]);
    stop();
    flushSync();
    state.count = 4;
    expect(state.doubled).toBe(8);
    expect(version).toHaveBeenCalled();
    const again: number[] = [];
    const stopAgain = observe(() => again.push(state.doubled));
    state.count = 5;
    flushSync();
    expect(again).toEqual([8, 10]);
    stopAgain();
    flushSync();
  });

  it('preserves equality through computed chains, branch changes and multiple writes between checks', () => {
    class State extends Service {
      count = 0;
      alternate = 10;
      active = true;
      get parity() {
        return this.count % 2;
      }
      get result() {
        return this.active ? this.parity + 1 : this.alternate;
      }
    }
    const state = new State();
    const seen: number[] = [];
    const stop = observe(() => seen.push(state.result));
    state.count = 2;
    state.count = 4;
    flushSync();
    expect(seen).toEqual([1]);
    state.count = 5;
    flushSync();
    expect(seen).toEqual([1, 2]);
    state.active = false;
    flushSync();
    state.count = 6;
    state.count = 7;
    flushSync();
    expect(seen).toEqual([1, 2, 10]);
    state.alternate = 11;
    flushSync();
    expect(seen).toEqual([1, 2, 10, 11]);
    stop();
    flushSync();
  });

  it('refreshes equality-compressed intermediate branches without waking the outer observer', () => {
    let evaluations = 0;
    class State extends Service {
      active = true;
      first = 2;
      second = 4;
      get parity() {
        return (this.active ? this.first : this.second) % 2;
      }
      get result() {
        evaluations++;
        return this.parity + 10;
      }
    }
    const state = new State();
    const values: number[] = [];
    const stop = observe(() => values.push(state.result));
    state.active = false;
    flushSync();
    expect(values).toEqual([10]);
    expect(evaluations).toBe(1);
    state.first = 3;
    flushSync();
    expect(values).toEqual([10]);
    state.second = 5;
    flushSync();
    expect(values).toEqual([10, 11]);
    expect(evaluations).toBe(2);
    stop();
    flushSync();
  });

  it('cleans obsolete dependencies after failure and recovers using the newly captured branch', () => {
    class State extends Service {
      fail = false;
      first = 1;
      second = 2;
      get result() {
        if (this.fail) {
          void this.second;
          throw new Error('failed');
        }
        return this.first;
      }
    }
    const state = new State();
    const first = [...collectDependencies(() => state.first).dependencies.keys()][0] as Atom;
    const second = [...collectDependencies(() => state.second).dependencies.keys()][0] as Atom;
    const seen: Array<number | string> = [];
    const stop = observe(() => {
      try {
        seen.push(state.result);
      } catch {
        seen.push('failed');
      }
    });
    state.fail = true;
    flushSync();
    expect(first.watchers.size).toBe(0);
    expect(second.watchers.size).toBe(1);
    state.first = 5;
    flushSync();
    expect(seen).toEqual([1, 'failed']);
    state.second = 4;
    flushSync();
    expect(seen).toEqual([1, 'failed', 'failed']);
    state.fail = false;
    flushSync();
    expect(seen).toEqual([1, 'failed', 'failed', 5]);
    stop();
    flushSync();
    expect(first.watchers.size).toBe(0);
    expect(second.watchers.size).toBe(0);
  });

  it('does not treat a getter that writes after a captured read as a clean connected graph', () => {
    class State extends Service {
      count = 0;
      normalize = false;
      get result() {
        const before = this.count;
        if (this.normalize && before < 2) this.count = 2;
        return before;
      }
    }
    const state = new State();
    const seen: number[] = [];
    const stop = observe(() => seen.push(state.result));
    state.normalize = true;
    flushSync();
    expect(state.result).toBe(2);
    expect(seen.at(-1)).toBe(2);
    stop();
    flushSync();
  });
});
