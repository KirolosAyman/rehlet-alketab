import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { AdminBookResults, AdminQuiz, Book, Dashboard } from '../../lib/types';

export const DASH_KEY = ['admin', 'dashboard'] as const;
export const quizKey = (id: string) => ['admin', 'quiz', id] as const;
export const BOOKS_KEY = ['admin', 'books'] as const;
export const bookResultsKey = (id: string) => ['admin', 'book_results', id] as const;

export const useDashboard = () => useQuery({ queryKey: DASH_KEY, queryFn: () => api<Dashboard>('admin_dashboard') });
export const useAdminQuiz = (id: string) =>
  useQuery({ queryKey: quizKey(id), queryFn: () => api<AdminQuiz>('admin_quiz_get', { id }), enabled: !!id, staleTime: 0 });
export const useBooks = () => useQuery({ queryKey: BOOKS_KEY, queryFn: () => api<{ books: Book[] }>('admin_books_list') });
export const useBookResults = (id: string) =>
  useQuery({ queryKey: bookResultsKey(id), queryFn: () => api<AdminBookResults>('admin_book_results', { id }), enabled: !!id, staleTime: 0 });

/** Refresh admin data after any change. */
export function useRefresh() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['admin'] });
}
