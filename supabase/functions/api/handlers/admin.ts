// Admin actions. index.ts already verified the admin session; each handler re-checks (defense in depth).
import type { Ctx } from '../lib/context.ts';
import type { AttemptFull, QuizFull, StudentRow } from '../lib/rows.ts';
import type { EssayVerdict } from '../lib/scoring.ts';
import { fetchAll, getSetting, isUniqueViolation, must, setSetting } from '../lib/db.ts';
import { ApiError, badInput, conflict, notFound } from '../lib/http.ts';
import { bool, date, id, ids, int, oneOf, optId, optTime, str } from '../lib/input.ts';
import { normalizeUsername } from '../lib/normalize.ts';
import { validateQuestions } from '../lib/questions.ts';
import { score } from '../lib/scoring.ts';
import { studentStats } from '../lib/stats.ts';
import { requireAdmin } from '../lib/session.ts';
import { ipKey, rateLimit } from '../lib/ratelimit.ts';
import { arDigits } from '../lib/digits.ts';
import { normalizeTime } from '../lib/time.ts';
import { aiEligible, gradeEssays } from '../lib/ai/essay.ts';
import { generateQuestions } from '../lib/ai/generate.ts';
import { DEFAULT_MODEL, makeProvider, maskKey, MODEL_RE } from '../lib/ai/config.ts';
import { AI_MESSAGES, AiError } from '../lib/ai/provider.ts';
import { TEST_SCHEMA } from '../lib/ai/prompts.ts';
import { aiToApiError, loadAiConfig } from '../lib/aiConfig.ts';

type QuizLite = Omit<QuizFull, 'questions'> & { questions: { type: string }[] };
type AttemptLite = Pick<AttemptFull, 'id' | 'student_id' | 'quiz_id' | 'correct' | 'total' | 'stars' | 'created_at' | 'essay'>;

// ---------------- dashboard ----------------
export async function dashboard(ctx: Ctx) {
  await requireAdmin(ctx.db, ctx.token);
  const { db, now } = ctx;
  const [students, quizzes, attempts, unlocks, assigns, boardOpen, maxPerDay] = await Promise.all([
    fetchAll<StudentRow>((f, t) => db.from('students').select('id, username, display_name, pass_hash, locked_until, created_at').order('created_at').range(f, t), 'd.students'),
    fetchAll<QuizLite>((f, t) => db.from('quizzes').select('id, quiz_date, book, chapter, opens_at, status, author_id, created_at, questions').order('quiz_date', { ascending: false }).range(f, t), 'd.quizzes'),
    fetchAll<AttemptLite>((f, t) => db.from('attempts').select('id, student_id, quiz_id, correct, total, stars, created_at, essay').range(f, t), 'd.attempts'),
    fetchAll<{ quiz_id: string }>((f, t) => db.from('quiz_unlocks').select('quiz_id').range(f, t), 'd.unlocks'),
    fetchAll<{ id: string; student_id: string; book: string; chapter: string; day: string; status: string; questions: unknown[]; quiz_id: string | null; submitted_at: string | null }>(
      (f, t) => db.from('assignments').select('id, student_id, book, chapter, day, status, questions, quiz_id, submitted_at').order('day', { ascending: false }).range(f, t),
      'd.assign',
    ),
    getSetting<boolean>(db, 'leaderboard_public', false),
    getSetting<number>(db, 'max_published_per_day', 1),
  ]);
  const name = new Map(students.map((s) => [s.id, s.display_name]));
  const todayQuizIds = new Set(quizzes.filter((q) => q.status === 'published' && q.quiz_date === now.date).map((q) => q.id));
  const pendingOf = (a: AttemptLite) => (a.essay ?? []).filter((e) => e.status === 'pending').length;

  const studentRows = students.map((s) => {
    const st = studentStats(s.id, quizzes, attempts, now.date);
    const today = attempts.filter((a) => a.student_id === s.id && todayQuizIds.has(a.quiz_id));
    return {
      id: s.id, username: s.username, name: s.display_name,
      activated: !!s.pass_hash,
      locked: !!s.locked_until && new Date(s.locked_until).getTime() > Date.now(),
      stars: st.stars, streak: st.streak, done: st.done, level: st.level,
      today: today.length ? { correct: today.reduce((n, a) => n + a.correct, 0), total: today.reduce((n, a) => n + a.total, 0) } : null,
    };
  });

  const unlockCount = new Map<string, number>();
  for (const u of unlocks) unlockCount.set(u.quiz_id, (unlockCount.get(u.quiz_id) ?? 0) + 1);

  const quizRows = quizzes.map((q) => {
    const at = attempts.filter((a) => a.quiz_id === q.id);
    const avg = at.length ? at.reduce((n, a) => n + (a.total ? a.correct / a.total : 0), 0) / at.length : null;
    return {
      id: q.id, date: q.quiz_date, opensAt: normalizeTime(q.opens_at), book: q.book, chapter: q.chapter, status: q.status,
      author: q.author_id ? name.get(q.author_id) ?? null : null,
      questionCount: q.questions.length, attempts: at.length, avg,
      unlocked: unlockCount.get(q.id) ?? 0,
      pendingEssays: at.reduce((n, a) => n + pendingOf(a), 0),
    };
  });

  const assignmentRows = assigns.map((a) => ({
    id: a.id, studentId: a.student_id, student: name.get(a.student_id) ?? '—', book: a.book, chapter: a.chapter, day: a.day,
    status: a.status, questionCount: a.questions.length, quizId: a.quiz_id, submittedAt: a.submitted_at,
  }));

  return {
    today: now.date,
    counts: {
      students: students.length,
      finishedToday: new Set(attempts.filter((a) => todayQuizIds.has(a.quiz_id)).map((a) => a.student_id)).size,
      waitingAssignments: assigns.filter((a) => a.status === 'submitted' && !a.quiz_id).length,
      pendingEssays: attempts.reduce((n, a) => n + pendingOf(a), 0),
    },
    students: studentRows,
    quizzes: quizRows,
    assignments: assignmentRows,
    leaderboardPublic: boardOpen === true,
    maxPerDay,
  };
}

