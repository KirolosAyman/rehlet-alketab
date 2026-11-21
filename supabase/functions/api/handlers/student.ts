// Student read/write path: home, get_quiz, submit.
import type { Ctx } from '../lib/context.ts';
import type { AssignmentRow, AttemptFull, BookRow, QuizFull } from '../lib/rows.ts';
import type { QuizRow } from '../lib/stats.ts';
import type { Answer } from '../lib/scoring.ts';
import { fetchAll, getSetting, isUniqueViolation, must } from '../lib/db.ts';
import { ApiError, conflict, notFound } from '../lib/http.ts';
import { id } from '../lib/input.ts';
import { quizState } from '../lib/quizState.ts';
import type { QuizState } from '../lib/quizState.ts';
import { toPublic } from '../lib/questions.ts';
import { buildReview } from '../lib/review.ts';
import { score } from '../lib/scoring.ts';
import { rankBoard, studentStats } from '../lib/stats.ts';
import { requireStudent } from '../lib/session.ts';
import { normalizeTime } from '../lib/time.ts';
import { gradeEssays } from '../lib/ai/essay.ts';
import { makeProvider } from '../lib/ai/config.ts';
import { loadAiConfig } from '../lib/aiConfig.ts';
import { arDigits } from '../lib/digits.ts';

type QuizMeta = QuizRow & { book: string; chapter: string; opens_at: string | null };
const META = 'id, quiz_date, book, chapter, opens_at, status, author_id, created_at';

const meta = (q: QuizMeta) => ({ id: q.id, date: q.quiz_date, book: q.book, chapter: q.chapter, opensAt: normalizeTime(q.opens_at) });

export async function home(ctx: Ctx) {
  const sid = await requireStudent(ctx.db, ctx.token);
  const { db, now } = ctx;
  const [me, published, attempts, unlocks, assignments, boardOpen, openBooksRows] = await Promise.all([
    db.from('students').select('display_name').eq('id', sid).maybeSingle(),
    fetchAll<QuizMeta>((f, t) => db.from('quizzes').select(META).eq('status', 'published').order('quiz_date').range(f, t), 'home.quizzes'),
    fetchAll<{ quiz_id: string; correct: number; total: number; stars: number; created_at: string; student_id: string }>(
      (f, t) => db.from('attempts').select('quiz_id, student_id, correct, total, stars, created_at').eq('student_id', sid).range(f, t),
      'home.attempts',
    ),
    db.from('quiz_unlocks').select('quiz_id').eq('student_id', sid),
    db.from('assignments').select('id, book, chapter, day, status, questions, submitted_at').eq('student_id', sid).order('day', { ascending: false }),
    getSetting<boolean>(db, 'leaderboard_public', false),
    fetchAll<BookRow>((f, t) => db.from('books').select('id, name, testament, chapters, sort_order').eq('board_open', true).order('sort_order').range(f, t), 'home.openBooks'),
  ]);
  const meRow = must<{ display_name: string } | null>(me, 'home.me');
  if (!meRow) throw new ApiError('unauthorized', 'الحساب ده اتمسح. كلّم الخادم.', 401);

  // Include quizzes the student attempted that are no longer published (rare: moved back to draft).
  const known = new Set(published.map((q) => q.id));
  const missingIds = attempts.map((a) => a.quiz_id).filter((x) => !known.has(x));
  const extra = missingIds.length
    ? must<QuizMeta[]>(await db.from('quizzes').select(META).in('id', missingIds), 'home.extra')
    : [];

  const unlocked = new Set(must<{ quiz_id: string }[]>(unlocks, 'home.unlocks').map((u) => u.quiz_id));
  const byQuiz = new Map(attempts.map((a) => [a.quiz_id, a]));
  const quizzes = [...published, ...extra]
    .map((q) => {
      const a = byQuiz.get(q.id);
      const state: QuizState = quizState({
        status: q.status, quizDate: q.quiz_date, opensAt: q.opens_at, authorId: q.author_id,
        studentId: sid, hasAttempt: !!a, unlocked: unlocked.has(q.id), now,
      });
      return { ...meta(q), state, result: a ? { correct: a.correct, total: a.total, stars: a.stars } : null };
    })
    .filter((q) => q.state !== 'hidden')
    .sort((a, b) => b.date.localeCompare(a.date));

  const stats = studentStats(sid, published, attempts, now.date);

  const myAssignments = must<Omit<AssignmentRow, 'student_id' | 'quiz_id' | 'created_at'>[]>(assignments, 'home.assign')
    .filter((x) => x.day <= now.date)
    .map((x) => ({ id: x.id, book: x.book, chapter: x.chapter, day: x.day, status: x.status, questions: x.questions, submittedAt: x.submitted_at }));

  let board = null;
  if (boardOpen === true) {
    const [students, all] = await Promise.all([
      fetchAll<{ id: string; display_name: string }>((f, t) => db.from('students').select('id, display_name').range(f, t), 'board.students'),
      fetchAll<{ student_id: string; quiz_id: string; stars: number; correct: number; total: number; created_at: string }>(
        (f, t) => db.from('attempts').select('student_id, quiz_id, stars, correct, total, created_at').range(f, t),
        'board.attempts',
      ),
    ]);
    board = rankBoard(
      students.map((s) => {
        const st = studentStats(s.id, published, all, now.date);
        return { id: s.id, name: s.display_name, stars: st.stars, streak: st.streak };
      }),
    ).map((r) => ({ rank: r.rank, name: r.name, stars: r.stars, streak: r.streak, me: r.id === sid }));
  }

  const openBooks = (openBooksRows ?? []).map((b) => ({
    id: b.id,
    name: b.name,
    testament: b.testament,
    chapters: b.chapters,
  }));

  return { me: { name: meRow.display_name }, today: now.date, stats, quizzes, assignments: myAssignments, board, openBooks };
}

