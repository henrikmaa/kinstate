import React, { memo, useMemo, type ReactNode } from 'react';
import { makeAutoObservable, runInAction, observable } from 'mobx';
import { observer } from 'mobx-react-lite';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { useStore } from 'zustand';
import { proxy, useSnapshot, ref } from 'valtio';
import { ServiceScope, batch, serviceInputs } from '@kinstate/core';
import { ServiceProvider } from '@kinstate/react';
import type { Case, Library, Workload } from '../schema.js';
import {
  initialState,
  mutatePlain,
  filteredRows,
  select,
  apiRows,
  type Row,
  type State,
} from './model.js';
import type { Adapter, Props, Stats } from './contracts.js';
import { BenchmarkService } from './kinstate-state.js';
import { MemoServiceConsumer, MemoDerivationConsumer } from './kinstate-consumers.js';

class MobxState implements State {
  count = 0;
  other = 0;
  unrelated = 0;
  active = true;
  nested = { value: 0 };
  rows: Row[] = [];
  records: Record<number, Row> = {};
  constructor(size: number, immutable = false) {
    Object.assign(this, initialState(size));
    makeAutoObservable(this, immutable ? { rows: observable.ref } : {});
  }
  get filtered() {
    return filteredRows(this.rows);
  }
}

function immutableUpdate(
  state: State,
  workload: Workload,
  operation: number,
  consumers: number,
): Partial<State> {
  switch (workload) {
    case 'immutable-input-filter':
      return { rows: apiRows(state.rows.length, operation + 1000, false) };

    case 'no-op':
      return state;
    case 'unrelated':
      return { unrelated: state.unrelated + 1 };
    case 'single-field':
    case 'shared-fanout':
      return { count: state.count + 1 };
    case 'conditional':
      if (operation % 3 === 0) return { active: !state.active };
      if (operation % 3 === 1)
        return state.active ? { other: state.other + 1 } : { count: state.count + 1 };
      return state.active ? { count: state.count + 1 } : { other: state.other + 1 };
    case 'nested-field':
      return { nested: { value: state.nested.value + 1 } };
    case 'batch-100': {
      let count = state.count;
      for (let i = 0; i < 100; i++) count++;
      return { count };
    }
    case 'persist-json':
    case 'reactive-prop-row':
    case 'array-visible-row':
    case 'full-list-row':
    case 'array-offscreen-row':
    case 'memo-filter':
    case 'filter-sort': {
      const index =
        workload === 'persist-json' ||
        workload === 'array-visible-row' ||
        workload === 'reactive-prop-row' ||
        workload === 'full-list-row'
          ? operation % consumers
          : workload === 'array-offscreen-row'
            ? state.rows.length - 1
            : operation % state.rows.length;
      const rows = state.rows.slice();
      const row = rows[index]!;
      rows[index] = {
        ...row,
        value: row.value + (workload === 'filter-sort' || workload === 'memo-filter' ? 100 : 1),
        active: workload === 'filter-sort' || workload === 'memo-filter' ? true : row.active,
      };
      return { rows };
    }
    case 'normalized-row': {
      const index = operation % consumers;
      const row = state.records[index]!;
      return { records: { ...state.records, [index]: { ...row, value: row.value + 1 } } };
    }
    case 'append':
      return { rows: [...state.rows, { id: state.rows.length, value: operation, active: true }] };
    case 'api-payload':
    case 'api-frozen':
      return { rows: apiRows(state.rows.length, operation, workload === 'api-frozen') };
    case 'array-remove':
      return { rows: state.rows.slice(0, -1) };
    case 'array-reorder':
      return { rows: state.rows.slice().reverse() };
    case 'bulk-rows-100': {
      const rows = state.rows.slice();
      for (let index = 0; index < 100; index++) {
        const key = index % rows.length;
        rows[key] = { ...rows[key]!, value: rows[key]!.value + 1 };
      }
      return { rows };
    }
    case 'record-churn': {
      const records = { ...state.records } as Record<string, Row>;
      const key = `transient-${operation}`;
      records[key] = { id: -1, value: operation, active: true };
      delete records[key];
      return { records };
    }
    case 'map-and-replace':
      return {
        rows: state.rows.map((row, index) => ({
          ...row,
          value: index === 0 ? operation + 1 : row.value,
        })),
      };
    case 'memo-local-render':
    case 'parent-rerender':
      return {};
  }
}

