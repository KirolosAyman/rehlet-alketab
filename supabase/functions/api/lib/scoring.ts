// Scoring, levels, streak (spec §9.3–9.5). Pure; never trust client scores.
import type { Question } from './questions.ts';

export type Answer = number | string | null;
export type EssayStatus = 'ok' | 'no' | 'pending';
export type EssayBy = 'ai' | 'admin' | null;
export interface EssayVerdict {
  i: number;
  status: EssayStatus;
  note: string;
  by: EssayBy;
}

export const PERFECT_BONUS = 2;

export function isChoiceCorrect(q: Question, a: Answer): boolean {
  return q.type !== 'essay' && typeof a === 'number' && a === q.answer;
}

export function score(questions: Question[], answers: Answer[], essay: EssayVerdict[]) {
  const total = questions.length;
  let correct = 0;
  questions.forEach((q, i) => {
    if (q.type === 'essay') {
      if (essay.find((e) => e.i === i)?.status === 'ok') correct++;
    } else if (isChoiceCorrect(q, answers[i] ?? null)) correct++;
  });
  const stars = correct + (total > 0 && correct === total ? PERFECT_BONUS : 0);
  return { correct, total, stars };
}

export const LEVELS = [
  { min: 0, name: 'بذرة' },
  { min: 10, name: 'نبتة' },
  { min: 25, name: 'غصن' },
  { min: 50, name: 'شجرة' },
  { min: 100, name: 'كرمة' },
] as const;

export interface LevelInfo {
  level: string;
  levelIndex: number;
  nextLevel: string | null;
  nextLevelAt: number | null;
  starsLeft: number;
  progress: number; // 0..1 within the current level
}

export function levelInfo(stars: number): LevelInfo {
  let i = 0;
  for (let k = 0; k < LEVELS.length; k++) if (stars >= LEVELS[k]!.min) i = k;
  const cur = LEVELS[i]!;
  const next = LEVELS[i + 1];
  if (!next) return { level: cur.name, levelIndex: i, nextLevel: null, nextLevelAt: null, starsLeft: 0, progress: 1 };
  return {
    level: cur.name,
    levelIndex: i,
    nextLevel: next.name,
    nextLevelAt: next.min,
    starsLeft: next.min - stars,
    progress: (stars - cur.min) / (next.min - cur.min),
  };
}

export interface StreakItem {
  date: string; // quiz_date of a PUBLISHED quiz
  order?: string; // tie-breaker (created_at), newest first
  done: boolean; // attempted OR authored by the student
}

/** Consecutive published quizzes (≤ today, newest first) done or authored.
 *  Today's untaken quiz does not break it; any earlier missed one does. */
export function computeStreak(items: StreakItem[], today: string): number {
  const list = items
    .filter((x) => x.date <= today)
    .sort((a, b) => (a.date === b.date ? (b.order ?? '').localeCompare(a.order ?? '') : b.date.localeCompare(a.date)));
  let n = 0;
  for (const x of list) {
    if (x.done) n++;
    else if (x.date === today) continue;
    else break;
  }
  return n;
}
