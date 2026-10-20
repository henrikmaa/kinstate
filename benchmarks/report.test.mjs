import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JSDOM, VirtualConsole } from 'jsdom';
import { escapeHtml, summarize, writeReport } from './report.mjs';

const fixture = () => ({
  schemaVersion: 1,
  timestamp: '2026-10-20T12:00:00Z',
  environment: { node: 'v24', versions: { react: '19' } },
  methodology: {
    samples: 2,
    warmups: 1,
    seed: 42,
    scheduling: 'same flushSync per operation',
    limitations: ['CPU-bound test'],
  },
  results: ['kinstate', 'mobx', 'zustand', 'valtio'].map((library) => ({
    library,
    workload: 'single-field',
    size: 1000,
    consumers: 10,
    operations: 10,
    samples: [
      { setupMs: 10, mountMs: 4, updateMs: 2, unmountMs: 1, renders: 10, checksum: 1 },
      { setupMs: 20, mountMs: 6, updateMs: 4, unmountMs: 2, renders: 20, checksum: 1 },
    ],
  })),
});

test('summarizes medians, nearest-rank p95, and range without changing input', () => {
  const values = [8, 1, 4, 3];
  assert.deepEqual(summarize(values), { median: 3.5, p95: 8, min: 1, max: 8 });
  assert.deepEqual(values, [8, 1, 4, 3]);
  assert.deepEqual(summarize([7]), { median: 7, p95: 7, min: 7, max: 7 });
  assert.equal(summarize(Array.from({ length: 100 }, (_, index) => index + 1)).p95, 95);
});
test('rejects missing and nonfinite samples', () => {
  for (const values of [[], [NaN], Array(2), [Infinity], [-Infinity], ['1'], undefined])
    assert.throws(() => summarize(values), TypeError);
});
test('escapes HTML text and attributes', () => {
  assert.equal(
    escapeHtml('<a title="x">Tom & \'Ada\'</a>'),
    '&lt;a title=&quot;x&quot;&gt;Tom &amp; &#39;Ada&#39;&lt;/a&gt;',
  );
});
test('writes normalized complete markdown and an offline accessible report', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'kinstate-report-'));
  try {
    const report = fixture();
    await writeReport(report, directory);
    const html = await readFile(join(directory, 'report.html'), 'utf8');
    const md = await readFile(join(directory, 'RESULTS.md'), 'utf8');
    assert.match(html, /<label>Workload<select id="workload">/);
    assert.match(html, /aria-live="polite"/);
    assert.match(html, /Download raw JSON/);
    assert.match(html, /Update time \/ operation/);
    assert.match(html, /Startup: setup \+ mount/);
    assert.match(html, /Store setup time/);
    assert.doesNotMatch(html, /<script[^>]+src=|<link[^>]+href=/);
    const embedded = html.match(
      /<script id="benchmark-data" type="application\/json">([\s\S]*?)<\/script>/,
    )[1];
    assert.deepEqual(JSON.parse(embedded), report);
    assert.match(md, /0\.3 \/ 0\.4/);
    assert.match(md, /15 \/ 20/);
    assert.match(md, /20 \/ 26/);
    assert.match(md, /1\.5 \/ 2/);
    assert.match(md, /10–20/);
    for (const name of ['Kinstate', 'MobX', 'Zustand', 'Valtio']) assert.ok(md.includes(name));
    assert.match(md, /nearest-rank/);
    assert.match(md, /No overall|does not compute an overall/);
    const errors = [];
    const virtualConsole = new VirtualConsole();
    virtualConsole.on('jsdomError', (error) => errors.push(error.message));
    const dom = new JSDOM(html, { runScripts: 'dangerously', virtualConsole });
    try {
      const { document, Event } = dom.window;
      assert.equal(document.querySelectorAll('.bar-row').length, 4);
      const metric = document.getElementById('metric');
      metric.value = 'startup';
      metric.dispatchEvent(new Event('change'));
      assert.equal(document.querySelector('.bar-number').textContent, '20 ms');
      metric.value = 'renders';
      metric.dispatchEvent(new Event('change'));
      assert.equal(document.querySelector('.bar-number').textContent, '1.5 calls/op');
      assert.deepEqual(errors, []);
    } finally {
      dom.window.close();
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
test('preserves injection fixtures as data without closing scripts or injecting markup', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'kinstate-report-injection-'));
  try {
    const report = fixture();
    const attack =
      '</script><script>globalThis.pwned=true</script><img src=x onerror=alert(1)>\u2028\u2029';
    report.environment.host = attack;
    report.timestamp = attack;
    report.methodology.limitations.push(attack);
    report.results[0].workload = attack;
    await writeReport(report, directory);
    const html = await readFile(join(directory, 'report.html'), 'utf8');
    assert.ok(!html.includes('<img src=x'));
    assert.ok(!html.includes('<script>globalThis.pwned'));
    assert.equal((html.match(/<\/script>/g) ?? []).length, 2);
    const embedded = html.match(
      /<script id="benchmark-data" type="application\/json">([\s\S]*?)<\/script>/,
    )[1];
    assert.deepEqual(JSON.parse(embedded), report);
    assert.ok(embedded.includes('\\u003c/script\\u003e'));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
test('rejects invalid sample sets and zero-operation reports', async () => {
  const report = fixture();
  report.results[0].samples = [];
  await assert.rejects(writeReport(report, '/unused'), TypeError);
  report.results[0].samples = fixture().results[0].samples;
  report.results[0].operations = 0;
  await assert.rejects(writeReport(report, '/unused'), TypeError);
});

test('rejects missing or nonfinite setup timings', async () => {
  for (const setupMs of [undefined, NaN, Infinity]) {
    const report = fixture();
    report.results[0].samples[0].setupMs = setupMs;
    await assert.rejects(writeReport(report, '/unused'), TypeError);
  }
});
