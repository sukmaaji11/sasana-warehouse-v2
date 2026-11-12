import { getDashboard, type ShipmentRow } from '@sasana/shared-api';
import type { MyContext } from '@sasana/shared-types';
import { useQuery } from '@tanstack/react-query';
import { useShipments } from '@/features/shipments/queries';
import { supabase } from '@/lib/supabase';

export const useDashboard = () =>
  useQuery({ queryKey: ['dashboard'], queryFn: () => getDashboard(supabase), refetchInterval: 60_000 });

/** Kiriman yang sedang dalam perjalanan menuju lokasi user (bisa diterima). */
export function useIncoming(me: MyContext) {
  const q = useShipments(['PICKED_UP']);
  const mine = new Set(me.locations.map((l) => l.id));
  const rows: ShipmentRow[] = (q.data ?? []).filter((s) => mine.has(s.to_location_id));
  return { ...q, rows };
}
