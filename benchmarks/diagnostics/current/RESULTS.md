# React state benchmark report

Run: 2026-10-26T17:57:46.017Z

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
| persist-json | 50000 | 1 | 5 | Kinstate | 133.32 / 140.62 | 273.7 / 358.5 | 274.3 / 359.1 | 0.6 / 0.6 | 0.2 / 0.3 | 1 / 1 | 5–5 |
| persist-json | 50000 | 1 | 5 | MobX | 113.1 / 203.88 | 371.5 / 397 | 371.9 / 397.4 | 0.4 / 0.5 | 0.2 / 0.3 | 1 / 1 | 5–5 |
| persist-json | 50000 | 1 | 5 | Zustand | 13.14 / 14.24 | 5.8 / 9.1 | 6.1 / 9.3 | 0.3 / 0.5 | 0.2 / 0.3 | 1 / 1 | 5–5 |
| persist-json | 50000 | 1 | 5 | Valtio | 54.98 / 55.72 | 399.9 / 844.4 | 400.4 / 844.7 | 0.5 / 0.8 | 0.2 / 0.3 | 1 / 1 | 5–5 |
| append | 1000 | 1 | 5 | Kinstate | 0.08 / 0.1 | 4.9 / 7.2 | 5.3 / 7.5 | 0.3 / 0.8 | 0.1 / 0.2 | 1 / 1 | 5–5 |
| append | 1000 | 1 | 5 | MobX | 0.04 / 0.06 | 6.2 / 9.5 | 6.3 / 9.8 | 0.1 / 0.3 | 0 / 0.2 | 1 / 1 | 5–5 |
| append | 1000 | 1 | 5 | Zustand | 0.02 / 0.04 | 0.1 / 0.2 | 0.2 / 0.3 | 0.1 / 0.1 | 0 / 0.1 | 1 / 1 | 5–5 |
| append | 1000 | 1 | 5 | Valtio | 1.08 / 1.52 | 5.4 / 6.3 | 9.5 / 11.5 | 4.5 / 5.5 | 0.2 / 0.6 | 1 / 1 | 5–5 |
| shared-fanout | 1000 | 100 | 5 | Kinstate | 0.3 / 0.46 | 4.3 / 4.9 | 4.7 / 5.3 | 0.4 / 0.5 | 0.3 / 0.4 | 100 / 100 | 500–500 |
| shared-fanout | 1000 | 100 | 5 | MobX | 0.16 / 0.32 | 7 / 9 | 7.5 / 9.6 | 0.5 / 0.6 | 0.4 / 0.5 | 100 / 100 | 500–500 |
| shared-fanout | 1000 | 100 | 5 | Zustand | 0.14 / 0.18 | 0.1 / 0.3 | 0.4 / 0.7 | 0.3 / 0.5 | 0.3 / 0.4 | 100 / 100 | 500–500 |
| shared-fanout | 1000 | 100 | 5 | Valtio | 0.34 / 0.48 | 6.4 / 7.2 | 12.1 / 15.8 | 5.7 / 8.8 | 0.6 / 1.3 | 100 / 100 | 500–500 |
| memo-filter | 1000 | 1 | 5 | Kinstate | 1.96 / 2.24 | 4.6 / 4.9 | 9 / 9.6 | 4.2 / 5 | 0.3 / 1 | 1 / 1 | 5–5 |
| memo-filter | 1000 | 1 | 5 | MobX | 0.94 / 1.04 | 7.3 / 8.1 | 8.4 / 9.4 | 1.1 / 1.3 | 0.4 / 0.5 | 1 / 1 | 5–5 |
| memo-filter | 1000 | 1 | 5 | Zustand | 0.14 / 0.18 | 0.2 / 0.2 | 0.4 / 0.5 | 0.2 / 0.3 | 0.1 / 0.1 | 1 / 1 | 5–5 |
| memo-filter | 1000 | 1 | 5 | Valtio | 2.74 / 3.78 | 6 / 6.6 | 12.4 / 14.1 | 6.5 / 8 | 0.2 / 0.2 | 1 / 1 | 5–5 |
| api-frozen | 50000 | 100 | 5 | Kinstate | 121.12 / 210.18 | 294.4 / 299.6 | 296.2 / 301.1 | 1.3 / 2 | 0.4 / 0.7 | 100 / 100 | 500–500 |
| api-frozen | 50000 | 100 | 5 | MobX | 172.96 / 177.68 | 382 / 950.7 | 382.5 / 951.3 | 0.5 / 0.7 | 0.4 / 0.5 | 100 / 100 | 500–500 |
| api-frozen | 50000 | 100 | 5 | Zustand | 4 / 4.46 | 6.7 / 136.9 | 7.3 / 137.4 | 0.4 / 0.6 | 0.2 / 0.3 | 1 / 1 | 5–5 |
| api-frozen | 50000 | 100 | 5 | Valtio | 73.76 / 76.28 | 355.4 / 486 | 644.8 / 769.3 | 283.3 / 299.2 | 7.7 / 10.6 | 1 / 1 | 5–5 |
| conditional | 1000 | 1 | 5 | Kinstate | 0.02 / 0.02 | 4 / 4.9 | 4.1 / 5 | 0.1 / 0.2 | 0 / 0.1 | 0.6 / 0.6 | 3–3 |
| conditional | 1000 | 1 | 5 | MobX | 0 / 0.02 | 5.9 / 6.3 | 6 / 6.4 | 0.1 / 0.2 | 0.1 / 0.1 | 0.6 / 0.6 | 3–3 |
| conditional | 1000 | 1 | 5 | Zustand | 0 / 0 | 0.1 / 0.1 | 0.2 / 0.3 | 0.1 / 0.2 | 0 / 0.2 | 0.2 / 0.2 | 1–1 |
| conditional | 1000 | 1 | 5 | Valtio | 0.06 / 0.1 | 5 / 5.3 | 9 / 9.9 | 3.8 / 5 | 0.2 / 0.4 | 0.6 / 0.6 | 3–3 |
| api-frozen | 10000 | 100 | 5 | Kinstate | 19.36 / 20.38 | 52.7 / 187.9 | 53.6 / 189.6 | 0.9 / 1.7 | 0.4 / 0.4 | 100 / 100 | 500–500 |
| api-frozen | 10000 | 100 | 5 | MobX | 31.78 / 37.76 | 72 / 79.2 | 72.5 / 79.7 | 0.5 / 1.1 | 0.4 / 0.4 | 100 / 100 | 500–500 |
| api-frozen | 10000 | 100 | 5 | Zustand | 0.92 / 22.68 | 1.2 / 2.6 | 1.5 / 3.3 | 0.2 / 0.7 | 0.2 / 0.2 | 1 / 1 | 5–5 |
| api-frozen | 10000 | 100 | 5 | Valtio | 15.46 / 16.44 | 57.9 / 70.7 | 116.2 / 149 | 58.2 / 78.3 | 3.2 / 4 | 1 / 1 | 5–5 |
| array-reorder | 50000 | 100 | 5 | Kinstate | 6.58 / 7.64 | 280.5 / 305.8 | 281.8 / 307 | 1.2 / 1.6 | 0.4 / 0.5 | 100 / 100 | 500–500 |
| array-reorder | 50000 | 100 | 5 | MobX | 3.26 / 4.12 | 376.5 / 395.3 | 377 / 395.8 | 0.5 / 1 | 0.4 / 0.5 | 100 / 100 | 500–500 |
| array-reorder | 50000 | 100 | 5 | Zustand | 0.2 / 0.3 | 5.6 / 5.8 | 6.2 / 6.2 | 0.5 / 0.6 | 0.3 / 0.5 | 100 / 100 | 500–500 |
| array-reorder | 50000 | 100 | 5 | Valtio | 272.42 / 388.12 | 377.5 / 404.6 | 733 / 893.1 | 343.5 / 531.2 | 30.1 / 34.3 | 100 / 100 | 500–500 |
| reactive-prop-row | 10000 | 100 | 5 | Kinstate | 0.02 / 0.04 | 48.1 / 51.5 | 49.5 / 52.9 | 1.4 / 1.4 | 0.3 / 0.4 | 1 / 1 | 5–5 |
| reactive-prop-row | 10000 | 100 | 5 | MobX | 0.02 / 0.04 | 79.5 / 80 | 80.2 / 80.6 | 0.7 / 1.2 | 0.3 / 0.4 | 1 / 1 | 5–5 |
| reactive-prop-row | 10000 | 100 | 5 | Zustand | 0.02 / 0.08 | 1.1 / 1.2 | 1.5 / 2.3 | 0.3 / 1.2 | 0.2 / 0.2 | 2 / 2 | 10–10 |
| reactive-prop-row | 10000 | 100 | 5 | Valtio | 0.04 / 0.06 | 62.2 / 66.9 | 62.9 / 67.9 | 0.9 / 1 | 0.3 / 0.4 | 1 / 1 | 5–5 |
| memo-filter | 10000 | 1 | 5 | Kinstate | 33 / 130.56 | 45.6 / 77.6 | 106.4 / 142 | 60.8 / 64.4 | 2.6 / 3.1 | 1 / 1 | 5–5 |
| memo-filter | 10000 | 1 | 5 | MobX | 8.4 / 9.18 | 64.9 / 71.5 | 73.8 / 82.2 | 10 / 10.7 | 2.5 / 3.5 | 1 / 1 | 5–5 |
| memo-filter | 10000 | 1 | 5 | Zustand | 0.92 / 1.06 | 1.1 / 1.3 | 2.2 / 2.2 | 1.1 / 1.2 | 0 / 0.1 | 1 / 1 | 5–5 |
| memo-filter | 10000 | 1 | 5 | Valtio | 38.88 / 43.2 | 57.2 / 69.3 | 146.3 / 174.5 | 87 / 107.8 | 4.3 / 5.3 | 1 / 1 | 5–5 |
| nested-field | 1000 | 1 | 5 | Kinstate | 0.02 / 0.04 | 4.6 / 5.4 | 4.8 / 5.5 | 0.2 / 0.3 | 0.1 / 0.1 | 1 / 1 | 5–5 |
| nested-field | 1000 | 1 | 5 | MobX | 0.02 / 0.02 | 6.7 / 6.8 | 6.8 / 6.9 | 0.1 / 0.2 | 0 / 0.1 | 1 / 1 | 5–5 |
| nested-field | 1000 | 1 | 5 | Zustand | 0.02 / 0.1 | 0.2 / 0.3 | 0.2 / 0.3 | 0.1 / 0.1 | 0 / 0.1 | 1 / 1 | 5–5 |
| nested-field | 1000 | 1 | 5 | Valtio | 0.02 / 0.04 | 5.9 / 6.9 | 6 / 7.1 | 0.1 / 0.2 | 0 / 0.1 | 1 / 1 | 5–5 |
| api-payload | 1000 | 100 | 5 | Kinstate | 2.3 / 2.76 | 3.9 / 5.2 | 4.9 / 6.2 | 0.8 / 1 | 0.3 / 0.4 | 100 / 100 | 500–500 |
| api-payload | 1000 | 100 | 5 | MobX | 3.16 / 4.42 | 6 / 6.3 | 6.4 / 6.7 | 0.4 / 0.5 | 0.2 / 0.5 | 100 / 100 | 500–500 |
| api-payload | 1000 | 100 | 5 | Zustand | 0.06 / 0.18 | 0.2 / 0.2 | 0.5 / 0.6 | 0.3 / 0.4 | 0.1 / 0.2 | 1 / 1 | 5–5 |
| api-payload | 1000 | 100 | 5 | Valtio | 5.24 / 7.86 | 4.9 / 6.6 | 9.3 / 11.9 | 4.6 / 5.9 | 0.4 / 0.6 | 1 / 1 | 5–5 |
| filter-sort | 50000 | 1 | 5 | Kinstate | 100.46 / 212.42 | 277.9 / 317.3 | 561.4 / 583.6 | 266.3 / 290.5 | 6.2 / 9.2 | 1 / 1 | 5–5 |
| filter-sort | 50000 | 1 | 5 | MobX | 52.38 / 59.02 | 381.1 / 619.2 | 443 / 680.9 | 61.5 / 72.3 | 20.5 / 21.5 | 1 / 1 | 5–5 |
| filter-sort | 50000 | 1 | 5 | Zustand | 4.88 / 5.1 | 6.1 / 6.7 | 11.2 / 12 | 5.2 / 5.9 | 0 / 0.2 | 1 / 1 | 5–5 |
| filter-sort | 50000 | 1 | 5 | Valtio | 261 / 262.3 | 357.6 / 801.3 | 874 / 1,340.8 | 531.2 / 853.1 | 24.9 / 27.1 | 1 / 1 | 5–5 |
| reactive-prop-row | 1000 | 100 | 5 | Kinstate | 0.02 / 0.04 | 4.2 / 4.8 | 5.1 / 5.8 | 0.9 / 1 | 0.2 / 0.3 | 1 / 1 | 5–5 |
| reactive-prop-row | 1000 | 100 | 5 | MobX | 0.02 / 0.02 | 5.9 / 6.3 | 6.4 / 7.1 | 0.5 / 0.8 | 0.2 / 0.3 | 1 / 1 | 5–5 |
| reactive-prop-row | 1000 | 100 | 5 | Zustand | 0.02 / 0.04 | 0.1 / 0.1 | 0.3 / 0.7 | 0.3 / 0.6 | 0.2 / 0.2 | 2 / 2 | 10–10 |
| reactive-prop-row | 1000 | 100 | 5 | Valtio | 0.02 / 0.04 | 5.3 / 6.2 | 6 / 6.9 | 0.7 / 0.7 | 0.1 / 0.3 | 1 / 1 | 5–5 |
| batch-100 | 1000 | 1 | 5 | Kinstate | 0.06 / 0.08 | 4.3 / 4.7 | 4.4 / 4.8 | 0.1 / 0.2 | 0 / 0.1 | 1 / 1 | 5–5 |
| batch-100 | 1000 | 1 | 5 | MobX | 0.04 / 0.08 | 6 / 6.5 | 6.1 / 6.6 | 0.1 / 0.2 | 0 / 0.1 | 1 / 1 | 5–5 |
| batch-100 | 1000 | 1 | 5 | Zustand | 0.02 / 0.02 | 0.1 / 0.2 | 0.1 / 0.3 | 0 / 0.1 | 0 / 0.1 | 1 / 1 | 5–5 |
| batch-100 | 1000 | 1 | 5 | Valtio | 0.1 / 0.12 | 5.1 / 5.2 | 9.4 / 10.2 | 4.3 / 5.1 | 0.2 / 0.2 | 1 / 1 | 5–5 |
| array-visible-row | 1000 | 100 | 5 | Kinstate | 0.02 / 0.06 | 4 / 4.2 | 4.7 / 5.1 | 0.7 / 0.9 | 0.2 / 0.3 | 1 / 1 | 5–5 |
| array-visible-row | 1000 | 100 | 5 | MobX | 0.02 / 0.04 | 6.3 / 7.2 | 6.7 / 7.6 | 0.4 / 0.5 | 0.2 / 0.3 | 1 / 1 | 5–5 |
| array-visible-row | 1000 | 100 | 5 | Zustand | 0.04 / 0.04 | 0.1 / 0.2 | 0.3 / 0.4 | 0.2 / 0.3 | 0.1 / 0.2 | 1 / 1 | 5–5 |
| array-visible-row | 1000 | 100 | 5 | Valtio | 0.02 / 0.04 | 5.1 / 6 | 6 / 6.7 | 0.7 / 1.2 | 0.1 / 0.2 | 1 / 1 | 5–5 |
| normalized-row | 10000 | 100 | 5 | Kinstate | 0.04 / 0.04 | 40.5 / 451.8 | 41.2 / 454.2 | 0.8 / 2.4 | 0.3 / 0.4 | 1 / 1 | 5–5 |
| normalized-row | 10000 | 100 | 5 | MobX | 0.02 / 0.04 | 79.5 / 79.7 | 79.9 / 80.2 | 0.5 / 0.6 | 0.3 / 0.4 | 1 / 1 | 5–5 |
| normalized-row | 10000 | 100 | 5 | Zustand | 0.02 / 0.04 | 1.1 / 1.3 | 1.5 / 1.6 | 0.3 / 0.4 | 0.2 / 0.2 | 1 / 1 | 5–5 |
| normalized-row | 10000 | 100 | 5 | Valtio | 0.04 / 0.04 | 62.8 / 69.6 | 63.6 / 70.3 | 0.7 / 3.1 | 0.3 / 0.3 | 1 / 1 | 5–5 |
| full-list-row | 5000 | 5000 | 5 | Kinstate | 0.58 / 3.08 | 18.4 / 35.5 | 55.4 / 82.4 | 37.6 / 46.9 | 11.2 / 12.3 | 1 / 1 | 5–5 |
| full-list-row | 5000 | 5000 | 5 | MobX | 0.38 / 0.44 | 33.1 / 40.7 | 50.3 / 56.9 | 17.2 / 20.3 | 10.4 / 11 | 1 / 1 | 5–5 |
| full-list-row | 5000 | 5000 | 5 | Zustand | 0.58 / 0.7 | 0.5 / 0.6 | 8.7 / 12.4 | 8.2 / 11.8 | 6.4 / 7.7 | 1 / 1 | 5–5 |
| full-list-row | 5000 | 5000 | 5 | Valtio | 0.42 / 2.66 | 31.1 / 219.3 | 60.5 / 250 | 30.7 / 42.5 | 10.1 / 11.6 | 1 / 1 | 5–5 |
| persist-json | 10000 | 1 | 5 | Kinstate | 25.68 / 26.76 | 42.7 / 47.2 | 43 / 47.4 | 0.2 / 0.3 | 0.1 / 0.2 | 1 / 1 | 5–5 |
| persist-json | 10000 | 1 | 5 | MobX | 23.76 / 24.18 | 73 / 78.3 | 73.3 / 78.5 | 0.2 / 0.4 | 0 / 0.2 | 1 / 1 | 5–5 |
| persist-json | 10000 | 1 | 5 | Zustand | 1.36 / 1.46 | 1.1 / 1.7 | 1.2 / 1.8 | 0.1 / 0.1 | 0.1 / 0.1 | 1 / 1 | 5–5 |
| persist-json | 10000 | 1 | 5 | Valtio | 11.4 / 12.72 | 59.2 / 66.3 | 60.6 / 66.5 | 0.2 / 2.9 | 0.1 / 0.2 | 1 / 1 | 5–5 |
| unrelated | 1000 | 1 | 5 | Kinstate | 0 / 0 | 3.9 / 6.1 | 4.1 / 6.4 | 0.2 / 0.3 | 0.1 / 0.1 | 0 / 0 | 0–0 |
| unrelated | 1000 | 1 | 5 | MobX | 0 / 0.02 | 5.8 / 7 | 5.9 / 7 | 0.1 / 0.1 | 0.1 / 0.2 | 0 / 0 | 0–0 |
| unrelated | 1000 | 1 | 5 | Zustand | 0 / 0.02 | 0.1 / 0.2 | 0.2 / 0.3 | 0 / 0.1 | 0.1 / 0.1 | 0 / 0 | 0–0 |
| unrelated | 1000 | 1 | 5 | Valtio | 0.04 / 0.16 | 5.4 / 6 | 9.7 / 10.7 | 4.3 / 4.7 | 0.2 / 0.3 | 0 / 0 | 0–0 |
| memo-local-render | 1000 | 100 | 5 | Kinstate | 0.24 / 0.26 | 4.6 / 5.4 | 5.2 / 6.1 | 0.6 / 0.7 | 0.4 / 0.6 | 100 / 100 | 500–500 |
| memo-local-render | 1000 | 100 | 5 | MobX | 0.14 / 0.26 | 6.7 / 6.8 | 7.1 / 7.6 | 0.3 / 0.8 | 0.3 / 0.3 | 100 / 100 | 500–500 |
| memo-local-render | 1000 | 100 | 5 | Zustand | 0.14 / 0.18 | 0.2 / 0.2 | 0.4 / 0.4 | 0.2 / 0.3 | 0.3 / 0.3 | 100 / 100 | 500–500 |
| memo-local-render | 1000 | 100 | 5 | Valtio | 0.18 / 0.2 | 6.3 / 6.9 | 10.7 / 11.7 | 4.7 / 4.9 | 0.5 / 0.5 | 100 / 100 | 500–500 |
| api-frozen | 1000 | 100 | 5 | Kinstate | 1.94 / 2.12 | 4.2 / 4.4 | 4.8 / 5.1 | 0.7 / 0.7 | 0.2 / 0.2 | 100 / 100 | 500–500 |
| api-frozen | 1000 | 100 | 5 | MobX | 3.86 / 4.24 | 5.8 / 5.9 | 6.1 / 6.2 | 0.3 / 0.4 | 0.2 / 0.3 | 100 / 100 | 500–500 |
| api-frozen | 1000 | 100 | 5 | Zustand | 0.08 / 0.1 | 0.1 / 0.1 | 0.3 / 0.4 | 0.2 / 0.3 | 0.1 / 0.2 | 1 / 1 | 5–5 |
| api-frozen | 1000 | 100 | 5 | Valtio | 1.06 / 1.34 | 5.1 / 7 | 9.2 / 13.1 | 4.1 / 6.1 | 0.3 / 0.3 | 1 / 1 | 5–5 |
| immutable-input-filter | 1000 | 1 | 5 | Kinstate | 7.12 / 7.72 | 4 / 4.4 | 6.8 / 7.5 | 2.8 / 3.1 | 0.2 / 0.3 | 1 / 1 | 5–5 |
| immutable-input-filter | 1000 | 1 | 5 | MobX | 0.16 / 0.22 | 3.4 / 3.8 | 3.6 / 4 | 0.2 / 0.3 | 0 / 0 | 1 / 1 | 5–5 |
| immutable-input-filter | 1000 | 1 | 5 | Zustand | 0.18 / 0.24 | 0.2 / 0.2 | 0.4 / 0.5 | 0.2 / 0.3 | 0.1 / 0.1 | 1 / 1 | 5–5 |
| immutable-input-filter | 1000 | 1 | 5 | Valtio | 0.2 / 0.26 | 3 / 3.9 | 5 / 7 | 2.1 / 3.1 | 0.1 / 0.2 | 1 / 1 | 5–5 |
| array-reorder | 10000 | 100 | 5 | Kinstate | 1.02 / 1.28 | 41 / 284.5 | 42 / 288.3 | 1.7 / 3.8 | 0.4 / 0.5 | 100 / 100 | 500–500 |
| array-reorder | 10000 | 100 | 5 | MobX | 0.74 / 0.88 | 69.2 / 72.2 | 69.6 / 72.6 | 0.4 / 0.5 | 0.3 / 0.3 | 100 / 100 | 500–500 |
| array-reorder | 10000 | 100 | 5 | Zustand | 0.1 / 0.12 | 1 / 1.1 | 1.3 / 1.5 | 0.3 / 0.4 | 0.2 / 0.3 | 100 / 100 | 500–500 |
| array-reorder | 10000 | 100 | 5 | Valtio | 46.78 / 50.78 | 64.4 / 84.2 | 134.6 / 139.5 | 65 / 74.4 | 6.2 / 7.6 | 100 / 100 | 500–500 |
| array-reorder | 1000 | 100 | 5 | Kinstate | 0.38 / 0.38 | 3.9 / 4.1 | 4.5 / 4.9 | 0.6 / 0.8 | 0.2 / 0.5 | 100 / 100 | 500–500 |
| array-reorder | 1000 | 100 | 5 | MobX | 0.24 / 0.38 | 5.9 / 6.6 | 6.4 / 7.3 | 0.3 / 0.7 | 0.2 / 0.3 | 100 / 100 | 500–500 |
| array-reorder | 1000 | 100 | 5 | Zustand | 0.1 / 0.16 | 0.1 / 0.2 | 0.3 / 0.5 | 0.2 / 0.3 | 0.2 / 0.3 | 100 / 100 | 500–500 |
| array-reorder | 1000 | 100 | 5 | Valtio | 3.5 / 3.7 | 5.1 / 5.5 | 9.2 / 10.4 | 4.1 / 4.9 | 0.4 / 0.5 | 100 / 100 | 500–500 |
| array-remove | 1000 | 1 | 5 | Kinstate | 0.02 / 0.04 | 3.9 / 4.1 | 4.1 / 4.2 | 0.1 / 0.2 | 0 / 0.1 | 1 / 1 | 5–5 |
| array-remove | 1000 | 1 | 5 | MobX | 0.02 / 0.02 | 6.5 / 7.3 | 6.7 / 7.5 | 0.2 / 0.3 | 0.1 / 0.1 | 1 / 1 | 5–5 |
| array-remove | 1000 | 1 | 5 | Zustand | 0 / 0.02 | 0.2 / 0.2 | 0.2 / 0.3 | 0 / 0.1 | 0 / 0 | 1 / 1 | 5–5 |
| array-remove | 1000 | 1 | 5 | Valtio | 0.88 / 1.06 | 5.2 / 6.1 | 9.2 / 10.1 | 4 / 4.1 | 0.2 / 0.3 | 1 / 1 | 5–5 |
| append | 10000 | 1 | 5 | Kinstate | 0.04 / 0.06 | 44.6 / 56.6 | 45 / 57.7 | 0.3 / 1.1 | 0.2 / 0.3 | 1 / 1 | 5–5 |
| append | 10000 | 1 | 5 | MobX | 0.02 / 0.04 | 71.9 / 84.6 | 72 / 84.8 | 0.1 / 0.2 | 0.1 / 0.4 | 1 / 1 | 5–5 |
| append | 10000 | 1 | 5 | Zustand | 0.02 / 0.08 | 1.1 / 1.2 | 1.2 / 1.3 | 0.1 / 0.2 | 0 / 0.1 | 1 / 1 | 5–5 |
| append | 10000 | 1 | 5 | Valtio | 18.46 / 20.18 | 66.6 / 381.7 | 122 / 439.2 | 57.5 / 70.9 | 4.9 / 6.8 | 1 / 1 | 5–5 |
| array-offscreen-row | 10000 | 100 | 5 | Kinstate | 0 / 0 | 44.6 / 55.1 | 45.5 / 57.6 | 0.8 / 2.5 | 0.4 / 0.5 | 0 / 0 | 0–0 |
| array-offscreen-row | 10000 | 100 | 5 | MobX | 0 / 0.02 | 73.6 / 82.4 | 74.1 / 82.8 | 0.5 / 0.5 | 0.3 / 0.3 | 0 / 0 | 0–0 |
| array-offscreen-row | 10000 | 100 | 5 | Zustand | 0.02 / 0.04 | 1.2 / 2.5 | 1.5 / 2.9 | 0.3 / 0.4 | 0.2 / 0.2 | 0 / 0 | 0–0 |
| array-offscreen-row | 10000 | 100 | 5 | Valtio | 0 / 0 | 62.7 / 65.8 | 63.3 / 68.8 | 0.7 / 3 | 0.3 / 0.7 | 0 / 0 | 0–0 |
| array-remove | 50000 | 1 | 5 | Kinstate | 0.04 / 0.06 | 289.3 / 308.3 | 290.5 / 309.3 | 1.1 / 1.2 | 0.2 / 0.2 | 1 / 1 | 5–5 |
| array-remove | 50000 | 1 | 5 | MobX | 0.02 / 0.02 | 382.8 / 514.5 | 383 / 514.7 | 0.2 / 0.3 | 0.1 / 0.1 | 1 / 1 | 5–5 |
| array-remove | 50000 | 1 | 5 | Zustand | 0.12 / 0.14 | 5.9 / 1,011.4 | 6 / 1,011.6 | 0.1 / 0.2 | 0.1 / 0.1 | 1 / 1 | 5–5 |
| array-remove | 50000 | 1 | 5 | Valtio | 97.5 / 101.02 | 358.4 / 416.7 | 685.4 / 1,389.7 | 329.6 / 1,019.9 | 26.9 / 31 | 1 / 1 | 5–5 |
| array-offscreen-row | 1000 | 100 | 5 | Kinstate | 0 / 0.02 | 4 / 4.6 | 5 / 5.9 | 0.9 / 1.3 | 0.1 / 0.3 | 0 / 0 | 0–0 |
| array-offscreen-row | 1000 | 100 | 5 | MobX | 0 / 0.02 | 6.1 / 7 | 6.5 / 7.4 | 0.3 / 0.4 | 0.2 / 0.3 | 0 / 0 | 0–0 |
| array-offscreen-row | 1000 | 100 | 5 | Zustand | 0 / 0.02 | 0.1 / 0.3 | 0.4 / 0.6 | 0.2 / 0.3 | 0.2 / 0.2 | 0 / 0 | 0–0 |
| array-offscreen-row | 1000 | 100 | 5 | Valtio | 0 / 0 | 5.1 / 5.8 | 5.8 / 6.5 | 0.7 / 0.7 | 0.2 / 0.3 | 0 / 0 | 0–0 |
| array-remove | 10000 | 1 | 5 | Kinstate | 0.02 / 0.04 | 45.4 / 57.5 | 45.6 / 57.7 | 0.2 / 0.2 | 0.1 / 0.1 | 1 / 1 | 5–5 |
| array-remove | 10000 | 1 | 5 | MobX | 0.02 / 0.02 | 75.2 / 825.5 | 75.4 / 825.8 | 0.2 / 0.3 | 0.2 / 0.2 | 1 / 1 | 5–5 |
| array-remove | 10000 | 1 | 5 | Zustand | 0.02 / 0.02 | 1.3 / 1.4 | 1.3 / 1.6 | 0.1 / 0.2 | 0 / 0.1 | 1 / 1 | 5–5 |
| array-remove | 10000 | 1 | 5 | Valtio | 17.84 / 21.02 | 65.8 / 71.1 | 127.1 / 142.9 | 62.5 / 73.6 | 5.3 / 14 | 1 / 1 | 5–5 |
| append | 50000 | 1 | 5 | Kinstate | 0.04 / 0.1 | 278.7 / 287.7 | 280.5 / 288.7 | 0.3 / 1.8 | 0.2 / 0.2 | 1 / 1 | 5–5 |
| append | 50000 | 1 | 5 | MobX | 0.04 / 0.06 | 382.1 / 925.6 | 382.2 / 925.9 | 0.1 / 0.3 | 0.1 / 0.2 | 1 / 1 | 5–5 |
| append | 50000 | 1 | 5 | Zustand | 0.3 / 0.3 | 6.6 / 474.4 | 6.6 / 474.6 | 0 / 0.2 | 0.1 / 0.2 | 1 / 1 | 5–5 |
| append | 50000 | 1 | 5 | Valtio | 104.72 / 423.32 | 348.7 / 378.3 | 690.9 / 721 | 337.1 / 358.5 | 26 / 27.5 | 1 / 1 | 5–5 |
| reactive-prop-row | 50000 | 100 | 5 | Kinstate | 0.04 / 0.12 | 284.5 / 491.1 | 287.9 / 494.4 | 3.4 / 4.3 | 0.5 / 0.8 | 1 / 1 | 5–5 |
| reactive-prop-row | 50000 | 100 | 5 | MobX | 0.02 / 0.14 | 375.2 / 385.2 | 376.2 / 385.9 | 0.7 / 2.6 | 0.6 / 1.5 | 1 / 1 | 5–5 |
| reactive-prop-row | 50000 | 100 | 5 | Zustand | 0.12 / 0.24 | 7.2 / 214.7 | 8.3 / 215.2 | 0.5 / 1.1 | 0.3 / 0.6 | 2 / 2 | 10–10 |
| reactive-prop-row | 50000 | 100 | 5 | Valtio | 0.04 / 0.08 | 367.3 / 1,129.9 | 370.3 / 1,135.4 | 3 / 5.5 | 0.4 / 0.4 | 1 / 1 | 5–5 |
| memo-filter | 50000 | 1 | 5 | Kinstate | 180.6 / 187.34 | 294.5 / 339.1 | 758.2 / 818.1 | 452.1 / 479 | 11.1 / 15.6 | 1 / 1 | 5–5 |
| memo-filter | 50000 | 1 | 5 | MobX | 55.38 / 60.8 | 385.2 / 435.2 | 448.7 / 504.3 | 63.5 / 73.9 | 25.2 / 723.7 | 1 / 1 | 5–5 |
| memo-filter | 50000 | 1 | 5 | Zustand | 5.58 / 6.22 | 6.9 / 7.2 | 12.5 / 13.1 | 5.8 / 5.9 | 0.1 / 0.2 | 1 / 1 | 5–5 |
| memo-filter | 50000 | 1 | 5 | Valtio | 270.48 / 278.26 | 377.4 / 429.1 | 933.5 / 1,774.9 | 559.9 / 1,352.5 | 28.2 / 32.7 | 1 / 1 | 5–5 |
| persist-json | 1000 | 1 | 5 | Kinstate | 1.94 / 2.16 | 4.6 / 5.3 | 4.8 / 5.5 | 0.2 / 0.3 | 0.1 / 0.1 | 1 / 1 | 5–5 |
| persist-json | 1000 | 1 | 5 | MobX | 2.36 / 3.04 | 6.7 / 7.7 | 6.9 / 7.9 | 0.2 / 0.2 | 0.1 / 0.1 | 1 / 1 | 5–5 |
| persist-json | 1000 | 1 | 5 | Zustand | 0.1 / 0.1 | 0.2 / 0.3 | 0.3 / 0.4 | 0.1 / 0.2 | 0 / 0.1 | 1 / 1 | 5–5 |
| persist-json | 1000 | 1 | 5 | Valtio | 0.9 / 1.14 | 4.8 / 6.8 | 5 / 6.9 | 0.2 / 0.3 | 0 / 0.1 | 1 / 1 | 5–5 |
| map-and-replace | 50000 | 100 | 5 | Kinstate | 292.68 / 299.2 | 300.7 / 333 | 303.6 / 336.7 | 3.7 / 21 | 0.4 / 0.5 | 100 / 100 | 500–500 |
| map-and-replace | 50000 | 100 | 5 | MobX | 432.24 / 530.68 | 391 / 403.4 | 391.7 / 403.9 | 0.5 / 0.7 | 0.4 / 0.5 | 100 / 100 | 500–500 |
| map-and-replace | 50000 | 100 | 5 | Zustand | 1.04 / 1.4 | 5.7 / 6.4 | 6.1 / 6.8 | 0.4 / 0.4 | 0.2 / 0.4 | 1 / 1 | 5–5 |
| map-and-replace | 50000 | 100 | 5 | Valtio | 730.3 / 801.7 | 343.3 / 379.5 | 698.3 / 727.5 | 346.4 / 355 | 24.8 / 27.2 | 1 / 1 | 5–5 |
| bulk-rows-100 | 10000 | 100 | 5 | Kinstate | 0.4 / 0.42 | 49.2 / 59 | 50.3 / 59.8 | 0.9 / 1.1 | 0.4 / 0.5 | 100 / 100 | 500–500 |
| bulk-rows-100 | 10000 | 100 | 5 | MobX | 0.24 / 0.5 | 79 / 84.8 | 79.5 / 85.2 | 0.4 / 0.6 | 0.4 / 0.4 | 100 / 100 | 500–500 |
| bulk-rows-100 | 10000 | 100 | 5 | Zustand | 0.12 / 0.14 | 1.2 / 1.2 | 1.4 / 1.5 | 0.2 / 0.3 | 0.2 / 0.2 | 100 / 100 | 500–500 |
| bulk-rows-100 | 10000 | 100 | 5 | Valtio | 0.48 / 0.48 | 66.7 / 68.2 | 67.4 / 69 | 0.8 / 0.8 | 0.3 / 0.4 | 100 / 100 | 500–500 |
| array-visible-row | 10000 | 100 | 5 | Kinstate | 0.02 / 0.04 | 54 / 69.5 | 56.4 / 72.5 | 1 / 13.6 | 0.3 / 0.9 | 1 / 1 | 5–5 |
| array-visible-row | 10000 | 100 | 5 | MobX | 0.02 / 0.02 | 78.6 / 82.6 | 79.1 / 83.1 | 0.5 / 0.5 | 0.3 / 0.3 | 1 / 1 | 5–5 |
| array-visible-row | 10000 | 100 | 5 | Zustand | 0.02 / 0.02 | 1.3 / 1.6 | 1.5 / 1.9 | 0.2 / 0.3 | 0.2 / 0.2 | 1 / 1 | 5–5 |
| array-visible-row | 10000 | 100 | 5 | Valtio | 0.02 / 0.04 | 68.1 / 1,006.9 | 68.9 / 1,018.6 | 0.9 / 11.7 | 0.3 / 0.3 | 1 / 1 | 5–5 |
| map-and-replace | 1000 | 100 | 5 | Kinstate | 5.04 / 6.38 | 4.1 / 4.8 | 4.9 / 5.5 | 0.7 / 0.8 | 0.3 / 0.5 | 100 / 100 | 500–500 |
| map-and-replace | 1000 | 100 | 5 | MobX | 6 / 7.22 | 6.2 / 8.1 | 6.6 / 8.5 | 0.4 / 0.5 | 0.3 / 0.9 | 100 / 100 | 500–500 |
| map-and-replace | 1000 | 100 | 5 | Zustand | 0.04 / 0.06 | 0.2 / 0.2 | 0.3 / 0.4 | 0.2 / 0.3 | 0.2 / 0.2 | 1 / 1 | 5–5 |
| map-and-replace | 1000 | 100 | 5 | Valtio | 7.72 / 8.74 | 6.1 / 7.1 | 10.5 / 13.3 | 4.5 / 6.2 | 0.4 / 0.7 | 1 / 1 | 5–5 |
| parent-rerender | 1000 | 100 | 5 | Kinstate | 0.04 / 0.08 | 4 / 4.6 | 4.4 / 5 | 0.4 / 0.4 | 0.1 / 0.2 | 0 / 0 | 0–0 |
| parent-rerender | 1000 | 100 | 5 | MobX | 0.04 / 0.04 | 5.7 / 6 | 6 / 6.4 | 0.3 / 0.7 | 0.2 / 0.2 | 0 / 0 | 0–0 |
| parent-rerender | 1000 | 100 | 5 | Zustand | 0.04 / 0.06 | 0.1 / 0.2 | 0.3 / 0.6 | 0.2 / 0.4 | 0.2 / 0.2 | 0 / 0 | 0–0 |
| parent-rerender | 1000 | 100 | 5 | Valtio | 0.06 / 0.06 | 5.2 / 5.4 | 9.3 / 9.7 | 4 / 4.5 | 0.4 / 0.7 | 0 / 0 | 0–0 |
| filter-sort | 1000 | 1 | 5 | Kinstate | 0.98 / 1.22 | 5 / 5.3 | 7.4 / 9.2 | 2.6 / 3.9 | 0.2 / 0.3 | 1 / 1 | 5–5 |
| filter-sort | 1000 | 1 | 5 | MobX | 0.96 / 1.32 | 6 / 7.1 | 7 / 8.4 | 1.2 / 1.3 | 0.2 / 0.3 | 1 / 1 | 5–5 |
| filter-sort | 1000 | 1 | 5 | Zustand | 0.12 / 0.12 | 0.1 / 0.2 | 0.3 / 0.5 | 0.2 / 0.3 | 0 / 0.1 | 1 / 1 | 5–5 |
| filter-sort | 1000 | 1 | 5 | Valtio | 3 / 4.34 | 6.4 / 7 | 13.7 / 15.4 | 7.5 / 8.4 | 0.4 / 0.4 | 1 / 1 | 5–5 |
| normalized-row | 1000 | 100 | 5 | Kinstate | 0.02 / 0.02 | 3.9 / 4.3 | 4.8 / 5 | 0.7 / 1.1 | 0.2 / 0.3 | 1 / 1 | 5–5 |
| normalized-row | 1000 | 100 | 5 | MobX | 0.02 / 0.04 | 5.7 / 5.8 | 6 / 6.2 | 0.3 / 0.5 | 0.2 / 0.3 | 1 / 1 | 5–5 |
| normalized-row | 1000 | 100 | 5 | Zustand | 0.02 / 0.02 | 0.2 / 0.2 | 0.4 / 0.5 | 0.2 / 0.3 | 0.1 / 0.3 | 1 / 1 | 5–5 |
| normalized-row | 1000 | 100 | 5 | Valtio | 0.02 / 0.04 | 5.1 / 5.4 | 5.8 / 6 | 0.6 / 0.7 | 0.2 / 0.2 | 1 / 1 | 5–5 |
| record-churn | 1000 | 1 | 5 | Kinstate | 0.02 / 0.02 | 4.1 / 4.5 | 4.2 / 4.7 | 0.1 / 0.6 | 0 / 0 | 0 / 0 | 0–0 |
| record-churn | 1000 | 1 | 5 | MobX | 0.02 / 0.02 | 5.3 / 6.4 | 5.4 / 6.4 | 0 / 0.2 | 0 / 0.1 | 0 / 0 | 0–0 |
| record-churn | 1000 | 1 | 5 | Zustand | 0.1 / 0.12 | 0.1 / 0.2 | 0.2 / 0.3 | 0.1 / 0.2 | 0 / 0.1 | 0 / 0 | 0–0 |
| record-churn | 1000 | 1 | 5 | Valtio | 0.5 / 0.54 | 5.5 / 7.3 | 9.2 / 11.7 | 4 / 4.4 | 0.2 / 0.3 | 0 / 0 | 0–0 |
| api-payload | 10000 | 100 | 5 | Kinstate | 28.4 / 30.62 | 58.7 / 65.3 | 61.5 / 68.4 | 1.5 / 3.1 | 0.5 / 0.6 | 100 / 100 | 500–500 |
| api-payload | 10000 | 100 | 5 | MobX | 30.44 / 32.64 | 69.4 / 696.3 | 69.9 / 696.9 | 0.5 / 0.6 | 0.4 / 0.8 | 100 / 100 | 500–500 |
| api-payload | 10000 | 100 | 5 | Zustand | 0.44 / 0.92 | 1.3 / 1.4 | 1.6 / 1.7 | 0.3 / 0.4 | 0.2 / 0.3 | 1 / 1 | 5–5 |
| api-payload | 10000 | 100 | 5 | Valtio | 72.26 / 77.96 | 65.4 / 75 | 137.4 / 140.2 | 69.7 / 76.6 | 5.5 / 7.1 | 1 / 1 | 5–5 |
| no-op | 1000 | 1 | 5 | Kinstate | 0 / 0 | 4.7 / 5.9 | 4.9 / 6.2 | 0.2 / 0.3 | 0 / 0.1 | 0 / 0 | 0–0 |
| no-op | 1000 | 1 | 5 | MobX | 0 / 0.02 | 6 / 6.5 | 6 / 6.7 | 0.1 / 0.2 | 0 / 0.1 | 0 / 0 | 0–0 |
| no-op | 1000 | 1 | 5 | Zustand | 0 / 0 | 0.1 / 0.2 | 0.2 / 0.4 | 0 / 0.2 | 0 / 0.1 | 0 / 0 | 0–0 |
| no-op | 1000 | 1 | 5 | Valtio | 0 / 0.02 | 5.8 / 6.2 | 10.5 / 10.6 | 4.5 / 4.8 | 0.2 / 0.5 | 0 / 0 | 0–0 |
| api-payload | 50000 | 100 | 5 | Kinstate | 164.94 / 177.78 | 307.8 / 311.2 | 314.2 / 328 | 3 / 20.2 | 0.4 / 0.5 | 100 / 100 | 500–500 |
| api-payload | 50000 | 100 | 5 | MobX | 153.24 / 158.94 | 391 / 2,235.3 | 392.1 / 2,235.9 | 0.6 / 1.3 | 0.4 / 0.5 | 100 / 100 | 500–500 |
| api-payload | 50000 | 100 | 5 | Zustand | 2.3 / 3.1 | 5.6 / 7.4 | 6 / 8.1 | 0.4 / 0.7 | 0.3 / 0.4 | 1 / 1 | 5–5 |
| api-payload | 50000 | 100 | 5 | Valtio | 510.52 / 843.06 | 375.2 / 1,734.7 | 719.2 / 2,072.5 | 337.8 / 347.4 | 24.3 / 25.9 | 1 / 1 | 5–5 |
| map-and-replace | 10000 | 100 | 5 | Kinstate | 56.16 / 59.62 | 46.9 / 559.8 | 47.8 / 562.8 | 0.9 / 3 | 0.4 / 0.4 | 100 / 100 | 500–500 |
| map-and-replace | 10000 | 100 | 5 | MobX | 56.16 / 57.84 | 67.9 / 80.3 | 68.4 / 80.9 | 0.5 / 0.6 | 0.4 / 0.5 | 100 / 100 | 500–500 |
| map-and-replace | 10000 | 100 | 5 | Zustand | 0.24 / 0.4 | 1.2 / 2.1 | 1.4 / 2.7 | 0.2 / 0.6 | 0.2 / 0.3 | 1 / 1 | 5–5 |
| map-and-replace | 10000 | 100 | 5 | Valtio | 83.84 / 87.22 | 68.7 / 1,568.1 | 131.5 / 1,652.6 | 63.6 / 84.5 | 4.6 / 5.2 | 1 / 1 | 5–5 |
| single-field | 1000 | 1 | 5 | Kinstate | 0.02 / 0.04 | 4.2 / 5.2 | 4.4 / 5.3 | 0.1 / 0.2 | 0 / 0.1 | 1 / 1 | 5–5 |
| single-field | 1000 | 1 | 5 | MobX | 0.02 / 0.02 | 6.3 / 7.5 | 6.4 / 7.6 | 0.1 / 0.1 | 0 / 0.1 | 1 / 1 | 5–5 |
| single-field | 1000 | 1 | 5 | Zustand | 0 / 0.06 | 0.2 / 0.3 | 0.3 / 0.4 | 0.1 / 0.2 | 0 / 0.1 | 1 / 1 | 5–5 |
| single-field | 1000 | 1 | 5 | Valtio | 0.1 / 0.12 | 6.1 / 6.5 | 10.7 / 11.5 | 4.7 / 5.3 | 0.2 / 0.4 | 1 / 1 | 5–5 |
| array-visible-row | 50000 | 100 | 5 | Kinstate | 0.04 / 0.06 | 305.4 / 315.7 | 306.6 / 318.9 | 1.2 / 3.5 | 0.4 / 0.7 | 1 / 1 | 5–5 |
| array-visible-row | 50000 | 100 | 5 | MobX | 0.02 / 0.04 | 387.8 / 1,085.5 | 388.3 / 1,086 | 0.6 / 0.6 | 0.3 / 0.4 | 1 / 1 | 5–5 |
| array-visible-row | 50000 | 100 | 5 | Zustand | 0.12 / 0.2 | 6.3 / 7.4 | 7.1 / 7.7 | 0.3 / 0.8 | 0.2 / 0.3 | 1 / 1 | 5–5 |
| array-visible-row | 50000 | 100 | 5 | Valtio | 0.04 / 0.04 | 362.9 / 1,466.4 | 363.7 / 1,470.6 | 0.9 / 4.2 | 0.3 / 0.4 | 1 / 1 | 5–5 |
| immutable-input-filter | 10000 | 1 | 5 | Kinstate | 83.08 / 208.38 | 41.7 / 63.4 | 82.1 / 107 | 42 / 45.4 | 11.6 / 13.5 | 1 / 1 | 5–5 |
| immutable-input-filter | 10000 | 1 | 5 | MobX | 1.54 / 2.76 | 34.3 / 44.1 | 35.4 / 45.1 | 1 / 1.1 | 0.1 / 0.2 | 1 / 1 | 5–5 |
| immutable-input-filter | 10000 | 1 | 5 | Zustand | 1.42 / 1.54 | 1.1 / 1.2 | 2.1 / 3.2 | 1 / 2 | 0 / 0 | 1 / 1 | 5–5 |
| immutable-input-filter | 10000 | 1 | 5 | Valtio | 2.22 / 4.1 | 30.8 / 46.5 | 53.9 / 80.8 | 23 / 36.1 | 1.9 / 4.1 | 1 / 1 | 5–5 |
| normalized-row | 50000 | 100 | 5 | Kinstate | 0.04 / 0.06 | 288.3 / 387.2 | 299.4 / 391.1 | 4 / 20.8 | 0.4 / 0.5 | 1 / 1 | 5–5 |
| normalized-row | 50000 | 100 | 5 | MobX | 0.02 / 0.04 | 362 / 699.6 | 362.6 / 700.3 | 0.6 / 0.7 | 0.4 / 0.5 | 1 / 1 | 5–5 |
| normalized-row | 50000 | 100 | 5 | Zustand | 0.16 / 0.2 | 5.5 / 5.7 | 5.9 / 6 | 0.3 / 0.4 | 0.2 / 0.3 | 1 / 1 | 5–5 |
| normalized-row | 50000 | 100 | 5 | Valtio | 0.02 / 0.04 | 369.4 / 746.5 | 370.7 / 750.6 | 4.2 / 4.8 | 0.3 / 0.3 | 1 / 1 | 5–5 |
| full-list-row | 1000 | 1000 | 5 | Kinstate | 0.12 / 0.14 | 4.2 / 5.9 | 11.3 / 11.5 | 6.2 / 7.4 | 2.2 / 2.5 | 1 / 1 | 5–5 |
| full-list-row | 1000 | 1000 | 5 | MobX | 0.08 / 0.1 | 5.7 / 6.4 | 8.4 / 9.2 | 2.7 / 2.8 | 1.7 / 2.5 | 1 / 1 | 5–5 |
| full-list-row | 1000 | 1000 | 5 | Zustand | 0.12 / 0.14 | 0.2 / 0.2 | 1.6 / 1.9 | 1.5 / 1.7 | 1.3 / 1.7 | 1 / 1 | 5–5 |
| full-list-row | 1000 | 1000 | 5 | Valtio | 0.1 / 0.1 | 6 / 6.4 | 11.7 / 14.7 | 5.8 / 8.3 | 1.4 / 1.4 | 1 / 1 | 5–5 |
| bulk-rows-100 | 50000 | 100 | 5 | Kinstate | 0.5 / 0.76 | 294.6 / 373.3 | 298.1 / 376.4 | 1 / 3.5 | 0.5 / 0.5 | 100 / 100 | 500–500 |
| bulk-rows-100 | 50000 | 100 | 5 | MobX | 0.36 / 1.6 | 361.3 / 765.4 | 361.8 / 766 | 0.6 / 0.8 | 0.3 / 0.4 | 100 / 100 | 500–500 |
| bulk-rows-100 | 50000 | 100 | 5 | Zustand | 0.18 / 0.26 | 6 / 6.9 | 6.3 / 7.1 | 0.3 / 0.3 | 0.3 / 0.4 | 100 / 100 | 500–500 |
| bulk-rows-100 | 50000 | 100 | 5 | Valtio | 0.6 / 0.94 | 367.3 / 376.6 | 372.2 / 381.6 | 4.6 / 5 | 0.4 / 1.2 | 100 / 100 | 500–500 |
| array-offscreen-row | 50000 | 100 | 5 | Kinstate | 0 / 0.02 | 283.5 / 311.3 | 287.5 / 314.9 | 3.6 / 5.6 | 0.6 / 0.8 | 0 / 0 | 0–0 |
| array-offscreen-row | 50000 | 100 | 5 | MobX | 0 / 0.02 | 398 / 703.5 | 399.9 / 704.4 | 0.9 / 1.9 | 0.5 / 0.8 | 0 / 0 | 0–0 |
| array-offscreen-row | 50000 | 100 | 5 | Zustand | 0.14 / 0.18 | 6.4 / 6.7 | 6.7 / 7.1 | 0.4 / 0.5 | 0.2 / 0.4 | 0 / 0 | 0–0 |
| array-offscreen-row | 50000 | 100 | 5 | Valtio | 0 / 0 | 362.1 / 374.8 | 366.9 / 376.2 | 4 / 5.7 | 0.4 / 0.7 | 0 / 0 | 0–0 |
| filter-sort | 10000 | 1 | 5 | Kinstate | 16.22 / 18.3 | 41.9 / 59 | 81 / 110 | 33 / 51 | 1.4 / 13.2 | 1 / 1 | 5–5 |
| filter-sort | 10000 | 1 | 5 | MobX | 10.42 / 11.34 | 67.9 / 71.5 | 80 / 83.4 | 11.9 / 13 | 2.8 / 5.9 | 1 / 1 | 5–5 |
| filter-sort | 10000 | 1 | 5 | Zustand | 0.98 / 1.22 | 1.2 / 1.6 | 2.7 / 3.3 | 1.2 / 2.2 | 0.1 / 0.1 | 1 / 1 | 5–5 |
| filter-sort | 10000 | 1 | 5 | Valtio | 43.48 / 44.08 | 62.4 / 365.9 | 158.5 / 474.8 | 103.7 / 110.2 | 4.5 / 6.2 | 1 / 1 | 5–5 |
| immutable-input-filter | 50000 | 1 | 5 | Kinstate | 488.5 / 816.58 | 284.2 / 302 | 564.7 / 1,949.4 | 272.5 / 1,659.8 | 9.3 / 10.8 | 1 / 1 | 5–5 |
| immutable-input-filter | 50000 | 1 | 5 | MobX | 7.28 / 9.36 | 216.2 / 219.1 | 221.2 / 224 | 5 / 5.8 | 0.1 / 0.2 | 1 / 1 | 5–5 |
| immutable-input-filter | 50000 | 1 | 5 | Zustand | 7.3 / 8.84 | 6.1 / 6.7 | 11.1 / 11.6 | 4.9 / 5 | 0 / 0.1 | 1 / 1 | 5–5 |
| immutable-input-filter | 50000 | 1 | 5 | Valtio | 21.14 / 23.66 | 189 / 199.1 | 352.3 / 355.2 | 156.1 / 167.9 | 14.6 / 24.5 | 1 / 1 | 5–5 |
| bulk-rows-100 | 1000 | 100 | 5 | Kinstate | 0.46 / 0.54 | 4.4 / 4.7 | 5.4 / 5.6 | 0.8 / 1.2 | 0.3 / 0.4 | 100 / 100 | 500–500 |
| bulk-rows-100 | 1000 | 100 | 5 | MobX | 0.26 / 0.4 | 6.1 / 6.7 | 6.5 / 7.3 | 0.4 / 0.6 | 0.2 / 0.3 | 100 / 100 | 500–500 |
| bulk-rows-100 | 1000 | 100 | 5 | Zustand | 0.12 / 0.12 | 0.2 / 0.2 | 0.4 / 0.4 | 0.2 / 0.3 | 0.2 / 0.3 | 100 / 100 | 500–500 |
| bulk-rows-100 | 1000 | 100 | 5 | Valtio | 0.56 / 0.62 | 5.4 / 6.2 | 6.1 / 6.9 | 0.6 / 0.7 | 0.2 / 0.3 | 100 / 100 | 500–500 |

