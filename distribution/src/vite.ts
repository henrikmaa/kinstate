import adapter, { type KinstateOptions } from '@kinstate/compiler/vite';

export type { KinstateOptions } from '@kinstate/compiler/vite';

export default function kinstate(options: KinstateOptions = {}): ReturnType<typeof adapter> {
  return adapter({ ...options, importSource: options.importSource ?? 'kinstate/react' });
}

export { kinstate };
