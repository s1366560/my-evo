'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect } from 'react';

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      import('@/lib/api/mocks/browser')
        .then(({ worker }) => {
          worker.start({ onUnhandledRequest: 'bypass' });
        })
        .catch(() => {
          // MSW not available in non-dev environments
        });
    }
  }, []);

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
