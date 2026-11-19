// Supabase client with the SERVICE ROLE key (server only; injected by Supabase at runtime).
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { ApiError } from './http.ts';

export type Db = ReturnType<typeof createClient>;

export function makeDb(): Db {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

type PgErr = { message: string; code?: string } | null;

/** Unwraps a supabase result; logs details server-side, returns a generic error to the client. */
export function must<T>(res: { data: unknown; error: PgErr }, where: string): T {
  if (res.error) {
    console.error(`[db] ${where}:`, res.error.code, res.error.message);
    throw new ApiError('server_error', 'حصلت مشكلة في السيرفر. جرّب تاني بعد شوية.', 500);
  }
  return res.data as T;
}

export const isUniqueViolation = (e: PgErr) => e?.code === '23505';

/** Reads every row past PostgREST's 1000-row cap. */
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: unknown; error: PgErr }>,
  where: string,
): Promise<T[]> {
  const size = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += size) {
    const rows = must<T[]>(await page(from, from + size - 1), where) ?? [];
    out.push(...rows);
    if (rows.length < size) return out;
  }
}

export async function getSetting<T>(db: Db, key: string, fallback: T): Promise<T> {
  const row = must<{ value: T } | null>(await db.from('settings').select('value').eq('key', key).maybeSingle(), 'getSetting');
  return row ? row.value : fallback;
}

export async function setSetting(db: Db, key: string, value: unknown): Promise<void> {
  must(await db.from('settings').upsert({ key, value }, { onConflict: 'key' }), 'setSetting');
}
