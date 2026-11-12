'use client';

import { getDistribution, listDistributions, queryKeys, type DistributionFilter } from '@sasana/shared-api';
import { useQuery } from '@tanstack/react-query';
import { getSupabase } from '@/lib/supabase/client';
import { STOCK_INVALIDATE } from '@/features/stock/queries';

export const useDistributions = (filter: DistributionFilter = {}) =>
  useQuery({ queryKey: queryKeys.distributions(filter), queryFn: () => listDistributions(getSupabase(), filter) });

export const useDistribution = (id: string) =>
  useQuery({ queryKey: queryKeys.distribution(id), queryFn: () => getDistribution(getSupabase(), id) });

export const DISTRIBUTION_INVALIDATE = [...STOCK_INVALIDATE, queryKeys.distributionsAll] as const;
