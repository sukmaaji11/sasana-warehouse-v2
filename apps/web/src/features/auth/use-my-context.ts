'use client';

import { getMyContext, myContextQueryOptions, queryKeys } from '@sasana/shared-api';
import { useQuery } from '@tanstack/react-query';
import { getSupabase } from '@/lib/supabase/client';

export function useMyContext() {
  return useQuery({
    queryKey: queryKeys.myContext,
    queryFn: () => getMyContext(getSupabase()),
    ...myContextQueryOptions,
  });
}
