import type { Db } from './db.ts';
import type { Body } from './input.ts';
import type { CairoNow } from './time.ts';

export interface Ctx {
  db: Db;
  body: Body;
  token: unknown;
  ip: string;
  now: CairoNow;
}
export type Handler = (ctx: Ctx) => Promise<Record<string, unknown>>;
