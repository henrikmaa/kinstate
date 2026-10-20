import { readFile, readdir } from 'node:fs/promises';
import { isBuiltin } from 'node:module';
import { dirname, posix, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const packageKeys = ['core', 'react', 'compiler'];

function ownerOf(file) {
  return /^packages\/(core|react|compiler)\/src\//.exec(file)?.[1];
}

function externalPackage(specifier) {
  return specifier.startsWith('@')
    ? specifier.split('/').slice(0, 2).join('/')
    : specifier.split('/')[0];
}

function runtimeImport(node) {
  if (ts.isImportDeclaration(node)) {
    const clause = node.importClause;
    if (!clause) return true;
    if (clause.isTypeOnly) return false;
    const bindings = clause.namedBindings;
    return (
      !!clause.name ||
      !bindings ||
      !ts.isNamedImports(bindings) ||
      bindings.elements.length === 0 ||
      bindings.elements.some((item) => !item.isTypeOnly)
    );
  }
  if (ts.isExportDeclaration(node)) {
    if (node.isTypeOnly) return false;
    return (
      !node.exportClause ||
      !ts.isNamedExports(node.exportClause) ||
      node.exportClause.elements.length === 0 ||
      node.exportClause.elements.some((item) => !item.isTypeOnly)
    );
  }
  return !ts.isImportEqualsDeclaration(node) || !node.isTypeOnly;
}

/** Collect real module references, never string literals used to generate compiler output. */
function importsOf(source) {
  const imports = [];
  function visit(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      imports.push({ specifier: node.moduleSpecifier.text, runtime: runtimeImport(node), node });
    } else if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteralLike(node.argument.literal)
    ) {
      imports.push({ specifier: node.argument.literal.text, runtime: false, node });
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference) &&
      node.moduleReference.expression &&
      ts.isStringLiteralLike(node.moduleReference.expression)
    ) {
      imports.push({
        specifier: node.moduleReference.expression.text,
        runtime: runtimeImport(node),
        node,
      });
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require')) &&
      node.arguments.length >= 1 &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      imports.push({ specifier: node.arguments[0].text, runtime: true, node });
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return imports;
}

function resolveSource(file, files) {
  const stem = file.replace(/\.(?:[cm]?js|tsx?)$/, '');
  return [
    file,
    `${stem}.ts`,
    `${stem}.tsx`,
    `${stem}.mts`,
    `${stem}.cts`,
    `${file}/index.ts`,
    `${file}/index.tsx`,
  ].find((candidate) => Object.hasOwn(files, candidate));
}

function resolveWorkspace(specifier, manifests, files) {
  const name = externalPackage(specifier);
  const entry = Object.entries(manifests).find(([, manifest]) => manifest.name === name);
  if (!entry) return;
  const [key, manifest] = entry;
  const subpath = specifier.slice(name.length);
  const exported = manifest.exports?.[subpath ? `.${subpath}` : '.'];
  const target = typeof exported === 'string' ? exported : (exported?.import ?? exported?.default);
  if (typeof target === 'string') {
    return resolveSource(
      `packages/${key}/${target.replace(/^\.\//, '').replace(/^dist\//, 'src/')}`,
      files,
    );
  }
  return resolveSource(`packages/${key}/src/${subpath ? subpath.slice(1) : 'index'}.ts`, files);
}

/**
 * Audit supplied source text and package manifests without touching the filesystem.
 * `files` uses repository-relative POSIX paths; `packages` is keyed by package directory.
 * Only maintained package source is inspected; fixtures can provide minimal manifests.
 */
