# React state benchmark report

Run: 2026-10-26T17:24:57.207Z

Compare libraries only within the same workload and size. **Lower is better** for all reported cost metrics (time and render calls); this report does not compute an overall ranking.

## Methodology

Production React in Chromium. This is a controlled commit checkpoint benchmark, not natural event latency or concurrent scheduling. Every library uses the same flushSync scheduling. Each case receives warmups and repeated samples; execution order is randomized.

Samples per case: 5. Warmups: 2. Random seed: 20261026.

Scheduling: Controlled commit benchmark: one synchronous logical transaction, one microtask checkpoint, then the same React flushSync checkpoint for every library; timing includes notification delivery and DOM commits, excludes correctness checks. No frame or paint wait.

Median uses the middle value (mean of the two middle values for even samples). P95 uses the nearest-rank percentile. Update times and render calls are divided by operations; mount and unmount cover the complete consumer tree.

Setup measures adapter and store construction, including initial data allocation. Startup is setup plus mount, computed per sample before summarizing. Compare startup rather than mount alone: libraries may initialize reactive data eagerly during setup or lazily during mount.

Update P95 is the percentile of per-sample average milliseconds per operation, not a percentile of individual operation latencies. Each sample times its complete operation loop.

Adapters use compiled useService, MobX observer, Zustand selectors with one structurally shared publication per transaction, and Valtio snapshots scoped to stable rows/nested objects (root snapshots for collection replacement/derivation).

Render calls count update-phase component function calls, not browser paints. Library differences in array tracking can legitimately change render counts, including MobX arrays. Inspect the observed counts rather than assuming identical behavior.

## Results

| Workload | Size | Consumers | Operations | Library | Update ms/op median / P95 sample mean | Setup ms median / p95 | Startup ms median / p95 | Mount ms median / p95 | Unmount ms median / p95 | Renders/op median / p95 | Exact render calls min–max |
| --- | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| memo-filter | 50000 | 1 | 5 | Kinstate | 263.12 / 279.44 | 300.4 / 364.3 | 824.1 / 1,436.3 | 523.7 / 1,072 | 17.3 / 21.9 | 1 / 1 | 5–5 |
| memo-filter | 50000 | 1 | 5 | MobX | 46.96 / 49.66 | 388.4 / 561.7 | 442.2 / 615.7 | 54.4 / 61.9 | 21.1 / 23.7 | 1 / 1 | 5–5 |
| memo-filter | 50000 | 1 | 5 | Zustand | 4.86 / 5.36 | 5.6 / 6.4 | 10.4 / 11.5 | 4.8 / 5.1 | 0.2 / 0.2 | 1 / 1 | 5–5 |
| memo-filter | 50000 | 1 | 5 | Valtio | 203.04 / 216.6 | 336.7 / 935.7 | 776.1 / 1,360 | 447.8 / 474.7 | 12.3 / 13.3 | 1 / 1 | 5–5 |
| filter-sort | 50000 | 1 | 5 | Kinstate | 91.9 / 136.72 | 270.8 / 772.5 | 528.6 / 1,030.2 | 257 / 259.6 | 8.5 / 10 | 1 / 1 | 5–5 |
| filter-sort | 50000 | 1 | 5 | MobX | 48.84 / 51.22 | 341.7 / 1,609.8 | 398.6 / 1,678 | 56.9 / 68.2 | 18.9 / 23.5 | 1 / 1 | 5–5 |
| filter-sort | 50000 | 1 | 5 | Zustand | 5.04 / 6.02 | 6.1 / 299.1 | 10.9 / 303.5 | 4.8 / 5.7 | 0.1 / 0.3 | 1 / 1 | 5–5 |
| filter-sort | 50000 | 1 | 5 | Valtio | 229.06 / 249.82 | 370 / 384.3 | 804.6 / 918 | 461.2 / 534.4 | 12.7 / 19.2 | 1 / 1 | 5–5 |
| array-reorder | 50000 | 100 | 5 | Kinstate | 3.62 / 7 | 283.3 / 294.9 | 292.2 / 302.1 | 2.8 / 18.8 | 0.5 / 0.7 | 100 / 100 | 500–500 |
| array-reorder | 50000 | 100 | 5 | MobX | 4.36 / 5.14 | 381.4 / 1,599.7 | 382.2 / 1,600.4 | 0.7 / 0.8 | 0.4 / 0.4 | 100 / 100 | 500–500 |
| array-reorder | 50000 | 100 | 5 | Zustand | 0.24 / 0.42 | 6.4 / 157.2 | 6.7 / 157.9 | 0.4 / 0.7 | 0.3 / 0.4 | 100 / 100 | 500–500 |
| array-reorder | 50000 | 100 | 5 | Valtio | 235.68 / 243.52 | 349.2 / 647.5 | 676 / 938.1 | 290.6 / 333.7 | 16.1 / 18 | 100 / 100 | 500–500 |

