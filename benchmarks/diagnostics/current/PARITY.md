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
