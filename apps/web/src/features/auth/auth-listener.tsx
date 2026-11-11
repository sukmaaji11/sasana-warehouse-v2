'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { getSupabase } from '@/lib/supabase/client';

/** Membersihkan cache dan kembali ke /login saat sesi berakhir (logout, token dicabut). */
export function AuthListener() {
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    const { data } = getSupabase().auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        queryClient.clear();
        router.replace('/login');
        router.refresh();
      }
    });
    return () => data.subscription.unsubscribe();
  }, [router, queryClient]);

  return null;
}
