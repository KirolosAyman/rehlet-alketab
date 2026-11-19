# Master Plan — Rehlet Alketab

> **Snapshot date:** 2026-11-19
> **What this document is:** a code-level inventory of what is already built, the rules the system already enforces, the remaining risks, and the recommended sequence to launch and grow the project.
> **What this document is not:** the product specification. `docs/PROJECT.md` is still a placeholder and should become the single source of truth (see Phase 0).

## 0. Status at a glance

| Item | Status |
|---|---|
| End-to-end MVP | **Built** — student app + admin app + Edge Function + database + AI |
| Database schema | **Built** — 9 tables, 3 idempotent migrations, forced RLS |
| API | **Built** — 1 POST endpoint, 32 route actions, 31 handlers |
| Frontend | **Built** — React + TypeScript + Vite, 14 page/screen components |
| Automated tests | **Built (partial)** — 56 API unit tests / 7 files; 7 web tests / 1 file |
| Security model | **Built** — service-role-only DB, hashed tokens/passwords, throttling, no answer leakage |
| CI | **Built** — GitHub Actions jobs for web and Edge Function |
| Live deployment proof | **Not verified** — checklist in `docs/VERIFICATION.md` is still unticked |
| Product spec in repo | **Missing** — `docs/PROJECT.md` is a placeholder |
| E2E tests | **Not started** |

**Verdict:** this is a complete MVP, not a skeleton. The biggest remaining gap is not missing features; it is **proof that the whole system works against the real Supabase + Gemini + hosting environment**, plus a small amount of production hardening.

**Milestone note:** `docs/DECISIONS.md` references milestones `M0`–`M16`, but the repository has no milestone checklist and `docs/PROJECT.md` (where the milestones would normally live) is empty. The feature inventory in section 4 is therefore the effective “what is built” tracker until the spec is restored.

---

## 1. Product scope

A daily Bible-reading quiz platform for a closed Sunday-school class.

- **Audience:** roughly 100 students, one teacher/admin.
- **Student loop:** log in → read today's chapter → take the day's quiz once → see score, stars, review, level and streak.
- **Admin loop:** create a quiz (manually or AI-assisted) → review/publish → watch results → grade pending essays → unlock missed quizzes when needed.
- **Assignment loop:** the admin assigns a student to write questions → the student writes them without AI → the admin reviews and converts them into a draft quiz.
- **Constraints built into the design:** Arabic RTL, mobile-first, free-tier hosting, Cairo time zone, no student access to AI, one attempt per student per quiz.

---

## 2. Architecture

```
┌──────────────────────────────┐
│  Browser SPA (React + Vite)  │
│  Arabic RTL, mobile-first    │
│  localStorage: session token │
└──────────────┬───────────────┘
               │ HTTPS POST { action, token, ...payload }
               ▼
┌──────────────────────────────┐
│ Supabase Edge Function       │
│ Deno · single endpoint /api  │
│ CORS · JSON · 200 KB cap     │
│ router → handlers → lib      │
└───────┬──────────────┬───────┘
        │ service role │ API key
        ▼              ▼
┌───────────────┐  ┌────────────────────┐
│ Supabase      │  │ Google Gemini API  │
│ PostgreSQL    │  │ generation + essay │
│ 9 tables      │  │ grading            │
│ RLS forced    │  └────────────────────┘
│ no client     │
│ policies      │
└───────────────┘
```

**Deployment target**

- Frontend: Cloudflare Pages or Netlify, static SPA in `web/dist`.
- Backend: Supabase Edge Function `api`, deployed with `--no-verify-jwt`.
- Database: Supabase Postgres, migrations run in the SQL Editor (or via CLI).
- AI: Gemini key configured from the admin Settings page; environment variables are only a fallback.

**Request lifecycle**

1. The browser posts `{ action, token, ...payload }` to one endpoint.
2. The router validates the action, CORS, method and body size.
3. Any `admin_*` action (except `admin_login`) is checked against an admin session **before** the handler runs.
4. The handler re-checks authorisation, loads data through the service-role client, validates input, and returns JSON.
5. Errors become `{ ok: false, error, message }` with an Arabic message; the frontend shows it directly.

**Design boundary:** the browser never talks to Postgres directly. The client holds only the API URL and the user's opaque session token.

---

## 3. Repository map

