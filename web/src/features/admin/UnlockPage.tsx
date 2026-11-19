import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { ar } from '../../i18n/ar';
import { api } from '../../lib/api';
import { fmtDate } from '../../lib/format';
import type { AdminQuiz } from '../../lib/types';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ErrorBox, Loading, StatusMsg } from '../../components/Feedback';
import { useAdminQuiz, useRefresh } from './useAdmin';

export function UnlockPage() {
  const { id = '' } = useParams();
  const d = useAdminQuiz(id);
  if (d.isPending) return <Loading />;
  if (d.isError) return <ErrorBox error={d.error} onRetry={() => d.refetch()} />;
  return <Checklist key={id} data={d.data} />;
}

function Checklist({ data }: { data: AdminQuiz }) {
  const t = ar.admin.unlock;
  const refresh = useRefresh();
  const [sel, setSel] = useState<Set<string>>(new Set(data.unlocked));
  const [msg, setMsg] = useState('');
  const took = new Set(data.attempts.map((a) => a.studentId));
  const selectable = data.students.filter((s) => s.id !== data.quiz.author_id);
  const save = useMutation({
    mutationFn: () => api<{ count: number }>('admin_quiz_unlocks_set', { quiz_id: data.quiz.id, student_ids: [...sel] }),
    onSuccess: (r) => { refresh(); setMsg(t.saved(r.count)); },
  });
  const toggle = (sid: string) => {
    setMsg('');
    setSel((prev) => { const next = new Set(prev); if (next.has(sid)) next.delete(sid); else next.add(sid); return next; });
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold">{t.title}</h1>
        <p className="font-scripture">{ar.chapter(data.quiz.book, data.quiz.chapter)} · {fmtDate(data.quiz.quiz_date)}</p>
        <p className="text-sm text-muted">{t.intro}</p>
      </div>
      <div className="flex gap-2">
        <Button small variant="secondary" onClick={() => { setMsg(''); setSel(new Set(selectable.map((s) => s.id))); }}>{t.selectAll}</Button>
        <Button small variant="secondary" onClick={() => { setMsg(''); setSel(new Set()); }}>{t.clear}</Button>
      </div>
      <Card>
        <fieldset className="flex flex-col gap-1">
          <legend className="sr-only">{t.title}</legend>
          {data.students.map((s) => {
            const isAuthor = s.id === data.quiz.author_id;
            return (
              <label key={s.id} className={`option-row justify-between ${isAuthor ? 'opacity-60' : ''}`}>
                <span className="flex items-center gap-2">
                  <input type="checkbox" className="h-5 w-5" disabled={isAuthor} checked={sel.has(s.id)} onChange={() => toggle(s.id)} />
                  {s.name}
                </span>
                <span className="text-xs text-muted">{isAuthor ? t.isAuthor : took.has(s.id) ? t.took : ''}</span>
              </label>
            );
          })}
        </fieldset>
      </Card>
      <Button onClick={() => save.mutate()} loading={save.isPending}>{ar.save}</Button>
      <StatusMsg>{msg}</StatusMsg>
      {save.isError && <ErrorBox error={save.error} />}
    </div>
  );
}