async function loadForStudent(ctx: Ctx, sid: string, quizId: string) {
  const [q, a, u] = await Promise.all([
    ctx.db.from('quizzes').select('*').eq('id', quizId).maybeSingle(),
    ctx.db.from('attempts').select('*').eq('student_id', sid).eq('quiz_id', quizId).maybeSingle(),
    ctx.db.from('quiz_unlocks').select('quiz_id').eq('student_id', sid).eq('quiz_id', quizId).maybeSingle(),
  ]);
  const quiz = must<QuizFull | null>(q, 'quiz');
  const attempt = must<AttemptFull | null>(a, 'attempt');
  const unlock = must<unknown>(u, 'unlock');
  if (!quiz) throw notFound('الاختبار ده مش موجود.');
  const state = quizState({
    status: quiz.status, quizDate: quiz.quiz_date, opensAt: quiz.opens_at, authorId: quiz.author_id,
    studentId: sid, hasAttempt: !!attempt, unlocked: !!unlock, now: ctx.now,
  });
  return { quiz, attempt, state };
}

function stateError(state: QuizState, opensAt: string | null): ApiError {
  switch (state) {
    case 'author':
      return new ApiError('author', 'إنت اللي كتبت أسئلة الاختبار ده، فمش هتمتحنه. شكرًا على تعبك! 🌱', 403);
    case 'waiting':
      return new ApiError('waiting', `الاختبار هيفتح الساعة ${arDigits(opensAt ?? '')} النهارده.`, 403);
    case 'missed':
      return new ApiError('missed', 'معاد الاختبار ده فات. اطلب من الخادم يفتحهولك.', 403);
    default:
      return notFound('الاختبار ده مش متاح دلوقتي.');
  }
}

function doneView(quiz: QuizFull, a: AttemptFull) {
  return {
    state: 'done',
    quiz: meta(quiz),
    result: { correct: a.correct, total: a.total, stars: a.stars, perfect: a.total > 0 && a.correct === a.total },
    review: buildReview(a.questions_snapshot, a.answers, a.essay),
  };
}

export async function getQuiz(ctx: Ctx) {
  const sid = await requireStudent(ctx.db, ctx.token);
  const { quiz, attempt, state } = await loadForStudent(ctx, sid, id(ctx.body, 'quiz_id'));
  if (state === 'done' && attempt) return doneView(quiz, attempt);
  if (state !== 'open') throw stateError(state, normalizeTime(quiz.opens_at));
  return { state: 'open', quiz: meta(quiz), questions: quiz.questions.map(toPublic) };
}

const MAX_ESSAY = 3000;

