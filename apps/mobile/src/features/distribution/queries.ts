import { getDistribution, listDistributions, listParties, queryKeys, voidTransaction, type DistributionFilter } from '@sasana/shared-api';
import type { VoidValues } from '@sasana/shared-validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { STOCK_INVALIDATE } from '@/features/stock/queries';
import { supabase } from '@/lib/supabase';

export const useDistributions = (filter: DistributionFilter = {}) =>
  useQuery({ queryKey: queryKeys.distributions(filter), queryFn: () => listDistributions(supabase, { limit: 50, ...filter }) });

export const useDistribution = (id: string) =>
  useQuery({ queryKey: queryKeys.distribution(id), queryFn: () => getDistribution(supabase, id) });

export const useBuyers = () => useQuery({ queryKey: queryKeys.buyers, queryFn: () => listParties(supabase, 'buyers') });

export const DISTRIBUTION_INVALIDATE = [...STOCK_INVALIDATE, queryKeys.distributionsAll] as const;

export function useVoidDistribution(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: VoidValues) => voidTransaction(supabase, 'distribution', id, v),
    onSuccess: () => Promise.all(DISTRIBUTION_INVALIDATE.map((queryKey) => qc.invalidateQueries({ queryKey }))),
  });
}
