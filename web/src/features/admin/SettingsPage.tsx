import { useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ar } from '../../i18n/ar';
import { api } from '../../lib/api';
import type { AiSettings } from '../../lib/types';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ConfirmButton } from '../../components/ConfirmButton';
import { ErrorBox, Loading, StatusMsg } from '../../components/Feedback';
import { Input } from '../../components/Field';

const KEY = ['admin', 'ai'] as const;

export function SettingsPage() {
  const s = useQuery({ queryKey: KEY, queryFn: () => api<AiSettings>('admin_ai_settings_get') });
  if (s.isPending) return <Loading />;
  if (s.isError) return <ErrorBox error={s.error} onRetry={() => s.refetch()} />;
  return (
    <div className="flex flex-col gap-4">
      <AiCard data={s.data} />
      <QuizCard max={s.data.maxPerDay} />
    </div>
  );
}

function AiCard({ data }: { data: AiSettings }) {
  const t = ar.admin.settings;
  const qc = useQueryClient();
  const [model, setModel] = useState(data.model === data.defaultModel ? '' : data.model);
  const [key, setKey] = useState('');
  const [msg, setMsg] = useState('');
  const onSaved = (r: AiSettings) => { qc.setQueryData(KEY, r); setKey(''); setMsg(ar.saved); };
  const save = useMutation({ mutationFn: () => api<AiSettings>('admin_ai_settings_set', { model, ...(key.trim() ? { api_key: key.trim() } : {}) }), onSuccess: onSaved });
  const clear = useMutation({ mutationFn: () => api<AiSettings>('admin_ai_settings_set', { clear_key: true }), onSuccess: onSaved });
  const test = useMutation({ mutationFn: () => api<{ model: string }>('admin_ai_test'), onSuccess: (r) => setMsg(t.testOk(r.model)) });
  const submit = (e: FormEvent) => { e.preventDefault(); setMsg(''); save.mutate(); };
  const src = data.keySource === 'settings' ? t.srcSettings : t.srcEnv;
  const err = save.error ?? clear.error ?? test.error;

  return (
    <Card>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t.aiTitle}</h2>
        <Input label={t.model} hint={t.modelHint(data.defaultModel)} placeholder={data.defaultModel} dir="ltr" value={model} maxLength={100} onChange={(e) => setModel(e.target.value)} />
        <Input
          label={t.key} hint={t.keyHint} type="password" dir="ltr" autoComplete="off" placeholder={t.keyPlaceholder}
          value={key} maxLength={200} onChange={(e) => setKey(e.target.value)}
        />
        <p className="text-sm text-muted" dir="auto">{data.hasKey && data.keyHint ? t.keyCurrent(data.keyHint, src) : t.keyNone}</p>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={save.isPending}>{ar.save}</Button>
          <Button variant="secondary" loading={test.isPending} disabled={!data.hasKey} onClick={() => { setMsg(''); test.mutate(); }}>{t.test}</Button>
          {data.keySource === 'settings' && <ConfirmButton label={t.clearKey} warning={t.clearConfirm} loading={clear.isPending} onConfirm={() => clear.mutate()} />}
        </div>
        <StatusMsg>{msg}</StatusMsg>
        {err && <ErrorBox error={err} />}
      </form>
    </Card>
  );
}

function QuizCard({ max }: { max: number }) {
  const t = ar.admin.settings;
  const qc = useQueryClient();
  const [v, setV] = useState(max);
  const [msg, setMsg] = useState('');
  const save = useMutation({
    mutationFn: () => api('admin_settings_set', { max_published_per_day: v }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin'] }); setMsg(ar.saved); },
  });
  return (
    <Card>
      <form onSubmit={(e) => { e.preventDefault(); setMsg(''); save.mutate(); }} className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t.quizTitle}</h2>
        <Input label={t.maxPerDay} hint={t.maxPerDayHint} type="number" min={1} max={5} inputMode="numeric" value={v} onChange={(e) => setV(Math.max(1, Math.min(5, Number(e.target.value) || 1)))} />
        <Button type="submit" loading={save.isPending}>{ar.save}</Button>
        <StatusMsg>{msg}</StatusMsg>
        {save.isError && <ErrorBox error={save.error} />}
      </form>
    </Card>
  );
}
