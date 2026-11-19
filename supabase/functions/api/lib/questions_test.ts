import { assert, assertEquals, test } from './_testkit.ts';
import { shuffleOptions, toPublic, validateQuestion, validateQuestions } from './questions.ts';

const fail = (raw: unknown, part: string) => {
  const r = validateQuestion(raw, 3);
  assert(!r.ok, 'expected failure');
  if (!r.ok) {
    assert(r.message.startsWith('السؤال رقم ٣'), 'message names question number: ' + r.message);
    assert(r.message.includes(part), `"${r.message}" should include "${part}"`);
  }
};

test('validation: messages', () => {
  fail(null, 'غير صالحة');
  fail({ type: 'x', q: 'a' }, 'نوع السؤال');
  fail({ type: 'mcq', q: '  ' }, 'نص السؤال');
  fail({ type: 'mcq', q: 'x'.repeat(1001), options: ['a', 'b'], answer: 0 }, 'أطول');
  fail({ type: 'mcq', q: 'س', options: ['a'], answer: 0 }, 'عدد الاختيارات');
  fail({ type: 'mcq', q: 'س', options: ['a', 'b', 'c', 'd', 'e'], answer: 0 }, 'عدد الاختيارات');
  fail({ type: 'mcq', q: 'س', options: ['a', ' '], answer: 0 }, 'فاضي');
  fail({ type: 'mcq', q: 'س', options: ['a', 'a'], answer: 0 }, 'متكرر');
  fail({ type: 'mcq', q: 'س', options: ['a', 'b'], answer: 2 }, 'الإجابة الصحيحة');
  fail({ type: 'fill', q: 'بدون فراغ', options: ['a', 'b'], answer: 0 }, '______');
  fail({ type: 'tf', q: 'س', answer: 3 }, 'صح أو خطأ');
});

test('validation: tf gets automatic options', () => {
  const r = validateQuestion({ type: 'tf', q: 'جملة', options: ['x'], answer: 1 }, 1);
  assert(r.ok);
  if (r.ok) assertEquals(r.question.options, ['صح', 'خطأ']);
});

test('validation: essay requires model', () => {
  fail({ type: 'essay', q: 'اكتب' }, 'إجابة نموذجية');
});

test('validation: essay grading default ai, manual allowed, other rejected', () => {
  const a = validateQuestion({ type: 'essay', q: 'اكتب', model: 'م' }, 1);
  assert(a.ok && a.question.grading === 'ai');
  const m = validateQuestion({ type: 'essay', q: 'اكتب', model: 'م', grading: 'manual' }, 1);
  assert(m.ok && m.question.grading === 'manual');
  fail({ type: 'essay', q: 'اكتب', model: 'م', grading: 'robot' }, 'طريقة التصحيح');
});

test('validation: grading stripped from non-essay', () => {
  const r = validateQuestion({ type: 'mcq', q: 'س', options: ['a', 'b'], answer: 0, grading: 'manual' }, 1);
  assert(r.ok && !('grading' in r.question));
});

test('validation: max 30 questions', () => {
  const q = { type: 'tf', q: 'س', answer: 0 };
  assert(validateQuestions(Array(30).fill(q)).ok);
  const r = validateQuestions(Array(31).fill(q));
  assert(!r.ok && r.message.includes('٣٠'));
});

test('validation: list reports the failing index', () => {
  const r = validateQuestions([{ type: 'tf', q: 'س', answer: 0 }, { type: 'mcq', q: '' }]);
  assert(!r.ok && r.index === 1 && r.message.includes('رقم ٢'));
});

test('public payload never has answer/model/grading', () => {
  const p = toPublic({ type: 'essay', q: 'س', options: [], answer: 0, model: 'سر', grading: 'ai' });
  assertEquals(Object.keys(p).sort(), ['options', 'q', 'type']);
});

test('shuffle keeps the correct answer; tf untouched', () => {
  const q = { type: 'mcq' as const, q: 'س', options: ['a', 'b', 'c', 'd'], answer: 2 };
  let seed = 7;
  const rng = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (let k = 0; k < 20; k++) {
    const s = shuffleOptions(q, rng);
    assertEquals(s.options[s.answer], 'c');
  }
  const tf = { type: 'tf' as const, q: 'س', options: ['صح', 'خطأ'], answer: 1 };
  assertEquals(shuffleOptions(tf, rng), tf);
});
