import { collectDependencies } from './dependencies.js';
import { enqueue, cancelQueued } from './scheduler.js';

export interface ObserveOptions {
  /** Schedule subsequent tracked runs. The initial effect always runs synchronously. */
  scheduler?: (run: () => void) => void | (() => void);
}

interface ScheduledRun {
  cancel?: () => void;
  cancelled: boolean;
}

/** React-independent tracked effect. Returns an idempotent cleanup function. */
export function observe(effect: () => void, options?: ObserveOptions): () => void {
  let active = true;
  let running = false;
  let stops: (() => void)[] = [];
  let pending: ScheduledRun | undefined;
  const scheduler = options?.scheduler;
  const run = () => {
    if (!active || running) return;
    running = true;
    for (const stop of stops) stop();
    stops = [];
    try {
      const result = collectDependencies(() => {
        try {
          effect();
          return { ok: true as const };
        } catch (error) {
          return { ok: false as const, error };
        }
      });
      // Cleanup can be called from the effect itself. Do not reconnect an
      // observation that was disposed while its reads were being collected.
      if (active) {
        try {
          for (const dependency of result.dependencies.keys())
            stops.push(dependency.subscribe(schedule));
        } catch (error) {
          for (const stop of stops) stop();
          stops = [];
          throw error;
        }
      }
      if (!result.value.ok) throw result.value.error;
    } finally {
      running = false;
    }
  };
  const request = scheduler
    ? () => {
        if (!active || pending) return;
        const scheduled: ScheduledRun = { cancelled: false };
        pending = scheduled;
        try {
          const cancel = scheduler(() => {
            if (!active || pending !== scheduled) return;
            pending = undefined;
            run();
          });
          // A scheduler may call cleanup before returning its cancellation
          // handle. Release that handle once it becomes available as well.
          if (scheduled.cancelled) cancel?.();
          else if (pending === scheduled) scheduled.cancel = cancel ?? undefined;
        } catch (error) {
          if (pending === scheduled) pending = undefined;
          throw error;
        }
      }
    : run;
  const schedule = () => {
    if (active) enqueue(request);
  };
  try {
    run();
  } catch (error) {
    active = false;
    for (const stop of stops) stop();
    throw error;
  }
  return () => {
    active = false;
    cancelQueued(request);
    const scheduled = pending;
    pending = undefined;
    if (scheduled) scheduled.cancelled = true;
    try {
      scheduled?.cancel?.();
    } finally {
      for (const stop of stops) stop();
      stops = [];
    }
  };
}
