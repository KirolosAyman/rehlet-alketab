import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ar } from '../../i18n/ar';
import { api } from '../../lib/api';
import { fmtDate, n } from '../../lib/format';
import type { AdminQuiz, EssayVerdict } from '../../lib/types';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState, ErrorBox, Loading, StatusMsg } from '../../components/Feedback';
import { Pill } from '../../components/Pill';
import { useAdminQuiz, useRefresh } from './useAdmin';

type Attempt = AdminQuiz['attempts'][number];

export function QuizResultsPage() {
  const { id = '' } = useParams();
  const d = useAdminQuiz(id);
  const refresh = useRefresh();
  const t = ar.admin.results;
  const [msg, setMsg] = useState('');
  const regrade = useMutation({
    mutationFn: () => api<{ graded: number; remaining: number; stopped: string | null }>('admin_regrade_pending', { quiz_id: id }),
    onSuccess: (r) => {
      refresh();
      setMsg(r.graded === 0 && !r.stopped ? t.nothingToRegrade : r.stopped ? t.regradeStopped(r.graded, r.remaining, r.stopped) : t.regradeDone(r.graded));
    },
  });

  if (d.isPending) return <Loading />;
  if (d.isError) return <ErrorBox error={d.error} onRetry={() => d.refetch()} />;
  const { quiz, attempts, notTaken } = d.data;
  const essayIdx = quiz.questions.flatMap((q, i) => (q.type === 'essay' ? [i] : []));
  const hasPending = attempts.some((a) => a.essay.some((e) => e.status === 'pending'));

  const exportCsv = () => {
    const headers = ['اسم الطالب', 'الدرجة', 'الإجمالي', 'النسبة', 'النجوم'];
    const rows = attempts.map((a) => [
      `"${a.student.replace(/"/g, '""')}"`,
      a.correct,
      a.total,
      `${Math.round((a.correct / (a.total || 1)) * 100)}%`,
      a.stars,
    ]);
    const notTakenRows = notTaken.map((s) => [
      `"${s.name.replace(/"/g, '""')}"`,
      'لم يحل',
      quiz.questions.length,
      '0%',
      0,
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(',')), ...notTakenRows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `نتائج_${quiz.book}_${quiz.chapter}_${quiz.quiz_date}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-scripture text-xl font-bold">{t.title}: {ar.chapter(quiz.book, quiz.chapter)}</h1>
          <p className="text-sm text-muted">{fmtDate(quiz.quiz_date)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={`/admin/quizzes/${id}/edit`} className="btn btn-ghost btn-sm">{ar.admin.quizzes.edit}</Link>
          <Button small variant="secondary" onClick={exportCsv}>تصدير النتائج (CSV)</Button>
        </div>
      </div>

      {attempts.length === 0 ? <EmptyState title={t.noAttempts} icon="⏳" /> : (
        <Card className="overflow-x-auto p-0">
          <table className="table">
            <thead><tr><th>{ar.admin.table.name}</th><th>{ar.admin.table.today}</th><th>{ar.admin.table.stars}</th></tr></thead>
            <tbody>
              {attempts.map((a) => (
                <tr key={a.id}><td>{a.student}</td><td>{ar.score(a.correct, a.total)}</td><td>{n(a.stars)}</td></tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Card>
        <h2 className="mb-2 font-semibold">{t.notTaken}</h2>
        {notTaken.length === 0 ? <p className="text-muted">{t.allTook}</p> : (
          <ul className="flex flex-wrap gap-2">{notTaken.map((s) => <li key={s.id}><Pill>{s.name}</Pill></li>)}</ul>
        )}
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t.essays}</h2>
        {essayIdx.length === 0 && <p className="text-muted">{t.noEssays}</p>}
        {hasPending && (
          <div className="flex flex-col gap-2">
            <Button variant="secondary" loading={regrade.isPending} onClick={() => { setMsg(''); regrade.mutate(); }}>{t.regrade}</Button>
            <StatusMsg>{msg}</StatusMsg>
            {regrade.isError && <ErrorBox error={regrade.error} />}
          </div>
        )}
        {attempts.map((a) => a.snapshot.map((q, i) => (q.type === 'essay' ? <EssayReview key={`${a.id}-${i}`} attempt={a} i={i} /> : null)))}
      </section>
    </div>
  );
}

function EssayReview({ attempt, i }: { attempt: Attempt; i: number }) {
  const t = ar.admin.results;
  const refresh = useRefresh();
  const q = attempt.snapshot[i]!;
  const v: EssayVerdict = attempt.essay.find((e) => e.i === i) ?? { i, status: 'pending', note: '', by: null };
  const set = useMutation({ mutationFn: (status: 'ok' | 'no') => api('admin_attempt_set', { attempt_id: attempt.id, i, status }), onSuccess: refresh });
  const tone = v.status === 'ok' ? 'success' : v.status === 'no' ? 'danger' : 'star';
  return (
    <Card className="flex flex-col gap-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <strong>{attempt.student}</strong>
        <Pill tone={tone}>{t[v.status]}</Pill>
        {v.by && <span className="text-xs text-muted">({v.by === 'ai' ? t.byAi : t.byAdmin})</span>}
        <span className="text-xs text-muted">· {t.mode(q.grading ?? 'ai')}</span>
      </div>
      <p className="font-scripture">{n(i + 1)}. {q.q}</p>
      <p><strong>{t.studentAnswer}:</strong> {String(attempt.answers[i] ?? '')}</p>
      <p><strong>{t.model}:</strong> {q.model}</p>
      {v.note && <p className="text-muted">— {v.note}</p>}
      <div className="flex gap-2">
        <Button small variant={v.status === 'ok' ? 'primary' : 'secondary'} loading={set.isPending && set.variables === 'ok'} onClick={() => set.mutate('ok')}>{t.markOk}</Button>
        <Button small variant={v.status === 'no' ? 'danger' : 'secondary'} loading={set.isPending && set.variables === 'no'} onClick={() => set.mutate('no')}>{t.markNo}</Button>
      </div>
      {set.isError && <ErrorBox error={set.error} />}
    </Card>
  );
}