| Path | Purpose |
|---|---|
| `README.md` | Run instructions and layout |
| `docs/PROJECT.md` | **Placeholder** — approved spec must be pasted here |
| `docs/DECISIONS.md` | Append-only decisions log (D-001 … D-013) |
| `docs/SETUP.md` | Arabic step-by-step setup/deployment guide |
| `docs/VERIFICATION.md` | What was verified, what still needs a real run |
| `web/` | React + TypeScript + Vite SPA |
| `web/src/app/` | Router, providers, guards |
| `web/src/features/auth/` | Student login/setup, admin login |
| `web/src/features/quiz/` | Home, play, result, header card |
| `web/src/features/assignments/` | Student question writer |
| `web/src/features/admin/` | Admin dashboard and all admin pages |
| `web/src/components/` | 12 shared UI components |
| `web/src/lib/` | API client, types, session store, formatting |
| `web/src/i18n/ar.ts` | Every UI string |
| `supabase/migrations/` | 3 SQL migrations |
| `supabase/functions/api/` | Deno Edge Function |
| `supabase/functions/api/handlers/` | `auth`, `student`, `admin`, `assignments` |
| `supabase/functions/api/lib/` | Pure logic, DB helpers, security, AI |
| `supabase/seed.sql` | Local demo data — **never run in production** |
| `supabase/tests/m1_verify.sql` | RLS/privilege acceptance query |
| `scripts/` | Terminal banner, check runner, Node test runner |
| `.vscode/` | Run/debug configs for dev, checks, deploy |
| `.github/workflows/ci.yml` | CI for web and Edge Function |

---

## 4. What is already built

### 4.1 Foundation and tooling — **Built**

- React 18, TypeScript 5.6 strict mode, Vite 5, React Router 6, TanStack Query 5.
- Tailwind CSS with CSS-variable colour tokens, automatic light/dark mode, RTL logical utilities.
- Arabic font stack: Cairo for UI, Noto Naskh Arabic for scripture.
- ESLint with TypeScript, React hooks and React refresh rules, plus explicit bans on `dangerouslySetInnerHTML`, `alert`, `confirm` and `prompt`.
- Prettier and EditorConfig.
- Vitest for web tests.
- Custom Node runner for the Edge Function tests, so Deno is not required locally.
- VS Code tasks/configs for install, dev server, all checks, API tests and deploy.
- GitHub Actions: web (install → lint → typecheck → test → API test → build) and Edge Function (`deno check` + `deno test`).
- Build copies `index.html` to `404.html` for GitHub Pages; `_redirects` supports Cloudflare Pages / Netlify.

### 4.2 Authentication and accounts — **Built**

- Admin adds students in bulk: one line per student, username + optional display name, accepts `,`, `،` or tab as separators.
- Usernames are normalized (Arabic spelling variants, whitespace) before uniqueness checks.
- First login: the student chooses their own password; the server refuses if a password already exists.
- Login, logout, and a separate admin login with a server-side secret.
- Password storage: PBKDF2-SHA256, 100,000 iterations, random salt, versioned `pbkdf2$iter$salt$hash` format.
- Account lockout: 5 wrong passwords → 10 minutes.
- Admin lockout: 5 wrong admin passwords → 10 minutes.
- Sessions: random token to the client; only its SHA-256 hash stored. Admin sessions expire after 7 days.
- Admin can rename a student, reset a password (and delete all their sessions), or delete the student (cascades attempts, unlocks and assignments).
- Input validation and Arabic error messages on every field.

**Evidence:** `handlers/auth.ts`, `lib/crypto.ts`, `lib/normalize.ts`, `lib/session.ts`, `lib/ratelimit.ts`, `features/auth/LoginPage.tsx`, `features/auth/AdminLoginPage.tsx`.

### 4.3 Student home — **Built**

Three tabs: **النهارده / سجلي / الترتيب**.

- Today's quiz card with state-aware action: start, waiting with opening time, authored-by-you, or already done with review link.
- Assignments that are due today or overdue-but-open, with a write link or “sent” pill.
- Unlocked past quizzes in a separate card.
- Missed quizzes list with a hint to ask the admin.
- Record tab: all completed quizzes with score and stars.
- Leaderboard tab: hidden by default; when enabled it shows rank, name, streak and stars, with the current student highlighted.
- Header card: name, total stars, level, progress bar and stars to the next level.
- Empty states for every tab.
- Server computes all stats; the frontend never re-implements scoring, level or streak rules.

**Evidence:** `handlers/student.ts → home`, `lib/stats.ts`, `features/quiz/HomePage.tsx`, `HeaderCard.tsx`.

### 4.4 Quiz play — **Built**

- One question at a time with previous/next navigation.
- Question navigator dots: current, answered, unanswered.
- Four question types: multiple choice, true/false, fill-in-the-blank, essay.
- True/false options are forced to `['صح', 'خطأ']`.
- Essay answers limited to 3,000 characters.
- Answers persist in `sessionStorage`, so a refresh does not lose work.
- Submit is disabled until every question has an answer; the server validates again.
- Questions are returned to students through `toPublic()`, which removes the answer, model answer and grading mode.
- One attempt per student per quiz is enforced by a database unique constraint and a friendly Arabic error.
- State machine: `done` → `hidden` → `author` → `waiting` → `open` → `missed`, in that priority order.
- Opening time uses `Africa/Cairo`, including daylight-saving transitions.
- The quiz author cannot take their own quiz.
- Missed quizzes require an admin unlock.

