import assert from 'node:assert/strict';
import test from 'node:test';
import { auditBoundaries } from './check-boundaries.mjs';

const manifests = {
  core: { name: '@kinstate/core' },
  react: {
    name: '@kinstate/react',
    dependencies: { '@kinstate/core': '*' },
    peerDependencies: { react: '*' },
  },
  compiler: {
    name: '@kinstate/compiler',
    dependencies: { '@babel/types': '*' },
    peerDependencies: { vite: '*' },
  },
};
function audit(files, packages = manifests) {
  return auditBoundaries({ files, packages });
}

test('accepts acyclic package exports and declared external type dependencies', () => {
  assert.deepEqual(
    audit({
      'packages/core/src/index.ts': "export { value } from './state.js';",
      'packages/core/src/state.ts': 'export const value = 1;',
      'packages/react/src/index.tsx': "'use client'; export { value } from './runtime.js';",
      'packages/react/src/runtime.ts':
        "import { value } from '@kinstate/core'; import { useState } from 'react'; export { value, useState };",
      'packages/compiler/src/plugin.ts':
        "import type { Plugin } from 'vite'; export type T = Plugin;",
    }),
    [],
  );
});

test('finds runtime import cycles through .js imports resolved to TypeScript', () => {
  const errors = audit({
    'packages/core/src/a.ts': "import { b } from './b.js'; export const a = b;",
    'packages/core/src/b.tsx': "import { a } from './a.js'; export const b = a;",
  });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /Runtime import cycle: .*a\.ts -> .*b\.tsx -> .*a\.ts/);
});

test('type-only imports and type-only re-exports do not create runtime cycles', () => {
  assert.deepEqual(
    audit({
      'packages/core/src/a.ts': "import type { B } from './b.js'; export interface A { b: B }",
      'packages/core/src/b.ts': "export { type A } from './a.js'; export interface B {}",
    }),
    [],
  );
});

test('mixed imports preserve runtime edges while all-type specifiers are erased', () => {
  assert.deepEqual(
    audit({
      'packages/core/src/a.ts': "import { type B } from './b.js'; export interface A {}",
      'packages/core/src/b.ts': "import { A } from './a.js'; export const B = A;",
    }),
    [],
  );
  assert.match(
    audit({
      'packages/core/src/a.ts': "import { type B, value } from './b.js'; export const A = value;",
      'packages/core/src/b.ts':
        "import { A } from './a.js'; export const value = A; export interface B {}",
    }).join('\n'),
    /Runtime import cycle/,
  );
});

test('core cannot depend on React even when the dependency is declared', () => {
  const errors = audit(
    { 'packages/core/src/state.ts': "import type { ReactNode } from 'react';" },
    {
      ...manifests,
      core: { ...manifests.core, devDependencies: { react: '*' } },
    },
  );
  assert.equal(errors.length, 1);
  assert.match(errors[0], /Core must remain React\/framework independent/);
  assert.match(
    audit({ 'packages/core/src/state.ts': "type Node = import('react').ReactNode;" }).join('\n'),
    /Core must remain React\/framework independent/,
  );
});

test('relative cross-package imports cannot bypass package boundaries', () => {
  assert.match(
    audit({
      'packages/react/src/runtime.ts': "import { value } from '../../core/src/state.js';",
      'packages/core/src/state.ts': 'export const value = 1;',
    }).join('\n'),
    /Relative cross-package import is forbidden/,
  );
});

test('public barrels reject implementation but permit directives and re-exports', () => {
  for (const file of [
    'packages/core/src/index.ts',
    'packages/react/src/internal.ts',
    'packages/compiler/src/index.ts',
  ]) {
    assert.match(
      audit({ [file]: "'use client'; export const implementation = 1;" }).join('\n'),
      /Public barrels may contain only directives and re-exports/,
    );
  }
  assert.deepEqual(
    audit({
      'packages/react/src/internal.ts': "'use client'; export { protocol } from './protocol.js';",
      'packages/react/src/protocol.ts': 'export const protocol = 1;',
    }),
    [],
  );
});

test('external imports must be declared by the importing package, not the workspace', () => {
  assert.match(
    audit({ 'packages/react/src/runtime.ts': "import { x } from 'undeclared/subpath';" }).join(
      '\n',
    ),
    /Undeclared external dependency: undeclared/,
  );
  assert.deepEqual(
    audit({ 'packages/compiler/src/plugin.ts': "import * as types from '@babel/types';" }),
    [],
  );
});

test('runtime layers cannot import compiler tooling or compiler-import runtime', () => {
  assert.match(
    audit({
      'packages/react/src/runtime.ts': "import plugin from '@kinstate/compiler';",
    }).join('\n'),
    /React runtime cannot import compiler tooling/,
  );
  assert.match(
    audit({
      'packages/compiler/src/plugin.ts': "import { Service } from '@kinstate/core';",
    }).join('\n'),
    /Compiler cannot import framework runtime/,
  );
  assert.deepEqual(
    audit({
      'packages/compiler/src/plugin.ts':
        'const emitted = "import { useRenderFrame } from \'@kinstate/react/internal\'"; export { emitted };',
    }),
    [],
  );
});

test('dynamic imports and require calls are checked without scanning arbitrary strings', () => {
  assert.match(
    audit({ 'packages/core/src/state.ts': "const react = import('react');" }).join('\n'),
    /Core must remain React/,
  );
  assert.match(
    audit({ 'packages/react/src/runtime.ts': "const x = require('unknown');" }).join('\n'),
    /Undeclared external dependency: unknown/,
  );
});

test('compiler may import Node builtins while browser runtime packages remain portable', () => {
  assert.deepEqual(
    audit({ 'packages/compiler/src/plugin.ts': "import { readFile } from 'node:fs/promises';" }),
    [],
  );
  assert.match(
    audit({ 'packages/core/src/state.ts': "import { readFile } from 'node:fs/promises';" }).join(
      '\n',
    ),
    /Node runtime import is forbidden/,
  );
});

test('reports missing local imports and syntax errors', () => {
  assert.match(
    audit({ 'packages/core/src/state.ts': "import { value } from './missing.js';" }).join('\n'),
    /Unresolved local import/,
  );
  assert.ok(audit({ 'packages/core/src/state.ts': 'export const broken = ;' }).length > 0);
});
