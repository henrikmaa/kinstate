import { transformAsync, type TransformOptions } from '@babel/core';
import plugin, { type CompilerOptions } from './plugin.js';

/** Instrument only: Next's SWC still owns TypeScript, JSX, RSC and refresh transforms. */
export async function transformNext(
  code: string,
  filename: string,
  options: CompilerOptions,
  inputSourceMap?: TransformOptions['inputSourceMap'],
): Promise<{ code: string; map: TransformOptions['inputSourceMap'] | null }> {
  if (/\.d\.[cm]?ts$/.test(filename)) return { code, map: inputSourceMap || null };
  const result = await transformAsync(code, {
    filename,
    configFile: false,
    babelrc: false,
    sourceMaps: true,
    inputSourceMap,
    parserOpts: {
      sourceType: 'unambiguous',
      // Preserve Next's legacy TypeScript decorator syntax for its SWC pass.
      plugins: [
        'jsx',
        'decorators-legacy',
        ...(/\.[cm]?tsx?$/.test(filename) ? ['typescript' as const] : []),
      ],
    },
    plugins: [[plugin, options]],
  });
  return { code: result?.code ?? code, map: result?.map ?? null };
}
