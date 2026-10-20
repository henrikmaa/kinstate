# Architecture

For source-module ownership, dependency rules, and verification commands, see [Maintaining the framework](MAINTAINING.md).

## Why a compiler is required

A hook cannot ordinarily see arbitrary property reads made after it returns. Returning a proxy from `useService` alone does not establish a safe render lifetime. A global current-component flag also fails when React abandons, suspends, or interleaves work.

The runtime-only approach was therefore rejected for React consumption. Runtime proxies remain appropriate for the React-independent core. The compiler supplies the missing boundary while preserving the authored `useService(ServiceClass)` API.

Each component render attempt gets an explicit local `RenderFrame` and a `useSyncExternalStore` subscription. Instrumented reads call that frame synchronously. The compiler finishes the frame after evaluating the return expression. Event handlers and effects execute after the frame closes and do not add rendering dependencies. No frame lives in global mutable render state. Core uses a synchronous stack for nested dependency collection; it never spans hooks or `await`.

A frame stores the observed dependency versions and exposes cached immutable snapshot tokens. Snapshot validation rechecks versions. React installs that attempt's subscriptions through its external-store lifecycle; abandoned renders cannot replace committed dependencies. Post-render checks detect changes between evaluation and subscription installation. Each subsequent render builds fresh dependencies, so conditional reads lose obsolete subscriptions on commit.

Collection publishes reads to the attempt in a `finally` checkpoint, including reads before a getter or helper throws. A component that catches the exception and renders fallback UI therefore remains subscribed and can recover. Earliest observed versions remain intact, and nested collectors restore their parent without importing reads from an older accumulated destination.

The compiler instruments property access, synchronous calls, membership, destructuring, and collection iteration. It preserves method receivers and expression evaluation order. Generated code retains hooks at component scope and opts out of React Compiler memoization with `use no memo`. Custom component boundaries validate evaluated primitive/plain values and command callbacks while rejecting live observable object escapes and hidden render callbacks. Source maps are emitted. Compiler checks reject patterns that could conceal dependencies rather than falling back to subscribing to the whole service.

## Reactive engine

The `Service` base constructor returns the canonical proxy. WeakMap caches preserve the proxy identity of nested plain objects and arrays. Weak property registries track values and existence; a separate atom tracks key iteration. Unobserved reads and writes do not allocate property nodes. Active subscribers and captured dependency maps keep nodes alive, preserving version identity through delete/reinsert/subscription races; identity-checked finalization reclaims released historical keys. Assignments and definitions compare with `Object.is`; array operations also invalidate affected indices, length, and enumeration dependencies.

Computed getters collect their own dependencies, cache results, detect cycles, and change their observable version only when their result changes. A private graph reuses version records across evaluations: generation marks identify retained dependencies, new edges attach once, and missing edges detach. Public capture maps remain independent. A mutation checkpoint avoids repeated dependency validation within an unchanged epoch; connected clean computations also skip source scans after unrelated writes. Detached computed nodes validate versions lazily. Ordinary atoms capture a version once per collection; computed atoms validate every read so intervening writes remain observable. Dependencies propagate invalidation without cloning entire state trees.

Proxy traps share one handler prototype while each target retains its own state and descriptor classifications. A weak registry maps both raw targets and canonical proxies to their handler, preserving canonical identity with one lookup. These changes reduce per-row function allocation during full collection replacement. Reads retain `Reflect.get` receiver semantics, and descriptor changes evict cached classifications; no raw-value caching bypasses reactivity.

Service methods are cached and bound to the canonical proxy. Own fields supplied as inputs are marked in per-target metadata; callback reads return the original supplied function instead of a method wrapper. The first transition from an ordinary bound function field to an external callback invalidates its atom even when the raw function is unchanged, because the observable function identity changes. Synchronous method mutations enter a batch, including nested method calls. Observer notifications are deduplicated in a microtask. Async methods remain reactive after `await`, but each resumed synchronous segment is a separate notification opportunity. React still controls scheduling and may perform additional render attempts.

## Scope and lifecycle ownership

`ServiceScope` owns instances it constructs. `get(Class)` resolves constructor dependencies from `static inject = dependencies(...)`; explicit registrations override ancestors. Dependencies without an ancestor owner are created locally. Resolution reports cycles. Initial state is applied before initialization.

`start()` initializes declared services once per activation in dependency order. Ordinary Node resolution in an active scope initializes new services immediately. React uses deferred resolution during render and activates only the committed consumer's dependency graph in an effect. Suspended implicit services remain inert even when unrelated consumers commit. `dispose()` is idempotent, releases initialized services in reverse construction order, and aggregates cleanup errors. Startup failure cleans up initialized resources. Constructors must avoid resource acquisition because React can discard constructed instances before commit.

A provider uses one scope for its mounted lifetime. Its commit effect acquires a lease; releasing the last lease queues resource deactivation in a microtask. Strict Mode reacquisition cancels pending deactivation. React Activity can hide a subtree long enough to deactivate it, then show it again: the same instances retain state and receive another `onInit` after their prior `onDispose`. There is no duplicate initialization within an activation. Unmounted inert scopes can be garbage collected; explicit `scope.dispose()` is terminal and clears instances. Changing registration token order, initial-state identity, parent scope, or external scope requires a new provider key. Live `serviceInputs` values and supplied keys can change without remounting.