// ---------------- students ----------------
const SPLIT = /[,،\t]/;

export async function studentsAdd(ctx: Ctx) {
  await requireAdmin(ctx.db, ctx.token);
  const text = str(ctx.body, 'lines', 'الأسماء', 20_000);
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) throw badInput('اكتب اسم واحد على الأقل.');
  if (lines.length > 200) throw badInput('أقصى عدد ٢٠٠ اسم في المرة.');
  const rows = lines.map((line, i) => {
    const [u = '', ...rest] = line.split(SPLIT);
    const username = u.trim().replace(/\s+/g, ' ');
    const display = rest.join(' ').trim() || username;
    const n = arDigits(i + 1);
    if (!username) throw badInput(`السطر ${n}: اسم المستخدم فاضي.`);
    if (username.length > 60 || display.length > 80) throw badInput(`السطر ${n}: الاسم طويل قوي.`);
    return { username, display_name: display, username_norm: normalizeUsername(username), line: i + 1 };
  });
  const seen = new Map<string, number>();
  for (const r of rows) {
    const prev = seen.get(r.username_norm);
    if (prev) throw badInput(`السطر ${arDigits(r.line)}: "${r.username}" متكرر مع السطر ${arDigits(prev)}.`);
    seen.set(r.username_norm, r.line);
  }
  const existing = must<{ username: string; username_norm: string }[]>(
    await ctx.db.from('students').select('username, username_norm').in('username_norm', rows.map((r) => r.username_norm)),
    'add.existing',
  );
  if (existing.length) {
    const r = rows.find((x) => x.username_norm === existing[0]!.username_norm)!;
    throw conflict('duplicate', `السطر ${arDigits(r.line)}: اسم المستخدم "${r.username}" موجود قبل كده (${existing[0]!.username}).`);
  }
  const ins = await ctx.db.from('students').insert(rows.map(({ line: _l, ...r }) => r)).select('id');
  if (isUniqueViolation(ins.error)) throw conflict('duplicate', 'فيه اسم مستخدم موجود قبل كده. راجع القائمة.');
  return { added: must<unknown[]>(ins, 'add.insert').length };
}

export async function studentUpdate(ctx: Ctx) {
  await requireAdmin(ctx.db, ctx.token);
  const sid = id(ctx.body, 'id');
  const username = str(ctx.body, 'username', 'اسم المستخدم', 60).replace(/\s+/g, ' ');
  const display = str(ctx.body, 'display_name', 'الاسم الظاهر', 80, { optional: true }) || username;
  const res = await ctx.db.from('students')
    .update({ username, username_norm: normalizeUsername(username), display_name: display })
    .eq('id', sid).select('id').maybeSingle();
  if (isUniqueViolation(res.error)) throw conflict('duplicate', `اسم المستخدم "${username}" مستخدم لحد تاني.`);
  if (!must(res, 'studentUpdate')) throw notFound();
  return {};
}

