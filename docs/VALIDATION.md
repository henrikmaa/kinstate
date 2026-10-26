# Validation record

## 2026-10-26: owned state and memo subscriptions

Verified on Node.js 24.16.0, Linux x64. Consumer syntax remains `useService(ServiceClass)`; no new wrappers, selectors, or array APIs were introduced.

| Check | Result |
|---|---|
| React 19.3.1 | 611 unit/compiler/integration tests passed |
| React 18.3.1 | 610 passed; one Activity-only test skipped |
| TypeScript, Hooks, boundaries, formatting | Passed; the 22 benchmark harness tests also passed |
| Clean packed consumers | React 18/19 declarations, runtime, SSR, imported receivers, and Next.js Webpack + SWC passed |
| Clean Git consumers | Core without React, React 18/19, lockfile reinstall, SSR, adapters, and Next.js Webpack + SWC passed |
| Production examples | Vite and Next.js Turbopack builds passed; four browser tests passed, including hydration, request isolation, inputs, callbacks, and selective rendering |
| Full production-browser comparison | 57 cases × 4 libraries = 228 validated comparisons, five measured blocks, two warmups, five updates per sample |
| Performance certification | **Not established.** Diagnostic block counts and short samples do not satisfy the statistical release gate; large computed and memoized array operations remain slower than MobX |

The owned-state tests cover publication-local aliases/cycles, source isolation, independent hydration scopes, callbacks, canonical DI sharing, reflection, pinned descriptors, opaque custom classes and deep iterative copies. A full benchmark exposed repeated frozen-array scans; a regression now verifies reads do not repeat that scan while sealed mutable copies remain reactive.

Memo results retain their own captured versions through a single aggregate dependency, while committed caches own leaf subscriptions. Tests cover subscription reuse, mixed batches, errors, races, Strict Mode, abandoned transitions and unmount cleanup. The private readonly reader shortcut is restricted to canonical owned/service state; borrowed and foreign proxies retain their invariant checks.

See the [complete diagnostic charts and raw samples](../benchmarks/diagnostics/current/report.html) and [methodology](../benchmarks/diagnostics/README.md). Historical records below describe their original code and dates.

## Earlier verification

Earlier targeted verification: 2026-10-21 with Node.js 24.16.0 and 22.23.3, npm 11.13.0, Linux x64. The earlier load and benchmark records below were captured on 2026-10-20.

The framework is now named **Kinstate — Ordinary classes. Reactive state.** Public packages, compiler defaults, workspace imports, examples and clean consumer checks use `@kinstate`. The frozen pre-maintenance compiler corpus retains its original import alias and filenames to preserve source-map evidence. Recorded benchmark JSON retains its original identifiers, samples and timestamps; regenerated reports display Kinstate, and new runs use the `kinstate` identifier. Branding does not represent a new timing measurement.

The Rspress 2.0.23 documentation site builds 21 static pages including the 404 page. Its 15 guides and 3 API references include usage examples; the live demonstration is compiled with Kinstate. Production browser checks cover independent live-example renders, local search, refreshed deep links, mobile navigation, homepage overflow and forced dark mode under a light system preference. Static output checks verify internal links and assets under `/kinstate/`; test builds use an isolated output directory. The GitHub Pages workflow verifies builds before deployment and skips publishing until Pages is configured to use Actions.

The initial Next verification used `next/babel`, which disabled SWC and did **not** establish SWC compatibility. The replacement `@kinstate/compiler/next` adapter runs instrumentation before Next's SWC pipeline. The maintained example no longer contains a Babel config. A clean packed Next/Webpack consumer builds with the emitted loader, local font and legacy TypeScript decorator syntax; normal core/React declaration checks retain `skipLibCheck: false`, while the isolated Next application uses Next's generated TypeScript configuration. This checks the adapter against normal Next consumption without treating Next's own declaration errors as Kinstate declarations.

New regressions cover hook-shaped method aliases through `satisfies`/instantiation/parentheses, computed parameter-key lexical scope, and service normalization of committed React inputs. Unsafe parameter keys receive a precise compile diagnostic; safe literal/outer-scope keys keep their behavior. Input bridge refreshes no longer reassert the same snapshot and cause a layout loop; later source-value changes publish new values; unchanged sources preserve service normalization and local edits.

