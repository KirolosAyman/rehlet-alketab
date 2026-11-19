// Arabic digits and Arabic (ar-EG) dates.
const AR = '٠١٢٣٤٥٦٧٨٩';
export const n = (v: number | string): string => String(v).replace(/[0-9]/g, (d) => AR[Number(d)] ?? d);

export function fmtDate(d: string, opts: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' }): string {
  return new Intl.DateTimeFormat('ar-EG', { ...opts, timeZone: 'UTC' }).format(new Date(d + 'T00:00:00Z'));
}

export const fmtShortDate = (d: string) => fmtDate(d, { day: 'numeric', month: 'short' });

/** '19:00' → '٧:٠٠ م' */
export function fmtTime(t: string | null): string {
  if (!t) return '';
  const [hS = '0', m = '00'] = t.split(':');
  const h = Number(hS);
  return `${n(h % 12 || 12)}:${n(m)} ${h < 12 ? 'ص' : 'م'}`;
}

export const pct = (x: number | null) => (x === null ? '—' : `${n(Math.round(x * 100))}٪`);

export function addDays(date: string, days: number): string {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
