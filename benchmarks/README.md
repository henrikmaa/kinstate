# React workload benchmarks

Kinstate — **Ordinary classes. Reactive state.** Historical measurement JSON retains the original `react-service` library identifier and timestamps; report labels display Kinstate. New runs use `kinstate`. The rename does not change recorded timings or sample data.

Run `npm run bench` from the repository root. Open [report.html](report.html) for interactive charts, or [RESULTS.md](RESULTS.md) for tables. [latest.json](latest.json) contains every measured sample and the machine/dependency metadata. This suite replaces the earlier development-mode jsdom microbenchmark; those timings are not comparable.

```sh
npm ci
npm run build
npx playwright install chromium
npm run bench                        # 7 measured samples, 2 warmups, 30 operations
npm run bench:quick                  # smaller smoke/verification run
npm run bench -- --samples 15 --warmups 5 --operations 50 --seed 42
npm run bench:test
npm run bench:smoke                  # adapter + report checks; preserves full results
npm run bench:typecheck
```

Full measurements can take several minutes, especially whole-array transformations at 50k rows. Use the smoke command for correctness checks without replacing the recorded full report.

Every run rebuilds the browser harness with Vite in production mode, including the actual reactive-service compiler. It uses an isolated ephemeral local port and Playwright Chromium. Run without other resource-intensive work for useful measurements. Never compare results produced with different run settings or hardware as if only the library changed.

## What is measured

Each sample creates fresh state and a fresh React root. Store setup, React mount, logical update transactions, and unmount are timed separately. Store setup includes initial data allocation and observable/store construction; compare setup plus mount when assessing startup costs. Each transaction performs the same domain operation for each library. A transaction is followed by a microtask checkpoint and the same React `flushSync` checkpoint. Default subscriptions are used, including Valtio's normal asynchronous notification mode. The result measures **controlled update-to-DOM-commit work**, including state mutation, subscription checks, derived computations, React rendering, and DOM mutations. It does not measure browser paint or natural concurrent scheduling latency. `flushSync` is a benchmarking control, not recommended application practice.

Warmup samples are discarded. Case order and library order within each round are shuffled using the recorded seed. The report summarizes independent samples, with median, p95, and min/max; individual update operations within a sample are not independent trials. p95 with seven samples mostly describes the slowest sample, not a precise population tail. Use more samples when investigating small differences. Timer resolution and JIT/GC noise particularly affect tiny workloads. No automatic significance or overall-winner claim is made. Heap retention and memory usage are not measured; setup/update time includes allocation work but is not a memory benchmark.

All samples count actual consumer function invocations. The harness validates all backing rows and records plus every rendered output against an independent ordinary-object reference model after measured updates. Correctness assertions and reference computation are excluded from timings. A failing check aborts the run instead of saving misleading results. Root creation and state construction precede mount timing. Mount includes the first render/subscriptions; unmount includes cleanup and scope disposal.

## Workloads

- **No-op / unrelated:** equality suppression and subscription isolation.
- **Single field / shared fanout:** one consumer versus 100 consumers reading the same changing scalar.
- **Conditional:** alternate branch switches, inactive-only edits and active edits to exercise subscription replacement.
- **Nested field:** edit a property inside an object.
- **Batch 100:** 100 synchronous scalar edits published as one logical transaction.
- **Visible array row / offscreen row:** edit an object-row property with 100 visible consumers, backed by 1k, 10k or 50k rows.
- **Normalized row:** equivalent row edits using an ID-keyed record, so representation effects can be compared explicitly.
- **Full list row:** mount 1k or 5k row consumers and edit one row. This includes full DOM costs rather than pretending that a bounded window represents a full list.
- **Append:** grow the array and observe its length.
- **Map and replace:** read every existing reactive row, spread it into a fresh object, change the first value, and replace the complete array. This measures a local transformation plus replacement, including reactive reads and allocation. It does not measure assigning an already-created plain API payload.
- **Filter and sort:** derive an active subset sorted by value and compute the first 100 results and render the leading item, with equivalent cached derivation per library. Each operation promotes a row into the leading results so the observed result changes, rather than timing a selector that always returns an unchanged first item.
- **Parent rerender:** local React parent updates with memoized service consumers.

