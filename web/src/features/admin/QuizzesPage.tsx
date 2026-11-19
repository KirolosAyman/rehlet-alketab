import { useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ar } from '../../i18n/ar';
import { api } from '../../lib/api';
import { fmtDate, fmtTime, pct } from '../../lib/format';
import type { AdminQuizRow } from '../../lib/types';
import { Card } from '../../components/Card';
import { ConfirmButton } from '../../components/ConfirmButton';
import { EmptyState, ErrorBox, Loading } from '../../components/Feedback';
import { Pill } from '../../components/Pill';
import { useDashboard, useRefresh } from './useAdmin';

export function QuizzesPage() {
  const d = useDashboard();
  return (
    <div className="flex flex-col gap-4">
      <Link to="/admin/quizzes/new" className="btn btn-primary self-start">{ar.admin.quizzes.new}</Link>
      {d.isPending && <Loading />}
      {d.isError && <ErrorBox error={d.error} onRetry={() => d.refetch()} />}
      {d.data && d.data.quizzes.length === 0 && <EmptyState title={ar.admin.quizzes.empty} />}
      <ul className="flex flex-col gap-3">
        {d.data?.quizzes.map((q) => <li key={q.id}><QuizRow q={q} /></li>)}
      </ul>
    </div>
  );
}

function QuizRow({ q }: { q: AdminQuizRow }) {
  const refresh = useRefresh();
  const del = useMutation({ mutationFn: () => api('admin_quiz_delete', { id: q.id }), onSuccess: refresh });
  const t = ar.admin.quizzes;
  return (
    <Card className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-scripture text-lg font-semibold">{ar.chapter(q.book, q.chapter)}</span>
        <Pill tone={q.status === 'published' ? 'success' : 'neutral'}>{q.status === 'published' ? t.published : t.draft}</Pill>
        {q.pendingEssays > 0 && <Pill tone="star">{t.pending(q.pendingEssays)}</Pill>}
      </div>
      <p className="text-sm text-muted">
        {fmtDate(q.date)}{q.opensAt && ` · ${t.opens(fmtTime(q.opensAt))}`}{q.author && ` · ${t.author(q.author)}`}
      </p>
      <p className="text-sm text-muted">
        {t.questions(q.questionCount)} · {t.attempts(q.attempts)} · {t.avg(pct(q.avg))}{q.unlocked > 0 && ` · ${t.unlocked(q.unlocked)}`}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Link to={`/admin/quizzes/${q.id}/edit`} className="btn btn-secondary btn-sm">{t.edit}</Link>
        <Link to={`/admin/quizzes/${q.id}`} className="btn btn-secondary btn-sm">{t.results}</Link>
        <Link to={`/admin/quizzes/${q.id}/unlock`} className="btn btn-secondary btn-sm">{t.unlock}</Link>
        <ConfirmButton label={t.delete} warning={t.deleteConfirm} confirmLabel={t.deleteYes} loading={del.isPending} onConfirm={() => del.mutate()} />
      </div>
      {del.isError && <ErrorBox error={del.error} />}
    </Card>
  );
}
