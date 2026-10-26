'use no service tracking';

import type { Dependency } from '@kinstate/core';
import { enqueue, cancelQueued } from '@kinstate/core/internal';

type Snapshot = Readonly<{ revision: number }>;

/** Committed memo metadata is an external store, never render-mutated React refs. */
export class MemoCache {
  private dependencies: ReadonlyMap<Dependency, number> = new Map();
  private checked = new Map<Dependency, number>();
  private readonly listeners = new Set<() => void>();
  private readonly stops = new Map<Dependency, () => void>();
  private snapshot: Snapshot = Object.freeze({ revision: 0 });
  private readonly serverSnapshot = this.snapshot;

  readonly getSnapshot = (): Snapshot => {
    let changed = false;
    try {
      for (const [dependency, renderedVersion] of this.dependencies) {
        const version = dependency.getVersion();
        if (version !== (this.checked.get(dependency) ?? renderedVersion)) {
          changed = true;
          this.checked.set(dependency, version);
        }
      }
    } finally {
      if (changed) this.snapshot = Object.freeze({ revision: this.snapshot.revision + 1 });
    }
    return this.snapshot;
  };

  readonly getServerSnapshot = (): Snapshot => this.serverSnapshot;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    if (this.listeners.size === 1) {
      try {
        this.connect();
      } catch (error) {
        this.listeners.delete(listener);
        if (!this.listeners.size) cancelQueued(this.notify);
        throw error;
      }
    }
    return () => {
      this.listeners.delete(listener);
      if (!this.listeners.size) this.disconnect();
    };
  };

  /** Effect-only publication: abandoned attempts cannot replace source ownership. */
  publish(dependencies: ReadonlyMap<Dependency, number>): void {
    if (this.dependencies === dependencies) return;
    const before = this.snapshot;
    const previousDependencies = this.dependencies;
    const previousChecked = this.checked;
    this.dependencies = dependencies;
    this.checked = new Map();
    try {
      this.connect();
    } catch (error) {
      this.dependencies = previousDependencies;
      this.checked = previousChecked;
      this.snapshot = before;
      throw error;
    }
    if (this.getSnapshot() !== before) this.notify();
  }

  // Distinct changed leaves share one delivery at the core flush checkpoint.
  // Publication-time race checks below still notify synchronously.
  private readonly invalidate = (): void => enqueue(this.notify);

  private readonly notify = (): void => {
    for (const listener of [...this.listeners]) listener();
  };

  private connect(): void {
    if (!this.listeners.size) return;
    // Commit publication usually retains the same large dependency set. Keep
    // those subscriptions; prepare new edges before removing the old branch.
    const added = new Map<Dependency, () => void>();
    try {
      for (const dependency of this.dependencies.keys())
        if (!this.stops.has(dependency))
          added.set(dependency, dependency.subscribe(this.invalidate));
    } catch (error) {
      for (const stop of added.values()) stop();
      throw error;
    }
    for (const [dependency, stop] of this.stops) {
      if (!this.dependencies.has(dependency)) {
        stop();
        this.stops.delete(dependency);
      }
    }
    for (const [dependency, stop] of added) this.stops.set(dependency, stop);
  }

  private disconnect(): void {
    cancelQueued(this.notify);
    for (const stop of this.stops.values()) stop();
    this.stops.clear();
  }
}
