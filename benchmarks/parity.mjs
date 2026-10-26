import { summarize } from './report/statistics.mjs';

export const parityDefaults = Object.freeze({
  tolerance: 0.05,
  confidence: 0.95,
  minSamples: 21,
  minSampleMs: 5,
  metrics: ['update', 'setup', 'mount', 'startup', 'unmount'],
});
const key = (row) => JSON.stringify([row.workload, row.size, row.consumers, row.operations]);
const value = (sample, row, metric) =>
  metric === 'update'
    ? sample.updateMs / row.operations
    : metric === 'startup'
      ? sample.setupMs + sample.mountMs
      : sample[`${metric}Ms`];
const duration = (sample, metric) =>
  metric === 'update'
    ? sample.updateMs
    : metric === 'startup'
      ? sample.setupMs + sample.mountMs
      : sample[`${metric}Ms`];
/** Exact sign/order-statistic interval for the median matched-block ratio.
 * Coverage assumes independent identically distributed blocks; serial browser
 * measurements can violate that assumption, so it is nominal for this experiment.
 */
function interval(candidate, baseline, alpha) {
  const ratios = candidate.map((value, index) => value / baseline[index]).sort((a, b) => a - b);
  const n = ratios.length;
  let term = 2 ** -n,
    tail = 0,
    chosen = 0;
  for (let index = 0; index < Math.floor(n / 2); index++) {
    tail += term;
    if (2 * tail > alpha) break;
    chosen = index + 1;
    term *= (n - index) / (index + 1);
  }
  return chosen ? [ratios[chosen - 1], ratios[n - chosen]] : [0, Infinity];
}
/** Every case and metric has an independent verdict. No average can mask a regression. */
export function evaluateParity(report, options = {}) {
  const settings = { ...parityDefaults, ...options };
  if (!(
    Number.isFinite(settings.tolerance) &&
    settings.tolerance >= 0 &&
    settings.confidence > 0 &&
    settings.confidence < 1 &&
    Number.isInteger(settings.minSamples) &&
    settings.minSamples >= 2 &&
    Number.isFinite(settings.minSampleMs) &&
    settings.minSampleMs >= 0 &&
    settings.metrics.length > 0 &&
    settings.metrics.every((metric) =>
      ['update', 'setup', 'mount', 'startup', 'unmount'].includes(metric),
    )
  ))
    throw new TypeError('Invalid parity settings');
  const declared = report.methodology?.coverage;
  const expected = options.expectedCases ??
    declared?.cases ?? [
      ...new Map(
        report.results.map((row) => [
          key(row),
          {
            workload: row.workload,
            size: row.size,
            consumers: row.consumers,
            operations: row.operations,
          },
        ]),
      ).values(),
    ];
  const comparisons = expected.length * settings.metrics.length;
  const alpha = (1 - settings.confidence) / Math.max(1, comparisons);
  const provenance = report.environment?.provenance;
  const historical = !provenance?.sourceHash || !provenance?.buildHash || !provenance?.lockfileHash;
  const globalReasons = [];
  if (historical)
    globalReasons.push('Historical/unfingerprinted artifact; current source is unproven');
  if (!declared?.complete) globalReasons.push('Full current case coverage is not declared');
  if (
    options.provenance &&
    ['sourceHash', 'lockfileHash', 'buildHash'].some(
      (field) => provenance?.[field] !== options.provenance[field],
    )
  )
    globalReasons.push(
      'Artifact does not match the current source, lockfile and production bundle',
    );
  const rows = [];
  for (const test of expected) {
    const candidates = report.results.filter(
      (row) =>
        key(row) === key(test) && (row.library === 'kinstate' || row.library === 'react-service'),
    );
    const baselines = report.results.filter(
      (row) => key(row) === key(test) && row.library === 'mobx',
    );
    for (const metric of settings.metrics) {
      const result = {
        ...test,
        metric,
        status: 'inconclusive',
        reasons: [...globalReasons],
        tolerance: settings.tolerance,
        direction: 'Lower is better',
      };
      rows.push(result);
      if (candidates.length !== 1 || baselines.length !== 1) {
        result.reasons.push('Missing or duplicate candidate/MobX case');
        continue;
      }
      const candidate = candidates[0],
        baseline = baselines[0];
      if (!candidate.samples.length || candidate.samples.length !== baseline.samples.length) {
        result.reasons.push('Missing or unmatched trial blocks');
        continue;
      }
      const a = candidate.samples.map((sample) => value(sample, candidate, metric)),
        b = baseline.samples.map((sample) => value(sample, baseline, metric));
      if ([...a, ...b].some((x) => !Number.isFinite(x) || x < 0)) {
        result.reasons.push('Invalid measurement');
        continue;
      }
      result.candidate = summarize(a);
      result.mobx = summarize(b);
      result.ratio = b.every((value) => value > 0)
        ? summarize(a.map((value, index) => value / b[index])).median
        : null;
      if (
        [candidate, baseline].some((row) =>
          row.samples.some(
            (sample) =>
              !Number.isSafeInteger(sample.checksum) ||
              sample.checksum < 0 ||
              !Number.isSafeInteger(sample.renders) ||
              sample.renders < 0,
          ),
        )
      )
        result.reasons.push('Missing or invalid checksum/render-count evidence');
      if (
        candidate.samples.some(
          (sample, index) => sample.checksum !== baseline.samples[index]?.checksum,
        )
      )
        result.reasons.push('Mismatched correctness checksums');
      if (
        candidate.samples.some(
          (sample, index) => sample.block !== index || baseline.samples[index]?.block !== index,
        )
      )
        result.reasons.push('Missing or mismatched randomized trial-block identities');
      if (candidate.samples.length < settings.minSamples)
        result.reasons.push(`Requires at least ${settings.minSamples} independent trial blocks`);
      if (
        [candidate, baseline].some(
          (row) =>
            summarize(row.samples.map((sample) => duration(sample, metric))).median <
            settings.minSampleMs,
        )
      )
        result.reasons.push(
          `Below ${settings.minSampleMs} ms sample-duration floor; timing precision is insufficient`,
        );
      const moreRenders =
        metric === 'update' &&
        candidate.samples.some(
          (sample, index) =>
            sample.renders / candidate.operations >
            baseline.samples[index].renders / baseline.operations,
        );
      if (moreRenders) result.reasons.push('Candidate performs more render calls than MobX');
      if (
        result.reasons.some((reason) => reason !== 'Candidate performs more render calls than MobX')
      )
        continue;
      result.interval = interval(a, b, alpha);
      if (result.interval.some((bound) => !Number.isFinite(bound))) {
        result.interval = null;
        result.reasons.push(
          'Insufficient independent blocks for a finite matrix-adjusted interval, or zero-duration baseline samples',
        );
        continue;
      }
      if (moreRenders || result.interval[0] > 1 + settings.tolerance) result.status = 'regression';
      else if (result.interval[1] <= 1 + settings.tolerance) result.status = 'pass';
      else
        result.reasons.push(
          'Uncertainty interval crosses the parity threshold; collect more independent samples',
        );
    }
  }
  return {
    status: rows.some((row) => row.status === 'regression')
      ? 'regression'
      : rows.length && rows.every((row) => row.status === 'pass')
        ? 'pass'
        : 'inconclusive',
    historical,
    settings: {
      ...settings,
      expectedCases: undefined,
      provenance: undefined,
      simultaneousComparisons: comparisons,
      correction: 'Exact median order-statistic intervals; Bonferroni across the comparison matrix',
    },
    rows,
    counts: {
      pass: rows.filter((row) => row.status === 'pass').length,
      regression: rows.filter((row) => row.status === 'regression').length,
      inconclusive: rows.filter((row) => row.status === 'inconclusive').length,
    },
  };
}
const cell = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/\|/g, '\\|')
    .replace(/[\r\n]+/g, ' ');
export function parityMarkdown(gate) {
  const number = (x) => (Number.isFinite(x) ? x.toFixed(4) : '—');
  return [
    `## Per-case MobX parity: ${gate.status}`,
    '',
    `Lower is better. Median matched-block candidate/MobX ratios; noninferiority threshold ${(1 + gate.settings.tolerance).toFixed(2)}× (${(gate.settings.tolerance * 100).toFixed(0)}% tolerance), not a claim of exact equality. ${Math.round(gate.settings.confidence * 100)}% nominal family-wise order-statistic intervals across ${gate.settings.simultaneousComparisons} comparisons. No aggregate timing score.`,
    '',
    '| Workload | Size | Metric | Kinstate | MobX | Ratio | Interval | Verdict | Evidence / limitation |',
    '| --- | ---: | --- | ---: | ---: | ---: | --- | --- | --- |',
    ...gate.rows.map(
      (row) =>
        `| ${cell(row.workload)} | ${row.size} | ${cell(row.metric)} | ${number(row.candidate?.median)} | ${number(row.mobx?.median)} | ${number(row.ratio)} | ${row.interval?.map(number).join(' – ') ?? '—'} | ${row.status} | ${cell(row.reasons.join('; '))} |`,
    ),
    '',
  ].join('\n');
}
