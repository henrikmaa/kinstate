import type { ComponentType, ReactNode } from 'react';
import type { StoreApi } from 'zustand/vanilla';
import type { ServiceScope } from '@kinstate/core';
import type { Workload } from '../schema.js';
import type { State } from './model.js';

export interface Stats {
  renders: number;
}
export interface Props {
  index: number;
  workload: Workload;
  stats: Stats;
  source?: State | StoreApi<State>;
  tick?: number;
}
export interface Adapter {
  Consumer: ComponentType<Props>;
  mutate(operation: number): void;
  state: State;
  source?: Props['source'];
  context?: ServiceScope;
  wrap?(children: ReactNode, context: ServiceScope | undefined): ReactNode;
  dispose?(): void;
}
