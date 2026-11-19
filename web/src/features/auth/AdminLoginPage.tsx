import { useState } from 'react';
import type { FormEvent } from 'react';
import { ar } from '../../i18n/ar';
import { api, errorText } from '../../lib/api';
import { adminToken } from '../../lib/session';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Input } from '../../components/Field';
import { Page } from '../../components/Page';

export function AdminLoginPage() {
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      adminToken.set((await api<{ token: string }>('admin_login', { password: pw })).token);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page>
      <Card>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <h1 className="text-2xl font-bold">{ar.admin.loginTitle}</h1>
          <Input label={ar.admin.password} type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" autoFocus required />
          <Button type="submit" block loading={busy}>{ar.admin.enter}</Button>
          <div role="alert" className="text-danger empty:hidden">{error}</div>
        </form>
      </Card>
    </Page>
  );
}
