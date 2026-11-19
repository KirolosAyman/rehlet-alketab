import { useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ar } from '../../i18n/ar';
import { api } from '../../lib/api';
import { n } from '../../lib/format';
import type { AdminStudent } from '../../lib/types';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ConfirmButton } from '../../components/ConfirmButton';
import { EmptyState, ErrorBox, Loading, StatusMsg } from '../../components/Feedback';
import { Input, TextArea } from '../../components/Field';
import { Pill } from '../../components/Pill';
import { useDashboard, useRefresh } from './useAdmin';

export function StudentsPage() {
  const d = useDashboard();
  const t = ar.admin.students;
  const refresh = useRefresh();
  const [lines, setLines] = useState('');
  const [msg, setMsg] = useState('');
  const add = useMutation({
    mutationFn: () => api<{ added: number }>('admin_students_add', { lines }),
    onSuccess: (r) => { refresh(); setLines(''); setMsg(t.added(r.added)); },
  });
  const submit = (e: FormEvent) => { e.preventDefault(); setMsg(''); add.mutate(); };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <h2 className="font-semibold">{t.addTitle}</h2>
          <TextArea label={t.addTitle} hint={t.addHint} rows={5} placeholder={t.addPlaceholder} value={lines} onChange={(e) => { setLines(e.target.value); setMsg(''); }} required />
          <Button type="submit" loading={add.isPending}>{t.add}</Button>
          <StatusMsg>{msg}</StatusMsg>
          {add.isError && <ErrorBox error={add.error} />}
        </form>
      </Card>
      {d.isPending && <Loading />}
      {d.isError && <ErrorBox error={d.error} onRetry={() => d.refetch()} />}
      {d.data && d.data.students.length === 0 && <EmptyState title={t.empty} icon="👥" />}
      <ul className="flex flex-col gap-3">{d.data?.students.map((s) => <li key={s.id}><StudentRow s={s} /></li>)}</ul>
    </div>
  );
}

function StudentRow({ s }: { s: AdminStudent }) {
  const t = ar.admin.students;
  const refresh = useRefresh();
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState(s.username);
  const [name, setName] = useState(s.name);
  const [msg, setMsg] = useState('');
  const update = useMutation({ mutationFn: () => api('admin_student_update', { id: s.id, username, display_name: name }), onSuccess: () => { refresh(); setEditing(false); } });
  const reset = useMutation({ mutationFn: () => api('admin_student_reset', { id: s.id }), onSuccess: () => { refresh(); setMsg(t.resetDone); } });
  const del = useMutation({ mutationFn: () => api('admin_student_delete', { id: s.id }), onSuccess: refresh });
  const err = update.error ?? reset.error ?? del.error;

  return (
    <Card className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <strong>{s.name}</strong>
        <span className="text-sm text-muted">{s.username}</span>
        <Pill tone={s.activated ? 'success' : 'neutral'}>{s.activated ? ar.admin.activated : ar.admin.notActivated}</Pill>
        {s.locked && <Pill tone="danger">{ar.admin.locked}</Pill>}
        <span className="text-sm text-muted">· ⭐ {n(s.stars)}</span>
      </div>
      {editing ? (
        <form onSubmit={(e) => { e.preventDefault(); update.mutate(); }} className="grid gap-2 sm:grid-cols-3 sm:items-end">
          <Input label={ar.admin.table.username} value={username} maxLength={60} onChange={(e) => setUsername(e.target.value)} required />
          <Input label={t.displayName} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
          <div className="flex gap-2">
            <Button type="submit" small loading={update.isPending}>{ar.save}</Button>
            <Button small variant="ghost" onClick={() => setEditing(false)}>{ar.cancel}</Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button small variant="secondary" onClick={() => setEditing(true)}>{t.rename}</Button>
          <ConfirmButton variant="primary" label={t.reset} warning={t.resetConfirm} loading={reset.isPending} onConfirm={() => reset.mutate()} />
          <ConfirmButton label={t.delete} warning={t.deleteConfirm} loading={del.isPending} onConfirm={() => del.mutate()} />
        </div>
      )}
      <StatusMsg>{msg}</StatusMsg>
      {err && <ErrorBox error={err} />}
    </Card>
  );
}
