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
