// Essay grading in ONE batched call per attempt (D-003), respecting per-question mode (D-010).
import type { Question } from '../questions.ts';
import type { Answer, EssayVerdict } from '../scoring.ts';
import type { AiProvider } from './provider.ts';
import { AiError } from './provider.ts';
import { buildGradingPrompt, GRADING_SCHEMA, GRADING_SYSTEM } from './prompts.ts';

export const GRADING_TIMEOUT_MS = 8_000;

/** Which essay indexes may be sent to the AI. */
export function aiEligible(questions: Question[], existing: EssayVerdict[]): number[] {
  return questions.flatMap((q, i) => {
    if (q.type !== 'essay' || (q.grading ?? 'ai') !== 'ai') return [];
    const v = existing.find((e) => e.i === i);
    if (v && (v.by === 'admin' || v.status !== 'pending')) return [];
    return [i];
  });
}

/** Returns verdicts for ALL essays. AI failure → pending (never throws, except when told to). */
export async function gradeEssays(
  provider: AiProvider | null,
  questions: Question[],
  answers: Answer[],
  existing: EssayVerdict[] = [],
  opts: { rethrow?: boolean } = {},
): Promise<{ verdicts: EssayVerdict[]; error: AiError | null }> {
  const verdicts: EssayVerdict[] = questions.flatMap((q, i) =>
    q.type === 'essay' ? [existing.find((e) => e.i === i) ?? { i, status: 'pending' as const, note: '', by: null }] : [],
  );
  const ids = aiEligible(questions, existing);
  if (ids.length === 0) return { verdicts, error: null };
  if (!provider) {
    const err = new AiError('no_key');
    if (opts.rethrow) throw err;
    return { verdicts, error: err };
  }
  try {
    const res = await provider.generateJson<{ results?: { id: number; ok: boolean; note: string }[] }>(
      buildGradingPrompt(ids.map((i) => ({ id: i, question: questions[i]!.q, model: questions[i]!.model ?? '', answer: String(answers[i] ?? '') }))),
      GRADING_SCHEMA,
      { system: GRADING_SYSTEM, temperature: 0.1, timeoutMs: GRADING_TIMEOUT_MS },
    );
    for (const r of res.results ?? []) {
      if (!ids.includes(r.id) || typeof r.ok !== 'boolean') continue;
      const v = verdicts.find((x) => x.i === r.id);
      if (v) Object.assign(v, { status: r.ok ? 'ok' : 'no', note: String(r.note ?? '').slice(0, 120), by: 'ai' });
    }
    return { verdicts, error: null };
  } catch (e) {
    const err = e instanceof AiError ? e : new AiError('network');
    if (opts.rethrow) throw err;
    return { verdicts, error: err };
  }
}
