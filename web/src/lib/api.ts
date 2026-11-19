// Single-endpoint API client: POST { action, token, ...payload } → { ok, ... }.
import { ar } from '../i18n/ar';
import { adminToken, studentToken } from './session';

const API_URL = import.meta.env.VITE_API_URL;

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, message: string, status = 0) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export async function api<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  if (!API_URL) throw new ApiError('config', ar.errors.noApiUrl);
  const isAdmin = action.startsWith('admin_') && action !== 'admin_login';
  const store = isAdmin ? adminToken : studentToken;
  let res: Response;
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, action, token: store.get() }),
    });
  } catch {
    throw new ApiError('network', ar.errors.network);
  }
  let data: { ok?: boolean; error?: string; message?: string } & Record<string, unknown>;
  try {
    data = await res.json();
  } catch {
    throw new ApiError('bad_response', ar.errors.server, res.status);
  }
  if (!data.ok) {
    if (data.error === 'unauthorized') store.clear();
    throw new ApiError(data.error ?? 'error', data.message || ar.errors.server, res.status);
  }
  return data as unknown as T;
}

export const errorText = (e: unknown) => (e instanceof Error && e.message ? e.message : ar.errors.server);
