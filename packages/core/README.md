# @kinstate/core

**Ordinary classes. Reactive state.**

React-independent class-based reactivity and scoped services.

```ts
import { Service, ServiceScope, observe } from '@kinstate/core';
class Counter extends Service {
  count = 0;
  increment() {
    this.count++;
  }
  get doubled() {
    return this.count * 2;
  }
}
const scope = new ServiceScope([Counter]);
const counter = scope.get(Counter);
const stop = observe(() => console.log(counter.doubled));
scope.start();
counter.increment();
stop();
scope.dispose();
```

Notifications coalesce in a microtask. `batch(fn)` groups synchronous writes; `flushSync()` explicitly drains notifications. `createService(Class)` creates an inert instance; use `ServiceScope` for resource ownership. Constructors must be resource-free; synchronous `onInit()` and `onDispose()` own resources.

`observe(effect, options?: ObserveOptions)` always runs its first tracked effect synchronously. An optional scheduler chooses when later tracked runs execute, after the core notification microtask has coalesced mutations:

```ts
const stopDrawing = observe(draw, {
  scheduler(run) {
    const id = requestAnimationFrame(run);
    return () => cancelAnimationFrame(id);
  },
});
```

The effect's actual reads are collected again when `run` executes; no deep traversal or manual revision property is needed. While one scheduled run is pending, further invalidations coalesce into that run, which sees the latest state. The scheduler may execute `run` synchronously, and a supplied callback is accepted at most once. It can return a cancellation function; cleanup cancels pending work, releases subscriptions, and makes late callbacks inert. Cleanup is idempotent and may be called from an updating effect. The initial run is never deferred.

A scheduler or synchronous effect error delivered through the core queue is included in `flushSync()`'s subscriber error aggregate. A deferred effect error is thrown in the scheduler's host callback (for example, the animation-frame callback). Dependencies read before an updating effect fails remain subscribed so a later state change can retry it. An initial effect failure cleans up and throws directly. If a cancellation function throws, subscriptions are still released; schedulers must cancel their own native resources reliably.


Declare constructor dependencies using `static inject = dependencies(CartService, PaymentService)`. Scope resolution validates tuples, detects cycles and resolves nearest ancestor registrations. Services are disposed in reverse construction order.

`collectDependencies(read, destination?)` is a low-level synchronous observation API. Its returned map contains only that call's reads. An optional caller-owned destination accumulates earliest observed versions even if `read` throws; allocate a separate destination for each observation attempt. Nested collectors restore their parent after success or failure.

Service-owned plain objects and arrays are reactive. Native objects/custom nested instances are opaque. Raw references bypass tracking. JavaScript private slots are unobservable. Do not derive cached getters from private-slot-only state. `isReactive(value)` identifies canonical proxies and their registered readonly React views without wrapping its argument.

ESM, Node.js 22.12+, MIT. React integration requires the separate React and compiler packages.

The runtime requires `WeakRef` and `FinalizationRegistry` (ES2021). Unused property dependency nodes are reclaimed with garbage collection; cleanup has no fixed timing guarantee.

## Implementation boundaries

`src/index.ts` is the explicit public export surface. Implementation modules are internal:

- `scheduler.ts` owns the shared notification queue and synchronous batching.
- `dependencies.ts` owns the synchronous collector, versioned atoms, and computed dependencies.
- `computed-graph.ts` reuses private computed dependency records and reconciles changed connections.
- `reactive.ts` owns canonical proxies, property metadata, and external callback identity.
- `owned-state.ts` copies incoming plain state iteratively with publication-local aliases and cycles.
- `service.ts` defines the base class and typed constructor dependency declarations.
- `inputs.ts` defines shallow input snapshots and validates input bindings and target fields.
- `scope.ts` owns instance resolution, initialization, leases, and disposal.
- `observe.ts` manages React-independent tracked effects and their subscriptions.

Dependencies flow from scopes and inputs toward the proxy engine, dependency graph, and scheduler. No module imports the public barrel internally, and the collector and notification queue each have one owner.

## Generic live inputs

Use `serviceInputs(UserService, { user: data, loading })` from core in the provider's `services` array. Values may come from props, context, local React state, or any library hook. Owned scopes seed inputs before rendering; committed updates batch into existing instances. Missing keys preserve state; explicit undefined clears fields that allow it. No RTK dependency or application synchronization effect is required.

Input fields must be public writable data fields with runtime initializers. Callback-valued own fields are supported. Getters, prototype methods, lifecycle hooks and readonly properties are excluded. Callback arguments and returns are type-checked; the own-field versus prototype-method restriction is enforced at runtime because TypeScript represents both with callable signatures. Plain-object and array inputs become service-owned copies. Use separate draft fields when edits must survive replacement source snapshots. Inputs do not write back to their source. External scopes can preseed `ScopeOptions.inputs` for SSR; `scope.applyInputs()` provides the same React-independent update operation and reports whether values changed. Requires TypeScript 5.4+.

Object and array inputs are copied when their source reference changes, then remain deeply reactive inside the service. Repeating a binding with the same field value does not copy again or overwrite service edits. Publish replacement source values to update the service; source mutations in place do not notify it. Explicitly supplied canonical reactive proxies retain their identity and deep tracking, although constructor dependency injection is usually clearer for sharing state between services. Callbacks retain their original identities.

Pass callback inputs with the same helper: `serviceInputs(EditorService, { onSave: saveFromHook })`, where the class declares an initialized writable callback field. Calls return the supplied function unchanged, preserving its identity, values, promises, errors and normal JavaScript receiver semantics. Service methods accessing that field use the latest committed callback. Detached older callbacks remain snapshots. Stable callback identity alone cannot invalidate computations reading hidden external state; bind that state separately.


Computed source edges are released at the next notification checkpoint (a microtask or explicit `flushSync()`), allowing synchronous unsubscribe/resubscribe replacement to reuse a large graph. Removed public subscriptions stop delivering immediately. Intrinsic map/filter reads use one structural sequence dependency while callback field reads stay granular; native sparse-array, accessor and species behavior is covered by regressions, including partial failed length truncation.

Computed reevaluation updates version records in place rather than allocating a complete dependency map and reconnecting stable edges. Connected clean computations skip source-version scans after unrelated writes; detached computations still validate lazily. Ordinary property versions are captured once per collection, while computed reads always validate intervening writes. Shared proxy-handler methods and one weak canonical registry reduce allocation during collection replacement without changing observable identities or descriptor/receiver semantics.
