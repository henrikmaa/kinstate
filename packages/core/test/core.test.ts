import { describe, expect, it, vi } from 'vitest';
import {
  Service,
  ServiceScope,
  batch,
  collectDependencies,
  createService,
  dependencies,
  flushSync,
  observe,
} from '../src/index.js';

class Counter extends Service {
  count = 0;
  name = 'Counter';
  nested = { value: 1 };
  items = [1, 2, 3];
  active = true;
  get doubled() {
    return this.count * 2;
  }
  increment() {
    this.count++;
  }
  twice() {
    this.increment();
    this.increment();
  }
  async load() {
    await Promise.resolve();
    this.count = 42;
  }
}

describe('reactive core', () => {
  it('tracks only observed properties and uses Object.is', () => {
    const service = new Counter();
    const effect = vi.fn(() => service.count);
    const stop = observe(effect);
    service.name = 'other';
    service.count = 0;
    flushSync();
    expect(effect).toHaveBeenCalledTimes(1);
    service.count = NaN;
    flushSync();
    expect(effect).toHaveBeenCalledTimes(2);
    service.count = NaN;
    flushSync();
    expect(effect).toHaveBeenCalledTimes(2);
    service.count = -0;
    flushSync();
    service.count = 0;
    flushSync();
    expect(effect).toHaveBeenCalledTimes(4);
    stop();
    service.count++;
    flushSync();
    expect(effect).toHaveBeenCalledTimes(4);
  });
  it('updates conditional dependencies and cleans subscriptions', () => {
    const service = new Counter();
    const effect = vi.fn(() => (service.active ? service.count : service.name));
    const stop = observe(effect);
    service.active = false;
    flushSync();
    service.count++;
    flushSync();
    expect(effect).toHaveBeenCalledTimes(2);
    service.name = 'new';
    flushSync();
    expect(effect).toHaveBeenCalledTimes(3);
    stop();
  });
  it('caches computed getters and filters equal results', () => {
    let calls = 0;
    class Parity extends Service {
      count = 0;
      get parity() {
        calls++;
        return this.count % 2;
      }
    }
    const service = new Parity();
    const effect = vi.fn(() => service.parity);
    const stop = observe(effect);
    expect(service.parity).toBe(0);
    expect(calls).toBe(1);
    service.count = 2;
    flushSync();
    expect(effect).toHaveBeenCalledTimes(1);
    expect(calls).toBe(2);
    service.count = 3;
    flushSync();
    expect(effect).toHaveBeenCalledTimes(2);
    stop();
    service.count = 4;
    expect(service.parity).toBe(0);
  });
  it('tracks chained and conditional computed values', () => {
    class Branch extends Counter {
      get value() {
        return this.active ? this.doubled : this.nested.value;
      }
    }
    const service = new Branch();
    const effect = vi.fn(() => service.value);
    const stop = observe(effect);
    service.count = 2;
    flushSync();
    expect(effect).toHaveBeenCalledTimes(2);
    service.active = false;
    flushSync();
    service.count = 3;
    flushSync();
    expect(effect).toHaveBeenCalledTimes(3);
    service.nested.value = 8;
    flushSync();
    expect(effect).toHaveBeenCalledTimes(4);
    stop();
  });
  it('tracks nested reassignment, arrays, keys, existence and deletion', () => {
    const service = new Counter();
    const nested = vi.fn(() => service.nested.value);
    const length = vi.fn(() => service.items.length);
    const index = vi.fn(() => service.items[2]);
    const exists = vi.fn(() => 2 in service.items);
    const stops = [observe(nested), observe(length), observe(index), observe(exists)];
    service.nested.value++;
    service.items.push(4);
    flushSync();
    expect(nested).toHaveBeenCalledTimes(2);
    expect(length).toHaveBeenCalledTimes(2);
    expect(index).toHaveBeenCalledTimes(1);
    service.items.length = 1;
    flushSync();
    expect(index).toHaveBeenCalledTimes(2);
    expect(exists).toHaveBeenCalledTimes(2);
    service.nested = { value: 7 };
    flushSync();
    expect(nested).toHaveBeenCalledTimes(3);
    const object = service.nested as { value?: number; added?: number };
    const keys = vi.fn(() => Object.keys(object));
    const stopKeys = observe(keys);
    object.added = 1;
    flushSync();
    delete object.value;
    flushSync();
    expect(keys).toHaveBeenCalledTimes(3);
    stops.forEach((stop) => stop());
    stopKeys();
  });
  it('binds methods and batches nested methods and explicit batches', async () => {
    const service = createService(Counter);
    const effect = vi.fn(() => service.count);
    const stop = observe(effect);
    expect(service.increment).toBe(service.increment);
    const increment = service.increment;
    increment();
    service.twice();
    flushSync();
    expect(service.count).toBe(3);
    expect(effect).toHaveBeenCalledTimes(2);
    batch(() => {
      service.count++;
      batch(() => service.count++);
    });
    flushSync();
    expect(effect).toHaveBeenCalledTimes(3);
    await service.load();
    flushSync();
    expect(service.count).toBe(42);
    expect(effect).toHaveBeenCalledTimes(4);
    stop();
  });
  it('supports setters, constructor fields, inheritance and stable nested identities', () => {
    class Child extends Counter {
      get value() {
        return this.count;
      }
      set value(value: number) {
        this.count = value;
      }
    }
    const service = new Child();
    const effect = vi.fn(() => service.value);
    const stop = observe(effect);
    service.value = 9;
    flushSync();
    expect(service.count).toBe(9);
    expect(effect).toHaveBeenCalledTimes(2);
    expect(service).toBeInstanceOf(Counter);
    expect(service.nested).toBe(service.nested);
    stop();
  });
  it('restores collectors after errors and propagates nested collection', () => {
    const service = new Counter();
    expect(() =>
      collectDependencies(() => {
        service.count;
        throw new Error('test');
      }),
    ).toThrow('test');
    const result = collectDependencies(() => collectDependencies(() => service.name));
    expect(result.dependencies.size).toBe(1);
  });
  it('detects circular computed dependencies', () => {
    class Cycle extends Service {
      get a(): number {
        return this.b;
      }
      get b(): number {
        return this.a;
      }
    }
    expect(() => new Cycle().a).toThrow('Circular computed');
  });
  it('invalidates consumers when an accessor is replaced or deleted', () => {
    const service = new Counter();
    const seen: unknown[] = [];
    const stop = observe(() => seen.push(service.doubled));
    Object.defineProperty(service, 'doubled', {
      configurable: true,
      get() {
        return 99;
      },
    });
    flushSync();
    expect(seen).toEqual([0, 99]);
    Reflect.deleteProperty(service, 'doubled');
    flushSync();
    expect(seen).toEqual([0, 99, 0]);
    stop();
  });
  it('publishes computed failures and tracks new recovery dependencies', () => {
    class Fragile extends Service {
      branch = false;
      recover = false;
      get value() {
        if (this.branch && !this.recover) throw new Error('computed failure');
        return this.branch ? 2 : 1;
      }
    }
    const service = new Fragile();
    const initial = collectDependencies(() => service.value);
    const listener = vi.fn();
    const stops = [...initial.dependencies.keys()].map((dep) => dep.subscribe(listener));
    service.branch = true;
    expect(() => flushSync()).not.toThrow();
    expect(listener).toHaveBeenCalledOnce();
    expect(() => service.value).toThrow('computed failure');
    service.recover = true;
    flushSync();
    expect(listener).toHaveBeenCalledTimes(2);
    expect(service.value).toBe(2);
    stops.forEach((stop) => stop());
  });
  it('cleans computed chains after unsubscribe', () => {
    let calls = 0;
    class Chain extends Counter {
      get a() {
        calls++;
        return this.doubled + 1;
      }
      get b() {
        return this.a + 1;
      }
    }
    const service = new Chain();
    const stop = observe(() => service.b);
    expect(calls).toBe(1);
    stop();
    service.count++;
    flushSync();
    expect(calls).toBe(1);
    expect(service.b).toBe(4);
    expect(calls).toBe(2);
  });
  it('retains recoverable effect dependencies after an update throws', () => {
    const service = new Counter();
    const values: number[] = [];
    const stop = observe(() => {
      if (service.count === 1) throw new Error('effect failure');
      values.push(service.count);
    });
    service.count = 1;
    expect(() => flushSync()).toThrow('Reactive subscribers failed');
    service.count = 2;
    flushSync();
    expect(values).toEqual([0, 2]);
    stop();
    service.count = 3;
    flushSync();
    expect(values).toEqual([0, 2]);
  });
  it('supports branded private method implementation details on the canonical proxy', () => {
    class Private extends Service {
      #resource = 2;
      value = 0;
      #read() {
        return this.#resource;
      }
      update() {
        this.#resource++;
        this.value = this.#read();
      }
    }
    const service = new Private();
    const method = service.update;
    method();
    expect(service.value).toBe(3);
  });
  it('respects frozen nonconfigurable property proxy invariants', () => {
    const raw = Object.freeze({ value: 2 });
    class Frozen extends Service {
      state: Readonly<{ value: number }> = raw;
    }
    const service = new Frozen();
    const snapshot = service.state;
    expect(snapshot).not.toBe(raw);
    expect(snapshot).toEqual(raw);
    expect(Object.isFrozen(snapshot)).toBe(true);
    Object.defineProperty(service, 'locked', {
      value: snapshot,
      writable: false,
      configurable: false,
    });
    expect(Reflect.get(service, 'locked')).toBe(snapshot);
    expect(() => Reflect.ownKeys(Object.freeze(service))).not.toThrow();
    expect(() => {
      service.state = { value: 3 };
    }).toThrow(TypeError);
  });
  it('keeps existing nested proxies stable after preventExtensions', () => {
    const service = new Counter();
    const nested = service.nested;
    Object.preventExtensions(nested);
    expect(service.nested).toBe(nested);
    const effect = vi.fn(() => service.nested.value);
    const stop = observe(effect);
    nested.value++;
    flushSync();
    expect(effect).toHaveBeenCalledTimes(2);
    stop();
  });
});