interface DerivedCache {
  rows?: readonly Readonly<Row>[];
  value: string[];
}
const derivedCaches = new WeakMap<object, DerivedCache>();
function cachedFiltered(owner: object, rows: readonly Readonly<Row>[]): string[] {
  let cache = derivedCaches.get(owner);
  if (!cache) {
    cache = { value: [] };
    derivedCaches.set(owner, cache);
  }
  if (rows !== cache.rows) {
    cache.rows = rows;
    cache.value = filteredRows(rows);
  }
  return cache.value;
}
function isFiltered(workload: Workload): boolean {
  return (
    workload === 'filter-sort' ||
    workload === 'immutable-input-filter' ||
    workload === 'memo-filter'
  );
}
function PlainRow({ row, stats }: { row: Readonly<Row>; stats: Stats }) {
  stats.renders++;
  return <span>{row.value}</span>;
}
const MemoPlainRow = memo(PlainRow);
const MobxRow = observer(PlainRow);
const MobxConsumer = observer(function MobxConsumer({ index, workload, stats, source }: Props) {
  const state = source as MobxState;
  stats.renders++;
  if (workload === 'reactive-prop-row') return <MobxRow row={state.rows[index]!} stats={stats} />;
  const value = isFiltered(workload)
    ? (state.filtered[index] ?? '-')
    : select(state, workload, index);
  return <span>{value}</span>;
});
const MobxMemoConsumer = observer(function MobxMemoConsumer({
  index,
  workload,
  stats,
  source,
}: Props) {
  const state = source as MobxState;
  // MobX tracks the computed/primitive outside React's cache, as recommended;
  // the same projection is memoized without hiding observable reads in a cache hit.
  const input = workload === 'memo-filter' ? (state.filtered[index] ?? '-') : state.count;
  const value = useMemo(
    () => (workload === 'memo-filter' ? input : Number(input) * 2),
    [input, workload],
  );
  stats.renders++;
  return <span>{value}</span>;
});
function zustandSelection(state: State, workload: Workload, index: number, owner: object) {
  return isFiltered(workload)
    ? (cachedFiltered(owner, state.rows)[index] ?? '-')
    : select(state, workload, index);
}
const ZustandConsumer = memo(function ZustandConsumer({ index, workload, stats, source }: Props) {
  const store = source as StoreApi<State>;
  const value = useStore(store, (state) =>
    workload === 'reactive-prop-row'
      ? state.rows[index]!
      : zustandSelection(state, workload, index, store),
  );
  stats.renders++;
  if (workload === 'reactive-prop-row') return <MemoPlainRow row={value as Row} stats={stats} />;
  return <span>{value as string | number}</span>;
});
const ZustandMemoConsumer = memo(function ZustandMemoConsumer({
  index,
  workload,
  stats,
  source,
}: Props) {
  const store = source as StoreApi<State>;
  const input = useStore(store, (state) =>
    workload === 'memo-filter' ? (cachedFiltered(store, state.rows)[index] ?? '-') : state.count,
  );
  const value = useMemo(
    () => (workload === 'memo-filter' ? input : Number(input) * 2),
    [input, workload],
  );
  stats.renders++;
  return <span>{value}</span>;
});
const scoped = new Set<Workload>([
  'persist-json',
  'array-visible-row',
  'bulk-rows-100',
  'array-offscreen-row',
  'full-list-row',
  'normalized-row',
  'nested-field',
]);
const ValtioRow = memo(function ValtioRow({ row, stats }: { row: Row; stats: Stats }) {
  const snap = useSnapshot(row);
  stats.renders++;
  return <span>{snap.value}</span>;
});
const ValtioScopedConsumer = memo(function ValtioScopedConsumer({
  index,
  workload,
  stats,
  source,
}: Props) {
  const state = source as State;
  const target =
    workload === 'nested-field'
      ? state.nested
      : workload === 'normalized-row'
        ? state.records[index]!
        : state.rows[index]!;
  const snap = useSnapshot(target);
  stats.renders++;
  return <span>{snap.value}</span>;
});
const ValtioConsumer = memo(function ValtioConsumer({ index, workload, stats, source }: Props) {
  const state = source as State;
  const snapshot = useSnapshot(state);
  stats.renders++;
  const value = isFiltered(workload)
    ? (cachedFiltered(state, snapshot.rows)[index] ?? '-')
    : select(snapshot, workload, index);
  return <span>{value}</span>;
});
const ValtioPropsConsumer = memo(function ValtioPropsConsumer({ index, stats, source }: Props) {
  stats.renders++;
  return <ValtioRow row={(source as State).rows[index]!} stats={stats} />;
});
const ValtioMemoConsumer = memo(function ValtioMemoConsumer({
  index,
  workload,
  stats,
  source,
}: Props) {
  const state = source as State;
  const snapshot = useSnapshot(state);
  const input =
    workload === 'memo-filter'
      ? (cachedFiltered(state, snapshot.rows)[index] ?? '-')
      : snapshot.count;
  const value = useMemo(
    () => (workload === 'memo-filter' ? input : Number(input) * 2),
    [input, workload],
  );
  stats.renders++;
  return <span>{value}</span>;
});
function wrapService(children: ReactNode, scope: ServiceScope | undefined): ReactNode {
  return (
    <ServiceProvider services={[BenchmarkService]} scope={scope}>
      {children}
    </ServiceProvider>
  );
}