## Workloads

- **memo-filter:** Memoized filter/sort presentation with one consumer. Kinstate uses authored React useMemo reading live rows; MobX uses its tracked computed getter before React memoization, and immutable adapters cache by row-array identity. Same sorting/projection and output, idiomatic dependency ownership.
- **filter-sort:** Promote one source row, filter and sort the collection into its top 100 entries, and render the first result in one consumer.
- **array-reorder:** Reverse the array while 100 consumers observe their current row index.

## Environment

| Field | Value |
| --- | --- |
| provenance | {"commit":"966d72573991e1c542c005a3d1f3ed3043f3fda7","dirty":true,"dirtyPaths":["M README.md"," M benchmarks/README.md"," M benchmarks/RESULTS.md"," M benchmarks/browser/adapters.tsx"," M benchmarks/browser/model.ts"," M benchmarks/browser/runner.tsx"," M benchmarks/report.html"," M benchmarks/report.mjs"," M benchmarks/report/html.mjs"," M benchmarks/report/markdown.mjs"," M benchmarks/report/metadata.mjs"," M benchmarks/run.tsx"," M benchmarks/schema.ts"," M benchmarks/vite.config.ts"," M docs/ARCHITECTURE.md"," M docs/COMPILER.md"," M docs/COMPOSITION.md"," M docs/LIMITATIONS.md"," M docs/VALIDATION.md"," M package.json"," M packages/compiler/README.md"," M packages/compiler/src/plugin.ts"," M packages/compiler/src/prop-components.ts"," M packages/compiler/test/expression-parameter-regressions.test.ts"," M packages/compiler/test/memo-integration.test.tsx"," M packages/core/README.md"," M packages/core/src/computed-graph.ts"," M packages/core/src/index.ts"," M packages/core/src/inputs.ts"," M packages/core/src/observe.ts"," M packages/core/src/reactive.ts"," M packages/core/src/scope.ts"," M packages/core/test/core.test.ts"," M packages/core/test/descriptor-receivers.test.ts"," M packages/core/test/immutable-inputs.test.ts"," M packages/core/test/inputs.test.ts"," M packages/core/test/read-consistency.test.ts"," M packages/core/test/retention.test.ts"," M packages/react/README.md"," M packages/react/src/component-tracking.ts"," M packages/react/src/memo-cache.ts"," M packages/react/src/render-frame.ts"," M packages/react/src/use-service-memo.ts"," M packages/tests/async-patterns.test.ts"," M packages/tests/boundary-validation.test.ts"," M packages/tests/inputs.test.tsx"," M website/docs/guide/external-state.md"," M website/docs/guide/react-composition.md"," M website/docs/reference/compiler.md","?? benchmarks/PARITY.md","?? benchmarks/adapters.test.ts","?? benchmarks/browser/contracts.ts","?? benchmarks/browser/kinstate-consumers.tsx","?? benchmarks/browser/kinstate-state.ts","?? benchmarks/cases.ts","?? benchmarks/parity-cli.ts","?? benchmarks/parity.json","?? benchmarks/parity.mjs","?? benchmarks/parity.test.mjs","?? benchmarks/provenance.d.mts","?? benchmarks/provenance.mjs","?? packages/compiler/test/implicit-memo.test.tsx","?? packages/core/src/array-reverse.ts","?? packages/core/src/owned-state.ts","?? packages/core/test/array-reverse.test.ts","?? packages/core/test/computed-graph-order.test.ts","?? packages/core/test/input-ownership.test.ts","?? packages/core/test/observe-scheduler.test.ts","?? packages/core/test/owned-reverse-cache.test.ts","?? packages/core/test/owned-state.test.ts","?? packages/core/test/property-atoms-hot-cache.probe.mjs","?? packages/core/test/property-atoms-hot-cache.test.ts","?? packages/react/test/","?? packages/tests/input-ownership.test.tsx"],"sourceHash":"ac06ffbb9e8a979d5f1e88413c837a8295133908e9ab3b04679c8bad45618d7d","lockfileHash":"60f1cfd79190a039061fea5b3b106d4a55c873a9ee18e3b58bb72881f5ca139e","buildHash":"1f2c33df228d97060d78e70a4542890a9f9af75de66a05c23010087ea3b12645"} |
| frameworkVersion | 0.1.0 |
| node | v24.16.0 |
| platform | linux |
| arch | x64 |
| cpu | AMD Ryzen 7 3700X 8-Core Processor |
| logicalCpus | 16 |
| memoryGiB | 31.3 |
| browser | 156.0.8078.4 |
| userAgent | Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.8078.4 Safari/537.36 |
| mode | production |
| renderer | React DOM in headless Chromium |
| viewport | 1280 × 800 |
| versions | {"react":"19.3.1","react-dom":"19.3.1","mobx":"6.16.1","mobx-react-lite":"4.1.1","zustand":"5.0.15","valtio":"2.3.2","vite":"7.3.7"} |

