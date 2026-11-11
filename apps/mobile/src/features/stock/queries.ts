import { getInbound, listInbounds, listItems, listParties, listStockLevels, queryKeys } from '@sasana/shared-api';
import { useQuery } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { supabase } from '@/lib/supabase';

export const useStockLevels = () =>
  useQuery({ queryKey: queryKeys.stockLevels, queryFn: () => listStockLevels(supabase) });
export const useItems = () => useQuery({ queryKey: queryKeys.items, queryFn: () => listItems(supabase) });
export const useVendors = () => useQuery({ queryKey: queryKeys.vendors, queryFn: () => listParties(supabase, 'vendors') });
export const useInbounds = () => useQuery({ queryKey: queryKeys.inbounds, queryFn: () => listInbounds(supabase, 50) });
export const useInbound = (id: string) => useQuery({ queryKey: queryKeys.inbound(id), queryFn: () => getInbound(supabase, id) });

export const STOCK_INVALIDATE = [queryKeys.stockLevels, queryKeys.movementsAll, queryKeys.inbounds, queryKeys.adjustments] as const;

/** Satu key per form; dipakai ulang saat "Kirim ulang" agar tidak menggandakan stok. */
export const newIdempotencyKey = () => randomUUID();
