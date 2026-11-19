import type { ButtonHTMLAttributes } from 'react';
import { Spinner } from './Feedback';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
  block?: boolean;
  small?: boolean;
};

export function Button({ variant = 'primary', loading, block, small, className = '', children, disabled, type = 'button', ...rest }: Props) {
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`btn btn-${variant} ${small ? 'btn-sm' : ''} ${block ? 'w-full' : ''} ${className}`}
    >
      {loading && <Spinner small />}
      {children}
    </button>
  );
}
