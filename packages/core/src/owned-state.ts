import { unwrapReadonlyView } from './readonly-views.js';

/** Incoming data has publication-local aliases; backing targets never leave core. */
const ownedTargets = new WeakSet<object>();
export function isOwnedStateTarget(value: object): boolean {
  return ownedTargets.has(value);
}

/** Descriptor copying cannot reconstruct custom instance private/native brands. */
export function hasCustomArrayClassPrototype(prototype: object | null): boolean {
  for (
    let current = prototype;
    current && current !== Array.prototype;
    current = Object.getPrototypeOf(current)
  ) {
    const constructor = Object.getOwnPropertyDescriptor(current, 'constructor');
    if (constructor && (!('value' in constructor) || constructor.value !== Array)) return true;
  }
  return false;
}

interface PendingCopy {
  source: object;
  target: object;
  array: boolean;
}
export interface OwnedStateCopier {
  copy<T>(value: T): T;
  finish(): void;
}

/** Iterative descriptor copying preserves sparse arrays, cycles and deep payloads. */
export function createOwnedStateCopier(
  canonical: (value: object) => object | undefined,
  proxy: (target: object) => object,
): OwnedStateCopier {
  let aliases: WeakMap<object, object> | undefined;
  const pending: PendingCopy[] = [];
  const copy = <T>(value: T): T => {
    value = unwrapReadonlyView(value);
    if (value === null || typeof value !== 'object') return value;
    const existing = canonical(value);
    if (existing) return existing as T;
    if (ownedTargets.has(value)) return value;
    const array = Array.isArray(value);
    const prototype = Object.getPrototypeOf(value);
    if (!array && prototype !== Object.prototype && prototype !== null) return value;
    if (array && hasCustomArrayClassPrototype(prototype)) return value;
    const seen = aliases?.get(value);
    if (seen) return seen as T;
    const target = array ? [] : Object.create(prototype);
    if (array && prototype !== Array.prototype) Object.setPrototypeOf(target, prototype);
    ownedTargets.add(target);
    // Frozen source data remains an opaque frozen snapshot. Mutable descendants
    // still get canonical proxies, preventing pinned descriptors from leaking raw state.
    const representation = Object.isFrozen(value) ? target : proxy(target);
    (aliases ??= new WeakMap()).set(value, representation);
    pending.push({ source: value, target, array });
    return representation as T;
  };
  return {
    copy,
    finish() {
      for (let work = pending.pop(); work; work = pending.pop()) {
        for (const key of Reflect.ownKeys(work.source)) {
          if (work.array && key === 'length') continue;
          const descriptor = Object.getOwnPropertyDescriptor(work.source, key)!;
          Object.defineProperty(
            work.target,
            key,
            'value' in descriptor ? { ...descriptor, value: copy(descriptor.value) } : descriptor,
          );
        }
        if (work.array)
          Object.defineProperty(
            work.target,
            'length',
            Object.getOwnPropertyDescriptor(work.source, 'length')!,
          );
        if (!Object.isExtensible(work.source)) Object.preventExtensions(work.target);
      }
    },
  };
}
