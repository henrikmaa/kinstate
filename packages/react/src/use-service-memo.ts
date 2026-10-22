'use client';
'use no service tracking';

import { useEffect, useMemo, useState, useSyncExternalStore, type DependencyList } from 'react';
import { collectDependencies, type Dependency } from '@kinstate/core';
import type { RenderFrame } from './render-frame.js';
import { MemoCache } from './memo-cache.js';

interface MemoResult<T> {
  readonly outcome:
    { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: unknown };
  readonly dependencies: ReadonlyMap<Dependency, number>;
}

/**
 * Compiler-only memoization. Cached reads are replayed into each attempt's frame;
 * an external-store token invalidates React's cache when observed versions change.
 * Only committed effects publish dependencies, so abandoned renders own no cache.
 */
export function useServiceMemo<T>(
  frame: RenderFrame,
  factory: () => T,
  dependencies?: DependencyList | null,
): T {
  const [cache] = useState(() => new MemoCache());
  const token = useSyncExternalStore(cache.subscribe, cache.getSnapshot, cache.getServerSnapshot);
  const result = useMemo<MemoResult<T>>(
    () => {
      const observed = new Map<Dependency, number>();
      try {
        const captured = collectDependencies(factory, observed);
        return { outcome: { ok: true, value: captured.value }, dependencies: observed };
      } catch (error) {
        // Initialize React's memo cell even when a caller catches the factory error.
        return { outcome: { ok: false, error }, dependencies: observed };
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    dependencies == null ? [{}] : [...dependencies, token],
  );
  frame.adopt(result.dependencies);
  useEffect(() => {
    cache.publish(result.dependencies);
  }, [cache, result]);
  // Register every hook before rethrowing user errors or Suspense promises.
  if (!result.outcome.ok) throw result.outcome.error;
  return result.outcome.value;
}
