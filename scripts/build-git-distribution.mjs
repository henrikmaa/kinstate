import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import MagicString from 'magic-string';
import remapping from '@jridgewell/remapping';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'distribution/dist');

export function rewriteDistributionModule(code, fileName, resolveSpecifier) {
  const source = ts.createSourceFile(fileName, code, ts.ScriptTarget.Latest, true);
  const edited = new MagicString(code);
  let changed = false;
  function replace(literal) {
    if (!literal || !ts.isStringLiteral(literal)) return;
    const replacement = resolveSpecifier(literal.text);
    if (!replacement || replacement === literal.text) return;
    edited.overwrite(literal.getStart(source), literal.getEnd(), JSON.stringify(replacement));
    changed = true;
  }
  function visit(node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) replace(node.moduleSpecifier);
    else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument))
      replace(node.argument.literal);
    else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
    )
      replace(node.arguments[0]);
    ts.forEachChild(node, visit);
  }
  visit(source);
  return {
    code: edited.toString(),
    map: changed
      ? JSON.parse(
          edited
            .generateMap({ source: fileName, file: fileName, includeContent: true, hires: true })
            .toString(),
        )
      : undefined,
  };
}

async function files(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    result.push(...(entry.isDirectory() ? await files(path) : [path]));
  }
  return result;
}

export async function buildGitDistribution() {
  await rm(resolve(output, 'workspaces'), { recursive: true, force: true });
  await rm(resolve(root, 'distribution/sources'), { recursive: true, force: true });
  const origins = new Map((await files(output)).map((path) => [path, path]));
  const exports = new Map();
  const sourceRoots = [];
  for (const name of ['core', 'react', 'compiler']) {
    const packageRoot = resolve(root, 'packages', name);
    const destination = resolve(output, 'workspaces', name);
    const manifest = JSON.parse(await readFile(resolve(packageRoot, 'package.json'), 'utf8'));
    await mkdir(destination, { recursive: true });
    await cp(resolve(packageRoot, 'dist'), destination, { recursive: true });
    await cp(resolve(packageRoot, 'src'), resolve(root, 'distribution/sources', name), {
      recursive: true,
    });
    sourceRoots.push([resolve(packageRoot, 'src'), resolve(root, 'distribution/sources', name)]);
    for (const path of await files(destination))
      origins.set(path, resolve(packageRoot, 'dist', relative(destination, path)));
    for (const [key, entry] of Object.entries(manifest.exports)) {
      const target = typeof entry === 'string' ? entry : (entry.import ?? entry.default);
      exports.set(
        `@kinstate/${name}${key === '.' ? '' : key.slice(1)}`,
        resolve(destination, target.replace(/^\.\/dist\//, '')),
      );
    }
  }
  for (const [path, origin] of origins) {
    if (!/\.(?:[cm]?js|d\.[cm]?ts)$/.test(path)) continue;
    const fileName = basename(path);
    const rewritten = rewriteDistributionModule(
      await readFile(path, 'utf8'),
      fileName,
      (specifier) => {
        if (!specifier.startsWith('@kinstate/')) return;
        const target = exports.get(specifier);
        if (!target) throw new Error(`Unknown private distribution import: ${specifier}`);
        const route = relative(dirname(path), target).replaceAll('\\', '/');
        return route.startsWith('.') ? route : `./${route}`;
      },
    );
    await writeFile(path, rewritten.code);
    let originalMap;
    try {
      originalMap = JSON.parse(await readFile(`${origin}.map`, 'utf8'));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    if (originalMap) {
      originalMap.sources = originalMap.sources.map((source) => {
        const original = resolve(dirname(origin), originalMap.sourceRoot ?? '', source);
        const owner = sourceRoots.find(([directory]) => original.startsWith(`${directory}${sep}`));
        const target = owner ? resolve(owner[1], relative(owner[0], original)) : original;
        return relative(dirname(path), target).replaceAll('\\', '/');
      });
      delete originalMap.sourceRoot;
      const finalMap = rewritten.map
        ? remapping([rewritten.map, originalMap], () => null)
        : originalMap;
      await writeFile(`${path}.map`, JSON.stringify(finalMap));
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await buildGitDistribution();
