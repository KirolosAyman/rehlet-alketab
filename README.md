# رحلة الكتاب — Rehlet Alketab

A daily Bible-reading quiz platform for a Sunday-school class: Arabic RTL, mobile-first, and free-tier only.

- Spec: [docs/PROJECT.md](docs/PROJECT.md) · Decisions: [docs/DECISIONS.md](docs/DECISIONS.md)
- **What is already built + the roadmap:** [docs/MASTER_PLAN.md](docs/MASTER_PLAN.md)
- **Setup guide (Arabic, step by step):** [docs/SETUP.md](docs/SETUP.md)
- What was verified and what still needs a real run: [docs/VERIFICATION.md](docs/VERIFICATION.md)

## Run it (VS Code, no debugging)
1. Open the folder in VS Code → **Run and Debug** panel.
2. First time only: pick **📦 Install web packages** → `Ctrl+F5`.
3. Pick **🌐 Web: dev server** → `Ctrl+F5`. The logo prints and the browser opens.
4. Pick **✅ Run all checks** → `Ctrl+F5`. You get a lint, types, tests and build summary.

Terminal equivalents (from `web/`): `npm install` (once), `npm run dev`, `npm run check`.

Requires **Node 22.6+**. Create `web/.env` from `.env.example` with your `VITE_API_URL`.

## Database CLI (clear / import JSON)
`scripts/db-cli.mjs` uses the Supabase REST API with the **service_role** key. Keep that key out of the repo; pass it through the environment or a key file.

```bash
# Dashboard → Project Settings → API → service_role (never commit it)
export SUPABASE_SERVICE_ROLE_KEY=...

node scripts/db-cli.mjs --help

# Delete app data (keeps settings + app_secrets)
node scripts/db-cli.mjs clear

# Full wipe, including settings + app_secrets
node scripts/db-cli.mjs clear --all --yes

# Import; --replace clears first (asks for confirmation unless --yes)
node scripts/db-cli.mjs import backup.json --replace --yes
```

The URL comes from `SUPABASE_URL`, `--url`, or the linked project in `supabase/.temp/project-ref`. Use `--dry-run` to see the plan without writing, and `--yes` in non-interactive shells.

The JSON format is one array per table, keyed by table name:

```json
{
  "students": [
    {
      "id": "00000000-0000-0000-0000-000000000001",
      "username": "مينا",
      "username_norm": "مينا",
      "display_name": "مينا"
    }
  ],
  "quizzes": [
    {
      "id": "10000000-0000-0000-0000-000000000001",
      "quiz_date": "2026-11-20",
      "book": "صموئيل الثاني",
      "chapter": "1",
      "status": "draft",
      "questions": []
    }
  ]
}
```

Rows are imported parents-first, and `settings`/`app_secrets` are merged on their primary key. A plain array also works with `--table <name>`. Missing columns use database defaults; keep primary keys when other rows reference them. Use `--upsert` to merge data rows on their primary key instead of failing on duplicates.

⚠️ `clear` deletes rows from whichever project the URL points to. Run `--dry-run` first and keep a backup.

## Layout
```
web/                         React + TS + Vite SPA
  src/app                    router, providers, guards
  src/features/{auth,quiz,assignments,admin}
  src/components             Button, Card, Pill, StarIcon, ProgressBar, QuestionEditor, ...
  src/lib                    api client, session tokens, Arabic formatting, types
  src/i18n/ar.ts             every UI string
supabase/
  migrations/                SQL (idempotent, RLS deny-all)
  functions/api/index.ts     CORS + router
  functions/api/handlers/    auth, student, admin, assignments
  functions/api/lib/         crypto, time, scoring, questions, quizState, stats, ai/ (+ *_test.ts)
scripts/                     terminal logo, check runner, Node test runner, db clear/import CLI
```
