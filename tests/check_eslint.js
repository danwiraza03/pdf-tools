/**
 * ESLint Suite: undefined and redeclared names
 * Executes `npm run lint` to ensure zero undefined or redeclared identifiers across the repository.
 */

'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';

console.log('========================================================================');
console.log('            ESLINT: UNDEFINED AND REDECLARED NAMES                      ');
console.log('========================================================================\n');

console.log('Running `npm run lint` across repository files...');

const result = spawnSync(npmCmd, ['run', 'lint'], {
  cwd: ROOT_DIR,
  encoding: 'utf8',
  stdio: 'inherit',
  shell: isWindows
});

if (result.status !== 0) {
  console.error('\n❌ [FAIL] ESLint check failed with errors.');
  process.exit(result.status || 1);
} else {
  console.log('\n✅ [PASS] ESLint check passed with 0 errors.');
  console.log('========================================================================\n');
  process.exit(0);
}
