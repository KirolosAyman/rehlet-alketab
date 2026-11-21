import { useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ar } from '../../i18n/ar';
import { api } from '../../lib/api';
import { n } from '../../lib/format';
import type { Book } from '../../lib/types';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState, ErrorBox, Loading, StatusMsg } from '../../components/Feedback';
import { Input, Select } from '../../components/Field';
import { Pill } from '../../components/Pill';
import { ProgressBar } from '../../components/ProgressBar';
import { useBookResults, useBooks, useRefresh } from './useAdmin';

export function BooksPage() {
  const { id } = useParams();
  if (id) {
    return <BookResultsView bookId={id} />;
  }
  return <BooksListView />;
}

function BooksListView() {
  const booksQ = useBooks();
  const t = ar.admin.books;
  const [filter, setFilter] = useState<'all' | 'old' | 'new'>('all');
  const [showAdd, setShowAdd] = useState(false);

  if (booksQ.isPending) return <Loading />;
  if (booksQ.isError) return <ErrorBox error={booksQ.error} onRetry={() => booksQ.refetch()} />;

  const books = booksQ.data?.books ?? [];
  const filtered = books.filter((b) => filter === 'all' || b.testament === filter);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">{t.title}</h1>
        <Button variant="primary" small onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? ar.cancel : t.add}
        </Button>
      </div>

      {showAdd && <AddBookForm onDone={() => setShowAdd(false)} />}

      <div className="flex flex-wrap gap-2">
        {(['all', 'old', 'new'] as const).map((mode) => (
          <Button
            key={mode}
            small
            variant={filter === mode ? 'primary' : 'secondary'}
            onClick={() => setFilter(mode)}
          >
            {mode === 'all' ? t.filterAll : mode === 'old' ? t.filterOld : t.filterNew}
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState title={t.empty} icon="📖" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((b) => (
            <BookCard key={b.id} book={b} />
          ))}
        </div>
      )}
    </div>
  );
}

function BookCard({ book }: { book: Book }) {
  const t = ar.admin.books;
  const refresh = useRefresh();
  const toggle = useMutation({
    mutationFn: (board_open: boolean) => api('admin_book_toggle_board', { id: book.id, board_open }),
    onSuccess: refresh,
  });

  return (
    <Card className="flex flex-col justify-between gap-3">
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-scripture text-lg font-bold">{book.name}</h2>
          <Pill tone={book.testament === 'old' ? 'neutral' : 'primary'}>
            {book.testament === 'old' ? ar.testaments.old : ar.testaments.new}
          </Pill>
        </div>
        <p className="text-sm text-muted">
          {t.chaptersCount(book.chapters)}
          {book.quizCount !== undefined && ` · ${t.quizzesCount(book.quizCount)}`}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
          <input
            type="checkbox"
            className="rounded"
            checked={book.boardOpen}
            disabled={toggle.isPending}
            onChange={(e) => toggle.mutate(e.target.checked)}
          />
          <span>{book.boardOpen ? t.boardOpen : t.boardClosed}</span>
        </label>
        <Link to={`/admin/books/${book.id}`} className="btn btn-secondary btn-sm">
          {t.results}
        </Link>
      </div>
      {toggle.isError && <ErrorBox error={toggle.error} />}
    </Card>
  );
}

