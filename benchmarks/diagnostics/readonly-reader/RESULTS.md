# React state benchmark report

Run: 2026-10-26T17:31:27.328Z

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
| memo-filter | 50000 | 1 | 5 | Kinstate | 203.84 / 262.32 | 289.2 / 380.6 | 1,016.2 / 1,321.3 | 734.9 / 1,041.6 | 18.4 / 20.3 | 1 / 1 | 5–5 |
| memo-filter | 50000 | 1 | 5 | MobX | 49.34 / 53.14 | 369.7 / 416 | 421.7 / 471.5 | 53.7 / 70 | 21.1 / 23.4 | 1 / 1 | 5–5 |
| memo-filter | 50000 | 1 | 5 | Zustand | 4.88 / 5.44 | 6.4 / 7.3 | 11.5 / 12.3 | 5 / 5.7 | 0.1 / 0.2 | 1 / 1 | 5–5 |
| memo-filter | 50000 | 1 | 5 | Valtio | 210.86 / 242.52 | 353.8 / 362.2 | 810.8 / 827.7 | 455.7 / 488.9 | 12 / 15.4 | 1 / 1 | 5–5 |
| filter-sort | 50000 | 1 | 5 | Kinstate | 93.82 / 99.82 | 280.5 / 628.7 | 543.7 / 874.4 | 252.4 / 486.3 | 7.7 / 10.4 | 1 / 1 | 5–5 |
| filter-sort | 50000 | 1 | 5 | MobX | 51.02 / 53.02 | 351.1 / 570.5 | 412.5 / 631.2 | 60.7 / 61.7 | 21.5 / 23.5 | 1 / 1 | 5–5 |
| filter-sort | 50000 | 1 | 5 | Zustand | 5.04 / 5.06 | 6.1 / 7 | 10.8 / 11.9 | 4.8 / 5.2 | 0.2 / 0.3 | 1 / 1 | 5–5 |
| filter-sort | 50000 | 1 | 5 | Valtio | 216.66 / 238.54 | 345.9 / 497.6 | 800.9 / 949.3 | 451.7 / 470.7 | 12.9 / 18.2 | 1 / 1 | 5–5 |
| array-reorder | 50000 | 100 | 5 | Kinstate | 6.12 / 7.12 | 276 / 282.2 | 277.1 / 283.5 | 2.7 / 3.5 | 0.5 / 0.6 | 100 / 100 | 500–500 |
| array-reorder | 50000 | 100 | 5 | MobX | 3.62 / 4.6 | 351.4 / 978.8 | 352.2 / 980 | 0.7 / 1.2 | 0.4 / 0.4 | 100 / 100 | 500–500 |
| array-reorder | 50000 | 100 | 5 | Zustand | 0.3 / 0.38 | 6.1 / 7 | 6.4 / 7.4 | 0.4 / 0.5 | 0.4 / 0.5 | 100 / 100 | 500–500 |
| array-reorder | 50000 | 100 | 5 | Valtio | 231.9 / 252.34 | 351.4 / 381.3 | 636.7 / 671.2 | 285.3 / 292.6 | 15.3 / 17.4 | 100 / 100 | 500–500 |

## Workloads

- **memo-filter:** Memoized filter/sort presentation with one consumer. Kinstate uses authored React useMemo reading live rows; MobX uses its tracked computed getter before React memoization, and immutable adapters cache by row-array identity. Same sorting/projection and output, idiomatic dependency ownership.
- **filter-sort:** Promote one source row, filter and sort the collection into its top 100 entries, and render the first result in one consumer.
- **array-reorder:** Reverse the array while 100 consumers observe their current row index.

## Environment

| Field | Value |
| --- | --- |
| provenance | {"commit":"9fa25e691ba06f60ddff9019b6da7c57ef4a9c34","dirty":true,"dirtyPaths":["M packages/core/src/internal.ts"," M packages/core/src/reactive.ts"," M packages/react/src/service-view.ts","?? packages/core/test/reactive-reader.test.ts"],"sourceHash":"e272a570a9b3097a8ff6fc508e667419c5c73644e994041f74f577143b66866e","lockfileHash":"60f1cfd79190a039061fea5b3b106d4a55c873a9ee18e3b58bb72881f5ca139e","buildHash":"b1e1e598b616f38166725aead6f68cd2bb0299419190ae8604d0c6421190ec78"} |
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
| filter-sort | 50000 | update | 93.8200 | 51.0200 | 1.7695 | — | inconclusive | Full current case coverage is not declared; Requires at least 21 independent trial blocks |
| filter-sort | 50000 | setup | 280.5000 | 351.1000 | 0.7738 | — | inconclusive | Full current case coverage is not declared; Requires at least 21 independent trial blocks |
| filter-sort | 50000 | mount | 252.4000 | 60.7000 | 4.1038 | — | inconclusive | Full current case coverage is not declared; Requires at least 21 independent trial blocks |
| filter-sort | 50000 | startup | 543.7000 | 412.5000 | 1.3771 | — | inconclusive | Full current case coverage is not declared; Requires at least 21 independent trial blocks |
| filter-sort | 50000 | unmount | 7.7000 | 21.5000 | 0.3581 | — | inconclusive | Full current case coverage is not declared; Requires at least 21 independent trial blocks |
| array-reorder | 50000 | update | 6.1200 | 3.6200 | 1.6330 | — | inconclusive | Full current case coverage is not declared; Requires at least 21 independent trial blocks |
| array-reorder | 50000 | setup | 276.0000 | 351.4000 | 0.7764 | — | inconclusive | Full current case coverage is not declared; Requires at least 21 independent trial blocks |
| array-reorder | 50000 | mount | 2.7000 | 0.7000 | 4.0000 | — | inconclusive | Full current case coverage is not declared; Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| array-reorder | 50000 | startup | 277.1000 | 352.2000 | 0.7830 | — | inconclusive | Full current case coverage is not declared; Requires at least 21 independent trial blocks |
| array-reorder | 50000 | unmount | 0.5000 | 0.4000 | 1.3333 | — | inconclusive | Full current case coverage is not declared; Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| memo-filter | 50000 | update | 203.8400 | 49.3400 | 3.9984 | — | inconclusive | Full current case coverage is not declared; Requires at least 21 independent trial blocks |
| memo-filter | 50000 | setup | 289.2000 | 369.7000 | 0.7671 | — | inconclusive | Full current case coverage is not declared; Requires at least 21 independent trial blocks |
| memo-filter | 50000 | mount | 734.9000 | 53.7000 | 14.1327 | — | inconclusive | Full current case coverage is not declared; Requires at least 21 independent trial blocks |
| memo-filter | 50000 | startup | 1016.2000 | 421.7000 | 2.4098 | — | inconclusive | Full current case coverage is not declared; Requires at least 21 independent trial blocks |
| memo-filter | 50000 | unmount | 18.4000 | 21.1000 | 0.8288 | — | inconclusive | Full current case coverage is not declared; Requires at least 21 independent trial blocks |
