/** Private React/core protocol. Sources remain mutable; consumer views never own state. */
const sources = new WeakMap<object, object>();
const argumentViews = new WeakMap<object, object>();
const normalizedArguments = new WeakSet<object>();

export function registerReadonlyView(view: object, source: object): void {
  const canonical = unwrapReadonlyView(source);
  if (view === canonical) throw new TypeError('A readonly view must differ from its source');
  const previous = sources.get(view);
  if (previous && previous !== canonical) throw new TypeError('Readonly view source cannot change');
  sources.set(view, canonical);
}

export function unwrapReadonlyView<T>(value: T): T {
  let source: unknown = value;
  while (source !== null && (typeof source === 'object' || typeof source === 'function')) {
    const next = sources.get(source);
    if (!next) break;
    source = next;
  }
  return source as T;
}

function plainContainer(value: unknown): value is object {
  if (value === null || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return Array.isArray(value) || prototype === Object.prototype || prototype === null;
}
function containsView(value: unknown, seen = new WeakSet<object>()): boolean {
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return false;
  if (sources.has(value)) return true;
  if (!plainContainer(value) || seen.has(value)) return false;
  seen.add(value);
  return Reflect.ownKeys(value).some((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    return 'value' in descriptor && containsView(descriptor.value, seen);
  });
}

/** Give commands mutable references without rewriting caller-owned argument containers. */
export function normalizeServiceArgument<T>(value: T): T {
  const source = unwrapReadonlyView(value);
  if (value !== null && typeof value === 'object' && normalizedArguments.has(value)) return value;
  if (source !== value || !plainContainer(value)) return source;
  const existing = argumentViews.get(value);
  if (existing) return existing as T;
  if (!containsView(value)) return source;
  const proxy = new Proxy(value, {
    get(target, key, receiver) {
      const result = Reflect.get(target, key, receiver);
      const normalized = normalizeServiceArgument(result);
      const descriptor = Object.getOwnPropertyDescriptor(target, key);
      if (
        descriptor &&
        !descriptor.configurable &&
        'value' in descriptor &&
        !descriptor.writable &&
        result !== normalized
      )
        throw new TypeError(
          'Readonly views inside fixed argument properties cannot be normalized; pass the view directly or use a writable data container',
        );
      return normalized;
    },
    getOwnPropertyDescriptor(target, key) {
      const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
      if (descriptor?.configurable && 'value' in descriptor)
        return { ...descriptor, value: normalizeServiceArgument(descriptor.value) };
      return descriptor;
    },
  });
  argumentViews.set(value, proxy);
  normalizedArguments.add(proxy);
  return proxy as T;
}
