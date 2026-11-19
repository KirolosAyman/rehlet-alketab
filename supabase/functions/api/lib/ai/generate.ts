// Admin-only draft generation: validate with the SAME validator, drop invalid, shuffle.
import type { Question } from '../questions.ts';
import { shuffleOptions, validateQuestion } from '../questions.ts';
import type { AiProvider } from './provider.ts';
import { AiError } from './provider.ts';
import type { GenerationInput } from './prompts.ts';
import { buildGenerationPrompt, GENERATION_SCHEMA, GENERATION_SYSTEM } from './prompts.ts';

export function postProcess(raw: unknown, counts: GenerationInput['counts'], rng: () => number = Math.random): Question[] {
  const list = (raw as { questions?: unknown })?.questions;
  if (!Array.isArray(list)) return [];
  const left = { ...counts };
  const out: Question[] = [];
  for (const item of list) {
    const r = validateQuestion(item, out.length + 1);
    if (!r.ok || r.question.type === 'essay') continue;
    const t = r.question.type;
    if (left[t] <= 0) continue;
    left[t]--;
    out.push(shuffleOptions(r.question, rng));
  }
  return out;
}

export async function generateQuestions(provider: AiProvider, input: GenerationInput): Promise<Question[]> {
  const raw = await provider.generateJson<unknown>(buildGenerationPrompt(input), GENERATION_SCHEMA, {
    system: GENERATION_SYSTEM,
    temperature: 0.3,
    timeoutMs: 45_000,
  });
  const qs = postProcess(raw, input.counts);
  if (qs.length === 0) throw new AiError('bad_output', 'no valid questions');
  return qs;
}
