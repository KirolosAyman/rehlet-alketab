import type { HTMLAttributes } from 'react';

export function Card({ className = '', ...rest }: HTMLAttributes<HTMLElement>) {
  return <section {...rest} className={`card ${className}`} />;
}
