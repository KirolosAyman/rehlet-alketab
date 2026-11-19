// Admin-only AI draft generation (spec §11.1). Output is appended as drafts; never auto-published.
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ar } from '../../i18n/ar';
import { api } from '../../lib/api';
import type { Question } from '../../lib/types';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ErrorBox, StatusMsg } from '../../components/Feedback';
import { Input, TextArea } from '../../components/Field';

const MAX_TEXT = 30_000;

export function AiPanel({ book, chapter, onAdd }: { book: string; chapter: string; onAdd: (qs: Question[]) => void }) {
  const t = ar.admin.ai;
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState({ mcq: 5, tf: 3, fill: 2 });
  const [notes, setNotes] = useState('');
  const [text, setText] = useState('');
  const [msg, setMsg] = useState('');

  const gen = useMutation({
    mutationFn: () => api<{ questions: Question[] }>('admin_generate', { book, chapter, ...counts, notes, text }),
    onSuccess: (r) => { onAdd(r.questions); setMsg(t.added(r.questions.length)); },
  });
  const ready = book.trim() && chapter.trim();
  const num = (k: keyof typeof counts, label: string) => (
    <Input label={label} type="number" min={0} max={15} inputMode="numeric" value={counts[k]}
      onChange={(e) => setCounts({ ...counts, [k]: Math.max(0, Math.min(15, Number(e.target.value) || 0)) })} />
  );

  return (
    <Card className="flex flex-col gap-3">
      <button type="button" className="flex items-center justify-between text-start font-semibold" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span>✨ {t.title}</span><span aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <>
          <p className="text-sm text-muted">{t.intro}</p>
          <div className="grid grid-cols-3 gap-2">{num('mcq', t.mcq)}{num('tf', t.tf)}{num('fill', t.fill)}</div>
          <TextArea label={t.notes} value={notes} maxLength={600} onChange={(e) => setNotes(e.target.value)} />
          <TextArea label={t.text} hint={<>{t.textHint} · {t.chars(text.length, MAX_TEXT)}</>} rows={6} className="font-scripture" value={text} maxLength={MAX_TEXT} onChange={(e) => setText(e.target.value)} />
          <Button onClick={() => { setMsg(''); gen.mutate(); }} loading={gen.isPending} disabled={!ready || counts.mcq + counts.tf + counts.fill === 0}>{t.generate}</Button>
          {!ready && <p className="text-sm text-muted">{t.needBook}</p>}
          <StatusMsg>{msg}</StatusMsg>
          {gen.isError && <ErrorBox error={gen.error} />}
        </>
      )}
    </Card>
  );
}
