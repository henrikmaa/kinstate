// Embedded into standalone HTML using this function's source. Keep all runtime
// dependencies explicit parameters so the output needs no module loader.
export function initializeReport(report, metadata, summarize) {
  const { descriptions, labels: names, workloadLabels } = metadata;
  const colors = {
    kinstate: '#007e79',
    'react-service': '#007e79',
    mobx: '#bd520d',
    zustand: '#396ec0',
    valtio: '#7558a1',
  };
  const workload = document.getElementById('workload'),
    size = document.getElementById('size'),
    metric = document.getElementById('metric');
  const format = (value) => Number(value).toLocaleString('en-US', { maximumFractionDigits: 6 });
  function element(tag, text, cls) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (cls) node.className = cls;
    return node;
  }
  function option(select, value, label) {
    const node = element('option', label);
    node.value = value;
    select.append(node);
  }
  option(workload, 'all', 'All workloads');
  for (const name of new Set(report.results.map((row) => row.workload)))
    option(workload, name, workloadLabels[name] || name);
  option(size, 'all', 'All sizes');
  for (const value of [...new Set(report.results.map((row) => row.size))].sort((a, b) => a - b))
    option(size, String(value), format(value));
  if ([...workload.options].some((option) => option.value === 'array-visible-row'))
    workload.value = 'array-visible-row';
  else if (workload.options.length > 1) workload.selectedIndex = 1;
  if ([...size.options].some((option) => option.value === '10000')) size.value = '10000';
  else if (size.options.length > 1) size.selectedIndex = 1;
  function values(row) {
    return row.samples.map((sample) =>
      metric.value === 'startup'
        ? sample.setupMs + sample.mountMs
        : metric.value === 'setup'
          ? sample.setupMs
          : metric.value === 'mount'
            ? sample.mountMs
            : metric.value === 'unmount'
              ? sample.unmountMs
              : metric.value === 'renders'
                ? sample.renders / row.operations
                : sample.updateMs / row.operations,
    );
  }
  function draw() {
    const filtered = report.results.filter(
      (row) =>
        (workload.value === 'all' || row.workload === workload.value) &&
        (size.value === 'all' || String(row.size) === size.value),
    );
    const groups = new Map();
    for (const row of filtered) {
      const key = JSON.stringify([row.workload, row.size, row.consumers, row.operations]);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    }
    const host = document.getElementById('comparisons');
    host.replaceChildren();
    document.getElementById('status').textContent =
      groups.size +
      ' comparable case' +
      (groups.size === 1 ? '' : 's') +
      ' · ' +
      metric.options[metric.selectedIndex].textContent +
      ' · Lower is better';
    if (!groups.size)
      host.append(
        element('p', 'No results match these filters. Choose another workload or size.', 'empty'),
      );
    for (const rows of groups.values()) {
      rows.sort(
        (a, b) => Object.keys(names).indexOf(a.library) - Object.keys(names).indexOf(b.library),
      );
      const item = rows[0],
        section = element('section', undefined, 'comparison');
      section.append(element('h2', workloadLabels[item.workload] || item.workload));
      section.append(element('p', descriptions[item.workload] || item.workload));
      section.append(
        element(
          'div',
          format(item.size) +
            ' records · ' +
            format(item.consumers) +
            ' consumers · ' +
            format(item.operations) +
            ' operations per sample',
          'case-meta',
        ),
      );
      const unit =
        metric.value === 'renders' ? 'calls/op' : metric.value === 'update' ? 'ms/op' : 'ms';
      section.append(element('div', '↓ Lower is better', 'direction'));
      section.append(
        element(
          'p',
          'Median ' +
            metric.options[metric.selectedIndex].textContent +
            '. Bars share a zero baseline within this case.',
          'chart-note',
        ),
      );
      const stats = rows.map((row) => summarize(values(row))),
        maximum = Math.max(...stats.map((stat) => stat.median), Number.EPSILON),
        bars = element('div', undefined, 'bars');
      bars.setAttribute('aria-label', 'Median comparison; exact statistics follow in the table');
      rows.forEach((row, index) => {
        const bar = element('div', undefined, 'bar-row'),
          track = element('div', undefined, 'track'),
          fill = element('div', undefined, 'fill');
        fill.style.width = (stats[index].median / maximum) * 100 + '%';
        fill.style.backgroundColor = colors[row.library] || '#526679';
        track.append(fill);
        track.setAttribute('aria-hidden', 'true');
        bar.append(
          element('div', names[row.library] || row.library, 'bar-label'),
          track,
          element('div', format(stats[index].median) + ' ' + unit, 'bar-number'),
        );
        bars.append(bar);
      });
      section.append(bars);
      const wrap = element('div', undefined, 'table-wrap'),
        table = element('table');
      table.append(
        element(
          'caption',
          metric.options[metric.selectedIndex].textContent +
            '; exact update render counts are totals per sample.',
        ),
      );
      wrap.tabIndex = 0;
      wrap.setAttribute('role', 'region');
      wrap.setAttribute('aria-label', 'Statistics table; scroll horizontally on small screens');
      const head = element('thead'),
        heading = element('tr');
      for (const title of [
        'Library',
        'Median (' + unit + ')',
        (metric.value === 'update' ? 'P95 sample mean' : 'P95') + ' (' + unit + ')',
        'Min–max (' + unit + ')',
        'Exact render calls',
      ]) {
        const cell = element('th', title);
        cell.scope = 'col';
        heading.append(cell);
      }
      head.append(heading);
      table.append(head);
      const body = element('tbody');
      rows.forEach((row, index) => {
        const tr = element('tr'),
          stat = stats[index],
          renders = summarize(row.samples.map((sample) => sample.renders)),
          name = element('th', names[row.library] || row.library);
        name.scope = 'row';
        tr.append(name);
        for (const value of [
          format(stat.median),
          format(stat.p95),
          format(stat.min) + '–' + format(stat.max),
          format(renders.min) + '–' + format(renders.max),
        ])
          tr.append(element('td', value));
        body.append(tr);
      });
      table.append(body);
      wrap.append(table);
      section.append(
        wrap,
        element(
          'p',
          'Compare within this case. Differences between cases reflect different work, not an overall ranking.',
          'chart-note',
        ),
      );
      host.append(section);
    }
  }
  for (const select of [workload, size, metric]) select.addEventListener('change', draw);
  draw();
  document.getElementById('download').addEventListener('click', () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }),
    );
    const link = element('a');
    link.href = url;
    link.download = 'results.json';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}
