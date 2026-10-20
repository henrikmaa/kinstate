# Production hardening record

Updated 2026-10-20. This records verified fixes and explicit remaining boundaries; a passing suite does not imply support for arbitrary JavaScript or React patterns.

## Correctness fixes

| Finding | Resolution | Evidence |
| --- | --- | --- |
| Locally caught render errors discarded dependencies and could leave fallback UI stuck | Publish synchronous reads to the render attempt even when getters/helpers throw, preserving earliest-version validation and independent nested collectors | Getter/method fallback recovery render counters, falsy thrown values, subscription race and collector restoration tests |
| Capturing function declarations escaped default-mode render-callback checks | Apply declaration dependency analysis in every compiler mode; retain compiled receiver ownership and ordinary command/local-helper support | Compiler escape/alias/transitive-helper fixtures and selective compiled receiver regression |
| Failed activation cleanup could resurrect resources or recursively destroy dependencies | Guard cleanup against service activation/construction and premature terminal disposal while allowing reads of existing dependencies; restore guards after cleanup errors | Failed-init, rollback reentrancy, dependent cleanup ordering and running dependency recovery tests |
| Nested providers disposed ancestor dependencies before child services | Active child scopes retain ancestor lifetimes; deferred cleanup proceeds from leaves to root; explicit owners cannot prematurely dispose active ancestors | Three-level scope, Strict Mode replay, reactivation, disposer failure and real React nested-provider tests |
| Ancestor startup failure could strand resources already used by committed descendants | Preserve dependencies through descendant cleanup, then finish terminal disposal; roll back failed local activations and lease acquisition | Manual-scope and real React error-boundary startup-failure regressions |
| Service methods named like Hooks escaped read tracking | Distinguish business calls and aliases from Hook bindings; preserve actual Hook calls and generated Hook-rule validity | Executed compiler fixtures and selective React render-counter regression |
| Shadowed React import names were treated as the original Hook/factory | Validate lexical import bindings for known React operations | Shadowed memo and element-factory fixtures |
| An earlier return could close tracking before a later finally return | Diagnose component returns crossing finally; retain ordinary returns after try/finally and helper returns | Compiler diagnostic and accepted-form fixtures |
| Borrowed getter reads poisoned the canonical computed cache | Cache only reads using the canonical receiver; other receivers retain their own synchronous dependencies and the source property dependency | Getter read-order, descriptor replacement/deletion, inherited receiver and dynamic cleanup regressions |
| A borrowed first method read could bind future commands to the wrong object | Bind service methods to the canonical service regardless of the read receiver | Borrowed and detached method reference tests |
| Pinning a property could change its exposed proxy/bound-function identity without notification | Invalidate value and array-sequence observations when descriptor invariants change the exposed identity; retain Object.is suppression for primitives and opaque inputs | Object/function descriptor and frozen-array iteration regressions |
| Live objects/render callbacks could not cross application component boundaries | Optional receiving-component instrumentation and compiler-proven weak receiver registration; actual reads subscribe in the child | Imported memo/forwardRef, conditional callbacks, unmount, Strict Mode, Suspense and browser render-counter tests |
| Babel application configuration instrumented framework infrastructure | Dependency exclusion and explicit props-mode infrastructure directive | Next.js 16 Turbopack and webpack builds plus hydration/request-isolation browser checks |
| Destructured receiver parameters changed scope/mutability; async aliases escaped checks | Ordered mutable lowering for supported forms; diagnostics for lexical defaults, body-function conflicts and async/generator aliases | Executed parameter semantics and callback alias fixtures |
| Failed array truncation could partially mutate without notification | Inspect actual post-operation length/indices, preserve native false/throw result and notify only actual changes | Three native truncation regression tests |
| Optional chains changed JavaScript short-circuit behavior | Instrument complete chains while preserving receivers, parentheses, optional calls and delete | Executed compiler semantics tests and React null/non-null updates |
| Destructuring/for-of/tagged calls missed dependencies | Track pattern evaluation and complete tagged invocations; preserve scope and iterator cleanup | Executed compiler version/invalidation tests and rendered output tests |
| Property metadata retained historical deleted keys | Allocate only for observed reads; retain active nodes and captured dependencies, reclaim released entries with weak registries | Real-GC tests: unobserved churn, 25k released nodes, captured render nodes, active observers whose cleanup is not retained |
| Custom UI props and Hook dependency arrays were over-restricted | Validate evaluated plain props/children; support on* commands, effects and memoized callbacks with stable service references | Compiler fixtures and controlled React UI tests |
| Anonymous React wrappers were rejected | Recognize memo/forwardRef, nested wrappers and import aliases | Component integration tests and official Hook-rule lint |
| Component boundary validation could invoke getters or hide reactive objects | Inspect descriptors before React branding; reject accessor/custom-prototype graphs and live proxies | Getter side-effect and nested graph regression tests |

