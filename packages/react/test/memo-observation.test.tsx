import React, { StrictMode, Suspense, startTransition, useLayoutEffect, useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Service, batch, collectDependencies, flushSync, type Dependency } from '@kinstate/core';
import { RenderFrame } from '../src/render-frame.js';
import { useRenderFrame } from '../src/use-render-frame.js';
import { useServiceMemo } from '../src/use-service-memo.js';
import { MemoCache } from '../src/memo-cache.js';
import { MemoObservation } from '../src/memo-observation.js';

afterEach(cleanup);
function source() {
  let version = 0,
    connects = 0,
    disconnects = 0,
    reads = 0,
    fail = false;
  const listeners = new Set<() => void>();
  const dependency: Dependency = {
    getVersion: () => {
      reads++;
      if (fail) throw new Error('version failed');
      return version;
    },
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
    dependency,
    get connects() {
      return connects;
    },
    get disconnects() {
      return disconnects;
    },
    get reads() {
      return reads;
    },
    change() {
      version++;
      for (const listener of listeners) listener();
    },
    setFailure(value: boolean) {
      fail = value;
    },
  };
}

class State extends Service {
  first = 0;
  second = 10;
}
function countSubscriptions(dependencies: ReadonlyMap<Dependency, number>) {
  let active = 0,
    maximum = 0,
    connects = 0,
    disconnects = 0;
  for (const dependency of dependencies.keys()) {
    const original = dependency.subscribe;
    dependency.subscribe = function (listener) {
      active++;
      connects++;
      maximum = Math.max(maximum, active);
      const stop = original.call(this, listener);
      return () => {
        active--;
        disconnects++;
        stop();
      };
    };
  }
  return {
    get active() {
      return active;
    },
    get maximum() {
      return maximum;
    },
    get connects() {
      return connects;
    },
    get disconnects() {
      return disconnects;
    },
  };
}

describe('result-owned memo observations', () => {
  it('owns its captured versions independently before publication and after branch replacement', () => {
    const a = source(),
      b = source(),
      cache = new MemoCache();
    const first = new MemoObservation(new Map([[a.dependency, 0]]), cache);
    cache.publish(first.dependencies);
    const stop = cache.subscribe(() => undefined);
    const pending = new MemoObservation(new Map([[b.dependency, 0]]), cache);
    b.change();
    expect(pending.getVersion()).toBe(1);
    expect(cache.getSnapshot()).toBe(cache.getServerSnapshot());
    expect(b.connects).toBe(0);
    cache.publish(pending.dependencies);
    a.change();
    expect(first.getVersion()).toBe(1);
    expect(b.connects).toBe(1);
    expect(a.disconnects).toBe(1);
    stop();
  });
  it('adopts version zero even when source changed before frame subscription', () => {
    const a = source(),
      cache = new MemoCache(),
      observation = new MemoObservation(new Map([[a.dependency, 0]]), cache),
      frame = new RenderFrame();
    a.change();
    frame.adopt(observation.frameDependencies);
    frame.finish(null);
    expect(frame.getSnapshot()).not.toBe(frame.getServerSnapshot());
    const stop = frame.subscribe(() => undefined);
    expect(a.connects).toBe(0);
    cache.publish(observation.dependencies);
    expect(a.connects).toBe(1);
    stop();
    expect(a.disconnects).toBe(1);
  });
  it('preserves detected changes when a later version read throws', () => {
    for (const kind of ['cache', 'observation'] as const) {
      const a = source(),
        b = source(),
        cache = new MemoCache(),
        dependencies = new Map([
          [a.dependency, 0],
          [b.dependency, 0],
        ]);
      cache.publish(dependencies);
      const observation = new MemoObservation(dependencies, cache);
      const before = kind === 'cache' ? cache.getSnapshot() : observation.getVersion();
      a.change();
      b.setFailure(true);
      expect(() => (kind === 'cache' ? cache.getSnapshot() : observation.getVersion())).toThrow(
        'version failed',
      );
      b.setFailure(false);
      expect(kind === 'cache' ? cache.getSnapshot() : observation.getVersion()).not.toBe(before);
    }
  });
  it('coalesces mixed-leaf notifications without deferring publication-race checks', () => {
    const state = new State(),
      dependencies = collectDependencies(() => state.first + state.second).dependencies,
      cache = new MemoCache();
    cache.publish(dependencies);
    let notifications = 0;
    const stop = cache.subscribe(() => {
      notifications++;
      cache.getSnapshot();
    });
    batch(() => {
      state.first++;
      state.second++;
    });
    expect(notifications).toBe(0);
    flushSync();
    expect(notifications).toBe(1);
    cache.publish(new Map(dependencies));
    expect(notifications).toBe(2);
    stop();
  });
  it('cancels queued delivery after the final listener disconnects', () => {
    const a = source(),
      cache = new MemoCache();
    cache.publish(new Map([[a.dependency, 0]]));
    let notifications = 0;
    const stop = cache.subscribe(() => notifications++);
    a.change();
    stop();
    flushSync();
    expect(notifications).toBe(0);
    expect(a.disconnects).toBe(1);
  });
});

