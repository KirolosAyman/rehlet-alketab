import { assertEquals, test } from './_testkit.ts';
import type { QuizStateInput } from './quizState.ts';
import { quizState } from './quizState.ts';
import { cairoNow } from './time.ts';

const base: QuizStateInput = {
  status: 'published', quizDate: '2026-11-18', opensAt: null, authorId: null, studentId: 's1',
  hasAttempt: false, unlocked: false, now: { date: '2026-11-18', time: '12:00' },
};
const s = (p: Partial<QuizStateInput>) => quizState({ ...base, ...p });

test('state: done wins over everything', () => assertEquals(s({ hasAttempt: true, status: 'draft' }), 'done'));
test('state: draft → hidden', () => assertEquals(s({ status: 'draft' }), 'hidden'));
test('state: author', () => assertEquals(s({ authorId: 's1' }), 'author'));
test('state: today, open from midnight through the end of the day', () => {
  assertEquals(s({ opensAt: '19:00:00', now: { date: '2026-11-18', time: '00:00' } }), 'open');
  assertEquals(s({ opensAt: '19:00:00', now: { date: '2026-11-18', time: '23:59' } }), 'open');
});
test('state: past + unlocked → open', () => assertEquals(s({ quizDate: '2026-11-17', unlocked: true }), 'open'));
test('state: past, not unlocked → missed', () => assertEquals(s({ quizDate: '2026-11-17' }), 'missed'));
test('state: future → hidden', () => assertEquals(s({ quizDate: '2026-11-19' }), 'hidden'));

test('Cairo day boundary: 21:59Z on Nov 17 is still Nov 17 23:59 in Cairo (UTC+2, winter)', () => {
  assertEquals(cairoNow(new Date('2026-11-17T21:59:00Z')), { date: '2026-11-17', time: '23:59' });
});
test('Cairo day boundary: 22:00Z on Nov 17 is Nov 18 00:00 in Cairo', () => {
  const now = cairoNow(new Date('2026-11-17T22:00:00Z'));
  assertEquals(now, { date: '2026-11-18', time: '00:00' });
  assertEquals(s({ now, quizDate: '2026-11-17' }), 'missed');
  assertEquals(s({ now }), 'open');
});
