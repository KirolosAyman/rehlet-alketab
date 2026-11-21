import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ar } from '../../i18n/ar';
import { api } from '../../lib/api';
import { addDays, fmtDate } from '../../lib/format';
import type { AdminAssignment, Dashboard } from '../../lib/types';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ConfirmButton } from '../../components/ConfirmButton';
import { EmptyState, ErrorBox, Loading } from '../../components/Feedback';
import { Input, Select } from '../../components/Field';
import { Pill } from '../../components/Pill';
import { useBooks, useDashboard, useRefresh } from './useAdmin';

export function AssignmentsPage() {
  const d = useDashboard();
  if (d.isPending) return <Loading />;
  if (d.isError) return <ErrorBox error={d.error} onRetry={() => d.refetch()} />;
  return (
    <div className="flex flex-col gap-4">
      <CreateForm data={d.data} />
      {d.data.assignments.length === 0 ? <EmptyState title={ar.admin.assignments.empty} icon="✍️" /> : (
        <ul className="flex flex-col gap-3">{d.data.assignments.map((a) => <li key={a.id}><Row a={a} /></li>)}</ul>
      )}
    </div>
  );
}

function CreateForm({ data }: { data: Dashboard }) {
  const t = ar.admin.assignments;
  const refresh = useRefresh();
  const booksQ = useBooks();
  const allBooks = booksQ.data?.books ?? [];
  const initialBook = allBooks.find((b) => b.name === (data.quizzes[0]?.book ?? 'صموئيل الثاني')) ?? allBooks[0];
  const [testament, setTestament] = useState<'old' | 'new'>('old');
  const [f, setF] = useState({
    student_id: '',
    book: '',
    book_id: null as string | null,
    chapter: '',
    day: data.today,
  });

  useEffect(() => {
    if (f.book || !initialBook) return;
    setTestament(initialBook.testament);
    setF((curr) => ({ ...curr, book: initialBook.name, book_id: initialBook.id }));
  }, [f.book, initialBook]);

  const testamentBooks = allBooks.filter((b) => b.testament === testament);
  const selectedBook = allBooks.find((b) => b.id === f.book_id);
  const maxChapters = selectedBook?.chapters ?? 0;

  const onTestamentChange = (newTestament: 'old' | 'new') => {
    setTestament(newTestament);
    const first = allBooks.find((b) => b.testament === newTestament);
    if (first) {
      setF((curr) => ({ ...curr, book: first.name, book_id: first.id, chapter: '' }));
    }
  };

  const onBookChange = (bookName: string) => {
    const bk = allBooks.find((b) => b.name === bookName);
    setF((curr) => ({ ...curr, book: bookName, book_id: bk?.id ?? null, chapter: '' }));
  };

  const create = useMutation({ mutationFn: () => api('admin_assign_create', f), onSuccess: () => { refresh(); setF({ ...f, chapter: '' }); } });
  const submit = (e: FormEvent) => { e.preventDefault(); create.mutate(); };
  if (booksQ.isPending) return <Loading />;
  if (booksQ.isError) return <ErrorBox error={booksQ.error} onRetry={() => booksQ.refetch()} />;
  if (allBooks.length === 0) return <EmptyState title={ar.admin.books.empty} icon="📖" />;

  return (
    <Card>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <h2 className="font-semibold sm:col-span-2">{t.create}</h2>
        <Select label={t.student} value={f.student_id} onChange={(e) => setF({ ...f, student_id: e.target.value })} required>
          <option value="">{t.chooseStudent}</option>
          {data.students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
        <Input label={t.day} type="date" value={f.day} onChange={(e) => setF({ ...f, day: e.target.value })} required />
        <Select label={ar.admin.editor.testament} value={testament} onChange={(e) => onTestamentChange(e.target.value as 'old' | 'new')} required>
          <option value="old">{ar.testaments.old}</option>
          <option value="new">{ar.testaments.new}</option>
        </Select>
        <Select label={ar.admin.editor.book} value={f.book} onChange={(e) => onBookChange(e.target.value)} required>
          <option value="">{ar.admin.editor.chooseBook}</option>
          {testamentBooks.map((b) => (
            <option key={b.id} value={b.name}>{b.name}</option>
          ))}
        </Select>
        <Select label={ar.admin.editor.chapter} value={f.chapter} onChange={(e) => setF({ ...f, chapter: e.target.value })} required className="sm:col-span-2">
          <option value="">{ar.admin.editor.chooseChapter}</option>
          {Array.from({ length: maxChapters }, (_, i) => String(i + 1)).map((ch) => (
            <option key={ch} value={ch}>{ch}</option>
          ))}
        </Select>
        <Button type="submit" loading={create.isPending} className="sm:col-span-2">{t.add}</Button>
        {create.isError && <div className="sm:col-span-2"><ErrorBox error={create.error} /></div>}
      </form>
    </Card>
  );
}

function Row({ a }: { a: AdminAssignment }) {
  const t = ar.admin.assignments;
  const refresh = useRefresh();
  const nav = useNavigate();
  const [quizDate, setQuizDate] = useState(addDays(a.day, 1));
  const convert = useMutation({
    mutationFn: () => api<{ quizId: string | null }>('admin_assign_to_quiz', { id: a.id, quiz_date: quizDate }),
    onSuccess: (r) => { refresh(); if (r.quizId) nav(`/admin/quizzes/${r.quizId}/edit`); },
  });
  const reopen = useMutation({ mutationFn: () => api('admin_assign_reopen', { id: a.id }), onSuccess: refresh });
  const del = useMutation({ mutationFn: () => api('admin_assign_delete', { id: a.id }), onSuccess: refresh });
  const err = convert.error ?? reopen.error ?? del.error;

  return (
    <Card className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <strong>{a.student}</strong>
        <span className="font-scripture">{ar.chapter(a.book, a.chapter)}</span>
        <Pill tone={a.quizId ? 'primary' : a.status === 'submitted' ? 'success' : 'neutral'}>
          {a.quizId ? t.converted : a.status === 'submitted' ? t.submitted : t.open}
        </Pill>
      </div>
      <p className="text-sm text-muted">{fmtDate(a.day)} · {t.questions(a.questionCount)}</p>
      <div className="flex flex-wrap items-end gap-2">
        {a.status === 'submitted' && !a.quizId && (
          <>
            <Input label={t.quizDate} type="date" value={quizDate} onChange={(e) => setQuizDate(e.target.value)} />
            <Button small loading={convert.isPending} onClick={() => convert.mutate()}>{t.convert}</Button>
          </>
        )}
        {a.quizId && <Button small loading={convert.isPending} onClick={() => convert.mutate()}>{t.openQuiz}</Button>}
        {a.status === 'submitted' && <Button small variant="secondary" loading={reopen.isPending} onClick={() => reopen.mutate()}>{t.reopen}</Button>}
        <ConfirmButton label={t.delete} warning={t.deleteConfirm} loading={del.isPending} onConfirm={() => del.mutate()} />
      </div>
      {err && <ErrorBox error={err} />}
    </Card>
  );
}
