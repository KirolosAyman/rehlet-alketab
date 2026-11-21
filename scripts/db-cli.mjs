#!/usr/bin/env node
// Database maintenance CLI: clear the app data and import it from a JSON file.
// Uses the Supabase REST API with the SERVICE ROLE key. Never commit that key.
//
// Run with: node scripts/db-cli.mjs --help

import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';

const ROOT = resolve(import.meta.dirname, '..');
const BATCH_SIZE = 250;

// Every table the app owns. `deleteFilter` keeps pg_safeupdate happy: it always
// contains a WHERE clause, so the statement is allowed to touch every row.
const TABLES = {
  students: { deleteFilter: 'id=not.is.null' },
  sessions: { deleteFilter: 'token_hash=not.is.null' },
  quizzes: { deleteFilter: 'id=not.is.null' },
  quiz_unlocks: { deleteFilter: 'quiz_id=not.is.null' },
  attempts: { deleteFilter: 'id=not.is.null' },
  assignments: { deleteFilter: 'id=not.is.null' },
  books: { deleteFilter: 'id=not.is.null' },
  settings: { deleteFilter: 'key=not.is.null' },
  app_secrets: { deleteFilter: 'key=not.is.null' },
  rate_limits: { deleteFilter: 'key=not.is.null' },
};

// Children before parents, so foreign keys never block a delete.
const CLEAR_ORDER = [
  'attempts',
  'quiz_unlocks',
  'assignments',
  'sessions',
  'quizzes',
  'books',
  'students',
  'rate_limits',
  'settings',
  'app_secrets',
];

// Parents before children, so foreign keys resolve during import.
const IMPORT_ORDER = [
  'students',
  'books',
  'quizzes',
  'quiz_unlocks',
  'attempts',
  'assignments',
  'sessions',
  'settings',
  'app_secrets',
  'rate_limits',
];

// Configuration tables. They are kept during a normal clear and are merged on
// import, so restoring a backup never needs an empty settings table.
const CONFIG_TABLES = new Set(['settings', 'app_secrets']);

const DEFAULT_SETTINGS = [
  { key: 'leaderboard_public', value: false },
  { key: 'ai_model', value: 'gemini-2.5-flash' },
  { key: 'max_published_per_day', value: 1 },
];

const HELP = `
Rehlet Alketab — database CLI

Usage
  node scripts/db-cli.mjs clear [options]
  node scripts/db-cli.mjs import <file.json> [options]

Commands
  clear              Delete app data. Keeps settings and app_secrets unless --all.
  import <file.json> Insert rows from a JSON file. Use --replace to clear first.

Options
  -y, --yes          Do not ask for confirmation (needed in scripts / CI).
      --url <url>    Supabase project URL. Default: SUPABASE_URL, then the
                     linked project in supabase/.temp/project-ref.
      --key <key>    Service-role key. Default: SUPABASE_SERVICE_ROLE_KEY.
      --key-file <f> Read the service-role key from a file instead of --key.
      --keep <list>  Comma-separated tables to leave untouched when clearing.
      --all          Also clear settings and app_secrets (full wipe).
      --replace      Run the clear step before importing.
      --upsert       Merge on primary-key conflicts instead of failing.
      --table <name> Table name when the JSON file is a plain array of rows.
      --dry-run      Show what would happen without changing anything.
      --no-defaults  Do not re-insert the default settings rows.
  -h, --help         Show this help.

JSON format
  An object keyed by table name, each value an array of rows:

    {
      "students": [ { "id": "...", "username": "...", "username_norm": "..." } ],
      "quizzes":  [ { "id": "...", "quiz_date": "2026-11-20", ... } ],
      "attempts": [ ... ]
    }

  A plain array is also accepted together with --table <name>.

Tables
  ${Object.keys(TABLES).join(', ')}

Import order is handled for you. Rows may omit columns that have database
defaults; keep primary keys when other rows reference them.
`;

const COLOR = !process.env.NO_COLOR && process.stdout.isTTY;
const c = (code, s) => (COLOR ? `\x1b[${code}m${s}\x1b[0m` : s);

