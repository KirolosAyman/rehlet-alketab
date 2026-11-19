import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ar } from '../../i18n/ar';
import { api } from '../../lib/api';
import { fmtDate } from '../../lib/format';
import { emptyQuestion } from '../../lib/questions';
import type { MyAssignment, Question } from '../../lib/types';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ConfirmButton } from '../../components/ConfirmButton';
import { EmptyState, ErrorBox, Loading, StatusMsg } from '../../components/Feedback';
import { Page } from '../../components/Page';
import { QuestionEditor } from '../../components/QuestionEditor';
import { HOME_KEY, useHome } from '../quiz/useHome';

export function WriterPage() {
  const { id = '' } = useParams();
  const home = useHome();
  const a = home.data?.assignments.find((x) => x.id === id);
  return (
    <Page actions={<Link to="/" className="btn btn-ghost btn-sm">{ar.play.backHome}</Link>}>
      {home.isPending && <Loading />}
      {home.isError && <ErrorBox error={home.error} onRetry={() => home.refetch()} />}
      {home.data && !a && <EmptyState title={ar.writer.notFound} icon="✍️" />}
      {a && <Writer key={a.id} a={a} />}
    </Page>
  );
}

function Writer({ a }: { a: MyAssignment }) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const locked = a.status !== 'open';
  const [qs, setQs] = useState<Question[]>(a.questions.length ? a.questions : [emptyQuestion()]);
  const [saved, setSaved] = useState('');

  const save = useMutation({
    mutationFn: (submit: boolean) => api<{ status: string }>('assign_save', { id: a.id, questions: qs, submit }),
    onSuccess: (_r, submit) => {
      qc.invalidateQueries({ queryKey: HOME_KEY });
      if (submit) nav('/', { replace: true });
      else setSaved(ar.saved);
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">{ar.writer.title}</h1>
        <p className="font-scripture text-lg">{ar.chapter(a.book, a.chapter)}</p>
        <p className="text-sm text-muted">{ar.writer.intro(fmtDate(a.day))}</p>
        <p className="text-sm text-muted">{locked ? ar.writer.locked : ar.writer.noAi}</p>
      </Card>

      <QuestionEditor value={qs} onChange={(v) => { setQs(v); setSaved(''); }} allowGrading={false} disabled={locked} />

      {!locked && (
        <div className="flex flex-col gap-3">
          <Button variant="secondary" block loading={save.isPending && save.variables === false} onClick={() => save.mutate(false)}>{ar.writer.saveDraft}</Button>
          <ConfirmButton
            small={false} variant="primary" label={ar.writer.submit} warning={ar.writer.submitConfirm} confirmLabel={ar.writer.submitYes}
            loading={save.isPending && save.variables === true} onConfirm={() => save.mutate(true)}
          />
          <StatusMsg>{saved}</StatusMsg>
          {save.isError && <ErrorBox error={save.error} />}
        </div>
      )}
    </div>
  );
}