## Methodology references

- [React flushSync](https://react.dev/reference/react-dom/flushSync): controlled synchronous commit checkpoints can affect performance.
- [MobX understanding reactivity](https://mobx.js.org/understanding-reactivity.html): observable property and array dependency behavior.
- [Zustand immutable state and merging](https://zustand.docs.pmnd.rs/learn/guides/immutable-state-and-merging): immutable updates and merge behavior.
- [Valtio useSnapshot](https://valtio.dev/docs/api/basic/useSnapshot): render access tracking through snapshots.

## Limits

- Measures JavaScript execution and React work; does not measure paint, network latency, or a virtualization library.
- Single machine, single browser process, sequential warmed runs; timings are not cross-device performance guarantees.
- Headless browser commit latency excludes paint, layout measurement, network, real API libraries and user-event dispatch.
- Large arrays use a bounded visible window; this is not a virtualization-library benchmark.
- Zustand uses one structurally shared immutable publication per transaction; proxy libraries mutate in place. Representation costs are included.
- Results are scenario-specific. Do not combine different workloads into an overall winner.
- Fresh stores and roots for every sample; setup and teardown are measured separately. No forced garbage collection; allocation and GC can affect outliers.

Full sample data is preserved in the JSON report. The standalone HTML includes an embedded copy and a download button.


## Per-case MobX parity: inconclusive

Lower is better. Median matched-block candidate/MobX ratios; noninferiority threshold 1.05× (5% tolerance), not a claim of exact equality. 95% nominal family-wise order-statistic intervals across 15 comparisons. No aggregate timing score.

| Workload | Size | Metric | Kinstate | MobX | Ratio | Interval | Verdict | Evidence / limitation |
| --- | ---: | --- | ---: | ---: | ---: | --- | --- | --- |
| filter-sort | 50000 | update | 91.9000 | 48.8400 | 1.9453 | — | inconclusive | Full current case coverage is not declared; Requires at least 21 independent trial blocks |
| filter-sort | 50000 | setup | 270.8000 | 341.7000 | 0.8044 | — | inconclusive | Full current case coverage is not declared; Requires at least 21 independent trial blocks |
| filter-sort | 50000 | mount | 257.0000 | 56.9000 | 4.5370 | — | inconclusive | Full current case coverage is not declared; Requires at least 21 independent trial blocks |
| filter-sort | 50000 | startup | 528.6000 | 398.6000 | 1.3505 | — | inconclusive | Full current case coverage is not declared; Requires at least 21 independent trial blocks |
| filter-sort | 50000 | unmount | 8.5000 | 18.9000 | 0.4670 | — | inconclusive | Full current case coverage is not declared; Requires at least 21 independent trial blocks |
| array-reorder | 50000 | update | 3.6200 | 4.3600 | 0.8619 | — | inconclusive | Full current case coverage is not declared; Requires at least 21 independent trial blocks |
| array-reorder | 50000 | setup | 283.3000 | 381.4000 | 0.7428 | — | inconclusive | Full current case coverage is not declared; Requires at least 21 independent trial blocks |
| array-reorder | 50000 | mount | 2.8000 | 0.7000 | 4.6667 | — | inconclusive | Full current case coverage is not declared; Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| array-reorder | 50000 | startup | 292.2000 | 382.2000 | 0.7904 | — | inconclusive | Full current case coverage is not declared; Requires at least 21 independent trial blocks |
| array-reorder | 50000 | unmount | 0.5000 | 0.4000 | 1.5000 | — | inconclusive | Full current case coverage is not declared; Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| memo-filter | 50000 | update | 263.1200 | 46.9600 | 5.6658 | — | inconclusive | Full current case coverage is not declared; Requires at least 21 independent trial blocks |
| memo-filter | 50000 | setup | 300.4000 | 388.4000 | 0.7485 | — | inconclusive | Full current case coverage is not declared; Requires at least 21 independent trial blocks |
| memo-filter | 50000 | mount | 523.7000 | 54.4000 | 8.5712 | — | inconclusive | Full current case coverage is not declared; Requires at least 21 independent trial blocks |
| memo-filter | 50000 | startup | 824.1000 | 442.2000 | 1.8755 | — | inconclusive | Full current case coverage is not declared; Requires at least 21 independent trial blocks |
| memo-filter | 50000 | unmount | 17.3000 | 21.1000 | 0.9108 | — | inconclusive | Full current case coverage is not declared; Requires at least 21 independent trial blocks |