**Evidence:** `lib/quizState.ts`, `lib/questions.ts`, `lib/time.ts`, `handlers/student.ts → getQuiz/submit`, `features/quiz/PlayPage.tsx`.

### 4.5 Scoring, levels and streak — **Built**

- Each correct answer = 1 star.
- A perfect score adds a **+2 star bonus** (`PERFECT_BONUS`).
- 0 questions → 0 stars, no bonus.
- Pending essays do not count until resolved.
- Levels: بذرة 0, نبتة 10, غصن 25, شجرة 50, كرمة 100.
- Level progress is returned by the server as a 0–1 value plus stars left.
- Streak counts consecutive **published quizzes** (not calendar days) that the student completed or authored, newest first.
- Today's untaken quiz does not break the streak; an earlier missed one does.
- Future quizzes are ignored.
- Leaderboard ranking: competition ranking (1, 1, 3) by stars, then streak, then Arabic name.
- Attempts store a **snapshot** of the questions at submit time; grading, review and admin re-grading read the snapshot, never the live quiz.
- When an admin changes an essay verdict, stars are recomputed from the snapshot.

**Evidence:** `lib/scoring.ts`, `lib/stats.ts`, `handlers/admin.ts → saveAttemptGrades`, `DECISIONS.md` D-001/D-006/D-010.

### 4.6 Result and review — **Built**

- Score `correct / total`, star count, perfect bonus message and an encouraging message based on percentage.
- Animated star reveal, with a reduced-motion fallback.
- Level pills and next-level progress.
- Show/hide answers.
- Review per question:
  - choice questions: correct option highlighted, wrong selected option marked;
  - essays: student answer, model answer, AI/admin verdict and note;
  - pending essays show “في انتظار مراجعة الخادم”.
- Review data is only returned after submission.

**Evidence:** `lib/review.ts`, `features/quiz/ResultView.tsx`.

### 4.7 Assignments (student-authored questions) — **Built**

- Admin creates an assignment: student, book, chapter, writing day.
- The student sees it from the assigned day onward.
- Student editor reuses the same question editor, but with **no grading toggle** and **no AI**.
- Students can save drafts or submit; after submission it locks.
- Admin can reopen a submitted assignment for editing, delete it, or convert it to a quiz.
- Conversion:
  - validates the questions with the same server validator;
  - creates a **draft** quiz (never published automatically);
  - defaults the quiz date to the assignment day + 1, but the admin can override;
  - is idempotent: a second click returns the same quiz;
  - excludes the author from taking the quiz;
  - counts the authored quiz toward the author's streak.
- Student-written essays default to AI grading; the admin can change the mode later.

**Evidence:** `handlers/assignments.ts`, `features/assignments/WriterPage.tsx`, `features/admin/AssignmentsPage.tsx`, `DECISIONS.md` D-010/D-013.

### 4.8 Admin dashboard — **Built**

- Counts: students, finished today, assignments waiting review, pending essays.
- Student table: name, username, activation, lock status, stars, streak, quizzes done, today's score, level.
- Leaderboard visibility switch.
- Full student management: bulk add, rename, reset password, delete.
- Every admin mutation refreshes the relevant React Query caches.

**Evidence:** `handlers/admin.ts → dashboard`, `features/admin/DashboardPage.tsx`, `StudentsPage.tsx`.

### 4.9 Quiz management and editor — **Built**

- Quiz list with status, date, opening time, author, question count, attempts, average, unlock count and pending essays.
- Create/edit quiz: date, optional opening time, book, chapter, questions, draft/published status.
- Question editor supports all four types, option add/remove, correct-answer radio, fill-in blank insertion, essay model answer and per-question AI/manual grading.
- “All essays: AI / manual” shortcut.
- Publish validation:
  - cannot publish with zero questions;
  - published quizzes per day are limited by `settings.max_published_per_day` (default 1, UI 1–5);
  - drafts are unlimited;
  - moving a quiz back to draft frees the slot;
  - the server checks the limit and returns an Arabic message naming the conflicting quiz.
- Editing a published quiz is allowed; existing attempts keep their snapshot.
- Delete quiz with in-page confirmation.
- Unlock page: select students who may take a past quiz; author is disabled.

