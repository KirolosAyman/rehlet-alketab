import { assertEquals, test } from './_testkit.ts';
import { rankBoard, studentStats } from './stats.ts';
import { buildReview } from './review.ts';

test('stats: stars, done, streak incl. authored', () => {
  const q = (id: string, d: string, author: string | null = null) => ({ id, quiz_date: d, author_id: author, status: 'published', created_at: d });
  const quizzes = [q('a', '2026-11-16'), q('b', '2026-11-17', 's1'), q('c', '2026-11-18')];
  const attempts = [{ student_id: 's1', quiz_id: 'a', stars: 7, correct: 5, total: 5, created_at: '' }];
  const s = studentStats('s1', quizzes, attempts, '2026-11-18');
  assertEquals([s.stars, s.done, s.streak, s.level], [7, 1, 2, 'بذرة']);
});
test('board: ties share rank', () => {
  const r = rankBoard([{ id: '1', name: 'ا', stars: 5, streak: 1 }, { id: '2', name: 'ب', stars: 9, streak: 0 }, { id: '3', name: 'ج', stars: 5, streak: 1 }]);
  assertEquals(r.map((x) => x.rank), [1, 2, 2]);
});
test('review: essay pending shows null correctness and model answer', () => {
  const r = buildReview([{ type: 'essay', q: 'س', options: [], answer: 0, model: 'م', grading: 'manual' }], ['ج'], []);
  assertEquals([r[0]!.correct, r[0]!.model, r[0]!.essay?.status], [null, 'م', 'pending']);
});
