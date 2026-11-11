'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { AuthListener } from '@/features/auth/auth-listener';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: true },
          // Online-first: mutasi tidak pernah ditahan lalu dikirim diam-diam saat
          // koneksi kembali ('always' = langsung gagal jika offline), dan tidak
          // di-retry otomatis. Retry dilakukan user dengan idempotency key yang sama.
          mutations: { retry: false, networkMode: 'always' },
        },
      }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <AuthListener />
      {children}
      <Toaster position="top-right" richColors />
    </QueryClientProvider>
  );
}
