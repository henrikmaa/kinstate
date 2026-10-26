import React, { useMemo } from 'react';
import { useService } from '@kinstate/react';
import { BenchmarkService } from './kinstate-state.js';
import { filteredRows, type Row } from './model.js';
import type { Props, Stats } from './contracts.js';

// This named function must pass through the actual package compiler before
// React.memo is applied. All service reads remain inside its render body.
export function ServiceConsumer({ index, workload, stats }: Props) {
  const service = useService(BenchmarkService);
  stats.renders++;
  let value: string | number;
  switch (workload) {
    case 'conditional':
      value = service.active ? service.count : service.other;
      break;
    case 'nested-field':
      value = service.nested.value;
      break;
    case 'reactive-prop-row':
      return <ReactiveRow row={service.rows[index]!} stats={stats} />;
    case 'persist-json':
    case 'array-visible-row':
    case 'full-list-row':
    case 'array-offscreen-row':
    case 'api-payload':
    case 'api-frozen':
    case 'array-reorder':
    case 'bulk-rows-100':
    case 'map-and-replace':
      value = service.rows[index]!.value;
      break;
    case 'normalized-row':
      value = service.records[index]!.value;
      break;
    case 'append':
    case 'array-remove':
      value = service.rows.length;
      break;
    case 'filter-sort':
    case 'immutable-input-filter':
      value = service.filtered[index] ?? '-';
      break;
    default:
      value = service.count;
  }
  return <span>{value}</span>;
}
export const MemoServiceConsumer = ServiceConsumer;

function ReactiveRow({ row, stats }: { row: Readonly<Row>; stats: Stats }) {
  stats.renders++;
  return <span>{row.value}</span>;
}

export function MemoDerivationConsumer({ index, workload, stats }: Props) {
  const service = useService(BenchmarkService);
  const value = useMemo(
    () =>
      workload === 'memo-filter' ? (filteredRows(service.rows)[index] ?? '-') : service.count * 2,
    [service, workload, index],
  );
  stats.renders++;
  return <span>{value}</span>;
}
