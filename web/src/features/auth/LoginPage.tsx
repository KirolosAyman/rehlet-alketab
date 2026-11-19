import { useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ar } from '../../i18n/ar';
import { api, errorText } from '../../lib/api';
import { studentToken, useToken } from '../../lib/session';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Input } from '../../components/Field';
import { Page } from '../../components/Page';

type Step = 'username' | 'setup' | 'login';

export function LoginPage() {
  const token = useToken(studentToken);
  const nav = useNavigate();
  const [step, setStep] = useState<Step>('username');
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (token) return <Navigate to="/" replace />;

  async function run(fn: () => Promise<void>) {
    setError('');
    setBusy(true);
    try { await fn(); } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }

  const onUsername = (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    run(async () => {
      const r = await api<{ status: 'not_found' | 'needs_setup' | 'needs_login'; displayName?: string }>('check_username', { username });
      if (r.status === 'not_found') return setError(ar.login.notFound);
      setName(r.displayName ?? username);
      setPw(''); setPw2('');
      setStep(r.status === 'needs_setup' ? 'setup' : 'login');
    });
  };

  const finish = (t: string) => { studentToken.set(t); nav('/', { replace: true }); };

  const onSetup = (e: FormEvent) => {
    e.preventDefault();
    if (pw.length < 4) return setError(ar.login.passwordMin);
    if (pw !== pw2) return setError(ar.login.mismatch);
    run(async () => finish((await api<{ token: string }>('set_password', { username, password: pw, confirm: pw2 })).token));
  };

  const onLogin = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      try {
        finish((await api<{ token: string }>('login', { username, password: pw })).token);
      } catch (err) {
        if ((err as { code?: string }).code === 'needs_setup') { setStep('setup'); return; }
        throw err;
      }
    });
  };

  const changeName = () => { setStep('username'); setError(''); setPw(''); setPw2(''); };

  return (
    <Page>
      <Card className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold">{step === 'username' ? ar.login.title : ar.login.hello(name)}</h1>
          <p className="text-muted">{step === 'setup' ? ar.login.setupIntro : ar.tagline}</p>
        </div>

        {step === 'username' && (
          <form onSubmit={onUsername} className="flex flex-col gap-4">
            <Input label={ar.login.username} hint={ar.login.usernameHint} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus maxLength={60} required />
            <Button type="submit" block loading={busy}>{ar.login.continue}</Button>
          </form>
        )}

        {step === 'setup' && (
          <form onSubmit={onSetup} className="flex flex-col gap-4">
            <Input label={ar.login.password} type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" autoFocus minLength={4} maxLength={100} required />
            <Input label={ar.login.passwordAgain} type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" minLength={4} maxLength={100} required />
            <Button type="submit" block loading={busy}>{ar.login.start}</Button>
          </form>
        )}

        {step === 'login' && (
          <form onSubmit={onLogin} className="flex flex-col gap-4">
            <Input label={ar.login.password} type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" autoFocus maxLength={100} required />
            <Button type="submit" block loading={busy}>{ar.login.enter}</Button>
            <p className="text-sm text-muted">{ar.login.forgot}</p>
          </form>
        )}

        <div role="alert" className="text-danger empty:hidden">{error}</div>
        {step !== 'username' && <Button variant="ghost" onClick={changeName}>{ar.login.changeName}</Button>}
      </Card>
    </Page>
  );
}
