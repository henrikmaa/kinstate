'use no service tracking';

import type { Dependency } from '@kinstate/core';
import type { MemoCache } from './memo-cache.js';

/**
 * One immutable memo calculation's observation, independent of committed cache
 * ownership. A render always adopts version zero: changed captured versions
 * invalidate that value even before its metadata can be published in an effect.
 */
export class MemoObservation implements Dependency {
  readonly frameDependencies: ReadonlyMap<Dependency, number> = new Map([[this, 0]]);
  private readonly checked = new Map<Dependency, number>();
  private version = 0;

  constructor(
    readonly dependencies: ReadonlyMap<Dependency, number>,
    private readonly cache: Pick<MemoCache, 'subscribe'>,
  ) {}

  getVersion(): number {
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
      // A later source may throw. Keep an earlier detected change observable
      // after recovery rather than losing it in partially updated checks.
      if (changed) this.version++;
    }
    return this.version;
  }

  subscribe(listener: () => void): () => void {
    // Only committed effects publish source ownership in the cache. Delegating
    // notification does not replace this result's own snapshot/race validation.
    return this.cache.subscribe(listener);
  }
}