The array-size label means backing data size. The consumer-count label means mounted React readers. Bounded-window scenarios are not a test of a virtualization library. Async network fetching, third-party query libraries, React transitions, Suspense resolution, browser scrolling, and native UI interactions are outside this suite.

## Fairness choices

All libraries receive the same initial dataset, operations, consumer count, DOM shape and commit checkpoints. No development Strict Mode or production profiling overhead is enabled. Every consumer receives the same memoization treatment. No library-specific synchronous subscription option or framework notification drain is enabled.

The service framework uses compiled `useService`, MobX uses `observer`, Zustand uses primitive/derived selectors with structural sharing, and Valtio uses access-tracked snapshots. Valtio subscribes to stable row/nested-object proxies for local edits, following its documented narrow-subscription guidance; collection replacement and derived-list cases subscribe to the root so they follow new proxy references. MobX wraps each logical transaction in one action; Zustand clones changed containers once and publishes one state update per transaction; the proxy libraries mutate their state directly. The cost of these idiomatic representations is part of the measurement. Object rows and normalized records are included to avoid presenting broad primitive-array invalidation as a general verdict about a library.

Computed derivations are cached rather than deliberately recomputed in just one adapter. A changed input may still cause legitimate cache invalidation or traversal differences. Render counts and timing both matter: an adapter may skip rendering but still perform substantial subscription/selector/snapshot work.

Review adapter implementations in [browser/adapters.tsx](browser/adapters.tsx) and the independent [reference model](browser/model.ts). Adding a scenario requires the same operation and independently verified output for all four adapters. Keep scheduling controls and validation outside individual adapters.