**Evidence:** `handlers/admin.ts → quizSave/quizDelete/quizGet/unlocksSet`, `features/admin/QuizzesPage.tsx`, `QuizEditorPage.tsx`, `UnlockPage.tsx`, `components/QuestionEditor.tsx`, `DECISIONS.md` D-012.

### 4.10 AI generation and essay grading — **Built**

**Generation (admin only):**

- Choose counts of MCQ / true-false / fill questions (0–15 each), optional notes and optional pasted chapter text.
- Strict prompt: factual only, no doctrine or interpretation, one clear answer, spread across the chapter.
- If chapter text is provided, it is the only permitted source.
- Gemini is asked for structured JSON using a response schema.
- Output is validated by the **same** question validator used for manual input; invalid items are dropped.
- Option order is shuffled while keeping the correct answer.
- Output is appended as drafts; nothing is auto-published.
- Timeout: 45 seconds; throttled to 20 generations per hour per hashed IP.

**Essay grading:**

- All AI-eligible essays for one attempt go into **one batched Gemini call**.
- Timeout: 8 seconds.
- On failure, timeout, missing key or quota exhaustion, every essay is stored as `pending`; submission still succeeds.
- Manual essays never go to the AI.
- Admin verdicts are never overwritten by re-grading.
- Prompt injection defence: student answers are passed as JSON data and the model is told to ignore instructions inside them.
- Admin can set/override any essay verdict; stars are recomputed.
- “Re-grade pending” re-sends only pending, AI-graded essays for one quiz, one batched call per attempt.
- AI key is stored in `app_secrets`, returned only masked (`••••••xxxx`), and sent to Gemini in a request header.
- Model name and key can be changed from Settings without redeploying.
- “Test connection” action verifies the key/model.

**Evidence:** `lib/ai/*`, `handlers/admin.ts → generate/regradePending/attemptSet/aiSettings*`, `features/admin/AiPanel.tsx`, `QuizResultsPage.tsx`, `SettingsPage.tsx`, `DECISIONS.md` D-003/D-010.

### 4.11 Settings — **Built**

- Gemini API key: set, replace, clear; current key is shown only as a masked hint and its source (`settings` or server secret).
- Model name: blank means use the default (`gemini-2.5-flash`, or `GEMINI_MODEL`).
- “Test connection” button.
- Maximum published quizzes per day (1–5).
- All changes take effect without redeploying.

**Evidence:** `handlers/admin.ts → aiSettingsGet/aiSettingsSet/aiTest/settingsSet`, `features/admin/SettingsPage.tsx`.

### 4.12 Design, RTL and accessibility — **Built**

- `<html lang="ar" dir="rtl">`.
- Mobile-first layout, safe-area padding, touch targets of at least 44 px.
- Light/dark tokens driven by `prefers-color-scheme`.
- Reduced-motion support.
- Semantic roles for tabs, radiogroups, alerts, status messages and switches.
- Visible focus ring.
- No browser alerts/confirms; two-step in-page confirmation.
- Arabic-Indic digits and `ar-EG` dates.
- Warm Egyptian-friendly student wording; direct admin wording.
- All strings live in `web/src/i18n/ar.ts`.

**Evidence:** `web/index.html`, `web/src/index.css`, `components/*`, `i18n/ar.ts`.

### 4.13 Security — **Built**

| Control | Where |
|---|---|
| RLS enabled and **forced** on every table; no policies; `anon`/`authenticated` privileges revoked | `migrations/…_init.sql` |
| Service-role key only on the server | `lib/db.ts` |
| Admin secret from environment, constant-time compare, lockout | `handlers/auth.ts`, `lib/crypto.ts` |
| Every admin action checked in the router **and** in the handler | `index.ts`, `handlers/admin.ts` |
| No answer/model/grading before submission | `lib/questions.ts → toPublic` |
| Parameterized queries only | supabase-js everywhere |
| Body size cap (200 KB), input validation and length limits | `index.ts`, `lib/input.ts`, `lib/questions.ts` |
| CORS allowlist via `ALLOWED_ORIGIN` | `index.ts` |
| Throttling: login, set password, check username, admin login, AI generation | `lib/ratelimit.ts`, migration 3 |
| Passwords PBKDF2, versioned iteration count | `lib/crypto.ts` |
| Session tokens hashed at rest | `lib/session.ts` |
| Sessions deleted on password reset and student delete | `handlers/admin.ts` |
| No student-facing AI | Only admin actions call Gemini; `submit` only grades against the teacher's model answer |
| AI key never returned or logged | `lib/aiConfig.ts`, `lib/ai/config.ts` |
| ESLint bans dangerous HTML and browser dialogs | `web/eslint.config.js` |

### 4.14 Operations and documentation — **Built**