function fail(message) {
  console.error(c('1;31', `\nError: ${message}\n`));
  process.exit(1);
}

function info(message) {
  console.log(message);
}

function parseCli() {
  try {
    return parseArgs({
      allowPositionals: true,
      options: {
        help: { type: 'boolean', short: 'h' },
        yes: { type: 'boolean', short: 'y' },
        url: { type: 'string' },
        key: { type: 'string' },
        'key-file': { type: 'string' },
        keep: { type: 'string' },
        all: { type: 'boolean' },
        replace: { type: 'boolean' },
        upsert: { type: 'boolean' },
        table: { type: 'string' },
        'dry-run': { type: 'boolean' },
        'no-defaults': { type: 'boolean' },
      },
    });
  } catch (e) {
    fail(e.message);
  }
}

function linkedRef() {
  try {
    return readFileSync(resolve(ROOT, 'supabase/.temp/project-ref'), 'utf8').trim();
  } catch {
    return '';
  }
}

function normalizeUrl(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    fail(`Invalid Supabase URL: ${raw}`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    fail(`Supabase URL must use http or https: ${raw}`);
  }
  // Accept the Edge Function URL or the REST URL and reduce both to the base.
  const path = url.pathname
    .replace(/\/+$/, '')
    .replace(/\/functions\/v1(?:\/.*)?$/, '')
    .replace(/\/rest\/v1(?:\/.*)?$/, '');
  url.pathname = path || '/';
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/$/, '');
}

function jwtRole(key) {
  const parts = key.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return typeof payload.role === 'string' ? payload.role : null;
  } catch {
    return null;
  }
}

function readKey(values) {
  if (values.key && values['key-file']) fail('Use either --key or --key-file, not both.');
  if (values.key) return values.key.trim();
  if (values['key-file']) {
    try {
      return readFileSync(resolve(values['key-file']), 'utf8').trim();
    } catch (e) {
      fail(`Cannot read key file: ${e.message}`);
    }
  }
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SERVICE_ROLE_KEY ||
    ''
  );
}

function resolveConfig(values, needKey) {
  const envUrl = process.env.SUPABASE_URL;
  const ref = linkedRef();
  const rawUrl = values.url || envUrl || (ref ? `https://${ref}.supabase.co` : '');
  if (!rawUrl) {
    fail(
      'Missing Supabase URL. Set SUPABASE_URL, pass --url, or link a project with `npx supabase link`.',
    );
  }

  const url = normalizeUrl(rawUrl);
  const key = readKey(values);
  if (needKey && !key) {
    fail(
      'Missing service-role key. Set SUPABASE_SERVICE_ROLE_KEY, pass --key, or use --key-file.\n' +
        'Get it from Supabase Dashboard → Project Settings → API → service_role.',
    );
  }
  if (key) {
    const role = jwtRole(key);
    if (role === 'anon' || role === 'authenticated') {
      fail(
        `That key has role "${role}". Use the service_role key; the public key cannot bypass RLS.`,
      );
    }
    if (role && role !== 'service_role') {
      console.warn(c('1;33', `Warning: key role is "${role}", expected "service_role".`));
    }
  }
  return { url, key };
}

function makeClient({ url, key }) {
  const base = `${url}/rest/v1`;

  return async function rest(path, init = {}) {
    const headers = {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
      ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...init.headers,
    };

    let response;
    try {
      response = await fetch(`${base}/${path}`, {
        ...init,
        headers,
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      });
    } catch (e) {
      throw new Error(`Cannot reach ${url}: ${e.message}`);
    }

    const text = await response.text();
    if (!response.ok) {
      let hint = '';
      if (response.status === 401 || response.status === 403) {
        hint =
          '\nThe service-role key was rejected. Check that you copied the secret key, not the anon key.';
      } else if (response.status === 404) {
        hint = '\nA table is missing. Run the SQL migrations in supabase/migrations first.';
      }
      throw new Error(
        `${init.method || 'GET'} /${path} failed (${response.status}):\n${text || response.statusText}${hint}`,
      );
    }
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  };
}

