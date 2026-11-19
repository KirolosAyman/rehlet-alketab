// Gemini implementation. The key is sent in a header and is never logged or returned.
import type { AiProvider, GenerateOpts, JsonSchema } from './provider.ts';
import { AiError } from './provider.ts';

type FetchFn = (input: string, init: RequestInit) => Promise<Response>;

export class GeminiProvider implements AiProvider {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly fetchFn: FetchFn;

  constructor(apiKey: string, model: string, fetchFn: FetchFn = (i, init) => fetch(i, init)) {
    this.apiKey = apiKey;
    this.model = model;
    this.fetchFn = fetchFn;
  }

  async generateJson<T>(prompt: string, schema: JsonSchema, opts: GenerateOpts = {}): Promise<T> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent`;
    const body = {
      ...(opts.system ? { systemInstruction: { parts: [{ text: opts.system }] } } : {}),
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: opts.temperature ?? 0.3,
        responseMimeType: 'application/json',
        responseSchema: schema,
      },
    };
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 30_000);
    let res: Response;
    try {
      res = await this.fetchFn(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.apiKey },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
    } catch (e) {
      throw new AiError(ctrl.signal.aborted ? 'timeout' : 'network', e instanceof Error ? e.name : 'fetch');
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
      const s = res.status;
      throw new AiError(s === 429 ? 'quota' : s === 404 ? 'model' : s === 400 || s === 401 || s === 403 ? 'key' : 'network', `http ${s}`);
    }
    try {
      const data = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
      return JSON.parse(text) as T;
    } catch {
      throw new AiError('bad_output');
    }
  }
}