describe('memo aggregate React ownership', () => {
  it('uses one leaf subscription across both external stores, cached renders and recomputation', async () => {
    const state = new State(),
      counts = countSubscriptions(
        collectDependencies(() => state.first + state.second).dependencies,
      );
    let calculations = 0;
    function View({ tick }: { tick: number }) {
      const frame = useRenderFrame();
      const value = useServiceMemo(frame, () => {
        calculations++;
        return frame.track(() => state.first + state.second);
      }, []);
      return frame.finish(
        <output>
          {value}:{tick}
        </output>,
      );
    }
    const tree = render(<View tick={0} />);
    expect(counts.active).toBe(2);
    expect(counts.connects).toBe(2);
    tree.rerender(<View tick={1} />);
    expect(calculations).toBe(1);
    expect(counts.connects).toBe(2);
    await act(async () => {
      batch(() => {
        state.first++;
        state.second++;
      });
    });
    expect(screen.getByText('12:1')).toBeTruthy();
    expect(calculations).toBe(2);
    expect(counts.connects).toBe(2);
    tree.unmount();
    expect(counts.active).toBe(0);
    expect(counts.disconnects).toBe(2);
  });
  it('handles Strict Mode replay and a mutation before the first publication', async () => {
    const state = new State(),
      counts = countSubscriptions(collectDependencies(() => state.first).dependencies);
    function View() {
      const frame = useRenderFrame();
      return frame.finish(<output>{useServiceMemo(frame, () => state.first, [])}</output>);
    }
    function Mutator() {
      useLayoutEffect(() => {
        state.first = 3;
      }, []);
      return null;
    }
    const tree = render(
      <StrictMode>
        <View />
        <Mutator />
      </StrictMode>,
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText('3')).toBeTruthy();
    expect(counts.active).toBe(1);
    expect(counts.maximum).toBe(1);
    tree.unmount();
    expect(counts.active).toBe(0);
  });
  it('does not move source ownership into an abandoned suspended branch', async () => {
    const state = new State(),
      firstDeps = collectDependencies(() => state.first).dependencies,
      secondDeps = collectDependencies(() => state.second).dependencies;
    const first = countSubscriptions(firstDeps),
      second = countSubscriptions(secondDeps);
    let release!: () => void,
      waiting = true;
    const gate = new Promise<void>((resolve) => {
      release = () => {
        waiting = false;
        resolve();
      };
    });
    function View({ alternate }: { alternate: boolean }) {
      const frame = useRenderFrame();
      const value = useServiceMemo(frame, () => (alternate ? state.second : state.first), [
        alternate,
      ]);
      if (alternate && waiting) throw gate;
      return frame.finish(<output>{value}</output>);
    }
    function App() {
      const [alternate, setAlternate] = useState(false);
      return (
        <>
          <button onClick={() => startTransition(() => setAlternate(true))}>switch</button>
          <Suspense fallback="pending">
            <View alternate={alternate} />
          </Suspense>
        </>
      );
    }
    const tree = render(<App />);
    await act(async () => {
      fireEvent.click(screen.getByText('switch'));
    });
    expect(first.active).toBe(1);
    expect(second.active).toBe(0);
    await act(async () => {
      state.first = 2;
      state.second = 20;
    });
    expect(screen.getByText('2')).toBeTruthy();
    expect(second.active).toBe(0);
    await act(async () => {
      release();
      await gate;
    });
    expect(screen.getByText('20')).toBeTruthy();
    expect(first.active).toBe(0);
    expect(second.active).toBe(1);
    tree.unmount();
    expect(second.active).toBe(0);
  });
});
