'use client';

import { getShipment, listDrivers, listShipments, queryKeys, type ShipmentRow } from '@sasana/shared-api';
import { SHIPMENT_STATUS_COLORS, SHIPMENT_STATUS_LABELS, type ShipmentStatus } from '@sasana/shared-constants';
import type { MyContext } from '@sasana/shared-types';
import { useQuery } from '@tanstack/react-query';
import { getSupabase } from '@/lib/supabase/client';
import { STOCK_INVALIDATE } from '@/features/stock/queries';

export const useShipments = (statuses?: readonly ShipmentStatus[]) =>
  useQuery({
    queryKey: queryKeys.shipments({ statuses: statuses ?? 'all' }),
    queryFn: () => listShipments(getSupabase(), { statuses }),
  });

export const useShipment = (id: string) =>
  useQuery({ queryKey: queryKeys.shipment(id), queryFn: () => getShipment(getSupabase(), id) });

export const useDrivers = () => useQuery({ queryKey: queryKeys.drivers, queryFn: () => listDrivers(getSupabase()) });

export const SHIPMENT_INVALIDATE = [...STOCK_INVALIDATE, queryKeys.shipmentsAll] as const;

export function StatusBadge({ status }: { status: ShipmentStatus }) {
  const c = SHIPMENT_STATUS_COLORS[status];
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap"
      style={{ backgroundColor: c.bg, color: c.fg }}
    >
      {SHIPMENT_STATUS_LABELS[status]}
    </span>
  );
}

/** Izin UX — sama dengan pemeriksaan di RPC database. */
export function shipmentPermissions(user: MyContext, s: Pick<ShipmentRow, 'from_location_id' | 'to_location_id' | 'status'>) {
  const so = user.role === 'SUPER_OWNER';
  const has = (id: string) => so || user.locations.some((l) => l.id === id);
  const managesOrigin = so || ((user.role === 'ADMIN_GUDANG' || user.role === 'OWNER_PABRIK') && has(s.from_location_id));
  return {
    assign: managesOrigin && (s.status === 'CREATED' || s.status === 'ASSIGNED'),
    pickupOnBehalf: managesOrigin && s.status === 'ASSIGNED',
    receive: user.role !== 'DRIVER' && has(s.to_location_id) && s.status === 'PICKED_UP',
    cancel: (s.status === 'CREATED' || s.status === 'ASSIGNED') ? managesOrigin : s.status === 'PICKED_UP' && so,
  };
}
