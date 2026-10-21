# Maintaining the framework

The public API is defined by each package entry point. Runtime implementation modules are private even though source and declarations ship in the tarballs. Keep imports within a package directed at the owning module, rather than routing them back through the public barrel.

## Module ownership

| Package | Module | Responsibility |
| --- | --- | --- |
| core | `scheduler.ts` | One notification queue, synchronous batch depth, delivery/error aggregation |
| core | `dependencies.ts` | Synchronous collection stack, property atoms, computed caching and dependency connections |
| core | `computed-graph.ts` | Private reusable dependency records, generation membership and incremental connection maintenance |
| core | `reactive.ts`, `array-iteration.ts` | Canonical proxies, lazy target metadata, descriptor/array traps, method binding and native sequence tracking |
| core | `service.ts` | Base class, constructor contracts, typed dependency tuples |
| core | `inputs.ts` | Typed external bindings and input-field validation |
| core | `scope.ts` | Resolution, ancestor ownership, initialization, activation, disposal |
| core | `observe.ts` | Standalone tracked effects and their cleanup |
| react | `context.ts`, `types.ts` | Shared resolution context and public provider contracts |
| react | `provider.tsx` | Fixed scope configuration, ownership and React lifecycle leases |
| react | `input-commit.tsx` | Commit-only external input publication |
| react | `use-service.ts` | Context resolution and committed service activation |
| react | `component-tracking.ts` | Weak receiver/wrapper registry for compiled component boundaries |
| react | `render-frame.ts` | Per-attempt dependencies, iteration and immutable snapshot tokens |
| react | `use-render-frame.ts` | Supported external-store Hook integration |
| compiler | `plugin.ts` | Transformation orchestration and configuration |
| compiler | `imports.ts`, `discovery.ts` | Import facts and complete component-owner discovery before mutation |
| compiler | `context.ts`, `component.ts` | Read-only/mutable pass contracts, component preparation and frame installation |
| compiler | `analysis.ts` | Ordered binding analysis, validation and boundary rewriting |
| compiler | `binding-analysis.ts`, `service-validation.ts` | Fixed-point binding discovery and read-only service/memo diagnostics |
| compiler | `business-calls.ts` | Hook-shaped service method normalization with binding-aware alias handling |
| compiler | `component-boundaries.ts`, `boundary-callbacks.ts`, `react-calls.ts`, `callback-analysis.ts` | JSX/factory guards, callback capture certificates, import-aware React recognition and deferred-callback diagnostics |
| compiler | `prop-components.ts`, `wrapper-components.ts` | Optional receiving-component discovery and private identity registration |
| compiler | `instrumentation.ts`, `read-collection.ts` | Syntax visitor policy, synchronous read wrapping and receiver/chain semantics |
| compiler | `patterns.ts`, `iteration.ts` | Destructuring collection, loop-header safety and scope-preserving lowering |
| compiler | `ast.ts` | Shared nested-owner, Hook and write-target syntax predicates |
| compiler | `vite.ts` | Vite adapter and source-map forwarding |
| benchmarks | `browser/model.ts` | Shared data, domain operations and independent reference outputs |
| benchmarks | `browser/adapters.tsx` | Library-specific state and React integrations |
| benchmarks | `browser/runner.tsx` | Identical scheduling, measurement and correctness checks |
| benchmarks | `report/` | Statistics, serialization, presentation metadata, Markdown, HTML, browser behavior and CSS |

`react/internal.ts` is the compiler/runtime protocol entry point. Preserve its export names and client boundary, and keep compiler/runtime versions aligned. It is not an application API.

## Invariants to preserve

- Scheduling and dependency collection each have one owner. Duplicating queues or collectors across modules breaks notification ordering and nested computations.
- Every service and nested observable object has one canonical proxy. Plain external inputs are immutable borrowed references observed at their bound field; this ownership boundary must not affect locally owned nested state. Proxy caches belong to the reactive module.
- Core has no React dependency. Compiler source never imports runtime services; generated import strings are its protocol with the React package.
- Frames belong to render attempts. Dependencies become subscriptions only through React's external-store lifecycle. An abandoned render must not replace committed subscriptions.
- Constructors remain inert. Commit effects acquire resources, dependencies initialize before dependents, and cleanup reverses ownership order.
- Live inputs publish after commit. Initial input seeding and subsequent input publication have distinct owners.
- Compiler discovery, analysis, diagnostics, identifier allocation and visitor ordering are observable behavior. An extraction must preserve generated code and diagnostic priority.
- Benchmark adapters implement the same domain operation. Scheduling and reference validation stay outside adapters. Keep timing data separate from report rendering.
- Report client code is self-contained because the HTML writer embeds its function source for offline use. Pass its inputs explicitly; do not add hidden module dependencies inside that function. All embedded data goes through the centralized JSON escaping helper.

## Verification workflow

```sh
npm run format:check
npm run check:boundaries
npm run typecheck
npm test
npm run check:hooks
npm run bench:test
npm run bench:typecheck
npm run bench:smoke
npm run test:packages
npm run test:load
```

`check:boundaries` checks source dependency direction, runtime import cycles, declared package dependencies and thin public entry points. Its fixture tests verify that architectural violations are detected. Formatting uses the locked Prettier version and the root configuration.

Use `npm run test:matrix` after changes to tracking, subscriptions, scopes or lifecycle. It swaps React versions temporarily and restores the lockfile installation; do not run other checks concurrently with it. Packed-consumer verification exercises ESM exports, declaration resolution, generated imports and SSR in clean projects on both React majors. Build and browser-test both examples after moving runtime modules or changing client boundaries.

Benchmark smoke checks verify source adapters and a freshly generated report without overwriting recorded performance data. A full timed benchmark is useful after behavior/performance changes and should run without competing checks. Formatting and module extraction alone do not justify replacing historical measurements.

## Follow-up work

This restructuring preserves existing behavior. Verified fixes and remaining composition, collection-cost and external-input boundaries are tracked in [the audit](AUDIT.md). Keep those fixes separate so each can carry focused regression tests and measured evidence.

For compiler pass contracts, extension guidance and characterization review, see [maintaining the compiler](COMPILER.md).

`test:load:long` runs the extended real-GC and React mount-cycle checks. These require explicit event-loop turns because WeakRef targets remain alive within a job. Retained-heap budgets complement deterministic watcher, lifecycle and released-object assertions; they do not establish peak-memory bounds. Run load checks before an isolated timing benchmark.