## Workloads

- **persist-json:** Edit one row, then serialize the same canonical {count, rows} projection and synchronously write it to localStorage. Every adapter uses the same harness-owned JSON/storage path; quota preflight is excluded and final persisted contents are verified.
- **append:** Append a record to the collection.
- **shared-fanout:** Update one shared field observed by all consumers.
- **memo-filter:** Memoized filter/sort presentation with one consumer. Kinstate uses authored React useMemo reading live rows; MobX uses its tracked computed getter before React memoization, and immutable adapters cache by row-array identity. Same sorting/projection and output, idiomatic dependency ownership.
- **api-frozen:** Create a deeply frozen incoming row payload and assign it. Includes identical source allocation/freezing and each library's ownership and adoption costs.
- **conditional:** Alternate branch switches, writes to the inactive branch, and writes to the active branch, exercising dependency replacement.
- **array-reorder:** Reverse the array while 100 consumers observe their current row index.
- **reactive-prop-row:** Pass a live row into a compiled receiving child (Kinstate), an observer child (MobX), an immutable row prop (Zustand), or a scoped snapshot child (Valtio). Count both parent and child render calls; edit one visible row.
- **nested-field:** Update one field inside a nested object.
- **api-payload:** Create a fresh plain incoming payload without reading existing reactive rows, then assign it. Includes identical payload allocation and library-specific adoption costs.
- **filter-sort:** Promote one source row, filter and sort the collection into its top 100 entries, and render the first result in one consumer.
- **batch-100:** Perform 100 synchronous field mutations in each scheduled operation.
- **array-visible-row:** Edit a row rendered by the mounted list consumers.
- **normalized-row:** Edit one record addressed by its key in normalized state.
- **full-list-row:** Mount one DOM consumer for every record, then edit one row. Collection size equals mounted consumer count; no virtualization.
- **unrelated:** Change an unobserved field while every mounted consumer observes another field.
- **memo-local-render:** Force 100 consumer renders through a changing React prop while service inputs remain unchanged. Compare component-local memo cache hits and cached dependency replay; all use React useMemo.
- **immutable-input-filter:** Filter/sort newly published immutable API payloads. The source only replaces its collection. Kinstate serviceInputs copies plain data into service-owned reactive state; MobX observable.ref, Valtio ref and Zustand retain replacement-only storage. Includes payload allocation, adoption and filtering/sorting. Ownership costs differ; historical borrowed-input Kinstate timings are incompatible.
- **array-remove:** Remove the last row and observe collection length.
- **array-offscreen-row:** Edit a row outside the mounted consumer window; no virtualization library is involved.
- **map-and-replace:** Map the existing reactive array into fresh row objects, change the first value, and replace the array. Includes reading observable rows and allocating/reobserving the replacement; this is not a plain incoming API payload assignment.
- **bulk-rows-100:** Edit 100 distinct row values in one logical transaction. Each library publishes one batch; Zustand copies the array once.
- **parent-rerender:** Rerender the parent, including the service provider, while memoized consumers retain unchanged props and state. Measures memo bailout overhead.
- **record-churn:** Insert and delete a transient record key within one transaction; visible state remains unchanged. Heap retention is tested separately.
- **no-op:** Assign the current value back to itself. Measures the equality-check and scheduling floor without a state change.
- **single-field:** Update a primitive field observed by one mounted consumer.