- CI for web checks and Edge Function checks.
- `npm run check` gives a single lint/typecheck/test/build summary.
- Arabic setup guide with Supabase, secrets, deployment, daily routine and troubleshooting.
- Decisions log for all non-obvious choices.
- Verification report that separates “actually run” from “must run by owner”.
- Seed data for local/dev checks.
- RLS acceptance SQL.
- Terminal banner and VS Code launch configurations.

### 4.15 Explicitly not built (yet)

These are **not** in the codebase today; they are roadmap items, not hidden or partially built features:

- Browser/E2E tests.
- Automated handler, router and database tests.
- Reminders or notifications.
- CSV/print export of results.
- PWA/offline support.
- Multiple admin accounts, roles or an audit log.
- Self-service password change for students.
- Question bank, quiz duplication or CSV student import.
- Pagination/search/archiving for large datasets.
- Monitoring, alerting and automated backup/restore.
- CSP/security headers.
- Student session expiry and session cleanup.
- Per-student admin history screens.
- Background AI re-grading queue.

---

## 5. Database model

| Table | Purpose | Key rules |
|---|---|---|
| `students` | Accounts | `username_norm` unique; `pass_hash` NULL = not activated; lock fields |
| `sessions` | Auth sessions | Stores SHA-256 token hash only; admin has expiry; student session has no expiry |
| `quizzes` | Quiz definitions | `status` draft/published; `author_id` for student-authored quizzes; questions JSONB |
| `quiz_unlocks` | Per-student access to past quizzes | Composite PK `(quiz_id, student_id)` |
| `attempts` | Student submissions | `unique(student_id, quiz_id)`; stores answers + questions snapshot + essay verdicts + score |
| `assignments` | Student writing tasks | `status` open/submitted; optional `quiz_id` link |
| `settings` | Runtime settings | `leaderboard_public`, `ai_model`, `max_published_per_day`, `admin_lock` |
| `app_secrets` | Write-only secret storage | Gemini API key; never returned |
| `rate_limits` | Fixed-window counters | `(key, window_start)` PK; atomic `rate_limit_hit()` |

**Important invariants already encoded**

1. One attempt per student per quiz.
2. Submitted attempts are immutable except for essay verdicts and recomputed stars.
3. Grading always uses the attempt snapshot, never the live quiz.
4. Only published quizzes appear to students.
5. A quiz author cannot take their own quiz but keeps their streak.
6. A student can only take a past quiz if explicitly unlocked.
7. Published quizzes per date are limited by a setting, checked at publish time.
8. Every table is inaccessible to client roles; only the Edge Function can read/write.
9. All day/opening logic uses `Africa/Cairo`.
10. The admin's AI key is never returned in plaintext.

---

## 6. API surface

All actions are `POST` to one endpoint. The body is `{ action, token?, ...payload }`.

### Public

| Action | Purpose |
|---|---|
| `check_username` | Does the username exist, and does it need setup or login? |
| `set_password` | First-login password setup (race-safe) |
| `login` | Student login with lockout |
| `admin_login` | Admin password login |
| `logout` | Delete the current session |

### Student (requires student session)

| Action | Purpose |
|---|---|
| `home` | Stats, quizzes, assignments, leaderboard |
| `get_quiz` | Open quiz questions or completed review |
| `submit` | Validate answers, grade essays, store attempt |
| `assign_save` | Save/submit student-authored questions |

### Admin (requires admin session)

| Action | Purpose |
|---|---|
| `admin_logout` | Delete admin session |
| `admin_dashboard` | Students, quizzes, assignments, counts, settings |
| `admin_students_add` | Bulk add students |
| `admin_student_update` | Rename username/display name |
| `admin_student_reset` | Clear password and sessions |
| `admin_student_delete` | Delete student and cascaded data |
| `admin_quiz_get` | Full quiz, attempts, students, non-takers, unlocks |
| `admin_quiz_save` | Create/update, publish/draft, enforce daily limit |
| `admin_quiz_delete` | Delete quiz |
| `admin_quiz_unlocks_get` | Read unlocks (currently not used by the UI) |
| `admin_quiz_unlocks_set` | Replace unlock list |
| `admin_assign_create` | Create assignment |
| `admin_assign_delete` | Delete assignment |
| `admin_assign_reopen` | Reopen submitted assignment |
| `admin_assign_to_quiz` | Convert assignment to draft quiz |
| `admin_attempt_set` | Set/override an essay verdict |
| `admin_regrade_pending` | Re-run AI grading for pending essays in a quiz |
| `admin_generate` | Generate draft questions with Gemini |
| `admin_set_leaderboard` | Toggle leaderboard visibility |
| `admin_settings_set` | Set max published quizzes per day |
| `admin_ai_settings_get` | Read model + masked key + source |
| `admin_ai_settings_set` | Update model/key/clear key |
| `admin_ai_test` | Test Gemini connectivity |

