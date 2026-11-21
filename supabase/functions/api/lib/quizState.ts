// Per-student quiz state (spec §9.2). Order matters.
import type { CairoNow } from './time.ts';

export type QuizState = 'done' | 'hidden' | 'author' | 'open' | 'missed';

export interface QuizStateInput {
  status: string;
  quizDate: string;
  opensAt: string | null;
  authorId: string | null;
  studentId: string;
  hasAttempt: boolean;
  unlocked: boolean;
  now: CairoNow;
}

export function quizState(x: QuizStateInput): QuizState {
  if (x.hasAttempt) return 'done';
  if (x.status !== 'published') return 'hidden';
  if (x.authorId && x.authorId === x.studentId) return 'author';
  if (x.quizDate === x.now.date) return 'open';
  if (x.unlocked) return 'open';
  if (x.quizDate < x.now.date) return 'missed';
  return 'hidden';
}