## Environment

| Field | Value |
| --- | --- |
| provenance | {"commit":"9fa25e691ba06f60ddff9019b6da7c57ef4a9c34","dirty":true,"dirtyPaths":["M benchmarks/run.tsx"," M docs/ARCHITECTURE.md"," M docs/COMPILER.md"," M packages/core/src/internal.ts"," M packages/core/src/reactive.ts"," M packages/react/src/memo-cache.ts"," M packages/react/src/render-frame.ts"," M packages/react/src/service-view.ts"," M packages/react/src/use-service-memo.ts"," M packages/react/test/memo-bookkeeping.test.ts","?? benchmarks/diagnostics/","?? packages/core/test/frozen-read-complexity.test.ts","?? packages/core/test/reactive-reader.test.ts","?? packages/react/src/memo-observation.ts","?? packages/react/test/memo-observation.test.tsx","?? packages/react/test/render-frame-validation.test.ts"],"sourceHash":"bfd8c10ae0fac18186404a080a076180237c0f2a57660903ed4c54a7b26dc185","lockfileHash":"60f1cfd79190a039061fea5b3b106d4a55c873a9ee18e3b58bb72881f5ca139e","buildHash":"9c2b50b1f3141d58579c8f1bb31b937df99a381d04dc87080ba1976ecffbaab6"} |
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

