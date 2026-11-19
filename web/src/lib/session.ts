// Token stores in localStorage (student kept until logout; admin expires server-side after 7 days).
import { useSyncExternalStore } from 'react';

export interface TokenStore {
  get: () => string | null;
  set: (v: string) => void;
  clear: () => void;
  subscribe: (l: () => void) => () => void;
}

function makeStore(key: string): TokenStore {
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());
  const read = () => {
    try { return localStorage.getItem(key); } catch { return null; }
  };
  return {
    get: read,
    set: (v) => { localStorage.setItem(key, v); emit(); },
    clear: () => { localStorage.removeItem(key); emit(); },
    subscribe: (l) => {
      listeners.add(l);
      const onStorage = (e: StorageEvent) => { if (e.key === key) l(); };
      window.addEventListener('storage', onStorage);
      return () => { listeners.delete(l); window.removeEventListener('storage', onStorage); };
    },
  };
}

export const studentToken = makeStore('rehlet.token');
export const adminToken = makeStore('rehlet.adminToken');

export const useToken = (s: TokenStore) => useSyncExternalStore(s.subscribe, s.get);
