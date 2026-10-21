import type { NextConfig } from 'next';
import { fileURLToPath, URL } from 'node:url';
import type { CompilerOptions } from './plugin.js';

/** Configure the instrumentation prepass for Next 16 without replacing SWC. */
export function withKinstate(config: NextConfig = {}, options: CompilerOptions = {}): NextConfig {
  const loader = fileURLToPath(new URL('./next-loader.cjs', import.meta.url));
  const compilerOptions = { reactiveProps: 'client' as const, ...options };
  const rules = { ...config.turbopack?.rules };
  for (const extension of ['js', 'jsx', 'ts', 'tsx', 'mjs', 'mts']) {
    const pattern = `*.${extension}`;
    const existing = rules[pattern];
    rules[pattern] = [
      ...(existing ? (Array.isArray(existing) ? existing : [existing]) : []),
      { condition: { not: 'foreign' }, loaders: [{ loader, options: compilerOptions }] },
    ];
  }
  const webpack = config.webpack;
  return {
    ...config,
    turbopack: { ...config.turbopack, rules },
    webpack(input, context) {
      // Compose after the application's hook so a returned config cannot drop tracking.
      const webpackConfig = webpack ? webpack(input, context) : input;
      if (webpackConfig && typeof webpackConfig.then === 'function')
        throw new Error(
          'Kinstate: Next.js webpack hooks must return configuration synchronously. Put asynchronous setup in the exported Next config function instead.',
        );
      // Pre-loaders run before Next's SWC loader and preserve its normal configuration.
      webpackConfig.module ??= {};
      webpackConfig.module.rules ??= [];
      webpackConfig.module.rules.push({
        test: /\.[cm]?[jt]sx?$/,
        exclude: /(?:^|[\\/])node_modules(?:[\\/]|$)/,
        enforce: 'pre',
        use: [{ loader, options: compilerOptions }],
      });
      return webpackConfig;
    },
  };
}
