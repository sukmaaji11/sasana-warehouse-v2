'use client';

import {
  getAdjustment,
  getInbound,
  listAdjustments,
  listInbounds,
  listMovements,
  listProductLocations,
  listStockLevels,
  queryKeys,
  type MovementFilter,
} from '@sasana/shared-api';
import { useQuery } from '@tanstack/react-query';
import { getSupabase } from '@/lib/supabase/client';

export const useStockLevels = () =>
  useQuery({ queryKey: queryKeys.stockLevels, queryFn: () => listStockLevels(getSupabase()) });

export const useMovements = (filter: MovementFilter) =>
  useQuery({ queryKey: queryKeys.movements(filter), queryFn: () => listMovements(getSupabase(), filter) });

export const useInbounds = () => useQuery({ queryKey: queryKeys.inbounds, queryFn: () => listInbounds(getSupabase()) });

export const useInbound = (id: string) =>
  useQuery({ queryKey: queryKeys.inbound(id), queryFn: () => getInbound(getSupabase(), id) });

export const useAdjustments = () =>
  useQuery({ queryKey: queryKeys.adjustments, queryFn: () => listAdjustments(getSupabase()) });

export const useAdjustment = (id: string) =>
  useQuery({ queryKey: queryKeys.adjustment(id), queryFn: () => getAdjustment(getSupabase(), id) });

export const useProductLocations = () =>
  useQuery({ queryKey: queryKeys.productLocations, queryFn: () => listProductLocations(getSupabase()) });

/** Semua cache yang terpengaruh setelah transaksi stok berhasil. */
export const STOCK_INVALIDATE = [
  queryKeys.stockLevels,
  queryKeys.movementsAll,
  queryKeys.inbounds,
  queryKeys.adjustments,
] as const;

/** Idempotency key baru per form. Dipakai ulang saat user menekan "Kirim ulang". */
export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}