export async function studentReset(ctx: Ctx) {
  await requireAdmin(ctx.db, ctx.token);
  const sid = id(ctx.body, 'id');
  const row = must(await ctx.db.from('students').update({ pass_hash: null, failed_attempts: 0, locked_until: null }).eq('id', sid).select('id').maybeSingle(), 'reset');
  if (!row) throw notFound();
  must(await ctx.db.from('sessions').delete().eq('student_id', sid), 'reset.sessions');
  return {};
}

export async function studentDelete(ctx: Ctx) {
  await requireAdmin(ctx.db, ctx.token);
  const sid = id(ctx.body, 'id');
  must(await ctx.db.from('sessions').delete().eq('student_id', sid), 'del.sessions');
  must(await ctx.db.from('students').delete().eq('id', sid), 'del.student'); // cascades attempts, unlocks, assignments
  return {};
}

// ---------------- quizzes ----------------
export async function quizGet(ctx: Ctx) {
  await requireAdmin(ctx.db, ctx.token);
  const qid = id(ctx.body, 'id');
  const [q, at, st, un] = await Promise.all([
    ctx.db.from('quizzes').select('*').eq('id', qid).maybeSingle(),
    ctx.db.from('attempts').select('*').eq('quiz_id', qid).order('created_at'),
    fetchAll<{ id: string; display_name: string }>((f, t) => ctx.db.from('students').select('id, display_name').order('display_name').range(f, t), 'qg.students'),
    ctx.db.from('quiz_unlocks').select('student_id').eq('quiz_id', qid),
  ]);
  const quiz = must<QuizFull | null>(q, 'qg.quiz');
  if (!quiz) throw notFound('الاختبار ده اتمسح.');
  const attempts = must<AttemptFull[]>(at, 'qg.attempts');
  const name = new Map(st.map((s) => [s.id, s.display_name]));
  const took = new Set(attempts.map((a) => a.student_id));
  return {
    quiz: { ...quiz, opens_at: normalizeTime(quiz.opens_at), author: quiz.author_id ? name.get(quiz.author_id) ?? null : null },
    attempts: attempts.map((a) => ({
      id: a.id, studentId: a.student_id, student: name.get(a.student_id) ?? '—', correct: a.correct, total: a.total, stars: a.stars,
      createdAt: a.created_at, answers: a.answers, essay: a.essay, snapshot: a.questions_snapshot,
    })),
    notTaken: st.filter((s) => !took.has(s.id) && s.id !== quiz.author_id).map((s) => ({ id: s.id, name: s.display_name })),
    students: st.map((s) => ({ id: s.id, name: s.display_name })),
    unlocked: must<{ student_id: string }[]>(un, 'qg.unlocks').map((u) => u.student_id),
  };
}

export async function quizSave(ctx: Ctx) {
  await requireAdmin(ctx.db, ctx.token);
  const b = ctx.body;
  const qid = optId(b, 'id');
  const quiz_date = date(b, 'quiz_date', 'تاريخ الاختبار');
  const opens_at = optTime(b, 'opens_at');
  const book = str(b, 'book', 'اسم السفر', 100);
  const chapter = str(b, 'chapter', 'رقم الأصحاح', 50);
  const status = oneOf(b, 'status', ['draft', 'published'] as const);
  const v = validateQuestions(b.questions);
  if (!v.ok) throw new ApiError('invalid_question', v.message, 400);
  if (status === 'published') {
    if (v.questions.length === 0) throw badInput('مينفعش تنشر اختبار من غير أسئلة.');
    const limit = await getSetting<number>(ctx.db, 'max_published_per_day', 1);
    let q = ctx.db.from('quizzes').select('id, book, chapter').eq('quiz_date', quiz_date).eq('status', 'published');
    if (qid) q = q.neq('id', qid);
    const others = must<{ book: string; chapter: string }[]>(await q, 'save.limit');
    if (others.length >= limit) {
      const o = others[0]!;
      throw conflict('day_full', `فيه اختبار منشور بالفعل في اليوم ده (${o.book} ${arDigits(o.chapter)}). احفظه مسودة أو غيّر التاريخ، أو زوّد العدد المسموح من الإعدادات.`);
    }
  }
  const row = { quiz_date, opens_at, book, chapter, status, questions: v.questions };
  const res = qid
    ? await ctx.db.from('quizzes').update(row).eq('id', qid).select('id').maybeSingle()
    : await ctx.db.from('quizzes').insert(row).select('id').single();
  const saved = must<{ id: string } | null>(res, 'save');
  if (!saved) throw notFound('الاختبار ده اتمسح.');
  return { id: saved.id };
}