## Application ownership

External plain objects are immutable inputs observed through root replacement. They retain their supplied identity and avoid automatic deep proxying; locally owned service arrays and objects remain deeply reactive. Explicitly supplied framework proxies retain their identity and tracking. Tests cover ownership transitions even when the underlying raw reference is unchanged.

The maintained [ProfileEditorService recipe](../packages/examples/vite-react/src/ProfileEditorService.ts) and [workflow tests](../packages/tests/editor-workflow.test.ts) demonstrate dirty drafts, entity switches, conflict/reset policy, optimistic save rollback, callback replacement, cancellation, out-of-order responses and lifecycle reactivation. These are application policies rather than automatic cancellation of every async service method.

## Remaining supported boundaries

- Live reactive objects cannot be passed to an uninstrumented component. Pass evaluated primitive/plain data, immutable external data, or let the child resolve its service. Live props and synchronous render callbacks are supported between compiled receivers in reactiveProps mode. Uncompiled receivers remain guarded.
- Custom service Hooks returning live services, unknown wrapper callbacks, hidden reactive reads inside useMemo, and a few pattern initializers with mutable lexical captures are diagnosed rather than silently tracked incorrectly.
- External inputs publish from committed work. There is no atomic transaction across arbitrary React libraries. Incoming Suspense belongs to the source hook; consumer suspension must not wait for that same pending provider commit.
- Map/Set/native values and custom nested classes are opaque in the engine. JavaScript private-slot mutations are unobservable. Next.js 16 Turbopack and webpack integrations are verified with Babel. See [limitations](LIMITATIONS.md).
- General mutable collection filtering/sorting remains proportional to collection size and dependency reads. The engine avoids unnecessary metadata/validation work, and immutable API inputs provide the plain-data path. Pagination, indexed derivations or background computation remain appropriate for expensive application algorithms.

## Performance verification

The original complete measurements are preserved in `benchmarks/baselines/before-production-fixes.json`. New API payload/frozen payload/immutable-input filtering, removal, reorder, row batching and record-churn scenarios supplement the previous suite. Production measurements report their sample counts and settings; do not treat differently configured runs as controlled before/after ratios.

Full-array bookkeeping now uses persistent computed dependency records, incremental connection maintenance, shared proxy-handler methods and a single weak canonical registry. Ordinary property versions are captured once per synchronous collection; computed reads still validate every access after intervening writes. Connected clean computed getters skip dependency scans after unrelated writes. Independent render captures, dynamic branches, exception recovery, native array/receiver semantics and weak ownership remain covered by regressions.

Focused before/after runs are archived in `benchmarks/baselines/before-full-array-optimization.json` and `after-full-array-optimization.json`. Both use production Chromium, the same three 50k-row workloads, seed, five measured samples, two warmups and ten operations per sample. Median update-to-commit cost (**lower is better**):

| Workload | Before ms/op | After ms/op | Interpretation |
| --- | ---: | ---: | --- |
| Mutable cached filtering/sorting | 87.13 | 83.70 | Small observed reduction; additional runs are needed to distinguish it from timing variation |
| Map and replace | 165.73 | 165.98 | Essentially unchanged; no timing improvement claimed |
| Immutable API input replacement plus filtering/sorting | 7.68 | 6.94 | Separate shallow-input workload; not a speedup ratio against mutable filtering |

