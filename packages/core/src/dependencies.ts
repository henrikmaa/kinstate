import { enqueue, cancelQueued } from './scheduler.js';
import { ComputedGraph } from './computed-graph.js';

/** The synchronous collector never outlives a call stack or belongs to a React render. */
/** A versioned observable, shared by the core and framework integrations. */
export interface Dependency {
  getVersion(): number;
  subscribe(listener: () => void): () => void;
}

type Collector = Map<Dependency, number> | ComputedGraph;
let collector: Collector | undefined;
let collectionId = 0;
let activeCollectionId = 0;
let mutationEpoch = 0;

/** Property registries allocate dependency nodes only inside an explicit observation. */
export function isCollecting(): boolean {
  return collector !== undefined;
}

/** Even unobserved writes advance lazy computed validation checkpoints. */
export function markMutation(): void {
  mutationEpoch++;
}

/**
 * Collect only synchronous reads. Nested collectors restore their parent.
 * An optional caller-owned map accumulates earliest versions, including reads
 * made before fn throws. Its ownership must stay local to an observation attempt.
 */
export function collectDependencies<T>(
  fn: () => T,
  destination?: Map<Dependency, number>,
): {
  value: T;
  dependencies: Map<Dependency, number>;
} {
  const previous = collector;
  const dependencies = new Map<Dependency, number>();
  try {
    return { value: inCollection(fn, dependencies), dependencies };
  } finally {
    if (destination)
      for (const [dependency, version] of dependencies)
        if (!destination.has(dependency)) destination.set(dependency, version);
    if (previous)
      for (const [dependency, version] of dependencies) recordRead(previous, dependency, version);
  }
}

function inCollection<T>(fn: () => T, destination: Collector): T {
  const previous = collector;
  const previousId = activeCollectionId;
  collector = destination;
  activeCollectionId = ++collectionId;
  try {
    return fn();
  } finally {
    collector = previous;
    activeCollectionId = previousId;
  }
}

function recordRead(destination: Collector, dependency: Dependency, version: number): void {
  if (destination instanceof Map) {
    if (!destination.has(dependency)) destination.set(dependency, version);
  } else destination.read(dependency, version);
}

/** Direct computed graph edges and public subscriptions share the same ownership transitions. */
class Watchers extends Set<() => void> {
  constructor(private readonly observed: (active: boolean) => void) {
    super();
  }
  add(listener: () => void): this {
    const empty = this.size === 0;
    super.add(listener);
    if (empty) this.observed(true);
    return this;
  }
  delete(listener: () => void): boolean {
    const removed = super.delete(listener);
    if (removed && this.size === 0) this.observed(false);
    return removed;
  }
  clear(): void {
    if (this.size === 0) return;
    super.clear();
    this.observed(false);
  }
}

export class Atom implements Dependency {
  protected version = 0;
  private collectedBy = 0;
  private subscribers: Set<() => void> | undefined;
  constructor(private readonly observed?: (active: boolean, node: Atom) => void) {}
  // Invalidation is synchronous; public subscriber delivery goes through the shared queue.
  get watchers(): Set<() => void> {
    return (this.subscribers ??= new Watchers((active) => this.observed?.(active, this)));
  }
  getVersion(): number {
    return this.version;
  }
  read(): void {
    if (collector && this.collectedBy !== activeCollectionId) {
      const version = this.getVersion();
      this.collectedBy = activeCollectionId;
      // Nested collection can have propagated an earlier read into this frame.
      recordRead(collector, this, version);
    }
  }
  changed(): void {
    markMutation();
    this.version++;
    if (this.subscribers) for (const watcher of [...this.subscribers]) watcher();
  }
  subscribe(listener: () => void): () => void {
    let active = true;
    let version = this.getVersion();
    const deliver = () => {
      if (!active) return;
      const next = this.getVersion();
      if (next !== version) {
        version = next;
        listener();
      }
    };
    const invalidate = () => enqueue(deliver);
    this.watchers.add(invalidate);
    return () => {
      active = false;
      cancelQueued(deliver);
      this.watchers.delete(invalidate);
    };
  }
}

export class Computed extends Atom {
  private initialized = false;
  private evaluating = false;
  private value: unknown;
  private failure: { error: unknown } | undefined;
  private readonly dependencies = new ComputedGraph(
    (dependency) => this.attach(dependency),
    (dependency) => this.detach(dependency),
  );
  private checkedEpoch = -1;
  private connected = false;
  private dirty = true;
  constructor(private readonly evaluate: () => unknown) {
    super();
  }
  private readonly invalidate = () => {
    // A write during evaluation needs another delivery even if this evaluation
    // was already dirty; its earliest captured source version may now be stale.
    if (this.dirty && !this.evaluating) return;
    this.dirty = true;
    for (const watcher of [...this.watchers]) watcher();
  };
  private readonly disconnect = () => {
    if (this.watchers.size) return;
    this.dependencies.disconnect();
    this.connected = false;
  };
  private attach(dependency: Dependency): void {
    if (!(dependency instanceof Atom)) return;
    dependency.watchers.add(this.invalidate);
    if (dependency instanceof Computed) dependency.connect();
  }
  private detach(dependency: Dependency): void {
    if (!(dependency instanceof Atom)) return;
    dependency.watchers.delete(this.invalidate);
    if (dependency instanceof Computed) dependency.connect();
  }
  private connect(): void {
    // Subscription replacement during a React commit or tracked effect is
    // synchronous. Retain edges until the shared queue checkpoint so replacing
    // the last subscriber does not tear down an entire collection graph.
    // Once truly unobserved, source edges are released by flushSync/microtask.
    if (!this.watchers.size) {
      if (!this.connected) return;
      enqueue(this.disconnect);
      return;
    }
    cancelQueued(this.disconnect);
    // Adding another subscriber must not reconnect an unchanged, potentially large dependency graph.
    if (this.connected) return;
    this.connected = true;
    this.dependencies.connect();
  }
  getVersion(): number {
    if (this.evaluating) throw new Error('Circular computed getter dependency');
    if (this.initialized && this.checkedEpoch === mutationEpoch) return this.version;
    if (this.initialized && this.connected && !this.dirty) {
      this.checkedEpoch = mutationEpoch;
      return this.version;
    }
    const validatingEpoch = mutationEpoch;
    this.evaluating = true;
    try {
      const stale = !this.initialized || this.dependencies.isStale();
      if (stale) {
        this.dependencies.begin();
        const outcome = inCollection(() => {
          try {
            return { ok: true as const, value: this.evaluate() };
          } catch (error) {
            return { ok: false as const, error };
          }
        }, this.dependencies);
        this.dependencies.finish();
        const changed = outcome.ok
          ? !!this.failure || !Object.is(this.value, outcome.value)
          : !this.failure || !Object.is(this.failure.error, outcome.error);
        if (this.initialized && changed) this.version++;
        this.failure = outcome.ok ? undefined : { error: outcome.error };
        this.value = outcome.ok ? outcome.value : undefined;
        this.initialized = true;
        this.connect();
      }
      this.checkedEpoch = validatingEpoch;
      this.dirty = mutationEpoch !== validatingEpoch;
      return this.version;
    } finally {
      this.evaluating = false;
    }
  }
  read(): void {
    // Every computed read must validate writes made since its previous read,
    // even when this collection already captured an earlier version.
    this.getVersion();
    super.read();
  }
  get(): unknown {
    this.read();
    if (this.failure) throw this.failure.error;
    return this.value;
  }
  subscribe(listener: () => void): () => void {
    const stop = super.subscribe(listener);
    this.connect();
    return () => {
      stop();
      this.connect();
    };
  }
}
