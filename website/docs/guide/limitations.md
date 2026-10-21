# Supported boundaries

Kinstate provides an ordinary class API within explicit JavaScript, compiler and React boundaries. Review these before designing a feature around unusual object types or cross-library synchronization.

## Read-only React consumers

`useService` returns a read-only service view. Change state through service commands, including in event handlers. Fields, getters and nested data have deeply read-only types. Method signatures preserve generic and overloaded inference, so method return types can appear mutable; returned objects are still protected at runtime. Callback and promise wrappers have stable identities distinct from the original functions and promises. Opaque nested instance methods are blocked through views; expose a service command for those operations.

## Classes and owned data

Service-owned plain objects and arrays are deeply reactive. `Map`, `Set`, `Date`, promises, typed arrays, DOM objects, frozen/non-extensible objects and custom nested class instances are opaque. Replace their containing property when a change must be observed.

TypeScript `private` properties behave as ordinary reactive fields. JavaScript `#private` slots can hold implementation details on the canonical service, but changes to those slots are unobservable. A getter backed only by such a slot does not invalidate. Foreign branded objects and additional proxies may fail native brand checks.

Raw objects and their proxies have different identities. Mutating a retained raw alias bypasses notification. Prototype changes are unsupported. Getters must be pure synchronous computations; do not fetch, mutate, acquire resources or read hidden nondeterministic state inside them.

## Compiler coverage

Call `useService` directly in a synchronous function component and assign its result to a local variable. Custom-hook wrappers, async/generator components and chained `useService(Class).field` consumption are unsupported. Compile tests and application source; distributed dependencies must be precompiled because `node_modules` is excluded.

Do not conceal reactive reads in React memoization or arbitrary escaped deferred helpers. Read primitive inputs before `useMemo`. A component return that crosses a `finally` block is diagnosed; return after the block or use a synchronous helper instead. Computed React namespace calls require direct named or dot access.

Live props and synchronous render callbacks require compiled receiving components in `reactiveProps` mode. Uncompiled third-party receivers need evaluated primitives or plain projections. Options may include ordinary callbacks and formatters capturing evaluated snapshots; callbacks retaining live reactive objects still need a compiled receiver. Captured component-local objects, arrays and helper functions remain guarded, even if currently plain; capture their required primitive fields directly. Reassigned captures and callbacks returned by opaque factories receiving reactive-derived arguments remain conservatively guarded. Mutable/member JSX targets, arbitrary HOCs and async render callbacks remain outside this supported boundary. Props mode reserves PascalCase function bindings and default function exports for components; some parameter defaults/rest forms need moving into the body. Computed parameter keys that reference component parameters or body bindings are diagnosed because lowering them would change lexical scope; literal keys and unshadowed outer keys are supported.

## Lifetimes and external state

Constructors can run for abandoned renders and must remain inert. Lifecycle hooks are synchronous and can repeat across activations. Async methods need application-owned cancellation and stale-result policies. A batch and an observation cover synchronous work, not execution after `await`.

Ordinary external object inputs are immutable borrowed values. Replace roots at their owner; nested mutation is not a signal. Later bindings publish only after commit, so there is no atomic transaction across unrelated React stores. Let the source hook own Suspense before supplying inputs; do not suspend on a replacement that itself requires the pending provider commit.

Provider configuration is fixed until remount. Keep initial state stable and replace the React key when changing configuration. Externally supplied scopes need explicit seeding and disposal. Server requests must not share mutable scopes, and callbacks belong inside client serialization boundaries.

## Performance and guarantees

Property-level subscriptions do not remove large-array scans, React parent renders, retries or Strict Mode replay. Heavy mutable derivations can remain expensive. Consult [performance](performance.md), [composition](react-composition.md) and [SSR](nextjs-and-ssr.md) for practical alternatives rather than bypassing a diagnostic or assuming whole-service observation will repair a missing boundary.

Already-reactive Kinstate objects supplied as inputs retain their canonical identity and existing deep reactivity. Dependency injection is usually clearer for sharing state between services.
