import type { TransformOptions } from '@babel/core';
import type { CompilerOptions } from './plugin.js';

interface LoaderContext {
  resourcePath: string;
  cacheable(): void;
  getOptions(): CompilerOptions;
  async(): (error: Error | null, code?: string, map?: unknown) => void;
}

/** The documented loader API subset shared by Webpack and Turbopack. */
function loader(
  this: LoaderContext,
  source: string,
  sourceMap?: TransformOptions['inputSourceMap'],
) {
  this.cacheable();
  const callback = this.async();
  const options = this.getOptions();
  import('./next-transform.js')
    .then(({ transformNext }) => transformNext(source, this.resourcePath, options, sourceMap))
    .then(
      (result) => callback(null, result.code, result.map),
      (error: unknown) => callback(error instanceof Error ? error : new Error(String(error))),
    );
}

export = loader;
