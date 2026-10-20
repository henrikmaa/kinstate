import { collectDependencies } from './dependencies.js';
import { enqueue, cancelQueued } from './scheduler.js';

/** React-independent tracked effect. Returns an idempotent cleanup function. */
export function observe(effect: () => void): () => void {
  let active = true;
  let running = false;
  let stops: (() => void)[] = [];
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
      stops = [...result.dependencies.keys()].map((dep) => dep.subscribe(schedule));
      if (!result.value.ok) throw result.value.error;
    } finally {
      running = false;
    }
  };
  const schedule = () => enqueue(run);
  try {
    run();
  } catch (error) {
    active = false;
    for (const stop of stops) stop();
    throw error;
  }
  return () => {
    active = false;
    cancelQueued(run);
    for (const stop of stops) stop();
    stops = [];
  };
}
