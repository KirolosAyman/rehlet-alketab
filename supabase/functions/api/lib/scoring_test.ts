import { assertEquals, test } from './_testkit.ts';
import type { Question } from './questions.ts';
import type { EssayVerdict } from './scoring.ts';
import { computeStreak, levelInfo, score } from './scoring.ts';

const mcq = (answer = 0): Question => ({ type: 'mcq', q: 'س', options: ['أ', 'ب', 'ج'], answer });
const five = [mcq(), mcq(), mcq(), mcq(), mcq()];

test('scoring: 5/5 → 7 stars (bonus)', () => {
  assertEquals(score(five, [0, 0, 0, 0, 0], []), { correct: 5, total: 5, stars: 7 });
});
test('scoring: 4/5 → 4 stars', () => {
  assertEquals(score(five, [0, 0, 0, 0, 1], []).stars, 4);
});
test('scoring: 0/5 → 0', () => {
  assertEquals(score(five, [1, 1, 1, 1, 1], []).stars, 0);
});
test('scoring: total 0 → 0, no bonus', () => {
  assertEquals(score([], [], []), { correct: 0, total: 0, stars: 0 });
});

const essayQ: Question = { type: 'essay', q: 'اكتب', options: [], answer: 0, model: 'نموذج', grading: 'ai' };
const manualQ: Question = { ...essayQ, grading: 'manual' };
test('scoring: essay pending not counted', () => {
  const v: EssayVerdict[] = [{ i: 1, status: 'pending', note: '', by: null }];
  assertEquals(score([mcq(), essayQ], [0, 'x'], v), { correct: 1, total: 2, stars: 1 });
});
test('scoring: admin override recomputes (pending → ok gives perfect bonus)', () => {
  const v: EssayVerdict[] = [{ i: 1, status: 'ok', note: '', by: 'admin' }];
  assertEquals(score([mcq(), essayQ], [0, 'x'], v), { correct: 2, total: 2, stars: 4 });
});
test('scoring: admin override ok → no removes star', () => {
  const v: EssayVerdict[] = [{ i: 1, status: 'no', note: '', by: 'admin' }];
  assertEquals(score([mcq(), essayQ], [0, 'x'], v).stars, 1);
});
test('scoring: mixed ai/manual essays', () => {
  const v: EssayVerdict[] = [
    { i: 0, status: 'ok', note: '', by: 'ai' },
    { i: 1, status: 'pending', note: '', by: null },
  ];
  assertEquals(score([essayQ, manualQ], ['a', 'b'], v), { correct: 1, total: 2, stars: 1 });
});

test('levels by stars', () => {
  const cases: [number, string][] = [[0, 'بذرة'], [9, 'بذرة'], [10, 'نبتة'], [25, 'غصن'], [50, 'شجرة'], [100, 'كرمة'], [150, 'كرمة']];
  for (const [s, name] of cases) assertEquals(levelInfo(s).level, name, `stars=${s}`);
});
test('level progress and stars left', () => {
  const l = levelInfo(15);
  assertEquals([l.nextLevel, l.nextLevelAt, l.starsLeft], ['غصن', 25, 10]);
  assertEquals(levelInfo(150).nextLevelAt, null);
});

const T = '2026-11-18';
test('streak: consecutive done', () => {
  assertEquals(computeStreak([{ date: '2026-11-16', done: true }, { date: '2026-11-17', done: true }, { date: T, done: true }], T), 3);
});
test('streak: today undone does not break', () => {
  assertEquals(computeStreak([{ date: '2026-11-16', done: true }, { date: '2026-11-17', done: true }, { date: T, done: false }], T), 2);
});
test('streak: earlier gap breaks', () => {
  assertEquals(computeStreak([{ date: '2026-11-15', done: true }, { date: '2026-11-16', done: false }, { date: '2026-11-17', done: true }], T), 1);
});
test('streak: authored quiz counts (done=true)', () => {
  assertEquals(computeStreak([{ date: '2026-11-16', done: true }, { date: '2026-11-17', done: true }], T), 2);
});
test('streak: future quizzes ignored', () => {
  assertEquals(computeStreak([{ date: '2026-11-19', done: false }, { date: '2026-11-17', done: true }], T), 1);
});