export async function quizDelete(ctx: Ctx) {
  await requireAdmin(ctx.db, ctx.token);
  must(await ctx.db.from('quizzes').delete().eq('id', id(ctx.body, 'id')), 'quizDelete');
  return {};
}

export async function unlocksGet(ctx: Ctx) {
  await requireAdmin(ctx.db, ctx.token);
  const qid = id(ctx.body, 'quiz_id');
  const rows = must<{ student_id: string }[]>(await ctx.db.from('quiz_unlocks').select('student_id').eq('quiz_id', qid), 'unlocksGet');
  return { studentIds: rows.map((r) => r.student_id) };
}

export async function unlocksSet(ctx: Ctx) {
  await requireAdmin(ctx.db, ctx.token);
  const qid = id(ctx.body, 'quiz_id');
  const list = ids(ctx.body, 'student_ids');
  if (!must(await ctx.db.from('quizzes').select('id').eq('id', qid).maybeSingle(), 'unlocks.quiz')) throw notFound();
  must(await ctx.db.from('quiz_unlocks').delete().eq('quiz_id', qid), 'unlocks.clear');
  if (list.length) {
    const existing = must<{ id: string }[]>(
      await ctx.db.from('students').select('id').in('id', list),
      'unlocks.students',
    );
    const validIds = new Set(existing.map((s) => s.id));
    const validList = list.filter((student_id) => validIds.has(student_id));
    if (validList.length) {
      must(await ctx.db.from('quiz_unlocks').insert(validList.map((student_id) => ({ quiz_id: qid, student_id }))), 'unlocks.insert');
    }
    return { count: validList.length };
  }
  return { count: 0 };
}

// ---------------- essay review ----------------
async function saveAttemptGrades(ctx: Ctx, a: AttemptFull, essay: EssayVerdict[]) {
  const s = score(a.questions_snapshot, a.answers, essay);
  must(await ctx.db.from('attempts').update({ essay, ...s }).eq('id', a.id), 'attempt.update');
  return s;
}

export async function attemptSet(ctx: Ctx) {
  await requireAdmin(ctx.db, ctx.token);
  const aid = id(ctx.body, 'attempt_id');
  const i = int(ctx.body, 'i', 'رقم السؤال', 0, 29);
  const status = oneOf(ctx.body, 'status', ['ok', 'no'] as const);
  const note = str(ctx.body, 'note', 'الملاحظة', 200, { optional: true });
  const a = must<AttemptFull | null>(await ctx.db.from('attempts').select('*').eq('id', aid).maybeSingle(), 'attemptSet.load');
  if (!a) throw notFound();
  if (a.questions_snapshot[i]?.type !== 'essay') throw badInput('السؤال ده مش مقالي.');
  const prev = a.essay.find((e) => e.i === i);
  const essay = [...a.essay.filter((e) => e.i !== i), { i, status, note: note || prev?.note || '', by: 'admin' as const }].sort((x, y) => x.i - y.i);
  return { ...(await saveAttemptGrades(ctx, a, essay)) };
}

export async function regradePending(ctx: Ctx) {
  await requireAdmin(ctx.db, ctx.token);
  const qid = id(ctx.body, 'quiz_id');
  const attempts = must<AttemptFull[]>(await ctx.db.from('attempts').select('*').eq('quiz_id', qid), 'regrade.load');
  const todo = attempts.filter((a) => aiEligible(a.questions_snapshot, a.essay).length > 0);
  if (todo.length === 0) return { graded: 0, remaining: 0, stopped: null };
  const provider = makeProvider(await loadAiConfig(ctx.db));
  if (!provider) throw new ApiError('ai_no_key', AI_MESSAGES.no_key, 400);
  let graded = 0;
  for (const a of todo) {
    try {
      const { verdicts } = await gradeEssays(provider, a.questions_snapshot, a.answers, a.essay, { rethrow: true });
      await saveAttemptGrades(ctx, a, verdicts);
      graded++;
    } catch (e) {
      if (e instanceof ApiError) throw e;
      const code = e instanceof AiError ? e.code : 'network';
      return { graded, remaining: todo.length - graded, stopped: AI_MESSAGES[code] };
    }
  }
  return { graded, remaining: 0, stopped: null };
}

