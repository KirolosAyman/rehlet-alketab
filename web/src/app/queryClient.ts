import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '../lib/api';

// Free-tier friendly: no background refetching; fetch once per view, refresh after mutations.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      retry: (count, e) => count < 1 && !(e instanceof ApiError && e.status >= 400 && e.status < 500),
    },
  },
});
