# Core reference

`@kinstate/core` has no React dependency. It provides service construction, observations, dependency injection and lifecycle ownership. These APIs work in tests, workers and Node.js within the supported modern runtime.

## Service

```ts
import { Service } from '@kinstate/core';
class CounterService extends Service {
  count = 0;
  increment() {
    this.count++;
  }
  get doubled() {
    return this.count * 2;
  }
  onInit(): void {
    /* Acquire resources after activation. */
  }
  onDispose(): void {
    /* Release resources synchronously. */
  }
}
```

The constructor produces the canonical reactive service. Methods have stable service-bound references. Keep constructors inert and computed getters pure. Lifecycle hooks return `void`; they are not awaited.

## ServiceScope

```ts
import { ServiceScope } from '@kinstate/core';
const scope = new ServiceScope([CounterService]);
const counter = scope.get(CounterService);
scope.start();
counter.increment();
scope.dispose();
```

| Member                                  | Purpose                                                                          |
| --------------------------------------- | -------------------------------------------------------------------------------- |
| `new ServiceScope(services?, options?)` | Establish ownership; construction alone does not initialize resources.           |
| `get(ServiceClass, options?)`           | Resolve the nearest instance or construct locally when no owner exists.          |
| `start()`                               | Activate manually owned resources; use one ownership mode per scope.                                |
| `activate(ServiceClass)`                | Mark a deferred service as committed; framework integration uses this.           |
| `acquire()`                             | Activate under a lease and return an idempotent release function.                |
| `applyInputs(bindings)`                 | Apply supplied fields in one synchronous batch; return whether anything changed. |
| `dispose()`                             | Terminally release resources and references; repeated disposal is harmless.      |

`ScopeOptions` accepts `parent`, `initialState` and `inputs`. Initial state entries have `{ service, state }`; input entries come from `serviceInputs`. Inputs override overlapping initial fields. `ResolveOptions.deferInitialization` supports speculative framework resolution. Active children retain ancestor resources; dispose or release them before terminal parent disposal.

## Construction and injection

`createService(ServiceClass)` constructs an inert standalone instance. Use a scope when resources need an owner. `dependencies(...ServiceClasses)` creates a typed constructor dependency tuple for `static inject`. `ServiceConstructor` and `ValidInjection` describe and validate those constructor contracts.

## Inputs

`serviceInputs(ServiceClass, values)` returns an immutable shallow `ServiceInputBinding`. Values must target declared own writable data fields; lifecycle hooks, getters, prototype methods and readonly inputs are rejected. `ServiceInputs<T>` describes permitted fields. Ordinary external nested objects are borrowed opaque references. Omission preserves previous fields; explicit `undefined` clears optional values. See [external state](../guide/external-state.md).

## Observation and scheduling

`observe(effect)` runs immediately, tracks synchronous reads, and returns an idempotent cleanup function. It dynamically replaces dependencies on later executions. Own cleanup explicitly; do not use an async function as a tracked effect.

`batch(fn)` returns the callback's result and coalesces synchronous notification work. `flushSync()` drains core notifications; it is distinct from React DOM's function of the same name and does not itself promise a React commit.

For custom integrations, `collectDependencies(fn, destination?)` returns `{ value, dependencies }`; `Dependency` exposes version validation and subscription. A caller-owned destination retains earliest reads, including reads before an exception. These are advanced synchronous APIs, not required React consumption hooks. `isReactive(value)` identifies framework proxies; it does not turn raw aliases into observables.

Already-reactive Kinstate objects supplied as inputs retain their canonical identity and existing deep reactivity. Dependency injection is usually clearer for sharing state between services.

Calling `acquire()` switches activation to lease management, including after an earlier `start()`; releasing its last lease can deactivate resources.
