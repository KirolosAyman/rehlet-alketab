// Runs every check in order with a clear summary. Usage (from web/): npm run check
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

spawnSync(process.execPath, [resolve(import.meta.dirname, 'banner.mjs'), 'Running all checks'], { stdio: 'inherit' });

const color = !process.env.NO_COLOR;
const c = (code, s) => (color ? `\x1b[${code}m${s}\x1b[0m` : s);
const web = resolve(import.meta.dirname, '../web');
const steps = [
  ['Lint', 'npm run lint'],
  ['Type-check', 'npm run typecheck'],
  ['Web unit tests', 'npm run test'],
  ['API unit tests', 'npm run test:api'],
  ['Build', 'npm run build'],
];

const results = [];
for (const [name, cmd] of steps) {
  console.log(c('1;36', `\n━━ ${name} ━━ `) + c('2', cmd));
  const t0 = Date.now();
  const r = spawnSync(cmd, { cwd: web, stdio: 'inherit', shell: true });
  results.push([name, r.status === 0, Date.now() - t0]);
}

console.log(c('1', '\nSummary'));
for (const [name, ok, ms] of results) console.log(`  ${ok ? c('32', '✔') : c('31', '✘')} ${name.padEnd(16)} ${c('2', (ms / 1000).toFixed(1) + 's')}`);
const failed = results.filter((r) => !r[1]).length;
console.log(failed ? c('1;31', `\n${failed} step(s) failed — copy the red output above and send it.`) : c('1;32', '\nAll green ✔  Ready to deploy.'));
process.exit(failed ? 1 : 0);
