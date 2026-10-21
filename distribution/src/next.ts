import { withKinstate as configure } from '@kinstate/compiler/next';

/** Preserve Next's SWC integration while using the Git distribution runtime. */
export function withKinstate(
  config: Parameters<typeof configure>[0] = {},
  options: Parameters<typeof configure>[1] = {},
): ReturnType<typeof configure> {
  return configure(config, { ...options, importSource: options.importSource ?? 'kinstate/react' });
}