---

## 7. Test and verification status

### Automated tests present

| Suite | Count | Scope |
|---|---|---|
| Edge Function unit tests | **56 tests / 7 files** | Scoring, levels, streak, quiz state, validator, PBKDF2/tokens, AI grading, generation post-processing, Gemini error mapping, config/masking |
| Web tests | **7 tests / 1 file** | Arabic digits, time formatting, percent, date arithmetic, question-editor helpers |

`scripts/run-api-tests.mjs` shims `Deno.test`, so the same API tests run under Node 22.6+ without installing Deno.

### Verification recorded in the repo

`docs/VERIFICATION.md` states that, in the original build environment:

- all 56 API tests passed;
- the Edge Function type-checked with strict settings;
- the frontend type-checked against stubs;
- Arabic formatting and the banner were checked by hand.

The same report lists what was **not** verified:

- real `npm install`, ESLint, real `tsc`, Vitest, `vite build`;
- `deno check` / `deno test` against real supabase-js types;
- migrations against real Postgres;
- all 11 live integration scenarios (student onboarding, reset, lockout, no-answer leakage, duplicate submit, unlock, author exclusion, prompt injection, missing Gemini key, settings change, leaderboard toggle).

### Verification in this review

- Repository was read statically; no Node or Deno runtime is installed in the review environment, so checks were **not re-run** here.
- Test count was verified statically: 56 `test(...)` calls across 7 API test files, 7 `it(...)` calls in the web test file.
- No `TODO`, `FIXME` or unimplemented markers were found in application source.

### Coverage gaps

- No tests for route handlers or the router (auth checks, status codes, request shapes).
- No tests for `review.ts`, `time.ts`, `input.ts`, `session.ts` or `db.ts`.
- No database-level tests (constraints, cascade behaviour, RLS).
- No E2E/browser tests.
- No accessibility automation.
- No load/scale test at the stated ~100-student target.

---

## 8. Gaps, risks and review findings

### 8.1 Launch blockers (P0)

| # | Finding | Why it matters | Recommendation |
|---|---|---|---|
| P0-1 | `docs/PROJECT.md` is a placeholder | The team cannot verify that the implementation matches the approved spec; future changes lack a baseline | Paste the approved spec unchanged as the first real commit, then link it from README and this plan |
| P0-2 | Live integration checklist is unticked | Unit tests do not prove Supabase RLS, real Gemini calls, CORS, hosting or auth work together | Run all 11 scenarios in `docs/VERIFICATION.md` against a real project and record results |
| P0-3 | No deployment evidence | The repo contains a built `dist/`, but no recorded deployment or smoke-test log | Follow `docs/SETUP.md` end-to-end; keep a short deployment log with URL, date and checks |
| P0-4 | No E2E test for the critical path | Regressions in login → quiz → submit → review → admin grading would only be found manually | Add one Playwright/Cypress smoke path before the first real class week |
| P0-5 | No backup/restore drill | A free-tier project can pause or be misconfigured; losing attempts/stars is unacceptable | Confirm Supabase backups, document restore steps, export attempts before each term |

### 8.2 Hardening (P1)

