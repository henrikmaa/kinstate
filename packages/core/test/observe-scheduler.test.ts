import { describe, expect, it } from 'vitest';
import { Service, batch, flushSync, observe, type ObserveOptions } from '../src/index.js';

class State extends Service {
  count = 0;
  name = 'first';
  useName = false;
  shape = { x: 0, y: 0 };
}

function deferredScheduler() {
  const jobs: (() => void)[] = [];
  let cancellations = 0;
  const options: ObserveOptions = {
    scheduler(run) {
      jobs.push(run);
      return () => {
        cancellations++;
      };
    },
  };
  return { options, jobs, cancellations: () => cancellations };
}

describe('scheduled core observations', () => {
  it('runs initially synchronously and coalesces batches while a custom run is pending', () => {
    const state = new State();
    const deferred = deferredScheduler();
    const seen: number[] = [];
    const stop = observe(() => {
      seen.push(state.count);
    }, deferred.options);
    expect(seen).toEqual([0]);
    expect(deferred.jobs).toHaveLength(0);
    batch(() => {
      state.count++;
      state.count++;
    });
    flushSync();
    expect(deferred.jobs).toHaveLength(1);
    state.count++;
    flushSync();
    expect(deferred.jobs).toHaveLength(1);
    expect(seen).toEqual([0]);
    deferred.jobs[0]!();
    expect(seen).toEqual([0, 3]);
    state.count++;
    flushSync();
    expect(deferred.jobs).toHaveLength(2);
    deferred.jobs[1]!();
    expect(seen).toEqual([0, 3, 4]);
    stop();
    expect(deferred.cancellations()).toBe(0);
  });

  it('collects actual scheduled reads and replaces conditional dependencies', () => {
    const state = new State();
    const deferred = deferredScheduler();
    const seen: (string | number)[] = [];
    const stop = observe(() => {
      seen.push(state.useName ? state.name : state.count);
    }, deferred.options);
    state.useName = true;
    flushSync();
    deferred.jobs[0]!();
    expect(seen).toEqual([0, 'first']);
    state.count++;
    flushSync();
    expect(deferred.jobs).toHaveLength(1);
    state.name = 'next';
    flushSync();
    deferred.jobs[1]!();
    expect(seen).toEqual([0, 'first', 'next']);
    stop();
  });

  it('cancels pending work once and ignores a callback that races cleanup', () => {
    const state = new State();
    const deferred = deferredScheduler();
    const seen: number[] = [];
    const stop = observe(() => {
      seen.push(state.count);
    }, deferred.options);
    state.count++;
    flushSync();
    stop();
    stop();
    expect(deferred.cancellations()).toBe(1);
    deferred.jobs[0]!();
    state.count++;
    flushSync();
    expect(seen).toEqual([0]);
    expect(deferred.jobs).toHaveLength(1);
  });

  it('removes queued notifications before the custom scheduler is invoked', () => {
    const state = new State();
    const deferred = deferredScheduler();
    const stop = observe(() => {
      void state.count;
    }, deferred.options);
    state.count++;
    stop();
    flushSync();
    expect(deferred.jobs).toHaveLength(0);
  });

  it('supports a synchronous scheduler and ignores duplicate callback invocations', () => {
    const state = new State();
    const seen: number[] = [];
    let calls = 0;
    const stop = observe(
      () => {
        seen.push(state.count);
      },
      {
        scheduler(run) {
          calls++;
          run();
          run();
        },
      },
    );
    state.count++;
    flushSync();
    expect(calls).toBe(1);
    expect(seen).toEqual([0, 1]);
    stop();
  });

  it('does not reconnect subscriptions when cleanup occurs inside a scheduled effect', () => {
    const state = new State();
    const deferred = deferredScheduler();
    let calls = 0;
    let stop!: () => void;
    stop = observe(() => {
      calls++;
      if (state.count) stop();
      void state.name;
    }, deferred.options);
    state.count++;
    flushSync();
    deferred.jobs[0]!();
    state.name = 'after cleanup';
    state.count++;
    flushSync();
    expect(calls).toBe(2);
    expect(deferred.jobs).toHaveLength(1);
  });

  it('cancels a handle returned after reentrant scheduler cleanup', () => {
    const state = new State();
    let cancellations = 0;
    let callback!: () => void;
    let stop!: () => void;
    stop = observe(
      () => {
        void state.count;
      },
      {
        scheduler(run) {
          callback = run;
          stop();
          return () => {
            cancellations++;
          };
        },
      },
    );
    state.count++;
    flushSync();
    expect(cancellations).toBe(1);
    callback();
    stop();
    expect(cancellations).toBe(1);
  });

  it('retains recoverable dependencies when a deferred effect throws', () => {
    const state = new State();
    const deferred = deferredScheduler();
    const seen: number[] = [];
    const stop = observe(() => {
      if (state.count === 1) throw new Error('scheduled effect failed');
      seen.push(state.count);
    }, deferred.options);
    state.count = 1;
    flushSync();
    expect(() => deferred.jobs[0]!()).toThrow('scheduled effect failed');
    state.count = 2;
    flushSync();
    deferred.jobs[1]!();
    expect(seen).toEqual([0, 2]);
    stop();
  });

  it('can retry after a scheduler throws and ignores the failed job callback', () => {
    const state = new State();
    const seen: number[] = [];
    const jobs: (() => void)[] = [];
    const stop = observe(
      () => {
        seen.push(state.count);
      },
      {
        scheduler(run) {
          jobs.push(run);
          if (jobs.length === 1) throw new Error('scheduler failed');
        },
      },
    );
    state.count++;
    expect(() => flushSync()).toThrow('Reactive subscribers failed');
    state.count++;
    flushSync();
    jobs[0]!();
    expect(seen).toEqual([0]);
    jobs[1]!();
    expect(seen).toEqual([0, 2]);
    stop();
  });

  it('releases subscriptions even when scheduler cancellation throws', () => {
    const state = new State();
    let schedules = 0;
    const stop = observe(
      () => {
        void state.count;
      },
      {
        scheduler() {
          schedules++;
          return () => {
            throw new Error('cancel failed');
          };
        },
      },
    );
    state.count++;
    flushSync();
    expect(() => stop()).toThrow('cancel failed');
    state.count++;
    flushSync();
    expect(schedules).toBe(1);
    expect(() => stop()).not.toThrow();
  });

  it('cleans up an initial failure without invoking the custom scheduler', () => {
    const state = new State();
    const deferred = deferredScheduler();
    expect(() =>
      observe(() => {
        void state.count;
        throw new Error('initial failure');
      }, deferred.options),
    ).toThrow('initial failure');
    state.count++;
    flushSync();
    expect(deferred.jobs).toHaveLength(0);
  });
  it('observes nested fields read by the scheduled draw instead of relying on root replacement', () => {
    const state = new State();
    const deferred = deferredScheduler();
    const coordinates: number[] = [];
    const draw = () => {
      coordinates.push(state.shape.x);
    };
    const stop = observe(draw, deferred.options);
    state.shape.y = 4;
    flushSync();
    expect(deferred.jobs).toHaveLength(0);
    state.shape.x = 12;
    flushSync();
    deferred.jobs[0]!();
    expect(coordinates).toEqual([0, 12]);
    stop();
  });

  it('preserves synchronous scheduler failure aggregation and later recovery', () => {
    const state = new State();
    const seen: number[] = [];
    const stop = observe(
      () => {
        if (state.count === 1) throw new Error('synchronous scheduled effect failed');
        seen.push(state.count);
      },
      { scheduler: (run) => run() },
    );
    state.count = 1;
    expect(() => flushSync()).toThrow('Reactive subscribers failed');
    state.count = 2;
    flushSync();
    expect(seen).toEqual([0, 2]);
    stop();
  });

  it('keeps default observations disposed when they clean themselves up while running', () => {
    const state = new State();
    let calls = 0;
    let stop!: () => void;
    stop = observe(() => {
      calls++;
      if (state.count) stop();
      void state.name;
    });
    state.count++;
    flushSync();
    state.name = 'after cleanup';
    flushSync();
    expect(calls).toBe(2);
  });
});
