import React, { memo, type ComponentType, type ReactNode } from 'react';
import { makeAutoObservable, runInAction, observable } from 'mobx';
import { observer } from 'mobx-react-lite';
import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import { proxy, useSnapshot, ref } from 'valtio';
import { Service, ServiceScope, batch, serviceInputs } from '@kinstate/core';
import { ServiceProvider, useService } from '@kinstate/react';
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

interface Stats {
  renders: number;
}
interface Props {
  index: number;
  workload: Workload;
  stats: Stats;
}
interface Adapter {
  Consumer: ComponentType<Props>;
  mutate(operation: number): void;
  state: State;
  wrap?(children: ReactNode): ReactNode;
  dispose?(): void;
}

class BenchmarkService extends Service {
  count = 0;
  other = 0;
  unrelated = 0;
  active = true;
  nested = { value: 0 };
  rows: Row[] = [];
  records: Record<number, Row> = {};
  get filtered() {
    return filteredRows(this.rows);
  }
}

// This named function must pass through the actual package compiler before
// React.memo is applied. All service reads remain inside its render body.
function ServiceConsumer({ index, workload, stats }: Props) {
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
const MemoServiceConsumer = memo(ServiceConsumer);

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
    case 'array-visible-row':
    case 'full-list-row':
    case 'array-offscreen-row':
    case 'filter-sort': {
      const index =
        workload === 'array-visible-row' || workload === 'full-list-row'
          ? operation % consumers
          : workload === 'array-offscreen-row'
            ? state.rows.length - 1
            : operation % state.rows.length;
      const rows = state.rows.slice();
      const row = rows[index]!;
      rows[index] = {
        ...row,
        value: row.value + (workload === 'filter-sort' ? 100 : 1),
        active: workload === 'filter-sort' ? true : row.active,
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
    case 'parent-rerender':
      return {};
  }
}

export function adapterFor(library: Library, test: Case): Adapter {
  const { workload, size, consumers } = test;
  const immutable = workload === 'immutable-input-filter';
  if (library === 'kinstate') {
    const initial = initialState(size);
    const scope = new ServiceScope(
      [BenchmarkService],
      immutable ? { inputs: [serviceInputs(BenchmarkService, { rows: initial.rows })] } : {},
    );
    const state = scope.get(BenchmarkService);
    Object.assign(state, initial);
    return {
      Consumer: MemoServiceConsumer,
      state,
      mutate: (operation) =>
        immutable
          ? void scope.applyInputs([
              serviceInputs(BenchmarkService, { rows: apiRows(size, operation + 1000, false) }),
            ])
          : batch(() => mutatePlain(state, workload, operation, consumers)),
      wrap: (children) => (
        <ServiceProvider services={[BenchmarkService]} scope={scope}>
          {children}
        </ServiceProvider>
      ),
      dispose: () => scope.dispose(),
    };
  }
  if (library === 'mobx') {
    const state = new MobxState(size, immutable);
    const Consumer = observer(function MobxConsumer({
      index,
      workload: selectedWorkload,
      stats,
    }: Props) {
      stats.renders++;
      const value =
        selectedWorkload === 'filter-sort' || selectedWorkload === 'immutable-input-filter'
          ? (state.filtered[index] ?? '-')
          : select(state, selectedWorkload, index);
      return <span>{value}</span>;
    });
    return {
      Consumer,
      state,
      mutate: (operation) => runInAction(() => mutatePlain(state, workload, operation, consumers)),
    };
  }
  if (library === 'zustand') {
    const store = createStore<State>(() => initialState(size));
    let previousRows: readonly Readonly<Row>[] | undefined;
    let derived: string[] = [];
    function selector(state: State, selectedWorkload: Workload, index: number) {
      if (selectedWorkload !== 'filter-sort' && selectedWorkload !== 'immutable-input-filter')
        return select(state, selectedWorkload, index);
      if (state.rows !== previousRows) {
        previousRows = state.rows;
        derived = filteredRows(state.rows);
      }
      return derived[index] ?? '-';
    }
    const Consumer = memo(function ZustandConsumer({
      index,
      workload: selectedWorkload,
      stats,
    }: Props) {
      const value = useStore(store, (state) => selector(state, selectedWorkload, index));
      stats.renders++;
      return <span>{value}</span>;
    });
    return {
      Consumer,
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
  // Valtio recommends subscribing to the smallest stable subtree. Whole-array
  // replacement is a different case and must retain the root subscription.
  if (
    [
      'array-visible-row',
      'bulk-rows-100',
      'array-offscreen-row',
      'full-list-row',
      'normalized-row',
      'nested-field',
    ].includes(workload)
  ) {
    const Consumer = memo(function ValtioScopedConsumer({ index, stats }: Props) {
      const target =
        workload === 'nested-field'
          ? state.nested
          : workload === 'normalized-row'
            ? state.records[index]!
            : state.rows[index]!;
      const snapshot = useSnapshot(target);
      stats.renders++;
      return <span>{snapshot.value}</span>;
    });
    return {
      Consumer,
      state,
      mutate: (operation) => {
        if (immutable) state.rows = ref(apiRows(size, operation + 1000, false));
        else mutatePlain(state, workload, operation, consumers);
      },
    };
  }
  let previousRows: readonly Readonly<Row>[] | undefined;
  let derived: string[] = [];
  const Consumer = memo(function ValtioConsumer({
    index,
    workload: selectedWorkload,
    stats,
  }: Props) {
    const snapshot = useSnapshot(state);
    // The shared cache reads the immutable snapshot. Reading `rows` still makes
    // its identity a dependency for each consumer, including cache hits.
    let value: string | number;
    if (selectedWorkload === 'filter-sort' || selectedWorkload === 'immutable-input-filter') {
      if (snapshot.rows !== previousRows) {
        previousRows = snapshot.rows;
        derived = filteredRows(snapshot.rows);
      }
      value = derived[index] ?? '-';
    } else {
      switch (selectedWorkload) {
        case 'conditional':
          value = snapshot.active ? snapshot.count : snapshot.other;
          break;
        case 'nested-field':
          value = snapshot.nested.value;
          break;
        case 'array-visible-row':
        case 'full-list-row':
        case 'array-offscreen-row':
        case 'api-payload':
        case 'api-frozen':
        case 'array-reorder':
        case 'bulk-rows-100':
        case 'map-and-replace':
          value = snapshot.rows[index]!.value;
          break;
        case 'normalized-row':
          value = snapshot.records[index]!.value;
          break;
        case 'append':
        case 'array-remove':
          value = snapshot.rows.length;
          break;
        default:
          value = snapshot.count;
      }
    }
    stats.renders++;
    return <span>{value}</span>;
  });
  return {
    Consumer,
    state,
    mutate: (operation) => {
      if (immutable) state.rows = ref(apiRows(size, operation + 1000, false));
      else mutatePlain(state, workload, operation, consumers);
    },
  };
}
