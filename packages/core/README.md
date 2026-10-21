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
- `service.ts` defines the base class and typed constructor dependency declarations.
- `inputs.ts` defines shallow input snapshots and validates input bindings and target fields.
- `scope.ts` owns instance resolution, initialization, leases, and disposal.
- `observe.ts` manages React-independent tracked effects and their subscriptions.

Dependencies flow from scopes and inputs toward the proxy engine, dependency graph, and scheduler. No module imports the public barrel internally, and the collector and notification queue each have one owner.

## Generic live inputs

Use `serviceInputs(UserService, { user: data, loading })` from core in the provider's `services` array. Values may come from props, context, local React state, or any library hook. Owned scopes seed inputs before rendering; committed updates batch into existing instances. Missing keys preserve state; explicit undefined clears fields that allow it. No RTK dependency or application synchronization effect is required.

Input fields must be public writable data fields with runtime initializers. Callback-valued own fields are supported. Getters, prototype methods, lifecycle hooks and readonly properties are excluded. Callback arguments and returns are type-checked; the own-field versus prototype-method restriction is enforced at runtime because TypeScript represents both with callable signatures. Treat nested external values as borrowed immutable data and keep local edits in separate draft fields. Inputs do not write back to their source. External scopes can preseed `ScopeOptions.inputs` for SSR; `scope.applyInputs()` provides the same React-independent update operation and reports whether values changed. Requires TypeScript 5.4+.

Borrowed object and array inputs retain their exact original identity and remain opaque below the bound field. Reads and collection callbacks use the source data directly; replace the bound reference to publish an update. In-place edits to borrowed data are not observed. Ordinary service-owned collections remain deeply reactive. Explicitly supplied canonical reactive proxies retain their identity and deep tracking, although constructor dependency injection is usually clearer for sharing state between services. Switching a field between owned reactive data and borrowed immutable data invalidates that field even when the underlying raw reference is unchanged.

Pass callback inputs with the same helper: `serviceInputs(EditorService, { onSave: saveFromHook })`, where the class declares an initialized writable callback field. Calls return the supplied function unchanged, preserving its identity, values, promises, errors and normal JavaScript receiver semantics. Service methods accessing that field use the latest committed callback. Detached older callbacks remain snapshots. Stable callback identity alone cannot invalidate computations reading hidden external state; bind that state separately.


Computed source edges are released at the next notification checkpoint (a microtask or explicit `flushSync()`), allowing synchronous unsubscribe/resubscribe replacement to reuse a large graph. Removed public subscriptions stop delivering immediately. Intrinsic map/filter reads use one structural sequence dependency while callback field reads stay granular; native sparse-array, accessor and species behavior is covered by regressions, including partial failed length truncation.

Computed reevaluation updates version records in place rather than allocating a complete dependency map and reconnecting stable edges. Connected clean computations skip source-version scans after unrelated writes; detached computations still validate lazily. Ordinary property versions are captured once per collection, while computed reads always validate intervening writes. Shared proxy-handler methods and one weak canonical registry reduce allocation during collection replacement without changing observable identities or descriptor/receiver semantics.
