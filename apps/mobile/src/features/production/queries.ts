import { getProduction, listProductions, queryKeys, voidTransaction, type ProductionFilter } from '@sasana/shared-api';
import type { MyContext } from '@sasana/shared-types';
import type { VoidValues } from '@sasana/shared-validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { STOCK_INVALIDATE } from '@/features/stock/queries';
import { supabase } from '@/lib/supabase';

export const useProductions = (filter: ProductionFilter = {}) =>
  useQuery({ queryKey: queryKeys.productions(filter), queryFn: () => listProductions(supabase, { limit: 50, ...filter }) });

export const useProduction = (id: string) =>
  useQuery({ queryKey: queryKeys.production(id), queryFn: () => getProduction(supabase, id) });

export const PRODUCTION_INVALIDATE = [...STOCK_INVALIDATE, queryKeys.productionsAll] as const;

export function useVoidProduction(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: VoidValues) => voidTransaction(supabase, 'production', id, v),
    onSuccess: () => Promise.all(PRODUCTION_INVALIDATE.map((queryKey) => qc.invalidateQueries({ queryKey }))),
  });
}

/** Izin UX (Q10) — sama dengan pemeriksaan di RPC database. */
export function productionPermissions(user: MyContext) {
  return {
    create: user.role === 'OWNER_PABRIK' || user.role === 'ADMIN_PABRIK',
    void: user.role === 'SUPER_OWNER' || user.role === 'OWNER_PABRIK',
  };
}
