import { transformAsync } from '@babel/core';
import type { Plugin } from 'vite';
import kinstatePlugin, { type CompilerOptions } from './index.js';

export interface KinstateOptions extends CompilerOptions {
  include?: RegExp;
}

/** Run before JSX lowering; type syntax is intentionally preserved for Vite. */
export default function kinstate(options: KinstateOptions = {}): Plugin {
  return {
    name: 'kinstate',
    enforce: 'pre',
    async transform(code, id) {
      const filename = id.split('?')[0]!;
      const included = options.include ?? /\.[cm]?[jt]sx?$/;
      included.lastIndex = 0;
      if (
        filename.includes('/node_modules/') ||
        !included.test(filename) ||
        (!options.reactiveProps && !code.includes(options.importSource ?? '@kinstate/react'))
      )
        return null;
      const result = await transformAsync(code, {
        filename,
        configFile: false,
        babelrc: false,
        sourceMaps: true,
        parserOpts: {
          sourceType: 'module',
          plugins: ['jsx', ...(/\.[cm]?tsx?$/.test(filename) ? ['typescript' as const] : [])],
        },
        plugins: [[kinstatePlugin, options]],
      });
      return result?.code ? { code: result.code, map: result.map } : null;
    },
  };
}
export { kinstate };