export async function submit(ctx: Ctx) {
  const sid = await requireStudent(ctx.db, ctx.token);
  const { quiz, state } = await loadForStudent(ctx, sid, id(ctx.body, 'quiz_id'));
  if (state === 'done') throw conflict('already_submitted', 'إنت حليت الاختبار ده قبل كده. تقدر تشوف إجاباتك من "سجلي".');
  if (state !== 'open') throw stateError(state, normalizeTime(quiz.opens_at));

  const qs = quiz.questions;
  const raw = ctx.body.answers;
  if (!Array.isArray(raw) || raw.length !== qs.length) throw new ApiError('bad_input', 'الإجابات ناقصة. جاوب على كل الأسئلة.');
  const answers: Answer[] = qs.map((q, i) => {
    const a = raw[i];
    if (q.type === 'essay') {
      if (typeof a !== 'string' || !a.trim()) throw new ApiError('bad_input', `جاوب على السؤال رقم ${arDigits(i + 1)}.`);
      if (a.length > MAX_ESSAY) throw new ApiError('bad_input', `إجابة السؤال رقم ${arDigits(i + 1)} طويلة قوي.`);
      return a.trim();
    }
    if (typeof a !== 'number' || !Number.isInteger(a) || a < 0 || a >= q.options.length)
      throw new ApiError('bad_input', `اختار إجابة للسؤال رقم ${arDigits(i + 1)}.`);
    return a;
  });

  const hasAiEssay = qs.some((q) => q.type === 'essay' && (q.grading ?? 'ai') === 'ai');
  const provider = hasAiEssay ? makeProvider(await loadAiConfig(ctx.db)) : null;
  const { verdicts, error } = await gradeEssays(provider, qs, answers);
  if (error) console.warn('[submit] essay grading deferred:', error.code);
  const s = score(qs, answers, verdicts);

  const ins = await ctx.db
    .from('attempts')
    .insert({ student_id: sid, quiz_id: quiz.id, answers, questions_snapshot: qs, essay: verdicts, ...s })
    .select('*')
    .single();
  if (isUniqueViolation(ins.error)) throw conflict('already_submitted', 'إنت حليت الاختبار ده قبل كده.');
  const attempt = must<AttemptFull>(ins, 'submit.insert');
  return doneView(quiz, attempt);
}

export async function bookBoard(ctx: Ctx) {
  const sid = await requireStudent(ctx.db, ctx.token);
  const bid = id(ctx.body, 'book_id');
  const book = must<BookRow | null>(await ctx.db.from('books').select('*').eq('id', bid).maybeSingle(), 'bb.book');
  if (!book) throw notFound('السفر ده مش موجود.');
  if (!book.board_open) throw new ApiError('board_closed', 'ترتيب السفر ده مقفول دلوقتي.', 400);

  const [quizzes, students] = await Promise.all([
    fetchAll<{ id: string }>((f, t) => ctx.db.from('quizzes').select('id').or(`book_id.eq."${bid}",book.eq."${book.name}"`).eq('status', 'published').range(f, t), 'bb.quizzes'),
    fetchAll<{ id: string; display_name: string }>((f, t) => ctx.db.from('students').select('id, display_name').range(f, t), 'bb.students'),
  ]);

  const quizIds = quizzes.map((q) => q.id);
  let attempts: { student_id: string; quiz_id: string; stars: number }[] = [];
  if (quizIds.length > 0) {
    attempts = await fetchAll<{ student_id: string; quiz_id: string; stars: number }>(
      (f, t) => ctx.db.from('attempts').select('student_id, quiz_id, stars').in('quiz_id', quizIds).range(f, t),
      'bb.attempts',
    );
  }

  const byStudent = new Map<string, { stars: number; done: Set<string> }>();
  for (const s of students) byStudent.set(s.id, { stars: 0, done: new Set() });
  for (const a of attempts) {
    const entry = byStudent.get(a.student_id);
    if (entry) {
      entry.stars += a.stars;
      entry.done.add(a.quiz_id);
    }
  }

  const boardRows = rankBoard(
    students.map((s) => {
      const entry = byStudent.get(s.id) ?? { stars: 0, done: new Set() };
      return { id: s.id, name: s.display_name, stars: entry.stars, streak: entry.done.size };
    }),
  ).map((r) => ({ rank: r.rank, name: r.name, stars: r.stars, streak: r.streak, me: r.id === sid }));

  return {
    book: { id: book.id, name: book.name, chapters: book.chapters },
    board: boardRows,
  };
}

export async function booksList(ctx: Ctx) {
  const books = await fetchAll<BookRow>((f, t) => ctx.db.from('books').select('*').order('sort_order').range(f, t), 'student.booksList');
  return {
    books: books.map((b) => ({
      id: b.id,
      testament: b.testament,
      name: b.name,
      chapters: b.chapters,
      sortOrder: b.sort_order,
      boardOpen: b.board_open,
    })),
  };
}
