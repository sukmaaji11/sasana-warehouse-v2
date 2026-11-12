import type { ShipmentStatus } from '@sasana/shared-constants';
import type { Tables } from '@sasana/shared-types';
import type { CancelShipmentValues, ShipmentValues } from '@sasana/shared-validation';
import type { SasanaClient } from './client';
import { toAppError } from './errors';
import type { TxResult } from './stock';

type Person = { full_name: string } | null;

export type ShipmentRow = Tables<'shipments'> & {
  from_location: { name: string; code: string } | null;
  to_location: { name: string; code: string } | null;
  driver: Person;
  creator: Person;
  picker: Person;
  receiver: Person;
  shipment_items: (Tables<'shipment_items'> & { item: { sku: string; name: string; base_unit: string } | null })[];
};

export interface StatusResult {
  doc_no: string;
  status: ShipmentStatus;
  replayed: boolean;
}

function unwrap<R extends { data: unknown; error: unknown }>(res: R): NonNullable<R['data']> {
  if (res.error) throw toAppError(res.error);
  return res.data as NonNullable<R['data']>;
}

// Nama orang hanya terlihat sesuai RLS profiles (driver terlihat oleh pengelola; lainnya bisa null).
const SELECT = `*,
  from_location:locations!shipments_from_location_id_fkey(name, code),
  to_location:locations!shipments_to_location_id_fkey(name, code),
  driver:profiles!shipments_driver_id_fkey(full_name),
  creator:profiles!shipments_created_by_fkey(full_name),
  picker:profiles!shipments_picked_up_by_fkey(full_name),
  receiver:profiles!shipments_received_by_fkey(full_name),
  shipment_items(*, item:items(sku, name, base_unit))`;

export async function listShipments(
  client: SasanaClient,
  opts: { statuses?: readonly ShipmentStatus[]; limit?: number } = {},
): Promise<ShipmentRow[]> {
  let q = client.from('shipments').select(SELECT).order('created_at', { ascending: false }).limit(opts.limit ?? 100);
  if (opts.statuses?.length) q = q.in('status', [...opts.statuses]);
  return unwrap(await q) as unknown as ShipmentRow[];
}

export async function getShipment(client: SasanaClient, id: string): Promise<ShipmentRow> {
  return unwrap(await client.from('shipments').select(SELECT).eq('id', id).single()) as unknown as ShipmentRow;
}

/** Driver aktif (terlihat oleh SO, Admin Gudang, Owner Pabrik). */
export async function listDrivers(client: SasanaClient): Promise<{ id: string; full_name: string; username: string }[]> {
  return unwrap(
    await client.from('profiles').select('id, full_name, username').eq('role', 'DRIVER').eq('is_active', true).order('full_name'),
  );
}

export async function createShipment(client: SasanaClient, idempotencyKey: string, v: ShipmentValues): Promise<TxResult> {
  return unwrap(
    await client.rpc('create_shipment', {
      p_idempotency_key: idempotencyKey,
      p_from_location_id: v.from_location_id,
      p_to_location_id: v.to_location_id,
      p_driver_id: v.driver_id as string,
      p_notes: v.notes,
      p_items: v.items,
    }),
  ) as unknown as TxResult;
}

/** driverId null = lepas driver (kembali ke "Belum ada driver"). */
export async function assignShipmentDriver(client: SasanaClient, id: string, driverId: string | null): Promise<StatusResult> {
  return unwrap(
    await client.rpc('assign_shipment_driver', { p_shipment_id: id, p_driver_id: driverId as string }),
  ) as unknown as StatusResult;
}

export async function pickupShipment(client: SasanaClient, id: string): Promise<StatusResult> {
  return unwrap(await client.rpc('pickup_shipment', { p_shipment_id: id })) as unknown as StatusResult;
}

export async function receiveShipment(client: SasanaClient, id: string): Promise<StatusResult> {
  return unwrap(await client.rpc('receive_shipment', { p_shipment_id: id })) as unknown as StatusResult;
}

export async function cancelShipment(client: SasanaClient, id: string, v: CancelShipmentValues): Promise<StatusResult> {
  return unwrap(await client.rpc('cancel_shipment', { p_shipment_id: id, p_reason: v.reason })) as unknown as StatusResult;
}
