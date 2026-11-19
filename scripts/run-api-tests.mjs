// Runs the Edge Function unit tests under Node (no Deno needed).
// Usage (Node ≥ 22.6): node --experimental-strip-types scripts/run-api-tests.mjs
import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const tests = [];
globalThis.Deno = { test: (name, fn) => tests.push({ name, fn }), env: { get: (k) => process.env[k] } };

const root = resolve(import.meta.dirname, '../supabase/functions/api/lib');
const files = [];
(function walk(d) {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (f.endsWith('_test.ts')) files.push(p);
  }
})(root);
for (const f of files) await import(pathToFileURL(f).href);

let pass = 0, fail = 0;
for (const t of tests) {
  try { await t.fn(); pass++; console.log(`  \x1b[32m✔\x1b[0m ${t.name}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✘ ${t.name}\x1b[0m\n    ${e?.message ?? e}`); }
}
console.log(`\n${fail ? '\x1b[31m' : '\x1b[32m'}${pass} passed, ${fail} failed\x1b[0m (${files.length} files)`);
process.exit(fail ? 1 : 0);
