import { memo, type ComponentType } from 'react';

/** Private compiler ABI: only an instrumented receiver may observe live prop reads. */
const receivers = new WeakSet<object>();
const wrappers = new WeakMap<object, unknown>();
const memoized = new WeakMap<object, object>();
const implicitMemos = new WeakSet<object>();

export function markReactiveComponent<T extends object>(component: T, memoize = false): T {
  receivers.add(component);
  if (!memoize || implicitMemos.has(component)) return component;
  const cached = memoized.get(component);
  if (cached) return cached as T;
  // Only compiler-proven component bindings request memoization. React.memo
  // retains their context, local state and external-store updates normally.
  const wrapped = memo(component as unknown as ComponentType<any>);
  receivers.add(wrapped);
  implicitMemos.add(wrapped);
  memoized.set(component, wrapped);
  return wrapped as unknown as T;
}

/** Record an explicit compiler-proven React wrapper edge; no React object internals are inspected. */
export function markReactiveWrapper<T extends object>(wrapper: T, inner: unknown): T {
  wrappers.set(wrapper, inner);
  return wrapper;
}

export function isReactiveComponent(component: unknown): boolean {
  let current = component;
  let visited: Set<object> | undefined;
  while (current !== null && (typeof current === 'object' || typeof current === 'function')) {
    if (receivers.has(current)) return true;
    const inner = wrappers.get(current);
    if (inner === undefined) return false;
    if (visited?.has(current)) return false;
    (visited ??= new Set()).add(current);
    current = inner;
  }
  return false;
}
