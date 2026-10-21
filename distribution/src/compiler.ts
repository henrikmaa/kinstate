import plugin, { type CompilerOptions } from '@kinstate/compiler';

export type { CompilerOptions } from '@kinstate/compiler';

/** Git consumers import the React integration through this distribution. */
export default function kinstatePlugin(
  api: Parameters<typeof plugin>[0],
  options: CompilerOptions = {},
): ReturnType<typeof plugin> {
  return plugin(api, { ...options, importSource: options.importSource ?? 'kinstate/react' });
}
