export const libraries = ['kinstate', 'mobx', 'zustand', 'valtio'] as const;
export type Library = (typeof libraries)[number];
export const workloads = [
  'no-op',
  'full-list-row',
  'unrelated',
  'single-field',
  'shared-fanout',
  'conditional',
  'nested-field',
  'batch-100',
  'array-visible-row',
  'array-offscreen-row',
  'normalized-row',
  'append',
  'map-and-replace',
  'filter-sort',
  'parent-rerender',
  'immutable-input-filter',
  'api-payload',
  'api-frozen',
  'array-remove',
  'array-reorder',
  'bulk-rows-100',
  'record-churn',
  'reactive-prop-row',
  'memo-filter',
  'memo-local-render',
  'persist-json',
] as const;
export type Workload = (typeof workloads)[number];
export interface Case {
  workload: Workload;
  size: number;
  consumers: number;
  operations: number;
}
export interface Sample {
  block?: number;
  setupMs: number;
  mountMs: number;
  updateMs: number;
  unmountMs: number;
  renders: number;
  checksum: number;
}
export interface Result extends Case {
  library: Library;
  samples: Sample[];
}
export interface Report {
  schemaVersion: 1;
  timestamp: string;
  environment: Record<string, unknown>;
  methodology: {
    samples: number;
    warmups: number;
    seed: number;
    scheduling: string;
    coverage?: { complete: boolean; cases: Case[] };
    limitations: string[];
  };
  results: Result[];
}
