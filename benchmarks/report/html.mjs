import { readFile } from 'node:fs/promises';
import { escapeHtml, inlineJson } from './escaping.mjs';
import { summarize } from './statistics.mjs';
import { descriptions, labels, workloadLabels } from './metadata.mjs';
import { initializeReport } from './client.mjs';

export async function htmlReport(report, gate) {
  const css = await readFile(new URL('./styles.css', import.meta.url), 'utf8');
  const embedded = inlineJson(report);
  const methodology = report.methodology;
  const format = (value) => (Number.isFinite(value) ? value.toFixed(4) : '—');
  const parityTable = gate
    ? `<section aria-label="Per-case MobX parity"><h2>Per-case MobX parity: ${escapeHtml(gate.status)}</h2>
  <p>↓ Lower is better. Kinstate/MobX ratio; 1.05× is a 5% noninferiority tolerance, not exact equality. Every case and cost metric has its own verdict. Missing, historical, insufficient or uncertain data cannot pass. No overall timing average.</p>
  <details><summary>Show all ${gate.rows.length} comparisons (${gate.counts.pass} pass, ${gate.counts.regression} regression, ${gate.counts.inconclusive} inconclusive)</summary>
  <p>Nominal ${Math.round(gate.settings.confidence * 100)}% family-wise order-statistic intervals with Bonferroni correction. These bounds assume independent matched blocks; serial browser runs can violate that assumption. They do not guarantee results on other machines or future runs.</p>
  <div class="table-wrap" tabindex="0"><table><thead><tr>${['Workload', 'Size', 'Metric', 'Kinstate', 'MobX', 'Ratio', 'Interval', 'Verdict', 'Evidence / limitation'].map((x) => `<th>${x}</th>`).join('')}</tr></thead><tbody>${gate.rows.map((row) => `<tr>${[row.workload, row.size, row.metric, format(row.candidate?.median), format(row.mobx?.median), format(row.ratio), row.interval?.map(format).join(' – ') ?? '—', row.status, row.reasons.join('; ')].map((x) => `<td>${escapeHtml(x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details></section>`
    : '';
  return /* HTML */ `<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>Kinstate · React state benchmarks</title>
        <style>
          ${css}
        </style>
      </head>
      <body>
        <main>
          <header>
            <div>
              <p class="date">Kinstate · Ordinary classes. Reactive state.</p>
              <h1>React state, measured.</h1>
              <p class="intro">
                Explore the cost of a specific update. Compare the same workload, collection size,
                and consumer count across four libraries.
              </p>
              <div class="date">
                ${escapeHtml(report.timestamp)} · Production Chromium ·
                ${escapeHtml(methodology.samples)} repeated samples
              </div>
            </div>
            <button id="download" type="button">Download raw JSON</button>
          </header>
          <section aria-label="Comparison filters" class="filters">
            <label>Workload<select id="workload"></select></label
            ><label>Collection size<select id="size"></select></label
            ><label
              >Metric<select id="metric">
                <option value="update">Update time / operation (ms)</option>
                <option value="startup">Startup: setup + mount (ms)</option>
                <option value="setup">Store setup time (ms)</option>
                <option value="mount">Mount time (ms)</option>
                <option value="unmount">Unmount time (ms)</option>
                <option value="renders">Render calls / operation</option>
              </select></label
            >
          </section>
          <div id="status" class="status" role="status" aria-live="polite"></div>
          <div id="comparisons"></div>
          <noscript
            ><p class="empty">
              Enable JavaScript to explore the embedded results. RESULTS.md contains the complete
              static tables.
            </p></noscript
          >
          ${gate?.historical ? '<p class="intro" role="note"><strong>Historical artifact.</strong> Missing source, lockfile and build fingerprints: these charts do not establish current Kinstate performance.</p>' : ''}
          ${parityTable}
          <section class="notes" aria-label="Methodology and interpretation">
            <div>
              <h2>What was measured</h2>
              <p>
                Production React in Chromium with controlled commit checkpoints and consistent
                flushSync scheduling across libraries. This measures controlled commit cost, not
                natural event latency or concurrent scheduling. Each case receives
                ${escapeHtml(methodology.warmups)} warmups and ${escapeHtml(methodology.samples)}
                repeated samples. Case order is randomized with seed
                ${escapeHtml(methodology.seed)}.
              </p>
              <p>${escapeHtml(methodology.scheduling)}</p>
              <p>
                Adapters use compiled useService, MobX observer, Zustand selectors with one
                immutable publication per transaction, and Valtio snapshots scoped to stable
                rows/nested objects. Collection replacement and derivation use root snapshots so
                replaced data is observed.
              </p>
              <p>
                Bars show the median. P95 is the nearest-rank percentile. For update time, P95 is
                computed over per-sample average ms/op; it is not individual-operation latency P95.
                The range preserves sample variation; update time and render calls are normalized by
                operations. Mount and unmount measure the complete consumer tree.
              </p>
              <p>
                Setup includes adapter/store construction and initial data allocation. Startup adds
                setup and mount within each sample. Compare startup rather than mount alone:
                libraries may initialize reactive data eagerly during setup or lazily during mount.
              </p>
            </div>
            <div>
              <h2>Read counts with context</h2>
              <p>
                <strong>Lower is better</strong> for time and render-call counts. Fewer renders
                alone do not guarantee a faster update; check elapsed time too. Render calls are
                component function executions during updates, not paints. Array dependency
                strategies differ: MobX can legitimately rerender more array consumers. No overall
                library ranking is computed.
              </p>
              <p>
                These timings exclude browser paint, network latency, and virtualization libraries.
              </p>
              <ul>
                ${methodology.limitations.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
              </ul>
            </div>
          </section>
          <p class="chart-note">
            Methodology references:
            <a href="https://react.dev/reference/react-dom/flushSync">React flushSync</a>,
            <a href="https://mobx.js.org/understanding-reactivity.html">MobX reactivity</a>,
            <a href="https://zustand.docs.pmnd.rs/learn/guides/immutable-state-and-merging"
              >Zustand immutable updates</a
            >, <a href="https://valtio.dev/docs/api/basic/useSnapshot">Valtio useSnapshot</a>.
          </p>
          <details>
            <summary>Environment and package versions</summary>
            <pre>${escapeHtml(JSON.stringify(report.environment, null, 2))}</pre>
          </details>
          <footer>
            All samples are embedded in this file. Comparisons remain available offline; no external
            scripts, fonts, or tracking.
          </footer>
        </main>
        <script id="benchmark-data" type="application/json">
          ${embedded}
        </script>
        <script>
          (${initializeReport.toString()})(
            JSON.parse(document.getElementById('benchmark-data').textContent),
            ${inlineJson({ descriptions, labels, workloadLabels })},
            ${summarize.toString()},
          );
        </script>
      </body>
    </html>`;
}
