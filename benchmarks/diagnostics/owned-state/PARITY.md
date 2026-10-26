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
