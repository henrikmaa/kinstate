/** Private compiler ABI: only an instrumented receiver may observe live prop reads. */
const receivers = new WeakSet<object>();
const wrappers = new WeakMap<object, unknown>();

export function markReactiveComponent<T extends object>(component: T): T {
  receivers.add(component);
  return component;
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
