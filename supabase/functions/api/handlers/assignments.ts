// Student-authored questions (spec §10.3). No AI anywhere in this flow.
import type { Ctx } from '../lib/context.ts';
import type { AssignmentRow } from '../lib/rows.ts';
import { must } from '../lib/db.ts';
import { ApiError, conflict, notFound } from '../lib/http.ts';
import { bool, date, id, optId, str } from '../lib/input.ts';
import { validateQuestions } from '../lib/questions.ts';
import { requireAdmin, requireStudent } from '../lib/session.ts';
import { addDays } from '../lib/time.ts';

export async function assignSave(ctx: Ctx) {
  const sid = await requireStudent(ctx.db, ctx.token);
  const aid = id(ctx.body, 'id');
  const submit = bool(ctx.body, 'submit');
  const a = must<AssignmentRow | null>(await ctx.db.from('assignments').select('*').eq('id', aid).eq('student_id', sid).maybeSingle(), 'as.load');
  if (!a) throw notFound('التكليف ده مش موجود.');
  if (a.status !== 'open') throw conflict('locked', 'الأسئلة اتبعتت للخادم خلاص. لو محتاج تعدّل، اطلب منه يفتحهالك.');
  // Students cannot choose grading mode; strip it (D-010 → defaults to 'ai', admin can change).
  const raw = Array.isArray(ctx.body.questions)
    ? ctx.body.questions.map((q) => (q && typeof q === 'object' ? { ...(q as Record<string, unknown>), grading: undefined } : q))
    : ctx.body.questions;
  const v = validateQuestions(raw);
  if (!v.ok) throw new ApiError('invalid_question', v.message, 400);
  if (submit && v.questions.length === 0) throw new ApiError('bad_input', 'اكتب سؤال واحد على الأقل قبل الإرسال.');
  const row = must(
    await ctx.db.from('assignments')
      .update({ questions: v.questions, ...(submit ? { status: 'submitted', submitted_at: new Date().toISOString() } : {}) })
      .eq('id', aid).eq('status', 'open').select('id').maybeSingle(),
    'as.save',
  );
  if (!row) throw conflict('locked', 'الأسئلة اتبعتت خلاص.');
  return { status: submit ? 'submitted' : 'open' };
}

export async function assignCreate(ctx: Ctx) {
  await requireAdmin(ctx.db, ctx.token);
  const row = {
    student_id: id(ctx.body, 'student_id'),
    book_id: optId(ctx.body, 'book_id'),
    book: str(ctx.body, 'book', 'اسم السفر', 100),
    chapter: str(ctx.body, 'chapter', 'رقم الأصحاح', 50),
    day: date(ctx.body, 'day', 'يوم الكتابة'),
  };
  const res = await ctx.db.from('assignments').insert(row).select('id').single();
  if (res.error?.code === '23503') throw notFound('المخدوم ده مش موجود.');
  return { id: must<{ id: string }>(res, 'ac.insert').id };
}

export async function assignDelete(ctx: Ctx) {
  await requireAdmin(ctx.db, ctx.token);
  must(await ctx.db.from('assignments').delete().eq('id', id(ctx.body, 'id')), 'ad');
  return {};
}

export async function assignReopen(ctx: Ctx) {
  await requireAdmin(ctx.db, ctx.token);
  const row = must(await ctx.db.from('assignments').update({ status: 'open', submitted_at: null }).eq('id', id(ctx.body, 'id')).select('id').maybeSingle(), 'ar');
  if (!row) throw notFound();
  return {};
}

/** Idempotent: a second call returns the same quiz. */
export async function assignToQuiz(ctx: Ctx) {
  await requireAdmin(ctx.db, ctx.token);
  const aid = id(ctx.body, 'id');
  const a = must<AssignmentRow | null>(await ctx.db.from('assignments').select('*').eq('id', aid).maybeSingle(), 'atq.load');
  if (!a) throw notFound();
  if (a.quiz_id) return { quizId: a.quiz_id, existed: true };
  if (a.status !== 'submitted') throw conflict('not_submitted', 'المخدوم لسه ما بعتش الأسئلة.');
  const v = validateQuestions(a.questions);
  if (!v.ok) throw new ApiError('invalid_question', v.message, 400);
  const quiz_date = ctx.body.quiz_date ? date(ctx.body, 'quiz_date') : addDays(a.day, 1);
  const quiz = must<{ id: string }>(
    await ctx.db.from('quizzes').insert({ quiz_date, book: a.book, book_id: a.book_id, chapter: a.chapter, status: 'draft', author_id: a.student_id, questions: v.questions }).select('id').single(),
    'atq.insert',
  );
  const linked = must(await ctx.db.from('assignments').update({ quiz_id: quiz.id }).eq('id', aid).is('quiz_id', null).select('id').maybeSingle(), 'atq.link');
  if (!linked) {
    // Lost a race with a parallel click: discard ours, return the winner.
    await ctx.db.from('quizzes').delete().eq('id', quiz.id);
    const again = must<{ quiz_id: string | null } | null>(await ctx.db.from('assignments').select('quiz_id').eq('id', aid).maybeSingle(), 'atq.reload');
    return { quizId: again?.quiz_id ?? null, existed: true };
  }
  return { quizId: quiz.id, existed: false };
}