The unchanged comparison libraries also vary between runs, particularly allocation-heavy map-and-replace. These measurements do not establish a universal speedup or solve full-array latency. The archived pre-change complete suite is `benchmarks/baselines/before-full-array-optimization-full-suite.json`; the current complete run is reported below and in the charts. Filtering case selection changes shuffled case order, so focused and complete timings must not be used as a controlled before/after pair.

Memory regression tests verify ownership and reclamation separately from browser timing. Controlled DOM-commit timings do not establish paint latency, browser scrolling, real virtualization, network latency or universal performance superiority. Source-owned Suspense, transitions and request isolation have correctness tests; natural scheduling and retained-heap workloads need their own performance measurements.

### Measured remaining collection cost

The current production Chromium run (five measured samples, two warmups, ten operations per sample) contains 188 comparisons across 22 workloads. These are median controlled commit costs on this machine; lower is better.

| 50,000-row workload | Kinstate ms/op | MobX ms/op | Zustand ms/op | Valtio ms/op |
| --- | ---: | ---: | ---: | ---: |
| Mutable cached filtering/sorting | 100.06 | 48.01 | 4.90 | 245.69 |
| Immutable API input replacement plus filtering/sorting | 7.63 | 7.47 | 8.10 | 19.22 |
| Map every existing row and replace collection | 171.20 | 322.79 | 1.14 | 531.61 |
| Assign fresh plain payload | 2.78 | 172.53 | 2.19 | 415.79 |

The mutable and immutable cases perform different domain operations and must not be treated as a speedup ratio. The immutable case publishes a fresh payload with equivalent shallow storage policies across all libraries. The mutable case edits a row and invalidates a cached derivation over a deeply observed collection. General large mutable derivations remain unsuitable for latency-sensitive foreground interactions without application-level indexing, pagination or moving work off the main thread. This remains a performance limitation of this release, despite the corrected retention and redundant validation defects.

Scalar changes render one consumer; unrelated changes render none in all four adapters. Root collection replacement renders 100 Kinstate consumers in the replacement cases because each reads the replaced array property; selectors in Zustand can suppress consumers whose final scalar stays equal. Fine-grained property tracking does not imply selector-level equality suppression through every replaced ancestor. Consult the interactive report for both time and render counts.


## Sustained-load verification

`npm run test:load:long` passed after the full-array bookkeeping changes: 900 scope cycles over 10,000-row datasets, 900,000 historical observed/deleted keys and 1,000 Strict Mode mount cycles with nested isolated providers. Initialization/disposal counts balance, active observers finish at zero, sampled released scopes/services are collected, and retained heap grows 64,888 bytes across eight full-GC checkpoints. The artifact is [production-load-long.json](validation/production-load-long.json). This validates retained ownership, not peak-memory bounds; same-job WeakRef lifetime and allocation pressure remain JavaScript runtime properties.

The generic input bridge has a real Zustand-backed workflow test covering rapid publications, callback closures from React state, consistency after commit and local edits. Universal transactions across independently owned React stores are not inferred: use a shared authoritative owner when a screen requires one atomic snapshot, and derive cross-service state within the service graph using DI/computed getters and synchronous batching.


The earlier sequence-tracking optimization is preserved in `benchmarks/baselines/before-collection-optimization.json`; filtering/sorting then changed from 423.01 to 115.20 ms/op. The subsequent bookkeeping changes recorded here changed the complete-suite result from 115.20 to 100.06 ms/op (about 13% lower). Map-and-replace changed from 156.89 to 171.20 ms/op (about 9% higher), while unchanged comparison libraries also became slower in that case. No map-and-replace timing improvement is claimed. Complete runs use the same 22 workloads, seed, five samples, two warmups and ten operations. Separate runs still have JIT/GC/background variation; these are observed results, not universal speedup guarantees.

At 50,000 rows, a single visible-row edit measures 0.03 ms/op and renders one consumer. Full-array filtering/sorting still traverses and collects many row fields; 100 ms is unsuitable for a per-keystroke foreground frame budget. The immutable API-input workload measures 7.63 ms/op with equivalent shallow storage across libraries. Use source-owned immutable data, incremental/indexed application queries, pagination or background work for expensive whole-collection algorithms. This is an explicit workload limit, not a claim that all large-array performance is solved.
