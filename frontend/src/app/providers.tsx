'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect } from 'react';

interface ProvidersProps {
  children: React.ReactNode;
}

async function initMsw() {
  if (process.env.NODE_ENV === 'production') return;
  const { worker } = await import('@/lib/api/mocks/browser');
  return worker.start({
    onUnhandledRequest: 'bypass',
  });
}

export function Providers({ children }: ProvidersProps) {
  const [mswReady, setMswReady] = useState(false);

  useEffect(() => {
    initMsw().then(() => setMswReady(true)).catch(() => setMswReady(true));
  }, []);

  // ===== PERFORMANCE: Optimized React Query cache configuration =====
  // staleTime: 5min for frequently changing data (dashboard, listings)
  // gcTime: 10min to keep unused queries in memory
  // refetchOnWindowFocus: smart - only when data is stale
  // retry: 2 attempts with exponential backoff
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Stale time: 5 minutes for most data
            staleTime: 5 * 60 * 1000,
            // GC time: 10 minutes - keep inactive queries longer
            gcTime: 10 * 60 * 1000,
            // Smart refetch: only when window regains focus AND data is stale
            refetchOnWindowFocus: (query) => {
              // Refetch if data is stale (has been in cache longer than staleTime)
              return !query.state.dataUpdatedAt || Date.now() - query.state.dataUpdatedAt > 5 * 60 * 1000;
            },
            // Retry failed requests up to 2 times with exponential backoff
            retry: 2,
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
            // Network mode for better offline handling
            networkMode: 'online',
          },
          mutations: {
            // Mutations are more sensitive - don't retry automatically
            retry: 1,
            networkMode: 'online',
          },
        },
      }),
  );

  // Render immediately — MSW is an enhancement, not a requirement.
  // Without MSW the page still shows (just without mock data).
  // The queryClient still gets mounted so hooks work.
  if (!mswReady) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
