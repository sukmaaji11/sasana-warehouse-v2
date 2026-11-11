'use client';

import { signOut } from '@sasana/shared-api';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getSupabase } from '@/lib/supabase/client';

export function useSignOut() {
  return useMutation({
    mutationFn: () => signOut(getSupabase()),
    onError: (e) => toast.error(e.message),
  });
}
