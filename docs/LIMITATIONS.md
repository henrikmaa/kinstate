# Supported behavior and limitations

## Compiler coverage

The required consuming form is a direct call in a synchronous function component:

```tsx
function Count() {
  const service = useService(CounterService);
  return <span>{service.count}</span>;
}
```

Named components, uppercase component variable bindings, and anonymous consumers inside React memo/forwardRef (including import aliases and nested wrappers) are supported. Import aliases and namespace imports are supported. Computed reads, optional chaining, synchronous method calls and constructor projections, destructuring, `in`, key enumeration, spreads, and synchronous array callbacks are tracked. For-of array reads and for-in key reads use explicit frame operations.

These forms are rejected or unsupported:

- Await/yield inside destructuring computed keys or defaults. Evaluate those expressions before the pattern. Awaited/yielded initializers are supported and retain their original async/generator context.
- `useService` in a custom hook, async component, generator, or anonymous callback outside recognized React memo/forwardRef wrappers.
- `useService(CounterService).count`; assign the hook result to a local variable first.
- Reassigning a service binding or escaping the service into an external helper, custom-component prop, or return value.
- Capturing a parent's service in a nested component or deferred render callback. Resolve the service inside each consuming component.
- In legacy compiler mode (`reactiveProps: false`, the Babel/Vite default), hiding service reads inside `useMemo` remains diagnosed, including member access, calls and constructor projections through aliases. Plain local expressions such as `const count = service.count; useMemo(() => count * 2, [count])` remain supported. Enable `reactiveProps: true` for client source, or `'client'` for marked client modules, to preserve ordinary imported React `useMemo` callbacks with reactive reads: the compiler collects their dependencies and replays them on cache hits. Keep non-service React values in the authored dependency array, and keep factories synchronous and pure. Custom hooks that conceal service reads are not covered by this transformation. Command callbacks using `useCallback(() => service.save(), [service])` and effects with stable service dependencies remain supported.
- Pattern initializers containing closures over mutable lexical header bindings, and reactive expressions containing nested hook calls, `await`, or `yield`. Separate hook results into local bindings before calling service methods.
- Component returns from a `try` or `catch` that must execute a `finally` block are diagnosed. Move the return after the `try`/`finally`, or move that computation into a synchronous helper. This prevents a return from closing the render frame before a later `finally` return evaluates its reads.
- Actual React Hooks accessed through computed namespace keys must use a named import or ordinary dot access. Service business methods with Hook-shaped names are supported, including immutable aliases and destructuring; reassigned Hook-shaped method aliases are diagnosed because their callable role is ambiguous.
- Passing a live reactive object to an uninstrumented component remains unsupported: a runtime boundary rejects the object instead of allowing stale reads. Primitive props/children, evaluated plain data (such as `service.rows.map(row => row.name)`), frozen external data, and ordinary on* command callbacks are supported. Render-prop functions that capture services require an instrumented receiving component in reactiveProps mode; uncompiled receivers remain guarded. Plain data validation preserves identity and does not clone state trees.

Intrinsic DOM expressions and event handlers remain supported, including the original `onClick={() => service.increment()}` API. Synchronous helpers invoked during rendering can be tracked through the surrounding instrumented call. Arbitrary escaped deferred work is not a supported dependency boundary. Do not bypass diagnostics by casting, re-exporting hooks under unrecognized names, or hiding reactive references inside containers.

The plugin must process the original JSX/TypeScript consumer source. The Vite adapter excludes `node_modules`; precompile distributed consumer components when publishing them. Configure the plugin for tests as well as production. React Compiler optimization is explicitly disabled for instrumented consumers in this version.

## Read-only React consumers

React components receive cached `ServiceView<T>` values. All consumer writes are rejected at runtime: assignments, update operators, deletions, array mutators, reflective property definition, prototype replacement and extension changes. This also covers nested getter values, array callback/iterator values, descriptor values and synchronous/asynchronous method results. Event handlers must invoke a service command rather than assign state. Fields/getters/arrays have deep readonly types. Ordinary array derivations such as filter/map/slice produce caller-owned containers that can be sorted or edited; references to original state inside them remain readonly. Original callable signatures remain intact for generic and overload inference, so a method's declared return type may look writable; runtime mutation guards still apply. Prefer getters for state queries or explicitly readonly return annotations when exposing command results.

A view is stable across hooks, component instances and rerenders, but differs from the mutable core instance returned by `scope.get()`. Methods are stable callable wrappers, bound internally to the writable service. Callback inputs and their promises retain exact identity inside core; React callable wrappers and protected promise resolutions have their own cached identities. This is an ownership boundary, not a JavaScript security sandbox: explicitly obtaining a mutable scope or retaining raw external references remains an intentional escape outside the React consumer API.

