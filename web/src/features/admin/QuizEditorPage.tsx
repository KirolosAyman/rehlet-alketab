import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { ar } from '../../i18n/ar';
import { api } from '../../lib/api';
import { addDays } from '../../lib/format';
import type { Grading, Question } from '../../lib/types';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ErrorBox, Loading, StatusMsg } from '../../components/Feedback';
import { Input } from '../../components/Field';
import { QuestionEditor } from '../../components/QuestionEditor';
import { AiPanel } from './AiPanel';
import { useAdminQuiz, useDashboard, useRefresh } from './useAdmin';

interface Form { quiz_date: string; opens_at: string; book: string; chapter: string; questions: Question[]; status: 'draft' | 'published' }

export function QuizEditorPage() {
  const { id = '' } = useParams();
  const dash = useDashboard();
  const quiz = useAdminQuiz(id);
  if (id && quiz.isPending) return <Loading />;
  if (id && quiz.isError) return <ErrorBox error={quiz.error} onRetry={() => quiz.refetch()} />;
  if (!id && dash.isPending) return <Loading />;

  const q = quiz.data?.quiz;
  const today = dash.data?.today ?? new Date().toISOString().slice(0, 10);
  const initial: Form = q
    ? { quiz_date: q.quiz_date, opens_at: q.opens_at ?? '', book: q.book, chapter: q.chapter, questions: q.questions, status: q.status }
    : { quiz_date: addDays(today, 1), opens_at: '', book: dash.data?.quizzes[0]?.book ?? 'صموئيل الثاني', chapter: '', questions: [], status: 'draft' };
  return <Editor key={id || 'new'} id={id} initial={initial} author={q?.author ?? null} />;
}

function Editor({ id, initial, author }: { id: string; initial: Form; author: string | null }) {
  const t = ar.admin.editor;
  const nav = useNavigate();
  const refresh = useRefresh();
  const [f, setF] = useState<Form>(initial);
  const [msg, setMsg] = useState('');
  const edit = (x: Form) => { setF(x); setMsg(''); };

  const isDirty = JSON.stringify(f) !== JSON.stringify(initial);
  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

  const save = useMutation({
    mutationFn: (status: 'draft' | 'published') =>
      api<{ id: string }>('admin_quiz_save', { id: id || null, ...f, opens_at: f.opens_at || null, status }),
    onSuccess: (r, status) => {
      refresh();
      setF((x) => ({ ...x, status }));
      setMsg(status === 'published' ? t.savedPublished : t.savedDraft);
      if (!id) nav(`/admin/quizzes/${r.id}/edit`, { replace: true });
    },
  });
  const hasEssay = f.questions.some((q) => q.type === 'essay');
  const setAllGrading = (g: Grading) => edit({ ...f, questions: f.questions.map((q) => (q.type === 'essay' ? { ...q, grading: g } : q)) });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">{id ? t.titleEdit : t.titleNew}</h1>
      {author && <p className="text-sm text-muted">{t.authorNote(author)}</p>}
      {f.status === 'published' && <p className="rounded-lg bg-star/15 p-3 text-sm">{t.publishedNote}</p>}

      <Card className="grid gap-3 sm:grid-cols-2">
        <Input label={t.date} type="date" value={f.quiz_date} onChange={(e) => edit({ ...f, quiz_date: e.target.value })} required />
        <Input label={t.opensAt} hint={t.opensAtHint} type="time" value={f.opens_at} onChange={(e) => edit({ ...f, opens_at: e.target.value })} />
        <Input label={t.book} value={f.book} maxLength={100} className="font-scripture" onChange={(e) => edit({ ...f, book: e.target.value })} required />
        <Input label={t.chapter} value={f.chapter} maxLength={50} inputMode="numeric" onChange={(e) => edit({ ...f, chapter: e.target.value })} required />
      </Card>

      <AiPanel book={f.book} chapter={f.chapter} onAdd={(qs) => setF((x) => ({ ...x, questions: [...x.questions, ...qs] }))} />

      {hasEssay && (
        <div className="flex flex-wrap gap-2">
          <Button small variant="secondary" onClick={() => setAllGrading('ai')}>{t.allAi}</Button>
          <Button small variant="secondary" onClick={() => setAllGrading('manual')}>{t.allManual}</Button>
        </div>
      )}

      <QuestionEditor value={f.questions} onChange={(questions) => edit({ ...f, questions })} allowGrading />

      <div className="sticky bottom-0 flex flex-wrap gap-2 border-t border-border bg-bg py-3" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
        <Button variant="secondary" loading={save.isPending && save.variables === 'draft'} onClick={() => save.mutate('draft')}>
          {f.status === 'published' ? t.toDraft : t.saveDraft}
        </Button>
        <Button loading={save.isPending && save.variables === 'published'} onClick={() => save.mutate('published')}>{t.publish}</Button>
        <StatusMsg>{msg}</StatusMsg>
      </div>
      {save.isError && <ErrorBox error={save.error} />}
    </div>
  );
}
