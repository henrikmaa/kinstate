import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { summarize } from './report/statistics.mjs';
import { markdownReport } from './report/markdown.mjs';
import { htmlReport } from './report/html.mjs';

export { summarize } from './report/statistics.mjs';
export { escapeHtml } from './report/escaping.mjs';

export async function writeReport(report, outputDirectory) {
  for (const row of report.results) {
    if (!Number.isFinite(row.operations) || row.operations <= 0)
      throw new TypeError('Operations must be positive');
    for (const key of ['setupMs', 'mountMs', 'updateMs', 'unmountMs', 'renders'])
      summarize(row.samples.map((sample) => sample[key]));
  }
  const html = await htmlReport(report);
  const md = markdownReport(report);
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    writeFile(join(outputDirectory, 'report.html'), html),
    writeFile(join(outputDirectory, 'RESULTS.md'), md),
  ]);
}