| # | Finding | Impact | Recommendation |
|---|---|---|---|
| P1-1 | Global admin lockout (`settings.admin_lock`) | Any attacker can lock the only admin out for 10 minutes by submitting wrong passwords | Make the lock per IP + global, or add a longer backoff instead of a hard global lock |
| P1-2 | Student sessions never expire and are never cleaned up | A leaked token remains valid forever; stale rows accumulate | Add a TTL (e.g. 90 days), a cleanup job, and “log out all devices” on reset |
| P1-3 | Tokens in `localStorage`; no CSP/security headers | XSS would expose tokens; static hosting config has no header file | Add CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`; consider httpOnly cookies if the architecture allows |
| P1-4 | Google Fonts loaded from a third party | Privacy dependency, offline failure, possible layout shift | Self-host Cairo and Noto Naskh, or accept and document the dependency |
| P1-5 | Admin dashboard loads all students/quizzes/attempts in one call | Fine at ~100 students, but grows unbounded | Add pagination or year/term filters before data grows; keep the one-call shape until then |
| P1-6 | No error boundary or unsaved-changes guard | A render error blanks the app; leaving the quiz editor loses work | Add a top-level error boundary and a `beforeunload`/route guard for dirty editors |
| P1-7 | Rate limiting fails open on DB errors; IP comes from `x-forwarded-for` | A DB hiccup disables throttling; a spoofed header can bypass per-IP limits | Log/monitor fail-open events; trust only the platform-provided client IP |
| P1-8 | `admin_quiz_unlocks_set` inserts IDs without pre-validation | An invalid student ID becomes a generic 500 instead of a friendly error | Filter/validate IDs or map FK error `23503` to a 404 |
| P1-9 | `admin_assign_delete` leaves a converted quiz in place | The admin may expect deleting the assignment to delete the generated quiz | Document the behaviour or add an explicit “also delete quiz” option |
| P1-10 | `admin_quiz_unlocks_get` is unused; `scripts/ensure-deps.mjs` is unused | Dead surface area and confusion | Remove or wire them into the UI/tooling |
| P1-11 | CI uses `npm install` even though `package-lock.json` exists | Non-reproducible installs | Switch to `npm ci` and enable npm cache |
| P1-12 | No audit log for admin actions | Hard to investigate a mistaken delete/reset/grade | Append admin action + target + timestamp to a small log table |
| P1-13 | No structured logging/metrics/alerting | Failures are only visible in Supabase logs | Add request IDs, error counters and a simple uptime check |

### 8.3 Product enhancements (P2)

| # | Opportunity | Value |
|---|---|---|
| P2-1 | Reminders for today's quiz / missing submissions | Improves participation without manual messages |
| P2-2 | CSV/print export of results | Useful for reports and parent communication |
| P2-3 | Question bank / duplicate quiz | Saves admin time across terms |
| P2-4 | CSV student import | Faster onboarding than pasted lines |
| P2-5 | Self-service password change | Reduces admin resets |
| P2-6 | PWA / offline reading | Better mobile experience on weak connections |
| P2-7 | Multiple admin accounts with roles | Avoids sharing one password |
| P2-8 | Per-student history screen for the admin | Faster support conversations |
| P2-9 | AI retry queue / background grading | Removes the need to press “re-grade pending” manually |
| P2-10 | Achievement badges and term-end summary | Increases engagement |

---

## 9. Roadmap

### Phase 0 — Launch readiness (must happen before real use)

**Goal:** prove the built MVP works in the real environment and close the documentation gap.

- [ ] **0.1 Restore the spec.** Paste the approved specification into `docs/PROJECT.md`; add a link in `README.md` and this plan.
- [ ] **0.2 Provision Supabase.** Create the project, run the three migrations in order, run `supabase/tests/m1_verify.sql`, confirm every table has RLS forced and zero policies.
- [ ] **0.3 Set secrets.** `ADMIN_PASSWORD`, `ALLOWED_ORIGIN`, optional Gemini fallbacks. Never commit them.
- [ ] **0.4 Deploy the Edge Function.** Confirm `verify_jwt = false` and the expected URL.
- [ ] **0.5 Configure the frontend.** Set `VITE_API_URL`, build, deploy to Cloudflare Pages or Netlify, update `ALLOWED_ORIGIN` with the final origin.
- [ ] **0.6 Run all checks.** `cd web && npm install && npm run check`; plus `deno task check` / `deno task test` if Deno is available.
- [ ] **0.7 Run the 11-item integration checklist.** Record pass/fail for each item in `docs/VERIFICATION.md`.
- [ ] **0.8 Smoke test on a real phone.** Login, quiz, submit, review, admin grading, leaderboard.
- [ ] **0.9 Backup drill.** Confirm how to restore the project and export attempts.
- [ ] **0.10 Write a short launch runbook.** URLs, secrets location, restore steps, who to contact.

**Definition of done:** a real student can complete the full loop on a real phone, and the admin can create, publish, grade and unlock without touching the database.

**Estimated effort:** 1–2 focused days, mostly setup and manual verification.

### Phase 1 — Reliability and hardening (first 2–4 weeks after launch)

**Goal:** make failures visible and reduce operational surprises.

- [ ] **1.1 Handler-level API tests.** Cover router auth, status codes, ownership checks, duplicate submit and unlock rules with a fake DB or Supabase local.
- [ ] **1.2 E2E smoke path.** One browser test for student loop and one for admin publish/grade.
- [ ] **1.3 Security headers and CSP.** Add a headers file for the static host; self-host fonts if privacy matters.
- [ ] **1.4 Session lifecycle.** Add student session TTL/cleanup and a “log out all devices” path.
- [ ] **1.5 Admin lockout review.** Per-IP lockout plus a safer global backoff.
- [ ] **1.6 UX guards.** Error boundary; unsaved-changes warning in the quiz editor and writer; friendlier FK errors.
- [ ] **1.7 Observability.** Request IDs, error counters, uptime check, a documented place to look when something breaks.
- [ ] **1.8 Audit log.** Record admin deletes, resets, publishes and essay overrides.
- [ ] **1.9 CI cleanup.** `npm ci`, cache, and a migration check job if feasible.

**Definition of done:** critical regressions are caught automatically, and the owner can diagnose a failure from logs without reading code.

### Phase 2 — Product growth (after the first stable term)

- [ ] Reminders/notifications for the daily quiz.
- [ ] Export/print results.
- [ ] Question bank and quiz duplication.
- [ ] CSV import for students.
- [ ] Self-service password change.
- [ ] PWA/offline reading.
- [ ] Per-student admin history.
- [ ] Background essay re-grading queue.

### Phase 3 — Scale and multi-admin (only if needed)

- [ ] Pagination/search for large datasets.
- [ ] Multiple admin accounts and roles.
- [ ] Precomputed stats/materialized views if the dashboard slows down.
- [ ] Partition or archive old attempts by term/year.
- [ ] Formal backup/retention policy.

---

## 10. Open decisions for the owner

These are not bugs; they are choices the implementation has already made that should be confirmed before launch.

1. **Password policy:** the minimum is 4 characters. Is that acceptable for the class, or should it be 6–8?
2. **Student session lifetime:** currently unlimited. Should it expire after a term or a number of days?
3. **Admin access:** one shared password. Is a second admin account or 2FA needed?
4. **Default essay grading:** student-written essays default to AI. Should they default to manual instead?
5. **Multiple quizzes per day:** the setting exists but the default is 1. Should it stay 1 for now?
6. **Deleting a converted assignment:** should it also delete the generated quiz?
7. **Published quiz edits:** editing is allowed and existing attempts keep their snapshot. Should published quizzes be locked instead?
8. **Leaderboard visibility:** hidden by default. Confirm this is the desired term-end behaviour.
9. **Privacy:** Gemini free-tier data terms and Google Fonts are external dependencies. Confirm they are acceptable for the class.
10. **Backups:** confirm who owns the Supabase project and where recovery steps live.

---

## 11. Recommended immediate next actions

In order:

1. Paste the approved spec into `docs/PROJECT.md`.
2. Run `npm run check` on a machine with Node 22.6+.
3. Apply the three migrations to a real Supabase project and run `m1_verify.sql`.
4. Deploy the Edge Function and the frontend, set secrets and CORS.
5. Execute the 11-item integration checklist on a real phone.
6. Add the E2E smoke path and handler tests before the first full term.

---

## Appendix A — Useful commands

```bash
# Frontend (from web/)
npm install
npm run dev        # dev server
npm run check      # lint + typecheck + web tests + API tests + build
npm run test:api   # Edge Function unit tests under Node
npm run build      # production build + 404.html copy

