// Question model + the single validator used for manual input, student input and AI output.
import { arDigits } from './digits.ts';

export type QType = 'mcq' | 'tf' | 'fill' | 'essay';
export type Grading = 'ai' | 'manual';

export interface Question {
  type: QType;
  q: string;
  options: string[];
  answer: number;
  model?: string; // essay only
  grading?: Grading; // essay only (D-010), default 'ai'
}

export type PublicQuestion = { type: QType; q: string; options: string[] };

export const LIMITS = { maxQuestions: 30, q: 1000, option: 300, model: 1500, minOptions: 2, maxOptions: 4 };
export const TF_OPTIONS = ['صح', 'خطأ'];
export const BLANK = '______';
const TYPES: QType[] = ['mcq', 'tf', 'fill', 'essay'];

type One = { ok: true; question: Question } | { ok: false; message: string };
export type ManyResult = { ok: true; questions: Question[] } | { ok: false; message: string; index: number };

const prefix = (n: number) => `السؤال رقم ${arDigits(n)}: `;

export function validateQuestion(raw: unknown, n: number): One {
  const bad = (m: string): One => ({ ok: false, message: prefix(n) + m });
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return bad('بيانات السؤال غير صالحة.');
  const r = raw as Record<string, unknown>;
  const type = r.type as QType;
  if (!TYPES.includes(type)) return bad('نوع السؤال غير معروف.');
  const q = typeof r.q === 'string' ? r.q.trim() : '';
  if (!q) return bad('اكتب نص السؤال.');
  if (q.length > LIMITS.q) return bad(`نص السؤال أطول من ${arDigits(LIMITS.q)} حرف.`);

  if (type === 'essay') {
    const model = typeof r.model === 'string' ? r.model.trim() : '';
    if (!model) return bad('السؤال المقالي محتاج إجابة نموذجية.');
    if (model.length > LIMITS.model) return bad(`الإجابة النموذجية أطول من ${arDigits(LIMITS.model)} حرف.`);
    const g = r.grading ?? 'ai';
    if (g !== 'ai' && g !== 'manual') return bad('طريقة التصحيح لازم تكون ذكاء اصطناعي أو يدوي.');
    return { ok: true, question: { type, q, options: [], answer: 0, model, grading: g } };
  }

  const answer = r.answer;
  if (type === 'tf') {
    if (answer !== 0 && answer !== 1) return bad('اختار الإجابة الصحيحة (صح أو خطأ).');
    return { ok: true, question: { type, q, options: [...TF_OPTIONS], answer } };
  }

  if (type === 'fill' && !q.includes('___')) return bad(`جملة الإكمال لازم فيها ${BLANK} مكان الكلمة الناقصة.`);
  if (!Array.isArray(r.options)) return bad('الاختيارات ناقصة.');
  const options = r.options.map((o) => (typeof o === 'string' ? o.trim() : ''));
  if (options.length < LIMITS.minOptions || options.length > LIMITS.maxOptions)
    return bad(`عدد الاختيارات لازم يكون من ${arDigits(LIMITS.minOptions)} لـ ${arDigits(LIMITS.maxOptions)}.`);
  const emptyAt = options.findIndex((o) => !o);
  if (emptyAt >= 0) return bad(`الاختيار رقم ${arDigits(emptyAt + 1)} فاضي.`);
  if (options.some((o) => o.length > LIMITS.option)) return bad(`فيه اختيار أطول من ${arDigits(LIMITS.option)} حرف.`);
  if (new Set(options).size !== options.length) return bad('فيه اختيارين متكررين.');
  if (typeof answer !== 'number' || !Number.isInteger(answer) || answer < 0 || answer >= options.length)
    return bad('اختار الإجابة الصحيحة.');
  return { ok: true, question: { type, q, options, answer } };
}

export function validateQuestions(raw: unknown): ManyResult {
  if (!Array.isArray(raw)) return { ok: false, message: 'قائمة الأسئلة غير صالحة.', index: -1 };
  if (raw.length > LIMITS.maxQuestions)
    return { ok: false, message: `أقصى عدد ${arDigits(LIMITS.maxQuestions)} سؤال في الاختبار.`, index: -1 };
  const out: Question[] = [];
  for (let i = 0; i < raw.length; i++) {
    const r = validateQuestion(raw[i], i + 1);
    if (!r.ok) return { ok: false, message: r.message, index: i };
    out.push(r.question);
  }
  return { ok: true, questions: out };
}

/** Student-facing shape: never includes answer, model or grading. */
export function toPublic(q: Question): PublicQuestion {
  return { type: q.type, q: q.q, options: [...q.options] };
}

/** Shuffle options keeping the correct answer (never for tf/essay). */
export function shuffleOptions(q: Question, rng: () => number = Math.random): Question {
  if (q.type !== 'mcq' && q.type !== 'fill') return q;
  const idx = q.options.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [idx[i], idx[j]] = [idx[j]!, idx[i]!];
  }
  return { ...q, options: idx.map((i) => q.options[i]!), answer: idx.indexOf(q.answer) };
}
