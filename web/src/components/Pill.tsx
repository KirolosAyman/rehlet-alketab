import type { ReactNode } from 'react';

type Tone = 'neutral' | 'primary' | 'success' | 'danger' | 'star';
export function Pill({ children, tone = 'neutral' }: { children: ReactNode; tone?: Tone }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}
