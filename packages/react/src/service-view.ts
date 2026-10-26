import { Service, isReactive } from '@kinstate/core';
import {
  createReadonlyArrayIteration,
  createReactiveReader,
  isServiceMethod,
  normalizeServiceArgument,
  registerReadonlyView,
  untracked,
} from '@kinstate/core/internal';
import {
  isReadonlyNativeMethod,
  readNativeValue,
  readonlyNativeMethod,
} from './readonly-native.js';

/** Keep callable signatures intact, including generic and overloaded commands. */
export type ReadonlyServiceValue<T> = T extends (...args: any[]) => any
  ? T
  : T extends Promise<infer V>
    ? Promise<ReadonlyServiceValue<V>>
    : T extends Map<infer K, infer V>
      ? ReadonlyMap<ReadonlyServiceValue<K>, ReadonlyServiceValue<V>>
      : T extends Set<infer V>
        ? ReadonlySet<ReadonlyServiceValue<V>>
        : T extends Date
          ? Omit<Date, `set${string}`>
          : T extends object
            ? { readonly [K in keyof T]: ReadonlyServiceValue<T[K]> }
            : T;

export type ServiceView<T extends Service> = ReadonlyServiceValue<T>;

// Shared weak caches preserve consumer identities without retaining discarded scopes.
const views = new WeakMap<object, object>();
const readonlyViews = new WeakSet<object>();
const ownedArrayResults = new Set<unknown>(
  [
    'map',
    'filter',
    'slice',
    'concat',
    'flat',
    'flatMap',
    'reduce',
    'reduceRight',
    'toSorted',
    'toReversed',
    'toSpliced',
    'with',
  ]
    .map((key) => Reflect.get(Array.prototype, key))
    .filter((method) => typeof method === 'function'),
);
const message =
  'Service state is read-only in React consumers. Change it through a service method.';
function reject(): never {
  throw new TypeError(message);
}

/** A cached read-only membrane; source reads retain the canonical computed receiver. */
export function readonlyServiceValue<T>(value: T): ReadonlyServiceValue<T> {
  if (value === null || (typeof value !== 'object' && typeof value !== 'function'))
    return value as ReadonlyServiceValue<T>;
  const source = value as object;
  if (readonlyViews.has(source)) return value as ReadonlyServiceValue<T>;
  const cached = views.get(source);
  if (cached) return cached as ReadonlyServiceValue<T>;
  if (value instanceof Promise) {
    const result = value.then((resolved) => readonlyServiceValue(resolved));
    views.set(source, result);
    readonlyViews.add(result);
    registerReadonlyView(result, source);
    return result as ReadonlyServiceValue<T>;
  }

  const callable = typeof value === 'function';
  const array = Array.isArray(value);
  const prototype = Object.getPrototypeOf(source);
  const ordinary =
    array || prototype === null || prototype === Object.prototype || value instanceof Service;
  // Shadow targets avoid exposing mutable values pinned by frozen/nonconfigurable descriptors.
  const shadow = callable
    ? (..._args: unknown[]) => undefined
    : array
      ? []
      : Object.create(prototype);
  const reactiveRead = createReactiveReader(source);
  let specializedMethods: WeakMap<Function, unknown> | undefined;
  let view: object;
  const read = (key: PropertyKey): unknown => {
    const result =
      ordinary || callable
        ? reactiveRead
          ? reactiveRead(key)
          : Reflect.get(source, key, source)
        : readNativeValue(source, key);
    // Constructors are inert class tokens, and native array species need a constructable function.
    if (key === 'constructor' && typeof result === 'function') return result;
    if (typeof result === 'function') {
      if (ordinary || callable) {
        if (!array) return readonlyServiceValue(result);
        const previous = specializedMethods?.get(result);
        if (previous) return previous;
        const optimized = createReadonlyArrayIteration(source, view, result, readonlyServiceValue);
        if (!optimized && !ownedArrayResults.has(result)) return readonlyServiceValue(result);
        // Copies/accumulators belong to the caller. Elements read from state remain readonly.
        const next = new Proxy(optimized ?? result, {
          apply(method, receiver, args) {
            const output = Reflect.apply(method, receiver, args);
            return isReactive(output) ? readonlyServiceValue(output) : output;
          },
          set: reject,
          deleteProperty: reject,
          defineProperty: reject,
          setPrototypeOf: reject,
          preventExtensions: reject,
        });
        readonlyViews.add(next);
        registerReadonlyView(next, optimized ?? result);
        (specializedMethods ??= new WeakMap()).set(result, next);
        return next;
      }
      // Only genuine native reads need receiver-specific wrappers. Reject aliases
      // before consulting the cache: an intrinsic under an unsupported key is opaque.
      if (!isReadonlyNativeMethod(source, key, result))
        return readonlyNativeMethod(source, key, result, view, readonlyServiceValue, reject);
      const previous = specializedMethods?.get(result);
      if (previous) return previous;
      const next = readonlyNativeMethod(source, key, result, view, readonlyServiceValue, reject);
      (specializedMethods ??= new WeakMap()).set(result, next);
      return next;
    }
    return readonlyServiceValue(result);
  };
  const handler: ProxyHandler<object> = {
    get: (_target, key) => read(key),
    has: (_target, key) => Reflect.has(source, key),
    ownKeys: () => Reflect.ownKeys(source),
    getOwnPropertyDescriptor(_target, key) {
      const descriptor = Reflect.getOwnPropertyDescriptor(source, key);
      if (!descriptor) return;
      if (array && key === 'length') return { ...descriptor, configurable: false, writable: true };
      if ('value' in descriptor)
        return { ...descriptor, value: untracked(() => read(key)), configurable: true };
      return { enumerable: descriptor.enumerable, configurable: true, get: () => read(key) };
    },
    set: reject,
    deleteProperty: reject,
    defineProperty: reject,
    setPrototypeOf: reject,
    preventExtensions: reject,
  };
  if (callable) {
    handler.apply = (_target, receiver, args) =>
      readonlyServiceValue(
        Reflect.apply(
          value as Function,
          receiver,
          isServiceMethod(value) ? args.map(normalizeServiceArgument) : args,
        ),
      );
  }
  view = new Proxy(shadow, handler);
  views.set(source, view);
  readonlyViews.add(view);
  registerReadonlyView(view, source);
  return view as ReadonlyServiceValue<T>;
}
