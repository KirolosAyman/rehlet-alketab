import type { ReactNode } from 'react';
import { ar } from '../i18n/ar';
import { Logo } from './Logo';

export function Page({ children, actions, wide }: { children: ReactNode; actions?: ReactNode; wide?: boolean }) {
  return (
    <div className={`mx-auto flex min-h-dvh w-full flex-col gap-4 pb-10 pt-4 ${wide ? 'max-w-4xl' : 'max-w-md'}`}>
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Logo size={36} />
          <span className="font-scripture text-xl font-semibold text-primary">{ar.appName}</span>
        </div>
        <div className="flex items-center gap-2">{actions}</div>
      </header>
      <main className="flex flex-col gap-4">{children}</main>
    </div>
  );
}
