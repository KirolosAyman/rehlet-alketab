import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { AdminQuiz, Dashboard } from '../../lib/types';

export const DASH_KEY = ['admin', 'dashboard'] as const;
export const quizKey = (id: string) => ['admin', 'quiz', id] as const;

export const useDashboard = () => useQuery({ queryKey: DASH_KEY, queryFn: () => api<Dashboard>('admin_dashboard') });
export const useAdminQuiz = (id: string) =>
  useQuery({ queryKey: quizKey(id), queryFn: () => api<AdminQuiz>('admin_quiz_get', { id }), enabled: !!id, staleTime: 0 });

/** Refresh admin data after any change. */
export function useRefresh() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['admin'] });
}
