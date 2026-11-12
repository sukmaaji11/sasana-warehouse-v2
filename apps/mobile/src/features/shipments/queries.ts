import {
  assignShipmentDriver,
  cancelShipment,
  getShipment,
  listDrivers,
  listLocations,
  listShipments,
  pickupShipment,
  queryKeys,
  receiveShipment,
  type ShipmentRow,
} from '@sasana/shared-api';
import type { ShipmentStatus } from '@sasana/shared-constants';
import type { MyContext } from '@sasana/shared-types';
import type { CancelShipmentValues } from '@sasana/shared-validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { STOCK_INVALIDATE } from '@/features/stock/queries';
import { supabase } from '@/lib/supabase';

export const useShipments = (statuses?: readonly ShipmentStatus[]) =>
  useQuery({
    queryKey: queryKeys.shipments({ statuses: statuses ?? 'all' }),
    queryFn: () => listShipments(supabase, { statuses, limit: 50 }),
  });
export const useShipment = (id: string) => useQuery({ queryKey: queryKeys.shipment(id), queryFn: () => getShipment(supabase, id) });
export const useDrivers = () => useQuery({ queryKey: queryKeys.drivers, queryFn: () => listDrivers(supabase) });
export const useLocations = () => useQuery({ queryKey: queryKeys.locations, queryFn: () => listLocations(supabase) });

export const SHIPMENT_INVALIDATE = [...STOCK_INVALIDATE, queryKeys.shipmentsAll] as const;

function useShipmentMutation<T>(id: string, fn: (v: T) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () =>
      Promise.all([...SHIPMENT_INVALIDATE, queryKeys.shipment(id)].map((queryKey) => qc.invalidateQueries({ queryKey }))),
  });
}

export const usePickup = (id: string) => useShipmentMutation(id, () => pickupShipment(supabase, id));
export const useReceive = (id: string) => useShipmentMutation(id, () => receiveShipment(supabase, id));
export const useAssignDriver = (id: string) => useShipmentMutation(id, (d: string | null) => assignShipmentDriver(supabase, id, d));
export const useCancelShipment = (id: string) => useShipmentMutation(id, (v: CancelShipmentValues) => cancelShipment(supabase, id, v));

/** Izin UX — sama dengan pemeriksaan di RPC database. */
export function shipmentPermissions(user: MyContext, s: ShipmentRow) {
  const so = user.role === 'SUPER_OWNER';
  const has = (id: string) => so || user.locations.some((l) => l.id === id);
  const managesOrigin = so || ((user.role === 'ADMIN_GUDANG' || user.role === 'OWNER_PABRIK') && has(s.from_location_id));
  return {
    driverPickup: user.role === 'DRIVER' && s.driver_id === user.id && s.status === 'ASSIGNED',
    assign: managesOrigin && (s.status === 'CREATED' || s.status === 'ASSIGNED'),
    pickupOnBehalf: managesOrigin && s.status === 'ASSIGNED',
    receive: user.role !== 'DRIVER' && has(s.to_location_id) && s.status === 'PICKED_UP',
    cancel: s.status === 'CREATED' || s.status === 'ASSIGNED' ? managesOrigin : s.status === 'PICKED_UP' && so,
  };
}
