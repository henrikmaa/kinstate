import { transformSync } from '@babel/core';
import { describe, expect, it } from 'vitest';
import plugin from '../src/index.js';
import fixtures from './characterization/corpus.json' with { type: 'json' };

type Characterization = {
  name: string;
  source: string;
  expected:
    { kind: 'output'; code: string; map: unknown } | { kind: 'diagnostic'; message: string };
};

// Captured from the pre-maintenance public Babel plugin. Keep this independent
// of the compiler's internal modules so reorganizing passes cannot bless changes
// to generated code, source mappings, or user-facing code-frame diagnostics.
// Preserve the historical namespace and filenames: changing source string lengths
// would also change these frozen source-map columns. Current-default coverage
// lives in compiler.test.ts and the Kinstate integration tests.
const corpus = fixtures as Characterization[];

function compile({ name, source }: Characterization): Characterization['expected'] {
  try {
    const result = transformSync(source, {
      filename: `/react-service/characterization/${name}.tsx`,
      sourceFileName: `${name}.tsx`,
      configFile: false,
      babelrc: false,
      highlightCode: false,
      sourceMaps: true,
      parserOpts: { plugins: ['typescript', 'jsx'] },
      plugins: [[plugin, { importSource: '@react-service/react' }]],
    })!;
    return { kind: 'output', code: result.code!, map: result.map };
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    return { kind: 'diagnostic', message: error.message };
  }
}

describe('public compiler contract before maintenance', () => {
  it.each(corpus)('$name', (fixture) => {
    expect(compile(fixture)).toEqual(fixture.expected);
  });
});
