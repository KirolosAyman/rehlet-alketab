import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ar } from '../../i18n/ar';
import { api } from '../../lib/api';
import type { Answer, DoneView, OpenView } from '../../lib/types';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ErrorBox, Loading } from '../../components/Feedback';
import { Page } from '../../components/Page';
import { Pill } from '../../components/Pill';
import { HOME_KEY } from './useHome';
import { ResultView } from './ResultView';

export function PlayPage() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const quiz = useQuery({ queryKey: ['quiz', id], queryFn: () => api<OpenView | DoneView>('get_quiz', { quiz_id: id }), staleTime: 0 });
  const [justDone, setJustDone] = useState(false);

  return (
    <Page actions={<Link to="/" className="btn btn-ghost btn-sm">{ar.play.backHome}</Link>}>
      {quiz.isPending && <Loading />}
      {quiz.isError && <ErrorBox error={quiz.error} onRetry={() => quiz.refetch()} />}
      {quiz.data?.state === 'done' && <ResultView data={quiz.data} celebrate={justDone} />}
      {quiz.data?.state === 'open' && (
        <Player
          data={quiz.data}
          onDone={(d) => {
            setJustDone(true);
            sessionStorage.removeItem(`rehlet.answers.${id}`);
            qc.setQueryData(['quiz', id], d);
            qc.invalidateQueries({ queryKey: HOME_KEY });
          }}
        />
      )}
    </Page>
  );
}

function Player({ data, onDone }: { data: OpenView; onDone: (d: DoneView) => void }) {
  const total = data.questions.length;
  const storeKey = `rehlet.answers.${data.quiz.id}`;
  const [answers, setAnswers] = useState<Answer[]>(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storeKey) ?? 'null') as Answer[] | null;
      if (Array.isArray(saved) && saved.length === total) return saved;
    } catch { /* ignore */ }
    return Array<Answer>(total).fill(null);
  });
  const [i, setI] = useState(0);
  useEffect(() => { sessionStorage.setItem(storeKey, JSON.stringify(answers)); }, [answers, storeKey]);

  const submit = useMutation({ mutationFn: () => api<DoneView>('submit', { quiz_id: data.quiz.id, answers }), onSuccess: onDone });

  const q = data.questions[i]!;
  const answered = (a: Answer) => (typeof a === 'string' ? a.trim().length > 0 : a !== null);
  const remaining = answers.filter((a) => !answered(a)).length;
  const set = (a: Answer) => setAnswers((prev) => prev.map((x, k) => (k === i ? a : x)));
  const last = i === total - 1;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="font-scripture text-lg font-semibold">{ar.chapter(data.quiz.book, data.quiz.chapter)}</p>
        <p className="text-sm text-muted">{ar.play.oneAttempt}</p>
      </div>

      <div className="flex flex-wrap justify-center gap-1.5" aria-label={ar.play.question(i + 1, total)}>
        {data.questions.map((_, k) => (
          <button
            key={k} type="button" onClick={() => setI(k)} aria-label={ar.play.question(k + 1, total)} aria-current={k === i || undefined}
            className={`dot ${k === i ? 'dot-current' : answered(answers[k] ?? null) ? 'dot-done' : ''}`}
          />
        ))}
      </div>

      <Card className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted">{ar.play.question(i + 1, total)}</span>
          <Pill tone="primary">{ar.qtypes[q.type]}</Pill>
        </div>
        <h2 className="font-scripture text-xl leading-loose">{q.q}</h2>

        {q.type === 'essay' ? (
          <textarea
            aria-label={q.q} className="input min-h-32" placeholder={ar.play.essayPlaceholder} maxLength={3000}
            value={typeof answers[i] === 'string' ? (answers[i] as string) : ''} onChange={(e) => set(e.target.value)}
          />
        ) : (
          <div role="radiogroup" aria-label={q.q} className="flex flex-col gap-2">
            {q.options.map((o, k) => (
              <button key={k} type="button" role="radio" aria-checked={answers[i] === k} onClick={() => set(k)} className="option-card">
                {o}
              </button>
            ))}
          </div>
        )}
      </Card>

      <div className="flex gap-3">
        <Button variant="secondary" disabled={i === 0} onClick={() => setI(i - 1)} className="flex-1">{ar.back}</Button>
        {!last && <Button onClick={() => setI(i + 1)} className="flex-1">{ar.next}</Button>}
        {last && <Button onClick={() => submit.mutate()} disabled={remaining > 0} loading={submit.isPending} className="flex-1">{ar.play.submit}</Button>}
      </div>
      {last && remaining > 0 && <p role="status" className="text-center text-sm text-muted">{ar.play.remaining(remaining)}</p>}
      {submit.isError && <ErrorBox error={submit.error} />}
    </div>
  );
}
