export function benchmarkProvenance(
  root?: string,
): Promise<{
  commit: string;
  dirty: boolean;
  dirtyPaths: string[];
  sourceHash: string;
  lockfileHash: string;
  buildHash: string;
}>;