describe('scope ownership', () => {
  it('resolves dependencies, parent overrides, initial data and disposal order', () => {
    const events: string[] = [];
    class Cart extends Service {
      total = 0;
      onInit() {
        events.push('cart init');
      }
      onDispose() {
        events.push('cart dispose');
      }
    }
    class Checkout extends Service {
      static inject = dependencies(Cart);
      constructor(readonly cart: Cart) {
        super();
      }
      onInit() {
        events.push('checkout init');
      }
      onDispose() {
        events.push('checkout dispose');
      }
    }
    const scope = new ServiceScope([Checkout], {
      initialState: [{ service: Cart, state: { total: 3 } }],
    });
    const checkout = scope.get(Checkout);
    expect(checkout.cart.total).toBe(3);
    expect(events).toEqual([]);
    scope.start();
    scope.start();
    expect(events).toEqual(['cart init', 'checkout init']);
    const child = new ServiceScope([Checkout], { parent: scope });
    expect(child.get(Checkout).cart).toBe(checkout.cart);
    const override = new ServiceScope([Cart], { parent: scope });
    expect(override.get(Cart)).not.toBe(checkout.cart);
    scope.dispose();
    scope.dispose();
    expect(events.slice(2)).toEqual(['checkout dispose', 'cart dispose']);
    expect(() => scope.get(Cart)).toThrow('disposed');
  });
  it('survives Strict Mode lease replay and disposes exactly once', async () => {
    const init = vi.fn();
    const dispose = vi.fn();
    class Resource extends Service {
      onInit() {
        init();
      }
      onDispose() {
        dispose();
      }
    }
    const scope = new ServiceScope([Resource]);
    const first = scope.acquire();
    first();
    const second = scope.acquire();
    await Promise.resolve();
    expect(dispose).not.toHaveBeenCalled();
    expect(init).toHaveBeenCalledTimes(1);
    second();
    second();
    await Promise.resolve();
    expect(dispose).toHaveBeenCalledTimes(1);
  });
  it('isolates standalone scopes and rejects cycles or missing injection', () => {
    class A extends Service {
      static inject: readonly (typeof Service)[];
    }
    class B extends Service {
      static inject = dependencies(A);
    }
    A.inject = dependencies(B);
    expect(() => new ServiceScope([A]).get(A)).toThrow('A -> B -> A');
    class Missing extends Service {
      constructor(readonly count: number) {
        super();
      }
    }
    // @ts-expect-error Deliberately test runtime validation for untyped JavaScript callers.
    expect(() => new ServiceScope([Missing]).get(Missing)).toThrow('static inject');
    expect(new ServiceScope([Counter]).get(Counter)).not.toBe(
      new ServiceScope([Counter]).get(Counter),
    );
  });
  it('cleans resources when startup fails and continues disposal after errors', () => {
    const disposed = vi.fn();
    class Good extends Service {
      onDispose() {
        disposed();
      }
    }
    class Bad extends Service {
      onInit() {
        throw new Error('init failure');
      }
    }
    const scope = new ServiceScope([Good, Bad]);
    expect(() => scope.start()).toThrow('init failure');
    expect(disposed).toHaveBeenCalledOnce();
  });
  it('does not reuse an instance whose lazy initialization failed', () => {
    let attempts = 0;
    const disposed = vi.fn();
    class Lazy extends Service {
      onInit() {
        if (++attempts === 1) throw new Error('temporary');
      }
      onDispose() {
        disposed();
      }
    }
    const scope = new ServiceScope();
    scope.start();
    expect(() => scope.get(Lazy)).toThrow('temporary');
    scope.get(Lazy);
    expect(attempts).toBe(2);
    scope.dispose();
    expect(disposed).toHaveBeenCalledTimes(2);
  });
  it('retains service state across inactive leases but terminal disposal forbids reuse', async () => {
    const initialized = vi.fn();
    const disposed = vi.fn();
    class Resource extends Counter {
      onInit() {
        initialized();
      }
      onDispose() {
        disposed();
      }
    }
    const scope = new ServiceScope([Resource]);
    const original = scope.get(Resource);
    original.count = 4;
    const release = scope.acquire();
    release();
    await Promise.resolve();
    expect(disposed).toHaveBeenCalledOnce();
    expect(scope.get(Resource)).toBe(original);
    const second = scope.acquire();
    expect(initialized).toHaveBeenCalledTimes(2);
    expect(original.count).toBe(4);
    second();
    await Promise.resolve();
    scope.dispose();
    expect(disposed).toHaveBeenCalledTimes(2);
    expect(() => scope.acquire()).toThrow('disposed');
  });
  it('disposes remaining resources after an individual disposer throws', () => {
    const cleanup = vi.fn();
    class Good extends Service {
      onDispose() {
        cleanup();
      }
    }
    class Bad extends Service {
      onDispose() {
        throw new Error('dispose failure');
      }
    }
    const scope = new ServiceScope([Good, Bad]);
    scope.start();
    expect(() => scope.dispose()).toThrow('Service disposal failed');
    expect(cleanup).toHaveBeenCalledOnce();
    expect(() => scope.dispose()).not.toThrow();
  });
  it('defers active-scope resolution and activates only committed dependency graphs', () => {
    const events: string[] = [];
    class Dependency extends Service {
      onInit() {
        events.push('dependency');
      }
    }
    class Pending extends Service {
      static inject = dependencies(Dependency);
      constructor(readonly dependency: Dependency) {
        super();
      }
      onInit() {
        events.push('pending');
      }
    }
    class Other extends Service {
      onInit() {
        events.push('other');
      }
    }
    const parent = new ServiceScope([Dependency]);
    const scope = new ServiceScope([], { parent });
    scope.start();
    const pending = scope.get(Pending, { deferInitialization: true });
    expect(events).toEqual([]);
    scope.start();
    expect(events).toEqual([]);
    scope.activate(Other);
    expect(events).toEqual(['other']);
    expect(scope.activate(Pending)).toBe(pending);
    expect(events).toEqual(['other', 'dependency', 'pending']);
    scope.activate(Pending);
    expect(events).toHaveLength(3);
    scope.dispose();
    parent.dispose();
  });
});