# Edge Function (from supabase/functions/api, with Deno installed)
deno task check
deno task test

# Database
# Run in the Supabase SQL editor, in order:
#   supabase/migrations/20261118000001_init.sql
#   supabase/migrations/20261118000002_flexible_quizzes_per_day.sql
#   supabase/migrations/20261118000003_rate_limit_fn.sql
# Then:
#   supabase/tests/m1_verify.sql
```

## Appendix B — Feature traceability

| Feature | Primary files |
|---|---|
| Login/setup | `handlers/auth.ts`, `features/auth/LoginPage.tsx` |
| Admin login | `handlers/auth.ts`, `features/auth/AdminLoginPage.tsx` |
| Home/stats/board | `handlers/student.ts`, `lib/stats.ts`, `features/quiz/HomePage.tsx` |
| Quiz state | `lib/quizState.ts`, `lib/time.ts` |
| Play/submit | `handlers/student.ts`, `features/quiz/PlayPage.tsx` |
| Scoring/levels/streak | `lib/scoring.ts` |
| Review | `lib/review.ts`, `features/quiz/ResultView.tsx` |
| Assignments | `handlers/assignments.ts`, `features/assignments/WriterPage.tsx`, `features/admin/AssignmentsPage.tsx` |
| Admin dashboard | `handlers/admin.ts`, `features/admin/DashboardPage.tsx` |
| Quiz editor | `handlers/admin.ts`, `features/admin/QuizEditorPage.tsx`, `components/QuestionEditor.tsx` |
| Results/essay review | `handlers/admin.ts`, `features/admin/QuizResultsPage.tsx` |
| Unlocks | `handlers/admin.ts`, `features/admin/UnlockPage.tsx` |
| AI generation/grading | `lib/ai/*`, `handlers/admin.ts`, `features/admin/AiPanel.tsx` |
| Settings | `handlers/admin.ts`, `features/admin/SettingsPage.tsx` |
| Schema/security | `supabase/migrations/*.sql` |
| Verification | `docs/VERIFICATION.md`, `web/src/**/*_test.ts`, `supabase/functions/api/lib/**/*_test.ts` |
