'use no service tracking';

import type { Dependency } from '@kinstate/core';

type Snapshot = Readonly<{ revision: number }>;

/** Committed memo metadata is an external store, never render-mutated React refs. */
export class MemoCache {
  private dependencies: ReadonlyMap<Dependency, number> = new Map();
  private checked = new Map<Dependency, number>();
  private readonly listeners = new Set<() => void>();
  private stops: (() => void)[] = [];
  private snapshot: Snapshot = Object.freeze({ revision: 0 });
  private readonly serverSnapshot = this.snapshot;

  readonly getSnapshot = (): Snapshot => {
    let changed = false;
    for (const [dependency, renderedVersion] of this.dependencies) {
      const version = dependency.getVersion();
      if (version !== (this.checked.get(dependency) ?? renderedVersion)) changed = true;
      this.checked.set(dependency, version);
    }
    if (changed) this.snapshot = Object.freeze({ revision: this.snapshot.revision + 1 });
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
    this.dependencies = dependencies;
    this.checked = new Map();
    this.disconnect();
    this.connect();
    if (this.getSnapshot() !== before) this.notify();
  }

  private readonly notify = (): void => {
    for (const listener of [...this.listeners]) listener();
  };

  private connect(): void {
    if (!this.listeners.size) return;
    try {
      for (const dependency of this.dependencies.keys())
        this.stops.push(dependency.subscribe(this.notify));
    } catch (error) {
      this.disconnect();
      throw error;
    }
  }

  private disconnect(): void {
    for (const stop of this.stops) stop();
    this.stops = [];
  }
}