Map/Set/Date reads are supported and mutators rejected; they remain opaque for change tracking, so commands must replace their containing field to notify React. Custom native overrides and methods/accessors on other opaque nested native/custom instances are rejected rather than bound to a hidden mutable receiver. Frozen plain data remains readable and protected through shadow targets. Getters must remain pure; mutating commands belong in events/effects, not rendering.

Command arguments normalize direct views back to canonical references. Plain own-data containers containing views use cached read-through adapters rather than cloning or modifying caller containers. Such adapters differ in identity inside the command. Fixed nonconfigurable properties needing substitution throw an explicit error; accessor/native containers are opaque to nested argument normalization. Passing the view directly or using a writable DTO avoids that restriction. Ordinary arguments without views retain identity; new plain containers require traversal to detect nested views.

## JavaScript classes and objects

The runtime requires WeakRef and FinalizationRegistry in addition to Proxy (the supported modern ES2022 build target). Property dependencies are held by active observers or captured render frames; released historical keys are reclaimed by garbage collection. Finalization timing is controlled by the JavaScript engine.

- TypeScript `private` fields compile to ordinary properties and are supported. JavaScript `#private` slots initialized after `super()` are branded on the canonical service proxy, so ordinary service methods can use them as implementation details. Their mutations are unobservable; a cached getter backed only by private slots will not invalidate. Foreign branded objects and additional external proxies can still fail native brand checks.
- Canonical service and nested proxies are stable. A raw source object and its proxy have different identities. A raw object retained outside the framework can be mutated without notification; mutate through the service proxy instead.
- Plain objects and arrays are reactive. `Map`, `Set`, `Date`, promises, typed arrays, DOM objects, and custom nested class instances are opaque. Reassign the containing observable property when changes must be observed.
- Frozen or non-extensible objects are opaque. Freezing an already observed object can invalidate assumptions about observable mutations; prefer immutable opaque values and property reassignment.
- Changing object prototypes through Object.setPrototypeOf is unsupported and does not invalidate dependencies. Symbols and ordinary configurable properties follow proxy semantics. Nonconfigurable, nonwritable properties cannot always be wrapped without violating JavaScript proxy invariants.
- Methods bind `this` to the service proxy and have stable references. Explicitly rebinding such a method to a different object does not change its service receiver.
- Getter reads through `Reflect.get` or inheritance honor the supplied receiver without sharing its computed cache with the canonical service. Service methods remain bound to the canonical service even when first read through a different receiver.
- Getters must be pure synchronous computations. Avoid writes, resource acquisition, nondeterminism, and promises inside computed getters. Returning a mutable object does not turn its raw external aliases into observables.

## Lifecycle and scheduling

Constructors can run for an abandoned render. Keep them inert; only committed scopes initialize resources. Lifecycle hooks run once per activation, rather than once per object lifetime. Activity hiding releases resources; showing reinitializes the same stateful instances. Strict Mode immediate replay cancels deferred cleanup. Lifecycle hooks are synchronous: launch async work from `onInit` deliberately and cancel it from `onDispose`. The framework does not await lifecycle promises or automatically cancel fetches.

Computed source connections are released at the next core notification checkpoint (`flushSync()` or a microtask). This permits synchronous subscriber replacement without rebuilding a large graph. Public subscriptions stop delivering immediately when removed.

Reads after `await` do not belong to a previous synchronous observation. `batch(async () => ...)` does not create a transaction across suspension; use synchronous batches for related writes.

Notifications are coalesced, but React can retry or replay rendering. Render counters measure attempts; Strict Mode and concurrent rendering can add attempts. A guarantee of exactly one total render in every React scheduling scenario would be incorrect.

Provider registration tokens and mount-only configuration are fixed until remount; live `serviceInputs` values can change. An inline `initialState` array recreated on a parent rerender is a configuration change; store it stably or replace the provider with a new key. External scopes require explicit disposal by their owner. No global service registry is supplied.

Active child scopes retain ancestor resource lifetimes. Provider cleanup runs from dependents to dependencies, including across nested scopes. Explicit scope owners must dispose or release active children before calling a parent's terminal `dispose()`; premature disposal throws without changing ownership. `start()` retains manual ownership until disposal, while `acquire()` opts into lease-managed cleanup. If startup fails with active descendants, their cleanup can still use initialized dependencies; the failed scope rejects further resolution and finishes disposal after those descendants release it.

