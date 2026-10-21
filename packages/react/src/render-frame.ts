import type { Dependency } from '@kinstate/core';
import { collectInto } from '@kinstate/core/internal';
import { assertComponentBoundary, type BoundaryKind } from './boundaries.js';
import { certifyBoundaryCallback } from './callback-boundaries.js';

type Snapshot = Readonly<{ revision: number }>;

/** Compiler ABI. Each instance belongs to exactly one render attempt. */
export class RenderFrame {
  private readonly dependencies = new Map<Dependency, number>();
  private checked = new Map<Dependency, number>();
  private snapshot: Snapshot = Object.freeze({ revision: 0 });
  private readonly serverSnapshot: Snapshot = this.snapshot;
  private open = true;

  track<T>(read: () => T): T {
    if (!this.open) return read();
    // Publish reads to this attempt's map even when user code throws. A locally
    // caught getter/helper failure renders a fallback that depends on those reads.
    // The collector preserves earliest versions for subscription-time validation.
    return collectInto(read, this.dependencies);
  }

  /** Compiler boundary for already evaluated custom-component values and commands. */
  boundary<T>(value: T, kind: BoundaryKind, receiver?: unknown): T {
    assertComponentBoundary(value, kind, receiver);
    return value;
  }

  /** Identity-preserving certificate for compiler-proven callback captures. */
  callback<T>(value: T, captures: () => readonly unknown[], mandatory = false, blocked = false): T {
    certifyBoundaryCallback(value, captures, mandatory, blocked);
    return value;
  }

  /** Capture iterator reads lazily, preserving early-exit cleanup. */
  iterate<T>(iterable: Iterable<T>): Iterable<T> {
    const frame = this;
    return {
      [Symbol.iterator](): Iterator<T> {
        const iterator = frame.track(() => iterable[Symbol.iterator]());
        const wrapped: Iterator<T> = {
          next: (...args: [] | [undefined]) => frame.track(() => iterator.next(...args)),
        };
        if (iterator.return) wrapped.return = (value) => frame.track(() => iterator.return!(value));
        if (iterator.throw) wrapped.throw = (error) => frame.track(() => iterator.throw!(error));
        return wrapped;
      },
    };
  }

  keys<T>(value: T): T {
    return this.track(() => {
      if (value != null) Reflect.ownKeys(Object(value));
      return value;
    });
  }

  finish<T>(value: T): T {
    this.open = false;
    return value;
  }

  readonly getSnapshot = (): Snapshot => {
    let changed = false;
    for (const [dependency, renderedVersion] of this.dependencies) {
      const version = dependency.getVersion();
      const previous = this.checked.get(dependency) ?? renderedVersion;
      if (version !== previous) changed = true;
      this.checked.set(dependency, version);
    }
    if (changed) this.snapshot = Object.freeze({ revision: this.snapshot.revision + 1 });
    return this.snapshot;
  };

  readonly getServerSnapshot = (): Snapshot => this.serverSnapshot;

  readonly subscribe = (listener: () => void): (() => void) => {
    const cleanups: (() => void)[] = [];
    try {
      for (const dependency of this.dependencies.keys()) {
        cleanups.push(dependency.subscribe(listener));
      }
    } catch (error) {
      for (const cleanup of cleanups) cleanup();
      throw error;
    }
    return () => {
      for (const cleanup of cleanups) cleanup();
    };
  };
}
