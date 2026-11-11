import { getMyContext, queryKeys } from '@sasana/shared-api';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export function useMyContext(enabled = true) {
  return useQuery({
    queryKey: queryKeys.myContext,
    queryFn: () => getMyContext(supabase),
    enabled,
    staleTime: 60_000,
  });
}
