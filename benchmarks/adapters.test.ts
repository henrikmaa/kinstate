import assert from 'node:assert/strict';
import { test } from 'node:test';
import { adapterFor } from './browser/adapters.js';
import { initialState, mutatePlain } from './browser/model.js';
import { benchmarkCases } from './cases.js';
import { libraries, workloads, type Case } from './schema.js';

const base: Case = { workload: 'single-field', size: 100, consumers: 10, operations: 5 };
test('all adapters reuse module-level consumer identities across fresh stores', () => {
  for (const library of libraries)
    for (const workload of [
      'single-field',
      'memo-filter',
      'memo-local-render',
      'reactive-prop-row',
    ] as const) {
      const a = adapterFor(library, { ...base, workload }),
        b = adapterFor(library, { ...base, workload });
      try {
        assert.equal(a.Consumer, b.Consumer, `${library}/${workload}`);
        assert.equal(a.wrap, b.wrap);
        assert.notEqual(a.state, b.state);
      } finally {
        a.dispose?.();
        b.dispose?.();
      }
    }
});
test('all workloads perform the same logical state operation in all four adapters', () => {
  for (const workload of workloads)
    for (const library of libraries) {
      const adapter = adapterFor(library, { ...base, workload });
      const expected = initialState(base.size);
      try {
        for (let operation = 0; operation < base.operations; operation++) {
          adapter.mutate(operation);
          mutatePlain(expected, workload, operation, base.consumers);
        }
        for (const key of [
          'count',
          'other',
          'unrelated',
          'active',
          'nested',
          'rows',
          'records',
        ] as const)
          assert.deepEqual(
            JSON.parse(JSON.stringify(adapter.state[key])),
            expected[key],
            `${library}/${workload}/${key}`,
          );
      } finally {
        adapter.dispose?.();
      }
    }
});
test('full case manifest includes every workload, size and new composition path', () => {
  const full = benchmarkCases(30);
  assert.equal(full.length, 57);
  assert.equal(new Set(full.map((c) => c.workload)).size, 26);
  for (const workload of ['reactive-prop-row', 'memo-filter', 'persist-json'])
    assert.deepEqual(
      full.filter((c) => c.workload === workload).map((c) => c.size),
      [1000, 10000, 50000],
    );
  assert.equal(full.find((c) => c.workload === 'memo-local-render')?.consumers, 100);
});
