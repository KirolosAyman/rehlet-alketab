// Builds the post-submission review (safe to send: the student already submitted).
import type { Question } from './questions.ts';
import type { Answer, EssayVerdict } from './scoring.ts';
import { isChoiceCorrect } from './scoring.ts';

export interface ReviewItem {
  type: Question['type'];
  q: string;
  options: string[];
  answer: number;
  model: string | null;
  yours: Answer;
  correct: boolean | null; // null = essay pending
  essay: { status: EssayVerdict['status']; note: string } | null;
}

export function buildReview(snapshot: Question[], answers: Answer[], essay: EssayVerdict[]): ReviewItem[] {
  return snapshot.map((q, i) => {
    const yours = answers[i] ?? null;
    if (q.type === 'essay') {
      const v = essay.find((e) => e.i === i) ?? { status: 'pending' as const, note: '' };
      return {
        type: q.type, q: q.q, options: [], answer: 0, model: q.model ?? '', yours,
        correct: v.status === 'pending' ? null : v.status === 'ok',
        essay: { status: v.status, note: v.note },
      };
    }
    return { type: q.type, q: q.q, options: q.options, answer: q.answer, model: null, yours, correct: isChoiceCorrect(q, yours), essay: null };
  });
}
