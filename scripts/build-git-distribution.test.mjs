import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';
import { rewriteDistributionModule } from './build-git-distribution.mjs';

const resolveSpecifier = (specifier) =>
  specifier.startsWith('@kinstate/') ? `./runtime/${specifier.slice(10)}.js` : undefined;
test('rewrites module references without changing generated compiler strings or external imports', () => {
  const code = `import { Service } from '@kinstate/core';\nexport * from '@kinstate/react';\nconst literal = '@kinstate/core';\nconst generated = t.stringLiteral('@kinstate/react/internal');\nconst lazy = import('@kinstate/compiler');\nconst required = require('@kinstate/core/internal');\nimport React from 'react';\n`;
  const result = rewriteDistributionModule(code, 'entry.js', resolveSpecifier);
  assert.match(result.code, /from "\.\/runtime\/core.js"/);
  assert.match(result.code, /export \* from "\.\/runtime\/react.js"/);
  assert.match(result.code, /import\("\.\/runtime\/compiler.js"\)/);
  assert.match(result.code, /require\("\.\/runtime\/core\/internal.js"\)/);
  assert.ok(result.code.includes("const literal = '@kinstate/core'"));
  assert.ok(result.code.includes("t.stringLiteral('@kinstate/react/internal')"));
  assert.ok(result.code.includes("from 'react'"));
  const original = originalPositionFor(new TraceMap(result.map), { line: 3, column: 6 });
  assert.equal(original.line, 3);
  assert.equal(original.column, 6);
});
test('rewrites declaration import types and preserves precise source positions after longer imports', () => {
  const code = `export type Service = import('@kinstate/core').Service;\nexport declare const value: number;\n`;
  const result = rewriteDistributionModule(code, 'entry.d.ts', resolveSpecifier);
  assert.ok(result.code.includes('import("./runtime/core.js").Service'));
  const position = originalPositionFor(new TraceMap(result.map), { line: 2, column: 21 });
  assert.equal(position.line, 2);
  assert.equal(position.column, 21);
});
test('does not emit a replacement map for unrelated modules', () => {
  const code = `import { readFile } from 'node:fs/promises';`;
  const result = rewriteDistributionModule(code, 'entry.js', resolveSpecifier);
  assert.equal(result.code, code);
  assert.equal(result.map, undefined);
});
