import { isReactive } from '@kinstate/core';
import { unwrapReadonlyView } from '@kinstate/core/internal';

const callbackCaptures = new WeakMap<
  Function,
  { read: () => readonly unknown[]; mandatory: boolean; blocked: boolean }
>();

/** Compiler ABI; metadata owns captures without retaining a render frame. */
export function certifyBoundaryCallback(
  value: unknown,
  captures: () => readonly unknown[],
  mandatory = false,
  blocked = false,
): void {
  if (typeof value === 'function' && !callbackCaptures.has(value))
    callbackCaptures.set(value, { read: captures, mandatory, blocked });
}

/** Mutable capture containers can acquire live state after the boundary check. */
export function assertSnapshotCaptures(captures: readonly unknown[]): void {
  for (const captured of captures)
    if (captured !== null && (typeof captured === 'object' || typeof captured === 'function'))
      throw new TypeError(
        'Reactive render callbacks must capture evaluated primitive values. Read the required fields before creating the callback.',
      );
}

/** Compiled receivers can track live synchronous callbacks, but never deferred async reads. */
export function assertDeferredCaptures(value: unknown, visited = new WeakSet<object>()): void {
  if (
    value === null ||
    (typeof value !== 'object' && typeof value !== 'function') ||
    visited.has(value)
  )
    return;
  visited.add(value);
  if (typeof value === 'function') {
    const certificate = callbackCaptures.get(value);
    if (certificate?.mandatory) {
      if (certificate.blocked)
        throw new TypeError(
          'Reactive render callbacks must be synchronous; asynchronous work belongs in service methods or command callbacks.',
        );
      assertSnapshotCaptures(certificate.read());
    }
    if (certificate) {
      const descriptors = Object.getOwnPropertyDescriptors(value);
      for (const key of Reflect.ownKeys(descriptors)) {
        const field = Reflect.get(descriptors, key) as PropertyDescriptor;
        if ('value' in field) assertDeferredCaptures(field.value, visited);
      }
    }
    return;
  }
  // Compiled receivers own reads from live service views, including opaque API
  // payloads. Enumerating those views eagerly materializes every nested value
  // and cannot brand-check native Map/Set proxies. Inspect authored config only.
  if (isReactive(value) || unwrapReadonlyView(value) !== value) return;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  for (const key of Reflect.ownKeys(descriptors)) {
    const field = Reflect.get(descriptors, key) as PropertyDescriptor;
    if ('value' in field) assertDeferredCaptures(field.value, visited);
  }
  if (value instanceof Map && Object.getPrototypeOf(value) === Map.prototype)
    for (const [key, entry] of Map.prototype.entries.call(value)) {
      assertDeferredCaptures(key, visited);
      assertDeferredCaptures(entry, visited);
    }
  if (value instanceof Set && Object.getPrototypeOf(value) === Set.prototype)
    for (const entry of Set.prototype.values.call(value)) assertDeferredCaptures(entry, visited);
}

export function getCallbackCertificate(callback: Function) {
  return callbackCaptures.get(callback);
}
