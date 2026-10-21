import { unwrapReadonlyView } from '@kinstate/core/internal';

const opaqueMessage =
  'Opaque nested object methods/accessors cannot be used through a React service view. Expose a service method instead.';
const prototypes = [
  Map.prototype,
  Set.prototype,
  Date.prototype,
  Object.getPrototypeOf([][Symbol.iterator]()),
  Object.getPrototypeOf(new Map()[Symbol.iterator]()),
  Object.getPrototypeOf(new Set()[Symbol.iterator]()),
  Object.getPrototypeOf(''[Symbol.iterator]()),
];
const descriptors = new Map<object, Map<PropertyKey, PropertyDescriptor>>();
for (const prototype of prototypes) {
  const entries = new Map<PropertyKey, PropertyDescriptor>();
  for (
    let current = prototype;
    current && current !== Object.prototype;
    current = Object.getPrototypeOf(current)
  )
    for (const key of Reflect.ownKeys(current))
      if (!entries.has(key)) entries.set(key, Object.getOwnPropertyDescriptor(current, key)!);
  descriptors.set(prototype, entries);
}
const objectToString = Object.prototype.toString;

function opaque(): never {
  throw new TypeError(opaqueMessage);
}

/** Reject custom accessors before giving them a mutable native/private receiver. */
export function readNativeValue(source: object, key: PropertyKey): unknown {
  let property: PropertyDescriptor | undefined;
  for (
    let current: object | null = source;
    current && !property;
    current = Object.getPrototypeOf(current)
  )
    property = Object.getOwnPropertyDescriptor(current, key);
  if (
    property?.get &&
    descriptors.get(Object.getPrototypeOf(source))?.get(key)?.get !== property.get
  )
    opaque();
  return Reflect.get(source, key, source);
}

/** Only exact intrinsic functions receive branded receivers; names/tags do not grant authority. */
export function readonlyNativeMethod(
  source: object,
  key: PropertyKey,
  method: Function,
  receiver: object,
  wrap: (value: unknown) => unknown,
  reject: () => never,
): unknown {
  if (key === 'toString' && method === objectToString)
    return () => Reflect.apply(method, receiver, []);
  const prototype = Object.getPrototypeOf(source);
  if (descriptors.get(prototype)?.get(key)?.value !== method) return opaque;
  if (prototype === Map.prototype || prototype === Set.prototype) {
    if (key === 'set' || key === 'add' || key === 'delete' || key === 'clear') return reject;
    if (key === 'forEach')
      return (callback: Function, thisArg?: unknown) => {
        if (typeof callback !== 'function')
          return Reflect.apply(method, source, [callback, thisArg]);
        Reflect.apply(method, source, [
          (value: unknown, entry: unknown) =>
            Reflect.apply(callback, thisArg, [wrap(value), wrap(entry), receiver]),
        ]);
      };
    return (...args: unknown[]) =>
      wrap(Reflect.apply(method, source, args.map(unwrapReadonlyView)));
  }
  if (prototype === Date.prototype) {
    if (typeof key === 'string' && key.startsWith('set')) return reject;
    // These two generic intrinsics call other methods dynamically; keep those calls guarded.
    const target = key === 'toJSON' || key === Symbol.toPrimitive ? receiver : source;
    return (...args: unknown[]) => wrap(Reflect.apply(method, target, args));
  }
  if (key === 'next' || key === 'return' || key === 'throw' || key === Symbol.iterator)
    return (...args: unknown[]) => wrap(Reflect.apply(method, source, args));
  return opaque;
}
