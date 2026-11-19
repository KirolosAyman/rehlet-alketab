# Decisions log

Append-only. Each entry: date · decision · why · status.

## D-001 · Attempts store a questions snapshot — APPROVED (2026-11-18)
`attempts.questions_snapshot jsonb` holds the exact questions at submit time.
Grading, essay re-grading (`admin_attempt_set`) and the review screen read the snapshot, never the live quiz.
**Why:** the admin may edit a published quiz; answer indexes would otherwise point at changed/removed options.

## D-002 · One published quiz per date — SUPERSEDED by D-012
~~
Partial unique index: `unique (quiz_date) where status = 'published'`.
Drafts for the same date may coexist (so the admin can prepare), but publishing a second quiz for a date fails with a clear Arabic message.
`admin_assign_to_quiz` asks for the target date (default: assignment day + 1).
**Confirmed by owner:** drafts are NOT limited; any number of drafts per date.~~

## D-003 · Essays graded in one batched AI call — APPROVED (2026-11-18)
All essay questions of one attempt go into a single Gemini request with a short timeout (~8 s).
On failure / timeout / 429 (free quota exhausted) every essay is stored as `pending`; submission still succeeds.
Admin resolves pending essays manually (`admin_attempt_set`).
**Approved:** admin action `admin_regrade_pending` (button "إعادة تصحيح المعلّق بالذكاء الاصطناعي"), scoped to one quiz.
It re-sends only essays that are `pending` AND whose question has `grading: 'ai'`, in one batched call per attempt, then recomputes stars.
It never touches verdicts already set by the admin. If the quota is still exhausted, nothing changes and a clear Arabic message is shown.
Built in M6 (backend) and M13 (button).

## D-004 · Throttling table + lockout — APPROVED (2026-11-18)
Table `rate_limits(key text, window_start timestamptz, count int)` for `login`, `admin_login`, `admin_generate` (keys like `login:ip:<hash>`, `gen:admin`).
Account lockout: 5 wrong passwords → 10 min.
**Known trade-off:** anyone can lock a classmate's account by typing wrong passwords. Accepted for a closed class.
**Scale:** design target raised from 30 to ~100 students. Nothing in the design changes; all queries are indexed and the free tier is enough. Revisit lockout (e.g. per username+IP) if abuse happens.

## D-005 · Versioned password hashes — APPROVED (2026-11-18)
Format: `pbkdf2$<iterations>$<salt_b64>$<hash_b64>`, starting at 100,000 iterations.
Verification reads the iteration count from the stored string, so the count can be raised later without breaking existing passwords. Actual CPU time measured in M3.

## D-006 · Level/progress computed on the server only — APPROVED (2026-11-18)
`home` returns `stars, level, nextLevelAt, starsLeft, streak`. The frontend displays them and never re-implements scoring, level or streak rules.

## D-007 · Styling: Tailwind CSS — M0
Spec allowed Tailwind or CSS modules. Tailwind chosen for RTL logical utilities (`ms-`, `pe-`, `text-start`) and small output. Color tokens live in CSS variables so light/dark is one switch.

## D-008 · Test data seed — M0
`supabase/seed.sql` (added in M1) creates sample students, quizzes, an unlock and an authored quiz so M4 checks can run before M7/M8 exist.

## D-009 · SPA fallback for /admin — M0
`web/public/_redirects` (`/* /index.html 200`) for Cloudflare Pages / Netlify. For GitHub Pages, the build copies `index.html` to `404.html` (M15).

## D-010 · Per-question essay grading mode (new feature) — APPROVED (2026-11-18)
Owner request: the admin chooses which essay questions the AI grades; the admin can always grade any essay manually.

