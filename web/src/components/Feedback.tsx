import type { ReactNode } from 'react';
import { ar } from '../i18n/ar';
import { errorText } from '../lib/api';
import { Button } from './Button';

export function Spinner({ small }: { small?: boolean }) {
  return <span aria-hidden="true" className={`spinner ${small ? 'h-4 w-4' : 'h-6 w-6'}`} />;
}

export function Loading({ text = ar.loading }: { text?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-10 text-muted">
      <Spinner /> <span>{text}</span>
    </div>
  );
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-xl border border-danger/40 bg-danger/10 p-4 text-danger">
      <p>{errorText(error)}</p>
      {onRetry && <Button variant="secondary" small className="mt-3" onClick={onRetry}>{ar.retry}</Button>}
    </div>
  );
}

export function StatusMsg({ children, tone = 'success' }: { children: ReactNode; tone?: 'success' | 'muted' }) {
  if (!children) return <div role="status" />;
  return <p role="status" className={tone === 'success' ? 'text-success' : 'text-muted'}>{children}</p>;
}

export function EmptyState({ title, text, icon = '📖' }: { title: string; text?: string; icon?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <span className="text-4xl" aria-hidden="true">{icon}</span>
      <p className="font-semibold">{title}</p>
      {text && <p className="text-muted">{text}</p>}
    </div>
  );
}
