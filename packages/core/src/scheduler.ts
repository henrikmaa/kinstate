/** One notification queue for all observations, proxies, and explicit batches. */
let batchDepth = 0;
let scheduled = false;
const pending = new Set<() => void>();

export function enqueue(listener: () => void): void {
  pending.add(listener);
  if (!scheduled && batchDepth === 0) {
    scheduled = true;
    queueMicrotask(flushSync);
  }
}

/** Deliver queued notifications. Mutations themselves are always synchronous. */
export function flushSync(): void {
  scheduled = false;
  if (batchDepth) return;
  let iterations = 0;
  const errors: unknown[] = [];
  while (pending.size) {
    if (++iterations > 1000) {
      pending.clear();
      throw new Error('Reactive notification cycle exceeded 1000 iterations');
    }
    const tasks = [...pending];
    pending.clear();
    for (const task of tasks) {
      try {
        task();
      } catch (error) {
        errors.push(error);
      }
    }
  }
  if (errors.length) throw new AggregateError(errors, 'Reactive subscribers failed');
}

export function batch<T>(fn: () => T): T {
  batchDepth++;
  try {
    return fn();
  } finally {
    batchDepth--;
    if (!batchDepth && pending.size && !scheduled) {
      scheduled = true;
      queueMicrotask(flushSync);
    }
  }
}

/** Cancel a queued delivery when its subscription is released. */
export function cancelQueued(listener: () => void): void {
  pending.delete(listener);
}
