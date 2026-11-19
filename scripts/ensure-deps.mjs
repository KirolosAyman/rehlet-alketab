import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
const web = resolve(import.meta.dirname, '../web');
if (!existsSync(resolve(web, 'node_modules/.bin/vite.cmd')) && !existsSync(resolve(web, 'node_modules/.bin/vite'))) {
    console.log('First run: installing packages (only once)...');
    const r = spawnSync('npm install --no-audit --no-fund', { cwd: web, stdio: 'inherit', shell: true });
    if (r.status !== 0) process.exit(1);
}