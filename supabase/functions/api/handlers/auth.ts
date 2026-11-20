// Public actions: check_username, set_password, login, admin_login, logout.
import type { Ctx } from '../lib/context.ts';
import type { StudentRow } from '../lib/rows.ts';
import { getSetting, must, setSetting } from '../lib/db.ts';
import { hashPassword, safeStringEqual, verifyPassword } from '../lib/crypto.ts';
import { ApiError, conflict, notFound } from '../lib/http.ts';
import { password, str } from '../lib/input.ts';
import { normalizeUsername } from '../lib/normalize.ts';
import { ipKey, rateLimit } from '../lib/ratelimit.ts';
import { createSession, deleteSession } from '../lib/session.ts';
import { arDigits } from '../lib/digits.ts';

const MAX_FAILS = 5;
const LOCK_MS = 10 * 60 * 1000;

const badCreds = () => new ApiError('bad_credentials', 'اسم المستخدم أو كلمة السر مش صح.', 401);
const lockedErr = (until: number) =>
  new ApiError('locked', `الحساب اتقفل مؤقتًا بسبب محاولات غلط كتير. جرّب بعد ${arDigits(Math.max(1, Math.ceil((until - Date.now()) / 60000)))} دقيقة.`, 423);

async function findStudent(ctx: Ctx, username: string): Promise<StudentRow | null> {
  return must<StudentRow | null>(
    await ctx.db
      .from('students')
      .select('id, username, display_name, pass_hash, failed_attempts, locked_until')
      .eq('username_norm', normalizeUsername(username))
      .maybeSingle(),
    'findStudent',
  );
}

export async function checkUsername(ctx: Ctx) {
  const username = str(ctx.body, 'username', 'اسم المستخدم', 60);
  await rateLimit(ctx.db, 'check:' + (await ipKey(ctx.ip)), 60, 600);
  const s = await findStudent(ctx, username);
  if (!s) return { status: 'not_found' };
  return { status: s.pass_hash ? 'needs_login' : 'needs_setup', displayName: s.display_name };
}

export async function setPassword(ctx: Ctx) {
  const username = str(ctx.body, 'username', 'اسم المستخدم', 60);
  const pw = password(ctx.body);
  if (ctx.body.confirm !== undefined && ctx.body.confirm !== pw)
    throw new ApiError('mismatch', 'كلمتين السر مش زي بعض. اكتبهم تاني.');
  await rateLimit(ctx.db, 'login:' + (await ipKey(ctx.ip)), 30, 600);
  const hash = await hashPassword(pw);
  // Race-safe: only succeeds while pass_hash IS NULL.
  const row = must<{ id: string; display_name: string } | null>(
    await ctx.db
      .from('students')
      .update({ pass_hash: hash, failed_attempts: 0, locked_until: null })
      .eq('username_norm', normalizeUsername(username))
      .is('pass_hash', null)
      .select('id, display_name')
      .maybeSingle(),
    'setPassword',
  );
  if (!row) {
    if (await findStudent(ctx, username)) throw conflict('already_set', 'الحساب ده متفعل قبل كده. ادخل بكلمة السر.');
    throw notFound('اسم المستخدم ده مش موجود. اتأكد منه أو اسأل الخادم.');
  }
  return { token: await createSession(ctx.db, row.id, false), displayName: row.display_name };
}

export async function login(ctx: Ctx) {
  const username = str(ctx.body, 'username', 'اسم المستخدم', 60);
  const pw = password(ctx.body);
  await rateLimit(ctx.db, 'login:' + (await ipKey(ctx.ip)), 30, 600);
  const s = await findStudent(ctx, username);
  if (!s) throw badCreds();
  const lockedUntil = s.locked_until ? new Date(s.locked_until).getTime() : 0;
  if (lockedUntil > Date.now()) throw lockedErr(lockedUntil);
  if (!s.pass_hash) throw conflict('needs_setup', 'لسه ما اخترتش كلمة سر. ارجع واكتب اسمك تاني.');

  if (!(await verifyPassword(pw, s.pass_hash))) {
    const fails = (s.failed_attempts ?? 0) + 1;
    const lock = fails >= MAX_FAILS;
    const until = Date.now() + LOCK_MS;
    must(
      await ctx.db
        .from('students')
        .update(lock ? { failed_attempts: 0, locked_until: new Date(until).toISOString() } : { failed_attempts: fails })
        .eq('id', s.id),
      'loginFail',
    );
    throw lock ? lockedErr(until) : badCreds();
  }
  must(await ctx.db.from('students').update({ failed_attempts: 0, locked_until: null }).eq('id', s.id), 'loginOk');
  return { token: await createSession(ctx.db, s.id, false), displayName: s.display_name };
}

interface AdminLock { failed: number; until: number | null }

export async function adminLogin(ctx: Ctx) {
  const pw = typeof ctx.body.password === 'string' ? ctx.body.password.slice(0, 200) : '';
  if (!pw) throw new ApiError('bad_input', 'اكتب كلمة السر.');
  const secret = Deno.env.get('ADMIN_PASSWORD');
  if (!secret) {
    console.error('[admin_login] ADMIN_PASSWORD secret is not set');
    throw new ApiError('server_config', 'كلمة سر الخادم مش متظبطة على السيرفر. راجع دليل الإعداد.', 500);
  }
  const ipH = await ipKey(ctx.ip);
  await rateLimit(ctx.db, 'admin_login:' + ipH, 20, 600);
  const lockKey = 'admin_lock:' + ipH;
  const lock = await getSetting<AdminLock>(ctx.db, lockKey, { failed: 0, until: null });
  if (lock.until && lock.until > Date.now()) throw lockedErr(lock.until);

  if (!(await safeStringEqual(pw, secret))) {
    const failed = (lock.failed ?? 0) + 1;
    const locking = failed >= MAX_FAILS;
    const until = Date.now() + LOCK_MS;
    await setSetting(ctx.db, lockKey, locking ? { failed: 0, until } : { failed, until: null });
    throw locking ? lockedErr(until) : new ApiError('bad_credentials', 'كلمة السر مش صح.', 401);
  }
  await setSetting(ctx.db, lockKey, { failed: 0, until: null });
  return { token: await createSession(ctx.db, null, true) };
}

export async function logout(ctx: Ctx) {
  await deleteSession(ctx.db, ctx.token);
  return {};
}