| Check | Result |
|---|---|
| TypeScript package builds and test type assertions | Passed |
| Maintainability refactor | Public exports preserved; 32 compiler transformations/diagnostics matched the baseline before the subsequent correctness fixes; independent React/core boundary review passed |
| Compiler maintenance | Explicit pass contracts and syntax ownership; 39 pre-refactor code/source-map/diagnostic characterizations match; independent review passed |
| Architecture and formatting checks | Acyclic package graph, thin entry points, declared dependencies, locked formatting; 12 architecture fixture tests passed |
| React 19.3.1 unit/compiler/integration tests | 451 passed |
| React 18.3.1 unit/compiler/integration tests | 450 passed, Activity test skipped because that API is unavailable |
| Real garbage-collection regression probes | Released observed keys reclaimed; captured dependencies and active observers retained; unreachable source graphs collected |
| Sustained load | 900 scopes, 900,000 historical keys, 1,000 Strict Mode mount cycles; zero active observers, balanced lifecycle cleanup, 64,888 bytes retained growth over eight checkpoints |
| Generated component Rules of Hooks lint | Passed for service consumers, anonymous wrappers and six receiving-component forms |
| Clean packed consumers on React 18.3.1 and 19.3.1 | Imports, declarations, compiler, core observations, SSR and imported compiled receivers/render callbacks passed |
| Vite production build | Passed |
| Next.js 16.4.2 App Router Turbopack and Webpack with SWC | Clean production builds and hydration/request-isolation/selective-render browser checks pass; development hydration/selectivity/Fast Refresh preserving service state pass on both bundlers; next/font/local guards against Babel fallback |
| Chromium browser tests | 4 passed: independent renders/async/arrays/responsive layout, hydration/request isolation, generic external inputs/callbacks preserving local draft, imported live props and render callbacks |
| Comparative benchmark scenarios | 188 production Chromium comparisons: four libraries, 22 workloads, up to 50,000 rows; 940 measured samples plus 376 warmups, 10 operations per sample |
| npm dependency audit | Zero reported vulnerabilities |

Commands and scripts are in the root package manifest. `npm run test:matrix` restores the locked dependency graph after testing both React versions. The browser suite uses ports 4273 and 4274. The preceding 352-test suite also passed locally on Node.js 22.23.3; the readonly ownership additions were verified locally on Node.js 24.16.0. CI covers both supported Node majors.

The desktop and mobile Vite layouts were also inspected visually. Browser tests check console/page errors and hydration recovery. Benchmark results use repeated production Chromium measurements with render counters, complete backing-state/output checks, and an independent fairness review. See [interactive charts](../benchmarks/report.html), [methodology](../benchmarks/README.md), and [tables/raw sample context](../benchmarks/RESULTS.md). Seven report/statistics tests, strict benchmark type checking, and 88 production adapter smoke checks pass. The report filters, raw JSON download, metric direction labels, and desktop/mobile layout are browser-verified. These checks establish the scenarios tested, not a guarantee for all JavaScript patterns or React scheduling cases. Read [limitations](LIMITATIONS.md) before integration.

Generic input tests cover props, local state, context/custom hooks, explicit clearing, Object.is suppression, batched updates, cross-service computed values, scope isolation, Strict Mode, hydration, and committed/abandoned transitions. Source-hook Suspense before producing bindings is tested; input-driven commit cycles are explicitly unsupported.

Callback tests additionally verify exact function identity, initial availability, latest committed closures, unchanged callback suppression, optional clearing, promise/result/error propagation, ordinary receiver behavior, prototype/lifecycle protection, and abandonment safety. Public packed-consumer tests verify callback argument inference and invocation on both React majors.

Production regression coverage includes optional-chain semantics, destructuring and iteration scope, tagged templates, anonymous React wrappers, controlled custom-component props, imperative refs on both React majors, immutable input identity, computed subscription retention, and repeated property churn. The maintained API editor recipe has nine tests for drafts, conflicts, optimistic rollback, cancellation, callback replacement, stale responses and lifecycle reactivation. See [hardening record](AUDIT.md).

The recorded timing run uses five samples, two warmups and ten operations per sample, with all 188 comparisons passing independent state/output validation. Large mutable 50k-row derivations remain expensive (about 100 ms/op in the filtering/sorting case); immutable API inputs measure about 7.6 ms/op in their separate payload-and-filter case. These are different workloads, not a controlled speedup ratio. Detailed before/after measurements and remaining performance limits are in the [hardening record](AUDIT.md).

The extended load artifact is [production-load-long.json](validation/production-load-long.json). It measures forced-GC retained heap, with explicit event-loop turns, not peak allocation or an interactive latency budget. It combines deterministic released-object/watcher assertions with a bounded heap-growth check. A real Zustand-backed input workflow also verifies rapid publications, React callback replacement and preserved local drafts after commit.

