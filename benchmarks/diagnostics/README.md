# Large-array investigation

These production-browser runs investigate specific bottlenecks. They are **not a
release certification**, and they do not establish parity across all workloads.
The two targeted runs contain three 50,000-row cases. The current run covers all
57 cases (228 library comparisons). All use five measured blocks, two warmups and
five updates per sample, with randomized library order and DOM/backing-state checks.
All timing charts are **lower is better**. Render counters report actual React
render attempts, not frame rate.

- [Service-owned state](owned-state/report.html): initial copying boundary,
  frame-local memo collection, and owned-array reverse certificates.
- [Readonly reader](readonly-reader/report.html): removes an inner proxy dispatch
  for proven canonical owned/service state; retained raw/foreign proxies keep
  their invariant checks.
- [Current full comparison](current/report.html): adds result-owned memo
  observations, retained leaf subscriptions, coalesced notifications, and constant
  time reads of frozen snapshots. All 57 cases passed correctness validation.

Each directory includes raw samples, source and bundle fingerprints, methodology,
and a parity report. The parity report deliberately remains inconclusive for
short diagnostic runs. Compare libraries within the same run; differences between
runs can include browser garbage collection and host variation. In particular,
reversal medians varied enough that a single five-block run is insufficient to
claim MobX parity. Filter/sort and memo-filter still show confirmed engineering
work remaining, even though these diagnostics do not meet the statistical release
gate's sample count.