// ---------------- AI generation (admin only — faith-safety §1.1) ----------------
export async function generate(ctx: Ctx) {
  await requireAdmin(ctx.db, ctx.token);
  const b = ctx.body;
  const counts = {
    mcq: int(b, 'mcq', 'عدد أسئلة الاختيار', 0, 15),
    tf: int(b, 'tf', 'عدد أسئلة صح/خطأ', 0, 15),
    fill: int(b, 'fill', 'عدد أسئلة الإكمال', 0, 15),
  };
  if (counts.mcq + counts.tf + counts.fill === 0) throw badInput('اختار عدد الأسئلة المطلوب.');
  const input = {
    book: str(b, 'book', 'اسم السفر', 100),
    chapter: str(b, 'chapter', 'رقم الأصحاح', 50),
    counts,
    notes: str(b, 'notes', 'الملاحظات', 600, { optional: true }),
    text: str(b, 'text', 'نص الأصحاح', 30_000, { optional: true }),
  };
  await rateLimit(ctx.db, 'gen:' + (await ipKey(ctx.ip)), 20, 3600);
  const provider = makeProvider(await loadAiConfig(ctx.db));
  if (!provider) throw new ApiError('ai_no_key', AI_MESSAGES.no_key, 400);
  try {
    return { questions: await generateQuestions(provider, input) };
  } catch (e) {
    console.warn('[generate]', e instanceof AiError ? e.code : 'unknown');
    throw aiToApiError(e);
  }
}

// ---------------- settings ----------------
export async function setLeaderboard(ctx: Ctx) {
  await requireAdmin(ctx.db, ctx.token);
  await setSetting(ctx.db, 'leaderboard_public', bool(ctx.body, 'value'));
  return {};
}

export async function settingsSet(ctx: Ctx) {
  await requireAdmin(ctx.db, ctx.token);
  await setSetting(ctx.db, 'max_published_per_day', int(ctx.body, 'max_published_per_day', 'عدد الاختبارات في اليوم', 1, 5));
  return {};
}

export async function aiSettingsGet(ctx: Ctx) {
  await requireAdmin(ctx.db, ctx.token);
  const cfg = await loadAiConfig(ctx.db);
  return {
    model: cfg.model,
    defaultModel: DEFAULT_MODEL,
    hasKey: !!cfg.apiKey,
    keyHint: maskKey(cfg.apiKey),
    keySource: cfg.keySource,
    maxPerDay: await getSetting<number>(ctx.db, 'max_published_per_day', 1),
  };
}

export async function aiSettingsSet(ctx: Ctx) {
  await requireAdmin(ctx.db, ctx.token);
  const b = ctx.body;
  if (typeof b.model === 'string') {
    const m = b.model.trim();
    if (!m) must(await ctx.db.from('settings').delete().eq('key', 'ai_model'), 'ai.model.clear');
    else if (!MODEL_RE.test(m)) throw badInput('اسم الموديل فيه حروف غير مسموحة.');
    else await setSetting(ctx.db, 'ai_model', m);
  }
  if (b.clear_key === true) {
    must(await ctx.db.from('app_secrets').delete().eq('key', 'gemini_api_key'), 'ai.key.clear');
  } else if (typeof b.api_key === 'string' && b.api_key.trim()) {
    const k = b.api_key.trim();
    if (k.length > 200 || /\s/.test(k)) throw badInput('المفتاح شكله غير صحيح.');
    must(await ctx.db.from('app_secrets').upsert({ key: 'gemini_api_key', value: k, updated_at: new Date().toISOString() }, { onConflict: 'key' }), 'ai.key.set');
  }
  return await aiSettingsGet(ctx); // returns only the masked hint, never the key
}

export async function aiTest(ctx: Ctx) {
  await requireAdmin(ctx.db, ctx.token);
  const cfg = await loadAiConfig(ctx.db);
  const provider = makeProvider(cfg);
  if (!provider) throw new ApiError('ai_no_key', AI_MESSAGES.no_key, 400);
  try {
    await provider.generateJson('Reply with {"ok": true}.', TEST_SCHEMA, { temperature: 0, timeoutMs: 15_000 });
    return { model: cfg.model };
  } catch (e) {
    throw aiToApiError(e);
  }
}
