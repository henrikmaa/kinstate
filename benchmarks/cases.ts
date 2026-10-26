import { workloads, type Case } from './schema.js';

export function benchmarkCases(operations: number, quick = false): Case[] {
  const large = new Set([
    'array-visible-row',
    'array-offscreen-row',
    'normalized-row',
    'append',
    'map-and-replace',
    'filter-sort',
    'immutable-input-filter',
    'reactive-prop-row',
    'memo-filter',
    'persist-json',
    'api-payload',
    'api-frozen',
    'array-remove',
    'array-reorder',
    'bulk-rows-100',
  ]);
  return workloads.flatMap((workload) =>
    (workload === 'full-list-row'
      ? quick
        ? [1000]
        : [1000, 5000]
      : large.has(workload)
        ? quick
          ? [1000, 10000]
          : [1000, 10000, 50000]
        : [1000]
    ).map((size) => ({
      workload,
      size,
      operations,
      consumers:
        workload === 'full-list-row'
          ? size
          : [
                'shared-fanout',
                'reactive-prop-row',
                'memo-local-render',
                'array-visible-row',
                'array-offscreen-row',
                'normalized-row',
                'map-and-replace',
                'api-payload',
                'api-frozen',
                'array-reorder',
                'bulk-rows-100',
                'parent-rerender',
              ].includes(workload)
            ? 100
            : 1,
    })),
  );
}
