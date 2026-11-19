// Server-side input validation with length limits (spec §12). Throws ApiError with Arabic text.
import { badInput } from './http.ts';
import { arDigits } from './digits.ts';
import { isValidDate, normalizeTime } from './time.ts';

export type Body = Record<string, unknown>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function str(b: Body, k: string, label: string, max: number, opts: { min?: number; optional?: boolean } = {}): string {
  const v = b[k];
  if (v === undefined || v === null) {
    if (opts.optional) return '';
    throw badInput(`اكتب ${label}.`);
  }
  if (typeof v !== 'string') throw badInput(`${label} غير صالح.`);
  const s = v.trim();
  if (!s && !opts.optional) throw badInput(`اكتب ${label}.`);
  if (s.length > max) throw badInput(`${label} أطول من ${arDigits(max)} حرف.`);
  if (opts.min && s.length < opts.min) throw badInput(`${label} لازم ${arDigits(opts.min)} حروف على الأقل.`);
  return s;
}

/** Password: not trimmed. */
export function password(b: Body, k = 'password'): string {
  const v = b[k];
  if (typeof v !== 'string' || v.length === 0) throw badInput('اكتب كلمة السر.');
  if (v.length < 4) throw badInput('كلمة السر لازم ٤ حروف أو أكتر.');
  if (v.length > 100) throw badInput('كلمة السر طويلة قوي (أقصى ١٠٠ حرف).');
  return v;
}

export function id(b: Body, k: string): string {
  const v = b[k];
  if (typeof v !== 'string' || !UUID.test(v)) throw badInput('معرّف غير صالح.');
  return v;
}

export function optId(b: Body, k: string): string | null {
  return b[k] === undefined || b[k] === null || b[k] === '' ? null : id(b, k);
}

export function ids(b: Body, k: string, max = 500): string[] {
  const v = b[k];
  if (!Array.isArray(v) || v.length > max) throw badInput('قائمة غير صالحة.');
  return [...new Set(v.map((x) => id({ x }, 'x')))];
}

export function int(b: Body, k: string, label: string, min: number, max: number): number {
  const v = b[k];
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max)
    throw badInput(`${label} لازم يكون رقم من ${arDigits(min)} لـ ${arDigits(max)}.`);
  return v;
}

export function bool(b: Body, k: string): boolean {
  if (typeof b[k] !== 'boolean') throw badInput('قيمة غير صالحة.');
  return b[k] as boolean;
}

export function date(b: Body, k: string, label = 'التاريخ'): string {
  if (!isValidDate(b[k])) throw badInput(`${label} غير صحيح.`);
  return b[k] as string;
}

export function optTime(b: Body, k: string): string | null {
  const v = b[k];
  if (v === undefined || v === null || v === '') return null;
  const t = normalizeTime(v);
  if (!t) throw badInput('ميعاد الفتح غير صحيح (مثال ١٩:٠٠).');
  return t;
}

export function oneOf<T extends string>(b: Body, k: string, values: readonly T[]): T {
  const v = b[k];
  if (typeof v !== 'string' || !values.includes(v as T)) throw badInput('قيمة غير صالحة.');
  return v as T;
}
