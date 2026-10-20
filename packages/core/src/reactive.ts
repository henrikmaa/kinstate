import { Atom, Computed, isCollecting, markMutation } from './dependencies.js';
import { batch } from './scheduler.js';
import { createArrayIteration, isArrayIndex } from './array-iteration.js';

/** Own canonical proxy identity and observable metadata for the lifetime of each target. */
class Metadata {
  readonly values = new PropertyAtoms();
  private existenceAtoms?: PropertyAtoms;
  private keyAtom?: Atom;
  private computedValues?: Map<PropertyKey, Computed>;
  private boundMethods?: WeakMap<Function, Function>;
  private externalKeys?: Set<PropertyKey>;
  private immutableKeys?: Set<PropertyKey>;
  private sequence?: Atom;
  readSequence(): void {
    (this.sequence ??= new Atom()).read();
  }
  changeSequence(key: PropertyKey): void {
    if (key === 'length' || isArrayIndex(key)) {
      this.sequence?.changed();
    }
  }
  get existence(): PropertyAtoms {
    return (this.existenceAtoms ??= new PropertyAtoms());
  }
  get keys(): Atom {
    return (this.keyAtom ??= new Atom());
  }
  get computed(): Map<PropertyKey, Computed> {
    return (this.computedValues ??= new Map());
  }
  get methods(): WeakMap<Function, Function> {
    return (this.boundMethods ??= new WeakMap());
  }
  hasWrappedMethod(method: Function): boolean {
    return this.boundMethods?.has(method) ?? false;
  }
  get externalInputKeys(): Set<PropertyKey> {
    return (this.externalKeys ??= new Set());
  }
  get immutableInputKeys(): Set<PropertyKey> {
    return (this.immutableKeys ??= new Set());
  }
  clearComputed(key: PropertyKey): void {
    this.computedValues?.delete(key);
  }
}
// Both raw targets and canonical proxies resolve to their existing handler.
// Two weak entries per instance replace separate forward/reverse maps and let
// ordinary wrapping hit either identity with one lookup.
const handlers = new WeakMap<object, ReactiveHandler>();
const metadata = new WeakMap<object, Metadata>();
const serviceTargets = new WeakSet<object>();

interface AtomEntry {
  reference: WeakRef<Atom>;
  observed?: Atom;
}
type AtomEntries = Map<PropertyKey, AtomEntry>;
const finalizedAtoms = new FinalizationRegistry<{
  entries: WeakRef<AtomEntries>;
  key: PropertyKey;
  reference: WeakRef<Atom>;
}>(({ entries, key, reference }) => {
  const liveEntries = entries.deref();
  // A key may have been observed again since its previous node was collected.
  if (liveEntries?.get(key)?.reference === reference) liveEntries.delete(key);
});

/**
 * Targets own actively observed property nodes; unobserved entries remain weak.
 * Captures preserve node identity across delete/reinsert/subscribe races. Active
 * effects survive even when their caller discards cleanup, and releasing the last
 * watcher allows historical keys to disappear with garbage collection.
 */
export class PropertyAtoms {
  private readonly entries: AtomEntries = new Map();
  get size(): number {
    return this.entries.size;
  }
  keys(): IterableIterator<PropertyKey> {
    return this.entries.keys();
  }
  read(key: PropertyKey): void {
    if (!isCollecting()) return;
    const entry = this.entries.get(key);
    const node = entry?.observed ?? entry?.reference.deref() ?? this.create(key);
    node.read();
  }
  private create(key: PropertyKey): Atom {
    const entries = new WeakRef(this.entries);
    // A node owns its entry, never the property registry. This avoids map and
    // WeakRef lookups on every observation transition while the registry still
    // strongly owns active nodes and weakly owns captured, inactive nodes.
    const created = {} as AtomEntry;
    const node = new Atom((active, observedNode) => {
      created.observed = active ? observedNode : undefined;
    });
    const reference = new WeakRef(node);
    created.reference = reference;
    this.entries.set(key, created);
    finalizedAtoms.register(node, { entries, key, reference });
    return node;
  }
  changed(key: PropertyKey): void {
    const entry = this.entries.get(key);
    const node = entry?.observed ?? entry?.reference.deref();
    if (node) node.changed();
    else markMutation();
  }
}

