import { execFileSync } from 'node:child_process';
const run = (args) => execFileSync('npm', args, { stdio: 'inherit' });
try {
  for (const version of ['18.3.1', '19.3.1']) {
    console.log(`\nVerifying React ${version}`);
    run([
      'install',
      '--no-save',
      '--package-lock=false',
      '--workspaces=false',
      `react@${version}`,
      `react-dom@${version}`,
    ]);
    const actual = execFileSync(process.execPath, ['-p', "require('react').version"], {
      encoding: 'utf8',
    }).trim();
    if (actual !== version) throw new Error(`Expected React ${version}, resolved ${actual}`);
    run(['test']);
  }
} finally {
  // Restore the exact committed dependency graph even if a matrix leg fails.
  run(['ci']);
}
