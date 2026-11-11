'use client';

import {
  listItems,
  listLocations,
  listParties,
  listUsers,
  queryKeys,
  type PartyTable,
} from '@sasana/shared-api';
import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getSupabase } from '@/lib/supabase/client';

export const useLocations = () =>
  useQuery({ queryKey: queryKeys.locations, queryFn: () => listLocations(getSupabase()) });

export const useItems = () => useQuery({ queryKey: queryKeys.items, queryFn: () => listItems(getSupabase()) });

export const useParties = (table: PartyTable) =>
  useQuery({ queryKey: queryKeys[table], queryFn: () => listParties(getSupabase(), table) });

export const useUsers = () => useQuery({ queryKey: queryKeys.users, queryFn: () => listUsers(getSupabase()) });

/**
 * Mutasi master data: invalidasi cache terkait, toast sukses.
 * Error ditampilkan di form oleh pemanggil (mutation.error).
 */
export function useSaveMutation<TVars>(
  fn: (vars: TVars) => Promise<unknown>,
  invalidate: QueryKey[],
  successMessage: string,
  onDone?: () => void,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: async () => {
      await Promise.all(invalidate.map((queryKey) => qc.invalidateQueries({ queryKey })));
      toast.success(successMessage);
      onDone?.();
    },
  });
}