function meta(target: object): Metadata {
  let value = metadata.get(target);
  if (!value) {
    value = new Metadata();
    metadata.set(target, value);
  }
  return value;
}
function descriptor(target: object | null, key: PropertyKey): PropertyDescriptor | undefined {
  for (let current: object | null = target; current; current = Object.getPrototypeOf(current)) {
    const found = Object.getOwnPropertyDescriptor(current, key);
    if (found) return found;
  }
}
function unwrap<T>(value: T): T {
  return value && typeof value === 'object' ? ((handlers.get(value)?.target ?? value) as T) : value;
}
function changeValue(state: Metadata | undefined, key: PropertyKey): void {
  if (state) {
    state.clearComputed(key);
    state.values.changed(key);
    state.changeSequence(key);
  } else markMutation();
}
function changeExistence(state: Metadata | undefined, key: PropertyKey): void {
  if (state) state.existence.changed(key);
  else markMutation();
}
function changeKeys(state: Metadata | undefined): void {
  if (state) state.keys.changed();
  else markMutation();
}
function wrap<T>(value: T): T {
  if (!value || typeof value !== 'object') return value;
  return wrapObject(value);
}
function wrapObject<T extends object>(value: T): T {
  const existing = handlers.get(value);
  if (existing) return existing.proxy as T;
  const prototype = Object.getPrototypeOf(value);
  const isService = serviceTargets.has(value);
  const isArray = Array.isArray(value);
  if (!isService && !isArray && prototype !== Object.prototype && prototype !== null) return value;
  if (!Object.isExtensible(value)) return value;
  const handler = new ReactiveHandler(value, isService, isArray);
  const proxy = new Proxy<T>(value, handler);
  handler.proxy = proxy;
  handlers.set(value, handler);
  handlers.set(proxy, handler);
  return proxy;
}

/** Brand only service roots; nested plain values share the same proxy caches. */
export function createReactiveService<T extends object>(target: T): T {
  serviceTargets.add(target);
  return wrap(target);
}

/** Whether a value is a canonical service or nested reactive proxy from this runtime. */
export function isReactive(value: unknown): boolean {
  return value !== null && typeof value === 'object' && handlers.get(value)?.proxy === value;
}

/** Apply prevalidated fields, preserving callbacks without changing ordinary method binding. */
export function applyReactiveInputs(
  instance: object,
  values: Readonly<Record<string, unknown>>,
): boolean {
  let changed = false;
  for (const [key, value] of Object.entries(values)) {
    const state = meta(unwrap(instance));
    const wasExternal = state.externalInputKeys.has(key);
    state.externalInputKeys.add(key);
    const wasImmutable = state.immutableInputKeys.has(key);
    const immutable = value !== null && typeof value === 'object' && !isReactive(value);
    if (immutable) state.immutableInputKeys.add(key);
    else state.immutableInputKeys.delete(key);
    const previous = Object.getOwnPropertyDescriptor(instance, key)!.value;
    if (Object.is(previous, unwrap(value))) {
      if ((!wasExternal && typeof previous === 'function') || wasImmutable !== immutable) {
        state.values.changed(key);
        changed = true;
      }
      continue;
    }
    if (!Reflect.set(instance, key, value))
      throw new Error(`Service input property is not writable: ${key}`);
    changed = true;
  }
  return changed;
}

