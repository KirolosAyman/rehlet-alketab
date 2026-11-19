import { useId } from 'react';
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

function Wrap({ id, label, hint, children }: { id: string; label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-semibold">{label}</label>
      {children}
      {hint && <p id={id + '-hint'} className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

type Base = { label: string; hint?: ReactNode };

export function Input({ label, hint, className = '', ...rest }: Base & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <Wrap id={id} label={label} hint={hint}>
      <input id={id} aria-describedby={hint ? id + '-hint' : undefined} {...rest} className={`input ${className}`} />
    </Wrap>
  );
}

export function TextArea({ label, hint, className = '', ...rest }: Base & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <Wrap id={id} label={label} hint={hint}>
      <textarea id={id} aria-describedby={hint ? id + '-hint' : undefined} rows={3} {...rest} className={`input ${className}`} />
    </Wrap>
  );
}

export function Select({ label, hint, className = '', children, ...rest }: Base & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <Wrap id={id} label={label} hint={hint}>
      <select id={id} {...rest} className={`input ${className}`}>{children}</select>
    </Wrap>
  );
}