Nonterminal cleanup and rollback may resolve already constructed dependencies, but cannot construct, initialize, start, acquire or activate services. Terminal disposal rejects further scope resolution; existing injected references remain available during ordered cleanup. Reentrant terminal disposal during nonterminal cleanup/rollback is rejected before changing ownership; an already disposed scope still accepts repeated `dispose()` calls. These rules prevent cleanup callbacks from resurrecting resources or disposing dependencies before a dependent finishes cleanup.

## Server boundaries

SSR does not execute resource initialization. Server requests must use separate scopes. The client reconstructs instances from explicit serializable initial data; it never adopts the server's live objects. Protect secrets and validate data in application code. Service methods are not Next.js Server Actions, and class instances cannot cross the React Server Component serialization boundary.

The Next.js 16 adapter keeps SWC enabled with Webpack or Turbopack and uses a Babel parser prepass only for tracking instrumentation. A native SWC WASM plugin and automatic JavaScript private-field transformation are not provided. Remove project-level Babel configuration to use SWC. Other Next major versions are not verified.

## External inputs

Input bindings accept public writable string fields, including callback fields. Prototype methods, getters, lifecycle hooks, TypeScript readonly properties, and undeclared runtime fields cannot be inputs. TypeScript cannot distinguish a method signature from a callable property structurally, so the prototype-versus-own-field restriction is checked at runtime. Nested input data is borrowed as immutable, opaque values: the supplied object identity is preserved and replacing the bound field is observable. Mutating a nested input in place is unsupported and does not notify consumers. Ordinary service-owned objects and arrays remain deeply reactive. Explicitly supplied canonical framework proxies retain their reactive identity; prefer dependency injection for service-to-service state. No React state library dependency is required. Changes flow into the service; writing a bound property does not update the source. A later provider commit reasserts supplied values. Omission preserves previous values; explicit undefined clears only fields whose type allows undefined.

Initial input fields are applied after the service's own constructor, but before dependent construction, `onInit`, and consumer reads. Use `onInit` rather than the service's own constructor for initialization that requires external inputs. Incoming updates publish only from committed React work. Externally supplied scopes need explicit initial seeding for server/first-render values. Layout effects that close over values from the earlier render can still refer to that earlier snapshot; no atomic transaction between separate libraries is promised.

Suspense for incoming data must be owned by the source hook before it produces provider bindings. Do not suspend a consumer based on an old service input whose replacement requires that same pending provider commit: that creates a commit dependency cycle. Render loading UI from synchronized fields, or let the source library suspend before the provider receives values. Commit-only synchronization cannot offer speculative input reads during render while preserving a shared canonical service instance.

Inside core services, supplied callbacks retain their original identity and ordinary JavaScript receiver behavior. React consumers receive stable callable wrappers, with protected results. `service.callback()` naturally uses the service as the call receiver; detaching it does not force a receiver. Use an arrow function or an already bound callback when a source API requires its own receiver. Existing service methods remain bound to their service. Captured old callbacks do not become live delegates; service methods that access the callback field read the current committed function. Stable callbacks hiding mutable external state do not automatically invalidate cached getters. Callback invocation must respect the source hook's calling rules; callbacks must not trigger commands or state updates during rendering.

Callbacks are not JSON hydration data. Construct ordinary callback bindings inside a Next.js client boundary rather than trying to serialize arbitrary functions from the server.

For tested draft reconciliation, optimistic saves, cancellation, and stale-result handling, see [API workflows](API-WORKFLOWS.md). Async ownership is an explicit application policy, not automatic cancellation of arbitrary service methods.


## Compiled receiving components

Enable `reactiveProps: true` in the Vite/compiler options to compile ordinary receiving components as well as direct service consumers. Use `reactiveProps: 'client'` in Next.js adapter options and put `'use client'` in modules containing receiving components. Receivers can then read live readonly views or invoke synchronous render callbacks; their own render frame collects those reads. The imported child does not need to call useService or add an observer wrapper. See [component composition](COMPOSITION.md).

This mode reserves PascalCase function bindings and default function exports in selected source for React components. Keep ordinary non-component utilities outside that convention. Whole-parameter defaults/rest must move into the body so reads happen after frame creation; context-free literal defaults inside destructuring are supported, while lexical/callback defaults, computed parameter keys referencing component parameters/body bindings, and body-function shadowing of parameters are diagnosed to preserve scope; declare component variables in their own statements. Mutable/member JSX targets, arbitrary HOCs and uncompiled third-party receivers remain guarded. Compiler-declared memo/forwardRef relationships preserve the identity of the actual wrapper. Async render callbacks are unsupported.

The exact module directive `'use no service tracking'` excludes infrastructure modules from props-mode expansion. It does not disable normal tracking/diagnostics for explicit useService consumers. Runtime client modules carry this directive so Next.js transpilePackages cannot instrument the framework's provider internals.
