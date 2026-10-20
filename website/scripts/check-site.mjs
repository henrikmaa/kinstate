import { readFile, readdir, access } from 'node:fs/promises';
import { resolve, relative, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const output = resolve(
  fileURLToPath(new URL('..', import.meta.url)),
  process.env.DOCS_OUT_DIR ?? 'doc_build',
);
const base = process.env.DOCS_BASE ?? '/';
async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) =>
        entry.isDirectory() ? files(join(directory, entry.name)) : join(directory, entry.name),
      ),
    )
  ).flat();
}
async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
const html = (await files(output)).filter((file) => file.endsWith('.html'));
if (html.length < 20) throw new Error(`Expected at least 20 generated pages; found ${html.length}`);
const errors = new Set();
let references = 0;
for (const file of html) {
  const pagePath = relative(output, file).replaceAll('\\', '/');
  const url = new URL(`${base}${pagePath}`, 'https://docs.example');
  const dom = new JSDOM(await readFile(file, 'utf8'), { url: url.href });
  for (const element of dom.window.document.querySelectorAll(
    'a[href],script[src],link[href],img[src]',
  )) {
    const target = new URL(element.getAttribute('href') ?? element.getAttribute('src'), url);
    if (target.origin !== url.origin || target.pathname === `${base}404`) continue;
    references++;
    if (!target.pathname.startsWith(base)) {
      errors.add(`${pagePath}: URL escapes ${base}: ${target.pathname}`);
      continue;
    }
    const name = decodeURIComponent(target.pathname.slice(base.length));
    const path = resolve(output, name || 'index.html');
    if (path !== output && !path.startsWith(`${output}${sep}`)) {
      errors.add(`${pagePath}: invalid target ${name}`);
      continue;
    }
    const candidates = [path, `${path}.html`, join(path, 'index.html')];
    if (!(await Promise.all(candidates.map(exists))).some(Boolean))
      errors.add(`${pagePath}: missing ${target.pathname}`);
  }
  dom.window.close();
}
if (errors.size) throw new Error([...errors].join('\n'));
console.log(
  `Verified ${html.length} static pages and ${references} local references under ${base}.`,
);
