// Sessions: random token to the client, only its SHA-256 stored (spec §9.7).
import type { Db } from './db.ts';
import { must } from './db.ts';
import { randomToken, sha256Hex } from './crypto.ts';
import { ApiError, unauthorized } from './http.ts';

const ADMIN_TTL_MS = 7 * 24 * 3600 * 1000;

export async function createSession(db: Db, studentId: string | null, isAdmin: boolean): Promise<string> {
  const token = randomToken();
  must(
    await db.from('sessions').insert({
      token_hash: await sha256Hex(token),
      student_id: studentId,
      is_admin: isAdmin,
      expires_at: isAdmin ? new Date(Date.now() + ADMIN_TTL_MS).toISOString() : null,
    }),
    'createSession',
  );
  return token;
}

interface SessionRow { token_hash: string; student_id: string | null; is_admin: boolean; expires_at: string | null }

async function load(db: Db, token: unknown): Promise<SessionRow | null> {
  if (typeof token !== 'string' || token.length < 20 || token.length > 100) return null;
  const hash = await sha256Hex(token);
  const s = must<SessionRow | null>(
    await db.from('sessions').select('token_hash, student_id, is_admin, expires_at').eq('token_hash', hash).maybeSingle(),
    'loadSession',
  );
  if (s?.expires_at && new Date(s.expires_at).getTime() < Date.now()) {
    await db.from('sessions').delete().eq('token_hash', hash);
    return null;
  }
  return s;
}

export async function requireStudent(db: Db, token: unknown): Promise<string> {
  const s = await load(db, token);
  if (!s || s.is_admin || !s.student_id) throw unauthorized();
  return s.student_id;
}

export async function requireAdmin(db: Db, token: unknown): Promise<void> {
  const s = await load(db, token);
  if (!s?.is_admin) throw new ApiError('unauthorized', 'جلسة الخادم انتهت. ادخل بكلمة السر تاني.', 401);
}

export async function deleteSession(db: Db, token: unknown): Promise<void> {
  if (typeof token !== 'string' || token.length > 100) return;
  must(await db.from('sessions').delete().eq('token_hash', await sha256Hex(token)), 'deleteSession');
}
