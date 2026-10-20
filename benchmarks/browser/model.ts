import type { Workload } from '../schema.js';

export interface Row {
  id: number;
  value: number;
  active: boolean;
}
export interface State {
  count: number;
  other: number;
  unrelated: number;
  active: boolean;
  nested: { value: number };
  rows: Row[];
  records: Record<number, Row>;
}
export function initialState(size: number): State {
  const rows = Array.from({ length: size }, (_, id) => ({
    id,
    value: id % 100,
    active: id % 2 === 0,
  }));
  return {
    count: 0,
    other: 0,
    unrelated: 0,
    active: true,
    nested: { value: 0 },
    rows,
    records: Object.fromEntries(rows.map((row) => [row.id, { ...row }])),
  };
}

/** Simulated incoming data is created without reading the reactive collection. */
export function apiRows(size: number, operation: number, frozen: boolean): Row[] {
  const rows = Array.from({ length: size }, (_, id) => ({
    id,
    value: id === 0 ? operation + 1 : id % 100,
    active: id % 2 === 0,
  }));
  if (frozen) {
    for (const row of rows) Object.freeze(row);
    Object.freeze(rows);
  }
  return rows;
}

// The reference implementation runs after the measured update region. It is
// independent of selectors, computed caches, proxies and subscription APIs.
export function mutatePlain(
  state: State,
  workload: Workload,
  operation: number,
  consumers: number,
): void {
  switch (workload) {
    case 'no-op':
      state.count = state.count;
      break;
    case 'unrelated':
      state.unrelated++;
      break;
    case 'single-field':
    case 'shared-fanout':
      state.count++;
      break;
    case 'conditional':
      if (operation % 3 === 0) state.active = !state.active;
      else if (operation % 3 === 1) {
        if (state.active) state.other++;
        else state.count++;
      } else {
        if (state.active) state.count++;
        else state.other++;
      }
      break;
    case 'nested-field':
      state.nested.value++;
      break;
    case 'batch-100':
      for (let i = 0; i < 100; i++) state.count++;
      break;
    case 'array-visible-row':
    case 'full-list-row':
      state.rows[operation % consumers]!.value++;
      break;
    case 'array-offscreen-row':
      state.rows[state.rows.length - 1]!.value++;
      break;
    case 'normalized-row':
      state.records[operation % consumers]!.value++;
      break;
    case 'append':
      state.rows.push({ id: state.rows.length, value: operation, active: true });
      break;
    case 'immutable-input-filter':
      state.rows = apiRows(state.rows.length, operation + 1000, false);
      break;
    case 'api-payload':
    case 'api-frozen':
      state.rows = apiRows(state.rows.length, operation, workload === 'api-frozen');
      break;
    case 'array-remove':
      state.rows.pop();
      break;
    case 'array-reorder':
      state.rows.reverse();
      break;
    case 'bulk-rows-100':
      for (let index = 0; index < 100; index++) state.rows[index % state.rows.length]!.value++;
      break;
    case 'record-churn': {
      const records = state.records as unknown as Record<string, Row>;
      const key = `transient-${operation}`;
      records[key] = { id: -1, value: operation, active: true };
      delete records[key];
      break;
    }
    case 'map-and-replace':
      state.rows = state.rows.map((row, index) => ({
        ...row,
        value: index === 0 ? operation + 1 : row.value,
      }));
      break;
    case 'filter-sort': {
      const row = state.rows[operation % state.rows.length]!;
      row.active = true;
      row.value += 100;
      break;
    }
    case 'parent-rerender':
      break;
  }
}
export function filteredRows(rows: readonly Readonly<Row>[]): string[] {
  return rows
    .filter((row) => row.active)
    .sort((a, b) => b.value - a.value || a.id - b.id)
    .slice(0, 100)
    .map((row) => `${row.id}:${row.value}`);
}
export function select(state: State, workload: Workload, index: number): string | number {
  switch (workload) {
    case 'conditional':
      return state.active ? state.count : state.other;
    case 'nested-field':
      return state.nested.value;
    case 'array-visible-row':
    case 'full-list-row':
    case 'array-offscreen-row':
    case 'api-payload':
    case 'api-frozen':
    case 'array-reorder':
    case 'bulk-rows-100':
    case 'map-and-replace':
      return state.rows[index]!.value;
    case 'normalized-row':
      return state.records[index]!.value;
    case 'append':
    case 'array-remove':
      return state.rows.length;
    case 'filter-sort':
    case 'immutable-input-filter':
      return filteredRows(state.rows)[index] ?? '-';
    default:
      return state.count;
  }
}
