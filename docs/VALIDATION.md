# Validation record

Verified locally on 2026-10-20 with Node.js 24.16.0 and 22.23.3, npm 11.13.0, Linux x64.

The framework is now named **Kinstate — Ordinary classes. Reactive state.** Public packages, compiler defaults, workspace imports, examples and clean consumer checks use `@kinstate`. The frozen pre-maintenance compiler corpus retains its original import alias and filenames to preserve source-map evidence. Recorded benchmark JSON retains its original identifiers, samples and timestamps; regenerated reports display Kinstate, and new runs use the `kinstate` identifier. Branding does not represent a new timing measurement.

The Rspress 2.0.23 documentation site builds 21 static pages including the 404 page. Its 15 guides and 3 API references have 34 code fences checked through the Kinstate compiler. Production browser checks cover independent live-example renders, local search, refreshed deep links, mobile navigation, homepage overflow and forced dark mode under a light system preference. Static output checks verify internal links and assets under `/kinstate/`; test builds use an isolated output directory. The GitHub Pages workflow verifies builds before deployment and skips publishing until Pages is configured to use Actions.

| Check | Result |
|---|---|
| TypeScript package builds and test type assertions | Passed |
| Maintainability refactor | Public exports preserved; 32 compiler transformations/diagnostics matched the baseline before the subsequent correctness fixes; independent React/core boundary review passed |
| Compiler maintenance | Explicit pass contracts and syntax ownership; 39 pre-refactor code/source-map/diagnostic characterizations match; independent review passed |
| Architecture and formatting checks | Acyclic package graph, thin entry points, declared dependencies, locked formatting; 12 architecture fixture tests passed |
| React 19.3.1 unit/compiler/integration tests | 332 passed |
| React 18.3.1 unit/compiler/integration tests | 331 passed, Activity test skipped because that API is unavailable |
| Real garbage-collection regression probes | Released observed keys reclaimed; captured dependencies and active observers retained; unreachable source graphs collected |
| Sustained load | 900 scopes, 900,000 historical keys, 1,000 Strict Mode mount cycles; zero active observers, balanced lifecycle cleanup, 64,888 bytes retained growth over eight checkpoints |
| Generated component Rules of Hooks lint | Passed for service consumers, anonymous wrappers and six receiving-component forms |
| Clean packed consumers on React 18.3.1 and 19.3.1 | Imports, declarations, compiler, core observations, SSR and imported compiled receivers/render callbacks passed |
| Vite production build | Passed |
| Next.js 16.4.2 App Router Turbopack and webpack production builds | Passed; hydration/request-isolation browser check passed against each; Turbopack development hydration/update smoke passed |
| Chromium browser tests | 4 passed: independent renders/async/arrays/responsive layout, hydration/request isolation, generic external inputs/callbacks preserving local draft, imported live props and render callbacks |
| Comparative benchmark scenarios | 188 production Chromium comparisons: four libraries, 22 workloads, up to 50,000 rows; 940 measured samples plus 376 warmups, 10 operations per sample |
| npm dependency audit | Zero reported vulnerabilities |

Commands and scripts are in the root package manifest. `npm run test:matrix` restores the locked dependency graph after testing both React versions. The browser suite uses ports 4273 and 4274. The complete 332-test suite also passed locally on Node.js 22.23.3. CI covers both supported Node majors.

The desktop and mobile Vite layouts were also inspected visually. Browser tests check console/page errors and hydration recovery. Benchmark results use repeated production Chromium measurements with render counters, complete backing-state/output checks, and an independent fairness review. See [interactive charts](../benchmarks/report.html), [methodology](../benchmarks/README.md), and [tables/raw sample context](../benchmarks/RESULTS.md). Seven report/statistics tests, strict benchmark type checking, and 88 production adapter smoke checks pass. The report filters, raw JSON download, metric direction labels, and desktop/mobile layout are browser-verified. These checks establish the scenarios tested, not a guarantee for all JavaScript patterns or React scheduling cases. Read [limitations](LIMITATIONS.md) before integration.

Generic input tests cover props, local state, context/custom hooks, explicit clearing, Object.is suppression, batched updates, cross-service computed values, scope isolation, Strict Mode, hydration, and committed/abandoned transitions. Source-hook Suspense before producing bindings is tested; input-driven commit cycles are explicitly unsupported.

Callback tests additionally verify exact function identity, initial availability, latest committed closures, unchanged callback suppression, optional clearing, promise/result/error propagation, ordinary receiver behavior, prototype/lifecycle protection, and abandonment safety. Public packed-consumer tests verify callback argument inference and invocation on both React majors.

Production regression coverage includes optional-chain semantics, destructuring and iteration scope, tagged templates, anonymous React wrappers, controlled custom-component props, imperative refs on both React majors, immutable input identity, computed subscription retention, and repeated property churn. The maintained API editor recipe has nine tests for drafts, conflicts, optimistic rollback, cancellation, callback replacement, stale responses and lifecycle reactivation. See [hardening record](AUDIT.md).

The recorded timing run uses five samples, two warmups and ten operations per sample, with all 188 comparisons passing independent state/output validation. Large mutable 50k-row derivations remain expensive (about 100 ms/op in the filtering/sorting case); immutable API inputs measure about 7.6 ms/op in their separate payload-and-filter case. These are different workloads, not a controlled speedup ratio. Detailed before/after measurements and remaining performance limits are in the [hardening record](AUDIT.md).

The extended load artifact is [production-load-long.json](validation/production-load-long.json). It measures forced-GC retained heap, with explicit event-loop turns, not peak allocation or an interactive latency budget. It combines deterministic released-object/watcher assertions with a bounded heap-growth check. A real Zustand-backed input workflow also verifies rapid publications, React callback replacement and preserved local drafts after commit.

The current suites contain 100 core tests, 147 compiler tests and 85 React integration tests. The recorded full benchmark contains 188 passing comparisons/940 samples using unchanged five-sample settings; the previous collection and full-array runs are archived separately for interpretation.

Full-array regression tests cover persistent computed graph membership, dynamic and throwing branches, computed equality chains, writes during evaluation, detached lazy validation, public capture independence, earliest-version retention and repeated computed reads after writes. A foreign-proxy receiver regression preserves native get behavior. Shared handler methods and a weak canonical registry reduce allocation without introducing value caches or changing class identities.

Additional production regressions cover dependent-first cleanup across nested scopes, partial startup failure with active descendants, explicit ownership, activation rollback, borrowed getter receivers, stable method binding, descriptor pinning, Hook-shaped business methods and their aliases, computed keys, shadowed React imports, and diagnostics for returns crossing finally. The extended load artifact was rerun after the scope lifetime fixes.

Exception-path regressions verify selective recovery after locally caught getter/helper errors, falsy thrown values, subscription-time validation and collector restoration without historical dependency propagation. Capturing function-declaration callbacks receive the same boundary checks as arrows. Cleanup reentrancy tests prevent resource resurrection and premature dependency disposal while preserving existing dependency reads and terminal disposal idempotence.