Lower is better. Median matched-block candidate/MobX ratios; noninferiority threshold 1.05× (5% tolerance), not a claim of exact equality. 95% nominal family-wise order-statistic intervals across 285 comparisons. No aggregate timing score.

| Workload | Size | Metric | Kinstate | MobX | Ratio | Interval | Verdict | Evidence / limitation |
| --- | ---: | --- | ---: | ---: | ---: | --- | --- | --- |
| no-op | 1000 | update | 0.0000 | 0.0000 | — | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| no-op | 1000 | setup | 4.7000 | 6.0000 | 0.7903 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| no-op | 1000 | mount | 0.2000 | 0.1000 | — | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| no-op | 1000 | startup | 4.9000 | 6.0000 | 0.8095 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| no-op | 1000 | unmount | 0.0000 | 0.0000 | — | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| full-list-row | 1000 | update | 0.1200 | 0.0800 | 1.5000 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| full-list-row | 1000 | setup | 4.2000 | 5.7000 | 0.7368 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| full-list-row | 1000 | mount | 6.2000 | 2.7000 | 2.2800 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| full-list-row | 1000 | startup | 11.3000 | 8.4000 | 1.2976 | — | inconclusive | Requires at least 21 independent trial blocks |
| full-list-row | 1000 | unmount | 2.2000 | 1.7000 | 1.1875 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| full-list-row | 5000 | update | 0.5800 | 0.3800 | 1.3810 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| full-list-row | 5000 | setup | 18.4000 | 33.1000 | 0.6284 | — | inconclusive | Requires at least 21 independent trial blocks |
| full-list-row | 5000 | mount | 37.6000 | 17.2000 | 2.0922 | — | inconclusive | Requires at least 21 independent trial blocks |
| full-list-row | 5000 | startup | 55.4000 | 50.3000 | 1.1787 | — | inconclusive | Requires at least 21 independent trial blocks |
| full-list-row | 5000 | unmount | 11.2000 | 10.4000 | 1.0769 | — | inconclusive | Requires at least 21 independent trial blocks |
| unrelated | 1000 | update | 0.0000 | 0.0000 | — | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| unrelated | 1000 | setup | 3.9000 | 5.8000 | 0.6724 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| unrelated | 1000 | mount | 0.2000 | 0.1000 | — | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| unrelated | 1000 | startup | 4.1000 | 5.9000 | 0.6949 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| unrelated | 1000 | unmount | 0.1000 | 0.1000 | — | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| single-field | 1000 | update | 0.0200 | 0.0200 | 1.0000 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| single-field | 1000 | setup | 4.2000 | 6.3000 | 0.7000 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| single-field | 1000 | mount | 0.1000 | 0.1000 | — | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| single-field | 1000 | startup | 4.4000 | 6.4000 | 0.7213 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| single-field | 1000 | unmount | 0.0000 | 0.0000 | — | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| shared-fanout | 1000 | update | 0.3000 | 0.1600 | 1.6250 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| shared-fanout | 1000 | setup | 4.3000 | 7.0000 | 0.6167 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| shared-fanout | 1000 | mount | 0.4000 | 0.5000 | 0.8000 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| shared-fanout | 1000 | startup | 4.7000 | 7.5000 | 0.6308 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| shared-fanout | 1000 | unmount | 0.3000 | 0.4000 | 0.7500 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| conditional | 1000 | update | 0.0200 | 0.0000 | — | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| conditional | 1000 | setup | 4.0000 | 5.9000 | 0.6897 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| conditional | 1000 | mount | 0.1000 | 0.1000 | — | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| conditional | 1000 | startup | 4.1000 | 6.0000 | 0.6949 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| conditional | 1000 | unmount | 0.0000 | 0.1000 | — | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| nested-field | 1000 | update | 0.0200 | 0.0200 | — | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| nested-field | 1000 | setup | 4.6000 | 6.7000 | 0.6765 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| nested-field | 1000 | mount | 0.2000 | 0.1000 | — | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| nested-field | 1000 | startup | 4.8000 | 6.8000 | 0.7015 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| nested-field | 1000 | unmount | 0.1000 | 0.0000 | — | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| batch-100 | 1000 | update | 0.0600 | 0.0400 | 1.5000 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| batch-100 | 1000 | setup | 4.3000 | 6.0000 | 0.7167 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| batch-100 | 1000 | mount | 0.1000 | 0.1000 | — | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| batch-100 | 1000 | startup | 4.4000 | 6.1000 | 0.7213 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| batch-100 | 1000 | unmount | 0.0000 | 0.0000 | — | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| array-visible-row | 1000 | update | 0.0200 | 0.0200 | 1.0000 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| array-visible-row | 1000 | setup | 4.0000 | 6.3000 | 0.6562 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| array-visible-row | 1000 | mount | 0.7000 | 0.4000 | 1.7500 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| array-visible-row | 1000 | startup | 4.7000 | 6.7000 | 0.7344 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| array-visible-row | 1000 | unmount | 0.2000 | 0.2000 | 1.0000 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| array-visible-row | 10000 | update | 0.0200 | 0.0200 | — | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| array-visible-row | 10000 | setup | 54.0000 | 78.6000 | 0.6870 | — | inconclusive | Requires at least 21 independent trial blocks |
| array-visible-row | 10000 | mount | 1.0000 | 0.5000 | 2.2500 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| array-visible-row | 10000 | startup | 56.4000 | 79.1000 | 0.6964 | — | inconclusive | Requires at least 21 independent trial blocks |
| array-visible-row | 10000 | unmount | 0.3000 | 0.3000 | 1.3333 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| array-visible-row | 50000 | update | 0.0400 | 0.0200 | — | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| array-visible-row | 50000 | setup | 305.4000 | 387.8000 | 0.7618 | — | inconclusive | Requires at least 21 independent trial blocks |
| array-visible-row | 50000 | mount | 1.2000 | 0.6000 | 2.2000 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| array-visible-row | 50000 | startup | 306.6000 | 388.3000 | 0.7636 | — | inconclusive | Requires at least 21 independent trial blocks |
| array-visible-row | 50000 | unmount | 0.4000 | 0.3000 | 1.3333 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| array-offscreen-row | 1000 | update | 0.0000 | 0.0000 | — | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| array-offscreen-row | 1000 | setup | 4.0000 | 6.1000 | 0.6557 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| array-offscreen-row | 1000 | mount | 0.9000 | 0.3000 | 2.5000 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| array-offscreen-row | 1000 | startup | 5.0000 | 6.5000 | 0.7692 | — | inconclusive | Requires at least 21 independent trial blocks |
| array-offscreen-row | 1000 | unmount | 0.1000 | 0.2000 | 1.0000 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| array-offscreen-row | 10000 | update | 0.0000 | 0.0000 | — | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| array-offscreen-row | 10000 | setup | 44.6000 | 73.6000 | 0.6060 | — | inconclusive | Requires at least 21 independent trial blocks |
| array-offscreen-row | 10000 | mount | 0.8000 | 0.5000 | 1.8000 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| array-offscreen-row | 10000 | startup | 45.5000 | 74.1000 | 0.6140 | — | inconclusive | Requires at least 21 independent trial blocks |
| array-offscreen-row | 10000 | unmount | 0.4000 | 0.3000 | 1.5000 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| array-offscreen-row | 50000 | update | 0.0000 | 0.0000 | — | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| array-offscreen-row | 50000 | setup | 283.5000 | 398.0000 | 0.7148 | — | inconclusive | Requires at least 21 independent trial blocks |
| array-offscreen-row | 50000 | mount | 3.6000 | 0.9000 | 2.9474 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| array-offscreen-row | 50000 | startup | 287.5000 | 399.9000 | 0.7235 | — | inconclusive | Requires at least 21 independent trial blocks |
| array-offscreen-row | 50000 | unmount | 0.6000 | 0.5000 | 1.3333 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| normalized-row | 1000 | update | 0.0200 | 0.0200 | — | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| normalized-row | 1000 | setup | 3.9000 | 5.7000 | 0.6842 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| normalized-row | 1000 | mount | 0.7000 | 0.3000 | 2.3333 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| normalized-row | 1000 | startup | 4.8000 | 6.0000 | 0.7742 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| normalized-row | 1000 | unmount | 0.2000 | 0.2000 | 1.5000 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| normalized-row | 10000 | update | 0.0400 | 0.0200 | 2.0000 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| normalized-row | 10000 | setup | 40.5000 | 79.5000 | 0.5602 | — | inconclusive | Requires at least 21 independent trial blocks |
| normalized-row | 10000 | mount | 0.8000 | 0.5000 | 2.0000 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| normalized-row | 10000 | startup | 41.2000 | 79.9000 | 0.5659 | — | inconclusive | Requires at least 21 independent trial blocks |
| normalized-row | 10000 | unmount | 0.3000 | 0.3000 | 1.3333 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| normalized-row | 50000 | update | 0.0400 | 0.0200 | 1.0000 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| normalized-row | 50000 | setup | 288.3000 | 362.0000 | 0.7986 | — | inconclusive | Requires at least 21 independent trial blocks |
| normalized-row | 50000 | mount | 4.0000 | 0.6000 | 6.5000 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| normalized-row | 50000 | startup | 299.4000 | 362.6000 | 0.7993 | — | inconclusive | Requires at least 21 independent trial blocks |
| normalized-row | 50000 | unmount | 0.4000 | 0.4000 | 1.0000 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| append | 1000 | update | 0.0800 | 0.0400 | 2.0000 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| append | 1000 | setup | 4.9000 | 6.2000 | 0.7581 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| append | 1000 | mount | 0.3000 | 0.1000 | 3.0000 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| append | 1000 | startup | 5.3000 | 6.3000 | 0.8644 | — | inconclusive | Requires at least 21 independent trial blocks |
| append | 1000 | unmount | 0.1000 | 0.0000 | — | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| append | 10000 | update | 0.0400 | 0.0200 | 2.0000 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| append | 10000 | setup | 44.6000 | 71.9000 | 0.6071 | — | inconclusive | Requires at least 21 independent trial blocks |
| append | 10000 | mount | 0.3000 | 0.1000 | 3.0000 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| append | 10000 | startup | 45.0000 | 72.0000 | 0.6068 | — | inconclusive | Requires at least 21 independent trial blocks |
| append | 10000 | unmount | 0.2000 | 0.1000 | 2.0000 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| append | 50000 | update | 0.0400 | 0.0400 | 1.5000 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| append | 50000 | setup | 278.7000 | 382.1000 | 0.7398 | — | inconclusive | Requires at least 21 independent trial blocks |
| append | 50000 | mount | 0.3000 | 0.1000 | 2.0000 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| append | 50000 | startup | 280.5000 | 382.2000 | 0.7405 | — | inconclusive | Requires at least 21 independent trial blocks |
| append | 50000 | unmount | 0.2000 | 0.1000 | — | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| map-and-replace | 1000 | update | 5.0400 | 6.0000 | 0.9700 | — | inconclusive | Requires at least 21 independent trial blocks |
| map-and-replace | 1000 | setup | 4.1000 | 6.2000 | 0.6613 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| map-and-replace | 1000 | mount | 0.7000 | 0.4000 | 2.0000 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| map-and-replace | 1000 | startup | 4.9000 | 6.6000 | 0.7424 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| map-and-replace | 1000 | unmount | 0.3000 | 0.3000 | 1.0000 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| map-and-replace | 10000 | update | 56.1600 | 56.1600 | 0.9969 | — | inconclusive | Requires at least 21 independent trial blocks |
| map-and-replace | 10000 | setup | 46.9000 | 67.9000 | 0.6907 | — | inconclusive | Requires at least 21 independent trial blocks |
| map-and-replace | 10000 | mount | 0.9000 | 0.5000 | 1.8000 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| map-and-replace | 10000 | startup | 47.8000 | 68.4000 | 0.6988 | — | inconclusive | Requires at least 21 independent trial blocks |
| map-and-replace | 10000 | unmount | 0.4000 | 0.4000 | 1.0000 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| map-and-replace | 50000 | update | 292.6800 | 432.2400 | 0.6771 | — | inconclusive | Requires at least 21 independent trial blocks |
| map-and-replace | 50000 | setup | 300.7000 | 391.0000 | 0.7632 | — | inconclusive | Requires at least 21 independent trial blocks |
| map-and-replace | 50000 | mount | 3.7000 | 0.5000 | 7.4000 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| map-and-replace | 50000 | startup | 303.6000 | 391.7000 | 0.7682 | — | inconclusive | Requires at least 21 independent trial blocks |
| map-and-replace | 50000 | unmount | 0.4000 | 0.4000 | 1.0000 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| filter-sort | 1000 | update | 0.9800 | 0.9600 | 1.0227 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| filter-sort | 1000 | setup | 5.0000 | 6.0000 | 0.7465 | — | inconclusive | Requires at least 21 independent trial blocks |
| filter-sort | 1000 | mount | 2.6000 | 1.2000 | 2.4000 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| filter-sort | 1000 | startup | 7.4000 | 7.0000 | 1.0571 | — | inconclusive | Requires at least 21 independent trial blocks |
| filter-sort | 1000 | unmount | 0.2000 | 0.2000 | 1.0000 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| filter-sort | 10000 | update | 16.2200 | 10.4200 | 1.5933 | — | inconclusive | Requires at least 21 independent trial blocks |
| filter-sort | 10000 | setup | 41.9000 | 67.9000 | 0.6377 | — | inconclusive | Requires at least 21 independent trial blocks |
| filter-sort | 10000 | mount | 33.0000 | 11.9000 | 2.8017 | — | inconclusive | Requires at least 21 independent trial blocks |
| filter-sort | 10000 | startup | 81.0000 | 80.0000 | 0.9890 | — | inconclusive | Requires at least 21 independent trial blocks |
| filter-sort | 10000 | unmount | 1.4000 | 2.8000 | 0.5000 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| filter-sort | 50000 | update | 100.4600 | 52.3800 | 1.9525 | — | inconclusive | Requires at least 21 independent trial blocks |
| filter-sort | 50000 | setup | 277.9000 | 381.1000 | 0.6799 | — | inconclusive | Requires at least 21 independent trial blocks |
| filter-sort | 50000 | mount | 266.3000 | 61.5000 | 4.3561 | — | inconclusive | Requires at least 21 independent trial blocks |
| filter-sort | 50000 | startup | 561.4000 | 443.0000 | 1.1796 | — | inconclusive | Requires at least 21 independent trial blocks |
| filter-sort | 50000 | unmount | 6.2000 | 20.5000 | 0.3015 | — | inconclusive | Requires at least 21 independent trial blocks |
| parent-rerender | 1000 | update | 0.0400 | 0.0400 | 1.5000 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| parent-rerender | 1000 | setup | 4.0000 | 5.7000 | 0.7273 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| parent-rerender | 1000 | mount | 0.4000 | 0.3000 | 1.0000 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| parent-rerender | 1000 | startup | 4.4000 | 6.0000 | 0.7460 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| parent-rerender | 1000 | unmount | 0.1000 | 0.2000 | 0.5000 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| immutable-input-filter | 1000 | update | 7.1200 | 0.1600 | 36.0000 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| immutable-input-filter | 1000 | setup | 4.0000 | 3.4000 | 1.2903 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| immutable-input-filter | 1000 | mount | 2.8000 | 0.2000 | 14.0000 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| immutable-input-filter | 1000 | startup | 6.8000 | 3.6000 | 2.0000 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| immutable-input-filter | 1000 | unmount | 0.2000 | 0.0000 | — | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| immutable-input-filter | 10000 | update | 83.0800 | 1.5400 | 59.1571 | — | inconclusive | Requires at least 21 independent trial blocks |
| immutable-input-filter | 10000 | setup | 41.7000 | 34.3000 | 1.3155 | — | inconclusive | Requires at least 21 independent trial blocks |
| immutable-input-filter | 10000 | mount | 42.0000 | 1.0000 | 41.2727 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| immutable-input-filter | 10000 | startup | 82.1000 | 35.4000 | 2.3192 | — | inconclusive | Requires at least 21 independent trial blocks |
| immutable-input-filter | 10000 | unmount | 11.6000 | 0.1000 | — | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| immutable-input-filter | 50000 | update | 488.5000 | 7.2800 | 68.1841 | — | inconclusive | Requires at least 21 independent trial blocks |
| immutable-input-filter | 50000 | setup | 284.2000 | 216.2000 | 1.3145 | — | inconclusive | Requires at least 21 independent trial blocks |
| immutable-input-filter | 50000 | mount | 272.5000 | 5.0000 | 55.8958 | — | inconclusive | Requires at least 21 independent trial blocks |
| immutable-input-filter | 50000 | startup | 564.7000 | 221.2000 | 2.5529 | — | inconclusive | Requires at least 21 independent trial blocks |
| immutable-input-filter | 50000 | unmount | 9.3000 | 0.1000 | 70.0000 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| api-payload | 1000 | update | 2.3000 | 3.1600 | 0.8608 | — | inconclusive | Requires at least 21 independent trial blocks |
| api-payload | 1000 | setup | 3.9000 | 6.0000 | 0.6500 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| api-payload | 1000 | mount | 0.8000 | 0.4000 | 2.0000 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| api-payload | 1000 | startup | 4.9000 | 6.4000 | 0.7656 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| api-payload | 1000 | unmount | 0.3000 | 0.2000 | 1.0000 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| api-payload | 10000 | update | 28.4000 | 30.4400 | 0.8962 | — | inconclusive | Requires at least 21 independent trial blocks |
| api-payload | 10000 | setup | 58.7000 | 69.4000 | 0.7746 | — | inconclusive | Requires at least 21 independent trial blocks |
| api-payload | 10000 | mount | 1.5000 | 0.5000 | 3.7500 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| api-payload | 10000 | startup | 61.5000 | 69.9000 | 0.7923 | — | inconclusive | Requires at least 21 independent trial blocks |
| api-payload | 10000 | unmount | 0.5000 | 0.4000 | 1.2500 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| api-payload | 50000 | update | 164.9400 | 153.2400 | 1.1161 | — | inconclusive | Requires at least 21 independent trial blocks |
| api-payload | 50000 | setup | 307.8000 | 391.0000 | 0.7740 | — | inconclusive | Requires at least 21 independent trial blocks |
| api-payload | 50000 | mount | 3.0000 | 0.6000 | 4.3333 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| api-payload | 50000 | startup | 314.2000 | 392.1000 | 0.8235 | — | inconclusive | Requires at least 21 independent trial blocks |
| api-payload | 50000 | unmount | 0.4000 | 0.4000 | 1.0000 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| api-frozen | 1000 | update | 1.9400 | 3.8600 | 0.5026 | — | inconclusive | Requires at least 21 independent trial blocks |
| api-frozen | 1000 | setup | 4.2000 | 5.8000 | 0.7119 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| api-frozen | 1000 | mount | 0.7000 | 0.3000 | 2.0000 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| api-frozen | 1000 | startup | 4.8000 | 6.1000 | 0.7903 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| api-frozen | 1000 | unmount | 0.2000 | 0.2000 | 1.0000 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| api-frozen | 10000 | update | 19.3600 | 31.7800 | 0.6413 | — | inconclusive | Requires at least 21 independent trial blocks |
| api-frozen | 10000 | setup | 52.7000 | 72.0000 | 0.6856 | — | inconclusive | Requires at least 21 independent trial blocks |
| api-frozen | 10000 | mount | 0.9000 | 0.5000 | 1.8000 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| api-frozen | 10000 | startup | 53.6000 | 72.5000 | 0.6877 | — | inconclusive | Requires at least 21 independent trial blocks |
| api-frozen | 10000 | unmount | 0.4000 | 0.4000 | 1.0000 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| api-frozen | 50000 | update | 121.1200 | 172.9600 | 0.7267 | — | inconclusive | Requires at least 21 independent trial blocks |
| api-frozen | 50000 | setup | 294.4000 | 382.0000 | 0.7608 | — | inconclusive | Requires at least 21 independent trial blocks |
| api-frozen | 50000 | mount | 1.3000 | 0.5000 | 2.4000 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| api-frozen | 50000 | startup | 296.2000 | 382.5000 | 0.7636 | — | inconclusive | Requires at least 21 independent trial blocks |
| api-frozen | 50000 | unmount | 0.4000 | 0.4000 | 1.0000 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| array-remove | 1000 | update | 0.0200 | 0.0200 | — | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| array-remove | 1000 | setup | 3.9000 | 6.5000 | 0.6000 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| array-remove | 1000 | mount | 0.1000 | 0.2000 | 0.5000 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| array-remove | 1000 | startup | 4.1000 | 6.7000 | 0.5970 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| array-remove | 1000 | unmount | 0.0000 | 0.1000 | — | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| array-remove | 10000 | update | 0.0200 | 0.0200 | — | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| array-remove | 10000 | setup | 45.4000 | 75.2000 | 0.5279 | — | inconclusive | Requires at least 21 independent trial blocks |
| array-remove | 10000 | mount | 0.2000 | 0.2000 | 0.6667 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| array-remove | 10000 | startup | 45.6000 | 75.4000 | 0.5278 | — | inconclusive | Requires at least 21 independent trial blocks |
| array-remove | 10000 | unmount | 0.1000 | 0.2000 | 0.5000 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| array-remove | 50000 | update | 0.0400 | 0.0200 | 2.0000 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| array-remove | 50000 | setup | 289.3000 | 382.8000 | 0.7865 | — | inconclusive | Requires at least 21 independent trial blocks |
| array-remove | 50000 | mount | 1.1000 | 0.2000 | 5.0000 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| array-remove | 50000 | startup | 290.5000 | 383.0000 | 0.7886 | — | inconclusive | Requires at least 21 independent trial blocks |
| array-remove | 50000 | unmount | 0.2000 | 0.1000 | — | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| array-reorder | 1000 | update | 0.3800 | 0.2400 | 1.4167 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| array-reorder | 1000 | setup | 3.9000 | 5.9000 | 0.6441 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| array-reorder | 1000 | mount | 0.6000 | 0.3000 | 2.0000 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| array-reorder | 1000 | startup | 4.5000 | 6.4000 | 0.7031 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| array-reorder | 1000 | unmount | 0.2000 | 0.2000 | 1.0000 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| array-reorder | 10000 | update | 1.0200 | 0.7400 | 1.4054 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| array-reorder | 10000 | setup | 41.0000 | 69.2000 | 0.6613 | — | inconclusive | Requires at least 21 independent trial blocks |
| array-reorder | 10000 | mount | 1.7000 | 0.4000 | 4.2500 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| array-reorder | 10000 | startup | 42.0000 | 69.6000 | 0.6693 | — | inconclusive | Requires at least 21 independent trial blocks |
| array-reorder | 10000 | unmount | 0.4000 | 0.3000 | 1.3333 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| array-reorder | 50000 | update | 6.5800 | 3.2600 | 1.8544 | — | inconclusive | Requires at least 21 independent trial blocks |
| array-reorder | 50000 | setup | 280.5000 | 376.5000 | 0.7260 | — | inconclusive | Requires at least 21 independent trial blocks |
| array-reorder | 50000 | mount | 1.2000 | 0.5000 | 2.0000 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| array-reorder | 50000 | startup | 281.8000 | 377.0000 | 0.7292 | — | inconclusive | Requires at least 21 independent trial blocks |
| array-reorder | 50000 | unmount | 0.4000 | 0.4000 | 1.0000 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| bulk-rows-100 | 1000 | update | 0.4600 | 0.2600 | 1.7692 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| bulk-rows-100 | 1000 | setup | 4.4000 | 6.1000 | 0.7231 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| bulk-rows-100 | 1000 | mount | 0.8000 | 0.4000 | 1.7500 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| bulk-rows-100 | 1000 | startup | 5.4000 | 6.5000 | 0.7826 | — | inconclusive | Requires at least 21 independent trial blocks |
| bulk-rows-100 | 1000 | unmount | 0.3000 | 0.2000 | 1.0000 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| bulk-rows-100 | 10000 | update | 0.4000 | 0.2400 | 1.6667 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| bulk-rows-100 | 10000 | setup | 49.2000 | 79.0000 | 0.6203 | — | inconclusive | Requires at least 21 independent trial blocks |
| bulk-rows-100 | 10000 | mount | 0.9000 | 0.4000 | 2.0000 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| bulk-rows-100 | 10000 | startup | 50.3000 | 79.5000 | 0.6277 | — | inconclusive | Requires at least 21 independent trial blocks |
| bulk-rows-100 | 10000 | unmount | 0.4000 | 0.4000 | 1.0000 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| bulk-rows-100 | 50000 | update | 0.5000 | 0.3600 | 1.5556 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| bulk-rows-100 | 50000 | setup | 294.6000 | 361.3000 | 0.8154 | — | inconclusive | Requires at least 21 independent trial blocks |
| bulk-rows-100 | 50000 | mount | 1.0000 | 0.6000 | 1.6667 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| bulk-rows-100 | 50000 | startup | 298.1000 | 361.8000 | 0.8239 | — | inconclusive | Requires at least 21 independent trial blocks |
| bulk-rows-100 | 50000 | unmount | 0.5000 | 0.3000 | 1.3333 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| record-churn | 1000 | update | 0.0200 | 0.0200 | — | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| record-churn | 1000 | setup | 4.1000 | 5.3000 | 0.7593 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| record-churn | 1000 | mount | 0.1000 | 0.0000 | — | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| record-churn | 1000 | startup | 4.2000 | 5.4000 | 0.7778 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| record-churn | 1000 | unmount | 0.0000 | 0.0000 | — | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| reactive-prop-row | 1000 | update | 0.0200 | 0.0200 | 1.0000 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| reactive-prop-row | 1000 | setup | 4.2000 | 5.9000 | 0.7119 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| reactive-prop-row | 1000 | mount | 0.9000 | 0.5000 | 1.8000 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| reactive-prop-row | 1000 | startup | 5.1000 | 6.4000 | 0.7969 | — | inconclusive | Requires at least 21 independent trial blocks |
| reactive-prop-row | 1000 | unmount | 0.2000 | 0.2000 | 0.6667 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| reactive-prop-row | 10000 | update | 0.0200 | 0.0200 | — | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| reactive-prop-row | 10000 | setup | 48.1000 | 79.5000 | 0.6028 | — | inconclusive | Requires at least 21 independent trial blocks |
| reactive-prop-row | 10000 | mount | 1.4000 | 0.7000 | 1.8333 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| reactive-prop-row | 10000 | startup | 49.5000 | 80.2000 | 0.6157 | — | inconclusive | Requires at least 21 independent trial blocks |
| reactive-prop-row | 10000 | unmount | 0.3000 | 0.3000 | 1.0000 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| reactive-prop-row | 50000 | update | 0.0400 | 0.0200 | 1.0000 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| reactive-prop-row | 50000 | setup | 284.5000 | 375.2000 | 0.7447 | — | inconclusive | Requires at least 21 independent trial blocks |
| reactive-prop-row | 50000 | mount | 3.4000 | 0.7000 | 4.8333 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| reactive-prop-row | 50000 | startup | 287.9000 | 376.2000 | 0.7538 | — | inconclusive | Requires at least 21 independent trial blocks |
| reactive-prop-row | 50000 | unmount | 0.5000 | 0.6000 | 1.3333 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| memo-filter | 1000 | update | 1.9600 | 0.9400 | 2.1154 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| memo-filter | 1000 | setup | 4.6000 | 7.3000 | 0.6133 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| memo-filter | 1000 | mount | 4.2000 | 1.1000 | 3.6923 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| memo-filter | 1000 | startup | 9.0000 | 8.4000 | 1.0843 | — | inconclusive | Requires at least 21 independent trial blocks |
| memo-filter | 1000 | unmount | 0.3000 | 0.4000 | 0.7500 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| memo-filter | 10000 | update | 33.0000 | 8.4000 | 3.6537 | — | inconclusive | Requires at least 21 independent trial blocks |
| memo-filter | 10000 | setup | 45.6000 | 64.9000 | 0.6941 | — | inconclusive | Requires at least 21 independent trial blocks |
| memo-filter | 10000 | mount | 60.8000 | 10.0000 | 6.4400 | — | inconclusive | Requires at least 21 independent trial blocks |
| memo-filter | 10000 | startup | 106.4000 | 73.8000 | 1.4084 | — | inconclusive | Requires at least 21 independent trial blocks |
| memo-filter | 10000 | unmount | 2.6000 | 2.5000 | 0.8571 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| memo-filter | 50000 | update | 180.6000 | 55.3800 | 3.2611 | — | inconclusive | Requires at least 21 independent trial blocks |
| memo-filter | 50000 | setup | 294.5000 | 385.2000 | 0.7596 | — | inconclusive | Requires at least 21 independent trial blocks |
| memo-filter | 50000 | mount | 452.1000 | 63.5000 | 6.9669 | — | inconclusive | Requires at least 21 independent trial blocks |
| memo-filter | 50000 | startup | 758.2000 | 448.7000 | 1.6292 | — | inconclusive | Requires at least 21 independent trial blocks |
| memo-filter | 50000 | unmount | 11.1000 | 25.2000 | 0.4126 | — | inconclusive | Requires at least 21 independent trial blocks |
| memo-local-render | 1000 | update | 0.2400 | 0.1400 | 1.5714 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| memo-local-render | 1000 | setup | 4.6000 | 6.7000 | 0.6866 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| memo-local-render | 1000 | mount | 0.6000 | 0.3000 | 2.0000 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| memo-local-render | 1000 | startup | 5.2000 | 7.1000 | 0.7429 | — | inconclusive | Requires at least 21 independent trial blocks |
| memo-local-render | 1000 | unmount | 0.4000 | 0.3000 | 1.5000 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| persist-json | 1000 | update | 1.9400 | 2.3600 | 0.8095 | — | inconclusive | Requires at least 21 independent trial blocks |
| persist-json | 1000 | setup | 4.6000 | 6.7000 | 0.6866 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| persist-json | 1000 | mount | 0.2000 | 0.2000 | 1.0000 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| persist-json | 1000 | startup | 4.8000 | 6.9000 | 0.6957 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| persist-json | 1000 | unmount | 0.1000 | 0.1000 | — | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| persist-json | 10000 | update | 25.6800 | 23.7600 | 1.1153 | — | inconclusive | Requires at least 21 independent trial blocks |
| persist-json | 10000 | setup | 42.7000 | 73.0000 | 0.6057 | — | inconclusive | Requires at least 21 independent trial blocks |
| persist-json | 10000 | mount | 0.2000 | 0.2000 | 1.0000 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| persist-json | 10000 | startup | 43.0000 | 73.3000 | 0.6051 | — | inconclusive | Requires at least 21 independent trial blocks |
| persist-json | 10000 | unmount | 0.1000 | 0.0000 | — | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| persist-json | 50000 | update | 133.3200 | 113.1000 | 1.2004 | — | inconclusive | Requires at least 21 independent trial blocks |
| persist-json | 50000 | setup | 273.7000 | 371.5000 | 0.7462 | — | inconclusive | Requires at least 21 independent trial blocks |
| persist-json | 50000 | mount | 0.6000 | 0.4000 | 1.5000 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
| persist-json | 50000 | startup | 274.3000 | 371.9000 | 0.7470 | — | inconclusive | Requires at least 21 independent trial blocks |
| persist-json | 50000 | unmount | 0.2000 | 0.2000 | 1.0000 | — | inconclusive | Requires at least 21 independent trial blocks; Below 5 ms sample-duration floor; timing precision is insufficient |
