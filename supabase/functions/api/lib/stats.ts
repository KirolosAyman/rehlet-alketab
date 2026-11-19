// Per-student stats from raw rows (shared by home, dashboard, leaderboard).
import { computeStreak, levelInfo } from './scoring.ts';

export interface QuizRow { id: string; quiz_date: string; author_id: string | null; status: string; created_at: string }
export interface AttemptRow { student_id: string; quiz_id: string; stars: number; correct: number; total: number; created_at: string }

export function studentStats(studentId: string, quizzes: QuizRow[], attempts: AttemptRow[], today: string) {
  const mine = attempts.filter((a) => a.student_id === studentId);
  const done = new Set(mine.map((a) => a.quiz_id));
  const stars = mine.reduce((s, a) => s + a.stars, 0);
  const streak = computeStreak(
    quizzes
      .filter((q) => q.status === 'published')
      .map((q) => ({ date: q.quiz_date, order: q.created_at, done: done.has(q.id) || q.author_id === studentId })),
    today,
  );
  return { stars, streak, done: mine.length, ...levelInfo(stars) };
}

export interface BoardRow { id: string; name: string; stars: number; streak: number }
/** Competition ranking (1,1,3) by stars, then streak. */
export function rankBoard(rows: BoardRow[]) {
  const sorted = [...rows].sort((a, b) => b.stars - a.stars || b.streak - a.streak || a.name.localeCompare(b.name, 'ar'));
  return sorted.map((r, i) => {
    let rank = i + 1;
    for (let j = i - 1; j >= 0 && sorted[j]!.stars === r.stars && sorted[j]!.streak === r.streak; j--) rank = j + 1;
    return { rank, ...r };
  });
}
