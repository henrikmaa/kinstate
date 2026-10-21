# Understand performance

The recorded comparative timings predate readonly React consumer views. They are historical measurements; a fresh timing run is required for current speed comparisons. Correctness smoke checks are rerun separately.

Kinstate's primary performance property is subscription precision. A component reading `loading` does not subscribe to `notifications` merely because both fields belong to one service. Nested objects, computed getters and conditional reads preserve that distinction.

That does not make every state operation cheap. Measure mutation work, dependency validation, React work and data allocation separately when choosing a representation.

## Match the representation to the workload

For frequent edits to individual records, plain reactive objects and arrays allow narrow subscriptions without copying the full tree. An observed row property can change independently of unrelated consumers. The maintained benchmark includes both normalized records and array rows so one representation does not stand in for every application.

For API payloads owned by another library, borrow immutable data through `serviceInputs` and replace the root when the source publishes a new snapshot. This preserves its identity and avoids deeply adopting a payload that your service does not own. Do not opt into that representation and then mutate its nested values expecting notifications.

A getter that filters or sorts a large owned reactive array must read and track that data. Cached getters avoid repeating unchanged derivations, but invalidation can still require a substantial scan and dependency graph work. Consider whether the screen needs the complete derived collection, whether a normalized lookup would answer the question, or whether a bounded visible window is appropriate.

## Read the benchmark honestly

The repository compares Kinstate, MobX with observer components, Zustand with selectors and Valtio with snapshots in production Chromium. Workloads include selective edits, fanout, batching, large arrays, payload replacement, derivation, mounting and teardown. The same logical operation, output checks and commit checkpoints are used for each adapter.

Selective edits can be close to MobX in the tested scenarios. Heavy mutable collection derivations remain costly. There is no universal winner or promise that Kinstate is fastest. A filter of owned reactive rows and a filter of newly supplied immutable API data are different workloads; their timing ratio is not a controlled speedup measurement.

All reported cost metrics use **Lower is better**. Render counts are component function executions, not paints, and fewer executions alone do not prove lower elapsed time. Update timings use controlled commit checkpoints and exclude browser paint and network latency. Compare the same workload, data size, consumer count and run settings.

## Measure your application

Run `npm run bench:smoke` to validate adapters and reports. `npm run bench -- --workload filter-sort --size 50000 --samples 5 --warmups 2 --operations 10` runs a focused timing case from the repository root. Avoid competing heavy tasks while measuring.

Use application profiling before adding memoization. A parent render still follows ordinary React behavior, and memoized children can help when their props remain stable. Do not hide service reads in `useMemo`; prefer service getters or read primitive inputs before memoizing presentation.
