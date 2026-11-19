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
scripts/                     terminal logo, check runner, Node test runner
```
