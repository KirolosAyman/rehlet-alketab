// Where the key and model come from (spec §11.3). Precedence:
// key:   app_secrets.gemini_api_key → env GEMINI_API_KEY
// model: settings.ai_model → env GEMINI_MODEL → DEFAULT_MODEL
import type { AiProvider } from './provider.ts';
import { GeminiProvider } from './gemini.ts';

export const DEFAULT_MODEL = 'gemini-2.5-flash';

export interface AiConfigSources {
  dbKey: string | null;
  dbModel: string | null;
  envKey: string | null;
  envModel: string | null;
}

export interface AiConfig {
  apiKey: string | null;
  model: string;
  keySource: 'settings' | 'env' | 'none';
}

export function resolveAiConfig(s: AiConfigSources): AiConfig {
  const apiKey = s.dbKey || s.envKey || null;
  return {
    apiKey,
    model: s.dbModel || s.envModel || DEFAULT_MODEL,
    keySource: s.dbKey ? 'settings' : s.envKey ? 'env' : 'none',
  };
}

export function maskKey(key: string | null): string | null {
  return key ? '••••••' + key.slice(-4) : null;
}

export function makeProvider(cfg: AiConfig): AiProvider | null {
  return cfg.apiKey ? new GeminiProvider(cfg.apiKey, cfg.model) : null;
}

export const MODEL_RE = /^[A-Za-z0-9._\-/]{1,100}$/;
