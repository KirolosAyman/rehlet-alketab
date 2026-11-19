// Provider-neutral AI interface (spec §11.3). Business logic depends only on this.
export type AiErrorCode = 'quota' | 'model' | 'key' | 'network' | 'timeout' | 'bad_output' | 'no_key';

export const AI_MESSAGES: Record<AiErrorCode, string> = {
  quota: 'وصلنا للحد المجاني للذكاء الاصطناعي. استنى شوية وجرّب تاني (أو بكرة لو الحد اليومي خلص).',
  model: 'اسم الموديل مش متاح. غيّره من الإعدادات.',
  key: 'مفتاح الذكاء الاصطناعي مرفوض. حط مفتاح صحيح من الإعدادات.',
  network: 'مش قادرين نوصل لخدمة الذكاء الاصطناعي دلوقتي. جرّب تاني.',
  timeout: 'خدمة الذكاء الاصطناعي اتأخرت في الرد. جرّب تاني.',
  bad_output: 'رد الذكاء الاصطناعي مش مفهوم. جرّب تاني.',
  no_key: 'مفيش مفتاح ذكاء اصطناعي. أضفه من الإعدادات.',
};

export class AiError extends Error {
  readonly code: AiErrorCode;
  constructor(code: AiErrorCode, detail?: string) {
    super(detail ?? code);
    this.code = code;
  }
}

/** JSON schema in Gemini's OpenAPI-subset format. */
export type JsonSchema = Record<string, unknown>;

export interface GenerateOpts {
  system?: string;
  temperature?: number;
  timeoutMs?: number;
}

export interface AiProvider {
  generateJson<T>(prompt: string, schema: JsonSchema, opts?: GenerateOpts): Promise<T>;
}