Official background: [React flushSync](https://react.dev/reference/react-dom/flushSync), [MobX reactivity and observable arrays](https://mobx.js.org/understanding-reactivity.html), [Zustand immutable updates](https://zustand.docs.pmnd.rs/guides/immutable-state-and-merging), [Valtio useSnapshot](https://valtio.dev/docs/api/basic/useSnapshot).

## Production hardening workloads

The suite also covers assigning plain API payloads, frozen payloads, removal, reorder, batching 100 row edits and transient record-key churn. The immutable-input filtering case measures replacement-only API publications: Kinstate serviceInputs copies plain data into service-owned reactive state, while MobX observable.ref, Valtio ref and Zustand retain immutable values. These ownership policies differ; their actual adoption costs are included alongside payload allocation and filtering/sorting. Network fetching is excluded, and historical borrowed-input Kinstate results are incompatible with this ownership contract.

Use `--workload filter-sort,map-and-replace,immutable-input-filter --size 50000` to inspect selected cases, and `--output /tmp/kinstate-bench` to preserve the main report. Filtering does not change the sample settings. The CLI rejects unknown workload names and empty case selections.

The historical full run is retained in `baselines/before-production-fixes.json`. New focused verification runs may use different repetition/operation counts and must not be presented as controlled speedup ratios against that historical run.

The pre-collection-optimization run is preserved in `baselines/before-collection-optimization.json` with the same 22 workloads, seed and five-sample/two-warmup/ten-operation settings as the latest verification. Compare exact workloads and render counts; independent runs can still differ through JIT, GC and background load. The current mutable 50k filter/sort scan remains expensive, despite reduced tracking overhead.

The subsequent full-array bookkeeping work has separate focused before/after artifacts in `baselines/before-full-array-optimization.json` and `baselines/after-full-array-optimization.json`, using the three selected 50k workloads and identical five-sample/two-warmup/ten-operation settings. The pre-change full report is `baselines/before-full-array-optimization-full-suite.json`. Focused selection changes shuffled case order; compare focused with focused and full with full. Small differences and allocation-heavy replacement timings remain sensitive to JIT/GC variation. See [the audit](../docs/AUDIT.md) for measured changes and limits.

The archived comparative timings predate readonly React service views. The current ownership boundary has correctness smoke coverage, but those historical timings must not be presented as current measurements without rerunning the suite.

## Current-source MobX parity gate

The current suite has 26 workloads and 57 workload/size cases. It additionally exercises row objects passed into receiving children, component-local React memo cache hits, memoized filtering of live data, and synchronous JSON persistence after a row edit. Persistence uses the same canonical `{count, rows}` projection and native localStorage operation in every adapter; quota preflight is excluded and stored contents are checked after measurement. Kinstate's receiving components are compiled with `reactiveProps: true` in a dedicated source module. Comparator components are excluded from that transform. Kinstate consumers use the compiler's implicit memoization, with no redundant authored React.memo wrapper; MobX uses observer once. Every adapter reuses module-level React component/wrapper identities across samples; store construction does not pay a new observer/memo wrapper allocation in just one library. MobX reads its tracked computed value before React memoization, rather than hiding observable reads behind React's unchanged dependency array. Immutable adapters cache derivation by their row-array identity. Render counters include both receiving parents and children in the row-prop case.

Run correctness checks and a complete measurement independently of other CPU-intensive work:

```sh
node --import tsx --test benchmarks/*.test.mjs benchmarks/*.test.ts
npm run bench:typecheck
npm run bench:smoke
npm run bench -- --samples 21 --warmups 5 --operations 50 --seed 20261026 --output /tmp/kinstate-mobx-parity
npx tsx benchmarks/parity-cli.ts /tmp/kinstate-mobx-parity/latest.json
```

The gate emits `PARITY.md` and `parity.json` and reports **every workload/size and cost metric separately**: update, setup, mount, combined startup, and unmount. The HTML report retains the ordinary cost charts and provides an expandable complete comparison table. Lower is better throughout. No average score can hide a regression. A successful gate requires every comparison to pass, with no increase in verified render counts against MobX; exit codes are 0 for pass, 1 for a confirmed regression and 2 for inconclusive evidence. A final CLI argument can select metrics for a focused diagnostic, for example `update`; that narrower result does not establish parity for omitted costs.

The explicit noninferiority tolerance is **5%**: a candidate/MobX ratio of 1.05 is the threshold, not a claim of exact equality. Uncertainty intervals are adjusted across the full comparison matrix. At least 21 matched independent trial blocks and a median timed sample duration of 5 ms are required. An interval crossing the threshold is inconclusive. Tiny no-op/cleanup samples can remain below the timer floor even after many samples: they must remain unproven, rather than being declared equal because both rounded to zero. Increase the measured work or use a separately validated higher-resolution experiment before interpreting those cells. Individual operations within one timed loop are not independent samples.

The interval is a nominal, scenario-specific uncertainty estimate under the sampling assumptions. Shared browser processes, JIT/GC, thermal drift and background activity can correlate samples. Neither a single-machine gate nor a small nominal tolerance proves universal superiority, individual-operation tail latency, or performance on every React application. The real-app Tela/drawDB comparisons do not currently include equivalent MobX ports and cannot establish MobX parity for those applications.

New artifacts record the Git revision/dirty paths, maintained source hash, lockfile hash, exact production-bundle hash and explicit case manifest. Source/bundle changes during measurement abort the run. The CLI verifies these fingerprints against the current checkout. Old artifacts remain readable with a prominent historical warning, but absent fingerprints, missing cases, mismatched checksums, partial coverage, insufficient samples, stale source, timing-floor results or unresolved uncertainty never produce a pass. The archived October 20 data predates current readonly views, receiver/memo instrumentation and later fixes; it is not a measurement of the current package.

Gate ratios are medians of matched trial-block ratios; the timing columns independently summarize each library, so their quotient can differ from the displayed matched ratio. The interval uses exact binomial/order-statistic bounds for the median ratio, with Bonferroni correction across all cases and metrics. It avoids claiming extreme bootstrap-tail precision from too few resamples. Its nominal coverage still assumes independent identically distributed blocks, which browser/thermal/JIT drift can violate. Explicit block identities prevent pairing unrelated samples.

### Incoming immutable data and ownership

`immutable-input-filter` models a source that replaces an immutable API collection,
then derives a filtered result; it never edits that collection in place. MobX uses
`observable.ref`, Valtio uses `ref`, and Zustand uses its ordinary immutable value.
Kinstate's input boundary copies plain data into service-owned state. That extra
ownership and tracking cost remains included in Kinstate's measurement: this case
compares idiomatic handling of a replacement-only source, not identical internal
ownership implementations. Historical borrowed-input Kinstate results must not be
presented as measurements of the copying implementation. The ordinary `filter-sort`
and `memo-filter` workloads separately exercise deeply reactive, editable rows.
