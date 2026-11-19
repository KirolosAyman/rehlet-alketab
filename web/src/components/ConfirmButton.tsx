import { useState } from 'react';
import { ar } from '../i18n/ar';
import { Button } from './Button';

/** In-page two-step confirmation (never window.confirm). */
export function ConfirmButton({
  label, warning, confirmLabel = ar.yes, onConfirm, loading, variant = 'danger', small = true,
}: {
  label: string; warning: string; confirmLabel?: string; onConfirm: () => void; loading?: boolean;
  variant?: 'danger' | 'primary'; small?: boolean;
}) {
  const [asking, setAsking] = useState(false);
  if (!asking) return <Button variant={variant === 'danger' ? 'ghost' : 'secondary'} small={small} className={variant === 'danger' ? 'text-danger' : ''} onClick={() => setAsking(true)}>{label}</Button>;
  return (
    <div role="group" className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-bg p-2">
      <span className="text-sm">{warning}</span>
      <Button variant={variant} small={small} loading={loading} onClick={() => { onConfirm(); }}>{confirmLabel}</Button>
      <Button variant="ghost" small={small} onClick={() => setAsking(false)} disabled={loading}>{ar.cancel}</Button>
    </div>
  );
}
