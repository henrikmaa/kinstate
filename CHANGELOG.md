# Changelog

## Unreleased

- Adopt plain objects and arrays as service-owned copies without changing `useService`, service method, or provider binding syntax. Preserve aliases and cycles within a publication, canonical shared references, callback identities, descriptors, and frozen snapshots. Native/custom instances, including Array subclasses, remain opaque.
- Publish provider input fields only when their source values change by `Object.is`. Unchanged source references preserve local edits and normalization across parent renders; replacement references publish new copies. This replaces the earlier borrowed-input and reassert-on-every-commit behavior.
- Reuse owned-array reverse shape proofs while invalidating them on canonical structural or descriptor changes. Borrowed derived arrays retain per-call validation.
- Reduce compiled memo tracking allocations and reuse unchanged memo subscriptions while preserving abandoned-render and subscription-race validation.
- Add implicit memo boundaries for compiled receiving components, cancellable observation scheduling, and benchmark provenance and noninferiority checks with explicit inconclusive results.

## 0.1.0

- Preserve ordinary React `useMemo` caches with service/live-prop reads in receiving-component mode, replaying cached dependencies and invalidating observed versions through a private compiler/runtime hook. Commit-only metadata keeps speculative renders isolated; legacy-mode diagnostics remain unchanged.

- Reduced render tracking allocations with a private accumulating collector, scalar boundary fast paths, and reuse of validated transitively immutable data. Mutable configs, callback captures and native collections remain freshly validated.

- Fixed severe drawDB drag latency caused by callback validation traversing React element ownership graphs. Validate rendered props only, keep refs imperative, and retain nested callback safety checks without application memoization workarounds.

- Fixed integration defects found by migrating drawDB: preserve async/generator destructuring execution context, diagnose suspended pattern defaults/keys, and accept React-injected vendor function defaults through exact descriptor provenance without weakening authored callback guards.

- Closed production audit defects: track constructor projection reads; recognize React state/reducer dispatch initialized from service data; release removed callback closures from consumer caches; keep borrowed payload validation lazy; validate symbol-keyed callback metadata and readonly native props correctly.

- Added a Git-installable root `kinstate` distribution with native bundled workspace packages, build preparation, typed core/React/compiler entries and matching Vite/Next defaults. Clean Git-consumer checks cover lockfile reinstalls, React peers and real Next/Webpack/SWC builds.

- Relaxed third-party callback boundaries for primitive snapshot formatters and unrelated hook callbacks inside service-derived chart/table options. Preserved identities and method receivers, with conservative live/mutable capture guards and async/declaration-shadow regressions.

- Made React service consumers readonly: getter/nested state and arrays require service commands for mutation, with runtime protection for reflection, callbacks and async method results. Consumer views are stable and distinct from mutable core instances; command argument normalization and optimized array tracking preserve core ownership.
- Added SWC-preserving Next.js Webpack/Turbopack integration, fixed method-alias tracking and computed parameter-key scope, and stopped normalized input refresh loops.

- Added dark-only Rspress documentation with scenario guides, API references, local search, a live compiled service demo, the kingfisher mascot, production browser checks and GitHub Pages deployment.
- Named the framework Kinstate: “Ordinary classes. Reactive state.” Packages use the `@kinstate` scope, including compiler defaults, examples and installation instructions. Historical measurement data and compiler characterization fixtures retain their original identifiers.
- Reduced collection bookkeeping allocations with reusable computed edges, shared proxy-handler methods and a canonical weak registry; preserved per-render capture and computed read consistency.
- Retained render dependencies through locally caught getter/helper errors; closed function-declaration callback escapes and guarded failed activation cleanup against resource resurrection.
- Corrected nested-scope cleanup order and startup-failure rollback; added dependency lifetime holds across providers and explicit ownership checks.
- Fixed Hook-shaped business method tracking and shadowed React import recognition; diagnosed component returns crossing finally rather than dropping later reads.
- Isolated borrowed getter caches, stabilized canonical method receivers, and notified observers when descriptor invariants change exposed reference identity.
- Added compiler-assisted live props/render callbacks for compiled receivers, import-aware React wrapper registration, Next.js 16 Turbopack support, sustained-load checks, and generic external-store workflow verification.
- Reduced collection dependency overhead and computed reconnection work; corrected failed array-length truncation notifications with native semantics regressions.

- Separated compiler pass contracts, binding discovery, boundary guards and syntax transforms; preserved full code, source maps and diagnostics in 39 characterization programs, with compiler maintenance documentation.

- Fixed optional-chain, destructuring and tagged-call tracking; added safe UI component boundaries, normal effect/callback dependencies and memo/forwardRef consumers.
- Fixed historical property metadata retention with active/captured dependency ownership and GC regressions; reduced proxy metadata and computed validation work.
- External immutable input data retains its original identity and root-replacement tracking; added a tested async editor workflow and expanded collection/API benchmarks.

- Refactored core, React integration, compiler, and benchmarks into focused modules; added architecture guards, consistent formatting, and a maintainer guide while preserving public APIs and current behavior.

- Live inputs accept callback fields from React hooks, preserving function identity and updating closures only on commit, with protected prototype methods and lifecycle hooks.

- Added generic typed service input bindings for values from any React state source, with committed updates, initial seeding, and preserved local state.

- Class-based reactive services with nested state, computed getters, batching, and scoped dependency injection.
- Explicit compiler instrumentation for fine-grained React 18/19 subscriptions using documented external-store APIs.
- Vite and Next.js App Router examples, compatibility tests, browser verification, and comparative benchmarks.
- Compiler diagnostics and documented boundaries for unsupported service escapes, memoization, and opaque objects.
