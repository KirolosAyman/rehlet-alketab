// Entry point: CORS + JSON parsing + router only. Business logic lives in handlers/ and lib/.
import type { Ctx, Handler } from './lib/context.ts';
import { makeDb } from './lib/db.ts';
import { ApiError } from './lib/http.ts';
import { cairoNow } from './lib/time.ts';
import { requireAdmin } from './lib/session.ts';
import * as auth from './handlers/auth.ts';
import * as student from './handlers/student.ts';
import * as admin from './handlers/admin.ts';
import * as assign from './handlers/assignments.ts';

const ROUTES: Record<string, Handler> = {
  // public
  check_username: auth.checkUsername,
  set_password: auth.setPassword,
  login: auth.login,
  admin_login: auth.adminLogin,
  logout: auth.logout,
  // student
  home: student.home,
  get_quiz: student.getQuiz,
  submit: student.submit,
  assign_save: assign.assignSave,
  books_list: student.booksList,
  book_board: student.bookBoard,
  // admin
  admin_logout: auth.logout,
  admin_dashboard: admin.dashboard,
  admin_books_list: admin.booksList,
  admin_book_add: admin.bookAdd,
  admin_book_toggle_board: admin.bookToggleBoard,
  admin_book_results: admin.bookResults,
  admin_students_add: admin.studentsAdd,
  admin_student_update: admin.studentUpdate,
  admin_student_reset: admin.studentReset,
  admin_student_delete: admin.studentDelete,
  admin_quiz_get: admin.quizGet,
  admin_quiz_save: admin.quizSave,
  admin_quiz_delete: admin.quizDelete,
  admin_quiz_unlocks_get: admin.unlocksGet,
  admin_quiz_unlocks_set: admin.unlocksSet,
  admin_assign_create: assign.assignCreate,
  admin_assign_delete: assign.assignDelete,
  admin_assign_reopen: assign.assignReopen,
  admin_assign_to_quiz: assign.assignToQuiz,
  admin_attempt_set: admin.attemptSet,
  admin_regrade_pending: admin.regradePending,
  admin_generate: admin.generate,
  admin_set_leaderboard: admin.setLeaderboard,
  admin_settings_set: admin.settingsSet,
  admin_ai_settings_get: admin.aiSettingsGet,
  admin_ai_settings_set: admin.aiSettingsSet,
  admin_ai_test: admin.aiTest,
};

const MAX_BODY = 200_000;
const allowed = (Deno.env.get('ALLOWED_ORIGIN') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
if (allowed.length === 0) console.warn('[cors] ALLOWED_ORIGIN not set — allowing any origin (development only!)');

function corsHeaders(origin: string | null): Record<string, string> {
  const allow = allowed.length === 0 ? '*' : origin && allowed.includes(origin) ? origin : allowed[0]!;
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, authorization, apikey, x-client-info',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(status: number, body: unknown, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' } });
}

const fail = (status: number, error: string, message: string, cors: Record<string, string>) => json(status, { ok: false, error, message }, cors);

let db: ReturnType<typeof makeDb> | null = null;

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('Origin');
  const cors = corsHeaders(origin);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return fail(405, 'method', 'الطلب غير مسموح.', cors);
  if (allowed.length && origin && !allowed.includes(origin)) return fail(403, 'origin', 'الموقع ده مش مسموح له.', cors);

  let body: Record<string, unknown>;
  try {
    const text = await req.text();
    if (text.length > MAX_BODY) return fail(413, 'too_large', 'البيانات كبيرة قوي. قلّل النص وجرّب تاني.', cors);
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not object');
    body = parsed as Record<string, unknown>;
  } catch {
    return fail(400, 'bad_json', 'الطلب غير صالح.', cors);
  }

  const action = typeof body.action === 'string' ? body.action : '';
  const handler = Object.hasOwn(ROUTES, action) ? ROUTES[action] : undefined;
  if (!handler) return fail(400, 'unknown_action', 'العملية دي مش معروفة.', cors);

  try {
    db ??= makeDb();
    const ctx: Ctx = {
      db,
      body,
      token: body.token,
      ip: (req.headers.get('x-forwarded-for') ?? '').split(',')[0]!.trim() || 'unknown',
      now: cairoNow(),
    };
    if (action.startsWith('admin_') && action !== 'admin_login') await requireAdmin(db, ctx.token);
    const result = await handler(ctx);
    return json(200, { ok: true, ...result }, cors);
  } catch (e) {
    if (e instanceof ApiError) return fail(e.status, e.code, e.message, cors);
    console.error(`[${action}] unexpected:`, e instanceof Error ? e.stack ?? e.message : e);
    return fail(500, 'server_error', 'حصلت مشكلة في السيرفر. جرّب تاني بعد شوية.', cors);
  }
});