function AddBookForm({ onDone }: { onDone: () => void }) {
  const t = ar.admin.books;
  const refresh = useRefresh();
  const [testament, setTestament] = useState<'old' | 'new'>('old');
  const [name, setName] = useState('');
  const [chapters, setChapters] = useState('1');
  const [msg, setMsg] = useState('');

  const add = useMutation({
    mutationFn: () =>
      api<{ id: string }>('admin_book_add', {
        testament,
        name: name.trim(),
        chapters: parseInt(chapters, 10) || 1,
      }),
    onSuccess: () => {
      refresh();
      setMsg(t.added);
      setName('');
      setChapters('1');
      setTimeout(onDone, 600);
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setMsg('');
    add.mutate();
  };

  return (
    <Card>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-3 sm:items-end">
        <h2 className="font-semibold sm:col-span-3">{t.addTitle}</h2>
        <Select
          label={t.testament}
          value={testament}
          onChange={(e) => setTestament(e.target.value as 'old' | 'new')}
          required
        >
          <option value="old">{ar.testaments.old}</option>
          <option value="new">{ar.testaments.new}</option>
        </Select>
        <Input
          label={t.name}
          value={name}
          maxLength={100}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Input
          label={t.chapters}
          type="number"
          min={1}
          max={200}
          value={chapters}
          onChange={(e) => setChapters(e.target.value)}
          required
        />
        <div className="flex gap-2 sm:col-span-3">
          <Button type="submit" loading={add.isPending}>
            {ar.save}
          </Button>
          <Button variant="ghost" onClick={onDone}>
            {ar.cancel}
          </Button>
          <StatusMsg>{msg}</StatusMsg>
        </div>
        {add.isError && (
          <div className="sm:col-span-3">
            <ErrorBox error={add.error} />
          </div>
        )}
      </form>
    </Card>
  );
}

function BookResultsView({ bookId }: { bookId: string }) {
  const q = useBookResults(bookId);
  const t = ar.admin.books;
  const refresh = useRefresh();
  const toggle = useMutation({
    mutationFn: (board_open: boolean) => api('admin_book_toggle_board', { id: bookId, board_open }),
    onSuccess: refresh,
  });

  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />;

  const { book, students, quizzes } = q.data;

  const exportCsv = () => {
    const headers = ['اسم الطالب', 'الأصحاحات المنجزة', 'إجمالي الأصحاحات', 'النسبة المئوية', 'النجوم'];
    const rows = students.map((s) => [
      `"${s.name.replace(/"/g, '""')}"`,
      s.chaptersDone,
      s.totalChapters,
      `${s.pct}%`,
      s.stars,
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(',')), ].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `نتائج_${book.name}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Link to="/admin/books" className="text-sm text-primary hover:underline">
              ← {t.backToBooks}
            </Link>
          </div>
          <h1 className="font-scripture text-2xl font-bold">{t.resultsTitle(book.name)}</h1>
          <p className="text-sm text-muted">
            {book.testament === 'old' ? ar.testaments.old : ar.testaments.new} · {t.chaptersCount(book.chapters)} · {t.quizzesCount(quizzes.length)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" small onClick={exportCsv}>
            {t.exportCsv}
          </Button>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm">
            <input
              type="checkbox"
              className="rounded"
              checked={book.boardOpen}
              disabled={toggle.isPending}
              onChange={(e) => toggle.mutate(e.target.checked)}
            />
            <span>{book.boardOpen ? t.boardOpen : t.boardClosed}</span>
          </label>
        </div>
      </div>

      {students.length === 0 ? (
        <EmptyState title={t.noStudents} icon="👥" />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="table">
            <thead>
              <tr>
                <th>{ar.admin.table.name}</th>
                <th>{t.chaptersDone}</th>
                <th>{t.pct}</th>
                <th>{ar.admin.table.stars}</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id}>
                  <td>
                    <strong>{s.name}</strong>
                    <div className="text-xs text-muted">{s.username}</div>
                  </td>
                  <td>
                    {n(s.chaptersDone)} / {n(s.totalChapters)}
                  </td>
                  <td className="w-48">
                    <div className="flex items-center gap-2">
                      <ProgressBar value={s.totalChapters > 0 ? s.chaptersDone / s.totalChapters : 0} label={`${s.pct}%`} />
                      <span className="text-xs font-semibold text-muted">{n(s.pct)}%</span>
                    </div>
                  </td>
                  <td>
                    <span className="font-semibold text-primary">⭐ {n(s.stars)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