/** Shared prototype traps avoid allocating a function set for every nested row. */
class ReactiveHandler implements ProxyHandler<object> {
  proxy!: object;
  private state?: Metadata;
  // Descriptor changes evict ordinary own-data classifications before the next read.
  private readonly dataProperties = new Set<PropertyKey>();
  constructor(
    readonly target: object,
    private readonly isService: boolean,
    private readonly isArray: boolean,
  ) {}
  private getState(target: object): Metadata {
    return (this.state ??= meta(target));
  }
  get(target: object, key: PropertyKey, receiver: any): unknown {
    const { dataProperties, isService, isArray } = this;
    const cachedData = dataProperties.has(key);
    if (cachedData && !isService) {
      if (isCollecting()) this.getState(target).values.read(key);
      const result = Reflect.get(target, key, receiver);
      if (!isArray || typeof result !== 'function') {
        const wrapped = wrap(result);
        return wrapped;
      }
    }
    const own = cachedData ? undefined : Object.getOwnPropertyDescriptor(target, key);
    const ownData = cachedData || (own !== undefined && 'value' in own);
    if (own && 'value' in own && own.configurable && own.writable) dataProperties.add(key);
    if (own && !own.configurable && 'value' in own && !own.writable) return own.value;
    const desc = cachedData ? undefined : (own ?? descriptor(Object.getPrototypeOf(target), key));
    if (desc?.get) {
      const state = this.getState(target);
      state.values.read(key);
      // Reflect.get and inherited proxy access can supply another receiver.
      // Its reads belong to the current caller, never the canonical getter's
      // persistent computed cache.
      if (receiver !== this.proxy) return wrap(desc.get.call(receiver));
      let computed = state.computed.get(key);
      if (!computed) {
        computed = new Computed(() => desc.get!.call(receiver));
        state.computed.set(key, computed);
      }
      return wrap(computed.get());
    }
    if (isCollecting()) this.getState(target).values.read(key);
    const result = own && 'value' in own ? own.value : Reflect.get(target, key, receiver);
    if (isArray && receiver === this.proxy && typeof result === 'function') {
      const state = this.getState(target);
      let method = state.methods.get(result);
      if (!method) {
        method = createArrayIteration(
          target as unknown[],
          receiver,
          result,
          (index) => {
            if (dataProperties.has(index)) return wrap(Reflect.get(target, index, receiver));
            const entry = Object.getOwnPropertyDescriptor(target, index);
            if (entry && 'value' in entry) {
              if (!entry.configurable && !entry.writable) return entry.value;
              if (entry.configurable && entry.writable) dataProperties.add(index);
              return wrap(entry.value);
            }
            return Reflect.get(receiver, index);
          },
          () => {
            if (isCollecting()) state.readSequence();
          },
        );
        if (method) state.methods.set(result, method);
      }
      if (method) return method;
    }
    if (typeof result === 'function' && key !== 'constructor' && isService) {
      const state = this.getState(target);
      if (state.externalInputKeys.has(key) && ownData) return result;
      let bound = state.methods.get(result);
      if (!bound) {
        bound = (...args: unknown[]) => batch(() => Reflect.apply(result, this.proxy, args));
        state.methods.set(result, bound);
      }
      return bound;
    }
    if (isService && ownData && this.getState(target).immutableInputKeys.has(key)) {
      return result;
    }
    return wrap(result);
  }
  set(target: object, key: PropertyKey, next: unknown, receiver: any): boolean {
    const { isArray } = this;
    const state = (this.state ??= metadata.get(target));
    const own = Object.getOwnPropertyDescriptor(target, key);
    const desc = own ?? descriptor(Object.getPrototypeOf(target), key);
    if (desc?.set)
      return batch(() => {
        desc.set!.call(receiver, next);
        return true;
      });
    if (own && 'value' in own && receiver === this.proxy && !(isArray && key === 'length')) {
      if (!own.writable) return false;
      const normalized = unwrap(next);
      if (Object.is(own.value, normalized)) return true;
      if (!Reflect.defineProperty(target, key, { value: normalized })) return false;
      changeValue(state, key);
      return true;
    }
    return Reflect.set(target, key, unwrap(next), receiver);
  }
  defineProperty(target: object, key: PropertyKey, next: PropertyDescriptor): boolean {
    const { dataProperties, isService, isArray } = this;
    dataProperties.delete(key);
    const state = (this.state ??= metadata.get(target));
    const previous = Object.getOwnPropertyDescriptor(target, key);
    const length = isArray ? (target as unknown[]).length : undefined;
    const removed =
      state && key === 'length' && isArray
        ? [...new Set([...state.values.keys(), ...state.existence.keys()])].filter(
            (k) => isArrayIndex(k) && Object.hasOwn(target, k),
          )
        : [];
    const normalized = 'value' in next ? { ...next, value: unwrap(next.value) } : next;
    const applied = Reflect.defineProperty(target, key, normalized);
    // ArraySetLength can delete higher indices and shorten length before a
    // non-configurable index makes the operation fail. Publish actual changes
    // while preserving the native false return (or caller's TypeError).
    if (!applied && !(isArray && key === 'length')) return false;
    const after = Object.getOwnPropertyDescriptor(target, key)!;
    const pinnedIdentityChanged =
      previous &&
      'value' in previous &&
      'value' in after &&
      (!previous.configurable && !previous.writable) !== (!after.configurable && !after.writable) &&
      ((after.value !== null &&
        typeof after.value === 'object' &&
        handlers.has(after.value) &&
        !(isService && state?.immutableInputKeys.has(key))) ||
        (isService &&
          typeof after.value === 'function' &&
          key !== 'constructor' &&
          !state?.externalInputKeys.has(key)) ||
        (isArray && typeof after.value === 'function' && state?.hasWrappedMethod(after.value)));
    if (
      !previous ||
      !Object.is(previous.value, after.value) ||
      previous.get !== after.get ||
      previous.set !== after.set ||
      pinnedIdentityChanged
    ) {
      changeValue(state, key);
    }
    if (!previous) {
      changeExistence(state, key);
      changeKeys(state);
    } else if (previous.enumerable !== after.enumerable) changeKeys(state);
    if (isArray && (target as unknown[]).length !== length) {
      if (key !== 'length') changeValue(state, 'length');
      for (const removedKey of removed) {
        if (Object.hasOwn(target, removedKey)) continue;
        changeValue(state, removedKey);
        if (!Reflect.has(target, removedKey)) changeExistence(state, removedKey);
      }
      const actualLength = (target as unknown[]).length;
      for (const cachedKey of dataProperties) {
        if (isArrayIndex(cachedKey) && Number(cachedKey) >= actualLength) {
          dataProperties.delete(cachedKey);
        }
      }
      changeKeys(state);
    }
    return applied;
  }
  deleteProperty(target: object, key: PropertyKey): boolean {
    const { dataProperties } = this;
    dataProperties.delete(key);
    const state = (this.state ??= metadata.get(target));
    const existed = Object.hasOwn(target, key);
    if (!Reflect.deleteProperty(target, key)) return false;
    if (existed) {
      changeValue(state, key);
      changeExistence(state, key);
      changeKeys(state);
    }
    return true;
  }
  has(target: object, key: PropertyKey): boolean {
    if (isCollecting()) this.getState(target).existence.read(key);
    return Reflect.has(target, key);
  }
  ownKeys(target: object): ArrayLike<string | symbol> {
    if (isCollecting()) this.getState(target).keys.read();
    return Reflect.ownKeys(target);
  }
}
