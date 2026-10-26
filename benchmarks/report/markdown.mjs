import { parityMarkdown } from '../parity.mjs';
import { summarize } from './statistics.mjs';
import { descriptions, labels } from './metadata.mjs';

const number = (value) => Number(value).toLocaleString('en-US', { maximumFractionDigits: 6 });
const markdown = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\|/g, '\\|')
    .replace(/[\r\n]+/g, ' ');
const statText = (stat) => `${number(stat.median)} / ${number(stat.p95)}`;

export function markdownReport(report, parity) {
  const lines = [
    '# React state benchmark report',
    '',
    `Run: ${markdown(report.timestamp)}`,
    '',
    'Compare libraries only within the same workload and size. **Lower is better** for all reported cost metrics (time and render calls); this report does not compute an overall ranking.',
    '',
    ...(parity?.historical
      ? [
          '**Historical artifact:** missing source/lockfile/build fingerprints; these timings do not establish current Kinstate performance.',
          '',
        ]
      : []),
    '## Methodology',
    '',
    'Production React in Chromium. This is a controlled commit checkpoint benchmark, not natural event latency or concurrent scheduling. Every library uses the same flushSync scheduling. Each case receives warmups and repeated samples; execution order is randomized.',
    '',
    `Samples per case: ${report.methodology.samples}. Warmups: ${report.methodology.warmups}. Random seed: ${report.methodology.seed}.`,
    '',
    `Scheduling: ${markdown(report.methodology.scheduling)}`,
    '',
    'Median uses the middle value (mean of the two middle values for even samples). P95 uses the nearest-rank percentile. Update times and render calls are divided by operations; mount and unmount cover the complete consumer tree.',
    '',
    'Setup measures adapter and store construction, including initial data allocation. Startup is setup plus mount, computed per sample before summarizing. Compare startup rather than mount alone: libraries may initialize reactive data eagerly during setup or lazily during mount.',
    '',
    'Update P95 is the percentile of per-sample average milliseconds per operation, not a percentile of individual operation latencies. Each sample times its complete operation loop.',
    '',
    'Adapters use compiled useService, MobX observer, Zustand selectors with one structurally shared publication per transaction, and Valtio snapshots scoped to stable rows/nested objects (root snapshots for collection replacement/derivation).',
    '',
    'Render calls count update-phase component function calls, not browser paints. Library differences in array tracking can legitimately change render counts, including MobX arrays. Inspect the observed counts rather than assuming identical behavior.',
    '',
    '## Results',
    '',
    '| Workload | Size | Consumers | Operations | Library | Update ms/op median / P95 sample mean | Setup ms median / p95 | Startup ms median / p95 | Mount ms median / p95 | Unmount ms median / p95 | Renders/op median / p95 | Exact render calls min–max |',
    '| --- | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ];
  for (const row of report.results) {
    const update = summarize(row.samples.map((sample) => sample.updateMs / row.operations));
    const setup = summarize(row.samples.map((sample) => sample.setupMs));
    const startup = summarize(row.samples.map((sample) => sample.setupMs + sample.mountMs));
    const mount = summarize(row.samples.map((sample) => sample.mountMs));
    const unmount = summarize(row.samples.map((sample) => sample.unmountMs));
    const renders = summarize(row.samples.map((sample) => sample.renders / row.operations));
    const exact = summarize(row.samples.map((sample) => sample.renders));
    lines.push(
      `| ${markdown(row.workload)} | ${row.size} | ${row.consumers} | ${row.operations} | ${markdown(labels[row.library] ?? row.library)} | ${statText(update)} | ${statText(setup)} | ${statText(startup)} | ${statText(mount)} | ${statText(unmount)} | ${statText(renders)} | ${exact.min}–${exact.max} |`,
    );
  }
  lines.push('', '## Workloads', '');
  for (const workload of new Set(report.results.map((row) => row.workload)))
    lines.push(`- **${markdown(workload)}:** ${markdown(descriptions[workload] ?? workload)}`);
  lines.push('', '## Environment', '', '| Field | Value |', '| --- | --- |');
  for (const [key, value] of Object.entries(report.environment))
    lines.push(
      `| ${markdown(key)} | ${markdown(typeof value === 'object' ? JSON.stringify(value) : value)} |`,
    );
  lines.push(
    '',
    '## Methodology references',
    '',
    '- [React flushSync](https://react.dev/reference/react-dom/flushSync): controlled synchronous commit checkpoints can affect performance.',
    '- [MobX understanding reactivity](https://mobx.js.org/understanding-reactivity.html): observable property and array dependency behavior.',
    '- [Zustand immutable state and merging](https://zustand.docs.pmnd.rs/learn/guides/immutable-state-and-merging): immutable updates and merge behavior.',
    '- [Valtio useSnapshot](https://valtio.dev/docs/api/basic/useSnapshot): render access tracking through snapshots.',
  );
  lines.push(
    '',
    '## Limits',
    '',
    '- Measures JavaScript execution and React work; does not measure paint, network latency, or a virtualization library.',
  );
  for (const limitation of report.methodology.limitations) lines.push(`- ${markdown(limitation)}`);
  lines.push(
    '',
    'Full sample data is preserved in the JSON report. The standalone HTML includes an embedded copy and a download button.',
    '',
  );
  if (parity) lines.push('', parityMarkdown(parity));
  return lines.join('\n');
}
