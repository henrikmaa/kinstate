import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluateParity, parityMarkdown } from './parity.mjs';
const c = { workload: 'single-field', size: 1000, consumers: 1, operations: 10 };
const provenance = { sourceHash: 'source', lockfileHash: 'lock', buildHash: 'bundle' };
const options = { metrics: ['update'], minSamples: 7, minSampleMs: 1 };
function report(candidate = 0.9, baseline = 1) {
  const samples = (value) =>
    Array.from({ length: 7 }, (_, i) => ({
      setupMs: 10,
      mountMs: 10,
      unmountMs: 10,
      updateMs: (Array.isArray(value) ? value[i] : value) * 10,
      renders: 10,
      checksum: 1,
      block: i,
    }));
  return {
    environment: { provenance },
    methodology: { coverage: { complete: true, cases: [c] } },
    results: [
      { ...c, library: 'kinstate', samples: samples(candidate) },
      { ...c, library: 'mobx', samples: samples(baseline) },
    ],
  };
}
test('passes each case only within the explicit 5% tolerance and bounded uncertainty', () => {
  const gate = evaluateParity(report(1.04), options);
  assert.equal(gate.status, 'pass');
  assert.equal(gate.rows.length, 1);
  assert.equal(gate.rows[0].ratio, 1.04);
  assert.match(parityMarkdown(gate), /not a claim of exact equality/);
  assert.match(parityMarkdown(gate), /Lower is better/);
});
test('one confirmed regression fails the suite without averaging against a faster case', () => {
  const data = report(1.3);
  const other = { ...c, workload: 'other' };
  data.methodology.coverage.cases.push(other);
  data.results.push(...report(0.1).results.map((r) => ({ ...r, ...other })));
  const gate = evaluateParity(data, options);
  assert.equal(gate.status, 'regression');
  assert.deepEqual(
    gate.rows.map((r) => r.status),
    ['regression', 'pass'],
  );
});
test('noisy threshold-crossing samples remain inconclusive', () => {
  const gate = evaluateParity(report([0.5, 1.7, 0.7, 1.5, 0.9, 1.3, 1.01]), options);
  assert.equal(gate.status, 'inconclusive');
  assert.match(gate.rows[0].reasons.join(), /Uncertainty/);
});
test('missing cases, unmatched trials and sample shortages cannot pass', () => {
  const missing = report();
  missing.results.pop();
  assert.equal(evaluateParity(missing, options).status, 'inconclusive');
  const unmatched = report();
  unmatched.results[0].samples.pop();
  assert.equal(evaluateParity(unmatched, options).status, 'inconclusive');
  assert.equal(evaluateParity(report(), { ...options, minSamples: 21 }).status, 'inconclusive');
  assert.equal(
    evaluateParity(report(), { ...options, expectedCases: [c, { ...c, size: 50000 }] }).rows[1]
      .status,
    'inconclusive',
  );
});
test('timer-floor and zero values cannot manufacture a parity pass', () => {
  assert.equal(evaluateParity(report(0.001, 0.001), options).status, 'inconclusive');
  assert.equal(evaluateParity(report(0, 0), options).status, 'inconclusive');
});
test('historical, partial and stale-source results are unproven', () => {
  const old = report();
  delete old.environment.provenance;
  old.results[0].library = 'react-service';
  assert.equal(evaluateParity(old, options).historical, true);
  assert.equal(evaluateParity(old, options).status, 'inconclusive');
  const partial = report();
  partial.methodology.coverage.complete = false;
  assert.equal(evaluateParity(partial, options).status, 'inconclusive');
  assert.equal(
    evaluateParity(report(), { ...options, provenance: { ...provenance, buildHash: 'other' } })
      .status,
    'inconclusive',
  );
});
test('correctness checksum mismatch cannot pass', () => {
  const data = report();
  data.results[0].samples[0].checksum = 2;
  assert.equal(evaluateParity(data, options).status, 'inconclusive');
});
test('gate is deterministic and retains every cost metric', () => {
  const a = evaluateParity(report(), {
    ...options,
    metrics: ['update', 'setup', 'mount', 'startup', 'unmount'],
  });
  assert.deepEqual(
    a,
    evaluateParity(report(), {
      ...options,
      metrics: ['update', 'setup', 'mount', 'startup', 'unmount'],
    }),
  );
  assert.equal(a.rows.length, 5);
  assert.equal(a.settings.simultaneousComparisons, 5);
});

test('point estimate uses matched block ratios, not a quotient of unrelated medians', () => {
  const gate = evaluateParity(report([1, 2, 3, 4, 5, 6, 7], [1, 1, 1, 5, 5, 5, 5]), options);
  assert.equal(gate.rows[0].ratio, 1.2);
});
test('duplicated trial-block identities are inconclusive', () => {
  const data = report();
  data.results.forEach((row) => row.samples.forEach((s) => (s.block = 0)));
  assert.equal(evaluateParity(data, options).status, 'inconclusive');
});

test('extra verified render calls cannot pass or conceal a timing regression', () => {
  const data = report(0.9);
  data.results[0].samples.forEach((s) => (s.renders = 20));
  const gate = evaluateParity(data, options);
  assert.equal(gate.status, 'regression');
  assert.match(gate.rows[0].reasons.join(), /more render calls/);
  assert.ok(gate.rows[0].interval);
});

test('missing render/checksum evidence and invalid thresholds cannot pass', () => {
  const data = report();
  delete data.results[0].samples[0].checksum;
  assert.equal(evaluateParity(data, options).status, 'inconclusive');
  assert.throws(() => evaluateParity(report(), { ...options, tolerance: Infinity }), TypeError);
  assert.throws(() => evaluateParity(report(), { ...options, minSampleMs: -1 }), TypeError);
});
