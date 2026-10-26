import { describe, expect, it } from 'vitest';
import { Service, collectDependencies, type Dependency } from '@kinstate/core';
import { RenderFrame } from '../src/render-frame.js';
import { MemoCache } from '../src/memo-cache.js';

class State extends Service {
  first = 0;
  second = 0;
  third = 0;
}
function dependency() {
  let version = 0,
    connects = 0,
    disconnects = 0;
  const listeners = new Set<() => void>();
  const source: Dependency = {
    getVersion: () => version,
    subscribe: (listener) => {
      connects++;
      listeners.add(listener);
      return () => {
        disconnects++;
        listeners.delete(listener);
      };
    },
  };
  return {
    source,
    get connects() {
      return connects;
    },
    get disconnects() {
      return disconnects;
    },
    change() {
      version++;
      for (const listener of listeners) listener();
    },
  };
}

describe('memo collection ownership', () => {
  it('collects nested compiled reads in the memo map and adopts them into the attempt', () => {
    const state = new State(),
      frame = new RenderFrame(),
      observed = new Map<Dependency, number>();
    const value = frame.captureMemo(
      () => frame.track(() => frame.track(() => state.first) + frame.track(() => state.second)),
      observed,
    );
    expect(value).toBe(0);
    expect(observed.size).toBe(2);
    frame.adopt(observed);
    frame.finish(value);
    const initial = frame.getSnapshot();
    state.first++;
    expect(frame.getSnapshot()).not.toBe(initial);
  });
  it('restores the frame destination after a caught failure and retains failed reads', () => {
    const state = new State(),
      frame = new RenderFrame(),
      observed = new Map<Dependency, number>();
    expect(() =>
      frame.captureMemo(() => {
        frame.track(() => state.first);
        throw new Error('failed');
      }, observed),
    ).toThrow('failed');
    frame.track(() => state.second);
    expect(observed.size).toBe(1);
    frame.adopt(observed);
    frame.finish(null);
    const initial = frame.getSnapshot();
    state.second++;
    expect(frame.getSnapshot()).not.toBe(initial);
    const after = frame.getSnapshot();
    state.first++;
    expect(frame.getSnapshot()).not.toBe(after);
  });
  it('restores nested memo destinations and preserves a distinct outer observation', () => {
    const state = new State(),
      frame = new RenderFrame(),
      outer = new Map<Dependency, number>(),
      inner = new Map<Dependency, number>();
    const collection = collectDependencies(() =>
      frame.captureMemo(() => {
        frame.track(() => state.first);
        frame.captureMemo(() => frame.track(() => state.second), inner);
        frame.track(() => state.third);
      }, outer),
    );
    expect(inner.size).toBe(1);
    expect(outer.size).toBe(3);
    expect(collection.dependencies.size).toBe(3);
  });
  it('memo adoption never overwrites a frame’s earlier observed version', () => {
    const state = new State(),
      frame = new RenderFrame(),
      observed = new Map<Dependency, number>();
    frame.track(() => state.first);
    state.first++;
    frame.captureMemo(() => frame.track(() => state.first), observed);
    frame.adopt(observed);
    frame.finish(null);
    expect(frame.getSnapshot()).not.toBe(frame.getServerSnapshot());
  });
});

describe('memo subscription reuse', () => {
  it('retains source edges across recalculation and disconnects only a removed branch', () => {
    const a = dependency(),
      b = dependency(),
      c = dependency(),
      cache = new MemoCache();
    cache.publish(
      new Map([
        [a.source, 0],
        [b.source, 0],
      ]),
    );
    const stop = cache.subscribe(() => undefined);
    cache.publish(
      new Map([
        [a.source, 0],
        [b.source, 0],
      ]),
    );
    expect([a.connects, b.connects, a.disconnects, b.disconnects]).toEqual([1, 1, 0, 0]);
    cache.publish(
      new Map([
        [b.source, 0],
        [c.source, 0],
      ]),
    );
    expect([a.disconnects, b.disconnects, b.connects, c.connects]).toEqual([1, 0, 1, 1]);
    stop();
    expect([b.disconnects, c.disconnects]).toEqual([1, 1]);
  });
  it('keeps previous ownership and removes partial additions when a publication fails', () => {
    const a = dependency(),
      b = dependency(),
      cache = new MemoCache();
    cache.publish(new Map([[a.source, 0]]));
    let updates = 0;
    const stop = cache.subscribe(() => updates++);
    const failed: Dependency = {
      getVersion: () => 0,
      subscribe: () => {
        throw new Error('subscription failed');
      },
    };
    expect(() =>
      cache.publish(
        new Map([
          [b.source, 0],
          [failed, 0],
        ]),
      ),
    ).toThrow('subscription failed');
    expect([a.connects, a.disconnects, b.connects, b.disconnects]).toEqual([1, 0, 1, 1]);
    a.change();
    expect(updates).toBe(1);
    stop();
    expect(a.disconnects).toBe(1);
  });
  it('checks newly rendered versions even when their subscriptions are retained', () => {
    const a = dependency(),
      cache = new MemoCache();
    cache.publish(new Map([[a.source, 0]]));
    const stop = cache.subscribe(() => undefined);
    a.change();
    const changed = cache.getSnapshot();
    cache.publish(new Map([[a.source, 0]]));
    expect(cache.getSnapshot()).not.toBe(changed);
    expect(a.connects).toBe(1);
    stop();
  });
});