async function confirm(message) {
  if (!process.stdin.isTTY) {
    fail('Refusing to continue without --yes (stdin is not a terminal).');
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(`${message}\nType "yes" to continue: `);
    if (answer.trim().toLowerCase() !== 'yes') {
      console.log('Aborted.');
      process.exit(1);
    }
  } finally {
    rl.close();
  }
}

function parseKeep(value) {
  if (!value) return new Set();
  const names = value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const unknown = names.filter((name) => !TABLES[name]);
  if (unknown.length) {
    fail(`Unknown table(s) in --keep: ${unknown.join(', ')}`);
  }
  return new Set(names);
}

function tablesToClear({ all, keep }) {
  return CLEAR_ORDER.filter((table) => (all || !CONFIG_TABLES.has(table)) && !keep.has(table));
}

async function seedDefaultSettings(rest) {
  await rest('settings', {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: DEFAULT_SETTINGS,
  });
  info(`  ${'settings'.padEnd(12)} default rows ensured`);
}

async function clearDatabase(rest, { all, keep, dryRun, seed }) {
  const tables = tablesToClear({ all, keep });
  if (tables.length === 0) {
    info('Nothing to clear (every table is protected by --keep).');
    return;
  }

  info(`Tables to clear: ${tables.join(', ')}`);
  const kept = CLEAR_ORDER.filter((table) => !tables.includes(table));
  if (kept.length) {
    info(`Keeping: ${kept.join(', ')}${all ? '' : ' (use --all for a full wipe)'}`);
  }
  if (dryRun) return;

  for (const table of tables) {
    await rest(`${table}?${TABLES[table].deleteFilter}`, {
      method: 'DELETE',
      headers: { Prefer: 'return=minimal' },
    });
    info(`  ${table.padEnd(12)} cleared`);
  }

  if (seed) await seedDefaultSettings(rest);
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

async function readImportFile(file, tableOption) {
  let raw;
  try {
    raw = JSON.parse(await readFile(resolve(file), 'utf8'));
  } catch (e) {
    fail(`Cannot read or parse ${file}: ${e.message}`);
  }

  if (Array.isArray(raw)) {
    if (!tableOption) {
      fail('The JSON file is a plain array. Pass --table <name> to choose its table.');
    }
    if (!TABLES[tableOption]) fail(`Unknown table: ${tableOption}`);
    validateRows(tableOption, raw);
    return { [tableOption]: raw };
  }

  if (!isPlainObject(raw)) {
    fail('Expected a JSON object keyed by table name, or an array used with --table.');
  }
  if (tableOption) {
    fail('--table is only needed when the JSON file is a plain array.');
  }

  const entries = Object.entries(raw);
  if (entries.length === 0) fail('The JSON file contains no tables.');
  const unknown = entries.map(([table]) => table).filter((table) => !TABLES[table]);
  if (unknown.length) {
    fail(
      `Unknown table(s): ${unknown.join(', ')}\nKnown tables: ${Object.keys(TABLES).join(', ')}`,
    );
  }

  for (const [table, rows] of entries) {
    if (!Array.isArray(rows)) fail(`"${table}" must be an array of rows.`);
    validateRows(table, rows);
  }
  return raw;
}

function validateRows(table, rows) {
  rows.forEach((row, index) => {
    if (!isPlainObject(row)) {
      fail(
        `"${table}"[${index}] must be an object, got ${Array.isArray(row) ? 'array' : typeof row}.`,
      );
    }
  });
}

// PostgREST sends one INSERT for the whole array, so rows in a batch must share
// the same keys. Grouping keeps columns with defaults from becoming NULL.
function groupRowsByShape(rows) {
  const groups = new Map();
  for (const row of rows) {
    const shape = Object.keys(row).sort().join('\u0000');
    if (!groups.has(shape)) groups.set(shape, []);
    groups.get(shape).push(row);
  }
  return [...groups.values()];
}

async function importTable(rest, table, rows, { upsert, dryRun }) {
  if (rows.length === 0) {
    info(`  ${table.padEnd(12)} 0 rows (skipped)`);
    return;
  }
  if (dryRun) {
    info(`  ${table.padEnd(12)} ${rows.length} row(s)`);
    return;
  }

  // Configuration is always merged so a restore does not depend on an empty table.
  const merge = upsert || CONFIG_TABLES.has(table);
  const prefer = `${merge ? 'resolution=merge-duplicates,' : ''}return=minimal`;
  let done = 0;

  for (const group of groupRowsByShape(rows)) {
    for (let i = 0; i < group.length; i += BATCH_SIZE) {
      const batch = group.slice(i, i + BATCH_SIZE);
      await rest(table, {
        method: 'POST',
        headers: { Prefer: prefer },
        body: batch,
      });
      done += batch.length;
    }
  }

  const verb = merge ? 'merged' : 'inserted';
  info(`  ${table.padEnd(12)} ${done} row(s) ${verb}`);
}

async function importFile(rest, data, { upsert, dryRun, seed }) {
  const tables = IMPORT_ORDER.filter((table) => data[table] !== undefined);
  if (tables.length === 0) {
    info('No tables to import.');
    return;
  }

  info(`Tables to import: ${tables.join(', ')}`);
  for (const table of tables) {
    await importTable(rest, table, data[table], { upsert, dryRun });
  }

  if (seed && !dryRun) await seedDefaultSettings(rest);
}

async function main() {
  const { values, positionals } = parseCli();

  if (values.help) {
    console.log(HELP.trim());
    return;
  }
  if (positionals.length === 0) {
    console.log(HELP.trim());
    process.exitCode = 1;
    return;
  }

  const [command, ...args] = positionals;
  if (command !== 'clear' && command !== 'import') {
    fail(`Unknown command "${command}". Use "clear" or "import".`);
  }
  if (command === 'clear' && args.length > 0) {
    fail('"clear" does not take a file. Use: node scripts/db-cli.mjs clear');
  }
  if (command === 'import' && args.length !== 1) {
    fail('"import" needs exactly one JSON file. Use: node scripts/db-cli.mjs import data.json');
  }
  if (command === 'clear' && (values.replace || values.upsert || values.table)) {
    fail('--replace, --upsert and --table only apply to "import".');
  }
  if (command === 'import' && values.all && !values.replace) {
    fail('--all only applies together with --replace.');
  }

  const dryRun = values['dry-run'] === true;
  const keep = parseKeep(values.keep);
  const config = resolveConfig(values, !dryRun);
  const rest = makeClient(config);

  const target = new URL(config.url).host;
  info(c('1', `\nRehlet Alketab database CLI`));
  info(c('2', `Target: ${config.url}`) + (dryRun ? c('1;33', '  (dry run)') : ''));

  if (command === 'clear') {
    info('');
    if (!dryRun && !values.yes) {
      const tables = tablesToClear({ all: values.all === true, keep });
      await confirm(
        c('1;31', `This will DELETE all rows from: ${tables.join(', ')}`) + `\nProject: ${target}`,
      );
    }
    await clearDatabase(rest, {
      all: values.all === true,
      keep,
      dryRun,
      seed: values['no-defaults'] !== true,
    });
    info(c('1;32', dryRun ? '\nDry run finished.' : '\nClear finished.'));
    return;
  }

  const data = await readImportFile(args[0], values.table);
  const replace = values.replace === true;

  info('');
  if (replace && !dryRun && !values.yes) {
    const tables = tablesToClear({ all: values.all === true, keep });
    await confirm(
      c('1;31', `--replace will DELETE all rows from: ${tables.join(', ')}`) +
        `\nProject: ${target}`,
    );
  }

  if (replace) {
    await clearDatabase(rest, {
      all: values.all === true,
      keep,
      dryRun,
      seed: false,
    });
    info('');
  }

  await importFile(rest, data, {
    upsert: values.upsert === true,
    dryRun,
    seed: values['no-defaults'] !== true,
  });
  info(c('1;32', dryRun ? '\nDry run finished.' : '\nImport finished.'));
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