An external provider scope is started but never disposed by React. Its owner must call `dispose()`. `createService` is a convenience for inert stateful instances; use an explicit scope for lifecycle resources.

Active child scopes retain transitive ancestor lifetimes. Deferred resource deactivation waits for children, preserving dependent-first cleanup across nested providers. Explicit owners must release or dispose active children before terminal parent disposal. A startup failure with active descendants preserves resources needed by their cleanup and completes terminal disposal once they release the failed scope. Cleanup can read already constructed dependencies but cannot create or initialize services, activate resources, or recursively dispose an active scope; already-terminal disposal remains idempotent.

## External React state inputs

`serviceInputs(Class, values)` produces a typed, frozen shallow snapshot; nested data retains its reference. Provider registrations accept either a constructor or a binding. Normalized constructor tokens are fixed for the mount. Duplicate registrations are errors; changing values does not replace the scope or service instances.

Owned scopes cache initial bindings and apply them after hydration state during inert instance construction. Consumers and `onInit` see these inputs immediately. A committed input component preceding consumers applies subsequent snapshots in a layout effect, batches writes and drains core notifications. If values change it also schedules a local layout update, ensuring first-consumer external-store consistency checks run before paint. It never updates an existing scope during render. Abandoned work cannot publish inputs.

This is a commit synchronization boundary, not a transaction spanning an arbitrary React library and the service graph. A render attempt can observe the prior committed service snapshot; consumers can need a synchronous follow-up render. Do not rely on independent stores becoming atomic or on render-attempt counters remaining unchanged when their React parents rerender. Core input updates preserve omitted fields and expose a boolean indicating whether values changed.

Initial inputs on an externally owned scope must be preseeded by its owner for SSR/initial-render consistency; the provider applies its subsequent bindings only after commit. Inputs require local ownership, preventing child bindings from mutating ancestor services. Frozen external data works without cloning. Incoming-data Suspense belongs in the source hook before producing bindings; consumer suspension must not wait for the same commit that would replace an old service input. Own writable callback fields are supported by the same binding and update rules; prototype methods and lifecycle hooks are protected. External plain objects are borrowed opaquely below the bound field, so immutable API payloads preserve identity and avoid proxy traversal overhead. Replacing the field remains tracked; explicitly supplied framework proxies retain their tracking. Inputs are one-way, externally owned state; source updates and API mutations remain the application's responsibility.

## SSR, hydration, and Next.js

Create one scope per server request. Do not store mutable service instances at module scope. Server rendering resolves inert instances without running `onInit`; scope disposal does not run resource cleanup for never-initialized instances.

```tsx
const scope = new ServiceScope([CounterService]);
try {
  scope.get(CounterService).count = requestCount;
  return renderToString(
    <ServiceProvider services={[CounterService]} scope={scope}>
      <Counter />
    </ServiceProvider>,
  );
} finally {
  scope.dispose();
}
```

Transfer an explicit allowlist of JSON-safe values to a fresh client provider:

```tsx
const initialState = [{ service: CounterService, state: { count: requestCount } }];
hydrateRoot(container,
  <ServiceProvider services={[CounterService]} initialState={initialState}>
    <Counter />
  </ServiceProvider>,
);
```

The server's markup and client's initial values must match. Do not serialize proxies, classes, secrets, lifecycle handles, or arbitrary request objects. The caller owns JSON serialization and validation. Client providers apply initial state before reads and initialize resources after hydration commits.

For Next.js App Router, keep service providers and consumers in a `'use client'` module. Server Components pass serializable initial data to that boundary; construct the `initialState` descriptor with its class token inside the client module and keep its identity stable. The example uses the Babel transformation with Next.js 16 Turbopack or webpack:

```json
{"presets":["next/babel"],"plugins":[["module:@kinstate/compiler",{"reactiveProps":"client"}]]}
```

Run `next dev --turbopack` and `next build --turbopack`, or select the webpack scripts. The included Next configuration transpiles the runtime packages. Runtime infrastructure opts out of props-mode expansion with its module directive; source service consumers retain normal tracking.

## Package boundaries

`@kinstate/core` has no React dependency. `@kinstate/react` depends on core and declares React as a peer. `@kinstate/compiler` provides Babel instrumentation and an optional Vite adapter. The `/internal` React export is a compiler/runtime protocol, not an application integration API; keep compiler and runtime versions aligned.


## Receiving-component frames and collection graphs

The optional reactiveProps pass discovers ordinary receiving components before transformation, instruments their actual reads, and registers their function identity through a private weak registry. Boundary guards allow live values only when the receiver is registered. Compiler-declared React memo/forwardRef relationships can link a wrapper to its registered implementation without inspecting React internals. Registration does not add a public component wrapper or replace canonical service identities. A render callback invoked by a receiving component executes within that receiver's explicit collection call, rather than trying to reopen its parent's finished frame.

Intrinsic array map/filter traversals collect a sequence atom for index/existence reads while their callbacks retain individual field dependencies. A transient view delegates accessors and non-index reads to the canonical receiver and keeps native holes, species, receiver and mutation semantics. Manual indexed consumers keep their own property atoms. Descriptor classification caches are invalidated by property traps. Computed source edges survive synchronous unsubscribe/resubscribe replacement and disconnect at the shared queue checkpoint when truly unobserved. Captured render versions and public subscription cancellation retain their previous semantics.