**Model change (extends spec §9.1):**
```ts
type Question = { ...; grading?: 'ai' | 'manual' }  // essay only; default 'ai'; ignored/removed for other types
```
**Behavior:**
- `submit`: only essays with `grading: 'ai'` go to the AI batch. `manual` essays are stored `pending` with no AI call (saves free quota).
- Essay verdict entry gains `by`: `{ i, status: 'ok'|'no'|'pending', note, by: 'ai'|'admin'|null }`.
- `admin_attempt_set` can set/override ANY essay verdict (AI-graded or manual) → `by: 'admin'`, stars recomputed from the snapshot.
- `admin_regrade_pending` (D-003) skips `manual` questions and any verdict with `by: 'admin'`.
- Student never sees the `grading` field; a pending essay shows "في انتظار مراجعة الخادم".
- Student-authored questions (assignments) default to `ai`; the admin can change it during review.
- Quiz editor (M13): per essay card, a toggle "تصحيح بالذكاء الاصطناعي / تصحيح يدوي", plus a "all essays: AI / manual" shortcut.
- Validator: `grading` allowed only on essay; any other value rejected with the question number.
**Unit tests added to M2:** validator accepts/rejects `grading`; scoring with mixed ai/manual/pending; admin override on an AI verdict.

## D-011 · M1 schema additions vs spec §7
- `attempts.questions_snapshot jsonb not null` (D-001).
- Partial unique index `quizzes_one_published_per_date` (D-002).
- `rate_limits` table (D-004).
- `settings` defaults inserted: `leaderboard_public=false`, `ai_model="gemini-2.5-flash"`. `admin_lock` is created on first failed admin login.
- `check` constraints for lengths/format are kept minimal in SQL; full validation stays in the server validator (single source of messages in Arabic).

## D-012 · Published quizzes per day = configurable limit (default 1) — APPROVED (2026-11-18)
Owner: "make it flexible to add multiple quizzes, but I don't use it now".
- The DB unique index is removed (migration `..._000002`). The limit lives in `settings.max_published_per_day` (default `1`).
- Enforced on the server in `admin_quiz_save` when status becomes `published`: count other published quizzes on that date; if count ≥ limit → Arabic error naming the date and the existing quiz.
- Only **published** quizzes count. Drafts are unlimited. **Deleted** quizzes don't exist anymore, so they never block. Moving a quiz back to draft frees the slot.
- `admin_assign_to_quiz` creates a draft, so it is never blocked; the limit applies only at publish time.
- Student side already supports a list of quizzes per day (spec §8.2 `home`), streak counts quizzes not days, so nothing else changes.
- Trade-off: a server check (not a DB constraint) could race if two publishes happen at the same instant. Single admin → accepted.
- UI (M13): Settings gets a number field "عدد الاختبارات المنشورة في اليوم" (1–5). Not exposed until needed; default stays 1.

## D-013 · Implementation choices made while building M2–M16 (2026-11-18)
Spec gaps resolved with the simplest option. Flagged for the owner's review:
1. **Admin data in one call.** `admin_dashboard` returns students, quizzes, assignments and counts together (there is no separate "list quizzes" action). Fine up to a few hundred students/quizzes.
2. **Extra actions beyond §8.3:** `admin_logout`, `admin_regrade_pending` (D-003), `admin_settings_set` (D-012).
3. **Duplicate options rejected** in mcq/fill (otherwise "exactly one correct answer" is ambiguous).
4. **Assignments are visible to the student from their day onward until submitted.** Before the day they don't show, and the server refuses saving early.
5. **Students can't pick a grading mode.** Student-written essays default to AI grading; the admin can change it while reviewing.
6. **CORS:** if `ALLOWED_ORIGIN` is not set, every origin is allowed and a warning is logged. This is for first-time setup only; SETUP.md tells the owner to set it.
7. **Rate limits:** check_username 60/10 min per IP; login + set_password 30/10 min per IP; admin_login 20/10 min per IP; admin_generate 20/hour. IPs are stored only as hashes.
8. **Essay answer limit:** 3,000 characters.
9. **Bulk-add separators:** the comma `,`, the Arabic comma `،` or a tab.
10. **Leaderboard ties** share a rank (1, 1, 3), ordered by stars, then streak.
11. **Quiz in progress** is saved in `sessionStorage`, so a page refresh doesn't lose the answers.
12. **Admin code is lazy-loaded**, so students never download it.
13. **Server time zone:** time logic uses `Intl` with `Africa/Cairo`, so Egypt's daylight-saving time is handled automatically.
14. **API unit tests also run on Node** (`npm run test:api`) through a tiny `Deno.test` shim, so no Deno install is needed. CI runs them under Deno as well.
15. **Blank model name** in Settings means "use the default" (or `GEMINI_MODEL` if set).