export function adapterFor(library: Library, test: Case): Adapter {
  const { workload, size, consumers } = test;
  const immutable = workload === 'immutable-input-filter';
  const memoWorkload = workload === 'memo-filter' || workload === 'memo-local-render';
  if (library === 'kinstate') {
    const initial = initialState(size);
    const scope = new ServiceScope(
      [BenchmarkService],
      immutable ? { inputs: [serviceInputs(BenchmarkService, { rows: initial.rows })] } : {},
    );
    const state = scope.get(BenchmarkService);
    // The input boundary already seeded rows. Do not publish that payload twice
    // during setup now that Kinstate adopts incoming state by copying it.
    if (immutable) {
      const { rows: _rows, ...remaining } = initial;
      Object.assign(state, remaining);
    } else Object.assign(state, initial);
    return {
      Consumer: memoWorkload ? MemoDerivationConsumer : MemoServiceConsumer,
      state,
      context: scope,
      mutate: (operation) =>
        immutable
          ? void scope.applyInputs([
              serviceInputs(BenchmarkService, { rows: apiRows(size, operation + 1000, false) }),
            ])
          : batch(() => mutatePlain(state, workload, operation, consumers)),
      wrap: wrapService,
      dispose: () => scope.dispose(),
    };
  }
  if (library === 'mobx') {
    const state = new MobxState(size, immutable);
    return {
      Consumer: memoWorkload ? MobxMemoConsumer : MobxConsumer,
      state,
      source: state,
      mutate: (operation) => runInAction(() => mutatePlain(state, workload, operation, consumers)),
    };
  }
  if (library === 'zustand') {
    const store = createStore<State>(() => initialState(size));
    return {
      Consumer: memoWorkload ? ZustandMemoConsumer : ZustandConsumer,
      source: store,
      get state() {
        return store.getState();
      },
      mutate: (operation) =>
        store.setState((state) => immutableUpdate(state, workload, operation, consumers)),
    };
  }
  const initial = initialState(size);
  if (immutable) initial.rows = ref(initial.rows);
  const state = proxy(initial);
  return {
    Consumer: memoWorkload
      ? ValtioMemoConsumer
      : workload === 'reactive-prop-row'
        ? ValtioPropsConsumer
        : scoped.has(workload)
          ? ValtioScopedConsumer
          : ValtioConsumer,
    source: state,
    state,
    mutate: (operation) => {
      if (immutable) state.rows = ref(apiRows(size, operation + 1000, false));
      else mutatePlain(state, workload, operation, consumers);
    },
  };
}