The current framework suite contains 451 tests across the core, compiler, React integration and regressions. The recorded full benchmark contains 188 passing comparisons/940 samples using unchanged five-sample settings; the previous collection and full-array runs are archived separately for interpretation.

Full-array regression tests cover persistent computed graph membership, dynamic and throwing branches, computed equality chains, writes during evaluation, detached lazy validation, public capture independence, earliest-version retention and repeated computed reads after writes. A foreign-proxy receiver regression preserves native get behavior. Shared handler methods and a weak canonical registry reduce allocation without introducing value caches or changing class identities.

Additional production regressions cover dependent-first cleanup across nested scopes, partial startup failure with active descendants, explicit ownership, activation rollback, borrowed getter receivers, stable method binding, descriptor pinning, Hook-shaped business methods and their aliases, computed keys, shadowed React imports, and diagnostics for returns crossing finally. The extended load artifact was rerun after the scope lifetime fixes.

Exception-path regressions verify selective recovery after locally caught getter/helper errors, falsy thrown values, subscription-time validation and collector restoration without historical dependency propagation. Capturing function-declaration callbacks receive the same boundary checks as arrows. Cleanup reentrancy tests prevent resource resurrection and premature dependency disposal while preserving existing dependency reads and terminal disposal idempotence.

Readonly consumer regressions verify the reported getter-result assignment, events, nested arrays, reflective mutation attempts, frozen data, callback/iterator values, sync/async method results, command argument normalization, native method/accessor spoofing and stable view identities. Caller-owned filter/map copies remain mutable while references to source state stay protected. Standard cleanup/load checks passed with balanced lifecycle, zero active observers and bounded retained heap; 88 production benchmark adapter smoke checks passed. Archived comparative timings predate this ownership boundary and are not current performance claims.

Callback-boundary regressions cover uncompiled chart/table configurations, hook setter adapters, primitive snapshot closures, `useCallback`/`useMemo`, method receivers, callback identity, selective render counts, async aliases, mutable-container escapes and shadowed declaration captures. The 34 focused callback-boundary tests pass. Clean packed consumers also compile and render a snapshot formatter through an uncompiled component. Local object/array/helper-function captures remain explicitly guarded.

Git distribution verification now covers real Git commits rather than only packed workspace tarballs: clean core-only installation without React, React 18.3.1/19.3.1 installs followed by `npm ci`, strict core/React/compiler declarations, compiled SSR, matching Vite/Next defaults and a Next.js 16.4.2 Webpack/SWC build. Bundled scoped packages contain actual built files, application React resolves once, and development/example trees are excluded. At that Git-distribution checkpoint, the framework suite had 404 passing tests; scoped packed-consumer and documentation checks also passed. Adapter regression checks include explicit `importSource: undefined` and custom aliases. These Git checks use npm; other package managers and script-disabled installs are not claimed.

The latest production audit adds constructor projection/Memo regressions, genuine React dispatch provenance after service-derived initialization, weak consumer callback ownership, lazy readonly payload boundaries and symbol-keyed callback validation. In the real-GC regression, all 500 removed closures are collected while their source and consumer remain alive. Constructor reads update selectively; legacy compiler mode diagnoses attempts to hide them in `useMemo` through an argument, a local class initializer or a class alias. Receiving-component mode now uses dependency-aware memo instrumentation; its runtime regressions are separate from those legacy diagnostic cases.

The current extended load artifact is [production-hardening-load-2026-10-21.json](validation/production-hardening-load-2026-10-21.json): 900 scope cycles, 900,000 historical keys, 1,000 Strict Mode mount cycles, zero remaining observers, balanced initialization/disposal, and 55,320 bytes retained growth across eight forced-GC checkpoints (16 MiB budget). This is retained heap evidence, not peak allocation or comparative timing. The earlier load/benchmark artifacts remain historical records.

The drawDB integration audit adds ten async/generator destructuring regressions and nine UI-library default-callback regressions. The complete package workflow passes on commit `a5f1942`, including Node 22/24 with both React majors, clean packed/Git consumers, Next.js SWC production/development checks, browser tests, load checks and benchmark adapter checks. The separate local drawDB migration passes 36 service/React tests, full lint, production build, and two production browser workflows covering editing, history, storage reload and cross-service entities/viewport controls. It retains the upstream AGPL license and is not bundled into Kinstate's MIT packages.
