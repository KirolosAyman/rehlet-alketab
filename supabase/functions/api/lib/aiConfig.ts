// Loads AI key/model from DB with env fallback (spec §11.3). The key never leaves the server.
import type { Db } from './db.ts';
import { getSetting, must } from './db.ts';
import type { AiConfig } from './ai/config.ts';
import { resolveAiConfig } from './ai/config.ts';
import type { AiErrorCode } from './ai/provider.ts';
import { AI_MESSAGES, AiError } from './ai/provider.ts';
import { ApiError } from './http.ts';

export async function loadAiConfig(db: Db): Promise<AiConfig> {
  const secret = must<{ value: string } | null>(
    await db.from('app_secrets').select('value').eq('key', 'gemini_api_key').maybeSingle(),
    'aiKey',
  );
  const model = await getSetting<string | null>(db, 'ai_model', null);
  return resolveAiConfig({
    dbKey: secret?.value ?? null,
    dbModel: typeof model === 'string' ? model : null,
    envKey: Deno.env.get('GEMINI_API_KEY') ?? null,
    envModel: Deno.env.get('GEMINI_MODEL') ?? null,
  });
}

export function aiToApiError(e: unknown): ApiError {
  const code: AiErrorCode = e instanceof AiError ? e.code : 'network';
  return new ApiError('ai_' + code, AI_MESSAGES[code], code === 'quota' ? 429 : 502);
}