export function auditBoundaries({ files, packages: manifests }) {
  const errors = [];
  const graph = new Map();
  for (const [file, text] of Object.entries(files)) {
    const owner = ownerOf(file);
    if (!owner) continue;
    const manifest = manifests[owner];
    if (!manifest) {
      errors.push(`${file}: missing package manifest for ${owner}`);
      continue;
    }
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    const report = (node, message) => {
      const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
      errors.push(`${file}:${line + 1}: ${message}`);
    };
    graph.set(file, []);
    for (const diagnostic of source.parseDiagnostics) {
      errors.push(`${file}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ')}`);
    }
    if (
      /\/src\/index\.[cm]?tsx?$/.test(file) ||
      /^packages\/react\/src\/internal\.tsx?$/.test(file)
    ) {
      for (const statement of source.statements) {
        const directive =
          ts.isExpressionStatement(statement) && ts.isStringLiteral(statement.expression);
        const reexport = ts.isExportDeclaration(statement) && statement.moduleSpecifier;
        if (!directive && !reexport)
          report(statement, 'Public barrels may contain only directives and re-exports');
      }
    }
    const declared = new Set([
      ...Object.keys(manifest.dependencies ?? {}),
      ...Object.keys(manifest.devDependencies ?? {}),
      ...Object.keys(manifest.peerDependencies ?? {}),
    ]);
    for (const reference of importsOf(source)) {
      const { specifier, runtime, node } = reference;
      if (specifier.startsWith('.')) {
        const target = posix.normalize(posix.join(posix.dirname(file), specifier));
        const targetOwner = /^packages\/([^/]+)\//.exec(target)?.[1];
        if (targetOwner && targetOwner !== owner) {
          report(node, `Relative cross-package import is forbidden: ${specifier}`);
          continue;
        }
        if (!target.startsWith(`packages/${owner}/src/`)) {
          report(node, `Relative imports must stay within maintained package source: ${specifier}`);
          continue;
        }
        const resolved = resolveSource(target, files);
        if (!resolved) report(node, `Unresolved local import: ${specifier}`);
        else if (runtime) graph.get(file).push(resolved);
        continue;
      }
      if (isBuiltin(specifier)) {
        // Runtime packages must remain usable in browsers; compiler tooling may use Node.
        if (runtime && owner !== 'compiler')
          report(node, `Node runtime import is forbidden in ${owner}: ${specifier}`);
        continue;
      }
      const name = externalPackage(specifier);
      if (!declared.has(name)) report(node, `Undeclared external dependency: ${name}`);
      if (
        owner === 'core' &&
        (name === 'react' ||
          name === 'react-dom' ||
          name === '@kinstate/react' ||
          name === '@kinstate/compiler')
      ) {
        report(node, `Core must remain React/framework independent: ${specifier}`);
      }
      if (owner === 'react' && name === '@kinstate/compiler') {
        report(node, `React runtime cannot import compiler tooling: ${specifier}`);
      }
      if (
        owner === 'compiler' &&
        runtime &&
        (name === '@kinstate/core' ||
          name === '@kinstate/react' ||
          name === 'react' ||
          name === 'react-dom')
      ) {
        report(node, `Compiler cannot import framework runtime: ${specifier}`);
      }
      if (runtime) {
        const resolved = resolveWorkspace(specifier, manifests, files);
        if (resolved) graph.get(file).push(resolved);
      }
    }
  }
  const completed = new Set();
  const active = new Set();
  const stack = [];
  function visit(file) {
    if (active.has(file)) {
      errors.push(
        `Runtime import cycle: ${[...stack.slice(stack.indexOf(file)), file].join(' -> ')}`,
      );
      return;
    }
    if (completed.has(file)) return;
    active.add(file);
    stack.push(file);
    for (const dependency of graph.get(file) ?? []) visit(dependency);
    stack.pop();
    active.delete(file);
    completed.add(file);
  }
  for (const file of graph.keys()) visit(file);
  return errors;
}

async function readProject(root) {
  const files = {};
  const packages = {};
  async function walk(directory) {
    for (const entry of await readdir(resolve(root, directory), { withFileTypes: true })) {
      const file = `${directory}/${entry.name}`;
      if (entry.isDirectory()) await walk(file);
      else if (/\.[cm]?tsx?$/.test(file)) files[file] = await readFile(resolve(root, file), 'utf8');
    }
  }
  for (const key of packageKeys) {
    packages[key] = JSON.parse(
      await readFile(resolve(root, `packages/${key}/package.json`), 'utf8'),
    );
    await walk(`packages/${key}/src`);
  }
  return { files, packages };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const errors = auditBoundaries(await readProject(root));
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exitCode = 1;
  } else
    console.log(
      'Package boundaries, public barrels, declared dependencies and runtime import graph passed.',
    );
}
