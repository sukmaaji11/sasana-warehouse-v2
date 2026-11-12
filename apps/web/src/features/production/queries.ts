'use client';

import { getProduction, listProductions, queryKeys, type ProductionFilter } from '@sasana/shared-api';
import { useQuery } from '@tanstack/react-query';
import { getSupabase } from '@/lib/supabase/client';

export const useProductions = (filter: ProductionFilter = {}) =>
  useQuery({ queryKey: queryKeys.productions(filter), queryFn: () => listProductions(getSupabase(), filter) });

export const useProduction = (id: string) =>
  useQuery({ queryKey: queryKeys.production(id), queryFn: () => getProduction(getSupabase(), id) });
