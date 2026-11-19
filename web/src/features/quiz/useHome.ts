import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { Home } from '../../lib/types';

export const HOME_KEY = ['home'] as const;
export const useHome = () => useQuery({ queryKey: HOME_KEY, queryFn: () => api<Home>('home') });
