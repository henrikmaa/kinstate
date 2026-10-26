import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { resolve, relative } from 'node:path';

async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) =>
        entry.isDirectory()
          ? files(resolve(directory, entry.name))
          : resolve(directory, entry.name),
      ),
    )
  ).flat();
}
async function hashFiles(paths, root) {
  const hash = createHash('sha256');
  for (const path of paths.sort()) {
    hash.update(relative(root, path));
    hash.update('\0');
    try {
      hash.update(await readFile(path));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      hash.update('<deleted>');
    }
    hash.update('\0');
  }
  return hash.digest('hex');
}
/** Fingerprint executable source and the exact production bundle, including dirty worktrees. */
export async function benchmarkProvenance(root = process.cwd()) {
  const git = (args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  const source = git(['ls-files', '--cached', '--others', '--exclude-standard'])
    .split('\n')
    .filter(
      (path) =>
        /^(packages\/(core|react|compiler)\/src\/|benchmarks\/)/.test(path) &&
        /\.(?:[cm]?[jt]sx?|css)$/.test(path) &&
        !path.includes('/.dist/'),
    );
  const lock = await readFile(resolve(root, 'package-lock.json'));
  const manifests = [
    'package.json',
    'tsconfig.json',
    'packages/core/package.json',
    'packages/react/package.json',
    'packages/compiler/package.json',
    'packages/core/tsconfig.json',
    'packages/react/tsconfig.json',
    'packages/compiler/tsconfig.json',
    'benchmarks/tsconfig.json',
  ];
  const status = git(['status', '--porcelain']);
  return {
    commit: git(['rev-parse', 'HEAD']),
    dirty: Boolean(status),
    dirtyPaths: status ? status.split('\n') : [],
    sourceHash: await hashFiles(
      [...new Set([...source, ...manifests])].map((path) => resolve(root, path)),
      root,
    ),
    lockfileHash: createHash('sha256').update(lock).digest('hex'),
    buildHash: await hashFiles(await files(resolve(root, 'benchmarks/.dist')), root),
  };
}
