import { expect, it } from 'vitest';
import { collectDependencies, flushSync, observe, Service } from '@kinstate/core';
import { collectInto, untracked } from '@kinstate/core/internal';
import { Atom, type Dependency, isCollecting } from '../core/src/dependencies.js';
import { RenderFrame } from '../react/src/render-frame.js';

it.each([0, false, null, undefined, ''])(
  'preserves the collected result %s and restores ownership',
  (value) => {
    const destination = new Map<Dependency, number>();
    const atom = new Atom();
    expect(
      collectInto(() => {
        atom.read();
        return value;
      }, destination),
    ).toBe(value);
    expect(destination.get(atom)).toBe(0);
    expect(isCollecting()).toBe(false);
  },
);

it('keeps public collection results isolated from an accumulating destination', () => {
  const first = new Atom();
  const second = new Atom();
  const destination = new Map<Dependency, number>([[first, 0]]);
  const result = collectDependencies(() => second.read(), destination);
  expect([...result.dependencies.keys()]).toEqual([second]);
  expect([...destination.keys()]).toEqual([first, second]);
  expect(result.dependencies).not.toBe(destination);
});

it('retains earliest versions across nested reads and intervening mutations', () => {
  const atom = new Atom();
  const destination = new Map<Dependency, number>();
  collectInto(() => {
    atom.read();
    atom.changed();
    collectInto(() => atom.read(), destination);
    atom.read();
  }, destination);
  collectInto(() => atom.read(), destination);
  expect(atom.getVersion()).toBe(1);
  expect(destination.get(atom)).toBe(0);
});

it('keeps thrown nested reads and restores the outer collector and untracked regions', () => {
  const before = new Atom();
  const nested = new Atom();
  const after = new Atom();
  const ignored = new Atom();
  const destination = new Map<Dependency, number>();
  const error = new Error('read failed');
  const outer = collectDependencies(() => {
    before.read();
    expect(() =>
      collectInto(() => {
        nested.read();
        throw error;
      }, destination),
    ).toThrow(error);
    untracked(() => ignored.read());
    after.read();
  });
  expect([...outer.dependencies.keys()]).toEqual([before, nested, after]);
  expect([...destination.keys()]).toEqual([nested]);
  expect(isCollecting()).toBe(false);
  expect(() =>
    collectInto(() => {
      nested.read();
      throw error;
    }, destination),
  ).toThrow(error);
  expect(isCollecting()).toBe(false);
  expect(collectDependencies(() => undefined).dependencies.size).toBe(0);
});

it('does not publish historical destination entries to a distinct outer observation', () => {
  const historical = new Atom();
  const current = new Atom();
  const outerRead = new Atom();
  const destination = new Map<Dependency, number>([[historical, 0]]);
  const outer = collectDependencies(() => {
    outerRead.read();
    collectInto(() => current.read(), destination);
  });
  expect([...destination.keys()]).toEqual([historical, current]);
  expect([...outer.dependencies.keys()]).toEqual([outerRead, current]);
});

it('propagates reads through computed graph collectors and dynamic recomputation', () => {
  const destination = new Map<Dependency, number>();
  class State extends Service {
    first = 1;
    second = 10;
    useFirst = true;
    get selected() {
      return collectInto(() => (this.useFirst ? this.first : this.second), destination);
    }
  }
  const state = new State();
  const results: number[] = [];
  const stop = observe(() => {
    results.push(state.selected);
  });
  try {
    state.first = 2;
    flushSync();
    state.useFirst = false;
    flushSync();
    state.first = 3;
    flushSync();
    state.second = 11;
    flushSync();
    expect(results).toEqual([1, 2, 10, 11]);
  } finally {
    stop();
  }
  expect(isCollecting()).toBe(false);
});

it('validates interleaved render attempts without copying older attempt dependencies', () => {
  const first = new Atom();
  const second = new Atom();
  const outerOnly = new Atom();
  const abandoned = new RenderFrame();
  const committed = new RenderFrame();
  abandoned.track(() => first.read());
  committed.track(() => second.read());
  abandoned.track(() => {
    outerOnly.read();
    committed.track(() => second.read());
  });
  abandoned.finish(null);
  committed.finish(null);
  const initial = committed.getSnapshot();
  first.changed();
  outerOnly.changed();
  expect(committed.getSnapshot()).toBe(initial);
  second.changed();
  expect(committed.getSnapshot()).not.toBe(initial);
  expect(abandoned.getSnapshot().revision).toBe(1);
});

it('preserves subscription-time validation and keeps closed-frame event reads unobserved', () => {
  const observed = new Atom();
  const eventOnly = new Atom();
  const frame = new RenderFrame();
  const initial = frame.getSnapshot();
  frame.track(() => frame.track(() => observed.read()));
  frame.finish(null);
  observed.changed();
  expect(frame.getSnapshot()).not.toBe(initial);
  let notifications = 0;
  const unsubscribe = frame.subscribe(() => {
    notifications++;
  });
  try {
    frame.track(() => eventOnly.read());
    eventOnly.changed();
    flushSync();
    expect(notifications).toBe(0);
    observed.changed();
    flushSync();
    expect(notifications).toBe(1);
  } finally {
    unsubscribe();
  }
});

it('collects only synchronous reads when an async callback returns a promise', async () => {
  const before = new Atom();
  const after = new Atom();
  const destination = new Map<Dependency, number>();
  const result = collectInto(async () => {
    before.read();
    await Promise.resolve();
    after.read();
  }, destination);
  expect(isCollecting()).toBe(false);
  await result;
  expect([...destination.keys()]).toEqual([before]);
});
